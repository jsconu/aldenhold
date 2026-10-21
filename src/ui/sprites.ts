import type { Terrain } from '../game/types';

/**
 * Hand-drawn SVG art for the battlefield. Unit icons are symbols on a 24×24 grid, drawn in currentColor so the
 * token decides their colour. Terrain art is drawn around a hex centre; `seed` varies details between hexes.
 */

const ICONS: Record<string, string> = {
  // Pitchfork.
  militia: `<path d="M12 22V9M7 3v4a5 5 0 0 0 10 0V3M12 3v6"/>`,
  // Spear and kite shield.
  spearmen: `<path d="M7 22V6"/><path d="M7 1.5 4.5 7h5z" class="fill"/><path d="M11 9h9v5c0 4.5-4.5 7.5-4.5 7.5S11 18.5 11 14z" class="fill soft"/>`,
  // Bow and arrow.
  archers: `<path d="M7 3c7 3 7 15 0 18"/><path d="M7 3v18" class="thin"/><path d="M3 12h15"/><path d="M21.5 12 17 9.5v5z" class="fill"/>`,
  // Longbow with a leaf: woodland archers.
  woodlandArchers: `<path d="M7 2c8 3.5 8 16.5 0 20"/><path d="M7 2v20" class="thin"/><path d="M3 12h15"/><path d="M21.5 12 17 9.5v5z" class="fill"/><path d="M15 3c3 0 5 2 5 5-3 0-5-2-5-5z" class="fill soft"/>`,
  // Knight's helm with plume.
  knights: `<path d="M6 21v-8a6 6 0 0 1 12 0v8z" class="fill soft"/><path d="M8 13.5h8M12 13.5V18"/><path d="M12 7c1-3 4-4.5 7-3.5-2 .5-3 1.5-3.5 3"/>`,
  // Crown.
  lord: `<path d="M4 18 3 7.5l5 4 4-7 4 7 5-4L20 18z" class="fill soft"/><path d="M4 21h16"/><circle cx="12" cy="4" r="1.2" class="fill"/>`,
  // Upright sword.
  champion: `<path d="M12 2.5V16"/><path d="M12 2.5 10.5 5v11h3V5z" class="fill soft"/><path d="M6.5 16h11M12 16v4"/><circle cx="12" cy="21.5" r="1.4" class="fill"/>`,
  // Radiant holy sun.
  priest: `<circle cx="12" cy="12" r="4" class="fill soft"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5"/>`,
  // Wizard hat with a star.
  mage: `<path d="M12 2c1 4 4 10 7 15H5c3-5 6-11 7-15z" class="fill soft"/><path d="M3 18h18"/><path d="m11 8 .7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" class="fill"/>`,
  // Crude axe.
  warband: `<path d="M7 21.5 16.5 4"/><path d="M13.5 5c3-2.5 7-1 8 2.5-3-.5-5 .5-6.5 2.5z" class="fill soft"/>`,
  // Bow with a jagged arrow.
  orcArchers: `<path d="M7 3c7 3 7 15 0 18"/><path d="M7 3v18" class="thin"/><path d="M3 12h4l1-1.5 1 3 1-1.5h8"/><path d="M21.5 12 17 9.5v5z" class="fill"/>`,
  // Knobbed club.
  // One great eye.
  cyclops: `<circle cx="12" cy="12" r="8" class="fill soft"/><circle cx="12" cy="12" r="3" class="fill"/>`,
  // Horned head.
  minotaur: `<path d="M4 4c0 5 3 7 8 7s8-2 8-7"/><path d="M8 11v9h8v-9" class="fill soft"/>`,
  // Small head and a long spear.
  goblinSkirmishers: `<path d="M6 21 18 5"/><path d="M18 5l-1 4 3-1z" class="fill"/><circle cx="8" cy="10" r="3" class="fill soft"/>`,
  troll: `<path d="M5 21.5 12 13"/><ellipse cx="15.5" cy="8.5" rx="4" ry="6.5" transform="rotate(40 15.5 8.5)" class="fill soft"/><circle cx="19.5" cy="4.5" r="1.2" class="fill"/><circle cx="20.5" cy="10" r="1.2" class="fill"/><circle cx="14" cy="3" r="1.2" class="fill"/>`,
  // Horned helm.
  warchief: `<path d="M7 20v-6a5 5 0 0 1 10 0v6z" class="fill soft"/><path d="M7.5 12C4 11 2.5 7.5 3.5 3.5c.8 3 2.5 4.5 5 5M16.5 12c3.5-1 5-4.5 4-8.5-.8 3-2.5 4.5-5 5"/><path d="M9.5 15.5h5"/>`,
  // Skull.
  shaman: `<path d="M5.5 11a6.5 6.5 0 1 1 13 0c0 3-2 4.5-2 4.5V19h-9v-3.5s-2-1.5-2-4.5z" class="fill soft"/><circle cx="9.3" cy="11" r="1.8" class="hole"/><circle cx="14.7" cy="11" r="1.8" class="hole"/><path d="M10 19v-2.5M12 19v-2.5M14 19v-2.5" class="thin"/>`,
};

