import type {
  BuildingId, BuildingLevels, CityEconomy, CityProduction, GameState, GoodId, GoodsStock, Town,
} from './types';
import { recordPurchase } from './economy';
import { deed, nodeName } from './campaign';
import { townLocation } from './world';

/** One cargo unit is an abstract monthly shipment, never a gold coin. */
export const GOODS: readonly GoodId[] = ['food', 'timber', 'ore', 'tools'];
export const BUILDING_IDS: readonly BuildingId[] = ['farm', 'lumber', 'mine', 'forge'];
export const MAX_DEVELOPMENT_SITES = 3;
export const MAX_BUILDING_LEVEL = 2;
/** Set by the Woodland Accord (Q04): lumber camps may not be upgraded past this level anywhere in the realm. */
export const LOGGING_CAP_FLAG = 'logging-cap';
export const LOGGING_CAP_LEVEL = 1;
/** Q02 One Eye at the Quarry: clearing the quarry lifts your ore mines' output; diverting the workers cuts it. */
export const QUARRY_CLEARED_FLAG = 'quarry-cleared';
export const QUARRY_DIVERTED_FLAG = 'quarry-diverted';

/** How the realm's standing decisions change a building's output in your towns. */
export function yieldFactor(state: GameState, townId: string, kind: BuildingId): number {
  if (kind !== 'mine' || state.towns[townId]?.owner !== 'player') return 1;
  if (state.flags.includes(QUARRY_CLEARED_FLAG)) return 1.25;
  if (state.flags.includes(QUARRY_DIVERTED_FLAG)) return 0.75;
  return 1;
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  gold: number;
  materials: Partial<GoodsStock>;
  output: GoodId;
  capacity: number;
  workers: number;
  upkeep: number;
  /** Sites with no local resource cannot construct that type. */
  resource: 'fertility' | 'forest' | 'ore' | null;
}

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  farm: { id: 'farm', name: 'Farms', gold: 90, materials: { timber: 4 }, output: 'food', capacity: 40, workers: 100, upkeep: 2, resource: 'fertility' },
  lumber: { id: 'lumber', name: 'Lumber Camp', gold: 115, materials: { timber: 3 }, output: 'timber', capacity: 12, workers: 130, upkeep: 4, resource: 'forest' },
  mine: { id: 'mine', name: 'Ore Mine', gold: 140, materials: { timber: 8 }, output: 'ore', capacity: 9, workers: 160, upkeep: 6, resource: 'ore' },
  forge: { id: 'forge', name: 'Tool Forge', gold: 180, materials: { timber: 8, ore: 3 }, output: 'tools', capacity: 6, workers: 140, upkeep: 8, resource: null },
};

/** Temporary quick-play endowments; later scenarios will carry authored region resources. */
const ENDOWMENTS: Record<string, { fertility: number; forest: number; ore: number }> = {
  aldenhold: { fertility: 1, forest: 0.9, ore: 0.7 },
  millbrook: { fertility: 1.3, forest: 0.7, ore: 0 },
  fenwick: { fertility: 0.9, forest: 1.1, ore: 0.9 },
  harrowgate: { fertility: 0.7, forest: 0.6, ore: 1.3 },
  duskwater: { fertility: 0.8, forest: 1.4, ore: 0.2 },
  oakcross: { fertility: 1.4, forest: 1.1, ore: 0.1 },
  bellwater: { fertility: 1.3, forest: 0.3, ore: 0 },
  thornwatch: { fertility: 0.6, forest: 1.7, ore: 0.6 },
  redford: { fertility: 0.7, forest: 0.5, ore: 1.5 },
  saltwick: { fertility: 1.1, forest: 0.5, ore: 0 },
  ironbridge: { fertility: 0.6, forest: 0.7, ore: 1.6 },
  // Western Realm towns that the quick-play valley doesn't have.
  greenveil: { fertility: 0.6, forest: 1.6, ore: 0.2 },
  westmere: { fertility: 1.2, forest: 0.5, ore: 0.6 },
  reedhaven: { fertility: 1, forest: 0.8, ore: 0 },
};
export function endowment(city: string) {
  return ENDOWMENTS[city] ?? { fertility: 0.8, forest: 0.5, ore: 0.5 };
}

export function emptyGoods(): GoodsStock {
  return { food: 0, timber: 0, ore: 0, tools: 0 };
}

