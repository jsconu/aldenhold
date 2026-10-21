import { richOverland, richSettlement } from './richOverland';
import { SPECIES } from '../content/lairs';
import { hiddenLairAt, lairAt, lairGarrison } from '../game/lairs';
import { relationWith, RELATION_LABEL } from '../game/diplomacy';
import { FACTIONS } from '../content/factions';
import type { Army, FactionId, GameState, HexWorld } from '../game/types';
import { arrivalOutcome, nodeName } from '../game/campaign';
import { hasRoad, hexLand, locationName, parseKey, type MarchStep } from '../game/world';
import { pixelRects } from './pixelSprites';
import { WESTERN_PLACE_ART } from './settlementSprites';
import { mapPixelSize, paintTerrain, tileCenter, tilePolygon } from './pixelTiles';
import { esc, type UIState } from './shared';

/**
 * The hex overland map: a pixel-art terrain bitmap (painted once per world) under an SVG layer for towns,
 * landmarks, armies, labels, highlights and clicks. SVG units are the bitmap's native pixels.
 */

const OWNER_COLOUR = Object.fromEntries(Object.values(FACTIONS).map((f) => [f.id, f.colour])) as Record<FactionId, string>;

const MAP_PALETTE: Record<string, string> = {
  k: '#10100c', w: '#ffffff', g: '#c8c0a8', G: '#8a8270', s: '#b0a890', S: '#5a5048', b: '#6a4a20', B: '#2a1a10',
  y: '#ffff55', R: '#c83c28', r: '#ff7a3c', H: '#6a8a3a', c: '#55ffff',
  L: '#718fa3', o: '#d9bc77', v: '#377b56',
};

