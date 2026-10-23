import { LAIRS } from '../content/lairs';
import { getCampaign } from '../content';
import { LAND, UNIT_TYPES } from '../content/rules';
import { hexDistance, hexKey, hexNeighbors, type Hex } from './hex';
import type { Army, CampaignDefinition, FactionId, GameState, HexWorld, Land, LandType, MapNode, Place, Town, Troop } from './types';

/**
 * The only module that knows how a campaign's world is laid out. Rules ask it about locations; a location is a
 * node id on the valley's graph and a hex key ("col,row") on a hex map. On hex maps town ids are place ids.
 */

export interface GraphView {
  kind: 'graph';
  nodes: MapNode[];
  edges: [string, string][];
}
export type HexView = HexWorld & { kind: 'hex' };
type WorldView = GraphView | HexView;

const views = new WeakMap<CampaignDefinition, WorldView>();

/** A tagged view of the campaign's world, built once per campaign so caches keyed on it stay valid. */
export function worldOf(state: Pick<GameState, 'campaignId'>): WorldView {
  const def = getCampaign(state.campaignId);
  let view = views.get(def);
  if (!view) {
    view = def.hex ? { kind: 'hex', ...def.hex } : { kind: 'graph', nodes: def.nodes, edges: def.edges };
    views.set(def, view);
  }
  return view;
}

// ---------- Hex helpers ----------

export function parseKey(key: string): Hex {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}

function hexSize(world: HexWorld) {
  return { width: world.rows[0].length, height: world.rows.length };
}

const LAND_BY_CHAR = new Map(Object.values(LAND).map((l) => [l.char, l]));
const placeIndexes = new WeakMap<HexWorld, Map<string, Place>>();
const movementCosts = new WeakMap<HexWorld, Map<string, number>>();
const locationNames = new WeakMap<HexWorld, Map<string, Map<string, string>>>();

export function hexLand(world: HexWorld, key: string): LandType {
  const { col, row } = parseKey(key);
  return LAND_BY_CHAR.get(world.rows[row]?.[col] ?? '') ?? LAND.plains;
}

function inHexMap(world: HexWorld, h: Hex): boolean {
  const { width, height } = hexSize(world);
  return Number.isInteger(h.col) && Number.isInteger(h.row) && h.col >= 0 && h.row >= 0 && h.col < width && h.row < height;
}

export function placeKey(p: Pick<Place, 'col' | 'row'>): string {
  return hexKey(p);
}

const roadCache = new WeakMap<HexWorld, { roads: string[][]; set: Set<string> }>();

/** Roads laid along the easiest ground between each route's places. Water is bridged; mountains are not. */
export function roadsOf(world: HexWorld): string[][] {
  let cached = roadCache.get(world);
  if (!cached) {
    const roads = buildRoads(world);
    cached = { roads, set: new Set(roads.flat()) };
    roadCache.set(world, cached);
  }
  return cached.roads;
}

function roadSet(world: HexWorld): Set<string> {
  roadsOf(world);
  return roadCache.get(world)!.set;
}

function buildRoads(world: HexWorld): string[][] {
  const cost: Record<Land, number> = { plains: 1, farmland: 1, forest: 2, deepwood: 3, hills: 2, swamp: 3, badlands: 2, water: 5, mountains: Infinity };
  const at = (id: string) => placeKey(world.places.find((p) => p.id === id)!);
  return world.routes.map((route) => {
    const road = [at(route[0])];
    for (let i = 1; i < route.length; i++) {
      const steps = cheapest(world, at(route[i - 1]), (k) => cost[hexLand(world, k).id], Infinity, () => false, undefined, at(route[i]));
      road.push(...pathTo(steps, at(route[i])));
    }
    return road;
  });
}

// ---------- Questions the rules ask ----------

export function isLocation(state: GameState, at: string): boolean {
  const world = worldOf(state);
  if (world.kind === 'graph') return world.nodes.some((n) => n.id === at);
  return /^\d+,\d+$/.test(at) && inHexMap(world, parseKey(at));
}

