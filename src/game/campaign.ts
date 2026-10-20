import { orcTurn } from './ai';
import { autoResolve, createBattle, isAI, runAI } from './battle';
import { getCampaign } from '../content';
import { hasPassage } from './diplomacy';
import { newTreasury, recordPurchase, settleTreasury } from './economy';
import { newQuestState, onTownOwnershipChange } from './quests';
import { advanceCities, cityMaintenance, startingCities } from './cities';
import { basicLoadout, finishRefits, troopUpkeep } from './equipment';
import { HERO_NAMES, HIREABLE_HEROES, UNIT_TYPES } from './data';
import { random } from './rng';
import type { Army, Battle, CampaignDefinition, CampaignId, DeedKind, FactionId, GameState, HeroOffer, Town, Troop } from './types';
import { heroLevel, heroMaxHp, heroMaxMana, isHero } from './units';
import {
  landAt, locationName, marchOptions, marchRate, neighbors, pathTo, stepCost, townAt, townLocation, worldOf,
} from './world';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_TAX = 50;
const MIN_POP_AFTER_RECRUIT = 500;
const OFFER_CHANCE = 0.3;
const MAX_OFFERS = 2;
const OFFER_MONTHS = 3;

export function newGame(seed = Math.floor(Math.random() * 2 ** 31), campaignId: CampaignId = 'valley-quickplay'): GameState {
  const def = getCampaign(campaignId);
  const state: GameState = {
    version: 10,
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
    items: [],
    treaties: {},
    status: 'playing',
  };
  for (const t of def.towns) state.towns[t.id] = { ...t };
  state.cityEconomies = startingCities(state.towns);
  for (const a of def.armies) {
    state.armies.push({ id: state.nextId++, owner: a.owner, at: startLocation(state, a.at), from: null, troops: a.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) });
  }
  deed(state, 'story', def.intro, townLocation(state, def.capital));
  return state;
}

