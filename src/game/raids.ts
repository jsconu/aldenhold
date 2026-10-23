import { scoutSees } from './scouts';
import { lairsOf, LAIRS, SPECIES, type LairDefinition } from '../content/lairs';
import { UNIT_TYPES } from './data';
import { captureTown, dateLabel, deed, fallBack, findArmy, makeTroop, nodeName, startBattle } from './campaign';
import { BUILDING_IDS, BUILDINGS } from './cities';
import { recordPurchase } from './economy';
import { hexKey, hexNeighbors } from './hex';
import { lairLocation } from './lairs';
import { random } from './rng';
import type { Army, Battle, BuildingId, GameState, MonsterSpecies, RaidRecord, RaidResult, Side, StartTroop, Town } from './types';
import { attackFor, heroLevel, isHero, kitBonus } from './units';
import { parseKey, stepCost, townLocation, worldOf } from './world';

/**
 * Monster raids (monster raids spec, step 3). Each month every town you rule faces a threat from the active
 * lairs whose raiders can reach it; a strong enough garrison deters routine raids entirely, and below that the
 * chance falls as the garrison grows. A raid is announced one to three months ahead, can be turned back by
 * reinforcing, and on arrival fights the garrison or breaks into an undefended town (step 4). Goblins and
 * trolls harass: they plunder. Giants and titans besiege: they also knock down a building, and titans keep
 * the town they win (never your capital). Every raid's end goes into the raid log.
 */

/** A garrison this many times the threat deters routine raids altogether. */
export const DETERRENCE = 1.75;
/** No raids are planned before this month: time to settle in. */
export const RAID_GRACE_MONTH = 4;
/** The most likely a town is to be raided in a month, with no garrison at all. */
export const MAX_RAID_CHANCE = 0.5;
/**
 * A raiding party's power on the garrison-defence scale, per point of lair raid strength: about the defence that
 * holds against it in an even fight, from the seeded garrison report (npm run simulate:raids).
 */
export const POWER_PER_STRENGTH = 0.35;

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

/**
 * A lair in reach of a town: `power` is how hard its raiding party hits (the same at any distance); `pressure`
 * is how keen it is to raid this town in a month, falling off with distance.
 */
export interface ThreatSource { lair: LairDefinition; steps: number; power: number; pressure: number }

/** The active lairs whose raiders can reach this town, how hard each hits, and how often it is drawn to. */
export function threatSources(state: GameState, townId: string): ThreatSource[] {
  if (worldOf(state).kind !== 'hex') return [];
  const at = townLocation(state, townId);
  const out: ThreatSource[] = [];
  for (const def of lairsOf(state.campaignId)) {
    if (state.lairs[def.id]?.status !== 'active') continue;
    const steps = reach(state, def).get(at);
    if (steps === undefined) continue;
    const falloff = 1 - steps / (def.raid.radius + 1);
    out.push({ lair: def, steps, power: def.raid.strength * POWER_PER_STRENGTH, pressure: def.raid.activity * falloff });
  }
  return out;
}

/** A unit's worth in defending a town: attack and defence, scaled by the men it still has. */
function defenseOf(t: Army['troops'][number]): number {
  if (t.type === 'scout') return 0;
  const type = UNIT_TYPES[t.type];
  if (isHero(t.type)) return (type.hero!.leadership + kitBonus(t.kit).leadership + 2 * heroLevel(t.xp)) / 10;
  return ((attackFor(t.type, t.xp) + type.defense) / 5) * (t.men / type.men);
}

/** How well a town is defended: its garrison's units and heroes, a quarter more behind walls. */
export function garrisonDefense(state: GameState, townId: string): number {
  const at = townLocation(state, townId);
  const garrison = state.armies.find((a) => a.at === at && a.owner === 'player');
  const raw = garrison?.troops.reduce((sum, t) => sum + defenseOf(t), 0) ?? 0;
  return raw * 1.25;
}

