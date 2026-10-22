import { SPECIES } from '../content/lairs';
import { observeOrcRoutes } from './scouts';
import { endRaid, planRaids, resolveRaids } from './raids';
import { discoverLairs, newLairState, settleLairs } from './lairs';
import { recoverFallenKit } from './items';
import { orcTurn } from './ai';
import { autoResolve, createBattle, isAI, runAI } from './battle';
import { getCampaign } from '../content';
import { hasPassage, relationWith } from './diplomacy';
import { newTreasury, recordPurchase, settleTreasury, type CashFlow } from './economy';
import { settleHeldQuests, advanceQuests, endEncounter, newQuestState, onTownOwnershipChange, recruitBan, unlockQuests } from './quests';
import { advanceCities, cityMaintenance, startingCities, type CityPhaseResult } from './cities';
import { basicLoadout, finishRefits, troopUpkeep } from './equipment';
import { HERO_NAMES, HIREABLE_HEROES, UNIT_TYPES } from './data';
import { random } from './rng';
import type { Army, Battle, CampaignDefinition, CampaignId, DeedKind, FactionId, GameState, HeroOffer, MonsterSpecies, MonthlyLedger, Town, Troop } from './types';
import { heroLevel, heroMaxHp, heroMaxMana, isHero } from './units';
import {
  landAt, locationName, marchOptions, marchRate, neighbors, pathTo, stepCost, townAt, townLocation, worldOf,
} from './world';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_TAX = 50;
const MIN_POP_AFTER_RECRUIT = 500;
const OFFER_CHANCE = 0.3;
const MAX_OFFERS = 2;
/** Prevent a mid-phase victory from cancelling attacks that belong to the same month. */
const runningMonths = new WeakSet<GameState>();
const OFFER_MONTHS = 3;

export function newGame(seed = Math.floor(Math.random() * 2 ** 31), campaignId: CampaignId = 'valley-quickplay'): GameState {
  const def = getCampaign(campaignId);
  const state: GameState = {
    version: 16,
    campaignId: def.id,
    campaignRevision: def.revision,
    endingReason: null,
    turn: 1,
    gold: def.startingGold,
    treasury: newTreasury(def.startingGold),
    cityEconomies: {}, 
    nextId: 1,
    seed,
    nodes: def.nodes.map((n) => ({ ...n })),
    edges: def.edges.map(([a, b]) => [a, b] as [string, string]),
    towns: {},
    armies: [],
    battle: null,
    pending: [],
    offers: def.offers.map((o) => ({ ...o })),
    log: [],
    journal: [],
    quests: newQuestState(),
    items: {},
    treaties: {},
    flags: [],
    lairs: newLairState(campaignId),
    raids: [],
    raidLog: [],
    scoutReports: [],
    status: 'playing',
  };
  for (const t of def.towns) state.towns[t.id] = { ...t };
  state.cityEconomies = startingCities(state.towns);
  for (const a of def.armies) {
    state.armies.push({ id: state.nextId++, owner: a.owner, at: startLocation(state, a.at), from: null, troops: a.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) });
  }
  deed(state, 'story', def.intro, townLocation(state, def.capital));
  // The opening quests simply begin available; later ones are announced when they unlock.
  unlockQuests(state);
  return state;
}

/** Start positions name a location on the valley and a town or landmark on a hex map. */
export function startLocation(state: GameState, id: string): string {
  const world = worldOf(state);
  if (world.kind === 'graph') return id;
  const place = world.places.find((p) => p.id === id);
  if (!place) throw new Error(`Unknown start place ${id}`);
  return `${place.col},${place.row}`;
}

/** The static definition of the campaign this game is playing. */
export function campaignOf(state: GameState): CampaignDefinition {
  return getCampaign(state.campaignId);
}

export function makeTroop(state: GameState, type: string, name?: string): Troop {
  const t: Troop = { id: state.nextId++, type, men: UNIT_TYPES[type].men, xp: 0,
    mp: 0, gear: basicLoadout(type), refit: null };
  t.mp = marchRate(state, t);
  if (isHero(type)) {
    t.name = name ?? UNIT_TYPES[type].name;
    t.men = heroMaxHp(type, 0);
    t.mana = heroMaxMana(type, 0);
  }
  return t;
}

export function lordOf(state: GameState): Troop | undefined {
  return state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops).find((t) => t.type === 'lord');
}

/**
 * The most formations (heroes included) one army can hold. Each side's deployment zone fits 27, so an army of 12
 * always deploys whole with room to manoeuvre. Recruiting, hiring and marching into a full army are refused.
 */
export const ARMY_CAP = 12;

