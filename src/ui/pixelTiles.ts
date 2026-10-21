import type { HexWorld, Land } from '../game/types';
import { hexLand, parseKey, roadsOf } from '../game/world';

/**
 * Pixel-art overland terrain. The whole map is painted once into an RGBA buffer at native resolution, one
 * 24×20-pixel flat-topped hex tile per cell, then shown scaled up with crisp pixels. Pure code (no DOM), so the
 * tile geometry can be tested.
 */

export const TILE_W = 24;
export const TILE_H = 20;
/** Columns overlap: each column starts 18 px after the previous one; odd columns sit half a tile lower. */
export const STEP_X = 18;
export const HALF_H = TILE_H / 2;

/**
 * Left/right inset of each pixel row of the hex shape, top half. Chosen so that inset(y) + inset(9 - y) = 6:
 * neighbouring columns then interlock with no gaps and no overlaps.
 */
const TOP_INSET = [6, 5, 5, 4, 3, 3, 2, 1, 1, 0];
export const HEX_INSET = [...TOP_INSET, ...[...TOP_INSET].reverse()];

export function mapPixelSize(world: HexWorld) {
  const cols = world.rows[0].length;
  return { width: STEP_X * (cols - 1) + TILE_W, height: TILE_H * world.rows.length + HALF_H };
}

/** Top-left pixel of a hex tile. */
export function tileOrigin(col: number, row: number): [number, number] {
  return [col * STEP_X, row * TILE_H + (col & 1 ? HALF_H : 0)];
}

export function tileCenter(col: number, row: number): [number, number] {
  const [x, y] = tileOrigin(col, row);
  return [x + TILE_W / 2, y + HALF_H];
}

/** Outline of a hex tile as SVG polygon points, matching the pixel mask. */
export function tilePolygon(col: number, row: number): string {
  const [x, y] = tileOrigin(col, row);
  return [[x + 6, y], [x + 18, y], [x + 24, y + 10], [x + 18, y + 20], [x + 6, y + 20], [x, y + 10]].map(([a, b]) => `${a},${b}`).join(' ');
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Earth, woodland and water colours shared in spirit with the softer battle landscape. */
const PAL = {
  outline: hex('#27382f'),
  plains: { base: hex('#596d4e'), light: hex('#71805b'), dark: hex('#4d6247'), flower: hex('#d7c781') },
  farmland: { base: hex('#777659'), wheat: hex('#ac9c68'), wheatDark: hex('#92855b'), furrow: hex('#6b694e'), crop: hex('#74845d') },
  forest: { base: hex('#385744'), light: hex('#48684a'), canopy: hex('#254632'), canopyLight: hex('#56815b'), trunk: hex('#574b37') },
  deepwood: { base: hex('#294733'), light: hex('#38543a'), canopy: hex('#1b3929'), canopyLight: hex('#416447'), trunk: hex('#4b4232') },
  hills: { base: hex('#667354'), light: hex('#788562'), hill: hex('#89896a'), hillLight: hex('#aaa783'), hillDark: hex('#515d48') },
  mountains: { base: hex('#676b63'), light: hex('#797e72'), rock: hex('#898c80'), rockLight: hex('#b0b2a1'), rockDark: hex('#4c534d'), snow: hex('#c9cbbd') },
  swamp: { base: hex('#4b6256'), light: hex('#5b7260'), pool: hex('#3f6970'), poolLight: hex('#619098'), reed: hex('#a19e70') },
  water: { base: hex('#3b6878'), light: hex('#53818c'), wave: hex('#9ac2c2'), dark: hex('#345665') },
  badlands: { base: hex('#826e5c'), light: hex('#98816b'), dark: hex('#6c5b4e'), rock: hex('#87867b'), rockLight: hex('#aaa99b') },
  road: { dirt: hex('#ab9874'), edge: hex('#5c5747') },
  bridge: { plank: hex('#a18c68'), rail: hex('#534a3b') },
};

/** Deterministic noise in [0, 1) from integer coordinates and a salt. */
function noise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Canvas {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

function put(c: Canvas, x: number, y: number, rgb: RGB) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 4;
  c.data[i] = rgb[0];
  c.data[i + 1] = rgb[1];
  c.data[i + 2] = rgb[2];
  c.data[i + 3] = 255;
}

/** True if (x, y), relative to a tile's top-left, is inside the hex. */
export function inHex(x: number, y: number): boolean {
  if (y < 0 || y >= TILE_H) return false;
  const inset = HEX_INSET[y];
  return x >= inset && x < TILE_W - inset;
}

/**
 * Small stamps drawn onto tiles. Each character picks a colour from the land's palette ('k' is the shared
 * outline); '.' is transparent. Stamps are clipped to the hex.
 */
const STAMPS: Record<string, string[]> = {
  tree: ['..k..', '.kCk.', 'kCcCk', 'kCCCk', '.kkk.', '..t..', '..t..'],
  pine: ['..k..', '.kCk.', '.kCk.', 'kCcCk', 'kCCCk', 'kkkkk', '..t..'],
  hill: ['...kkkkk...', '..kLLLHHk..', '.kLLHHHHHk.', 'kHHHHHHHDDk'],
  peak: ['......k......', '.....kWk.....', '....kWWWk....', '...kWRWWRk...', '..kRRLRRRDk..', '.kRRLRRRRDDk.', 'kRRRRRRRRRDDk', 'kkkkkkkkkkkkk'],
  peakSmall: ['....k....', '...kWk...', '..kRWRk..', '.kRLRRDk.', 'kRRRRRDDk', 'kkkkkkkkk'],
  reeds: ['r.r', 'r.r', 'rrr', '.r.'],
  pool: ['.PPPP.', 'PPpPPP', '.PPPP.'],
  rocks: ['.kk.', 'kRLk', 'kRRk', '.kk.'],
  wave: ['ww.', '..w'],
  flower: ['f'],
};

function stamp(c: Canvas, ox: number, oy: number, sx: number, sy: number, name: string, colour: (ch: string) => RGB | null) {
  STAMPS[name].forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const ch = line[dx];
      if (ch === '.') continue;
      const tx = sx + dx;
      const ty = sy + dy;
      if (!inHex(tx, ty)) continue;
      const rgb = ch === 'k' ? PAL.outline : colour(ch);
      if (rgb) put(c, ox + tx, oy + ty, rgb);
    }
  });
}