export interface RaidOdds {
  /** The hardest raid that can come: the strongest party in reach. */
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
 * The town's monthly raid odds: zero with no lair in reach, and zero once the garrison is DETERRENCE times the
 * strongest raiding party in reach. Below that, the chance that some lair in reach is drawn to the town (capped
 * at MAX_RAID_CHANCE) falls steadily as the garrison grows, never rising with reinforcement.
 */
export function raidOdds(state: GameState, townId: string): RaidOdds {
  const sources = threatSources(state, townId);
  const threat = Math.max(0, ...sources.map((s) => s.power));
  const defense = garrisonDefense(state, townId);
  const needed = DETERRENCE * threat;
  if (threat <= 0) return { threat, defense, chance: 0, deterred: false, needed, sources };
  const deterred = defense >= needed;
  const pressure = 1 - sources.reduce((p, s) => p * (1 - s.pressure), 1);
  const chance = deterred ? 0 : Math.min(MAX_RAID_CHANCE, pressure) * (1 - defense / needed);
  return { threat, defense, chance, deterred, needed, sources };
}

function townsYouRule(state: GameState): Town[] {
  return Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair');
}

/** Where a raid comes from, as the player can know it: the lair if found, otherwise only the kind of raider. */
function raiders(state: GameState, def: LairDefinition): string {
  return state.lairs[def.id]?.discovered ? `${SPECIES[def.species].name} from ${def.name}` : `${SPECIES[def.species].name} from an unknown lair`;
}

/** What losing to this raid would cost, said plainly when it is announced and on the town's panel. */
export function raidStakes(state: GameState, lairId: string, townId: string): string {
  const how = SPECIES[LAIRS[lairId].species].raids;
  if (how.kind === 'harassment') return 'If they get in, they carry off gold and drive off people; the town stays yours.';
  if (how.takesTowns && state.towns[townId]?.kind !== 'capital') return 'This is a siege: if they win, they plunder, knock down a building and take the town.';
  return 'This is a siege: if they win, they plunder and knock down a building; the town stays yours.';
}

/** What the raiders do once they have won, for the battle's end screen. */
export function raidAftermath(state: GameState, lairId: string, townId: string): string {
  const how = SPECIES[LAIRS[lairId].species].raids;
  if (how.kind === 'harassment') return 'They carry off gold and drive off people. The town stays yours.';
  if (how.takesTowns && state.towns[townId]?.kind !== 'capital') return 'They plunder it, knock down a building and take the town.';
  return 'They plunder it and knock down a building. The town stays yours.';
}

export function monthsAway(months: number): string {
  return months <= 1 ? 'next month' : `in ${months} months`;
}

/**
 * Plan raids: for each town you rule, roll its odds once. A raid comes from the lair most drawn to the town
 * that isn't on cooldown; it is announced now and arrives after its species' warning (1–3 months).
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
    }).sort((a, b) => b.pressure - a.pressure || b.power - a.power);
    if (!ready.length) continue;
    const def = ready[0].lair;
    const warning = SPECIES[def.species].raids.warning;
    state.lairs[def.id].lastRaid = state.turn;
    state.raids.push({ lair: def.id, target: town.id, announced: state.turn, arrives: state.turn + warning });
    if (scoutSees(state, lairLocation(state, def))) {
    deed(state, 'realm', `Warning: ${raiders(state, def)} are gathering to raid ${nodeName(state, town.id)} ${monthsAway(warning)}. ${raidStakes(state, def.id, town.id)} A stronger garrison may turn them back.`, townLocation(state, town.id));
    news.push(`Raid expected at ${nodeName(state, town.id)} ${monthsAway(warning)}.`);
    }
  }
  return news;
}

function record(state: GameState, raid: { lair: string; target: string }, result: RaidResult, rest: Partial<RaidRecord> = {}): RaidRecord {
  const entry: RaidRecord = { turn: state.turn, lair: raid.lair, target: raid.target, result, battle: false, gold: 0, people: 0, damaged: null, garrisonLost: 0, raidersLost: 0, ...rest };
  state.raidLog.push(entry);
  return entry;
}

/**
 * Raids due this month arrive: the town is spared if it's no longer yours, the lair is gone, or the garrison
 * now deters the raid; a garrison fights the raiders (a battle you can play); an empty town is broken into.
 * A raid announced more than a month ahead gets a last reminder the month before it arrives.
 */
export function resolveRaids(state: GameState): string[] {
  const news: string[] = [];
  for (const raid of state.raids) {
    if (raid.arrives - state.turn !== 1 || raid.arrives - raid.announced <= 1 || !raidObserved(state, raid)) continue;
    deed(state, 'realm', `${raiders(state, LAIRS[raid.lair])} will reach ${nodeName(state, raid.target)} next month.`, townLocation(state, raid.target));
    news.push(`Raiders reach ${nodeName(state, raid.target)} next month.`);
  }
  for (const raid of state.raids.filter((r) => r.arrives <= state.turn)) {
    state.raids.splice(state.raids.indexOf(raid), 1);
    const def = LAIRS[raid.lair];
    const town = state.towns[raid.target];
    const name = nodeName(state, raid.target);
    if (!town || town.owner !== 'player') continue;
    if (state.lairs[def.id]?.status !== 'active') {
      deed(state, 'realm', `The raid on ${name} never came: ${def.name} has been cleared.`, townLocation(state, raid.target));
      record(state, raid, 'never-came');
      continue;
    }
    if (raidOdds(state, raid.target).deterred) {
      deed(state, 'realm', `${raiders(state, def)} saw ${name}’s garrison and turned back.`, townLocation(state, raid.target));
      record(state, raid, 'turned-back');
      news.push(`The raid on ${name} turned back.`);
      continue;
    }
    news.push(strike(state, raid));
  }
  return news;
}

/**
 * The raiders arrive: they fight the garrison (a battle you can play), or break into an empty town. Returns
 * the news. Exported for seeded balancing, which measures the fight even where a garrison would deter it.
 */
export function strike(state: GameState, raid: { lair: string; target: string }): string {
  const def = LAIRS[raid.lair];
  const name = nodeName(state, raid.target);
  const at = townLocation(state, raid.target);
  const party: Army = {
    id: state.nextId++, owner: def.species, at, from: null, raid: { lair: def.id },
    troops: RAID_PARTY[def.species].map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))),
  };
  const garrison = state.armies.find((a) => a.at === at && a.owner === 'player');
  if (!garrison) {
    const result = breakIn(state, def, raid.target, party, 1);
    record(state, raid, result.result, result);
    return `${name} was ${result.result === 'taken' ? 'taken' : result.result === 'sacked' ? 'sacked' : 'raided'}.`;
  }
  state.armies.push(party);
  deed(state, 'battle', `${raiders(state, def)} attack ${name}!`, at);
  startBattle(state, party.id, garrison.id);
  return `Raiders attack ${name}.`;
}

