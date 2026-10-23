import { EFFECTS } from '../content/spells';
import { LAND, SPELLS, TERRAIN, UNIT_TYPES } from './data';
import { hexDistance, hexKey, hexNeighbors, hexLine, type Hex } from './hex';
import { random } from './rng';
import { FACTIONS } from '../content/factions';
import type { Army, Battle, BattleUnit, DeployCell, Land, Side, SpellId, Terrain, EffectId } from './types';
import { attackFor, heroLevel, heroMaxHp, isHero, kitBonus, level } from './units';
import { EQUIPMENT } from './equipment';

/** Rows in each side's deployment zone; the zone is 3 columns deep, centred on the field. */
export const ZONE_ROWS = 9;
export const FIELD_LIMIT = 3 * ZONE_ROWS;
export const MAX_ROUNDS = 20;

/**
 * Battlefield sizes (monster raids spec, step 1b). The bigger the fight, the bigger the field; the two
 * deployment zones' fronts stay 7 columns apart in the middle, so armies still meet in two or three turns and the extra
 * room is for flanks and terrain. The round limit grows with the field. `legacy` is the old 12x9 field, kept so
 * battles saved before this change still load.
 */
export const BATTLE_SIZES = {
  skirmish: { width: 18, height: 12, rounds: 20 },
  field: { width: 24, height: 16, rounds: 22 },
  major: { width: 30, height: 20, rounds: 24 },
  legacy: { width: 12, height: 9, rounds: MAX_ROUNDS },
} as const;
export type BattleSize = keyof typeof BATTLE_SIZES;

/** Skirmish for up to 6 formations in all, field up to 14, major beyond that or against walls. */
export function battleSize(attacker: Army, defender: Army, walls: boolean): Exclude<BattleSize, 'legacy'> {
  const n = [...attacker.troops, ...defender.troops].filter(t => t.type !== 'scout').length;
  return walls || n > 14 ? 'major' : n > 6 ? 'field' : 'skirmish';
}

/** The last round before an attack stalls, by field size. */
export function maxRounds(b: Pick<Battle, 'width'>): number {
  return Object.values(BATTLE_SIZES).find((s) => s.width === b.width)?.rounds ?? MAX_ROUNDS;
}

/** The battlefield columns of a side's deployment zone, front first, and the zone's top row. */
export function deploymentZone(b: Pick<Battle, 'width' | 'height'>, side: Side): { cols: number[]; top: number } {
  const front = Math.floor(b.width / 2) - 4;
  const cols = side === 'attacker' ? [front, front - 1, front - 2] : [b.width - 1 - front, b.width - front, b.width + 1 - front];
  return { cols, top: Math.floor((b.height - ZONE_ROWS) / 2) };
}
/** A troop whose morale drops below this breaks and runs. */
export const ROUT_AT = 25;
/** A running troop stops and turns to fight again once morale climbs back to this. */
export const RALLY_AT = 45;

/** Fill rows from the middle outward so small armies stand in the centre. */
const ROW_ORDER = [4, 3, 5, 2, 6, 1, 7, 0, 8];

export function other(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

export function createBattle(at: string, attacker: Army, defender: Army, walls: boolean, seed: number, land: Land = 'plains'): Battle {
  const b: Battle = {
    at,
    attackerId: attacker.id,
    defenderId: defender.id,
    owners: { attacker: attacker.owner, defender: defender.owner },
    width: BATTLE_SIZES[battleSize(attacker, defender, walls)].width,
    height: BATTLE_SIZES[battleSize(attacker, defender, walls)].height,
    terrain: [],
    units: [],
    round: 1,
    active: 'attacker',
    walls,
    log: [],
    outcome: null,
    retreated: null,
    seed,
  };
  b.terrain = generateTerrain(b, land, b.width, b.height);
  // Existing saved battles retain their old stance; fresh fights set up automatically.
  deploy(b, attacker, 'attacker');
  deploy(b, defender, 'defender');
  return b;
}

export function leadershipOf(army: Army): number {
  return Math.max(0, ...army.troops.map((t) => (t.men > 0 ? (UNIT_TYPES[t.type].hero?.leadership ?? 0) + kitBonus(t.kit).leadership : 0)));
}

/**
 * Larger features by land: groves, ridges, ruined hamlets, marsh pools and rock walls with gaps (chokepoints).
 * Each is a chance per field; sizes scale with the field.
 */
const FEATURES: Partial<Record<Land, { kind: 'grove' | 'ridge' | 'hamlet' | 'pool' | 'wall'; chance: number }[]>> = {
  plains: [{ kind: 'grove', chance: 0.7 }, { kind: 'ridge', chance: 0.5 }, { kind: 'hamlet', chance: 0.4 }],
  farmland: [{ kind: 'hamlet', chance: 0.8 }, { kind: 'grove', chance: 0.5 }],
  forest: [{ kind: 'grove', chance: 1 }, { kind: 'grove', chance: 0.8 }, { kind: 'ridge', chance: 0.3 }],
  deepwood: [{ kind: 'grove', chance: 1 }, { kind: 'grove', chance: 1 }, { kind: 'pool', chance: 0.3 }],
  hills: [{ kind: 'ridge', chance: 1 }, { kind: 'wall', chance: 0.6 }, { kind: 'grove', chance: 0.4 }],
  mountains: [{ kind: 'wall', chance: 1 }, { kind: 'ridge', chance: 1 }],
  swamp: [{ kind: 'pool', chance: 1 }, { kind: 'pool', chance: 0.7 }, { kind: 'grove', chance: 0.3 }],
  water: [{ kind: 'pool', chance: 0.8 }],
  badlands: [{ kind: 'wall', chance: 0.7 }, { kind: 'ridge', chance: 0.6 }, { kind: 'hamlet', chance: 0.3 }],
};

/**
 * A field shaped by the land outside: scattered ground everywhere except the two deployment zones, larger
 * features, sometimes a stream between the armies and a holy spring. Rock is never allowed to cut the armies
 * off from each other: if it does, a gap is cleared through the middle.
 */
function generateTerrain(rng: { seed: number }, land: Land, width: number, height: number): Terrain[][] {
  const { battleScatter, battleStream } = LAND[land];
  const t: Terrain[][] = Array.from({ length: width }, () => Array<Terrain>(height).fill('plain'));
  const zones = (['attacker', 'defender'] as const).map((side) => deploymentZone({ width, height }, side));
  const inZone = (col: number, row: number) => zones.some((z) => z.cols.includes(col) && row >= z.top && row < z.top + ZONE_ROWS);
  const inside = (col: number, row: number) => col >= 0 && row >= 0 && col < width && row < height;
  const set = (col: number, row: number, kind: Terrain) => { if (inside(col, row) && !inZone(col, row)) t[col][row] = kind; };
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      if (inZone(col, row)) continue;
      let r = random(rng);
      for (const [kind, weight] of battleScatter) {
        if (r < weight) {
          t[col][row] = kind;
          break;
        }
        r -= weight;
      }
    }
  }
  const [attackZone, defendZone] = zones;
  const gapFrom = attackZone.cols[0] + 1;
  const gapTo = defendZone.cols[0] - 1;
  const pick = (from: number, to: number) => from + Math.floor(random(rng) * (to - from + 1));
  const scale = Math.max(1, Math.round(width / 12));
  for (const f of FEATURES[land] ?? []) {
    if (random(rng) >= f.chance) continue;
    const col = pick(1, width - 2);
    const row = pick(1, height - 2);
    if (f.kind === 'grove' || f.kind === 'pool') {
      const radius = scale;
      for (const h of hexesWithin({ col, row }, radius)) if (random(rng) < 0.8) set(h.col, h.row, f.kind === 'grove' ? 'forest' : 'marsh');
    } else if (f.kind === 'ridge') {
      for (let i = 0; i < 3 + 2 * scale; i++) set(col + (i % 2), row - scale + i, 'hill');
    } else if (f.kind === 'hamlet') {
      for (const h of hexesWithin({ col, row }, 1)) if (random(rng) < 0.55) set(h.col, h.row, 'ruins');
    } else {
      // A rock wall across the no-man's land, with a gap or two to fight through: a chokepoint.
      const wallCol = pick(gapFrom + 1, Math.max(gapFrom + 1, gapTo - 1));
      const gaps = new Set([pick(0, height - 1), pick(0, height - 1)]);
      for (let r = 0; r < height; r++) if (!gaps.has(r) && random(rng) < 0.85) set(wallCol, r, 'rocks');
    }
  }
  // Some fields have a stream winding from top to bottom between the armies; how often depends on the land.
  if (random(rng) < battleStream) {
    let col = pick(gapFrom + 1, Math.max(gapFrom + 1, gapTo - 1));
    for (let row = 0; row < height; row++) {
      set(col, row, 'stream');
      const drift = random(rng);
      const next = drift < 0.25 ? col - 1 : drift > 0.75 ? col + 1 : col;
      if (next > gapFrom && next < gapTo) col = next;
    }
  }
  // Some fields have a holy spring.
  if (random(rng) < 0.4) set(pick(gapFrom, gapTo), pick(0, height - 1), 'spring');
  ensureCrossing(t, width, height, zones[0], zones[1]);
  return t;
}

