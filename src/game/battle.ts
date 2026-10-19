import { UNIT_TYPES } from './data';
import { hexDistance, hexKey, hexNeighbors, type Hex } from './hex';
import { random } from './rng';
import type { Army, Battle, BattleUnit, FactionId, Side, Terrain } from './types';

export const BATTLE_W = 12;
export const BATTLE_H = 9;
export const MAX_ROUNDS = 20;

const MOVE_COST: Record<Terrain, number> = { plain: 1, forest: 2, hill: 2 };
const TERRAIN_DEF: Record<Terrain, number> = { plain: 0, forest: 1, hill: 1 };
/** Fill rows from the middle outward so small armies stand in the centre. */
const ROW_ORDER = [4, 3, 5, 2, 6, 1, 7, 0, 8];

export function other(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

export function createBattle(at: string, attacker: Army, defender: Army, walls: boolean, seed: number): Battle {
  const b: Battle = {
    at,
    attackerId: attacker.id,
    defenderId: defender.id,
    owners: { attacker: attacker.owner, defender: defender.owner },
    width: BATTLE_W,
    height: BATTLE_H,
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
  for (let col = 0; col < BATTLE_W; col++) {
    const column: Terrain[] = [];
    for (let row = 0; row < BATTLE_H; row++) {
      const r = random(b);
      const deployZone = col < 3 || col >= BATTLE_W - 3;
      column.push(deployZone ? 'plain' : r < 0.12 ? 'forest' : r < 0.2 ? 'hill' : 'plain');
    }
    b.terrain.push(column);
  }
  deploy(b, attacker, 'attacker', [2, 1, 0]);
  deploy(b, defender, 'defender', [BATTLE_W - 3, BATTLE_W - 2, BATTLE_W - 1]);
  return b;
}

function deploy(b: Battle, army: Army, side: Side, cols: number[]) {
  // Melee fill from the front column, missile troops from the second column back.
  const front = cols.flatMap((col) => ROW_ORDER.map((row) => ({ col, row })));
  const rear = [...front.slice(ROW_ORDER.length), ...front.slice(0, ROW_ORDER.length)];
  const taken = new Set<string>();
  const place = (order: Hex[]) => order.find((h) => !taken.has(hexKey(h)));
  army.troops.forEach((t) => {
    const slot = place(UNIT_TYPES[t.type].range > 1 ? rear : front);
    if (!slot) return;
    taken.add(hexKey(slot));
    b.units.push({
      id: b.units.length + 1,
      side,
      armyId: army.id,
      troopId: t.id,
      type: t.type,
      men: t.men,
      startMen: t.men,
      xp: t.xp,
      col: slot.col,
      row: slot.row,
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

export function alive(b: Battle, side?: Side): BattleUnit[] {
  return b.units.filter((u) => u.men > 0 && (!side || u.side === side));
}

export function unitAt(b: Battle, h: Hex): BattleUnit | undefined {
  return b.units.find((u) => u.men > 0 && u.col === h.col && u.row === h.row);
}

export function level(xp: number): number {
  return Math.min(3, Math.floor(xp / 2));
}

export function attackOf(u: BattleUnit): number {
  return UNIT_TYPES[u.type].attack * (1 + 0.15 * level(u.xp));
}

export function defenseOf(b: Battle, u: BattleUnit): number {
  const wall = b.walls && u.side === 'defender' ? 1 : 0;
  return UNIT_TYPES[u.type].defense + TERRAIN_DEF[b.terrain[u.col][u.row]] + wall;
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

/** Hexes the unit can move to this turn, with their movement cost. Enemies exert a zone of control. */
export function reachable(b: Battle, u: BattleUnit): Map<string, number> {
  const result = new Map<string, number>();
  if (u.moved || u.acted || u.men <= 0) return result;
  const budget = UNIT_TYPES[u.type].move;
  const best = new Map<string, number>([[hexKey(u), 0]]);
  const frontier: (Hex & { cost: number })[] = [{ col: u.col, row: u.row, cost: 0 }];
  while (frontier.length) {
    frontier.sort((a, c) => a.cost - c.cost);
    const cur = frontier.shift()!;
    const isStart = cur.col === u.col && cur.row === u.row;
    if (!isStart && nextToEnemy(b, cur, u.side)) continue;
    for (const n of hexNeighbors(cur)) {
      if (!inBounds(b, n) || unitAt(b, n)) continue;
      const cost = cur.cost + MOVE_COST[b.terrain[n.col][n.row]];
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

/** Enemies the unit can strike now: adjacent ones, or ones in missile range if it isn't engaged. */
export function attackTargets(b: Battle, u: BattleUnit): BattleUnit[] {
  if (u.acted || u.men <= 0) return [];
  const range = UNIT_TYPES[u.type].range;
  const engaged = nextToEnemy(b, u, u.side);
  return alive(b, other(u.side)).filter((e) => {
    const d = hexDistance(u, e);
    return d === 1 || (range > 1 && !engaged && d <= range);
  });
}

export function moveUnit(b: Battle, unitId: number, to: Hex): boolean {
  const u = b.units.find((x) => x.id === unitId);
  if (!u || b.outcome || u.side !== b.active) return false;
  if (!reachable(b, u).has(hexKey(to))) return false;
  u.col = to.col;
  u.row = to.row;
  u.moved = true;
  return true;
}

function strike(b: Battle, from: BattleUnit, to: BattleUnit, factor: number): number {
  const roll = 0.7 + random(b) * 0.6;
  const raw = (from.men * attackOf(from) * roll * factor) / (defenseOf(b, to) * 4);
  const killed = Math.min(to.men, Math.max(1, Math.round(raw)));
  to.men -= killed;
  return killed;
}

export function unitLabel(b: Battle, u: BattleUnit): string {
  const owner = b.owners[u.side] === 'player' ? 'Your' : factionAdj(b.owners[u.side]);
  return `${owner} ${UNIT_TYPES[u.type].name}`;
}

function factionAdj(f: FactionId): string {
  return f === 'orcs' ? 'Enemy' : f === 'neutral' ? 'Town' : 'Your';
}

export function attack(b: Battle, unitId: number, targetId: number): boolean {
  const u = b.units.find((x) => x.id === unitId);
  const t = b.units.find((x) => x.id === targetId);
  if (!u || !t || b.outcome || u.side !== b.active) return false;
  if (!attackTargets(b, u).includes(t)) return false;
  const melee = hexDistance(u, t) === 1;
  const killed = strike(b, u, t, 1);
  let line = `${unitLabel(b, u)} ${melee ? 'charge' : 'shoot at'} ${unitLabel(b, t)}: ${killed} fall.`;
  if (t.men <= 0) line += ` ${unitLabel(b, t)} are wiped out.`;
  else if (melee) {
    const back = strike(b, t, u, 0.5);
    line += ` They strike back: ${back} fall.`;
    if (u.men <= 0) line += ` ${unitLabel(b, u)} are wiped out.`;
  }
  b.log.push(line);
  u.moved = true;
  u.acted = true;
  checkOutcome(b);
  return true;
}

function checkOutcome(b: Battle) {
  if (b.outcome) return;
  if (alive(b, 'defender').length === 0) b.outcome = 'attacker';
  else if (alive(b, 'attacker').length === 0) b.outcome = 'defender';
}

export function retreat(b: Battle, side: Side) {
  if (b.outcome) return;
  b.retreated = side;
  b.outcome = other(side);
  b.log.push(`${side === playerSide(b) ? 'You fall' : 'The enemy falls'} back.`);
}

export function endSideTurn(b: Battle) {
  if (b.outcome) return;
  b.active = other(b.active);
  for (const u of b.units) {
    if (u.side === b.active) {
      u.moved = false;
      u.acted = false;
    }
  }
  if (b.active === 'attacker') {
    b.round++;
    if (b.round > MAX_ROUNDS) {
      b.outcome = 'defender';
      b.log.push('The attack stalls. The defenders hold.');
    }
  }
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
  // Missile troops act first so melee troops don't block their shots.
  const units = alive(b, b.active).sort((x, y) => UNIT_TYPES[y.type].range - UNIT_TYPES[x.type].range);
  for (const u of units) {
    if (b.outcome) return;
    if (u.men > 0) aiUnit(b, u);
  }
}

function nearestEnemyDistance(b: Battle, h: Hex, side: Side): number {
  return Math.min(...alive(b, other(side)).map((e) => hexDistance(h, e)));
}

function aiUnit(b: Battle, u: BattleUnit) {
  const range = UNIT_TYPES[u.type].range;
  const score = (h: Hex) => {
    const d = nearestEnemyDistance(b, h, u.side);
    if (range === 1) return d;
    return d < 2 ? 100 : Math.abs(d - range);
  };
  let targets = attackTargets(b, u);
  if (targets.length === 0) {
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
    targets = attackTargets(b, u);
  }
  if (targets.length) {
    const weakest = targets.reduce((a, c) => (c.men < a.men ? c : a));
    attack(b, u.id, weakest.id);
  }
}
