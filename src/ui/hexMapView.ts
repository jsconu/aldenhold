import type { Army, FactionId, GameState, HexWorld } from '../game/types';
import { arrivalOutcome } from '../game/campaign';
import { hasRoad, hexLand, locationName, parseKey, type MarchStep } from '../game/world';
import { pixelRects } from './pixelSprites';
import { mapPixelSize, paintTerrain, tileCenter, tilePolygon } from './pixelTiles';
import { esc, type UIState } from './shared';

/**
 * The hex overland map: a pixel-art terrain bitmap (painted once per world) under an SVG layer for towns,
 * landmarks, armies, labels, highlights and clicks. SVG units are the bitmap's native pixels.
 */

const OWNER_COLOUR: Record<FactionId, string> = { player: '#5555ff', orcs: '#ff3333', neutral: '#ffdd55' };

const MAP_PALETTE: Record<string, string> = {
  k: '#10100c', w: '#ffffff', g: '#c8c0a8', G: '#8a8270', s: '#b0a890', S: '#5a5048', b: '#6a4a20', B: '#2a1a10',
  y: '#ffff55', R: '#c83c28', r: '#ff7a3c', H: '#6a8a3a', c: '#55ffff',
};

/** Map sprites for towns and landmarks, same character scheme as the unit sprites. 'F' is the owner's colour. */
export const PLACE_SPRITES: Record<string, string[]> = {
  town: [
    '...k..........',
    '...kFF........',
    '...kFFF.......',
    '...k....kk....',
    '..kkk..kRRk...',
    '.kRRRk.kRRRk..',
    'kRRRRRkkRRRRk.',
    'kswwwskkswwsk.',
    'kswkwskkswksk.',
    'ksssssk.ksssk.',
    'kkkkkkk.kkkkk.',
  ],
  capital: [
    '.....k.......',
    '.....kFFF....',
    '.....kFF.....',
    'k.k.kkkkk.k.k',
    'kkk.kgggk.kkk',
    'kgk.kgGgk.kgk',
    'kgkkkgggkkkgk',
    'kgggggggggggk',
    'kgGgggkggggGk',
    'kggggkbbkgggk',
    'kggggkbbkgggk',
    'kkkkkkkkkkkkk',
  ],
  lair: [
    'k...k...k...k',
    'kk.kkk.kkk.kk',
    'kSkkSkkkSkkSk',
    'kSSSSSSSSSSSk',
    'kSGSSFFFSSGSk',
    'kSSSSFFFSSSSk',
    'kSGSSSFSSSGSk',
    'kSSSSkkkSSSSk',
    'kSSSkrrrkSSSk',
    'kSSSkrrrkSSSk',
    'kkkkkkkkkkkkk',
  ],
  watchtower: ['k.k.k', 'kkkkk', 'kgggk', 'kgkgk', 'kgggk', 'kgggk', 'kgggk', 'kgbgk', 'kkkkk'],
  monastery: ['....k....', '...kyk...', '....k....', '...kkk...', '..kRRRk..', '.kRRRRRk.', 'kwwwwwwwk', 'kwwkykwwk', 'kwwkbkwwk', 'kkkkkkkkk'],
  barrow: ['...kkkk...', '.kkHHHHkk.', 'kHHHHHHHHk', 'kHHkBBkHHk', 'kkkkkkkkkk'],
  quarry: ['.kkk.kkk.', 'kgggkgGgk', 'kgGgkggGk', 'kkkkkkkkk', '.kggGgk..', '.kkkkkk..'],
  mine: ['..kkkkk..', '.kHHHHHk.', 'kHbbbbbHk', 'kHbkkkbHk', 'kHbkkkbHk', 'kkkkkkkkk'],
  shrine: ['.k.....k.', 'kgk...kgk', 'kgk.k.kgk', 'kgkkykkgk', 'kgkcyckgk', 'kkkkkkkkk'],
  camp: ['...k.....', '..kbk....', '.kbbbk.k.', 'kbbbbbkbk', 'kbbkbbkbk', 'kkkkkkkkk'],
  pass: ['..k..', '.kgk.', '.kgk.', 'kgGgk', 'kkkkk'],
  banner: ['kk.....', 'kFFFFk.', 'kFFFFFk', 'kFFFFk.', 'k......', 'k......', 'k......', 'k......'],
};

/** Which map sprite a place uses: towns by kind, landmarks by id. */
function spriteFor(state: GameState, placeId: string, kind: 'town' | 'landmark'): string | null {
  if (kind === 'town') {
    const t = state.towns[placeId];
    return t?.kind === 'capital' ? 'capital' : t?.kind === 'lair' ? 'lair' : 'town';
  }
  return PLACE_SPRITES[placeId] ? placeId : null;
}