function hexesWithin(c: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let col = c.col - radius; col <= c.col + radius; col++) {
    for (let row = c.row - radius; row <= c.row + radius; row++) if (hexDistance(c, { col, row }) <= radius) out.push({ col, row });
  }
  return out;
}

/** If rock leaves no way from one deployment zone to the other, clear a path through the middle row. */
function ensureCrossing(t: Terrain[][], width: number, height: number, a: { cols: number[]; top: number }, d: { cols: number[]; top: number }) {
  const passable = (h: Hex) => h.col >= 0 && h.row >= 0 && h.col < width && h.row < height && TERRAIN[t[h.col][h.row]].move < Infinity;
  const start = { col: a.cols[0], row: a.top + 4 };
  const seen = new Set([hexKey(start)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (d.cols.includes(cur.col) && cur.row >= d.top && cur.row < d.top + ZONE_ROWS) return;
    for (const n of hexNeighbors(cur)) {
      if (!passable(n) || seen.has(hexKey(n))) continue;
      seen.add(hexKey(n));
      queue.push(n);
    }
  }
  for (let col = a.cols[0]; col <= d.cols[0]; col++) if (t[col][a.top + 4] === 'rocks') t[col][a.top + 4] = 'plain';
}

export function terrainAt(b: Battle, h: Hex) {
  return TERRAIN[b.terrain[h.col][h.row]];
}

function startingMorale(b: Battle, side: Side, type: string, xp: number, leadership: number): number {
  if (isHero(type) || UNIT_TYPES[type].fearless) return 100;
  const walls = b.walls && side === 'defender' ? 10 : 0;
  return Math.min(100, 60 + 8 * (level(xp) - 1) + leadership + walls);
}

/** New battles use a strength-ranked melee screen, ranged support, and protected casters/ruler. */
export function planDeployment(army: Army): Map<number, DeployCell> {
  const plan = new Map<number, DeployCell>();
  const taken = new Set<string>();
  const key = (c: DeployCell) => `${c.depth},${c.row}`;
  const role = (t: Army['troops'][number]) => {
    const type = UNIT_TYPES[t.type];
    if (t.type === 'lord' || t.type === 'warchief' || (type.hero?.spells.length ?? 0) > 0 || type.noncombat) return 2;
    return type.range > 1 ? 1 : 0;
  };
  const strength = (t: Army['troops'][number]) => {
    const type = UNIT_TYPES[t.type];
    const health = type.hero ? t.men / heroMaxHp(t.type, t.xp) : t.men / type.men;
    return (attackFor(t.type, t.xp) + type.defense + kitBonus(t.kit).defense) * health;
  };
  const rows = ROW_ORDER;
  const byRole = [
    [0, 1, 2], // Tough melee occupy the front before the line fills up.
    [1, 2, 0], // Archers stay behind the screen.
    [1, 2, 0], // Casters and the leader stay behind the melee screen.
  ];
  // Keep the same fielded contingent as older saves/encounter previews; rank only its starting positions.
  // Scouts and spies never take the field; engineers do, at the rear, to build.
  const troops = army.troops.filter(t => t.type !== 'scout' && UNIT_TYPES[t.type].noncombat !== 'spy').slice(0, FIELD_LIMIT).sort((a, b) => role(a) - role(b) || strength(b) - strength(a) || a.id - b.id);
  for (const t of troops) {
    const cell = byRole[role(t)].flatMap((depth) => rows.map((row) => ({ depth, row })))
      .find((c) => !taken.has(key(c)));
    if (!cell) continue;
    taken.add(key(cell));
    plan.set(t.id, cell);
  }
  return plan;
}

function deploy(b: Battle, army: Army, side: Side) {
  const { cols, top } = deploymentZone(b, side);
  const plan = planDeployment(army);
  const leadership = leadershipOf(army);
  army.troops.forEach((t) => {
    const type = UNIT_TYPES[t.type];
    const cell = plan.get(t.id);
    const slot = cell ? { col: cols[cell.depth], row: top + cell.row } : undefined;
    b.units.push({
      id: b.units.length + 1,
      effects: [],
      reserve: !slot,
      side,
      armyId: army.id,
      troopId: t.id,
      type: t.type,
      name: t.name,
      men: t.men,
      startMen: t.men,
      maxMen: type.hero ? heroMaxHp(t.type, t.xp) : t.men,
      xp: t.xp,
      mana: t.mana ?? 0,
      gear: { ...t.gear },
      ...(t.kit ? { kit: { ...t.kit } } : {}),
      morale: startingMorale(b, side, t.type, t.xp, leadership),
      routing: false,
      fled: false,
      deeds: 0,
      col: slot?.col ?? -1,
      row: slot?.row ?? -1,
      moved: false,
      acted: false,
    });
  });
}

export function isAI(b: Battle, side: Side): boolean {
  return b.owners[side] !== 'player';
}

export function playerSide(b: Battle): Side | null {
  if (b.owners.attacker === 'player') return 'attacker';
  if (b.owners.defender === 'player') return 'defender';
  return null;
}

/** Overflow remains with the army, but does not fight or earn XP in this battle.
 * It shares the army's retreat and pursuit losses after resolution. */
export function reserves(b: Battle, side?: Side): BattleUnit[] {
  return b.units.filter((u) => u.reserve && u.men > 0 && (!side || u.side === side));
}

/** Units still on the field (including ones that are running). */
export function alive(b: Battle, side?: Side): BattleUnit[] {
  return b.units.filter((u) => u.men > 0 && !u.fled && !u.reserve && (!side || u.side === side));
}

/** Units on the field that are still fighting. */
export function fighting(b: Battle, side: Side): BattleUnit[] {
  return alive(b, side).filter((u) => !u.routing);
}

export function unitAt(b: Battle, h: Hex): BattleUnit | undefined {
  return b.units.find((u) => u.men > 0 && !u.fled && !u.reserve && u.col === h.col && u.row === h.row);
}

/** Attack value; with the battle given, a regular formation includes the command bonus of a hero nearby. */
export function attackOf(u: BattleUnit, b?: Battle): number {
  const base = (attackFor(u.type, u.xp) + kitBonus(u.kit).attack) * (u.gear.bow ? EQUIPMENT[u.gear.bow].attackFactor : 1);
  return b ? base * (1 + commandOf(b, u)) : base;
}

/** How far a hero's command reaches: regular formations within this many hexes fight better. */
export const COMMAND_RANGE = 2;

/**
 * Command: a regular formation within reach of a hero of its side gains attack equal to that hero's leadership
 * (equipment included) plus 2 per hero level, in percent. Only the best hero nearby counts. Heroes themselves
 * don't gain it.
 */
export function commandOf(b: Battle, u: BattleUnit): number {
  if (isHero(u.type)) return 0;
  let best = 0;
  for (const h of b.units) {
    if (h.side !== u.side || !isHero(h.type) || h.men <= 0 || h.fled || h.reserve || hexDistance(h, u) > COMMAND_RANGE) continue;
    const lead = (UNIT_TYPES[h.type].hero!.leadership + kitBonus(h.kit).leadership + 2 * heroLevel(h.xp)) / 100;
    best = Math.max(best, lead);
  }
  return best;
}

export function defenseOf(b: Battle, u: BattleUnit): number {
  const wall = b.walls && u.side === 'defender' ? 1 : 0;
  return Math.max(1, UNIT_TYPES[u.type].defense + EQUIPMENT[u.gear.armor].defenseBonus + kitBonus(u.kit).defense + terrainAt(b, u).defense + wall + (hasEffect(u, 'ward') ? 2 : 0));
}

/** Fighting weight: men for a troop, a fixed value for a hero (wounds don't weaken their blows). */
/** Fighting weight: men for a formation; for a hero, the class's power, growing with level at the class's rate. */
export function powerOf(u: Pick<BattleUnit, 'type' | 'xp' | 'men'>): number {
  const hero = UNIT_TYPES[u.type].hero;
  return hero ? hero.power * (1 + hero.growth * (heroLevel(u.xp) - 1)) : u.men;
}

function inBounds(b: Battle, h: Hex): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < b.width && h.row < b.height;
}

