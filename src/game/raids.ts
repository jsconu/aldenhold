import { lairsOf, LAIRS, SPECIES, type LairDefinition } from '../content/lairs';
import { UNIT_TYPES } from './data';
import { deed, findArmy, makeTroop, nodeName, startBattle } from './campaign';
import { recordPurchase } from './economy';
import { hexKey, hexNeighbors } from './hex';
import { lairLocation } from './lairs';
import { random } from './rng';
import type { Army, Battle, GameState, MonsterSpecies, StartTroop, Town } from './types';
import { attackFor, heroLevel, isHero, kitBonus } from './units';
import { parseKey, stepCost, townLocation, worldOf } from './world';

/**
 * Monster raids (monster raids spec, step 3). Each month every town you rule faces a threat from the active
 * lairs whose raiders can reach it; a strong enough garrison deters routine raids entirely, and below that the
 * chance falls as the garrison grows. A raid is announced a month ahead, can be turned back by reinforcing,
 * and on arrival fights the garrison or harasses an undefended town. A raid never captures a town.
 */

/** A garrison this many times the threat deters routine raids altogether. */
export const DETERRENCE = 1.75;
/** No raids are planned before this month: time to settle in. */
export const RAID_GRACE_MONTH = 4;
/** The most likely a town is to be raided in a month, with no garrison at all. */
export const MAX_RAID_CHANCE = 0.5;

/** The party a lair sends: smaller than its home garrison. */
const RAID_PARTY: Record<MonsterSpecies, StartTroop[]> = {
  goblins: ['goblinSkirmishers', 'goblinSkirmishers', 'goblinArchers'],
  trolls: ['troll', 'troll'],
  giants: ['giant'],
  titans: ['titan', 'giant'],
};

/** Steps over passable ground from a lair to every location within its raid radius. */
function reach(state: GameState, def: LairDefinition): Map<string, number> {
  const start = lairLocation(state, def);
  const dist = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    if (d >= def.raid.radius) continue;
    for (const n of hexNeighbors(parseKey(cur))) {
      const k = hexKey(n);
      if (dist.has(k) || !(stepCost(state, k) < Infinity)) continue;
      dist.set(k, d + 1);
      queue.push(k);
    }
  }
  return dist;
}

export interface ThreatSource { lair: LairDefinition; steps: number; power: number }

/** The active lairs whose raiders can reach this town, and how much each threatens it. */
export function threatSources(state: GameState, townId: string): ThreatSource[] {
  if (worldOf(state).kind !== 'hex') return [];
  const at = townLocation(state, townId);
  const out: ThreatSource[] = [];
  for (const def of lairsOf(state.campaignId)) {
    if (state.lairs[def.id]?.status !== 'active') continue;
    const steps = reach(state, def).get(at);
    if (steps === undefined) continue;
    const falloff = 1 - steps / (def.raid.radius + 1);
    out.push({ lair: def, steps, power: def.raid.strength * falloff * def.raid.activity });
  }
  return out;
}

/** A formation's worth in defending a town: attack and defence, scaled by the men it still has. */
function defenseOf(t: Army['troops'][number]): number {
  const type = UNIT_TYPES[t.type];
  if (isHero(t.type)) return (type.hero!.leadership + kitBonus(t.kit).leadership + 2 * heroLevel(t.xp)) / 10;
  return ((attackFor(t.type, t.xp) + type.defense) / 5) * (t.men / type.men);
}

/** How well a town is defended: its garrison's formations and heroes, a quarter more behind walls. */
export function garrisonDefense(state: GameState, townId: string): number {
  const at = townLocation(state, townId);
  const garrison = state.armies.find((a) => a.at === at && a.owner === 'player');
  const raw = garrison?.troops.reduce((sum, t) => sum + defenseOf(t), 0) ?? 0;
  return raw * 1.25;
}

export interface RaidOdds {
  threat: number;
  defense: number;
  /** Chance of a routine raid being planned this month, 0 when out of reach or deterred. */
  chance: number;
  deterred: boolean;
  /** The garrison defence that would deter routine raids. */
  needed: number;
  sources: ThreatSource[];
}

/**
 * The town's monthly raid odds: zero with no lair in reach, zero at or above the deterrence threshold, and
 * otherwise falling steadily as the garrison grows (never rising with reinforcement).
 */
export function raidOdds(state: GameState, townId: string): RaidOdds {
  const sources = threatSources(state, townId);
  const threat = sources.reduce((sum, s) => sum + s.power, 0);
  const defense = garrisonDefense(state, townId);
  const needed = DETERRENCE * threat;
  if (threat <= 0) return { threat, defense, chance: 0, deterred: false, needed, sources };
  const deterred = defense >= needed;
  const chance = deterred ? 0 : MAX_RAID_CHANCE * Math.min(1, threat / 3) * (1 - defense / needed);
  return { threat, defense, chance, deterred, needed, sources };
}

function townsYouRule(state: GameState): Town[] {
  return Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair');
}