/** Damage to a town: its highest building (not one being built, nor one in `spare`) loses a level. */
export function knockDown(state: GameState, townId: string, spare: BuildingId[] = []): BuildingId | null {
  const city = state.cityEconomies[townId];
  if (!city) return null;
  const hit = [...BUILDING_IDS].reverse()
    .filter((k) => city.buildings[k] > 0 && city.project?.kind !== k && !spare.includes(k))
    .sort((a, b) => city.buildings[b] - city.buildings[a])[0];
  if (!hit) return null;
  city.buildings[hit] -= 1;
  return hit;
}

/**
 * Raiders got in. They carry off gold and drive off people in proportion to how many of them are left
 * (`share`, 1 for an empty town); a siege also knocks down a building; titans keep the town (never the
 * capital), staying as its garrison. Otherwise the party goes home.
 */
function breakIn(state: GameState, def: LairDefinition, townId: string, party: Army, share: number): Pick<RaidRecord, 'result' | 'gold' | 'people' | 'damaged'> {
  const town = state.towns[townId];
  const how = SPECIES[def.species].raids;
  const gold = Math.min(state.gold, Math.round(25 * def.raid.strength * share));
  const people = Math.min(Math.max(0, town.pop - 100), Math.round(15 * def.raid.strength * share));
  if (gold > 0) {
    state.gold -= gold;
    recordPurchase(state, townId, 'raid-loss', gold, `raid:${def.id}:${townId}:${state.turn}`, def.name);
  }
  town.pop -= people;
  const damaged = how.kind === 'siege' ? knockDown(state, townId) : null;
  const losses = `${gold} gold carried off and ${people} people fled${damaged ? `; the ${BUILDINGS[damaged].name.toLowerCase()} lost a level` : ''}`;
  if (how.takesTowns && town.kind !== 'capital') {
    deed(state, 'loss', `${raiders(state, def)} besieged ${nodeName(state, townId)}: ${losses}.`, townLocation(state, townId));
    if (!findArmy(state, party.id)) state.armies.push(party);
    delete party.raid;
    captureTown(state, town, def.species);
    return { result: 'taken', gold, people, damaged };
  }
  state.armies = state.armies.filter((a) => a.id !== party.id);
  deed(state, 'loss', `${raiders(state, def)} ${how.kind === 'siege' ? 'sacked' : 'raided'} ${nodeName(state, townId)}: ${losses}. The town is still yours.`, townLocation(state, townId));
  return { result: how.kind === 'siege' ? 'sacked' : 'plundered', gold, people, damaged };
}

