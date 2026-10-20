import { orcTurn } from './ai';
import { autoResolve, createBattle, isAI, runAI } from './battle';
import { getCampaign } from '../content';
import { hasPassage } from './diplomacy';
import { newTreasury, recordPurchase, settleTreasury } from './economy';
import { newQuestState, onTownOwnershipChange } from './quests';
import { advanceCities, cityMaintenance, startingCities } from './cities';
import { HERO_NAMES, HIREABLE_HEROES, UNIT_TYPES } from './data';
import { random } from './rng';
import type { Army, Battle, CampaignDefinition, CampaignId, DeedKind, FactionId, GameState, HeroOffer, Town, Troop } from './types';
import { heroLevel, heroMaxHp, heroMaxMana, isHero } from './units';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_TAX = 50;
const MIN_POP_AFTER_RECRUIT = 500;
const OFFER_CHANCE = 0.3;
const MAX_OFFERS = 2;
const OFFER_MONTHS = 3;

export function newGame(seed = Math.floor(Math.random() * 2 ** 31), campaignId: CampaignId = 'valley-quickplay'): GameState {
  const def = getCampaign(campaignId);
  const state: GameState = {
    version: 7,
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
    state.armies.push({ id: state.nextId++, owner: a.owner, at: a.at, from: null, troops: a.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) });
  }
  deed(state, 'story', def.intro, def.capital);
  return state;
}

/** The static definition of the campaign this game is playing. */
export function campaignOf(state: GameState): CampaignDefinition {
  return getCampaign(state.campaignId);
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
  recordPurchase(state, offer.town, 'hero-hire', type.cost, `hire:${troop.id}`, offer.name);
  troop.moved = true;
  const army = armyAt(state, offer.town, 'player');
  if (army) army.troops.push(troop);
  else state.armies.push({ id: state.nextId++, owner: 'player', at: offer.town, from: null, troops: [troop] });
  deed(state, 'hero', `${offer.name} the ${type.name.toLowerCase()} joins you in ${nodeName(state, offer.town)}.`, offer.town);
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
  recordPurchase(state, townId, 'recruitment', type.cost, `recruit:${troop.id}`, type.name);
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
  const enemy = state.armies.find((a) => a !== army && a.at === to && a.owner !== army.owner && !(a.owner === 'neutral' && hasPassage(state, army.owner, to)));
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
    deed(state, 'capture', town.kind === 'lair' ? `${name} has fallen to your army!` : `${name} now flies your banner.`, town.id);
  } else if (was === 'player') {
    deed(state, 'loss', `${owner === 'orcs' ? 'Orcs have' : 'The enemy has'} taken ${name} from you.`, town.id);
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
  const capital = campaignOf(state).capital;
  const where = army.at;
  if (lord && state.towns[capital].owner === 'player' && safe(capital)) {
    lord.moved = true;
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
    'lair-captured': `${nodeName(state, lair)} is broken. The valley is yours.`,
  }[reason], reason === 'lair-captured' ? lair : reason === 'capital-lost' ? capital : null);
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
    .map((a) => ({ city: a.at, amount: a.troops.reduce((sum, t) => sum + UNIT_TYPES[t.type].upkeep, 0),
      actionId: `wages:${state.turn}:${a.id}`, counterparty: 'Army payroll' }));
  const ledger = settleTreasury(state, taxes, payroll, maintenance);
  for (const completed of phase.completed) log(state, `Construction completed at ${completed}.`);
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
  for (const a of state.armies) for (const t of a.troops) t.moved = false;
  newOffers(state);
  orcTurn(state);
  checkStatus(state);
}