function nextToEnemy(b: Battle, h: Hex, side: Side): boolean {
  return hexNeighbors(h).some((n) => {
    const u = unitAt(b, n);
    return !!u && u.side !== side;
  });
}

function reachFrom(b: Battle, u: BattleUnit): Map<string, number> {
  const result = new Map<string, number>();
  const budget = movementOf(u);
  const best = new Map<string, number>([[hexKey(u), 0]]);
  const frontier: (Hex & { cost: number })[] = [{ col: u.col, row: u.row, cost: 0 }];
  while (frontier.length) {
    frontier.sort((a, c) => a.cost - c.cost);
    const cur = frontier.shift()!;
    const isStart = cur.col === u.col && cur.row === u.row;
    if (!isStart && nextToEnemy(b, cur, u.side)) continue;
    for (const n of hexNeighbors(cur)) {
      if (!inBounds(b, n) || unitAt(b, n)) continue;
      const cost = cur.cost + terrainAt(b, n).move;
      const k = hexKey(n);
      if (cost <= budget && cost < (best.get(k) ?? Infinity)) {
        best.set(k, cost);
        result.set(k, cost);
        frontier.push({ ...n, cost });
      }
    }
  }
  return result;
}

/** Hexes the unit can move to this turn, with their movement cost. Enemies exert a zone of control. */
export function reachable(b: Battle, u: BattleUnit): Map<string, number> {
  if (u.reserve || u.moved || u.acted || u.men <= 0 || u.fled || u.routing) return new Map();
  return reachFrom(b, u);
}

/** Translate an odd-column hex by the same axial displacement as the group's lead. */
function groupPosition(lead: BattleUnit, destination: Hex, member: BattleUnit): Hex {
  const axialRow = (h: Hex) => h.row - (h.col - (h.col & 1)) / 2;
  const col = member.col + destination.col - lead.col;
  const row = axialRow(member) + axialRow(destination) - axialRow(lead) + (col - (col & 1)) / 2;
  return { col, row };
}

/** Legal lead destinations for a simultaneous, spacing-preserving move. The slowest member sets the budget. */
export function groupReachable(b: Battle, unitIds: number[]): Map<string, number> {
  if (unitIds.length < 2 || new Set(unitIds).size !== unitIds.length || b.outcome) return new Map();
  const group = unitIds.map((id) => b.units.find((u) => u.id === id));
  if (group.some((u) => !u || u.side !== b.active || !alive(b).includes(u) || u.moved || u.acted || u.routing)) return new Map();
  const members = group as BattleUnit[];
  const lead = members[0];
  const ids = new Set(unitIds);
  const budget = Math.min(...members.map(movementOf));
  const result = new Map<string, number>();
  const best = new Map<string, number>([[hexKey(lead), 0]]);
  const frontier: (Hex & { cost: number })[] = [{ col: lead.col, row: lead.row, cost: 0 }];
  while (frontier.length) {
    frontier.sort((a, c) => a.cost - c.cost);
    const cur = frontier.shift()!;
    if (cur.cost !== best.get(hexKey(cur))) continue;
    if (cur.cost && members.some((u) => nextToEnemy(b, groupPosition(lead, cur, u), u.side))) continue;
    for (const next of hexNeighbors(cur)) {
      let step = 0;
      let legal = true;
      for (const u of members) {
        const at = groupPosition(lead, next, u);
        const occupant = inBounds(b, at) ? unitAt(b, at) : undefined;
        if (!inBounds(b, at) || (occupant && !ids.has(occupant.id))) { legal = false; break; }
        step = Math.max(step, terrainAt(b, at).move);
      }
      const cost = cur.cost + step;
      if (!legal || !Number.isFinite(cost) || cost > budget || cost >= (best.get(hexKey(next)) ?? Infinity)) continue;
      best.set(hexKey(next), cost);
      result.set(hexKey(next), cost);
      frontier.push({ ...next, cost });
    }
  }
  // An occupied lead hex may be useful while searching a route, but clicking it
  // selects that formation in the UI instead of issuing a group move.
  for (const key of result.keys()) {
    const [col, row] = key.split(',').map(Number);
    if (unitAt(b, { col, row })) result.delete(key);
  }
  return result;
}