/** CSS can't reach inside <use> copies, so the icon classes become presentation attributes here. */
function iconBody(body: string): string {
  const styled = body
    .replace(/class="fill soft"/g, 'fill="currentColor" fill-opacity="0.35"')
    .replace(/class="fill"/g, 'fill="currentColor" stroke="none"')
    .replace(/class="thin"/g, 'stroke-width="1.2"')
    .replace(/class="hole"/g, 'fill="#1b1a17" stroke="none"');
  return `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${styled}</g>`;
}

export function spriteDefs(): string {
  return `<defs>${Object.entries(ICONS)
    .map(([id, body]) => `<symbol id="icon-${id}" viewBox="0 0 24 24">${iconBody(body)}</symbol>`)
    .join('')}
    <radialGradient id="pool" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#bfe9ff"/><stop offset="1" stop-color="#3f8fb3"/></radialGradient>
  </defs>`;
}

export function unitIcon(type: string, x: number, y: number, size: number): string {
  return ICONS[type] ? `<use href="#icon-${type}" x="${x}" y="${y}" width="${size}" height="${size}" class="icon"/>` : '';
}

/** Cheap deterministic jitter so neighbouring forest hexes don't look stamped. */
function jitter(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
}

function tree(x: number, y: number, s: number): string {
  return `<path d="M${x} ${y - 9 * s}l${6 * s} ${10 * s}h${-12 * s}z" class="t-tree"/><path d="M${x} ${y - 4 * s}l${7 * s} ${10 * s}h${-14 * s}z" class="t-tree"/><path d="M${x} ${y + 6 * s}v${3 * s}" class="t-trunk"/>`;
}

export function terrainArt(kind: Terrain, cx: number, cy: number, seed: number): string {
  const j = (i: number, amt: number) => (jitter(seed, i) * amt).toFixed(1);
  switch (kind) {
    case 'forest':
      return `<g class="t-art">${tree(cx - 9 + +j(1, 3), cy + 2 + +j(2, 3), 0.9)}${tree(cx + 8 + +j(3, 3), cy - 1 + +j(4, 3), 1)}${tree(cx + 1 + +j(5, 3), cy + 10, 0.75)}</g>`;
    case 'hill':
      return `<g class="t-art"><path d="M${cx - 22} ${cy + 10}q12-20 24-4q8-12 20 4" class="t-hill"/><path d="M${cx - 10} ${cy + 2}l5 3M${cx + 9} ${cy + 1}l4 3" class="t-hill-line"/></g>`;
    case 'stream':
      return `<g class="t-art"><path d="M${cx - 18} ${cy - 6}q6-5 12 0t12 0t12 0" class="t-wave"/><path d="M${cx - 18} ${cy + 4}q6-5 12 0t12 0t12 0" class="t-wave"/><path d="M${cx - 12} ${cy + 13}q6-5 12 0t12 0" class="t-wave"/></g>`;
    case 'marsh':
      return `<g class="t-art"><ellipse cx="${cx - 6}" cy="${cy + 6}" rx="11" ry="4" class="t-bog"/><ellipse cx="${cx + 10}" cy="${cy - 5}" rx="7" ry="3" class="t-bog"/>
        <path d="M${cx + 4} ${cy + 9}v-10M${cx + 7} ${cy + 9}l2-8M${cx + 1} ${cy + 9}l-2-7M${cx - 14} ${cy - 2}v-8M${cx - 11} ${cy - 2}l2-6" class="t-reed"/></g>`;
    case 'thorns':
      return `<g class="t-art"><path d="M${cx - 16} ${cy + 8}c6-12 12-12 16-2s10 8 16-4" class="t-briar"/><path d="M${cx - 14} ${cy - 4}c6 6 12 6 14-4s8-6 14 2" class="t-briar"/>
        <path d="M${cx - 8} ${cy + 1}l-3-3M${cx + 4} ${cy + 3}l2-4M${cx + 10} ${cy - 6}l3-2M${cx - 4} ${cy - 6}l-1-4" class="t-spike"/></g>`;
    case 'ruins':
      return `<g class="t-art"><path d="M${cx - 16} ${cy + 10}v-14h5v-4h4v4h3v14z" class="t-stone"/><path d="M${cx + 2} ${cy + 10}v-8h4v-3h4v6h3v5z" class="t-stone"/><path d="M${cx - 16} ${cy + 3}h13M${cx + 2} ${cy + 6}h11" class="t-mortar"/></g>`;
    case 'rocks':
      return `<g class="t-art"><path d="M${cx - 18} ${cy + 10}l5-14 9-4 7 9-2 9z" class="t-rock"/><path d="M${cx + 1} ${cy + 10}l3-11 8-5 7 8-1 8z" class="t-rock dark"/><path d="M${cx - 9} ${cy - 6}l3 8M${cx + 9} ${cy - 4}l-2 7" class="t-crack"/></g>`;
    case 'spring':
      return `<g class="t-art"><ellipse cx="${cx}" cy="${cy + 3}" rx="15" ry="8" class="t-pool"/><ellipse cx="${cx}" cy="${cy + 3}" rx="15" ry="8" class="t-pool-rim"/>
        <path d="M${cx - 5} ${cy - 10}l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5zM${cx + 8} ${cy - 8}l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" class="t-sparkle"/></g>`;
    default:
      return Math.abs(jitter(seed, 9)) > 0.42 ? `<path d="M${cx + +j(7, 20)} ${cy + 8 + +j(8, 6)}l2-5 2 5" class="t-grass"/>` : '';
  }
}
