import { describe, expect, it } from 'vitest';
import { alive, attackTargets, createBattle, defenseOf, endSideTurn, moveUnit, rangeOf, reachable, deploymentZone } from './battle';
import { makeTroop, newGame } from './campaign';
import type { Army, Battle, BattleUnit, Terrain } from './types';

function battle(attackers: string[], defenders: string[], seed = 11): { b: Battle; mine: BattleUnit[]; foes: BattleUnit[] } {
  const s = newGame(1);
  const mk = (owner: Army['owner'], types: string[]): Army => {
    const a: Army = { id: s.nextId++, owner, at: 'x', from: null, troops: types.map((t) => makeTroop(s, t)) };
    s.armies.push(a);
    return a;
  };
  const b = createBattle('x', mk('player', attackers), mk('orcs', defenders), false, seed);
  // Start every test from a clean, open field.
  for (const col of b.terrain) col.fill('plain');
  return { b, mine: alive(b, 'attacker'), foes: alive(b, 'defender') };
}

function put(u: BattleUnit, col: number, row: number) {
  u.col = col;
  u.row = row;
}

function ground(b: Battle, col: number, row: number, kind: Terrain) {
  b.terrain[col][row] = kind;
}

describe('battlefield generation', () => {
  it('keeps the deployment columns open and is the same for the same seed', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = newGame(1);
      const a: Army = { id: 1, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'militia')] };
      const d: Army = { id: 2, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'warband')] };
      const one = createBattle('x', a, d, false, seed);
      const two = createBattle('x', a, d, false, seed);
      expect(one.terrain).toEqual(two.terrain);
      for (const side of ['attacker', 'defender'] as const) {
        const zone = deploymentZone(one, side);
        for (const col of zone.cols) for (let row = zone.top; row < zone.top + 9; row++) expect(one.terrain[col][row]).toBe('plain');
      }
    }
  });

  it('produces streams, springs and the other features across many fields', () => {
    const seen = new Set<Terrain>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGame(1);
      const a: Army = { id: 1, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'militia')] };
      const d: Army = { id: 2, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'warband')] };
      for (const t of createBattle('x', a, d, false, seed).terrain.flat()) seen.add(t);
    }
    expect([...seen].sort()).toEqual(['forest', 'hill', 'marsh', 'plain', 'rocks', 'ruins', 'spring', 'stream', 'thorns']);
  });
});

describe('terrain effects', () => {
  it('rocks cannot be entered', () => {
    const { b, mine } = battle(['militia'], ['warband']);
    put(mine[0], 4, 4);
    ground(b, 5, 4, 'rocks');
    expect(reachable(b, mine[0]).has('5,4')).toBe(false);
  });

  it('marsh costs 3 to enter, so a 3-move troop stops there', () => {
    const { b, mine } = battle(['militia'], ['warband']);
    put(mine[0], 4, 4);
    for (let col = 5; col <= 7; col++) ground(b, col, 4, 'marsh');
    const reach = reachable(b, mine[0]);
    expect(reach.get('5,4')).toBe(3);
    expect(reach.has('6,4')).toBe(false);
  });

  it('ruins, forest and streams change defense', () => {
    const { b, mine } = battle(['spearmen'], ['warband']);
    const base = defenseOf(b, mine[0]);
    ground(b, mine[0].col, mine[0].row, 'ruins');
    expect(defenseOf(b, mine[0])).toBe(base + 2);
    ground(b, mine[0].col, mine[0].row, 'stream');
    expect(defenseOf(b, mine[0])).toBe(base - 1);
  });

  it('missile troops on a hill shoot one hex farther', () => {
    const { b, mine, foes } = battle(['archers'], ['warband']);
    put(mine[0], 2, 4);
    put(foes[0], 7, 4);
    expect(rangeOf(b, mine[0])).toBe(4);
    expect(attackTargets(b, mine[0])).toHaveLength(0);
    ground(b, 2, 4, 'hill');
    expect(rangeOf(b, mine[0])).toBe(5);
    expect(attackTargets(b, mine[0])).toContain(foes[0]);
  });

  it('moving into thorns costs men but never the last one', () => {
    const { b, mine } = battle(['militia'], ['warband']);
    put(mine[0], 4, 4);
    ground(b, 5, 4, 'thorns');
    expect(moveUnit(b, mine[0].id, { col: 5, row: 4 })).toBe(true);
    expect(mine[0].men).toBe(18);
    mine[0].men = 1;
    mine[0].moved = false;
    ground(b, 6, 4, 'thorns');
    moveUnit(b, mine[0].id, { col: 6, row: 4 });
    expect(mine[0].men).toBe(1);
  });

  it('a holy spring restores lost men at the start of the turn, up to starting strength', () => {
    const { b, mine } = battle(['militia'], ['warband']);
    ground(b, mine[0].col, mine[0].row, 'spring');
    mine[0].men = 15;
    b.active = 'defender';
    endSideTurn(b);
    expect(mine[0].men).toBe(18);
    mine[0].men = 19;
    b.active = 'defender';
    endSideTurn(b);
    expect(mine[0].men).toBe(20);
  });

  it('marsh wears down morale each turn', () => {
    const { b, mine } = battle(['militia'], ['warband']);
    ground(b, mine[0].col, mine[0].row, 'marsh');
    const before = mine[0].morale;
    b.active = 'defender';
    endSideTurn(b);
    // Loses 5 to the marsh, regains the usual 3.
    expect(mine[0].morale).toBe(before - 2);
  });
});