/** Move every selected formation together, or none. Terrain harm is applied after all positions change. */
export function moveGroup(b: Battle, unitIds: number[], destination: Hex): boolean {
  if (!groupReachable(b, unitIds).has(hexKey(destination))) return false;
  const members = unitIds.map((id) => b.units.find((u) => u.id === id)!);
  const positions = members.map((u) => groupPosition(members[0], destination, u));
  members.forEach((u, i) => { u.col = positions[i].col; u.row = positions[i].row; u.moved = true; });
  for (const u of members) {
    const ground = terrainAt(b, u);
    const lost = Math.min(ground.moveLoss, u.men - 1);
    if (lost > 0) b.log.push(`${unitLabel(b, u)} push into the ${ground.name.toLowerCase()}: ${lost} ${isHero(u.type) ? 'wounds' : 'men hurt'}.${takeLosses(b, u, lost)}`);
  }
  return true;
}

/** Enemies the unit can strike now: adjacent ones, or ones in missile range if it isn't engaged. */
export type Build = 'fort' | 'tower' | 'bridge';

/** What engineers can build, in their own words, for the battle panel. */
export const BUILDS: Record<Build, { name: string; text: string }> = {
  fort: { name: 'Field fort', text: 'Raise a palisade on an empty hex next to the engineers: whoever holds it gets +3 defense.' },
  tower: { name: 'Siege tower', text: 'Roll a tower against the town walls: the defenders lose their wall bonus for the rest of the battle.' },
  bridge: { name: 'Bridge', text: 'Lay a bridge over a stream or marsh hex next to the engineers: it is crossed like open ground.' },
};

function canBuild(b: Battle, u: BattleUnit): boolean {
  return UNIT_TYPES[u.type].noncombat === 'engineer' && !b.outcome && u.side === b.active && !u.reserve && !u.acted && !u.fled && !u.routing && u.men > 0;
}

/** Where engineers can build: forts on empty passable hexes next to them, bridges on water or marsh next to them. */
export function buildTargets(b: Battle, u: BattleUnit, kind: Build): Hex[] {
  if (!canBuild(b, u)) return [];
  if (kind === 'tower') return u.side === 'attacker' && b.walls ? [{ col: u.col, row: u.row }] : [];
  return hexNeighbors(u).filter((h) => h.col >= 0 && h.row >= 0 && h.col < b.width && h.row < b.height).filter((h) => {
    const t = b.terrain[h.col][h.row];
    if (kind === 'bridge') return t === 'stream' || t === 'marsh';
    return !unitAt(b, h) && TERRAIN[t].move < Infinity && t !== 'fort' && t !== 'stream' && t !== 'marsh';
  });
}

/** Engineers spend their turn building. Returns whether anything was built. */
export function build(b: Battle, unitId: number, kind: Build, at?: Hex): boolean {
  const u = b.units.find((x) => x.id === unitId);
  if (!u) return false;
  const target = buildTargets(b, u, kind).find((h) => kind === 'tower' || (at && h.col === at.col && h.row === at.row));
  if (!target) return false;
  if (kind === 'tower') {
    b.walls = false;
    b.log.push('Engineers roll a siege tower against the walls: the defenders lose their wall bonus.');
  } else {
    b.terrain[target.col][target.row] = kind;
    b.log.push(kind === 'fort' ? 'Engineers raise a field fort.' : 'Engineers lay a bridge.');
  }
  u.moved = true;
  u.acted = true;
  return true;
}

export function attackTargets(b: Battle, u: BattleUnit): BattleUnit[] {
  if (u.reserve || u.acted || u.men <= 0 || u.fled || u.routing || UNIT_TYPES[u.type].noncombat) return [];
  const range = rangeOf(b, u);
  const engaged = nextToEnemy(b, u, u.side);
  return alive(b, other(u.side)).filter((e) => {
    const d = hexDistance(u, e);
    return d === 1 || (range > 1 && !engaged && d <= range);
  });
}

/** A legal one-click attack, including moving to a reachable adjacent hex for melee. */
export function attackOrderQuote(b: Battle, unitId: number, targetId: number): { reason: string | null; destination: Hex | null; cost: number } {
  const u=b.units.find(x=>x.id===unitId),t=b.units.find(x=>x.id===targetId);
  const no=(reason:string)=>({reason,destination:null,cost:0});
  if(!u || !t || b.outcome || u.side!==b.active || t.side===u.side || t.reserve || t.fled || t.men<=0) return no('Choose a living enemy on the field.');
  if(u.reserve || u.acted || u.fled || u.men<=0 || u.routing) return no('This formation cannot attack now.');
  if(attackTargets(b,u).includes(t))return {reason:null,destination:null,cost:0};
  const reach=reachable(b,u);
  const options=[...reach.keys()].map(key=>{const [col,row]=key.split(',').map(Number);return {col,row};}).filter(h=>attackTargets(b,{...u,...h}).includes(t)).sort((a,c)=>(reach.get(hexKey(a))!-reach.get(hexKey(c))!) || terrainAt(b,a).moveLoss-terrainAt(b,c).moveLoss || a.col-c.col || a.row-c.row);
  if(!options.length)return no('That enemy is beyond this turn’s movement and attack range.');
  return {reason:null,destination:options[0],cost:reach.get(hexKey(options[0]))!};
}

export function attackOrder(b: Battle, unitId: number, targetId: number): boolean {
  const quote=attackOrderQuote(b,unitId,targetId);
  if(quote.reason)return false;
  if(quote.destination && !moveUnit(b,unitId,quote.destination))return false;
  return attack(b,unitId,targetId);
}

/** Missile range, including the bonus for standing on high ground. Melee troops stay at 1. */
export function rangeOf(b: Battle, u: BattleUnit): number {
  const range = UNIT_TYPES[u.type].range + (u.gear.bow ? EQUIPMENT[u.gear.bow].rangeBonus : 0);
  return range > 1 ? range + terrainAt(b, u).rangeBonus : range;
}