/** Start positions name a location on the valley and a town or landmark on a hex map. */
function startLocation(state: GameState, id: string): string {
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

/** What hiring this hero would cost, and why it can't happen now (`reason` null means it can). */
export function hireQuote(state: GameState, offer: HeroOffer): { gold: number; reason: string | null } {
  const gold = UNIT_TYPES[offer.type]?.cost ?? 0;
  let reason: string | null = null;
  if (state.battle || state.status !== 'playing') reason = 'Not now.';
  else if (!state.offers.includes(offer) || state.towns[offer.town]?.owner !== 'player') reason = 'That offer is gone.';
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

function newOffers(state: GameState) {
  state.offers = state.offers.filter((o) => o.expires >= state.turn && state.towns[o.town]?.owner === 'player');
  if (state.offers.length >= MAX_OFFERS || random(state) >= OFFER_CHANCE) return;
  const towns = Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair');
  if (!towns.length) return;
  const town = towns[Math.floor(random(state) * towns.length)];
  const type = HIREABLE_HEROES[Math.floor(random(state) * HIREABLE_HEROES.length)];
  const taken = new Set([...state.armies.flatMap((a) => a.troops.map((t) => t.name)), ...state.offers.map((o) => o.name)]);
  const names = HERO_NAMES[type].filter((n) => !taken.has(n));
  if (!names.length) return;
  const name = names[Math.floor(random(state) * names.length)];
  state.offers.push({ town: town.id, type, name, expires: state.turn + OFFER_MONTHS });
  log(state, `${name}, a ${UNIT_TYPES[type].name.toLowerCase()}, offers to serve you in ${nodeName(state, town.id)}.`);
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

export function canRecruitAt(town: Town, typeId: string): boolean {
  const r = UNIT_TYPES[typeId].recruit;
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
  else if (!town || !type || !canRecruitAt(town, typeId)) reason = `You can't raise ${type?.name ?? 'that'} here.`;
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
  for (const t of moving) t.mp -= quote.cost;
  const army: Army = { id: state.nextId++, owner: 'player', at: from, from: null, troops: moving };
  state.armies.push(army);
  marchAlong(state, army, quote.path);
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

function captureTown(state: GameState, town: Town, owner: FactionId) {
  const name = nodeName(state, town.id);
  const was = town.owner;
  town.owner = owner;
  onTownOwnershipChange(state, town.id, owner);
  town.pop = Math.floor(town.pop * 0.9);
  if (owner === 'player') {
    town.tax = 15;
    deed(state, 'capture', town.kind === 'lair' ? `${name} has fallen to your army!` : `${name} now flies your banner.`, townLocation(state, town.id));
  } else if (was === 'player') {
    deed(state, 'loss', `${owner === 'orcs' ? 'Orcs have' : 'The enemy has'} taken ${name} from you.`, townLocation(state, town.id));
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
  log(state, `Battle at ${nodeName(state, attacker.at)}!`);
  state.battle = b;
  if (isAI(b, b.active)) runAI(b);
}

/** Write the battle's losses back to the armies, move the loser out, and hand over the town. */
export function applyBattle(state: GameState, b: Battle) {
  if (!b.outcome) return;
  const attacker = findArmy(state, b.attackerId);
  const defender = findArmy(state, b.defenderId);
  for (const army of [attacker, defender]) {
    if (!army) continue;
    for (const t of army.troops) {
      const u = b.units.find((x) => x.troopId === t.id);
      if (!u || u.reserve) continue;
      t.men = u.men;
      if (t.men <= 0) {
        if (t.name) deed(state, army.owner === 'player' ? 'loss' : 'battle', `${t.name} died at ${nodeName(state, b.at)}.`, b.at);
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

  const survives = (a: Army | undefined): a is Army => !!a && !!findArmy(state, a.id);
  if (b.outcome === 'attacker' && survives(attacker)) {
    if (survives(defender)) fallBack(state, defender);
    settle(state, attacker);
  } else if (b.outcome === 'defender' && survives(attacker)) {
    fallBack(state, attacker);
  }
  checkStatus(state);
  startNextPending(state);
}

/** Survivors of a lost battle: attackers go back where they came from; defenders to a safe neighbor. */
function fallBack(state: GameState, army: Army) {
  for (const t of army.troops) if (!isHero(t.type)) t.men = Math.max(1, Math.floor(t.men * 0.9));
  // A beaten army only falls back to its own towns or open country, never into someone else's town.
  const safe = (at: string) => {
    const town = townAt(state, at);
    return stepCost(state, at) < Infinity && !state.armies.some((a) => a.at === at && a.owner !== army.owner) && (!town || town.owner === army.owner);
  };
  const ownTown = (at: string) => Number(townAt(state, at)?.owner === army.owner);
  const options = army.from ? [army.from] : neighborsOf(state, army.at).sort((x, y) => ownTown(y) - ownTown(x));
  const back = options.find(safe);
  if (back) {
    army.at = back;
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
  if (state.towns[lair].owner === 'player') return 'lair-captured';
  return null;
}

export function checkStatus(state: GameState) {
  if (state.status !== 'playing') return;
  const reason = endingReason(state);
  if (!reason) return;
  state.endingReason = reason;
  state.status = reason === 'lair-captured' ? 'won' : 'lost';
  const { capital, lair } = campaignOf(state);
  deed(state, 'ending', {
    'capital-lost': `${nodeName(state, capital)} has fallen. Your house is ended.`,
    'lord-dead': 'Your lord is dead. With no heir, your house is ended.',
    'lair-captured': `${nodeName(state, lair)} is broken. ${worldOf(state).kind === 'graph' ? 'The valley' : 'The realm'} is yours.`,
  }[reason], reason === 'lair-captured' ? townLocation(state, lair) : reason === 'capital-lost' ? townLocation(state, capital) : null);
}

/** Wages are booked to the town an army stands in; on the valley every location is a named node. */
function payrollCity(state: GameState, at: string): string | null {
  return worldOf(state).kind === 'graph' ? at : townAt(state, at)?.id ?? null;
}

function payMonth(state: GameState) {
  // Recurring building charges are based on operating sites, not projects finishing this month.
  const maintenance = Object.values(state.towns).filter((t) => t.owner === 'player')
    .map((t) => ({ city: t.id, amount: cityMaintenance(state, t.id),
      actionId: `maintenance:${state.turn}:${t.id}`, counterparty: 'City facilities' }));
  const phase = advanceCities(state);
  for (const t of Object.values(state.towns)) {
    if (t.owner === 'player') t.pop = Math.max(0,
      t.pop + townGrowth(t) - (phase.shortagePenalties[t.id] ?? 0));
  }
  // Heroes mend a quarter of their wounds and recover all their mana each month.
  for (const t of state.armies.flatMap((a) => a.troops)) {
    if (!isHero(t.type)) continue;
    const max = heroMaxHp(t.type, t.xp);
    t.men = Math.min(max, t.men + Math.ceil(max / 4));
    t.mana = heroMaxMana(t.type, t.xp);
  }
  // Post real tax receipts by town, and wage payments by army location.
  const taxes = Object.values(state.towns).filter((t) => t.owner === 'player')
    .map((t) => ({ city: t.id, amount: townIncome(t), actionId: `tax:${state.turn}:${t.id}`, counterparty: nodeName(state, t.id) }));
  const payroll = state.armies.filter((a) => a.owner === 'player')
    .map((a) => ({ city: payrollCity(state, a.at), amount: a.troops.reduce((sum, t) => sum + troopUpkeep(t, UNIT_TYPES[t.type].upkeep), 0),
      actionId: `wages:${state.turn}:${a.id}`, counterparty: 'Army payroll' }));
  const ledger = settleTreasury(state, taxes, payroll, maintenance);
  for (const completed of phase.completed) log(state, `Construction completed at ${completed}.`);
  for (const completed of finishRefits(state)) log(state, `Refit finished: ${completed}.`);
  for (const shortage of phase.shortages) {
    if (state.towns[shortage.city].owner === 'player') log(state, `${nodeName(state, shortage.city)} lacks ${shortage.missing} food units this month.`);
  }
  if (ledger.unpaidUpkeep > 0) {
    // Heroes stay loyal; hired soldiers walk.
    const soldiers = (a: Army) => a.troops.filter((t) => !isHero(t.type));
    const armies = state.armies.filter((a) => a.owner === 'player' && soldiers(a).length);
    const biggest = armies.sort((a, c) => soldiers(c).length - soldiers(a).length)[0];
    if (biggest) {
      const gone = soldiers(biggest).at(-1)!;
      biggest.troops = biggest.troops.filter((t) => t !== gone);
      if (!biggest.troops.length) removeArmy(state, biggest);
      deed(state, 'realm', `The treasury is empty. Unpaid ${UNIT_TYPES[gone.type].name} desert at ${nodeName(state, biggest.at)}.`, biggest.at);
    }
  }
}

export function endTurn(state: GameState) {
  if (state.battle || state.status !== 'playing') return;
  payMonth(state);
  state.turn++;
  for (const a of state.armies) for (const t of a.troops) t.mp = marchRate(state, t);
  newOffers(state);
  orcTurn(state);
  checkStatus(state);
}