export function emptyBuildings(): BuildingLevels {
  return { farm: 0, lumber: 0, mine: 0, forge: 0 };
}

/** Every non-lair town starts with food production; no retrospective building charges. */
export function initialCityEconomy(town: Town): CityEconomy {
  const buildings = emptyBuildings();
  if (town.kind !== 'lair') buildings.farm = 1;
  return {
    buildings,
    goods: { food: town.kind === 'lair' ? 0 : Math.ceil(town.pop / 100) * 2 + 30,
      timber: town.kind === 'lair' ? 0 : 12, ore: 0, tools: 0 },
    project: null,
    lastMonth: null,
  };
}

export function startingCities(towns: Record<string, Town>): Record<string, CityEconomy> {
  return Object.fromEntries(Object.values(towns).map((town) => [town.id, initialCityEconomy(town)]));
}

export function developmentSites(city: CityEconomy): number {
  return BUILDING_IDS.filter((id) => city.buildings[id] > 0).length;
}

/** Forecast quotes are pure, so disabled buttons explain the true future cost. */
export function constructionQuote(state: GameState, townId: string, kind: BuildingId) {
  const city = state.cityEconomies[townId];
  const town = state.towns[townId];
  const def = BUILDINGS[kind];
  const next = (city?.buildings[kind] ?? 0) + 1;
  const factor = next === 1 ? 1 : 1.7;
  const gold = Math.ceil(def.gold * factor);
  const materials = Object.fromEntries(Object.entries(def.materials)
    .map(([good, amount]) => [good, Math.ceil(amount * factor)])) as Partial<GoodsStock>;
  let reason: string | null = null;
  if (state.status !== 'playing' || state.battle) reason = 'Finish the battle before investing.';
  else if (!town || town.owner !== 'player' || town.kind === 'lair') reason = 'You can only develop towns you rule.';
  else if (!city) reason = 'City records are unavailable.';
  else if (city.project) reason = 'One construction project at a time.';
  else if (next > MAX_BUILDING_LEVEL) reason = 'Already at the maximum tier.';
  else if (next === 1 && developmentSites(city) >= MAX_DEVELOPMENT_SITES) reason = 'No development sites remain.';
  else if (def.resource !== null && endowment(townId)[def.resource] === 0) reason = 'This region lacks the required resources.';
  else if (kind === 'lumber' && next > LOGGING_CAP_LEVEL && state.flags.includes(LOGGING_CAP_FLAG)) {
    reason = 'You promised Greenveil that no lumber camp would grow past its first tier.';
  }
  else if (state.gold < gold) reason = 'Not enough gold.';
  else if (Object.entries(materials).some(([good, qty]) => city.goods[good as GoodId] < qty)) reason = 'Not enough local construction materials.';
  return { gold, materials, targetLevel: next, reason };
}

/** Redevelopment frees a whole industrial site; it never sells stock or refunds construction. */
export function dismantleQuote(state: GameState, townId: string, kind: BuildingId) {
  const city = state.cityEconomies[townId], town = state.towns[townId];
  let reason: string | null = null;
  if (!Object.hasOwn(BUILDINGS, kind)) reason = 'Unknown building.';
  else if (state.status !== 'playing' || state.battle) reason = 'Finish the battle before redeveloping.';
  else if (!town || town.owner !== 'player' || town.kind === 'lair' || !city) reason = 'You can only redevelop towns you rule.';
  else if (kind === 'farm') reason = 'Farms are protected from demolition.';
  else if (city.project) reason = 'Finish the current construction project first.';
  else if (!city.buildings[kind]) reason = 'There is no building to dismantle.';
  return {reason, levels: city?.buildings[kind] ?? 0};
}

export function dismantleCity(state: GameState, townId: string, kind: BuildingId): string | null {
  const quote = dismantleQuote(state, townId, kind);
  if (quote.reason) return quote.reason;
  state.cityEconomies[townId].buildings[kind] = 0;
  deed(state, 'realm', `${nodeName(state, townId)} dismantles its ${BUILDINGS[kind].name} (level ${quote.levels}), freeing a development site. Stored materials remain; construction costs are not refunded.`, townLocation(state, townId));
  return null;
}