export function placeAt(state: GameState, at: string): Place | undefined {
  const world = worldOf(state);
  if (world.kind !== 'hex') return undefined;
  let index = placeIndexes.get(world);
  if (!index) { index = new Map(world.places.map(p => [placeKey(p), p])); placeIndexes.set(world, index); }
  return index.get(at);
}

/** Where a town stands. */
export function townLocation(state: GameState, townId: string): string {
  const world = worldOf(state);
  if (world.kind === 'graph') return townId;
  const place = world.places.find((p) => p.id === townId);
  if (!place) throw new Error(`No place for town ${townId}`);
  return placeKey(place);
}

/** The town at a location, if any. */
export function townAt(state: GameState, at: string): Town | undefined {
  const world = worldOf(state);
  if (world.kind === 'graph') return state.towns[at];
  const place = placeAt(state, at);
  return place?.kind === 'town' ? state.towns[place.id] : undefined;
}

/** A readable name for a location, a town id or a place id. */
/** A lair nobody has found yet: its place isn't named anywhere the player can see. */
function hiddenLairPlace(state: GameState, placeId: string): boolean {
  const lair = Object.values(LAIRS).find((l) => l.campaignId === state.campaignId && l.place === placeId);
  return !!lair && !state.lairs?.[lair.id]?.discovered;
}

export function locationName(state: GameState, at: string): string {
  const world = worldOf(state);
  if (world.kind === 'graph') return world.nodes.find((n) => n.id === at)?.name ?? at;
  const named = at.includes(',') ? placeAt(state, at) : world.places.find(p => p.id === at);
  if (named && !hiddenLairPlace(state, named.id)) return named.name;
  if (!isLocation(state, at)) return at;
  const discovery = Object.keys(state.lairs ?? {}).filter(id => state.lairs[id].discovered).join(',');
  let versions = locationNames.get(world);
  if (!versions) { versions = new Map(); locationNames.set(world, versions); }
  let names = versions.get(discovery);
  if (!names) { names = new Map(); versions.set(discovery, names); }
  const saved = names.get(at); if (saved) return saved;
  const h = parseKey(at);
  let nearest: Place | undefined, distance = Infinity;
  for (const place of world.places) {
    if (hiddenLairPlace(state, place.id)) continue;
    const d = hexDistance(h, place);
    if (d < distance) { nearest = place; distance = d; }
  }
  const name = `the ${hexLand(world, at).name.toLowerCase()} near ${nearest!.name}`;
  names.set(at, name); return name;
}

/** The land a battle at this location is fought on. The quick-play valley is all open country. */
export function landAt(state: GameState, at: string): Land {
  const world = worldOf(state);
  return world.kind === 'hex' ? hexLand(world, at).id : 'plains';
}

export function hasRoad(state: GameState, at: string): boolean {
  const world = worldOf(state);
  return world.kind === 'hex' && roadSet(world).has(at);
}

/** Movement points to step into a location: 1 on any road, else the land's cost; every graph road costs 1. */
export function stepCost(state: GameState, at: string): number {
  const world = worldOf(state);
  if (world.kind === 'graph') return 1;
  let costs = movementCosts.get(world);
  if (!costs) {
    const roads = roadSet(world);
    costs = new Map();
    world.rows.forEach((line, row) => { for (let col = 0; col < line.length; col++) {
      const key = `${col},${row}`; costs!.set(key, roads.has(key) ? 1 : hexLand(world, key).move);
    } });
    movementCosts.set(world, costs);
  }
  return costs.get(at) ?? Infinity;
}

/** Adjacent locations, passable or not. */
export function neighbors(state: GameState, at: string): string[] {
  const world = worldOf(state);
  if (world.kind === 'graph') return world.edges.flatMap(([a, b]) => (a === at ? [b] : b === at ? [a] : []));
  return hexNeighbors(parseKey(at)).filter((h) => inHexMap(world, h)).map(hexKey);
}

