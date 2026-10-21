import { ITEMS } from '../content/items';
import { UNIT_TYPES } from './data';
import type { HeroKit } from './types';

/** Troop level 1–10. Existing XP preserves the old damage curve: level 4 equals old tier 3. */
export function level(xp: number): number {
  return 1 + Math.min(9, Math.floor(xp / 2));
}

export function isHero(type: string): boolean {
  return !!UNIT_TYPES[type].hero;
}

/** Hero level: 1–10. */
export function heroLevel(xp: number): number {
  return 1 + Math.min(9, Math.floor(xp / 3));
}

export function heroMaxHp(type: string, xp: number): number {
  return UNIT_TYPES[type].men + 4 * (heroLevel(xp) - 1);
}

export function heroMaxMana(type: string, xp: number): number {
  const base = UNIT_TYPES[type].hero?.mana ?? 0;
  return base ? base + 2 * (heroLevel(xp) - 1) : 0;
}

/** Attack value after experience. */
export function attackFor(type: string, xp: number): number {
  const t = UNIT_TYPES[type];
  return t.hero ? t.attack * (1 + 0.1 * (heroLevel(xp) - 1)) : t.attack * (1 + 0.15 * (level(xp) - 1));
}

/** What a hero's equipment adds: attack and defense in battle, leadership for the whole army's morale. */
export function kitBonus(kit: HeroKit | undefined): { attack: number; defense: number; leadership: number } {
  const total = { attack: 0, defense: 0, leadership: 0 };
  for (const id of Object.values(kit ?? {})) {
    const equip = id ? ITEMS[id]?.equip : undefined;
    total.attack += equip?.attack ?? 0;
    total.defense += equip?.defense ?? 0;
    total.leadership += equip?.leadership ?? 0;
  }
  return total;
}
