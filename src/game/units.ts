import { UNIT_TYPES } from './data';

/** Troop level from battles survived: 0–3, each adding 15% attack and some morale. */
export function level(xp: number): number {
  return Math.min(3, Math.floor(xp / 2));
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
  return t.hero ? t.attack * (1 + 0.1 * (heroLevel(xp) - 1)) : t.attack * (1 + 0.15 * level(xp));
}
