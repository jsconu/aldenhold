import type { Season, WeatherKind } from '../game/types';

/**
 * Seasons and weather drawn over the painted terrain, on the overland map and the battlefield. The painted atlases
 * are summer-green, so each season is a layer on top: snow cover and ice in winter, blossom in spring, turning
 * leaves in autumn, a warm haze in summer. Weather (rain, storm, snow, blizzard) falls over the whole view.
 * Everything here is decoration: pointer-events are off and nothing changes what a click does.
 */

/** What a cell is for seasonal purposes, from an overland land type or a battlefield terrain. */
export type Cover = 'open' | 'field' | 'wood' | 'high' | 'wet' | 'water' | 'rock';

const COVER: Record<string, Cover> = {
  // Overland lands.
  plains: 'open', farmland: 'field', forest: 'wood', deepwood: 'wood', hills: 'high', mountains: 'rock', swamp: 'wet', water: 'water', badlands: 'rock',
  // Battlefield terrain.
  plain: 'open', hill: 'high', stream: 'water', marsh: 'wet', thorns: 'wood', ruins: 'rock', rocks: 'rock', spring: 'water',
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
      if (cover === 'wood' || cover === 'open' || cover === 'field') return { fill: 'url(#season-blossom)', cls: 'blossom' };
      return null;
    case 'summer':
      if (cover === 'open' || cover === 'field') return { fill: '#e6cf74', cls: 'haze' };
      return null;
  }
}

/** Patterns the seasonal layer uses: snow cover (light and deep) and blossom. */
export function seasonDefs(): string {
  return `<pattern id="season-snow" patternUnits="userSpaceOnUse" width="14" height="12">
      <rect width="14" height="12" fill="#f4f8fc"/><circle cx="3" cy="3" r=".9" fill="#d5e2ee"/><circle cx="10" cy="8" r="1.1" fill="#dce7f1"/></pattern>
    <pattern id="season-snow-deep" patternUnits="userSpaceOnUse" width="14" height="12">
      <rect width="14" height="12" fill="#ffffff"/><path d="M0 9 L5 6 L9 8 L14 5" stroke="#d6e3ef" stroke-width=".8" fill="none"/></pattern>
    <pattern id="season-blossom" patternUnits="userSpaceOnUse" width="16" height="14">
      <rect width="16" height="14" fill="#9fd07a" fill-opacity=".18"/>
      <circle cx="3" cy="4" r="1.3" fill="#f6b8cf"/><circle cx="11" cy="2.5" r="1" fill="#fff3f7"/>
      <circle cx="8" cy="10" r="1.4" fill="#f2a6c2"/><circle cx="14" cy="11" r=".9" fill="#ffffff"/></pattern>`;
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

/**
 * Weather falling over a `width` × `height` view: rain or storm streaks, snow or blizzard flakes, drifting down
 * (the drift stops for players who prefer reduced motion). Clear weather draws nothing.
 */
export function weatherLayer(kind: WeatherKind, width: number, height: number, id: string): string {
  if (kind === 'clear') return '';
  const wet = kind === 'rain' || kind === 'storm';
  const size = wet ? 24 : 30;
  const mark = wet
    ? `<path d="M4 0 L0 12 M16 8 L12 20 M22 2 L18 14" stroke="#cfe0ec" stroke-width="${kind === 'storm' ? 1.1 : .7}" stroke-linecap="round" opacity="${kind === 'storm' ? .75 : .55}"/>`
    : `<circle cx="5" cy="6" r="${kind === 'blizzard' ? 1.6 : 1.2}" fill="#fff"/><circle cx="19" cy="15" r="${kind === 'blizzard' ? 1.4 : 1}" fill="#fff"/><circle cx="11" cy="24" r="1.1" fill="#fff"/><circle cx="26" cy="27" r=".9" fill="#fff"/>`;
  const tint = kind === 'storm' ? '<rect class="weather-tint storm" x="0" y="0" width="100%" height="100%"/>'
    : kind === 'blizzard' ? '<rect class="weather-tint whiteout" x="0" y="0" width="100%" height="100%"/>' : '';
  // Two layers of the same pattern, offset, read as depth; each drifts downward by one tile and repeats.
  return `<g class="weather-layer weather-${kind}" pointer-events="none">
    <defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}">${mark}</pattern></defs>
    ${tint}
    <svg x="0" y="0" width="${width}" height="${height}" overflow="hidden">
      <rect class="weather-fall" x="0" y="${-size}" width="${width}" height="${height + size}" fill="url(#${id})" style="--tile:${size}px"/>
      <rect class="weather-fall slow" x="${size / 2}" y="${-size}" width="${width}" height="${height + size}" fill="url(#${id})" opacity=".6" style="--tile:${size}px"/>
    </svg></g>`;
}