/** Paint one tile: dithered ground, then the land's features. */
function paintTile(c: Canvas, col: number, row: number, land: Land) {
  const [ox, oy] = tileOrigin(col, row);
  const r = (i: number) => noise(col, row, i + 1);
  const ground = (base: RGB, light: RGB, dark?: RGB, lightOdds = 0.12, darkOdds = 0.1) => {
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        if (!inHex(x, y)) continue;
        const n = noise(ox + x, oy + y, 7);
        put(c, ox + x, oy + y, n < lightOdds ? light : dark && n > 1 - darkOdds ? dark : base);
      }
    }
  };
  const at = (lo: number, hi: number, i: number) => Math.floor(lo + r(i) * (hi - lo + 1));

  switch (land) {
    case 'plains': {
      const p = PAL.plains;
      ground(p.base, p.light, p.dark);
      if (r(1) < 0.35) stamp(c, ox, oy, at(6, 16, 2), at(5, 14, 3), 'flower', () => p.flower);
      break;
    }
    case 'farmland': {
      const p = PAL.farmland;
      // Furrows follow map coordinates so neighboring fields do not form a tile checkerboard.
      for (let y = 0; y < TILE_H; y++) {
        for (let x = 0; x < TILE_W; x++) {
          if (!inHex(x, y)) continue;
          const gx = ox + x, gy = oy + y;
          const furrow = (gy + Math.floor(gx / 32)) % 8 === 0;
          const grain = noise(gx, gy, 7);
          const colour = furrow ? p.furrow : grain < .08 ? p.crop : grain > .84 ? p.wheatDark : p.wheat;
          put(c, ox + x, oy + y, colour);
        }
      }
      break;
    }
    case 'forest':
    case 'deepwood': {
      const p = land === 'forest' ? PAL.forest : PAL.deepwood;
      ground(p.base, p.light);
      const colour = (ch: string) => (ch === 'C' ? p.canopy : ch === 'c' ? p.canopyLight : ch === 't' ? p.trunk : null);
      const spots = land === 'forest'
        ? [[3, 2], [11, 1], [16, 6], [6, 9], [13, 11]]
        : [[2, 1], [8, 0], [14, 1], [17, 6], [4, 6], [10, 6], [7, 11], [13, 12]];
      spots.forEach(([sx, sy], i) => {
        if (r(50 + i) < (land === 'forest' ? .56 : .68))
          stamp(c, ox, oy, sx + at(-1, 1, 10 + i), sy + at(0, 1, 20 + i), r(30 + i) < 0.4 ? 'pine' : 'tree', colour);
      });
      break;
    }
    case 'hills': {
      const p = PAL.hills;
      ground(p.base, p.light);
      const colour = (ch: string) => (ch === 'H' ? p.hill : ch === 'L' ? p.hillLight : ch === 'D' ? p.hillDark : null);
      if (r(5) < .65) stamp(c, ox, oy, at(1, 4, 1), at(4, 6, 2), 'hill', colour);
      if (r(6) < .36) stamp(c, ox, oy, at(9, 12, 3), at(11, 13, 4), 'hill', colour);
      break;
    }
    case 'mountains': {
      const p = PAL.mountains;
      ground(p.base, p.light, p.rockDark);
      const colour = (ch: string) => (ch === 'R' ? p.rock : ch === 'L' ? p.rockLight : ch === 'D' ? p.rockDark : ch === 'W' ? p.snow : null);
      if (r(6) < .72) stamp(c, ox, oy, at(4, 7, 1), at(3, 5, 2), 'peak', colour);
      if (r(3) < .24) stamp(c, ox, oy, at(13, 15, 4), at(10, 12, 5), 'peakSmall', colour);
      break;
    }
    case 'swamp': {
      const p = PAL.swamp;
      ground(p.base, p.light);
      const colour = (ch: string) => (ch === 'P' ? p.pool : ch === 'p' ? p.poolLight : ch === 'r' ? p.reed : null);
      stamp(c, ox, oy, at(3, 8, 1), at(4, 7, 2), 'pool', colour);
      stamp(c, ox, oy, at(11, 15, 3), at(11, 13, 4), 'pool', colour);
      stamp(c, ox, oy, at(12, 17, 5), at(3, 6, 6), 'reeds', colour);
      stamp(c, ox, oy, at(5, 9, 7), at(12, 14, 8), 'reeds', colour);
      break;
    }
    case 'water': {
      const p = PAL.water;
      ground(p.base, p.light, p.dark, 0.08, 0.08);
      for (let i = 0; i < 3; i++) stamp(c, ox, oy, at(4, 17, 10 + i), at(3, 15, 20 + i), 'wave', () => p.wave);
      break;
    }
    case 'badlands': {
      const p = PAL.badlands;
      ground(p.base, p.light, p.dark, 0.14, 0.14);
      const colour = (ch: string) => (ch === 'R' ? p.rock : ch === 'L' ? p.rockLight : null);
      if (r(1) < 0.7) stamp(c, ox, oy, at(4, 15, 2), at(4, 13, 3), 'rocks', colour);
      // A crack running across the ground.
      let x = at(5, 10, 4);
      for (let y = 8; y < 14; y++) {
        if (inHex(x, y)) put(c, ox + x, oy + y, p.dark);
        x += r(40 + y) < 0.5 ? 1 : 0;
      }
      break;
    }
  }
}

