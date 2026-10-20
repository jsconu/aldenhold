import type { Spell, SpellId, Terrain, TerrainType, UnitType } from '../game/types';

/** Rules content shared by every campaign: unit types, battlefield terrain, spells and the hero roster. */

export const UNIT_TYPES: Record<string, UnitType> = {
  militia: { id: 'militia', name: 'Militia', short: 'MIL', attack: 2, defense: 2, move: 3, range: 1, men: 20, cost: 60, upkeep: 4, recruit: 'any' },
  spearmen: { id: 'spearmen', name: 'Spearmen', short: 'SPR', attack: 3, defense: 4, move: 3, range: 1, men: 20, cost: 120, upkeep: 8, recruit: 'any' },
  archers: { id: 'archers', name: 'Archers', short: 'ARC', attack: 2, defense: 2, move: 3, range: 4, men: 15, cost: 110, upkeep: 7, recruit: 'any' },
  knights: { id: 'knights', name: 'Knights', short: 'KNT', attack: 5, defense: 4, move: 6, range: 1, men: 10, cost: 220, upkeep: 15, recruit: 'capital' },
  warband: { id: 'warband', name: 'Orc Warband', short: 'ORC', attack: 3, defense: 2, move: 3, range: 1, men: 20, cost: 0, upkeep: 0, recruit: null },
  orcArchers: { id: 'orcArchers', name: 'Orc Archers', short: 'OAR', attack: 2, defense: 1, move: 3, range: 3, men: 15, cost: 0, upkeep: 0, recruit: null },
  troll: { id: 'troll', name: 'Troll', short: 'TRL', attack: 9, defense: 5, move: 3, range: 1, men: 6, cost: 0, upkeep: 0, recruit: null },

  // Heroes: `men` is base hit points, `cost` the hiring fee.
  lord: { id: 'lord', name: 'Lord', short: 'LRD', attack: 4, defense: 5, move: 4, range: 1, men: 30, cost: 0, upkeep: 0, recruit: null,
    hero: { leadership: 15, power: 12, mana: 0, spells: [] } },
  champion: { id: 'champion', name: 'Champion', short: 'CHM', attack: 5, defense: 5, move: 4, range: 1, men: 26, cost: 250, upkeep: 20, recruit: null,
    hero: { leadership: 10, power: 12, mana: 0, spells: [] } },
  priest: { id: 'priest', name: 'Priest', short: 'PRI', attack: 2, defense: 3, move: 3, range: 1, men: 18, cost: 300, upkeep: 20, recruit: null,
    hero: { leadership: 5, power: 8, mana: 12, spells: ['heal', 'rally'] } },
  mage: { id: 'mage', name: 'Mage', short: 'MAG', attack: 1, defense: 2, move: 3, range: 1, men: 14, cost: 350, upkeep: 25, recruit: null,
    hero: { leadership: 0, power: 6, mana: 12, spells: ['fireball', 'terror'] } },
  warchief: { id: 'warchief', name: 'Orc Warchief', short: 'WAR', attack: 5, defense: 4, move: 3, range: 1, men: 26, cost: 0, upkeep: 0, recruit: null,
    hero: { leadership: 10, power: 12, mana: 0, spells: [] } },
  shaman: { id: 'shaman', name: 'Orc Shaman', short: 'SHA', attack: 1, defense: 2, move: 3, range: 1, men: 14, cost: 0, upkeep: 0, recruit: null,
    hero: { leadership: 0, power: 6, mana: 12, spells: ['fireball'] } },
};

const T = (t: Partial<TerrainType> & Pick<TerrainType, 'id' | 'name' | 'move' | 'text'>): TerrainType =>
  ({ defense: 0, rangeBonus: 0, heal: 0, moveLoss: 0, moraleDrain: 0, ...t });

/** Battlefield terrain. Tune effects here; the battle rules and the field legend both read from this table. */
export const TERRAIN: Record<Terrain, TerrainType> = {
  plain: T({ id: 'plain', name: 'Open ground', move: 1, text: 'No effect.' }),
  forest: T({ id: 'forest', name: 'Forest', move: 2, defense: 1, text: 'Costs 2 to enter. +1 defense.' }),
  hill: T({ id: 'hill', name: 'Hill', move: 2, defense: 1, rangeBonus: 1, text: 'Costs 2 to enter. +1 defense. Missile troops here shoot 1 hex farther.' }),
  stream: T({ id: 'stream', name: 'Stream', move: 2, defense: -1, text: 'Costs 2 to ford. Troops in the water fight at −1 defense.' }),
  marsh: T({ id: 'marsh', name: 'Marsh', move: 3, defense: -1, moraleDrain: 5, text: 'Costs 3 to enter. −1 defense, and troops lose 5 morale each turn they start here.' }),
  thorns: T({ id: 'thorns', name: 'Thorns', move: 2, defense: 1, moveLoss: 2, text: 'Costs 2 to enter. +1 defense, but pushing in costs 2 men (or 2 HP).' }),
  ruins: T({ id: 'ruins', name: 'Ruins', move: 2, defense: 2, text: 'Costs 2 to enter. +2 defense behind old walls.' }),
  rocks: T({ id: 'rocks', name: 'Rocks', move: Infinity, text: 'Impassable.' }),
  spring: T({ id: 'spring', name: 'Holy spring', move: 1, heal: 3, text: 'A troop that starts its turn here gets back 3 men lost this battle (heroes 3 HP) and steadies.' }),
};

export const SPELLS: Record<SpellId, Spell> = {
  fireball: { id: 'fireball', name: 'Fireball', cost: 4, range: 5, target: 'enemy', text: 'Burns an enemy troop and shakes its nerve.' },
  terror: { id: 'terror', name: 'Terror', cost: 3, range: 5, target: 'enemy', text: 'Fills an enemy troop with dread; it may break and run.' },
  heal: { id: 'heal', name: 'Heal', cost: 3, range: 3, target: 'friend', text: 'Brings wounded men back into the line, or mends a hero.' },
  rally: { id: 'rally', name: 'Rally', cost: 2, range: 4, target: 'friend', text: 'Steadies a troop. Brings running troops back to the fight.' },
};

/** Heroes for hire. The lord is the player's own and never offered. */
export const HIREABLE_HEROES = ['champion', 'priest', 'mage'];
export const HERO_NAMES: Record<string, string[]> = {
  champion: ['Brannoc', 'Edith of Wray', 'Tamsin Hale', 'Corin Ashby'],
  priest: ['Brother Osric', 'Mother Elswyth', 'Father Anselm', 'Sister Maud'],
  mage: ['Ysolde', 'Master Pell', 'Varro the Grey', 'Hesketh'],
};