/** Room left in the player's army at a location (the full cap if none is there). */
export function armyRoom(state: GameState, at: string): number {
  return ARMY_CAP - (armyAt(state, at, 'player')?.troops.length ?? 0);
}

function fullReason(state: GameState, at: string): string {
  return `The army at ${nodeName(state, at)} is full: ${ARMY_CAP} formations is the most one army can hold.`;
}

/** What hiring this hero would cost, and why it can't happen now (`reason` null means it can). */
export function hireQuote(state: GameState, offer: HeroOffer): { gold: number; reason: string | null } {
  const gold = UNIT_TYPES[offer.type]?.cost ?? 0;
  let reason: string | null = null;
  if (state.battle || state.status !== 'playing') reason = 'Not now.';
  else if (!state.offers.includes(offer) || state.towns[offer.town]?.owner !== 'player') reason = 'That offer is gone.';
  else if (armyRoom(state, townLocation(state, offer.town)) < 1) reason = fullReason(state, townLocation(state, offer.town));
  else if (state.gold < gold) reason = `You need ${gold} gold.`;
  return { gold, reason };
}

/** Hire a hero who has offered their service. Returns the refusal reason, or null. */
export function hireHero(state: GameState, offer: HeroOffer): string | null {
  const quote = hireQuote(state, offer);
  if (quote.reason) return quote.reason;
  const type = UNIT_TYPES[offer.type];
  state.gold -= type.cost;
  state.offers = state.offers.filter((o) => o !== offer);
  const troop = makeTroop(state, offer.type, offer.name);
  recordPurchase(state, offer.town, 'hero-hire', type.cost, `hire:${troop.id}`, offer.name);
  joinGarrison(state, offer.town, troop);
  deed(state, 'hero', `${offer.name} the ${type.name.toLowerCase()} joins you in ${nodeName(state, offer.town)}.`, townLocation(state, offer.town));
  return null;
}

/** Expire old hero offers and maybe make a new one. Returns the news line for a new offer. */
function newOffers(state: GameState): string | null {
  state.offers = state.offers.filter((o) => o.expires >= state.turn && state.towns[o.town]?.owner === 'player');
  if (state.offers.length >= MAX_OFFERS || random(state) >= OFFER_CHANCE) return null;
  const towns = Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair');
  if (!towns.length) return null;
  const town = towns[Math.floor(random(state) * towns.length)];
  const type = HIREABLE_HEROES[Math.floor(random(state) * HIREABLE_HEROES.length)];
  const taken = new Set([...state.armies.flatMap((a) => a.troops.map((t) => t.name)), ...state.offers.map((o) => o.name)]);
  const names = HERO_NAMES[type].filter((n) => !taken.has(n));
  if (!names.length) return null;
  const name = names[Math.floor(random(state) * names.length)];
  state.offers.push({ town: town.id, type, name, expires: state.turn + OFFER_MONTHS });
  return `${name}, a ${UNIT_TYPES[type].name.toLowerCase()}, offers to serve you in ${nodeName(state, town.id)}.`;
}

/** Rolling chronicle of recent news. Bounded; the journal keeps what matters for good. */
export function log(state: GameState, line: string) {
  state.log.unshift(`${dateLabel(state.turn)}: ${line}`);
  state.log.length = Math.min(state.log.length, 60);
}

/** Record a deed in the permanent journal (BASE-04) and announce it in the chronicle. */
export function deed(state: GameState, kind: DeedKind, text: string, place: string | null = null) {
  state.journal.push({ id: state.journal.length + 1, turn: state.turn, kind, text, place });
  log(state, text);
}

export function dateLabel(turn: number): string {
  return `${MONTHS[(turn - 1) % 12]}, year ${Math.floor((turn - 1) / 12) + 1}`;
}

/** Name of a location, town or landmark. */
export function nodeName(state: GameState, id: string): string {
  return locationName(state, id);
}

export function neighborsOf(state: GameState, at: string): string[] {
  return neighbors(state, at);
}

/** Put a freshly raised or hired troop into the player's army in a town. It can't march until next month. */
function joinGarrison(state: GameState, townId: string, troop: Troop) {
  troop.mp = 0;
  const at = townLocation(state, townId);
  const army = armyAt(state, at, 'player');
  if (army) army.troops.push(troop);
  else state.armies.push({ id: state.nextId++, owner: 'player', at, from: null, troops: [troop] });
}

export function armyAt(state: GameState, node: string, owner?: FactionId): Army | undefined {
  return state.armies.find((a) => a.at === node && (!owner || a.owner === owner));
}

export function findArmy(state: GameState, id: number): Army | undefined {
  return state.armies.find((a) => a.id === id);
}

