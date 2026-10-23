import type { Season } from '../game/types';

/**
 * Seasons and weather drawn over the painted terrain, on the overland map and the battlefield. The painted atlases
 * are summer-green, so each season is a layer on top: a dusting of snow and ice in winter, fresh green in spring, turning
 * leaves in autumn, a warm haze in summer. The weather itself is told in the ticker under the top bar, not drawn.
 * Everything here is decoration: pointer-events are off and nothing changes what a click does.
 */

/** What a cell is for seasonal purposes, from an overland land type or a battlefield terrain. */
export type Cover = 'open' | 'field' | 'wood' | 'high' | 'wet' | 'water' | 'rock';

const COVER: Record<string, Cover> = {
  // Overland lands.
  plains: 'open', farmland: 'field', forest: 'wood', deepwood: 'wood', hills: 'high', mountains: 'rock', swamp: 'wet', water: 'water', badlands: 'rock',
  // Battlefield terrain.
  plain: 'open', hill: 'high', stream: 'water', marsh: 'wet', thorns: 'wood', ruins: 'rock', rocks: 'rock', spring: 'water', fort: 'rock', bridge: 'open',
};

export function coverOf(land: string): Cover {
  return COVER[land] ?? 'open';
}

export interface SeasonCell {
  /** SVG polygon points of the cell. */
  points: string;
  cover: Cover;
  /** A stable number for the cell, so variation (leaf colour, blossom) doesn't shimmer between redraws. */
  hash: number;
}

export function cellHash(col: number, row: number): number {
  return (Math.imul(col + 7, 73856093) ^ Math.imul(row + 13, 19349663)) >>> 0;
}

const AUTUMN = ['#c8642a', '#b23f24', '#d9a032', '#a8502a'];

/** The fill for one cell in one season, or null for no change. */
function seasonFill(season: Season, cell: SeasonCell): { fill: string; cls: string } | null {
  const { cover, hash } = cell;
  switch (season) {
    case 'winter':
      if (cover === 'water') return { fill: '#cfe3ee', cls: 'ice' };
      // Woods keep their trees showing through a thinner cover; open ground and heights lie under deep snow.
      if (cover === 'wood' || cover === 'wet') return { fill: 'url(#season-snow)', cls: 'snow-thin' };
      return { fill: cover === 'rock' || cover === 'high' ? 'url(#season-snow-deep)' : 'url(#season-snow)', cls: 'snow' };
    case 'autumn':
      if (cover === 'wood') return { fill: AUTUMN[hash % AUTUMN.length], cls: 'leaves' };
      if (cover === 'open' || cover === 'field') return { fill: '#c9a44a', cls: 'stubble' };
      return null;
    case 'spring':
      // Fresh new green everywhere that grows.
      if (cover === 'wood') return { fill: '#86cc5c', cls: 'fresh' };
      if (cover === 'open' || cover === 'field') return { fill: '#8fd468', cls: 'fresh' };
      return null;
    case 'summer':
      if (cover === 'open' || cover === 'field') return { fill: '#e6cf74', cls: 'haze' };
      return null;
  }
}

/** Patterns the seasonal layer uses: snow cover, light and deep. */
export function seasonDefs(): string {
  return `<pattern id="season-snow" patternUnits="userSpaceOnUse" width="14" height="12">
      <rect width="14" height="12" fill="#f4f8fc"/><circle cx="3" cy="3" r=".9" fill="#d5e2ee"/><circle cx="10" cy="8" r="1.1" fill="#dce7f1"/></pattern>
    <pattern id="season-snow-deep" patternUnits="userSpaceOnUse" width="14" height="12">
      <rect width="14" height="12" fill="#ffffff"/><path d="M0 9 L5 6 L9 8 L14 5" stroke="#d6e3ef" stroke-width=".8" fill="none"/></pattern>
`;
}

/** The season's layer over every cell. Snow covers most of the ground; the others tint it. */
export function seasonLayer(season: Season, cells: SeasonCell[]): string {
  let out = '';
  for (const cell of cells) {
    const look = seasonFill(season, cell);
    if (look) out += `<polygon points="${cell.points}" fill="${look.fill}" class="season-${look.cls}"/>`;
  }
  return `<g class="season-layer season-${season}" pointer-events="none">${out}</g>`;
}