export function moveUnit(b: Battle, unitId: number, to: Hex): boolean {
  const u = b.units.find((x) => x.id === unitId);
  if (!u || b.outcome || u.side !== b.active) return false;
  if (!reachable(b, u).has(hexKey(to))) return false;
  u.col = to.col;
  u.row = to.row;
  u.moved = true;
  applyMoveGround(b, u);
  return true;
}

function applyMoveGround(b:Battle,u:BattleUnit){
  const ground = terrainAt(b, u);
  const lost = Math.min(ground.moveLoss, u.men - 1);
  if (lost > 0) b.log.push(`${unitLabel(b, u)} push into the ${ground.name.toLowerCase()}: ${lost} ${isHero(u.type) ? 'wounds' : 'men hurt'}.${takeLosses(b, u, lost)}`);
}

export function unitLabel(b: Battle, u: BattleUnit): string {
  if (u.name) return u.name;
  return `${FACTIONS[b.owners[u.side]].troopPrefix} ${UNIT_TYPES[u.type].name}`;
}

/** Lower a troop's morale; it breaks if morale falls below ROUT_AT. Heroes never break. */
function shake(b: Battle, u: BattleUnit, amount: number) {
  if (isHero(u.type) || UNIT_TYPES[u.type].fearless || u.men <= 0 || u.fled) return;
  u.morale = Math.max(0, Math.min(100, u.morale - amount));
  if (!u.routing && u.morale < ROUT_AT) {
    u.routing = true;
    b.log.push(`${unitLabel(b, u)} break and run!`);
  }
}

/** Apply losses and the morale blow that comes with them. Returns a log fragment. */
function takeLosses(b: Battle, u: BattleUnit, killed: number): string {
  u.men -= killed;
  if (u.men > 0) {
    shake(b, u, Math.round((killed / u.maxMen) * 100));
    return '';
  }
  u.men = 0;
  if (isHero(u.type)) {
    for (const f of alive(b, u.side)) shake(b, f, 20);
    return ` ${unitLabel(b, u)} has fallen!`;
  }
  for (const f of alive(b, u.side)) if (hexDistance(f, u) <= 2) shake(b, f, 10);
  return ` ${unitLabel(b, u)} are wiped out.`;
}

function rollDamage(b: Battle, from: BattleUnit, to: BattleUnit, factor: number): number {
  const roll = 0.7 + random(b) * 0.6;
  const running = to.routing ? 1.5 : 1;
  const raw = (powerOf(from) * attackOf(from, b) * roll * factor * running) / (defenseOf(b, to) * 4);
  return Math.min(to.men, Math.max(1, Math.round(raw)));
}

export function attack(b: Battle, unitId: number, targetId: number): boolean {
  const u = b.units.find((x) => x.id === unitId);
  const t = b.units.find((x) => x.id === targetId);
  if (!u || !t || b.outcome || u.side !== b.active) return false;
  if (!attackTargets(b, u).includes(t)) return false;
  const melee = hexDistance(u, t) === 1;
  const killed = rollDamage(b, u, t, melee && hasEffect(u, 'slow') ? 0.75 : 1);
  let line = `${unitLabel(b, u)} ${melee ? 'charge' : 'shoot at'} ${unitLabel(b, t)}: ${killed} ${isHero(t.type) ? 'wounds' : 'fall'}.`;
  line += takeLosses(b, t, killed);
  if (t.men > 0 && melee && !t.routing) {
    const back = rollDamage(b, t, u, 0.5);
    line += ` They strike back: ${back} ${isHero(u.type) ? 'wounds' : 'fall'}.`;
    line += takeLosses(b, u, back);
  }
  b.log.push(line);
  u.moved = true;
  u.acted = true;
  u.deeds++;
  checkOutcome(b);
  return true;
}

export function knownSpells(u: Pick<BattleUnit, 'type' | 'xp'>): SpellId[] {
  return (UNIT_TYPES[u.type].hero?.spells ?? []).filter((id) => heroLevel(u.xp) >= SPELLS[id].level);
}

/** Level ten masters save one mana per cast, with a minimum cost of two. */
export function spellCost(u: Pick<BattleUnit, 'xp'>, id: SpellId): number {
  return Math.max(2, SPELLS[id].cost - (heroLevel(u.xp) === 10 ? 1 : 0));
}

export function hasEffect(u: BattleUnit, id: EffectId): boolean {
  return u.effects.some((e) => e.id === id);
}

export function movementOf(u: BattleUnit): number {
  const base = UNIT_TYPES[u.type].move + (hasEffect(u, 'haste') ? 2 : 0) - (hasEffect(u, 'slow') ? 2 : 0) - (hasEffect(u, 'frost') ? 1 : 0);
  return hasEffect(u, 'entangle') ? 1 : Math.max(1, base);
}

export function spellLineOfSight(b: Battle, from: Hex, to: Hex): boolean {
  return hexLine(from, to).slice(1, -1).every((h) => inBounds(b, h) && b.terrain[h.col][h.row] !== 'rocks');
}

export function dispellable(caster: BattleUnit, target: BattleUnit): EffectId[] {
  return target.effects.filter((e) => EFFECTS[e.id].beneficial === (caster.side !== target.side)).map((e) => e.id);
}

/** Legal empty destinations. Every hex is visible in the current tactical scenario. */
export function teleportDestinations(b: Battle, caster: BattleUnit, target: BattleUnit): Hex[] {
  if (caster.side !== target.side || !alive(b).includes(target) || target.routing) return [];
  const result: Hex[] = [];
  for (let col = 0; col < b.width; col++) for (let row = 0; row < b.height; row++) {
    const h = { col, row };
    if (!unitAt(b, h) && Number.isFinite(terrainAt(b, h).move) && hexDistance(caster, h) <= SPELLS.teleport.range && hexDistance(target, h) <= SPELLS.teleport.range) result.push(h);
  }
  return result;
}

/** Units the hero could cast this spell on right now. Used by player input and AI. */
export function spellTargets(b: Battle, u: BattleUnit, spellId: SpellId): BattleUnit[] {
  const spell = SPELLS[spellId];
  if (!spell || b.outcome || u.side !== b.active || u.reserve || u.fled || u.routing || u.acted || u.men <= 0 || !knownSpells(u).includes(spellId) || u.mana < spellCost(u, spellId)) return [];
  const pool = spell.target === 'either' ? alive(b) : alive(b, spell.target === 'enemy' ? other(u.side) : u.side);
  return pool.filter((t) => {
    if (hexDistance(u, t) > spell.range || (spell.lineOfSight && !spellLineOfSight(b, u, t))) return false;
    if (spellId === 'heal') return t.men < t.maxMen;
    if (spellId === 'rally' || spellId === 'terror') return !isHero(t.type) && !UNIT_TYPES[t.type].fearless && (spellId === 'terror' || t.morale < 100);
    if (spellId === 'dispel') return dispellable(u, t).length > 0;
    if (spellId === 'teleport') return !t.routing && teleportDestinations(b, u, t).length > 0;
    if (spellId === 'ward' || spellId === 'haste' || spellId === 'slow') return !t.effects.some((e) => e.id === spellId && e.turns === EFFECTS[spellId].turns);
    return true;
  });
}

