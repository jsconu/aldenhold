import type { CampaignDefinition, HexWorld, Town } from '../../game/types';
import { WESTERN_REVISION_1_ROWS } from './westernRevision1';
import { WESTERN_EAST_ROWS, WESTERN_SOUTH_ROWS } from './westernExpansion';

/** Archived bounds for additive revision-2 imports; no old terrain cell moves. */
export const WESTERN_REVISION_2_ROWS = [...WESTERN_REVISION_1_ROWS.map((row, i) => row + WESTERN_EAST_ROWS[i]), ...WESTERN_SOUTH_ROWS];
export const REED_COAST_TOWNS: Town[] = [
  { id: 'willowford', owner: 'neutral', pop: 1700, tax: 15, kind: 'town' },
  { id: 'miretooth', owner: 'neutral', pop: 1100, tax: 15, kind: 'town' },
  { id: 'reedspire', owner: 'neutral', pop: 2100, tax: 15, kind: 'town' },
  { id: 'brineport', owner: 'neutral', pop: 2400, tax: 15, kind: 'town' },
  { id: 'gullmere', owner: 'neutral', pop: 1500, tax: 15, kind: 'town' },
];
export const REED_COAST_ARMIES: CampaignDefinition['armies'] = [
  { owner: 'neutral', at: 'willowford', troops: ['militia', 'archers'] },
  { owner: 'neutral', at: 'miretooth', troops: ['spearmen', 'troll'] },
  { owner: 'neutral', at: 'reedspire', troops: ['spearmen', 'archers'] },
  { owner: 'neutral', at: 'brineport', troops: ['militia', 'spearmen', 'archers'] },
  { owner: 'neutral', at: 'gullmere', troops: ['militia', 'archers'] },
];
export const REED_COAST_PLACES: HexWorld['places'] = [
  { id: 'coastgate', name: 'Reed Coast Approach', col: 52, row: 33, kind: 'landmark' },
  { id: 'willowford', name: 'Willowford', col: 56, row: 34, kind: 'town' },
  { id: 'miretooth', name: 'Miretooth', col: 55, row: 24, kind: 'town' },
  { id: 'reedspire', name: 'Reedspire', col: 64, row: 35, kind: 'town' },
  { id: 'brineport', name: 'Brineport', col: 69, row: 44, kind: 'town' },
  { id: 'gullmere', name: 'Gullmere', col: 69, row: 26, kind: 'town' },
  { id: 'willowbridge', name: 'Willow Crossing', col: 60, row: 34, kind: 'landmark' },
  { id: 'lanternford', name: 'Lantern Crossing', col: 60, row: 25, kind: 'landmark' },
  { id: 'reedbeacon', name: 'Brineport Beacon', col: 68, row: 42, kind: 'landmark' },
  { id: 'reedden', name: 'The Drowned Causeway', col: 57, row: 24, kind: 'landmark' },
];
export const REED_COAST_ROUTES: HexWorld['routes'] = [
  ['redford', 'coastgate', 'willowford', 'willowbridge', 'reedspire', 'reedbeacon', 'brineport'],
  ['willowford', 'miretooth', 'reedden', 'lanternford', 'gullmere', 'brineport'],
];

/** Authored watersheds and terrain bands, built once as content, without random or runtime frontier generation. */
export function reedCoastRows(): string[] {
  return Array.from({ length: 52 }, (_, row) => Array.from({ length: 76 }, (_, col) => {
    if (row < 38 && col < 52) return WESTERN_REVISION_2_ROWS[row][col];
    if (col < 20 || col >= 73 || row >= 50) return '~';
    if (col === 60) return '~';
    if (col >= 70) return row < 23 ? 'h' : ',';
    if (col < 52) return col < 30 ? (row < 45 ? ',' : 's') : col < 44 ? 'f' : 'h';
    if (row < 10) return col < 60 ? 'h' : 'f';
    if (row < 22) return col < 59 ? 'F' : 'f';
    if (row < 29) return col < 59 ? 's' : ',';
    if (row < 40) return col < 56 ? 'f' : ',';
    return col < 58 ? 's' : col < 65 ? 'f' : ',';
  }).join(''));
}