export function townIncome(t: Town): number {
  return Math.floor((t.pop * t.tax) / 500);
}

export function townGrowth(t: Town): number {
  return Math.round(t.pop * (0.015 - t.tax * 0.0006));
}

export function monthlyIncome(state: GameState): number {
  return Object.values(state.towns)
    .filter((t) => t.owner === 'player')
    .reduce((sum, t) => sum + townIncome(t), 0);
}

export function monthlyUpkeep(state: GameState): number {
  return state.armies
    .filter((a) => a.owner === 'player')
    .flatMap((a) => a.troops)
    .reduce((sum, t) => sum + troopUpkeep(t, UNIT_TYPES[t.type].upkeep), 0);
}

export function canRecruitAt(state: GameState, town: Town, typeId: string): boolean {
  if (typeId === 'scout' && worldOf(state).kind !== 'hex') return false;
  const r = UNIT_TYPES[typeId].recruit;
  if (r !== null && typeof r === 'object') {
    // Allied free towns raise their own troops for you while the alliance holds.
    return r.ally === town.id && town.owner !== 'player' && relationWith(state, town.id) === 'ally';
  }
  return town.owner === 'player' && (r === 'any' ? town.kind !== 'lair' : r === 'capital' && town.kind === 'capital');
}

/** What raising this troop would cost, and why it can't happen now (`reason` null means it can). */
export function recruitQuote(state: GameState, townId: string, typeId: string): { gold: number; men: number; reason: string | null } {
  const town = state.towns[townId];
  const type = UNIT_TYPES[typeId];
  const gold = type?.cost ?? 0;
  const men = type?.men ?? 0;
  let reason: string | null = null;
  if (state.battle || state.status !== 'playing') reason = 'Not now.';
  else if (!town || !type || !canRecruitAt(state, town, typeId)) reason = `You can't raise ${type?.name ?? 'that'} here.`;
  else if (recruitBan(state, townId)) reason = `${nodeName(state, townId)} is rationing grain (${recruitBan(state, townId)!.name}): no new recruits for now.`;
  else if (armyRoom(state, townLocation(state, townId)) < 1) reason = fullReason(state, townLocation(state, townId));
  else if (state.gold < gold) reason = `You need ${gold} gold.`;
  else if (town.pop - men < MIN_POP_AFTER_RECRUIT) reason = `${nodeName(state, townId)} has no more men to spare.`;
  return { gold, men, reason };
}

/** Raise a troop in a town. Returns the refusal reason, or null on success. */
export function recruit(state: GameState, townId: string, typeId: string): string | null {
  const quote = recruitQuote(state, townId, typeId);
  if (quote.reason) return quote.reason;
  const town = state.towns[townId];
  const type = UNIT_TYPES[typeId];
  state.gold -= type.cost;
  town.pop -= type.men;
  const troop = makeTroop(state, typeId);
  recordPurchase(state, townId, 'recruitment', type.cost, `recruit:${troop.id}`, type.name);
  joinGarrison(state, townId, troop);
  log(state, `${type.name} raised in ${nodeName(state, townId)}.`);
  return null;
}

export function setTax(state: GameState, townId: string, tax: number) {
  const town = state.towns[townId];
  if (town?.owner === 'player') town.tax = Math.max(0, Math.min(MAX_TAX, Math.round(tax)));
}

/** Movement points the chosen troops share: the slowest one sets the pace. */
export function sharedMp(troops: Troop[]): number {
  return troops.length ? Math.min(...troops.map((t) => t.mp)) : 0;
}

/** Where the chosen troops at `from` can get to this month, with the cheapest route to each. */
export function playerMarchOptions(state: GameState, from: string, troopIds: number[]) {
  const moving = armyAt(state, from, 'player')?.troops.filter((t) => troopIds.includes(t.id) && t.mp > 0 && !t.refit) ?? [];
  return marchOptions(state, from, 'player', sharedMp(moving));
}

/**
 * How many months the chosen troops need to reach each location (MAP-03), counting this month's remaining
 * movement first and then a full month's march for the slowest troop. Battles and captures on the way are not
 * predicted. Empty if none of the chosen troops can march.
 */
export function arrivalEstimates(state: GameState, from: string, troopIds: number[]): Map<string, number> {
  const chosen = armyAt(state, from, 'player')?.troops.filter((t) => troopIds.includes(t.id) && !t.refit) ?? [];
  if (!chosen.length) return new Map();
  const left = sharedMp(chosen);
  const rate = Math.min(...chosen.map((t) => marchRate(state, t)));
  const months = new Map<string, number>();
  for (const [at, step] of marchOptions(state, from, 'player', Infinity)) {
    months.set(at, step.cost <= left ? 1 : 1 + Math.ceil((step.cost - left) / rate));
  }
  return months;
}

