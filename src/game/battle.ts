import { SPELLS, TERRAIN, UNIT_TYPES } from './data';
import { hexDistance, hexKey, hexNeighbors, type Hex } from './hex';
import { random } from './rng';
import type { Army, Battle, BattleUnit, FactionId, Side, SpellId, Terrain } from './types';
import { attackFor, heroLevel, heroMaxHp, isHero, level } from './units';

export const BATTLE_W = 12;
export const BATTLE_H = 9;
export const MAX_ROUNDS = 20;
/** A troop whose morale drops below this breaks and runs. */
export const ROUT_AT = 25;
/** A running troop stops and turns to fight again once morale climbs back to this. */
export const RALLY_AT = 45;

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
  b.terrain = generateTerrain(b);
  deploy(b, attacker, 'attacker', [2, 1, 0]);
  deploy(b, defender, 'defender', [BATTLE_W - 3, BATTLE_W - 2, BATTLE_W - 1]);
  return b;
}

export function leadershipOf(army: Army): number {
  return Math.max(0, ...army.troops.map((t) => (t.men > 0 ? UNIT_TYPES[t.type].hero?.leadership ?? 0 : 0)));
}

/** Weights for scattering single features over the middle of the field. */
const SCATTER: [Terrain, number][] = [['forest', 0.1], ['hill', 0.06], ['marsh', 0.035], ['thorns', 0.03], ['ruins', 0.02], ['rocks', 0.03]];

/** Middle of the field gets features; the three columns at each edge stay open for deployment. */
function generateTerrain(rng: { seed: number }): Terrain[][] {
  const t: Terrain[][] = Array.from({ length: BATTLE_W }, () => Array<Terrain>(BATTLE_H).fill('plain'));
  const middle = (col: number) => col >= 3 && col < BATTLE_W - 3;
  for (let col = 3; col < BATTLE_W - 3; col++) {
    for (let row = 0; row < BATTLE_H; row++) {
      let r = random(rng);
      for (const [kind, weight] of SCATTER) {
        if (r < weight) {
          t[col][row] = kind;
          break;
        }
        r -= weight;
      }
    }
  }
  // Half the fields have a stream winding from top to bottom.
  if (random(rng) < 0.5) {
    let col = 5 + Math.floor(random(rng) * 2);
    for (let row = 0; row < BATTLE_H; row++) {
      t[col][row] = 'stream';
      const drift = random(rng);
      const next = drift < 0.25 ? col - 1 : drift > 0.75 ? col + 1 : col;
      if (middle(next) && next >= 4 && next <= BATTLE_W - 5) col = next;
    }
  }
  // Some fields have a holy spring.
  if (random(rng) < 0.4) {
    const col = 4 + Math.floor(random(rng) * (BATTLE_W - 8));
    const row = Math.floor(random(rng) * BATTLE_H);
    t[col][row] = 'spring';
  }
  return t;
}

export function terrainAt(b: Battle, h: Hex) {
  return TERRAIN[b.terrain[h.col][h.row]];
}

function startingMorale(b: Battle, side: Side, type: string, xp: number, leadership: number): number {
  if (isHero(type)) return 100;
  const walls = b.walls && side === 'defender' ? 10 : 0;
  return Math.min(100, 60 + 8 * level(xp) + leadership + walls);
}

