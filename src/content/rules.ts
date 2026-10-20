import type { Land, LandType, Terrain, TerrainType, UnitType } from '../game/types';

import { MAGE_SPELLS } from './spells';
export { SPELLS } from './spells';

/** Rules content shared by every campaign: unit types, battlefield terrain, spells and the hero roster. */

export const UNIT_TYPES: Record<string, UnitType> = {
  militia: { id: 'militia', name: 'Militia', short: 'MIL', attack: 2, defense: 2, move: 3, range: 1, men: 20, cost: 60, upkeep: 4, recruit: 'any', march: 12 },
  spearmen: { id: 'spearmen', name: 'Spearmen', short: 'SPR', attack: 3, defense: 4, move: 3, range: 1, men: 20, cost: 120, upkeep: 8, recruit: 'any', march: 12 },
  archers: { id: 'archers', name: 'Archers', short: 'ARC', attack: 2, defense: 2, move: 3, range: 4, men: 15, cost: 110, upkeep: 7, recruit: 'any', march: 12 },
  knights: { id: 'knights', name: 'Knights', short: 'KNT', attack: 5, defense: 4, move: 6, range: 1, men: 10, cost: 220, upkeep: 15, recruit: 'capital', march: 18 },
  warband: { id: 'warband', name: 'Orc Warband', short: 'ORC', attack: 3, defense: 2, move: 3, range: 1, men: 20, cost: 0, upkeep: 0, recruit: null, march: 12 },
  orcArchers: { id: 'orcArchers', name: 'Orc Archers', short: 'OAR', attack: 2, defense: 1, move: 3, range: 3, men: 15, cost: 0, upkeep: 0, recruit: null, march: 12 },
  troll: { resistances: { cold: 25 }, id: 'troll', name: 'Troll', short: 'TRL', attack: 9, defense: 5, move: 3, range: 1, men: 6, cost: 0, upkeep: 0, recruit: null, march: 9 },

  // Heroes: `men` is base hit points, `cost` the hiring fee.
  lord: { id: 'lord', name: 'Lord', short: 'LRD', attack: 4, defense: 5, move: 4, range: 1, men: 30, cost: 0, upkeep: 0, recruit: null, march: 14,
    hero: { leadership: 15, power: 12, mana: 0, spells: [] } },
  champion: { id: 'champion', name: 'Champion', short: 'CHM', attack: 5, defense: 5, move: 4, range: 1, men: 26, cost: 250, upkeep: 20, recruit: null, march: 14,
    hero: { leadership: 10, power: 12, mana: 0, spells: [] } },
  priest: { id: 'priest', name: 'Priest', short: 'PRI', attack: 2, defense: 3, move: 3, range: 1, men: 18, cost: 300, upkeep: 20, recruit: null, march: 12,
    hero: { leadership: 5, power: 8, mana: 12, spells: ['heal', 'rally'] } },
  mage: { id: 'mage', name: 'Mage', short: 'MAG', attack: 1, defense: 2, move: 3, range: 1, men: 14, cost: 350, upkeep: 25, recruit: null, march: 12,
    hero: { leadership: 0, power: 6, mana: 12, spells: [...MAGE_SPELLS] } },
  warchief: { resistances: { arcane: 25 }, id: 'warchief', name: 'Orc Warchief', short: 'WAR', attack: 5, defense: 4, move: 3, range: 1, men: 26, cost: 0, upkeep: 0, recruit: null, march: 12,
    hero: { leadership: 10, power: 12, mana: 0, spells: [] } },
  shaman: { resistances: { fire: 25 }, id: 'shaman', name: 'Orc Shaman', short: 'SHA', attack: 1, defense: 2, move: 3, range: 1, men: 14, cost: 0, upkeep: 0, recruit: null, march: 12,
    hero: { leadership: 0, power: 6, mana: 12, spells: [...MAGE_SPELLS] } },
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

/** Heroes for hire. The lord is the player's own and never offered. */
export const HIREABLE_HEROES = ['champion', 'priest', 'mage'];
export const HERO_NAMES: Record<string, string[]> = {
  champion: ['Brannoc', 'Edith of Wray', 'Tamsin Hale', 'Corin Ashby'],
  priest: ['Brother Osric', 'Mother Elswyth', 'Father Anselm', 'Sister Maud'],
  mage: ['Ysolde', 'Master Pell', 'Varro the Grey', 'Hesketh'],
};

/** Overland terrain for hex campaigns. Battles fought on a land get a field shaped like it. */
export const LAND: Record<Land, LandType> = {
  plains: { id: 'plains', name: 'Plains', char: '.', move: 2, battleScatter: [['forest', 0.1], ['hill', 0.06], ['marsh', 0.035], ['thorns', 0.03], ['ruins', 0.02], ['rocks', 0.03]], battleStream: 0.5, text: 'Open country. 2 to cross.' },
  farmland: { id: 'farmland', name: 'Farmland', char: ',', move: 2, battleScatter: [['thorns', 0.05], ['forest', 0.04], ['ruins', 0.02]], battleStream: 0.5, text: 'Fields and hedges around the towns. 2 to cross.' },
  forest: { id: 'forest', name: 'Forest', char: 'f', move: 3, battleScatter: [['forest', 0.32], ['thorns', 0.07], ['hill', 0.03], ['rocks', 0.02]], battleStream: 0.3, text: 'Woods. 3 to cross; battles here are fought among trees.' },
  deepwood: { id: 'deepwood', name: 'Deep woods', char: 'F', move: 4, battleScatter: [['forest', 0.5], ['thorns', 0.1], ['spring', 0.01]], battleStream: 0.3, text: 'Old, tangled forest. 4 to cross; battles here are thick with trees and briars.' },
  hills: { id: 'hills', name: 'Hills', char: 'h', move: 3, battleScatter: [['hill', 0.26], ['rocks', 0.08], ['forest', 0.05], ['ruins', 0.03]], battleStream: 0.2, text: 'Rough hills. 3 to cross; battles here are full of slopes and rocks.' },
  mountains: { id: 'mountains', name: 'Mountains', char: 'm', move: Infinity, battleScatter: [['rocks', 0.2], ['hill', 0.2]], battleStream: 0, text: 'Impassable. Cross by Grey Pass or the southern trail.' },
  swamp: { id: 'swamp', name: 'Swamp', char: 's', move: 4, battleScatter: [['marsh', 0.3], ['forest', 0.05], ['thorns', 0.04]], battleStream: 0.6, text: 'Bog and reeds. 4 to cross; battles here are fought in the marsh.' },
  water: { id: 'water', name: 'Water', char: '~', move: Infinity, battleScatter: [['marsh', 0.08]], battleStream: 1, text: 'River or lake. Only crossed by bridges.' },
  badlands: { id: 'badlands', name: 'Badlands', char: 'b', move: 3, battleScatter: [['rocks', 0.1], ['hill', 0.08], ['ruins', 0.03], ['thorns', 0.04]], battleStream: 0.1, text: 'Scorched orc country. 3 to cross.' },
};