/**
 * March the chosen troops along the cheapest route to `to`. On the valley that is always one road away; on a
 * hex map it is as far as the slowest troop's movement allows. Returns an error message, or null.
 */
export function moveTroops(state: GameState, from: string, troopIds: number[], to: string): string | null {
  const quote = marchQuote(state, from, troopIds, to);
  if (quote.reason) return quote.reason;
  const src = armyAt(state, from, 'player')!;
  const moving = src.troops.filter((t) => quote.troopIds.includes(t.id));
  src.troops = src.troops.filter((t) => !moving.includes(t));
  if (!src.troops.length) removeArmy(state, src);
  // Troops marching together keep to the slowest one's pace, so the group stays together for the rest of the month.
  const left = sharedMp(moving) - quote.cost;
  for (const t of moving) t.mp = left;
  for (const t of moving) if (t.type === 'scout') delete t.scoutPost;
  // The marching troops keep their army's battle plan; formations without a custom place set up automatically.
  const army: Army = { id: state.nextId++, owner: 'player', at: from, from: null, troops: moving, ...(src.tactics ? { tactics: structuredClone(src.tactics) } : {}) };
  state.armies.push(army);
  marchAlong(state, army, quote.path);
  discoverLairs(state);
  return null;
}

export interface MarchQuote {
  /** Movement points the march spends. */
  cost: number;
  /** Locations stepped through, ending at the destination. */
  path: string[];
  /** The troops that would actually march: chosen, with movement left, and not refitting. */
  troopIds: number[];
  /** What happens on arrival, if anything. */
  ends: 'battle' | 'capture' | null;
  reason: string | null;
}

/** What marching these troops to `to` would cost and where it would end (`reason` null means it can go). */
export function marchQuote(state: GameState, from: string, troopIds: number[], to: string): MarchQuote {
  const refuse = (reason: string): MarchQuote => ({ cost: 0, path: [], troopIds: [], ends: null, reason });
  if (state.battle || state.status !== 'playing') return refuse('Not now.');
  const src = armyAt(state, from, 'player');
  if (!src) return refuse('You have no troops there.');
  const moving = src.troops.filter((t) => troopIds.includes(t.id) && t.mp > 0 && !t.refit);
  if (!moving.length) return refuse('None of the chosen troops can march this month.');
  const options = marchOptions(state, from, 'player', sharedMp(moving));
  const step = options.get(to);
  if (!step) return refuse(worldOf(state).kind === 'graph' ? 'That place is not next to this one.' : 'Those troops can’t reach there this month.');
  if (to !== from && moving.length > armyRoom(state, to)) {
    const room = Math.max(0, armyRoom(state, to));
    return refuse(`${room ? `Only ${room} more formation${room === 1 ? ' fits' : 's fit'}` : 'No more formations fit'} in the army at ${nodeName(state, to)} (${ARMY_CAP} at most).`);
  }
  return { cost: step.cost, path: pathTo(options, to), troopIds: moving.map((t) => t.id), ends: arrivalOutcome(state, to), reason: null };
}

/**
 * What a player army arriving at `at` runs into: a battle with another faction's army, the capture of a town
 * it doesn't own, or nothing. A neutral town with a passage treaty is neither.
 */
export function arrivalOutcome(state: GameState, at: string): 'battle' | 'capture' | null {
  const town = townAt(state, at);
  const passage = town !== undefined && hasPassage(state, 'player', town.id);
  if (state.armies.some((a) => a.at === at && a.owner !== 'player' && !(a.owner === 'neutral' && passage))) return 'battle';
  if (town && town.owner !== 'player' && !passage) return 'capture';
  return null;
}

/** Move an army (already in state.armies) one step into a location: fight whoever holds it, or settle there. */
export function enterNode(state: GameState, army: Army, to: string) {
  marchAlong(state, army, [to]);
}

/** A neutral army an ally lets through doesn't fight; anyone else of another faction does. */
function blocks(state: GameState, mover: Army, other: Army, at: string): boolean {
  if (other === mover || other.at !== at || other.owner === mover.owner) return false;
  const townId = townAt(state, at)?.id;
  return !(other.owner === 'neutral' && townId !== undefined && hasPassage(state, mover.owner, townId));
}

/**
 * Walk an army along a path. It stops at the first location held by another faction (a battle) or the first
 * town it doesn't own and has no passage through (a capture); otherwise it settles at the end.
 */