export function spellAffected(b: Battle, caster: BattleUnit, id: SpellId, target: BattleUnit): BattleUnit[] {
  if (id === 'chain-lightning') {
    const chain = [target];
    while (chain.length < 3) {
      const previous = chain.at(-1)!;
      const next = alive(b, other(caster.side)).filter((u) => !chain.includes(u) && hexDistance(previous, u) <= 2 && spellLineOfSight(b, previous, u))
        .sort((a, c) => hexDistance(previous, a) - hexDistance(previous, c) || a.id - c.id)[0];
      if (!next) break;
      chain.push(next);
    }
    return chain;
  }
  if (SPELLS[id].radius) return alive(b).filter((u) => hexDistance(target, u) <= SPELLS[id].radius && (id !== 'entangle' || u.side !== caster.side));
  return [target];
}

export interface SpellImpact { unit: BattleUnit; damage: number; healing: number; add: EffectId | null; remove: EffectId[]; }
export interface SpellPreview { impacts: SpellImpact[]; breaksWalls: boolean; destination: Hex | null; }

/** Damage is deterministic so the confirmation preview and resolution agree exactly. */
function spellDamage(caster: BattleUnit, target: BattleUnit, id: SpellId, jump: number): number {
  const kind = SPELLS[id].damageKind;
  if (!kind) return 0;
  const level = heroLevel(caster.xp);
  let raw = id === 'fireball' ? 4 + 2 * level : id === 'frost' ? 3 + level : id === 'lightning' ? 6 + 2 * level : id === 'disintegrate' ? 12 + 2 * level : id === 'quake' ? 3 + level : 5 + level;
  if (kind === 'fire') raw = Math.max(1, raw - Math.floor((UNIT_TYPES[target.type].defense + EQUIPMENT[target.gear.armor].defenseBonus) / 4));
  if (id === 'chain-lightning') raw *= 1 - 0.25 * jump;
  raw *= 1 - (UNIT_TYPES[target.type].resistances?.[kind] ?? 0) / 100;
  if (hasEffect(target, 'ward')) raw *= 0.5;
  if (id === 'disintegrate' && isHero(target.type)) raw = Math.min(raw, Math.max(1, Math.floor(target.maxMen * 0.4)));
  return Math.min(target.men, Math.max(0, Math.floor(raw)));
}

export function previewSpell(b: Battle, caster: BattleUnit, id: SpellId, target: BattleUnit, destination?: Hex): SpellPreview | null {
  if (!spellTargets(b, caster, id).includes(target)) return null;
  if (id === 'teleport' && (!destination || !teleportDestinations(b, caster, target).some((h) => h.col === destination.col && h.row === destination.row))) return null;
  const units = spellAffected(b, caster, id, target);
  return {
    impacts: units.map((unit, i) => ({ unit, damage: spellDamage(caster, unit, id, i), healing: id === 'heal' ? Math.min(unit.maxMen - unit.men, 4 + 2 * heroLevel(caster.xp)) : 0,
      add: (['ward', 'frost', 'haste', 'slow', 'entangle'] as string[]).includes(id) ? id as EffectId : null,
      remove: id === 'dispel' ? dispellable(caster, unit) : id === 'haste' && hasEffect(unit, 'slow') ? ['slow'] : id === 'slow' && hasEffect(unit, 'haste') ? ['haste'] : [],
    })),
    breaksWalls: id === 'quake' && b.walls && units.some((u) => u.side === 'defender'),
    destination: id === 'teleport' ? destination! : null,
  };
}

export function castSpell(b: Battle, unitId: number, spellId: SpellId, targetId: number, destination?: Hex): boolean {
  const u = b.units.find((x) => x.id === unitId), t = b.units.find((x) => x.id === targetId);
  if (!u || !t) return false;
  const preview = previewSpell(b, u, spellId, t, destination);
  if (!preview) return false;
  u.mana -= spellCost(u, spellId);
  u.moved = true; u.acted = true; u.deeds++;
  b.log.push(`${unitLabel(b, u)} ${spellId === 'fireball' ? 'hurls fire' : `casts ${SPELLS[spellId].name}`} at ${unitLabel(b, t)}.`);
  for (const hit of preview.impacts) {
    const target = hit.unit;
    if (hit.damage) b.log.push(`${unitLabel(b, target)}: ${hit.damage} ${isHero(target.type) ? 'wounds' : 'fall'}.${takeLosses(b, target, hit.damage)}`);
    if (target.men <= 0) continue;
    if (hit.healing) { target.men += hit.healing; b.log.push(`${unitLabel(b, target)} recovers ${hit.healing}.`); }
    target.effects = target.effects.filter((e) => !hit.remove.includes(e.id));
    if (hit.remove.length) b.log.push(`${unitLabel(b, target)}: ${hit.remove.map((id) => EFFECTS[id].name).join(', ')} removed.`);
    if (hit.add) {
      target.effects = target.effects.filter((e) => e.id !== hit.add);
      target.effects.push({ id: hit.add, turns: EFFECTS[hit.add].turns });
      b.log.push(`${unitLabel(b, target)} gains ${EFFECTS[hit.add].name} for ${EFFECTS[hit.add].turns} of its side's turns.`);
    }
    if (spellId === 'fireball') shake(b, target, 10);
    if (spellId === 'terror') shake(b, target, 30 + 5 * heroLevel(u.xp));
    if (spellId === 'rally') {
      target.morale = Math.min(100, target.morale + 40);
      if (target.morale >= RALLY_AT) target.routing = false;
    }
  }
  if (preview.breaksWalls) { b.walls = false; b.log.push('The quake breaks the battlefield walls: defenders lose their wall bonus.'); }
  if (preview.destination) {
    t.col = preview.destination.col; t.row = preview.destination.row; t.moved = true;
    b.log.push(`${unitLabel(b, t)} teleports to ${t.col + 1}, ${t.row + 1}; its move is spent.`);
  }
  checkOutcome(b);
  return true;
}

function checkOutcome(b: Battle) {
  if (b.outcome) return;
  if (fighting(b, 'attacker').length === 0) b.outcome = 'defender';
  else if (fighting(b, 'defender').length === 0) b.outcome = 'attacker';
}

export function retreat(b: Battle, side: Side) {
  if (b.outcome) return;
  b.retreated = side;
  b.outcome = other(side);
  b.log.push(`${side === playerSide(b) ? 'You fall' : 'The enemy falls'} back.`);
}