/** Where a raid comes from, as the player can know it: the lair if found, otherwise only the kind of raider. */
function raiders(state: GameState, def: LairDefinition): string {
  return state.lairs[def.id]?.discovered ? `${SPECIES[def.species].name} from ${def.name}` : `${SPECIES[def.species].name} from an unknown lair`;
}

/**
 * Plan next month's raids: for each town you rule, roll its odds once. A raid comes from the lair contributing
 * most of the threat that isn't on cooldown; it is announced now and arrives next month.
 */
export function planRaids(state: GameState): string[] {
  if (state.turn < RAID_GRACE_MONTH) return [];
  const news: string[] = [];
  for (const town of townsYouRule(state)) {
    if (state.raids.some((r) => r.target === town.id)) continue;
    const odds = raidOdds(state, town.id);
    if (!odds.chance || random(state) >= odds.chance) continue;
    const ready = odds.sources.filter((s) => {
      const last = state.lairs[s.lair.id].lastRaid;
      return last === null || state.turn - last >= s.lair.raid.cooldown;
    }).sort((a, b) => b.power - a.power);
    if (!ready.length) continue;
    const def = ready[0].lair;
    state.lairs[def.id].lastRaid = state.turn;
    state.raids.push({ lair: def.id, target: town.id, announced: state.turn, arrives: state.turn + 1 });
    deed(state, 'realm', `Warning: ${raiders(state, def)} are gathering to raid ${nodeName(state, town.id)} next month. A stronger garrison may turn them back.`, townLocation(state, town.id));
    news.push(`Raid expected at ${nodeName(state, town.id)}.`);
  }
  return news;
}

/**
 * Raids due this month arrive: the town is spared if it's no longer yours or now deters the raid; a garrison
 * fights the raiders (a battle you can play); an empty town is plundered. Ownership never changes.
 */
export function resolveRaids(state: GameState): string[] {
  const news: string[] = [];
  for (const raid of state.raids.filter((r) => r.arrives <= state.turn)) {
    state.raids.splice(state.raids.indexOf(raid), 1);
    const def = LAIRS[raid.lair];
    const town = state.towns[raid.target];
    const name = nodeName(state, raid.target);
    if (!town || town.owner !== 'player') continue;
    if (state.lairs[def.id]?.status !== 'active') {
      deed(state, 'realm', `The raid on ${name} never came: ${def.name} has been cleared.`, townLocation(state, raid.target));
      continue;
    }
    if (raidOdds(state, raid.target).deterred) {
      deed(state, 'realm', `${raiders(state, def)} saw ${name}’s garrison and turned back.`, townLocation(state, raid.target));
      news.push(`The raid on ${name} turned back.`);
      continue;
    }
    const at = townLocation(state, raid.target);
    const party: Army = {
      id: state.nextId++, owner: def.species, at, from: null, raid: { lair: def.id },
      troops: RAID_PARTY[def.species].map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))),
    };
    const garrison = state.armies.find((a) => a.at === at && a.owner === 'player');
    if (!garrison) {
      news.push(...plunder(state, def, raid.target));
      continue;
    }
    state.armies.push(party);
    deed(state, 'battle', `${raiders(state, def)} attack ${name}!`, at);
    startBattle(state, party.id, garrison.id);
    news.push(`Raiders attack ${name}.`);
  }
  return news;
}

/** Harassment: raiders carry off gold and drive off people. The town stays yours. */
function plunder(state: GameState, def: LairDefinition, townId: string): string[] {
  const town = state.towns[townId];
  const gold = Math.min(state.gold, Math.round(25 * def.raid.strength));
  const people = Math.min(Math.max(0, town.pop - 100), Math.round(15 * def.raid.strength));
  if (gold > 0) {
    state.gold -= gold;
    recordPurchase(state, townId, 'raid-loss', gold, `raid:${def.id}:${townId}:${state.turn}`, def.name);
  }
  town.pop -= people;
  deed(state, 'loss', `${raiders(state, def)} raided ${nodeName(state, townId)}: ${gold} gold carried off and ${people} people fled. The town is still yours.`, townLocation(state, townId));
  return [`${nodeName(state, townId)} was raided.`];
}

/**
 * A raid battle has ended (losses already written back). Raiders never take the town: if they won they plunder
 * and leave, and whatever is left of them goes home either way. The garrison stays.
 */
export function endRaid(state: GameState, b: Battle, raiderId: number) {
  const party = findArmy(state, raiderId);
  const def = LAIRS[party?.raid?.lair ?? ''];
  const won = b.outcome === 'attacker';
  state.armies = state.armies.filter((a) => a.id !== raiderId);
  const town = Object.values(state.towns).find((t) => townLocation(state, t.id) === b.at);
  if (!town || !def) return;
  if (won) plunder(state, def, town.id);
  else deed(state, 'battle', `The raid on ${nodeName(state, town.id)} was beaten off.`, b.at);
}

/** Whether the army is a raiding party (it never captures, and leaves after its battle). */
export function isRaider(army: Army | undefined): boolean {
  return !!army?.raid;
}

