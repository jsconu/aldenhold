import type { GameState, MapNode, FactionId } from '../game/types';
import type { UIState } from './shared';
import { esc } from './shared';

/**
 * Pure, reproducible overland atlas for the save-compatible quick-play valley.
 * This is an illustrated landscape under the REAL node-and-road travel graph.
 * Hexes are geographic context, not independently movable cells yet.
 */
export type OverlandTerrain = 'grass' | 'farmland' | 'forest' | 'hills' | 'mountains' | 'wetlands' | 'river' | 'scrub';
export interface AtlasTile { col: number; row: number; x: number; y: number; terrain: OverlandTerrain }
export const ATLAS_WIDTH = 840;
export const ATLAS_HEIGHT = 500;
export const ATLAS_COLS = 43;
export const ATLAS_ROWS = 22;
const R = 13;
const STEP_Y = Math.sqrt(3) * R;
const TERRAINS: ReadonlySet<string> = new Set(['grass', 'farmland', 'forest', 'hills', 'mountains', 'wetlands', 'river', 'scrub']);

function hash(a: number, b: number): number {
  // Signed-safe integer hash; avoid random() so rerender and save/load are identical.
  let x = Math.imul(a + 1087, 374761393) ^ Math.imul(b + 421, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function within(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}
function segmentDistance(x: number, y: number, a: MapNode, b: MapNode): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy)));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}

/**
 * Original, authored large-scale terrain zones with small deterministic irregularities.
 * Roads carve visible corridors across rivers and mountains, so artwork never implies
 * that an existing graph connection is blocked.
 */