function symbolDefs(): string {
  let defs = '';
  for (const [name, rows] of Object.entries(PLACE_SPRITES)) {
    for (const [owner, colour] of Object.entries(OWNER_COLOUR)) {
      const id = `map-${name}-${owner}`;
      defs += `<symbol id="${id}" viewBox="0 0 ${rows[0].length} ${rows.length}"><g shape-rendering="crispEdges">${pixelRects(rows, (ch) => (ch === 'F' ? colour : MAP_PALETTE[ch]))}</g></symbol>`;
    }
  }
  return `<defs>${defs}</defs>`;
}

function use(name: string, owner: FactionId, cx: number, bottom: number): string {
  const rows = PLACE_SPRITES[name];
  const w = rows[0].length;
  const h = rows.length;
  return `<use href="#map-${name}-${owner}" x="${cx - w / 2}" y="${bottom - h}" width="${w}" height="${h}"/>`;
}

const terrainCache = new WeakMap<HexWorld, string>();

/** The terrain bitmap as a PNG data URL, painted once per world. Empty outside a browser (tests, tools). */
function terrainImage(world: HexWorld): string {
  if (typeof document === 'undefined') return '';
  let url = terrainCache.get(world);
  if (!url) {
    const pixels = paintTerrain(world);
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas.getContext('2d')!.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
    url = canvas.toDataURL('image/png');
    terrainCache.set(world, url);
  }
  return url;
}

function armyTitle(a: Army): string {
  const men = a.troops.reduce((s, t) => s + t.men, 0);
  const who = a.owner === 'player' ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : 'Town militia';
  return `${who}: ${a.troops.length} ${a.troops.length === 1 ? 'troop' : 'troops'}, ${men} men`;
}

export function renderHexMap(
  state: GameState, ui: UIState, world: HexWorld, targets: Map<string, MarchStep>, arrivals: Map<string, number> = new Map(),
): string {
  const { width, height } = mapPixelSize(world);
  const cell = (key: string) => {
    const { col, row } = parseKey(key);
    return { col, row, centre: tileCenter(col, row) };
  };

  // Reachable hexes get a light wash; hexes where the march would end in a fight or capture get a red edge.
  let reach = '';
  for (const [key] of targets) {
    const { col, row } = cell(key);
    const ends = arrivalOutcome(state, key) !== null;
    reach += `<polygon points="${tilePolygon(col, row)}" class="reach${ends ? ' ends' : ''}"/>`;
  }
  const sel = ui.selected && /^\d+,\d+$/.test(ui.selected) ? cell(ui.selected) : null;
  const selection = sel ? `<polygon points="${tilePolygon(sel.col, sel.row)}" class="selected"/>` : '';

  let places = '';
  let labels = '';
  for (const p of world.places) {
    const [cx, cy] = tileCenter(p.col, p.row);
    const town = p.kind === 'town' ? state.towns[p.id] : undefined;
    const sprite = spriteFor(state, p.id, p.kind);
    if (sprite) places += use(sprite, town?.owner ?? 'neutral', cx, cy + 6);
    labels += `<text x="${cx}" y="${cy + 15}" class="${p.kind === 'town' ? 'place-label' : 'place-label landmark'}">${esc(p.name)}</text>`;
  }

  let armies = '';
  const byHex = new Map<string, Army[]>();
  for (const a of state.armies) byHex.set(a.at, [...(byHex.get(a.at) ?? []), a]);
  for (const [key, list] of byHex) {
    const { centre: [cx, cy] } = cell(key);
    list.forEach((a, i) => {
      const x = cx + 6 + i * 7;
      armies += `<g class="map-army"><title>${esc(armyTitle(a))}</title>${use('banner', a.owner, x + 3, cy - 1)}
        <text x="${x + 6}" y="${cy - 3}" class="army-count">${a.troops.length}</text></g>`;
    });
  }

  let hits = '';
  world.rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const key = `${col},${row}`;
      const land = hexLand(world, key);
      const step = targets.get(key);
      const road = hasRoad(state, key) ? ' Road: 1 to enter.' : '';
      const months = arrivals.get(key);
      const reachNote = step ? ` Reachable this month: ${step.cost} movement.`
        : months ? ` About ${months} months away for the ticked troops.` : '';
      const here = (byHex.get(key) ?? []).map((a) => ` ${armyTitle(a)}.`).join('');
      hits += `<polygon points="${tilePolygon(col, row)}" class="cell" data-action="node" data-node="${key}"><title>${esc(`${locationName(state, key)}. ${land.name}.${road}${reachNote}${here}`)}</title></polygon>`;
    }
  });

  const image = terrainImage(world);
  return `<svg viewBox="0 0 ${width} ${height}" class="map overland" role="img" aria-label="Overland map">
    ${symbolDefs()}
    ${image ? `<image href="${image}" x="0" y="0" width="${width}" height="${height}" class="terrain"/>` : ''}
    ${reach}${selection}${places}${armies}${labels}${hits}
  </svg>`;
}