/** Map sprites for towns and landmarks, same character scheme as the unit sprites. 'F' is the owner's colour. */
export const PLACE_SPRITES: Record<string, string[]> = {
  ...WESTERN_PLACE_ART,
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
  if (PLACE_SPRITES[placeId]) return placeId;
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

/**
 * Ownership banners. Each kind has its own shape and glyph, so ownership reads in greyscale and doesn't rely on
 * colour alone: a crowned, gold-bordered banner for yours; crossed swords for the enemy; a plain banner for a
 * free town; a skull for a monster lair.
 */
export type BannerKind = 'player' | 'enemy' | 'free' | 'lair' | 'cleared';

export const BANNER_LABEL: Record<BannerKind, string> = {
  player: 'Yours', enemy: 'Enemy-held', free: 'Free town', lair: 'Monster lair', cleared: 'Cleared lair',
};

const BANNER_ART: Record<BannerKind, string> = {
  player: `<rect x="2" y="0.5" width="9" height="7" fill="#2f4fc8" stroke="#ffd84a" stroke-width="1.3"/>
    <path d="M3.8 5.6V2.6L5.3 4 6.5 2 7.7 4 9.2 2.6V5.6Z" fill="#ffd84a"/>`,
  enemy: `<rect x="2" y="0.5" width="9" height="7" fill="#a51e1e" stroke="#1a0606" stroke-width="1"/>
    <path d="M3.6 1.8 9.4 6.2M9.4 1.8 3.6 6.2" stroke="#f4ece0" stroke-width="1.2"/>`,
  free: `<rect x="2" y="0.5" width="9" height="7" fill="#e9dfb8" stroke="#4a4535" stroke-width="0.8"/>`,
  lair: `<rect x="2" y="0.5" width="9" height="7" fill="#262626" stroke="#0a0a0a" stroke-width="0.8"/>
    <circle cx="6.5" cy="3.6" r="2.4" fill="#ece7d8"/><rect x="5.2" y="5.2" width="2.6" height="1.6" fill="#ece7d8"/>
    <circle cx="5.6" cy="3.5" r="0.6" fill="#111"/><circle cx="7.4" cy="3.5" r="0.6" fill="#111"/>`,
  cleared: `<rect x="2" y="0.5" width="9" height="7" fill="#7a7466" stroke="#2a2620" stroke-width="0.8"/>
    <path d="M3.4 6.6 9.6 1.4" stroke="#e8e2d0" stroke-width="1.3"/>`,
};

function bannerDefs(): string {
  return (Object.keys(BANNER_ART) as BannerKind[]).map((k) => `<symbol id="owner-banner-${k}" viewBox="0 0 12 13">
    <path d="M1.4 0.2V12.8" stroke="#2a2217" stroke-width="1"/>${BANNER_ART[k]}</symbol>`).join('');
}

/** Which banner a settlement flies: a lair is always a lair; otherwise its owner decides. */
export function bannerFor(state: GameState, townId: string): BannerKind {
  const town = state.towns[townId];
  if (!town || town.kind === 'lair') return 'lair';
  return town.owner === 'player' ? 'player' : town.owner === 'neutral' ? 'free' : 'enemy';
}

/** The banner as an SVG fragment, for the map and its legend. */
export function bannerSvg(kind: BannerKind, x: number, y: number, size = 12): string {
  return `<use href="#owner-banner-${kind}" x="${x}" y="${y}" width="${size}" height="${size * 13 / 12}" class="owner-banner banner-${kind}"/>`;
}

/** A settlement's tooltip: name, owner (and relation), and who garrisons it. */
function settlementTitle(state: GameState, townId: string, at: string): string {
  const town = state.towns[townId];
  const relation = relationWith(state, townId);
  const owner = BANNER_LABEL[bannerFor(state, townId)] + (relation && relation !== 'self' && town?.owner === 'neutral' ? ` (${RELATION_LABEL[relation].toLowerCase()})` : '');
  const garrison = state.armies.filter((a) => a.at === at).map((a) => armyTitle(a)).join('; ');
  return `${nodeName(state, at)}: ${owner}. ${garrison ? `Garrison: ${garrison}.` : 'No garrison.'}`;
}

function use(name: string, owner: FactionId, cx: number, bottom: number): string {
  const rows = PLACE_SPRITES[name];
  const w = rows[0].length;
  const h = rows.length;
  return `<use href="#map-${name}-${owner}" x="${cx - w / 2}" y="${bottom - h}" width="${w}" height="${h}" class="map-place-sprite"/>`;
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
  const who = a.owner === 'player' ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : a.owner === 'neutral' ? 'Town militia' : FACTIONS[a.owner].name;
  return `${who}: ${a.troops.length} ${a.troops.length === 1 ? 'troop' : 'troops'}, ${men} men`;
}

/** Map zoom steps: screen pixels per map pixel. A hex is 24 map pixels wide. */
export const HEX_ZOOMS = [1, 1.5, 2, 2.5, 3] as const;
export const DEFAULT_HEX_ZOOM = 2;

export function hexZoom(ui: UIState): number {
  return HEX_ZOOMS.includes(ui.hexZoom as (typeof HEX_ZOOMS)[number]) ? ui.hexZoom! : DEFAULT_HEX_ZOOM;
}

export function renderHexMap(
  state: GameState, ui: UIState, world: HexWorld, targets: Map<string, MarchStep>, arrivals: Map<string, number> = new Map(),
): string {
  const { width, height } = mapPixelSize(world);
  const cell = (key: string) => {
    const { col, row } = parseKey(key);
    return { col, row, centre: tileCenter(col, row) };
  };

  // Glowing positions indicate legal moves. The invisible hit polygons still use exact hex rules.
  let reach = '';
  for (const [key] of targets) {
    const { col, row } = cell(key);
    // A hidden lair doesn't give itself away as a fight on arrival.
    const ends = arrivalOutcome(state, key) !== null && !hiddenLairAt(state, key);
    const [cx, cy] = tileCenter(col, row);
    reach += `<ellipse cx="${cx}" cy="${cy}" rx="11" ry="9" class="reach${ends ? ' ends' : ''}"/>`;
  }
  const sel = ui.selected && /^\d+,\d+$/.test(ui.selected) ? cell(ui.selected) : null;
  const selection = sel ? `<ellipse cx="${sel.centre[0]}" cy="${sel.centre[1]}" rx="11" ry="9" class="selected"/>` : '';

  let places = '';
  let labels = '';
  for (const p of world.places) {
    const [cx, cy] = tileCenter(p.col, p.row);
    const town = p.kind === 'town' ? state.towns[p.id] : undefined;
    const sprite = spriteFor(state, p.id, p.kind);
    if (town) places += richSettlement(town.kind, ['forest','deepwood'].includes(hexLand(world, p.col+','+p.row).id), cx, cy);
    else if (sprite) places += use(sprite, 'neutral', cx, cy + 6);
    if (town) {
      const top = cy + 6 - (sprite ? PLACE_SPRITES[sprite].length : 12);
      const half = sprite ? PLACE_SPRITES[sprite][0].length / 2 : 6;
      const raid = state.raids.find((r) => r.target === p.id);
      places += `<g class="settlement-owner"><title>${esc(settlementTitle(state, p.id, `${p.col},${p.row}`) + (raid ? ' Raid expected next month!' : ''))}</title>${bannerSvg(bannerFor(state, p.id), cx + half - 9, top - 18, 20)}${raid ? `<text x="${cx + half + 8}" y="${top - 6}" class="raid-alert">!</text>` : ''}</g>`;
    }
    const lair = lairAt(state, `${p.col},${p.row}`);
    if (lair) {
      // A lair shows only once found: a skull banner, or a struck-through one when cleared.
      const st = state.lairs[lair.id];
      if (!st?.discovered) continue;
      const garrison = lairGarrison(state, lair);
      const title = `${lair.name}: ${SPECIES[lair.species].name.toLowerCase()} lair, tier ${lair.tier}. ${st.status === 'cleared' ? 'Cleared.' : `Active. ${garrison ? `Garrison: ${armyTitle(garrison)}.` : ''}`}`;
      places += `<g class="settlement-owner lair-marker"><title>${esc(title)}</title>${bannerSvg(st.status === 'cleared' ? 'cleared' : 'lair', cx - 9, cy - 18, 20)}</g>`;
    }
    labels += `<text x="${cx}" y="${cy + 15}" class="${p.kind === 'town' ? 'place-label' : 'place-label landmark'}">${esc(p.name)}</text>`;
  }

  let armies = '';
  const byHex = new Map<string, Army[]>();
  // Monsters in a lair nobody has found stay hidden.
  for (const a of state.armies) if (!hiddenLairAt(state, a.at)) byHex.set(a.at, [...(byHex.get(a.at) ?? []), a]);
  // Armies sit on their own hex: centred, or nudged down-right of a settlement they share it with, so clicking
  // the banner always picks the hex it stands on.
  const placed = new Set(world.places.map((p) => `${p.col},${p.row}`));
  for (const [key, list] of byHex) {
    const { centre: [cx, cy] } = cell(key);
    const shared = placed.has(key);
    list.forEach((a, i) => {
      const hx = cx + (shared ? 5 : 0) - (list.length - 1) * 3.5 + i * 7;
      const hy = cy + (shared ? 3 : 0);
      armies += `<g class="map-army owner-${a.owner}"><title>${esc(armyTitle(a))}</title>
        <ellipse cx="${hx}" cy="${hy}" rx="9" ry="7.5" class="army-halo"/>${use('banner', a.owner, hx - 3, hy + 4)}
        <text x="${hx}" y="${hy + 2}" class="army-count">${a.troops.length}</text></g>`;
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
  const zoom = hexZoom(ui);
  return `<svg viewBox="0 0 ${width} ${height}" width="${Math.round(width * zoom)}" height="${Math.round(height * zoom)}" class="map overland" role="img" aria-label="Overland map">
    ${symbolDefs()}<defs>${bannerDefs()}
      <radialGradient id="overland-march-glow"><stop offset="0" stop-color="#f3e2a2" stop-opacity=".6"/>
        <stop offset="1" stop-color="#f3e2a2" stop-opacity="0"/></radialGradient>
      <radialGradient id="overland-danger-glow"><stop offset="0" stop-color="#e89270" stop-opacity=".75"/>
        <stop offset="1" stop-color="#e89270" stop-opacity="0"/></radialGradient>
    </defs>
    ${image ? `<image href="${image}" x="0" y="0" width="${width}" height="${height}" class="terrain"/>` : ''}
    ${richOverland(world)}${reach}${selection}${places}${armies}${labels}${hits}
  </svg>`;
}