/** Construction starts immediately, deducts gold/materials once, and finishes after this month's production. */
export function buildCity(state: GameState, townId: string, kind: BuildingId): string | null {
  if (!Object.hasOwn(BUILDINGS, kind)) return 'Unknown building.';
  const quote = constructionQuote(state, townId, kind);
  if (quote.reason) return quote.reason;
  const city = state.cityEconomies[townId];
  state.gold -= quote.gold;
  for (const [good, amount] of Object.entries(quote.materials)) city.goods[good as GoodId] -= amount;
  city.project = {
    kind, targetLevel: quote.targetLevel, startedTurn: state.turn, finishTurn: state.turn,
    paidGold: quote.gold, paidGoods: quote.materials,
  };
  recordPurchase(state, townId, 'construction', quote.gold,
    `build:${state.turn}:${townId}:${kind}:${quote.targetLevel}`, BUILDINGS[kind].name);
  return null;
}

/** New buildings have recurring costs; the free starting farm is grandfathered. */
export function cityMaintenance(state: GameState, townId: string): number {
  const city = state.cityEconomies[townId];
  if (!city || state.towns[townId]?.owner !== 'player') return 0;
  return BUILDING_IDS.reduce((sum, id) =>
    sum + Math.max(0, city.buildings[id] - (id === 'farm' ? 1 : 0)) * BUILDINGS[id].upkeep, 0);
}

export function totalCityMaintenance(state: GameState): number {
  return Object.keys(state.cityEconomies).reduce((sum, id) => sum + cityMaintenance(state, id), 0);
}

export interface CityPhaseResult {
  completed: string[];
  shortages: { city: string; missing: number }[];
  /** Monthly population adjustment; applies after ordinary growth. */
  shortagePenalties: Record<string, number>;
}

/**
 * Snapshot labor and raw goods before any city's production, then apply receipts and consumption.
 * The forge cannot consume ore or timber made in the current month. New projects go online
 * only after this phase. This is the first state-owned production slice, not private commerce.
 */
export function advanceCities(state: GameState): CityPhaseResult {
  const result: CityPhaseResult = { completed: [], shortages: [], shortagePenalties: {} };
  for (const town of Object.values(state.towns)) {
    if (town.kind === 'lair') continue;
    const city = state.cityEconomies[town.id];
    const stock = { ...city.goods };
    const produced = emptyGoods();
    const inputs = emptyGoods();
    const workforce = Math.floor(town.pop * 0.45);
    let workersLeft = workforce;
    let employed = 0;
    const deposits = endowment(town.id);

    for (const kind of BUILDING_IDS) {
      const level = city.buildings[kind];
      if (!level) continue;
      const def = BUILDINGS[kind];
      const needed = def.workers * level;
      const assigned = Math.min(workersLeft, needed);
      workersLeft -= assigned;
      employed += assigned;
      const staffing = needed ? assigned / needed : 0;
      const localYield = def.resource === null ? 1 : deposits[def.resource];
      const potential = Math.max(0, Math.floor(level * def.capacity * staffing * localYield * yieldFactor(state, town.id, kind)));
      if (kind === 'forge') {
        // Both material limits come from the beginning-of-month snapshot.
        const made = Math.min(potential, stock.ore, stock.timber);
        produced.tools += made;
        inputs.ore += made;
        inputs.timber += made;
      } else produced[def.output] += potential;
    }

    const consumption = Math.ceil(town.pop / 100);
    const foodAvailable = stock.food + produced.food;
    const consumedFood = Math.min(consumption, foodAvailable);
    const unmetFood = consumption - consumedFood;
    for (const id of GOODS) {
      const remaining = stock[id] + produced[id] - inputs[id] - (id === 'food' ? consumedFood : 0);
      city.goods[id] = Math.min(1000000, Math.max(0, remaining));
    }
    const month: CityProduction = {
      turn: state.turn, produced, inputs, consumedFood, unmetFood, workforce, employed,
    };
    city.lastMonth = month;
    if (unmetFood > 0) {
      result.shortages.push({ city: town.id, missing: unmetFood });
      // Shortages reduce growth but never kill a whole city in a single turn.
      result.shortagePenalties[town.id] = Math.min(Math.floor(town.pop * 0.01), unmetFood * 2);
    }
    if (city.project && city.project.finishTurn <= state.turn) {
      city.buildings[city.project.kind] = city.project.targetLevel;
      result.completed.push(`${town.id}:${BUILDINGS[city.project.kind].name} level ${city.project.targetLevel}`);
      city.project = null;
    }
  }
  return result;
}