export function marchAlong(state: GameState, army: Army, path: string[]) {
  for (const at of path) {
    army.from = army.at;
    army.at = at;
    const enemy = state.armies.find((a) => blocks(state, army, a, at));
    if (enemy) {
      startBattle(state, army.id, enemy.id);
      return;
    }
    const town = townAt(state, at);
    if (town && town.owner !== army.owner && !hasPassage(state, army.owner, town.id)) break;
  }
  settle(state, army);
}

function settle(state: GameState, army: Army) {
  const friend = state.armies.find((a) => a !== army && a.at === army.at && a.owner === army.owner);
  if (friend) {
    friend.troops.push(...army.troops);
    removeArmy(state, army);
    army = friend;
  }
  army.from = null;
  const town = townAt(state, army.at);
  if (town && town.owner !== army.owner && !hasPassage(state, army.owner, town.id)) captureTown(state, town, army.owner);
}

export function captureTown(state: GameState, town: Town, owner: FactionId) {
  const name = nodeName(state, town.id);
  const was = town.owner;
  town.owner = owner;
  if (owner !== 'player') for (const a of state.armies.filter((a) => a.at === townLocation(state, town.id)))
    for (const t of a.troops) if (t.type === 'scout' && t.scoutPost === 'city') delete t.scoutPost;
  onTownOwnershipChange(state, town.id, owner);
  town.pop = Math.floor(town.pop * 0.9);
  if (owner === 'player') {
    town.tax = 15;
    deed(state, 'capture', town.kind === 'lair' ? `${name} has fallen to your army!` : `${name} now flies your banner.`, townLocation(state, town.id));
  } else if (was === 'player') {
    deed(state, 'loss', `${owner === 'orcs' ? 'Orcs have' : owner in SPECIES ? `${SPECIES[owner as MonsterSpecies].name} have` : 'The enemy has'} taken ${name} from you.`, townLocation(state, town.id));
  } else if (owner === 'orcs') {
    log(state, `Orcs have taken ${name}.`);
  }
  checkStatus(state);
}

function removeArmy(state: GameState, army: Army) {
  state.armies = state.armies.filter((a) => a !== army);
}

export function startBattle(state: GameState, attackerId: number, defenderId: number) {
  const attacker = findArmy(state, attackerId);
  const defender = findArmy(state, defenderId);
  if (!attacker || !defender || attacker.at !== defender.at) return;
  const involvesPlayer = attacker.owner === 'player' || defender.owner === 'player';
  if (involvesPlayer && state.battle) {
    state.pending.push({ attackerId, defenderId });
    return;
  }
  const town = townAt(state, attacker.at);
  const seed = Math.floor(random(state) * 2 ** 31);
  const b = createBattle(attacker.at, attacker, defender, !!town && town.owner === defender.owner, seed, landAt(state, attacker.at));
  if (!involvesPlayer) {
    autoResolve(b);
    applyBattle(state, b);
    return;
  }
  if (attacker.raid && town) b.raid = { lair: attacker.raid.lair, town: town.id };
  log(state, `Battle at ${nodeName(state, attacker.at)}!`);
  state.battle = b;
  if (isAI(b, b.active)) runAI(b);
}

