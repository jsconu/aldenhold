import type { FactionId, MapNode, Town, UnitType } from './types';

export const UNIT_TYPES: Record<string, UnitType> = {
  militia: { id: 'militia', name: 'Militia', short: 'MIL', attack: 2, defense: 2, move: 3, range: 1, men: 20, cost: 60, upkeep: 4, recruit: 'any' },
  spearmen: { id: 'spearmen', name: 'Spearmen', short: 'SPR', attack: 3, defense: 4, move: 3, range: 1, men: 20, cost: 120, upkeep: 8, recruit: 'any' },
  archers: { id: 'archers', name: 'Archers', short: 'ARC', attack: 2, defense: 2, move: 3, range: 4, men: 15, cost: 110, upkeep: 7, recruit: 'any' },
  knights: { id: 'knights', name: 'Knights', short: 'KNT', attack: 5, defense: 4, move: 6, range: 1, men: 10, cost: 220, upkeep: 15, recruit: 'capital' },
  warband: { id: 'warband', name: 'Orc Warband', short: 'ORC', attack: 3, defense: 2, move: 3, range: 1, men: 20, cost: 0, upkeep: 0, recruit: null },
  orcArchers: { id: 'orcArchers', name: 'Orc Archers', short: 'OAR', attack: 2, defense: 1, move: 3, range: 3, men: 15, cost: 0, upkeep: 0, recruit: null },
  troll: { id: 'troll', name: 'Troll', short: 'TRL', attack: 9, defense: 5, move: 3, range: 1, men: 6, cost: 0, upkeep: 0, recruit: null },
};

export const CAPITAL = 'aldenhold';
export const LAIR = 'gharzak';

export const MAP_NODES: MapNode[] = [
  { id: 'aldenhold', name: 'Aldenhold', x: 90, y: 270 },
  { id: 'fenwick', name: 'Fenwick', x: 220, y: 120 },
  { id: 'millbrook', name: 'Millbrook', x: 230, y: 410 },
  { id: 'bridge', name: 'Stone Bridge', x: 360, y: 270 },
  { id: 'harrowgate', name: 'Harrowgate', x: 480, y: 110 },
  { id: 'duskwater', name: 'Duskwater', x: 490, y: 420 },
  { id: 'pass', name: 'Grey Pass', x: 610, y: 240 },
  { id: 'watchtower', name: 'Old Watchtower', x: 650, y: 440 },
  { id: 'gharzak', name: 'Gharzak Hold', x: 760, y: 300 },
];

export const MAP_EDGES: [string, string][] = [
  ['aldenhold', 'fenwick'],
  ['aldenhold', 'millbrook'],
  ['aldenhold', 'bridge'],
  ['fenwick', 'bridge'],
  ['millbrook', 'bridge'],
  ['fenwick', 'harrowgate'],
  ['bridge', 'harrowgate'],
  ['bridge', 'duskwater'],
  ['millbrook', 'duskwater'],
  ['harrowgate', 'pass'],
  ['duskwater', 'pass'],
  ['duskwater', 'watchtower'],
  ['watchtower', 'gharzak'],
  ['pass', 'gharzak'],
];

export const START_TOWNS: Town[] = [
  { id: 'aldenhold', owner: 'player', pop: 3000, tax: 20, kind: 'capital' },
  { id: 'millbrook', owner: 'player', pop: 1600, tax: 20, kind: 'town' },
  { id: 'fenwick', owner: 'neutral', pop: 1400, tax: 15, kind: 'town' },
  { id: 'harrowgate', owner: 'neutral', pop: 2200, tax: 15, kind: 'town' },
  { id: 'duskwater', owner: 'neutral', pop: 1800, tax: 15, kind: 'town' },
  { id: 'gharzak', owner: 'orcs', pop: 0, tax: 0, kind: 'lair' },
];

export const START_ARMIES: { owner: FactionId; at: string; troops: string[] }[] = [
  { owner: 'player', at: 'aldenhold', troops: ['militia', 'militia', 'spearmen', 'archers'] },
  { owner: 'player', at: 'millbrook', troops: ['militia'] },
  { owner: 'neutral', at: 'fenwick', troops: ['militia'] },
  { owner: 'neutral', at: 'harrowgate', troops: ['militia', 'militia'] },
  { owner: 'neutral', at: 'duskwater', troops: ['militia', 'archers'] },
  { owner: 'orcs', at: 'gharzak', troops: ['warband', 'warband', 'warband', 'orcArchers', 'troll'] },
  { owner: 'orcs', at: 'pass', troops: ['warband', 'warband'] },
];

export const STARTING_GOLD = 300;
