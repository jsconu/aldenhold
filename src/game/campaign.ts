import { orcTurn } from './ai';
import { autoResolve, createBattle, isAI, runAI } from './battle';
import {
  CAPITAL, HERO_NAMES, HIREABLE_HEROES, LAIR, MAP_EDGES, MAP_NODES, START_ARMIES, START_OFFER, START_TOWNS, STARTING_GOLD, UNIT_TYPES,
} from './data';
import { random } from './rng';
import type { Army, Battle, FactionId, GameState, HeroOffer, Town, Troop } from './types';
import { heroLevel, heroMaxHp, heroMaxMana, isHero } from './units';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_TAX = 50;
const MIN_POP_AFTER_RECRUIT = 500;
const OFFER_CHANCE = 0.3;
const MAX_OFFERS = 2;
const OFFER_MONTHS = 3;

export function newGame(seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const state: GameState = {
    version: 2,
    turn: 1,
    gold: STARTING_GOLD,
    nextId: 1,
    seed,
    nodes: MAP_NODES.map((n) => ({ ...n })),
    edges: MAP_EDGES.map(([a, b]) => [a, b] as [string, string]),
    towns: {},
    armies: [],
    battle: null,
    pending: [],
    offers: [{ ...START_OFFER }],
    log: [],
    status: 'playing',
  };
  for (const t of START_TOWNS) state.towns[t.id] = { ...t };
  for (const a of START_ARMIES) {
    state.armies.push({ id: state.nextId++, owner: a.owner, at: a.at, from: null, troops: a.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) });
  }
  log(state, 'Your father is dead and Aldenhold is yours. Orcs raid the valley from Gharzak Hold. Bring the free towns under your banner and break the Hold.');
  return state;
}