/**
 * Running away (as in the original): an army that attacked can try after turn 4; an army that was attacked, or a
 * party in a quest encounter, only after turn 8. Each try is a roll; enemies already at grips make it harder.
 */
export const ESCAPE_AFTER = { attacked: 4, defending: 8 } as const;

export function escapeTurn(b: Battle, side: Side): number {
  return side === 'attacker' && !b.encounter ? ESCAPE_AFTER.attacked : ESCAPE_AFTER.defending;
}

export interface EscapeQuote {
  /** The last turn before running away is allowed (it is allowed from the turn after). */
  after: number;
  /** Chance a try succeeds now, 0–1. */
  chance: number;
  reason: string | null;
}

/** Whether `side` may try to run away now, and its chance: 75%, less 10% per enemy formation in contact, 20–90%. */
export function escapeQuote(b: Battle, side: Side): EscapeQuote {
  const after = escapeTurn(b, side);
  const engaged = alive(b, other(side)).filter((e) => fighting(b, side).some((u) => hexDistance(u, e) === 1)).length;
  const chance = Math.min(0.9, Math.max(0.2, 0.75 - 0.1 * engaged));
  if (b.outcome) return { after, chance, reason: 'The battle is over.' };
  if (b.active !== side) return { after, chance, reason: 'Wait for your turn.' };
  if (b.round <= after) return { after, chance, reason: `You can try to run away after turn ${after}.` };
  return { after, chance, reason: null };
}

/**
 * Try to run away. On a success the side falls back (with the usual pursuit losses when the battle is applied);
 * on a failure the enemy holds you and your turn is spent. Returns whether you got away, or null if not allowed.
 */
export function tryEscape(b: Battle, side: Side): boolean | null {
  const quote = escapeQuote(b, side);
  if (quote.reason) return null;
  if (random(b) < quote.chance) {
    b.log.push(`${side === playerSide(b) ? 'Your army breaks away' : 'The enemy breaks away'} (${Math.round(quote.chance * 100)}% chance).`);
    retreat(b, side);
    return true;
  }
  b.log.push(`${side === playerSide(b) ? 'You try to break away, but the enemy holds you' : 'The enemy tries to break away, but you hold them'} (${Math.round(quote.chance * 100)}% chance).`);
  endSideTurn(b);
  runAI(b);
  return false;
}

/** Running troops head for their own edge of the field and leave it once they reach it. */
function flee(b: Battle, u: BattleUnit) {
  const edge = u.side === 'attacker' ? 0 : b.width - 1;
  if (u.col !== edge) {
    let best: Hex | null = null;
    let bestScore = Infinity;
    for (const k of reachFrom(b, u).keys()) {
      const [col, row] = k.split(',').map(Number);
      const enemyDist = nearestEnemyDistance(b, { col, row }, u.side);
      const score = Math.abs(col - edge) * 10 - Math.min(enemyDist, 9);
      if (score < bestScore) {
        bestScore = score;
        best = { col, row };
      }
    }
    if (best) {
      u.col = best.col;
      u.row = best.row;
    }
  }
  u.moved = true;
  u.acted = true;
  if (u.col === edge) {
    u.fled = true;
    b.log.push(`${unitLabel(b, u)} flee the field.`);
  }
}

/** Morale recovers a little each turn; running troops either rally or keep running. */
function startSideTurn(b: Battle) {
  for (const u of alive(b, b.active)) {
    // Trolls knit their wounds back together.
    const regen = UNIT_TYPES[u.type].regenerate ?? 0;
    if (regen && u.men < u.startMen) {
      const amount = Math.min(regen, u.startMen - u.men);
      u.men += amount;
      b.log.push(`${unitLabel(b, u)} regenerate${amount > 1 ? '' : 's'}: ${amount} back.`);
    }
    const ground = terrainAt(b, u);
    if (ground.heal && u.men < u.maxMen) {
      const amount = Math.min(ground.heal, u.maxMen - u.men);
      u.men += amount;
      if (!isHero(u.type)) u.morale = Math.min(100, u.morale + 5);
      b.log.push(`The ${ground.name.toLowerCase()} restores ${unitLabel(b, u)}: ${amount} ${isHero(u.type) ? 'wounds mended' : 'men back'}.`);
    }
    if (ground.moraleDrain) shake(b, u, ground.moraleDrain);
    if (!u.routing) {
      u.morale = Math.min(100, u.morale + 3);
      continue;
    }
    u.morale = Math.min(100, u.morale + 8);
    if (u.morale >= RALLY_AT && !nextToEnemy(b, u, u.side)) {
      u.routing = false;
      b.log.push(`${unitLabel(b, u)} rally.`);
    } else {
      flee(b, u);
    }
  }
  checkOutcome(b);
}

export function endSideTurn(b: Battle) {
  if (b.outcome) return;
  for (const u of b.units.filter((u) => u.side === b.active)) {
    for (const effect of u.effects) effect.turns--;
    const expired = u.effects.filter((e) => e.turns <= 0);
    u.effects = u.effects.filter((e) => e.turns > 0);
    if (expired.length) b.log.push(`${unitLabel(b, u)}: ${expired.map((e) => EFFECTS[e.id].name).join(', ')} expires.`);
  }
  b.active = other(b.active);
  for (const u of b.units) {
    if (u.side === b.active) {
      u.moved = false;
      u.acted = false;
    }
  }
  if (b.active === 'attacker') {
    b.round++;
    if (b.round > maxRounds(b)) {
      b.outcome = 'defender';
      b.log.push('The attack stalls. The defenders hold.');
      return;
    }
  }
  startSideTurn(b);
}

/** Let AI-controlled sides play until it is the player's turn or the battle ends. */
export function runAI(b: Battle) {
  while (!b.outcome && isAI(b, b.active)) {
    aiSide(b);
    endSideTurn(b);
  }
}

export function playerEndTurn(b: Battle) {
  endSideTurn(b);
  runAI(b);
}

/** Fight the battle out with the AI on both sides. */
export function autoResolve(b: Battle) {
  while (!b.outcome) {
    aiSide(b);
    endSideTurn(b);
  }
}

function aiSide(b: Battle) {
  // Missile troops and casters act first so melee troops don't block them.
  const reach = (u: BattleUnit) => Math.max(rangeOf(b, u), knownSpells(u).length ? 5 : 0);
  const units = fighting(b, b.active).sort((x, y) => reach(y) - reach(x));
  for (const u of units) {
    if (b.outcome) return;
    if (u.men > 0 && !u.routing && !u.fled) aiUnit(b, u);
  }
}

function nearestEnemyDistance(b: Battle, h: Hex, side: Side): number {
  return Math.min(...alive(b, other(side)).map((e) => hexDistance(h, e)));
}