function deploy(b: Battle, army: Army, side: Side, cols: number[]) {
  // Melee fill from the front column; missile troops and spellcasters from the second column back.
  const front = cols.flatMap((col) => ROW_ORDER.map((row) => ({ col, row })));
  const rear = [...front.slice(ROW_ORDER.length), ...front.slice(0, ROW_ORDER.length)];
  const taken = new Set<string>();
  const place = (order: Hex[]) => order.find((h) => !taken.has(hexKey(h)));
  const leadership = leadershipOf(army);
  army.troops.forEach((t) => {
    const type = UNIT_TYPES[t.type];
    const behind = type.range > 1 || (type.hero?.spells.length ?? 0) > 0;
    const slot = place(behind ? rear : front);
    if (!slot) return;
    taken.add(hexKey(slot));
    b.units.push({
      id: b.units.length + 1,
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
      morale: startingMorale(b, side, t.type, t.xp, leadership),
      routing: false,
      fled: false,
      deeds: 0,
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

/** Units still on the field (including ones that are running). */
export function alive(b: Battle, side?: Side): BattleUnit[] {
  return b.units.filter((u) => u.men > 0 && !u.fled && (!side || u.side === side));
}

/** Units on the field that are still fighting. */
export function fighting(b: Battle, side: Side): BattleUnit[] {
  return alive(b, side).filter((u) => !u.routing);
}

export function unitAt(b: Battle, h: Hex): BattleUnit | undefined {
  return b.units.find((u) => u.men > 0 && !u.fled && u.col === h.col && u.row === h.row);
}

export function attackOf(u: BattleUnit): number {
  return attackFor(u.type, u.xp);
}

export function defenseOf(b: Battle, u: BattleUnit): number {
  const wall = b.walls && u.side === 'defender' ? 1 : 0;
  return Math.max(1, UNIT_TYPES[u.type].defense + terrainAt(b, u).defense + wall);
}

/** Fighting weight: men for a troop, a fixed value for a hero (wounds don't weaken their blows). */
function powerOf(u: BattleUnit): number {
  return UNIT_TYPES[u.type].hero?.power ?? u.men;
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
  if (u.moved || u.acted || u.men <= 0 || u.fled || u.routing) return new Map();
  return reachFrom(b, u);
}

/** Enemies the unit can strike now: adjacent ones, or ones in missile range if it isn't engaged. */
export function attackTargets(b: Battle, u: BattleUnit): BattleUnit[] {
  if (u.acted || u.men <= 0 || u.fled || u.routing) return [];
  const range = rangeOf(b, u);
  const engaged = nextToEnemy(b, u, u.side);
  return alive(b, other(u.side)).filter((e) => {
    const d = hexDistance(u, e);
    return d === 1 || (range > 1 && !engaged && d <= range);
  });
}

/** Missile range, including the bonus for standing on high ground. Melee troops stay at 1. */
export function rangeOf(b: Battle, u: BattleUnit): number {
  const range = UNIT_TYPES[u.type].range;
  return range > 1 ? range + terrainAt(b, u).rangeBonus : range;
}

export function moveUnit(b: Battle, unitId: number, to: Hex): boolean {
  const u = b.units.find((x) => x.id === unitId);
  if (!u || b.outcome || u.side !== b.active) return false;
  if (!reachable(b, u).has(hexKey(to))) return false;
  u.col = to.col;
  u.row = to.row;
  u.moved = true;
  const ground = terrainAt(b, u);
  const lost = Math.min(ground.moveLoss, u.men - 1);
  if (lost > 0) b.log.push(`${unitLabel(b, u)} push into the ${ground.name.toLowerCase()}: ${lost} ${isHero(u.type) ? 'wounds' : 'men hurt'}.${takeLosses(b, u, lost)}`);
  return true;
}

export function unitLabel(b: Battle, u: BattleUnit): string {
  if (u.name) return u.name;
  const owner = b.owners[u.side] === 'player' ? 'Your' : factionAdj(b.owners[u.side]);
  return `${owner} ${UNIT_TYPES[u.type].name}`;
}

function factionAdj(f: FactionId): string {
  return f === 'orcs' ? 'Enemy' : f === 'neutral' ? 'Town' : 'Your';
}

/** Lower a troop's morale; it breaks if morale falls below ROUT_AT. Heroes never break. */
function shake(b: Battle, u: BattleUnit, amount: number) {
  if (isHero(u.type) || u.men <= 0 || u.fled) return;
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
  const raw = (powerOf(from) * attackOf(from) * roll * factor * running) / (defenseOf(b, to) * 4);
  return Math.min(to.men, Math.max(1, Math.round(raw)));
}

export function attack(b: Battle, unitId: number, targetId: number): boolean {
  const u = b.units.find((x) => x.id === unitId);
  const t = b.units.find((x) => x.id === targetId);
  if (!u || !t || b.outcome || u.side !== b.active) return false;
  if (!attackTargets(b, u).includes(t)) return false;
  const melee = hexDistance(u, t) === 1;
  const killed = rollDamage(b, u, t, 1);
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

export function knownSpells(u: BattleUnit): SpellId[] {
  return UNIT_TYPES[u.type].hero?.spells ?? [];
}

/** Units the hero could cast this spell on right now. */
export function spellTargets(b: Battle, u: BattleUnit, spellId: SpellId): BattleUnit[] {
  const spell = SPELLS[spellId];
  if (u.acted || u.men <= 0 || !knownSpells(u).includes(spellId) || u.mana < spell.cost) return [];
  const pool = spell.target === 'enemy' ? alive(b, other(u.side)) : alive(b, u.side);
  return pool.filter((t) => {
    if (hexDistance(u, t) > spell.range) return false;
    if (spellId === 'heal') return t.men < t.maxMen;
    if (spellId === 'rally' || spellId === 'terror') return !isHero(t.type) && (spellId === 'terror' || t.morale < 100);
    return true;
  });
}

export function castSpell(b: Battle, unitId: number, spellId: SpellId, targetId: number): boolean {
  const u = b.units.find((x) => x.id === unitId);
  const t = b.units.find((x) => x.id === targetId);
  if (!u || !t || b.outcome || u.side !== b.active) return false;
  if (!spellTargets(b, u, spellId).includes(t)) return false;
  const lvl = heroLevel(u.xp);
  u.mana -= SPELLS[spellId].cost;
  u.moved = true;
  u.acted = true;
  u.deeds++;
  const who = unitLabel(b, u);
  const whom = unitLabel(b, t);
  switch (spellId) {
    case 'fireball': {
      const dmg = Math.min(t.men, 4 + 2 * lvl);
      b.log.push(`${who} hurls fire at ${whom}: ${dmg} ${isHero(t.type) ? 'wounds' : 'fall'}.${takeLosses(b, t, dmg)}`);
      shake(b, t, 10);
      break;
    }
    case 'terror':
      b.log.push(`${who} fills ${whom} with dread.`);
      shake(b, t, 30 + 5 * lvl);
      break;
    case 'heal': {
      const amount = Math.min(t.maxMen - t.men, 4 + 2 * lvl);
      t.men += amount;
      b.log.push(`${who} heals ${whom}: ${amount} ${isHero(t.type) ? 'wounds mended' : 'men back in the line'}.`);
      break;
    }
    case 'rally':
      t.morale = Math.min(100, t.morale + 40);
      if (t.routing && t.morale >= RALLY_AT) {
        t.routing = false;
        b.log.push(`${who} rallies ${whom}. They turn and fight.`);
      } else {
        b.log.push(`${who} steadies ${whom}.`);
      }
      break;
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
  const reach = (u: BattleUnit) => Math.max(UNIT_TYPES[u.type].range, knownSpells(u).length ? 5 : 0);
  const units = fighting(b, b.active).sort((x, y) => reach(y) - reach(x));
  for (const u of units) {
    if (b.outcome) return;
    if (u.men > 0 && !u.routing && !u.fled) aiUnit(b, u);
  }
}

function nearestEnemyDistance(b: Battle, h: Hex, side: Side): number {
  return Math.min(...alive(b, other(side)).map((e) => hexDistance(h, e)));
}

/** Pick the best spell to cast now, if any. */
function aiSpell(b: Battle, u: BattleUnit): boolean {
  const pick = (spellId: SpellId, choose: (ts: BattleUnit[]) => BattleUnit | undefined) => {
    const t = choose(spellTargets(b, u, spellId));
    return !!t && castSpell(b, u.id, spellId, t.id);
  };
  const most = (score: (t: BattleUnit) => number, min: number) => (ts: BattleUnit[]) => {
    const best = ts.reduce<BattleUnit | undefined>((a, c) => (!a || score(c) > score(a) ? c : a), undefined);
    return best && score(best) >= min ? best : undefined;
  };
  return (
    pick('rally', most((t) => (t.routing ? 100 : 40 - t.morale), 1)) ||
    pick('heal', most((t) => t.maxMen - t.men, 5)) ||
    pick('fireball', most((t) => t.men, 1)) ||
    pick('terror', most((t) => 100 - t.morale, 30))
  );
}

function aiUnit(b: Battle, u: BattleUnit) {
  const caster = knownSpells(u).length > 0 && u.mana >= 2;
  if (caster && aiSpell(b, u)) return;
  // Casters with mana hang back at spell range; archers at bow range; everyone else closes in.
  const range = caster ? 4 : UNIT_TYPES[u.type].range;
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