/**
 * Diffuse the broad terrain transition around tile seams, before roads are painted.
 * The texture retains its native resolution while transitions no longer
 * advertise the shape of every movement cell.
 *
 * Never alter alpha outside the world or change land IDs / movement costs.
 */
export function softenHexSeams(c: Canvas, world: HexWorld) {
  const original = c.data.slice();
  let touched = 0;
  for (let row = 0; row < world.rows.length; row++) {
    for (let col = 0; col < world.rows[row].length; col++) {
      const [ox, oy] = tileOrigin(col, row);
      for (let y = 0; y < TILE_H; y++) {
        const inset = HEX_INSET[y];
        for (let x = inset; x < TILE_W - inset; x++) {
          const edge = Math.min(y, TILE_H - 1 - y, x - inset, TILE_W - 1 - inset - x);
          if (edge >= 6) continue;
          const px = ox + x, py = oy + y;
          const i = (py * c.width + px) * 4;
          if (original[i + 3] !== 255) continue;
          let total = 0, red = 0, green = 0, blue = 0;
          for (let dy = -4; dy <= 4; dy++) {
            const yy = py + dy;
            if (yy < 0 || yy >= c.height) continue;
            for (let dx = -4; dx <= 4; dx++) {
              const xx = px + dx;
              if (xx < 0 || xx >= c.width) continue;
              const at = (yy * c.width + xx) * 4;
              if (original[at + 3] !== 255) continue;
              const distance = Math.abs(dx) + Math.abs(dy);
              const weight = 1 / (1 + distance);
              total += weight;
              red += original[at] * weight;
              green += original[at + 1] * weight;
              blue += original[at + 2] * weight;
            }
          }
          if (total <= 0) continue;
          const blend = (6 - edge) * 0.12; // strongest at the boundary, zero in the interior
          c.data[i] = Math.round(original[i] * (1 - blend) + (red / total) * blend);
          c.data[i + 1] = Math.round(original[i + 1] * (1 - blend) + (green / total) * blend);
          c.data[i + 2] = Math.round(original[i + 2] * (1 - blend) + (blue / total) * blend);
          touched++;
        }
      }
    }
  }
  return touched;
}