/** Score the same legal previews used by the player, including friendly-fire costs. */
function aiSpell(b: Battle, u: BattleUnit): boolean {
  let best: { id: SpellId; target: BattleUnit; destination?: Hex; score: number } | null = null;
  for (const id of knownSpells(u)) for (const target of spellTargets(b, u, id)) {
    const destinations = id === 'teleport' ? teleportDestinations(b, u, target) : [undefined];
    for (const destination of destinations) {
      const preview = previewSpell(b, u, id, target, destination);
      if (!preview) continue;
      let score = 0;
      for (const hit of preview.impacts) {
        const friendly = hit.unit.side === u.side;
        score += hit.damage * (friendly ? -2 : 1) + hit.healing;
        const near = nearestEnemyDistance(b, hit.unit, hit.unit.side);
        if (hit.add === 'ward' && near <= 5) score += friendly ? 4 : -4;
        if (hit.add === 'haste' && near > 1 && near <= 8 && !hit.unit.moved) score += 4;
        if ((hit.add === 'slow' || hit.add === 'entangle' || hit.add === 'frost') && near > 1 && near <= 6 && !hasEffect(hit.unit, hit.add)) score += 3;
        score += hit.remove.length * 3;
      }
      if (id === 'terror') score += target.morale < 65 ? 7 : 3;
      if (id === 'rally') score += target.routing ? 20 : Math.max(0, (65 - target.morale) / 4);
      if (preview.breaksWalls) score += u.side === 'attacker' ? 4 : -4;
      if (destination) {
        const before = nearestEnemyDistance(b, target, u.side), after = nearestEnemyDistance(b, destination, u.side);
        if (isHero(target.type) && target.men < target.maxMen / 2 && before <= 2 && after >= 4) score += 10;
        else if (!target.moved && !target.acted && !knownSpells(target).length && rangeOf(b, target) === 1 && before - after >= 2 && after <= 2) score += 4;
      }
      score -= spellCost(u, id) * 0.3;
      if (score > 0 && (!best || score > best.score)) best = { id, target, destination, score };
    }
  }
  return !!best && castSpell(b, u.id, best.id, best.target.id, best.destination);
}

/**
 * Boulder throwers telegraph: one turn they take aim (and say so), the next they throw if the target is still in
 * reach. A target moved out of reach makes them give up the aim. Returns true if the unit spent its turn.
 */
function aiBoulder(b: Battle, u: BattleUnit, boulder: NonNullable<(typeof UNIT_TYPES)[string]['boulder']>): boolean {
  if (nextToEnemy(b, u, u.side)) {
    delete u.aim;
    return false;
  }
  const aimed = u.aim === undefined ? undefined : b.units.find((x) => x.id === u.aim);
  delete u.aim;
  if (aimed && aimed.men > 0 && !aimed.fled && hexDistance(u, aimed) <= boulder.range) {
    const killed = rollDamage(b, u, aimed, boulder.factor);
    b.log.push(`${unitLabel(b, u)} hurls a boulder at ${unitLabel(b, aimed)}: ${killed} ${isHero(aimed.type) ? 'wounds' : 'fall'}.${takeLosses(b, aimed, killed)}`);
    u.moved = true;
    u.acted = true;
    u.deeds++;
    checkOutcome(b);
    return true;
  }
  if (aimed) return false;
  const inReach = alive(b, other(u.side)).filter((e) => hexDistance(u, e) <= boulder.range);
  if (!inReach.length) return false;
  // The biggest formation in reach; heroes only when no formation is (a boulder shouldn't quietly end a reign).
  const formations = inReach.filter((e) => !isHero(e.type));
  const target = (formations.length ? formations : inReach).reduce((a, c) => (c.men > a.men ? c : a));
  u.aim = target.id;
  u.moved = true;
  u.acted = true;
  b.log.push(`${unitLabel(b, u)} heaves up a boulder and takes aim at ${unitLabel(b, target)}. Get them out of reach!`);
  return true;
}

/** How close the enemy must come before a holding formation moves. */
export const HOLD_RANGE = 3;

/**
 * Whether this formation holds its ground this turn under its side's stance: Defensive armies hold until the
 * enemy is within HOLD_RANGE; Skirmish melee hold the same way to guard the archers, whose own fire keeps them
 * at a distance. Offensive and Custom armies advance.
 */
export function holdsGround(b: Battle, u: BattleUnit): boolean {
  const stance = b.stances?.[u.side] ?? 'offensive';
  const missile = UNIT_TYPES[u.type].range > 1 && !isHero(u.type);
  if (stance === 'defensive' || (stance === 'skirmish' && !missile)) {
    return nearestEnemyDistance(b, u, u.side) > HOLD_RANGE;
  }
  return false;
}

function aiUnit(b: Battle, u: BattleUnit) {
  const boulder = UNIT_TYPES[u.type].boulder;
  if (boulder && aiBoulder(b, u, boulder)) return;
  if (holdsGround(b, u)) {
    // Hold: cast or shoot from where they stand, but don't advance.
    if (knownSpells(u).length > 0 && u.mana >= 2 && aiSpell(b, u)) return;
    const inReach = attackTargets(b, u);
    if (inReach.length) attack(b, u.id, inReach.reduce((a, c) => ((c.routing ? 0 : c.men) < (a.routing ? 0 : a.men) ? c : a)).id);
    return;
  }
  const caster = knownSpells(u).length > 0 && u.mana >= 2;
  if (caster && aiSpell(b, u)) return;
  // Casters with mana hang back at spell range; archers at bow range; everyone else closes in.
  const range = caster ? 4 : rangeOf(b, u);
  const score = (h: Hex) => {
    const d = nearestEnemyDistance(b, h, u.side);
    const g = terrainAt(b, h);
    // Ground only breaks ties between hexes the same distance from the enemy.
    const ground = -0.2 * g.defense + (g.moveLoss ? 0.3 : 0) + (g.moraleDrain ? 0.3 : 0) - (g.heal ? 0.3 : 0);
    if (range === 1) return d + ground;
    return (d < 2 ? 100 : Math.abs(d - range)) + ground;
  };
  let targets = attackTargets(b, u);
  if (targets.length === 0 || caster) {
    let best: Hex | null = null;
    let bestScore = score(u);
    for (const k of reachable(b, u).keys()) {
      const [col, row] = k.split(',').map(Number);
      const s = score({ col, row });
      if (s < bestScore) {
        bestScore = s;
        best = { col, row };
      }
    }
    if (best) moveUnit(b, u.id, best);
    if (caster && aiSpell(b, u)) return;
    targets = attackTargets(b, u);
  }
  if (targets.length) {
    // Finish off running troops first, then go for the weakest.
    const weakest = targets.reduce((a, c) => ((c.routing ? 0 : c.men) < (a.routing ? 0 : a.men) ? c : a));
    attack(b, u.id, weakest.id);
  }
}
