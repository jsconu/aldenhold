import { campaignOf, deed, nodeName } from './campaign';
import { hexDistance } from './hex';
import type { Army, GameState, Siege, SiegeRecord } from './types';
import { UNIT_TYPES } from './data';
import { isHero } from './units';
import { parseKey, townAt, townLocation, worldOf } from './world';
import { hasPassage } from './diplomacy';

/**
 * Sieges (docs/city-assaults-and-sieges.md, "Siege and surrender"). An army camped beside a hostile, defended
 * town encircles it across months. Each month the blockade (how well the besiegers can surround the garrison)
 * wears down the walls and the town's supplies; once supplies run out the garrison starves, and morale falls.
 * Below half strength the walls no longer protect an assault. Weak independent towns may offer to become your
 * vassal; capitals, the orcs' Hold and orc-held towns never surrender. The player can hold, storm or lift.
 * AI sieges of your towns, and siege battlefields with pillage, are later work.
 */

/** Walls below this no longer protect the defenders in an assault. */
export const BREACH = 50;
/** Morale at or below which a town that can surrender offers terms. */
const TERMS_MORALE = 40;

function adjacent(state: GameState, a: string, b: string): boolean {
  if (worldOf(state).kind === 'hex') return hexDistance(parseKey(a), parseKey(b)) === 1;
  return state.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Soldiers plus hero HP: what a side brings to a blockade. */
function strength(armies: Army[]): number {
  return armies.flatMap((a) => a.troops).reduce((n, t) => n + t.men, 0);
}

function defenders(state: GameState, townId: string): Army[] {
  const town = state.towns[townId];
  const at = townLocation(state, townId);
  return state.armies.filter((a) => a.at === at && a.owner === town.owner);
}

export function siegeOf(state: GameState, townId: string): Siege | undefined {
  return state.sieges.find((s) => s.town === townId);
}

/** Whether a town's walls are breached by a siege, so an assault on it fights without them. */
export function wallsBreached(state: GameState, townId: string): boolean {
  return (siegeOf(state, townId)?.walls ?? 100) < BREACH;
}

/** Whether this town would ever surrender, and why not. */
export function surrenderPolicy(state: GameState, townId: string): { terms: boolean; why: string } {
  const town = state.towns[townId];
  if (townId === campaignOf(state).lair) return { terms: false, why: `${nodeName(state, townId)} will fight to the last.` };
  if (town.kind === 'capital') return { terms: false, why: 'A capital never surrenders to a siege.' };
  if (town.owner !== 'neutral') return { terms: false, why: 'Its holders will not surrender; it must be starved and stormed.' };
  return { terms: true, why: 'An independent town: when its morale breaks it may offer to become your vassal.' };
}

/** How well the besiegers surround the garrison (0.25 to 1): a small force cannot starve a city it cannot surround. */
export function blockade(state: GameState, siege: Siege): number {
  const army = state.armies.find((a) => a.id === siege.army);
  const ours = army ? strength([army]) : 0;
  const theirs = Math.max(1, strength(defenders(state, siege.town)));
  return Math.max(0.25, Math.min(1, ours / (1.5 * theirs)));
}

/**
 * What next month will do to the town under this siege, for the player to see before ending the month. Without
 * engineers the walls barely fall (a siege can still starve the town); each engineer unit batters them down,
 * and boulder-throwers add their own blows.
 */
export function siegeOutlook(state: GameState, siege: Siege) {
  const army = state.armies.find((a) => a.id === siege.army);
  const engines = army?.troops.filter((t) => UNIT_TYPES[t.type].boulder).length ?? 0;
  const engineers = army?.troops.filter((t) => UNIT_TYPES[t.type].noncombat === 'engineer').length ?? 0;
  const b = blockade(state, siege);
  return {
    blockade: b,
    engineers,
    walls: Math.round((engineers ? 8 + 12 * b + 6 * (engineers - 1) : 2 + 2 * b) + 10 * engines),
    supplies: Math.round(b * 10) / 10,
    starving: siege.supplies <= Math.round(b * 10) / 10,
  };
}

/** Whether the army at `from` can lay siege to `to`, and why not. */
export function siegeQuote(state: GameState, from: string, to: string): { reason: string | null } {
  const town = townAt(state, to);
  const army = state.armies.find((a) => a.at === from && a.owner === 'player');
  if (state.battle || state.status !== 'playing') return { reason: 'Not now.' };
  if (!town || town.kind === 'lair') return { reason: 'Only towns can be besieged.' };
  if (town.owner === 'player') return { reason: 'This town is already yours.' };
  if (hasPassage(state, 'player', town.id)) return { reason: 'This town is your ally.' };
  if (!army) return { reason: 'You have no army there.' };
  if (!defenders(state, town.id).length) return { reason: 'It is undefended: march in to take it.' };
  if (!adjacent(state, from, to)) return { reason: `Move next to ${nodeName(state, town.id)} first: a siege camp must stand beside its walls.` };
  if (siegeOf(state, town.id)) return { reason: 'You are already besieging it.' };
  if (state.sieges.some((s) => s.army === army.id)) return { reason: 'This army is already besieging another town.' };
  return { reason: null };
}

/** The whole army at `from` encircles the town: its month's marching is spent setting up the siege camp. */
export function beginSiege(state: GameState, from: string, to: string): string | null {
  const { reason } = siegeQuote(state, from, to);
  if (reason) return reason;
  const town = townAt(state, to)!;
  const army = state.armies.find((a) => a.at === from && a.owner === 'player')!;
  for (const t of army.troops) t.mp = 0;
  state.sieges.push({
    town: town.id, army: army.id, camp: from, startedTurn: state.turn,
    walls: 100, supplies: Math.max(2, Math.min(8, 2 + Math.floor(town.pop / 800))), morale: 100, offer: false,
  });
  deed(state, 'battle', `You lay siege to ${nodeName(state, town.id)}.`, to);
  return null;
}

function end(state: GameState, siege: Siege, result: SiegeRecord['result'], text: string): string {
  state.sieges = state.sieges.filter((s) => s !== siege);
  state.siegeLog.push({ town: siege.town, turn: state.turn, result });
  deed(state, result === 'lifted' ? 'realm' : 'battle', text, townLocation(state, siege.town));
  return text;
}

/** A town taken by storm ends its siege (called when the town changes hands). */
export function siegeStormed(state: GameState, townId: string) {
  const siege = siegeOf(state, townId);
  if (siege) end(state, siege, 'stormed', `The siege of ${nodeName(state, townId)} ends: the town has been stormed.`);
}

/** Lift a siege: the army is free to march again next month. */
export function liftSiege(state: GameState, townId: string): string | null {
  const siege = siegeOf(state, townId);
  if (!siege) return 'There is no siege there.';
  end(state, siege, 'lifted', `You lift the siege of ${nodeName(state, townId)}.`);
  return null;
}

/** Accept a town's offer to become your vassal: it grants passage, keeps its own garrison, and the siege ends. */
export function acceptTerms(state: GameState, townId: string): string | null {
  const siege = siegeOf(state, townId);
  if (!siege?.offer) return 'The town has not offered terms.';
  state.treaties[townId] = { relation: 'vassal', passage: true, signedTurn: state.turn };
  end(state, siege, 'vassal', `${nodeName(state, townId)} becomes your vassal and opens its gates to your armies. The siege ends.`);
  return null;
}

/** Refuse the terms and keep the siege going: the town will not offer again for a while. */
export function refuseTerms(state: GameState, townId: string): string | null {
  const siege = siegeOf(state, townId);
  if (!siege?.offer) return 'The town has not offered terms.';
  siege.offer = false;
  siege.morale = Math.min(100, siege.morale + 15);
  deed(state, 'battle', `You refuse ${nodeName(state, townId)}'s terms. The siege goes on.`, townLocation(state, townId));
  return null;
}

/** A month of siege: walls and supplies wear down, a starving garrison loses men, morale falls; terms may follow. */
export function advanceSieges(state: GameState): string[] {
  const news: string[] = [];
  for (const siege of [...state.sieges]) {
    const town = state.towns[siege.town];
    const army = state.armies.find((a) => a.id === siege.army && a.owner === 'player');
    const name = nodeName(state, siege.town);
    if (!town || town.owner === 'player') { news.push(end(state, siege, 'stormed', `The siege of ${name} ends: the town is yours.`)); continue; }
    if (!army || army.at !== siege.camp) { news.push(end(state, siege, 'lifted', `The siege of ${name} is lifted: the besieging army has gone.`)); continue; }
    if (!defenders(state, siege.town).length) {
      news.push(end(state, siege, 'broken', `${name}'s garrison is gone. March in to take the town.`));
      continue;
    }
    const outlook = siegeOutlook(state, siege);
    siege.walls = Math.max(0, siege.walls - outlook.walls);
    siege.supplies = Math.max(0, Math.round((siege.supplies - outlook.supplies) * 10) / 10);
    if (siege.supplies === 0) {
      // Starvation: every defending unit loses a tenth of its men (at least one); heroes weaken but live.
      for (const a of defenders(state, siege.town)) {
        for (const t of a.troops) t.men = isHero(t.type) ? Math.max(1, t.men - 2) : t.men - Math.max(1, Math.round(t.men * 0.1));
        a.troops = a.troops.filter((t) => t.men > 0);
      }
      state.armies = state.armies.filter((a) => a.troops.length);
      siege.morale = Math.max(0, siege.morale - 20);
      news.push(`${name} is starving under your siege.`);
    } else {
      siege.morale = Math.max(0, siege.morale - Math.round(5 * outlook.blockade) - (siege.walls === 0 ? 5 : 0));
    }
    if (!siege.offer && siege.morale <= TERMS_MORALE && surrenderPolicy(state, siege.town).terms) {
      siege.offer = true;
      deed(state, 'battle', `${name} offers to become your vassal if you lift the siege.`, townLocation(state, siege.town));
      news.push(`${name} offers terms.`);
    }
  }
  return news;
}