/** A slow, continuous lighting change across the province, independent of the game hexes. */
function landscapeLight(c: Canvas) {
  const scale = 58;
  const smooth = (v: number) => v * v * (3 - 2 * v);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (c.data[i + 3] !== 255) continue;
    const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
    const u = smooth(x / scale - gx), v = smooth(y / scale - gy);
    const top = noise(gx, gy, 81) * (1 - u) + noise(gx + 1, gy, 81) * u;
    const bottom = noise(gx, gy + 1, 81) * (1 - u) + noise(gx + 1, gy + 1, 81) * u;
    const light = .89 + .2 * (top * (1 - v) + bottom * v);
    for (let channel = 0; channel < 3; channel++) c.data[i + channel] = Math.round(c.data[i + channel] * light);
  }
}

/** Draw a thick line between two pixel points (Bresenham), clipped to the canvas. */
function thickLine(c: Canvas, x0: number, y0: number, x1: number, y1: number, width: number, rgb: RGB) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) put(c, x0 + a - (width >> 1), y0 + b - (width >> 1), rgb);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function paintRoads(c: Canvas, world: HexWorld) {
  const segments: [string, string][] = [];
  for (const road of roadsOf(world)) for (let i = 1; i < road.length; i++) segments.push([road[i - 1], road[i]]);
  const centre = (key: string) => {
    const { col, row } = parseKey(key);
    return tileCenter(col, row).map(Math.round) as [number, number];
  };
  const onWater = (a: string, b: string) => hexLand(world, a).id === 'water' || hexLand(world, b).id === 'water';
  // Edges first, then the dirt on top, so crossings join cleanly. Bridges are wider plank decks with rails.
  for (const [a, b] of segments) {
    const [x0, y0] = centre(a);
    const [x1, y1] = centre(b);
    thickLine(c, x0, y0, x1, y1, onWater(a, b) ? 6 : 4, onWater(a, b) ? PAL.bridge.rail : PAL.road.edge);
  }
  for (const [a, b] of segments) {
    const [x0, y0] = centre(a);
    const [x1, y1] = centre(b);
    thickLine(c, x0, y0, x1, y1, onWater(a, b) ? 4 : 2, onWater(a, b) ? PAL.bridge.plank : PAL.road.dirt);
  }
}

/** Paint the whole map. Pixels outside every hex stay transparent. */
export function paintTerrain(world: HexWorld): Canvas {
  const { width, height } = mapPixelSize(world);
  const c: Canvas = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  world.rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) paintTile(c, col, row, hexLand(world, `${col},${row}`).id);
  });
  // Paint across tile boundaries before laying down sharp, continuous roads.
  softenHexSeams(c, world);
  landscapeLight(c);
  paintRoads(c, world);
  return c;
}