/** Write the battle's losses back to the armies, move the loser out, and hand over the town. */
export function applyBattle(state: GameState, b: Battle) {
  if (!b.outcome) return;
  // Optional encounters always belong to the active battle; settling a stale copy must not repeat XP.
  if (b.encounter && state.battle !== b) return;
  const attacker = findArmy(state, b.attackerId);
  const defender = findArmy(state, b.defenderId);
  for (const army of [attacker, defender]) {
    if (!army) continue;
    for (const t of army.troops) {
      const u = b.units.find((x) => x.troopId === t.id);
      if (!u || u.reserve) continue;
      t.men = u.men;
      if (t.men <= 0) {
        // A fallen hero's equipment comes home if anyone of the army is left to carry it (see recoverFallenKit).
        const survivors = army.troops.some((x) => {
          const xu = b.units.find((y) => y.troopId === x.id);
          return x !== t && (!xu || xu.reserve || xu.men > 0);
        });
        const kit = army.owner === 'player' ? recoverFallenKit(state, t, survivors) : null;
        if (t.name) deed(state, army.owner === 'player' ? 'loss' : 'battle', `${t.name} died at ${nodeName(state, b.at)}.${kit ? ` ${kit}` : ''}`, b.at);
        continue;
      }
      if (isHero(t.type)) {
        const before = heroLevel(t.xp);
        t.mana = u.mana;
        t.xp += 1 + Math.floor(u.deeds / 2);
        if (heroLevel(t.xp) > before && army.owner === 'player') deed(state, 'hero', `${t.name} reaches level ${heroLevel(t.xp)}.`, b.at);
      } else {
        t.xp += 1;
      }
    }
    army.troops = army.troops.filter((t) => t.men > 0);
    if (!army.troops.length) removeArmy(state, army);
  }
  if (state.battle === b) state.battle = null;

  const place = nodeName(state, b.at);
  const winner = b.owners[b.outcome ?? 'defender'];
  if (b.owners.attacker === 'player' || b.owners.defender === 'player') {
    deed(state, 'battle', winner === 'player' ? `Victory at ${place}.` : `Defeat at ${place}.`, b.at);
  }
  settleLairs(state);
  // A raid: raiders plunder if they won and leave either way; nobody falls back and the town never changes hands.
  if (attacker?.raid) {
    endRaid(state, b, attacker.id);
    finishBattles(state);
    return;
  }
  // A quest encounter: nobody falls back or takes the site; the quest decides what follows.
  if (b.encounter) {
    endEncounter(state, b);
    finishBattles(state);
    return;
  }

  const survives = (a: Army | undefined): a is Army => !!a && !!findArmy(state, a.id);
  if (b.outcome === 'attacker' && survives(attacker)) {
    if (survives(defender)) fallBack(state, defender);
    settle(state, attacker);
  } else if (b.outcome === 'defender' && survives(attacker)) {
    fallBack(state, attacker);
  }
  finishBattles(state);
}

function finishBattles(state: GameState) {
  checkStatus(state);
  startNextPending(state);
  if (!runningMonths.has(state) && !state.battle && !state.pending.length) {
    settleHeldQuests(state);
    checkStatus(state);
  }
}

/** Survivors of a lost battle: attackers go back where they came from; defenders to a safe neighbor. */
export function fallBack(state: GameState, army: Army) {
  for (const t of army.troops) if (!isHero(t.type)) t.men = Math.max(1, Math.floor(t.men * 0.9));
  // A beaten army only falls back to its own towns or open country, never into someone else's town.
  const safe = (at: string) => {
    const town = townAt(state, at);
    return stepCost(state, at) < Infinity && !state.armies.some((a) => a.at === at && a.owner !== army.owner) && (!town || town.owner === army.owner);
  };
  const ownTown = (at: string) => Number(townAt(state, at)?.owner === army.owner);
  const options = army.from ? [army.from] : neighborsOf(state, army.at).sort((x, y) => ownTown(y) - ownTown(x));
  // Prefer somewhere the survivors fit without going over the army cap; overflowing beats being cut off.
  const fits = (at: string) => (armyAt(state, at, army.owner)?.troops.length ?? 0) + army.troops.length <= ARMY_CAP;
  const back = options.find((at) => safe(at) && fits(at)) ?? options.find(safe);
  if (back) {
    army.at = back;
    for (const t of army.troops) if (t.type === 'scout') delete t.scoutPost;
    settle(state, army);
    return;
  }
  removeArmy(state, army);
  const lord = army.troops.find((t) => t.type === 'lord');
  const capitalId = campaignOf(state).capital;
  const capital = townLocation(state, capitalId);
  const where = army.at;
  if (lord && state.towns[capitalId].owner === 'player' && safe(capital)) {
    lord.mp = 0;
    const escaped: Army = { id: state.nextId++, owner: 'player', at: capital, from: null, troops: [lord] };
    state.armies.push(escaped);
    settle(state, escaped);
    deed(state, 'loss', `Cut off at ${nodeName(state, where)}, the army scatters. ${lord.name} escapes to ${nodeName(state, capital)}.`, where);
  } else if (army.owner === 'player') {
    deed(state, 'loss', `Cut off at ${nodeName(state, where)}, the survivors scatter.`, where);
  } else {
    log(state, 'Cut off, the survivors scatter.');
  }
}

function startNextPending(state: GameState) {
  while (!state.battle && state.pending.length && state.status === 'playing') {
    const next = state.pending.shift()!;
    startBattle(state, next.attackerId, next.defenderId);
  }
}

/** Defeat takes precedence when the final victory also costs the capital or ruler. */
export function endingReason(state: GameState): GameState['endingReason'] {
  const { capital, lair } = campaignOf(state);
  if (state.towns[capital].owner !== 'player') return 'capital-lost';
  if (!lordOf(state)?.men) return 'lord-dead';
  if (state.battle || state.pending.length || runningMonths.has(state)) return null;
  if (state.towns[lair].owner === 'player') return 'lair-captured';
  const chapter = campaignOf(state).chapter;
  if (chapter && state.quests[chapter.finale]?.status === 'succeeded') return 'chapter-complete';
  return null;
}

