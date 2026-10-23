import { BUILDING_IDS } from './cities';
import type { GameState, Town, Troop } from './types';
import { isHero } from './units';

export const RESIDENTS_PER_SUPPORT = 20;
export const SUPPORT_PER_IMPROVEMENT = 10;

/** HP represents wounds, not extra people: every living leader counts once. */
export function personnel(troop: Pick<Troop, 'type' | 'men'>): number {
  return troop.men <= 0 ? 0 : isHero(troop.type) ? 1 : troop.men;
}

export function cityArmySupport(state: GameState, town: Town, population = town.pop): number {
  if (town.owner !== 'player' || town.kind === 'lair') return 0;
  const improvements = state.cityEconomies[town.id]?.buildings;
  const levels = improvements ? BUILDING_IDS.reduce((n, kind) => n + improvements[kind], 0) : 0;
  return Math.floor(Math.max(0, population) / RESIDENTS_PER_SUPPORT) + levels * SUPPORT_PER_IMPROVEMENT;
}

export function armySupport(state: GameState) {
  const used = state.armies.filter(a => a.owner === 'player').reduce((sum, a) =>
    sum + a.troops.reduce((n, t) => n + personnel(t), 0), 0);
  const capacity = Object.values(state.towns).reduce((n, town) => n + cityArmySupport(state, town), 0);
  return { used, capacity, remaining: capacity - used };
}

/** Check the population AFTER recruitment too, so recruits cannot spend their own former civilian support. */
export function armySupportReason(state: GameState, added: number, townId?: string): string | null {
  const current = armySupport(state);
  const town = townId ? state.towns[townId] : undefined;
  const capacity = current.capacity - (town ? cityArmySupport(state, town) - cityArmySupport(state, town, town.pop - added) : 0);
  return current.used + added > capacity
    ? `Army support is insufficient: ${current.used + added} people would exceed ${capacity} places. Grow your cities or complete improvements (+${SUPPORT_PER_IMPROVEMENT} places per level).`
    : null;
}