/** A troop's movement points for a fresh month: one march on the graph, its unit's budget on a hex map. */
export function marchRate(state: GameState, t: Troop): number {
  return worldOf(state).kind === 'graph' ? 1 : UNIT_TYPES[t.type].march;
}

// ---------- Pathfinding ----------

export interface MarchStep {
  cost: number;
  prev: string | null;
}

/**
 * Dijkstra over a world. `stop(at)` marks locations that can be entered but not passed through. With `target`, the
 * search ends once the target's cost is settled: its route is then final, though other entries may be partial.
 */
function cheapest(
  world: WorldView | HexWorld,
  from: string,
  cost: (at: string) => number,
  budget: number,
  stop: (at: string) => boolean,
  graphNeighbors?: (at: string) => string[],
  target?: string,
): Map<string, MarchStep> {
  const next = graphNeighbors ?? ((at: string) => hexNeighbors(parseKey(at)).filter((h) => inHexMap(world as HexWorld, h)).map(hexKey));
  const best = new Map<string, MarchStep>([[from, { cost: 0, prev: null }]]);
  const frontier = new MinHeap();
  frontier.push(from, 0);
  for (let cur = frontier.pop(); cur; cur = frontier.pop()) {
    if (cur.cost > best.get(cur.at)!.cost) continue;
    if (cur.at === target) break;
    if (cur.at !== from && stop(cur.at)) continue;
    for (const n of next(cur.at)) {
      const c = cur.cost + cost(n);
      if (c > budget || c >= (best.get(n)?.cost ?? Infinity)) continue;
      best.set(n, { cost: c, prev: cur.at });
      frontier.push(n, c);
    }
  }
  best.delete(from);
  return best;
}

/** True if entering this location means a fight or a capture for `owner`. */
/**
 * A covert party (game/intel.ts): an army of nothing but scouts and spies, on any side. Armies neither fight it nor
 * are stopped by it, and it never fights or takes a town itself. Only spies find scouts.
 */
export function isCovert(army: Army): boolean {
  return army.troops.length > 0 && army.troops.every((t) => t.type === 'scout' || t.type === 'spy');
}

export function stopsMarch(state: GameState, at: string, owner: FactionId): boolean {
  if (state.armies.some((a) => a.at === at && a.owner !== owner && !isCovert(a))) return true;
  const town = townAt(state, at);
  return !!town && town.owner !== owner;
}

/**
 * Cheapest routes from `from` for an army of `owner` within `budget` movement points. Entering a location held
 * by another faction, or a town that isn't ours, ends the march there. With `throughEnemies` those locations can
 * be passed for planning; the walk still stops when it reaches them.
 */
export function marchOptions(state: GameState, from: string, owner: FactionId, budget: number, throughEnemies = false): Map<string, MarchStep> {
  const world = worldOf(state);
  return cheapest(
    world,
    from,
    (at) => stepCost(state, at),
    budget,
    (at) => (!throughEnemies && stopsMarch(state, at, owner)) || (owner==='player' && !!state.challenge?.fog && !state.challenge.explored.includes(at)),
    world.kind === 'graph' ? (at) => neighbors(state, at) : undefined,
  );
}

export function pathTo(options: Map<string, MarchStep>, to: string): string[] {
  const path: string[] = [];
  for (let k: string | null = to; k && options.has(k); k = options.get(k)!.prev) path.unshift(k);
  return path;
}

/** Binary min-heap of locations by cost: keeps pathfinding fast on large hex maps. */
class MinHeap {
  private items: { at: string; cost: number }[] = [];

  push(at: string, cost: number) {
    const items = this.items;
    items.push({ at, cost });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].cost <= items[i].cost) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): { at: string; cost: number } | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && items[l].cost < items[smallest].cost) smallest = l;
        if (r < items.length && items[r].cost < items[smallest].cost) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}