export function checkStatus(state: GameState) {
  if (state.status !== 'playing') return;
  const reason = endingReason(state);
  if (!reason) return;
  state.endingReason = reason;
  state.status = reason === 'lair-captured' || reason === 'chapter-complete' ? 'won' : 'lost';
  const { capital, lair, chapter } = campaignOf(state);
  deed(state, 'ending', {
    'capital-lost': `${nodeName(state, capital)} has fallen. Your house is ended.`,
    'lord-dead': 'Your lord is dead. With no heir, your house is ended.',
    'lair-captured': `${nodeName(state, lair)} is broken. ${worldOf(state).kind === 'graph' ? 'The valley' : 'The realm'} is yours.`,
    'chapter-complete': chapter?.ending ?? 'The chapter is complete.',
  }[reason], reason === 'lair-captured' ? townLocation(state, lair) : reason === 'capital-lost' ? townLocation(state, capital) : null);
}

/** The phases of a month, in the order they run. */
export type MonthPhaseId =
  | 'snapshot' | 'cities' | 'population' | 'heroes' | 'treasury' | 'construction' | 'refits' | 'shortages'
  | 'desertion' | 'calendar' | 'offers' | 'quests' | 'lairs' | 'ai' | 'raids' | 'ending';

/** One line the month produced: news for the chronicle, or a deed that also goes in the journal. */
export interface MonthNote {
  text: string;
  deed?: { kind: DeedKind; place: string | null };
}

/** What a month did, phase by phase. The chronicle and journal lines are written from it. */
export interface MonthReport {
  /** The month that was closed. */
  month: number;
  phases: { id: MonthPhaseId; notes: MonthNote[] }[];
  /** Gold in and out, from the treasury phase. */
  ledger: MonthlyLedger | null;
  /** Battles waiting to be fought after the month closed (the AI phase is the only phase that starts them). */
  battlePending: boolean;
}

/** Shared between phases of one month: things a later phase needs from an earlier one. */
interface MonthContext {
  maintenance: CashFlow[];
  cities: CityPhaseResult | null;
  ledger: MonthlyLedger | null;
}

interface MonthPhase {
  id: MonthPhaseId;
  run(state: GameState, ctx: MonthContext): MonthNote[];
}

const news = (text: string): MonthNote => ({ text });

/**
 * The month, in order (EVENT-01, ECO-23). Order matters: maintenance is charged on the sites operating before
 * this month's construction finishes; the economy settles before the calendar turns; quests and deadlines are evaluated before the orcs move last.
 *
 * Interruptions: only the `ai` phase can start a battle, and every economic phase has already run by then, so a
 * month never has to resume halfway. Battles queued by the AI are fought after the month closes, and the ending
 * check runs again after each battle (in `applyBattle`), never re-running the month.
 */
