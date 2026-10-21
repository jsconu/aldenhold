import { EFFECTS } from '../content/spells';
import { LAND, SPELLS, TERRAIN, UNIT_TYPES } from './data';
import { hexDistance, hexKey, hexNeighbors, hexLine, type Hex } from './hex';
import { random } from './rng';
import { FACTIONS } from '../content/factions';
import type { Army, Battle, BattleUnit, Land, Side, SpellId, Terrain, EffectId } from './types';
import { attackFor, heroLevel, heroMaxHp, isHero, kitBonus, level } from './units';
import { EQUIPMENT } from './equipment';

export const BATTLE_W = 12;
export const BATTLE_H = 9;
export const FIELD_LIMIT = 3 * BATTLE_H;
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

export function createBattle(at: string, attacker: Army, defender: Army, walls: boolean, seed: number, land: Land = 'plains'): Battle {
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
  b.terrain = generateTerrain(b, land);
  deploy(b, attacker, 'attacker', [2, 1, 0]);
  deploy(b, defender, 'defender', [BATTLE_W - 3, BATTLE_W - 2, BATTLE_W - 1]);
  return b;
}

export function leadershipOf(army: Army): number {
  return Math.max(0, ...army.troops.map((t) => (t.men > 0 ? (UNIT_TYPES[t.type].hero?.leadership ?? 0) + kitBonus(t.kit).leadership : 0)));
}

/** The middle of the field gets features shaped by the land outside; the three columns at each edge stay open. */
function generateTerrain(rng: { seed: number }, land: Land): Terrain[][] {
  const { battleScatter, battleStream } = LAND[land];
  const t: Terrain[][] = Array.from({ length: BATTLE_W }, () => Array<Terrain>(BATTLE_H).fill('plain'));
  const middle = (col: number) => col >= 3 && col < BATTLE_W - 3;
  for (let col = 3; col < BATTLE_W - 3; col++) {
    for (let row = 0; row < BATTLE_H; row++) {
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
  // Some fields have a stream winding from top to bottom; how often depends on the land.
  if (random(rng) < battleStream) {
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
  if (isHero(type) || UNIT_TYPES[type].fearless) return 100;
  const walls = b.walls && side === 'defender' ? 10 : 0;
  return Math.min(100, 60 + 8 * (level(xp) - 1) + leadership + walls);
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
    if (slot) taken.add(hexKey(slot));
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

/** Enemies the unit can strike now: adjacent ones, or ones in missile range if it isn't engaged. */
export function attackTargets(b: Battle, u: BattleUnit): BattleUnit[] {
  if (u.reserve || u.acted || u.men <= 0 || u.fled || u.routing) return [];
  const range = rangeOf(b, u);
  const engaged = nextToEnemy(b, u, u.side);
  return alive(b, other(u.side)).filter((e) => {
    const d = hexDistance(u, e);
    return d === 1 || (range > 1 && !engaged && d <= range);
  });
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
  const ground = terrainAt(b, u);
  const lost = Math.min(ground.moveLoss, u.men - 1);
  if (lost > 0) b.log.push(`${unitLabel(b, u)} push into the ${ground.name.toLowerCase()}: ${lost} ${isHero(u.type) ? 'wounds' : 'men hurt'}.${takeLosses(b, u, lost)}`);
  return true;
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

function aiUnit(b: Battle, u: BattleUnit) {
  const boulder = UNIT_TYPES[u.type].boulder;
  if (boulder && aiBoulder(b, u, boulder)) return;
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