/**
 * A raid battle has ended (losses already written back). If the raiders won they break in, with plunder in
 * proportion to how many of them are left; either way the battle's losses go into the raid log.
 */
export function endRaid(state: GameState, b: Battle, raiderId: number) {
  const party = findArmy(state, raiderId);
  const def = LAIRS[party?.raid?.lair ?? b.raid?.lair ?? ''];
  const town = Object.values(state.towns).find((t) => townLocation(state, t.id) === b.at);
  const fielded = (side: Side) => b.units.filter((u) => u.side === side && !u.reserve);
  const lost = (side: Side) => fielded(side).filter((u) => !isHero(u.type)).reduce((n, u) => n + u.startMen - Math.max(0, u.men), 0);
  const left = (side: Side) => {
    const start = fielded(side).reduce((n, u) => n + u.startMen, 0);
    return start ? fielded(side).reduce((n, u) => n + Math.max(0, u.men), 0) / start : 0;
  };
  if (!town || !def) {
    state.armies = state.armies.filter((a) => a.id !== raiderId);
    return;
  }
  const raid = { lair: def.id, target: town.id };
  const losses = { battle: true, garrisonLost: lost('defender'), raidersLost: lost('attacker') };
  if (b.outcome === 'attacker' && party) {
    const result = breakIn(state, def, town.id, party, left('attacker'));
    const garrison = state.armies.find((a) => a.at === b.at && a.owner === 'player');
    if (result.result === 'taken' && garrison) fallBack(state, garrison);
    record(state, raid, result.result, { ...result, ...losses });
    return;
  }
  state.armies = state.armies.filter((a) => a.id !== raiderId);
  deed(state, 'battle', `The raid on ${nodeName(state, town.id)} was beaten off.`, b.at);
  record(state, raid, 'beaten-off', losses);
}

/** Whether the army is a raiding party (it never captures, and leaves after its battle). */
export function isRaider(army: Army | undefined): boolean {
  return !!army?.raid;
}

/** The raid log for one town, newest first. */
export function raidsOn(state: GameState, townId: string): RaidRecord[] {
  return state.raidLog.filter((r) => r.target === townId).reverse();
}

export const RAID_RESULT_LABEL: Record<RaidResult, string> = {
  'never-came': 'Never came (lair cleared)',
  'turned-back': 'Turned back by the garrison',
  'beaten-off': 'Beaten off',
  plundered: 'Plundered',
  sacked: 'Sacked',
  taken: 'Town taken',
};

/** One raid's end, in a line: when, how it ended, what it cost and what the fight cost each side. */
export function raidLine(r: RaidRecord): string {
  const costs = [
    r.gold ? `${r.gold} gold` : '', r.people ? `${r.people} people` : '', r.damaged ? `${BUILDINGS[r.damaged].name} lost a level` : '',
    r.battle ? `garrison lost ${r.garrisonLost} men, raiders ${r.raidersLost}` : '',
  ].filter(Boolean);
  return `${dateLabel(r.turn)}: ${RAID_RESULT_LABEL[r.result]}${costs.length ? ` (${costs.join('; ')})` : ''}.`;
}

/** The source is visible while gathering; a town scout can spot a raid on its final approach. */
export function raidObserved(state: GameState, raid: {lair: string; target: string; arrives: number}): boolean {
  return scoutSees(state, lairLocation(state, LAIRS[raid.lair]))
    || (raid.arrives - state.turn <= 1 && scoutSees(state, townLocation(state, raid.target)));
}
