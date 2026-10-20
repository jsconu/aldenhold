import { BUILDINGS } from './cities';
import { townLocation } from './world';
import { recordPurchase } from './economy';
import { level, isHero } from './units';
import type { EquipmentId, EquipmentSlot, GameState, GoodId, GoodsStock, Loadout, Troop } from './types';

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  slot: EquipmentSlot;
  level: number;
  attackFactor: number;
  defenseBonus: number;
  rangeBonus: number;
  upkeep: number;
  goldPerMan: number;
  goodsPerFormation: (men: number) => Partial<GoodsStock>;
  requiresForge: boolean;
}

export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  'short-bow': { id: 'short-bow', name: 'Short Bow', slot: 'bow', level: 1,
    attackFactor: 1, defenseBonus: 0, rangeBonus: 0, upkeep: 0, goldPerMan: 0,
    goodsPerFormation: () => ({}), requiresForge: false },
  'long-bow': { id: 'long-bow', name: 'Long Bow', slot: 'bow', level: 3,
    attackFactor: 1.2, defenseBonus: 0, rangeBonus: 1, upkeep: 2, goldPerMan: 4,
    goodsPerFormation: (men) => ({ timber: Math.ceil(men / 10) }), requiresForge: false },
  'compound-bow': { id: 'compound-bow', name: 'Compound Bow', slot: 'bow', level: 5,
    attackFactor: 1.5, defenseBonus: 0, rangeBonus: 2, upkeep: 6, goldPerMan: 11,
    goodsPerFormation: (men) => ({ timber: Math.ceil(men / 8), tools: Math.ceil(men / 4) }), requiresForge: true },
  leather: { id: 'leather', name: 'Leather Armor', slot: 'armor', level: 1,
    attackFactor: 1, defenseBonus: 0, rangeBonus: 0, upkeep: 0, goldPerMan: 0,
    goodsPerFormation: () => ({}), requiresForge: false },
  chain: { id: 'chain', name: 'Chain Armor', slot: 'armor', level: 2,
    attackFactor: 1, defenseBonus: 1, rangeBonus: 0, upkeep: 3, goldPerMan: 6,
    goodsPerFormation: (men) => ({ tools: Math.ceil(men / 6) }), requiresForge: true },
  plate: { id: 'plate', name: 'Plate Armor', slot: 'armor', level: 3,
    attackFactor: 1, defenseBonus: 3, rangeBonus: 0, upkeep: 8, goldPerMan: 14,
    goodsPerFormation: (men) => ({ tools: Math.ceil(men / 3), ore: Math.ceil(men / 4) }), requiresForge: true },
};

export function basicLoadout(type: string): Loadout {
  return { bow: type === 'archers' || type === 'orcArchers' ? 'short-bow' : null, armor: 'leather' };
}

export function equipmentFor(gear: Loadout, slot: EquipmentSlot): EquipmentDefinition | null {
  return gear[slot] ? EQUIPMENT[gear[slot]!] : null;
}

export function equipmentUpkeep(troop: Troop): number {
  return (equipmentFor(troop.gear, 'bow')?.upkeep ?? 0) +
    (equipmentFor(troop.gear, 'armor')?.upkeep ?? 0);
}

export function troopUpkeep(t: Troop, base: number): number {
  return base + equipmentUpkeep(t);
}

export function equipmentQuoteGold(item: EquipmentId, men: number): number {
  return EQUIPMENT[item].goldPerMan * men;
}

const ranks: Record<EquipmentSlot, EquipmentId[]> = {
  bow: ['short-bow', 'long-bow', 'compound-bow'],
  armor: ['leather', 'chain', 'plate'],
};

export function refitQuote(state: GameState, townId: string, troopId: number, itemId: EquipmentId) {
  const item = EQUIPMENT[itemId];
  const town = state.towns[townId];
  const city = state.cityEconomies[townId];
  const army = state.armies.find((a) => a.owner === 'player' && a.at === townLocation(state, townId) &&
    a.troops.some((t) => t.id === troopId));
  const troop = army?.troops.find((t) => t.id === troopId);
  const men = troop?.men ?? 0;
  const gold = item ? equipmentQuoteGold(itemId, men) : 0;
  const materials = item ? item.goodsPerFormation(men) : {};
  let reason: string | null = null;
  if (!item || !troop) reason = 'Unknown refit or formation.';
  else if (state.battle || state.status !== 'playing') reason = 'Finish the current battle before refitting.';
  else if (town?.owner !== 'player' || town.kind === 'lair' || !city) reason = 'Refits require an owned town.';
  else if (isHero(troop.type)) reason = 'Hero equipment needs a separate system.';
  else if (item.slot === 'bow' && troop.type !== 'archers') reason = 'Only archer formations can use bows.';
  else if (item.slot === 'armor' && troop.type === 'archers' && itemId === 'plate') reason = 'Archers cannot wear plate.';
  else if (troop.refit) reason = 'This formation is already refitting.';
  else if (troop.mp <= 0) reason = 'This formation has already acted this month.';
  else if (level(troop.xp) < item.level) reason = `Requires level ${item.level}.`;
  else if (ranks[item.slot].indexOf(itemId) <= ranks[item.slot].indexOf(troop.gear[item.slot]!)) reason = 'Already equipped or an inferior tier.';
  else if (item.requiresForge && city.buildings.forge < 1) reason = `Requires a ${BUILDINGS.forge.name} in this town.`;
  else if (state.gold < gold) reason = `Requires ${gold} gold.`;
  else if (Object.entries(materials).some(([good, cost]) => city.goods[good as GoodId] < cost)) reason = 'Not enough town materials.';
  return { item, troop, gold, materials, reason };
}

/** Charge the quoted living formation size once; cannot refit/march again before month-end. */
export function beginRefit(state: GameState, townId: string, troopId: number, item: EquipmentId): string | null {
  if (!Object.hasOwn(EQUIPMENT, item)) return 'Unknown equipment.';
  const quote = refitQuote(state, townId, troopId, item);
  if (quote.reason || !quote.troop) return quote.reason ?? 'Formation is missing.';
  const city = state.cityEconomies[townId];
  state.gold -= quote.gold;
  for (const [good, count] of Object.entries(quote.materials))
    city.goods[good as GoodId] -= count;
  const troop = quote.troop;
  troop.refit = { item, startedTurn: state.turn, orderedMen: troop.men,
    paidGold: quote.gold, paidGoods: quote.materials };
  troop.mp = 0;
  recordPurchase(state, townId, 'refit', quote.gold, `refit:${troop.id}:${state.turn}`, EQUIPMENT[item].name);
  return null;
}

/** Called after monthly economic settlement. A refit pending during combat continues to use old gear. */
export function finishRefits(state: GameState): string[] {
  const completed: string[] = [];
  for (const army of state.armies) {
    for (const troop of army.troops) {
      const pending = troop.refit;
      if (!pending || pending.startedTurn > state.turn) continue;
      const piece = EQUIPMENT[pending.item];
      troop.gear[piece.slot] = pending.item as never;
      troop.refit = null;
      if (army.owner === 'player') completed.push(`${piece.name} fitted to ${troop.type} at ${army.at}`);
    }
  }
  return completed;
}