export function makeTroop(state: GameState, type: string, name?: string): Troop {
  const t: Troop = { id: state.nextId++, type, men: UNIT_TYPES[type].men, xp: 0, moved: false };
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

/** Hire a hero who has offered their service. Returns an error message, or null. */
export function hireHero(state: GameState, offer: HeroOffer): string | null {
  const town = state.towns[offer.town];
  const type = UNIT_TYPES[offer.type];
  if (state.battle || state.status !== 'playing') return 'Not now.';
  if (!state.offers.includes(offer) || town?.owner !== 'player') return 'That offer is gone.';
  if (state.gold < type.cost) return `You need ${type.cost} gold.`;
  state.gold -= type.cost;
  state.offers = state.offers.filter((o) => o !== offer);
  const troop = makeTroop(state, offer.type, offer.name);
  troop.moved = true;
  const army = armyAt(state, offer.town, 'player');
  if (army) army.troops.push(troop);
  else state.armies.push({ id: state.nextId++, owner: 'player', at: offer.town, from: null, troops: [troop] });
  log(state, `${offer.name} the ${type.name.toLowerCase()} joins you in ${nodeName(state, offer.town)}.`);
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

export function log(state: GameState, line: string) {
  state.log.unshift(`${dateLabel(state.turn)}: ${line}`);
  state.log.length = Math.min(state.log.length, 60);
}

export function dateLabel(turn: number): string {
  return `${MONTHS[(turn - 1) % 12]}, year ${Math.floor((turn - 1) / 12) + 1}`;
}

export function nodeName(state: GameState, id: string): string {
  return state.nodes.find((n) => n.id === id)?.name ?? id;
}

export function neighborsOf(state: GameState, id: string): string[] {
  return state.edges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
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
    .reduce((sum, t) => sum + UNIT_TYPES[t.type].upkeep, 0);
}

export function canRecruitAt(town: Town, typeId: string): boolean {
  const r = UNIT_TYPES[typeId].recruit;
  return town.owner === 'player' && (r === 'any' ? town.kind !== 'lair' : r === 'capital' && town.kind === 'capital');
}

/** Returns an error message, or null on success. */
export function recruit(state: GameState, townId: string, typeId: string): string | null {
  const town = state.towns[townId];
  const type = UNIT_TYPES[typeId];
  if (state.battle || state.status !== 'playing') return 'Not now.';
  if (!town || !type || !canRecruitAt(town, typeId)) return `You can't raise ${type?.name ?? 'that'} here.`;
  if (state.gold < type.cost) return `You need ${type.cost} gold.`;
  if (town.pop - type.men < MIN_POP_AFTER_RECRUIT) return `${nodeName(state, townId)} has no more men to spare.`;
  state.gold -= type.cost;
  town.pop -= type.men;
  const troop = makeTroop(state, typeId);
  troop.moved = true;
  const army = armyAt(state, townId, 'player');
  if (army) army.troops.push(troop);
  else state.armies.push({ id: state.nextId++, owner: 'player', at: townId, from: null, troops: [troop] });
  log(state, `${type.name} raised in ${nodeName(state, townId)}.`);
  return null;
}

export function setTax(state: GameState, townId: string, tax: number) {
  const town = state.towns[townId];
  if (town?.owner === 'player') town.tax = Math.max(0, Math.min(MAX_TAX, Math.round(tax)));
}

/** March the chosen troops from one node to an adjacent one. Returns an error message, or null. */
export function moveTroops(state: GameState, from: string, troopIds: number[], to: string): string | null {
  if (state.battle || state.status !== 'playing') return 'Not now.';
  const src = armyAt(state, from, 'player');
  if (!src) return 'You have no troops there.';
  if (!neighborsOf(state, from).includes(to)) return 'That place is not next to this one.';
  const moving = src.troops.filter((t) => troopIds.includes(t.id) && !t.moved);
  if (!moving.length) return 'None of the chosen troops can march this month.';
  src.troops = src.troops.filter((t) => !moving.includes(t));
  if (!src.troops.length) removeArmy(state, src);
  for (const t of moving) t.moved = true;
  const army: Army = { id: state.nextId++, owner: 'player', at: from, from: null, troops: moving };
  state.armies.push(army);
  enterNode(state, army, to);
  return null;
}

/** Move an army (already in state.armies) into a node: fight whoever holds it, or settle there. */
export function enterNode(state: GameState, army: Army, to: string) {
  army.from = army.at;
  army.at = to;
  const enemy = state.armies.find((a) => a !== army && a.at === to && a.owner !== army.owner);
  if (enemy) startBattle(state, army.id, enemy.id);
  else settle(state, army);
}

function settle(state: GameState, army: Army) {
  const friend = state.armies.find((a) => a !== army && a.at === army.at && a.owner === army.owner);
  if (friend) {
    friend.troops.push(...army.troops);
    removeArmy(state, army);
    army = friend;
  }
  army.from = null;
  const town = state.towns[army.at];
  if (town && town.owner !== army.owner) captureTown(state, town, army.owner);
}

function captureTown(state: GameState, town: Town, owner: FactionId) {
  const name = nodeName(state, town.id);
  town.owner = owner;
  town.pop = Math.floor(town.pop * 0.9);
  if (owner === 'player') {
    town.tax = 15;
    log(state, town.kind === 'lair' ? `${name} has fallen to your army!` : `${name} now flies your banner.`);
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
  const town = state.towns[attacker.at];
  const seed = Math.floor(random(state) * 2 ** 31);
  const b = createBattle(attacker.at, attacker, defender, !!town && town.owner === defender.owner, seed);
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
  const attacker = findArmy(state, b.attackerId);
  const defender = findArmy(state, b.defenderId);
  for (const army of [attacker, defender]) {
    if (!army) continue;
    for (const t of army.troops) {
      const u = b.units.find((x) => x.troopId === t.id);
      if (!u) continue;
      t.men = u.men;
      if (t.men <= 0) {
        if (t.name) log(state, `${t.name} died at ${nodeName(state, b.at)}.`);
        continue;
      }
      if (isHero(t.type)) {
        const before = heroLevel(t.xp);
        t.mana = u.mana;
        t.xp += 1 + Math.floor(u.deeds / 2);
        if (heroLevel(t.xp) > before && army.owner === 'player') log(state, `${t.name} reaches level ${heroLevel(t.xp)}.`);
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
    log(state, winner === 'player' ? `Victory at ${place}.` : `Defeat at ${place}.`);
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
  const safe = (node: string) =>
    !state.armies.some((a) => a.at === node && a.owner !== army.owner) && (!state.towns[node] || state.towns[node].owner === army.owner);
  const ownTown = (node: string) => Number(state.towns[node]?.owner === army.owner);
  const options = army.from ? [army.from] : neighborsOf(state, army.at).sort((x, y) => ownTown(y) - ownTown(x));
  const back = options.find(safe);
  if (back) {
    army.at = back;
    settle(state, army);
    return;
  }
  removeArmy(state, army);
  const lord = army.troops.find((t) => t.type === 'lord');
  if (lord && state.towns[CAPITAL].owner === 'player' && safe(CAPITAL)) {
    lord.moved = true;
    const escaped: Army = { id: state.nextId++, owner: 'player', at: CAPITAL, from: null, troops: [lord] };
    state.armies.push(escaped);
    settle(state, escaped);
    log(state, `Cut off, the army scatters. ${lord.name} escapes to ${nodeName(state, CAPITAL)}.`);
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

function checkStatus(state: GameState) {
  if (state.status !== 'playing') return;
  if (state.towns[LAIR].owner === 'player') {
    state.status = 'won';
    log(state, 'Gharzak Hold is broken. The valley is yours.');
  } else if (state.towns[CAPITAL].owner !== 'player') {
    state.status = 'lost';
    log(state, 'Aldenhold has fallen. Your house is ended.');
  } else if (!lordOf(state)) {
    state.status = 'lost';
    log(state, 'Your lord is dead. With no heir, your house is ended.');
  }
}

function payMonth(state: GameState) {
  for (const t of Object.values(state.towns)) {
    if (t.owner === 'player') t.pop = Math.max(0, t.pop + townGrowth(t));
  }
  // Heroes mend a quarter of their wounds and recover all their mana each month.
  for (const t of state.armies.flatMap((a) => a.troops)) {
    if (!isHero(t.type)) continue;
    const max = heroMaxHp(t.type, t.xp);
    t.men = Math.min(max, t.men + Math.ceil(max / 4));
    t.mana = heroMaxMana(t.type, t.xp);
  }
  const income = monthlyIncome(state);
  const upkeep = monthlyUpkeep(state);
  state.gold += income - upkeep;
  if (state.gold < 0) {
    state.gold = 0;
    // Heroes stay loyal; hired soldiers walk.
    const soldiers = (a: Army) => a.troops.filter((t) => !isHero(t.type));
    const armies = state.armies.filter((a) => a.owner === 'player' && soldiers(a).length);
    const biggest = armies.sort((a, c) => soldiers(c).length - soldiers(a).length)[0];
    if (biggest) {
      const gone = soldiers(biggest).at(-1)!;
      biggest.troops = biggest.troops.filter((t) => t !== gone);
      if (!biggest.troops.length) removeArmy(state, biggest);
      log(state, `The treasury is empty. Unpaid ${UNIT_TYPES[gone.type].name} desert at ${nodeName(state, biggest.at)}.`);
    }
  }
}

export function endTurn(state: GameState) {
  if (state.battle || state.status !== 'playing') return;
  payMonth(state);
  state.turn++;
  for (const a of state.armies) for (const t of a.troops) t.moved = false;
  newOffers(state);
  orcTurn(state);
  checkStatus(state);
}