export function atlasTiles(state: Pick<GameState, 'nodes' | 'edges'>): AtlasTile[] {
  const nodes = new Map(state.nodes.map((n) => [n.id, n]));
  const routes = state.edges.map(([a, b]) => [nodes.get(a), nodes.get(b)] as const)
    .filter((pair): pair is readonly [MapNode, MapNode] => !!pair[0] && !!pair[1]);
  const tiles: AtlasTile[] = [];
  for (let col = 0; col < ATLAS_COLS; col++) {
    for (let row = 0; row < ATLAS_ROWS; row++) {
      const x = R + col * 1.5 * R;
      const y = R + STEP_Y * (row + (col & 1) * 0.5);
      const n = hash(col, row);
      const n2 = hash(col + 77, row + 8);
      // Central mountain spine, a northern wooded belt, irrigated western
      // farmlands, and the Duskwater southern marsh.
      const ridgeX = 628 + 25 * Math.sin(y / 76);
      const riverX = 357 + 23 * Math.sin((y + 12) / 62);
      let terrain: OverlandTerrain = 'grass';
      if (Math.abs(x - riverX) < 9 + n * 6 && y > 50 && y < 470) terrain = 'river';
      else if (Math.abs(x - ridgeX) < 37 + 13 * n && (y < 194 || y > 315)) terrain = 'mountains';
      else if (Math.abs(x - ridgeX) < 84 + 19 * n) terrain = 'hills';
      else if (within(x, y, 507, 425, 145, 110) < 1.1 && n > 0.22) terrain = 'wetlands';
      else if (within(x, y, 220, 85, 185, 128) < 1.1 && n > 0.22) terrain = 'forest';
      else if (within(x, y, 464, 280, 108, 116) < 1 && n > 0.35) terrain = 'forest';
      else if (within(x, y, 205, 315, 206, 167) < 1 && n > 0.17) terrain = 'farmland';
      else if (x > 680 && n > 0.6) terrain = 'scrub';
      else if (n2 > 0.84) terrain = 'forest';
      else if (n > 0.74) terrain = 'hills';
      // The travel graph remains authoritative. Represent open passes rather
      // than painting an impassable hex over an actual route.
      if ((terrain === 'mountains' || terrain === 'river') &&
        routes.some(([a, b]) => segmentDistance(x, y, a, b) < 14)) {
        terrain = terrain === 'river' ? 'farmland' : 'hills';
      }
      tiles.push({ col, row, x, y, terrain });
    }
  }
  return tiles;
}
function hexPoints(x: number, y: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 3;
    return `${(x + R * Math.cos(angle)).toFixed(1)},${(y + R * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}
function routePath(a: MapNode, b: MapNode): string {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  // A slight elbow, not a bare straight graph edge, while retaining a clear route.
  const twist = (hash(a.x + b.x, a.y + b.y) - 0.5) * 22;
  const mx = (a.x + b.x) / 2 - dy / d * twist;
  const my = (a.y + b.y) / 2 + dx / d * twist;
  return `M${a.x},${a.y} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x},${b.y}`;
}
function atlasDefs(): string {
  return `<defs>
    <clipPath id="atlas-clip"><rect x="3" y="3" width="834" height="494" rx="9"/></clipPath>
    <filter id="atlas-landscape-soften" x="-3%" y="-3%" width="106%" height="106%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <pattern id="atlas-grain" width="43" height="43" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="8" r="0.8" fill="#e5d4a0" opacity=".15"/>
      <path d="M17 27l3 -2 M35 9l2 2 M7 37l3 1" stroke="#271f16" stroke-width=".8" opacity=".24"/>
    </pattern>
    <radialGradient id="own-glow-player"><stop stop-color="#5194d2" stop-opacity=".45"/><stop offset="1" stop-color="#5194d2" stop-opacity="0"/></radialGradient>
    <radialGradient id="own-glow-orcs"><stop stop-color="#bd5345" stop-opacity=".5"/><stop offset="1" stop-color="#bd5345" stop-opacity="0"/></radialGradient>
    <radialGradient id="own-glow-neutral"><stop stop-color="#c3a778" stop-opacity=".28"/><stop offset="1" stop-color="#c3a778" stop-opacity="0"/></radialGradient>
    <symbol id="atlas-forest" viewBox="0 0 26 26">
      <path d="M4 19 9 8 14 19z M11 21 17 5 23 21z" fill="#203f2e" stroke="#152c22" stroke-width="1.2"/>
      <path d="M9 18v5 M17 19v5" stroke="#755936" stroke-width="1.5"/>
      <path d="m6 15h6 m2 0h6" stroke="#4a7050" stroke-width="1" opacity=".7"/>
    </symbol>
    <symbol id="atlas-mountains" viewBox="0 0 26 26">
      <path d="M1 23 11 4l7 11 4-5 5 13z" fill="#7d8279" stroke="#45483f" stroke-width="1.2"/>
      <path d="m8 10 3-6 4 6-3-2-2 4z m10 4 4-4 2 5-2-1-2 2z" fill="#d7d7c2"/>
      <path d="m12 16 2-4 3 6" fill="none" stroke="#596159" stroke-width="1"/>
    </symbol>
    <symbol id="atlas-hills" viewBox="0 0 26 26">
      <path d="M2 21Q8 7 15 18q5-10 10 3" fill="#727d49" stroke="#4a5839" stroke-width="1.5"/>
      <path d="m5 21 3-5 3 4 M18 19l3-3" stroke="#b8b98b" stroke-width="1" fill="none"/>
    </symbol>
    <symbol id="atlas-farmland" viewBox="0 0 26 26">
      <path d="M3 22 Q13 13 23 21 M3 17 Q13 8 23 16 M4 12 Q14 4 22 10" fill="none" stroke="#dbc078" stroke-width="1.5"/>
      <path d="m6 18-1-4 m6 7-1-5 m8 4-1-5" stroke="#8f9f57" stroke-width="1.2"/>
    </symbol>
    <symbol id="atlas-wetlands" viewBox="0 0 26 26">
      <path d="M2 19Q9 16 14 19T25 19 M3 23Q12 21 23 23" fill="none" stroke="#72979c" stroke-width="1.5"/>
      <path d="M7 18 5 8m2 10 4-8 M19 19l-1-12" stroke="#8f9d68" stroke-width="1.5"/>
    </symbol>
    <symbol id="atlas-river" viewBox="0 0 26 26">
      <path d="M2 7q7 5 14 0t11 0 M-1 15q10 6 18 0t12-1 M1 23q8 5 15 0t11 0"
        stroke="#a7c5b5" stroke-width="1.3" fill="none" opacity=".9"/>
    </symbol>
    <symbol id="atlas-scrub" viewBox="0 0 26 26">
      <path d="m4 22 3-11 4 8 M12 23l2-6 2 5 M21 22l-2-10" fill="none" stroke="#9da06b" stroke-width="1.5"/>
      <circle cx="18" cy="10" r="2" fill="#baa474"/>
    </symbol>
    <symbol id="atlas-capital" viewBox="0 0 34 36">
      <path d="M4 28V12h5V6h6v6h4V6h6v6h5v16z" fill="#e5d0a0" stroke="#292622" stroke-width="2"/>
      <path d="M12 28v-9h10v9 M4 17h26" fill="#705b45" stroke="#514334" stroke-width="2"/>
      <path d="M17 6V1" stroke="#ecd18c" stroke-width="2"/><path d="M17 1h11l-3 4 3 3H17z" fill="#f2ca6d"/>
    </symbol>
    <symbol id="atlas-town" viewBox="0 0 34 36">
      <path d="M3 27V16l7-7 7 6 6-8 8 9v11z" fill="#c8b596" stroke="#30271e" stroke-width="2"/>
      <path d="M1 17 10 7l8 8 M17 16l6-10 9 10" fill="none" stroke="#884f41" stroke-width="3"/>
      <path d="M13 27v-8h6v8 M25 22h4" stroke="#523e32" stroke-width="2" fill="#715646"/>
    </symbol>
    <symbol id="atlas-lair" viewBox="0 0 34 36">
      <path d="M5 31V9h6V3h5v6h4V2h6v7h4v22z" fill="#4a4240" stroke="#171817" stroke-width="2"/>
      <path d="M12 17h5v5h-5z M22 17h4v5h-4z" fill="#cf6748"/>
      <path d="M15 31v-6q2-5 5 0v6" fill="#171817"/>
    </symbol>
    <symbol id="atlas-bridge" viewBox="0 0 34 36">
      <path d="M1 22q15-17 32 0v4H1z" fill="#b6a084" stroke="#3b332d" stroke-width="2"/>
      <path d="M10 26v-5m14 5v-5 M4 18h26" stroke="#5c4a3a" stroke-width="2"/>
      <path d="M0 31q6-3 12 0t12 0t10 0" fill="none" stroke="#88aeb4" stroke-width="2"/>
    </symbol>
    <symbol id="atlas-pass" viewBox="0 0 34 36">
      <path d="M1 31 11 5l7 17 7-13 8 22z" fill="#777b74" stroke="#343b38" stroke-width="2"/>
      <path d="M12 31 18 22 23 31" fill="#d3b980"/>
      <path d="m8 12 3-7 4 9-4-3z" fill="#d3d1b9"/>
    </symbol>
    <symbol id="atlas-watchtower" viewBox="0 0 34 36">
      <path d="M8 31V10h4V5h4v5h4V5h4v5h3v21z" fill="#b8aa91" stroke="#2f2f2c" stroke-width="2"/>
      <path d="M14 18h6v7h-6z" fill="#4d5b5e"/><path d="M5 31h24" stroke="#35322c" stroke-width="3"/>
    </symbol>
    <symbol id="atlas-waypoint" viewBox="0 0 34 36">
      <path d="M16 28V11M12 14l4-7 4 7 M9 29h14" stroke="#d9bc86" stroke-width="3" fill="none"/>
      <circle cx="16" cy="9" r="3" fill="#e9cf93"/>
    </symbol>
  </defs>`;
}
function routeArtwork(state: GameState, selected: string | null, targets: string[], planned: readonly string[]): string {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  return state.edges.map(([from, to]) => {
    const a = byId.get(from), b = byId.get(to);
    if (!a || !b) return '';
    const active = (selected === from && targets.includes(to)) || (selected === to && targets.includes(from));
    const plannedSegment = planned.some((id, index) => index > 0 &&
      ((planned[index - 1] === from && id === to) || (planned[index - 1] === to && id === from)));
    const d = routePath(a, b);
    return `<g class="atlas-route${active ? ' atlas-route-active' : ''}${plannedSegment ? ' atlas-route-planned' : ''}" data-route="${esc(from)}:${esc(to)}">
      <path d="${d}" class="atlas-road-shadow"/>
      <path d="${d}" class="atlas-road-surface"/>
    </g>`;
  }).join('');
}
const MARKERS: Record<string, string> = { bridge: 'bridge', pass: 'pass', watchtower: 'watchtower' };
function mapSite(state: GameState, node: MapNode, selected: string | null, targets: string[], planned: readonly string[]): string {
  const town = state.towns[node.id];
  const owner: FactionId = town?.owner ?? 'neutral';
  const icon = town ? (town.kind === 'capital' ? 'capital' : town.kind === 'lair' ? 'lair' : 'town') :
    (MARKERS[node.id] ?? 'waypoint');
  const selectedSite = selected === node.id;
  const stopIndex = planned.indexOf(node.id);
  const canMarch = targets.includes(node.id);
  const armies = state.armies.filter((a) => a.at === node.id);
  const armyCount = armies.reduce((sum, army) => sum + army.troops.length, 0);
  const size = town ? 34 : 30;
  const markerX = node.x - size / 2, markerY = node.y - 22;
  // Clearly separated symbol, name plate, and garrison badge. All real controls are at locations.
  const labelW = Math.min(145, Math.max(74, node.name.length * 7 + 20));
  const labelX = Math.min(ATLAS_WIDTH - labelW - 7, Math.max(7, node.x - labelW / 2));
  const labelY = Math.min(ATLAS_HEIGHT - 26, node.y + 18);
  return `<g class="atlas-site atlas-owner-${owner}${selectedSite ? ' is-selected' : ''}${canMarch ? ' can-march' : ''}"
      data-action="node" data-node="${esc(node.id)}" tabindex="0" role="button"
      aria-label="${esc(node.name)}: ${town ? esc(owner) : 'landmark'}, ${armyCount} units"
      aria-pressed="${selectedSite ? 'true' : 'false'}">
      <title>${esc(node.name)} — ${town ? esc(owner) : 'landmark'}.
      ${canMarch ? 'Selected troops can march here this month.' : 'Select this location.'}
      ${armyCount ? `${armyCount} units present.` : ''}</title>
      <circle cx="${node.x}" cy="${node.y}" r="29" class="atlas-site-hit"/>
      <circle cx="${node.x}" cy="${node.y}" r="24" class="atlas-site-aura"/>
      ${canMarch ? `<circle cx="${node.x}" cy="${node.y}" r="28" class="atlas-march-ring"/>` : ''}
      <use href="#atlas-${icon}" x="${markerX}" y="${markerY}" width="${size}" height="36" class="atlas-site-art"/>
      <rect x="${labelX}" y="${labelY}" width="${labelW}" height="24" rx="5" class="atlas-nameplate"/>
      <text x="${labelX + labelW / 2}" y="${labelY + 16}" class="atlas-site-name">${esc(node.name)}</text>
      ${stopIndex >= 0 ? `<g class="atlas-route-number" transform="translate(${node.x - 18},${node.y - 22})">
        <circle r="9"/><text dy="4">${stopIndex + 1}</text></g>` : ''}
      ${armyCount ? `<g class="atlas-army-badge" transform="translate(${node.x + 17},${node.y - 24})">
        <circle r="10" class="atlas-army-disk"/>
        <text dy="4">${armyCount}</text></g>` : ''}
    </g>`;
}
function mapViewBox(state: GameState, ui: UIState): string {
  const zoom = Math.min(2, Math.max(1, ui.mapZoom ?? 1));
  const w = ATLAS_WIDTH / zoom, h = ATLAS_HEIGHT / zoom;
  const focus = state.nodes.find((n) => n.id === ui.selected) ?? state.nodes[0] ?? { x: 420, y: 250 };
  const x = Math.min(ATLAS_WIDTH - w, Math.max(0, focus.x - w / 2));
  const y = Math.min(ATLAS_HEIGHT - h, Math.max(0, focus.y - h / 2));
  return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}
export function renderOverland(state: GameState, ui: UIState, targets: string[], planned: readonly string[] = []): string {
  const tiles = atlasTiles(state);
  const mode = ui.mapLayer === 'political' ? 'political' : 'terrain';
  const grid = tiles.map(({ col, row, x, y, terrain }) =>
    `<g class="atlas-tile biome-${terrain}" data-tile="${col}:${row}">
      <polygon points="${hexPoints(x, y)}" class="atlas-ground"/></g>`).join('');
  // Terrain stamps stay sharp while the underlying land colours blend into continuous regions.
  const motifs = tiles.map(({ col, row, x, y, terrain }) => {
    if (terrain === 'grass' || (hash(col + 67, row - 19) < 0.22 && terrain !== 'river')) return '';
    const turn = Math.floor(hash(col + 9, row + 13) * 4) * 90;
    const scale = 0.81 + hash(col - 13, row + 23) * 0.27;
    return `<use href="#atlas-${terrain}" x="-13" y="-13" width="26" height="26"
      transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn}) scale(${scale.toFixed(2)})"
      class="atlas-feature"/>`;
  }).join('');
  const river = Array.from({ length: 27 }, (_, i) => {
    const y = i * 20;
    return `${i ? 'L' : 'M'}${(357 + 23 * Math.sin((y + 12) / 62)).toFixed(1)} ${y}`;
  }).join(' ');
  const politics = state.nodes.filter((n) => state.towns[n.id]).map((n) => {
    const town = state.towns[n.id];
    return `<circle cx="${n.x}" cy="${n.y}" r="100" fill="url(#own-glow-${town.owner})"/>`;
  }).join('');
  const roads = routeArtwork(state, ui.selected, targets, planned);
  const locations = state.nodes.map((n) => mapSite(state, n, ui.selected, targets, planned)).join('');
  return `<svg viewBox="${mapViewBox(state, ui)}" class="map overland-map layer-${mode}"
    role="group" aria-label="Illustrated province map, towns and travel routes">
    ${atlasDefs()}
    <g clip-path="url(#atlas-clip)">
      <rect width="840" height="500" fill="#52664b"/>
      <g class="atlas-terrain" filter="url(#atlas-landscape-soften)">${grid}</g>
      <g class="atlas-watercourse" pointer-events="none">
        <path d="${river}" class="atlas-river-bank"/>
        <path d="${river}" class="atlas-river-water"/>
        <path d="${river}" class="atlas-river-sheen"/>
      </g>
      <g class="atlas-terrain-details" pointer-events="none">${motifs}</g>
      <rect width="840" height="500" fill="url(#atlas-grain)" pointer-events="none"/>
      <g class="atlas-political-fields" pointer-events="none">${politics}</g>
      <g class="atlas-roads" pointer-events="none">${roads}</g>
      <g class="atlas-geography-labels" pointer-events="none">
        <text x="65" y="49">THE WESTERN VALE</text>
        <text x="680" y="80">GREY SPINE</text>
        <text x="440" y="477">DUSKWATER FEN</text>
      </g>
      ${locations}
      <g class="atlas-compass" transform="translate(795 60)" pointer-events="none">
        <circle r="25"/><path d="M0-21 6 0 0 21 -6 0z M-21 0 0-6 21 0 0 6z"/>
        <text x="0" y="-30">N</text>
      </g>
    </g>
    <rect x="3" y="3" width="834" height="494" rx="9" class="atlas-border" pointer-events="none"/>
  </svg>`;
}
export function overlandTerrainNames(): ReadonlyArray<OverlandTerrain> {
  return [...TERRAINS].sort() as OverlandTerrain[];
}