const MONTH_PHASES: MonthPhase[] = [
  {
    id: 'snapshot',
    run(state, ctx) {
      ctx.maintenance = Object.values(state.towns).filter((t) => t.owner === 'player')
        .map((t) => ({ city: t.id, amount: cityMaintenance(state, t.id),
          actionId: `maintenance:${state.turn}:${t.id}`, counterparty: 'City facilities' }));
      return [];
    },
  },
  { id: 'cities', run(state, ctx) { ctx.cities = advanceCities(state); return []; } },
  {
    id: 'population',
    run(state, ctx) {
      for (const t of Object.values(state.towns)) {
        if (t.owner === 'player') t.pop = Math.max(0, t.pop + townGrowth(t) - (ctx.cities!.shortagePenalties[t.id] ?? 0));
      }
      return [];
    },
  },
  {
    id: 'heroes',
    // Heroes mend a quarter of their wounds and recover all their mana each month.
    run(state) {
      for (const t of state.armies.flatMap((a) => a.troops)) {
        if (!isHero(t.type)) continue;
        const max = heroMaxHp(t.type, t.xp);
        t.men = Math.min(max, t.men + Math.ceil(max / 4));
        t.mana = heroMaxMana(t.type, t.xp);
      }
      return [];
    },
  },
  {
    id: 'treasury',
    // Post real tax receipts by town, and wage payments by army location.
    run(state, ctx) {
      const taxes = Object.values(state.towns).filter((t) => t.owner === 'player')
        .map((t) => ({ city: t.id, amount: townIncome(t), actionId: `tax:${state.turn}:${t.id}`, counterparty: nodeName(state, t.id) }));
      const payroll = state.armies.filter((a) => a.owner === 'player')
        .map((a) => ({ city: payrollCity(state, a.at), amount: a.troops.reduce((sum, t) => sum + troopUpkeep(t, UNIT_TYPES[t.type].upkeep), 0),
          actionId: `wages:${state.turn}:${a.id}`, counterparty: 'Army payroll' }));
      ctx.ledger = settleTreasury(state, taxes, payroll, ctx.maintenance);
      return [];
    },
  },
  { id: 'construction', run(_state, ctx) { return ctx.cities!.completed.map((c) => news(`Construction completed at ${c}.`)); } },
  { id: 'refits', run(state) { return finishRefits(state).map((c) => news(`Refit finished: ${c}.`)); } },
  {
    id: 'shortages',
    run(state, ctx) {
      return ctx.cities!.shortages.filter((sh) => state.towns[sh.city].owner === 'player')
        .map((sh) => news(`${nodeName(state, sh.city)} lacks ${sh.missing} food units this month.`));
    },
  },
  {
    id: 'desertion',
    // Heroes stay loyal; hired soldiers walk.
    run(state, ctx) {
      if (!ctx.ledger || ctx.ledger.unpaidUpkeep <= 0) return [];
      const soldiers = (a: Army) => a.troops.filter((t) => !isHero(t.type));
      const biggest = state.armies.filter((a) => a.owner === 'player' && soldiers(a).length)
        .sort((a, c) => soldiers(c).length - soldiers(a).length)[0];
      if (!biggest) return [];
      const gone = soldiers(biggest).at(-1)!;
      biggest.troops = biggest.troops.filter((t) => t !== gone);
      if (!biggest.troops.length) removeArmy(state, biggest);
      return [{ text: `The treasury is empty. Unpaid ${UNIT_TYPES[gone.type].name} desert at ${nodeName(state, biggest.at)}.`,
        deed: { kind: 'realm', place: biggest.at } }];
    },
  },
  {
    id: 'calendar',
    run(state) {
      state.turn++;
      for (const a of state.armies) for (const t of a.troops) t.mp = marchRate(state, t);
      return [];
    },
  },
  { id: 'offers', run(state) { const line = newOffers(state); return line ? [news(line)] : []; } },
  // Scheduled events: quests unlock and missed deadlines end their stage (EVENT-01: before the AI moves).
  { id: 'quests', run(state) { return advanceQuests(state).map(news); } },
  // Lairs found by armies that marched near them, and any whose garrison is gone.
  { id: 'lairs', run(state) { return [...discoverLairs(state), ...settleLairs(state)].map(news); } },
  // The orcs' own battles, captures and raids are recorded by the rules they trigger.
  { id: 'ai', run(state) { orcTurn(state, observeOrcRoutes); return []; } },
  // Monster raids: last month's arrive (fighting or plundering), then next month's are planned and announced.
  // Like the AI, this can start battles, so it runs after every economic phase.
  { id: 'raids', run(state) { return [...resolveRaids(state), ...planRaids(state)].map(news); } },
  { id: 'ending', run(state) { checkStatus(state); return []; } },
];

/** The phase ids in run order, for documentation and tests. */
export const MONTH_ORDER: readonly MonthPhaseId[] = MONTH_PHASES.map((p) => p.id);

/** Wages are booked to the town an army stands in; on the valley every location is a named node. */
function payrollCity(state: GameState, at: string): string | null {
  return worldOf(state).kind === 'graph' ? at : townAt(state, at)?.id ?? null;
}

/**
 * Close the month: run every phase in order and return what happened. Each phase's lines are written to the
 * chronicle (and deeds to the journal) as soon as that phase finishes, so the chronicle stays in time order.
 * Returns null, doing nothing, during a battle or after the campaign has ended.
 */
export function advanceMonth(state: GameState): MonthReport | null {
  if (state.battle || state.status !== 'playing') return null;
  const report: MonthReport = { month: state.turn, phases: [], ledger: null, battlePending: false };
  const ctx: MonthContext = { maintenance: [], cities: null, ledger: null };
  runningMonths.add(state);
  try {
    for (const phase of MONTH_PHASES) {
      const notes = phase.run(state, ctx);
      for (const note of notes) {
        if (note.deed) deed(state, note.deed.kind, note.text, note.deed.place);
        else log(state, note.text);
      }
      report.phases.push({ id: phase.id, notes });
    }
  } finally { runningMonths.delete(state); }
  finishBattles(state);
  report.ledger = ctx.ledger;
  report.battlePending = state.battle !== null || state.pending.length > 0;
  return report;
}

/** End the month (the player's button). */
export function endTurn(state: GameState): MonthReport | null {
  return advanceMonth(state);
}
