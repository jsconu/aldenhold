import { describe, expect, it } from 'vitest';
import { LAND, TERRAIN } from '../content/rules';
import { renderBattle } from '../ui/battleView';
import type { UIState } from '../ui/shared';
import { BATTLE_SIZES, battleSize, createBattle, deploymentZone, endSideTurn, maxRounds, ZONE_ROWS } from './battle';
import { makeTroop, newGame } from './campaign';
import { hexKey, hexNeighbors } from './hex';
import { parseSave } from './saves';
import type { Army, Battle, GameState, Land } from './types';

function armies(s: GameState, mine: number, theirs: number): [Army, Army] {
  return [
    { id: 900, owner: 'player', at: 'x', from: null, troops: Array.from({ length: mine }, () => makeTroop(s, 'militia')) },
    { id: 901, owner: 'orcs', at: 'x', from: null, troops: Array.from({ length: theirs }, () => makeTroop(s, 'warband')) },
  ];
}

/** Whether ground connects the two deployment zones. */
function connected(b: Battle): boolean {
  const a = deploymentZone(b, 'attacker');
  const d = deploymentZone(b, 'defender');
  const start = { col: a.cols[0], row: a.top + 4 };
  const seen = new Set([hexKey(start)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (d.cols.includes(cur.col) && cur.row >= d.top && cur.row < d.top + ZONE_ROWS) return true;
    for (const n of hexNeighbors(cur)) {
      if (n.col < 0 || n.row < 0 || n.col >= b.width || n.row >= b.height || seen.has(hexKey(n)) || TERRAIN[b.terrain[n.col][n.row]].move === Infinity) continue;
      seen.add(hexKey(n));
      queue.push(n);
    }
  }
  return false;
}

describe('bigger battlefields', () => {
  it('sizes the field by the fight: skirmish, field or major (walls too)', () => {
    const s = newGame(1, 'western-realm');
    expect(battleSize(...armies(s, 3, 3), false)).toBe('skirmish');
    expect(battleSize(...armies(s, 5, 6), false)).toBe('field');
    expect(battleSize(...armies(s, 8, 8), false)).toBe('major');
    expect(battleSize(...armies(s, 2, 1), true)).toBe('major');
    const b = createBattle('x', ...armies(s, 5, 6), false, 3);
    expect([b.width, b.height]).toEqual([24, 16]);
    expect(maxRounds(b)).toBe(22);
  });

  it('keeps the two deployment zones in the middle, their fronts 7 columns apart, and the armies inside them', () => {
    const s = newGame(1, 'western-realm');
    for (const [mine, theirs] of [[2, 2], [6, 6], [10, 10]]) {
      const b = createBattle('x', ...armies(s, mine, theirs), false, 3);
      const a = deploymentZone(b, 'attacker');
      const d = deploymentZone(b, 'defender');
      expect(d.cols[0] - a.cols[0]).toBe(7);
      for (const u of b.units) {
        const z = u.side === 'attacker' ? a : d;
        expect(z.cols).toContain(u.col);
        expect(u.row).toBeGreaterThanOrEqual(z.top);
        expect(u.row).toBeLessThan(z.top + ZONE_ROWS);
      }
    }
  });

  it('every land makes varied, connected ground and leaves the deployment zones open', () => {
    const s = newGame(1, 'western-realm');
    for (const land of Object.keys(LAND) as Land[]) {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const b = createBattle('x', ...armies(s, 6, 6), false, seed, land);
        expect(connected(b)).toBe(true);
        for (const side of ['attacker', 'defender'] as const) {
          const z = deploymentZone(b, side);
          for (const col of z.cols) for (let row = z.top; row < z.top + ZONE_ROWS; row++) expect(b.terrain[col][row]).toBe('plain');
        }
        for (const col of b.terrain) for (const t of col) kinds.add(t);
      }
      expect(kinds.size, land).toBeGreaterThanOrEqual(3);
    }
  });

  it('an attack stalls at the field’s own round limit', () => {
    const s = newGame(1, 'western-realm');
    const b = createBattle('x', ...armies(s, 8, 8), false, 3);
    b.round = maxRounds(b);
    b.active = 'defender';
    endSideTurn(b);
    expect(b.outcome).toBe('defender');
  });

  it('old 12x9 battles in saves still load, and odd sizes are rejected', () => {
    const s = newGame(1);
    const ids = s.armies.find((a) => a.at === 'aldenhold' && a.owner === 'player')!;
    const foe: Army = { id: s.nextId++, owner: 'orcs', at: 'aldenhold', from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(foe);
    const b = createBattle('aldenhold', ids, foe, false, 3);
    s.battle = b;
    expect(() => parseSave(JSON.stringify(s))).not.toThrow();
    const legacy = structuredClone(s);
    legacy.battle!.width = BATTLE_SIZES.legacy.width;
    legacy.battle!.height = BATTLE_SIZES.legacy.height;
    legacy.battle!.terrain = Array.from({ length: 12 }, () => Array(9).fill('plain'));
    legacy.battle!.units.forEach((u, i) => { u.col = u.side === 'attacker' ? 1 : 10; u.row = i % 9; });
    expect(() => parseSave(JSON.stringify(legacy))).not.toThrow();
    const odd = structuredClone(s);
    odd.battle!.width = 13;
    expect(() => parseSave(JSON.stringify(odd))).toThrow(/battle map/);
  });

  it('draws the field at a readable size in a scrolling frame, with a minimap and its own round limit', () => {
    const s = newGame(1, 'western-realm');
    const [mine, theirs] = armies(s, 5, 6);
    s.armies.push(mine, theirs);
    s.battle = createBattle('x', mine, theirs, false, 3);
    const ui: UIState = { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
    const html = renderBattle(s, ui);
    expect(html).toContain('class="field-wrap battle-scroll"');
    expect(html).toMatch(/<svg viewBox="0 0 (\d+) (\d+)" class="field" width="\1"/);
    expect(html).toContain('data-action="minimap"');
    expect(html).toContain('24×16 field');
    expect(html).toContain('Round 1 of 22');
    expect(renderBattle(s, { ...ui, battleZoom: 0.5 })).toMatch(/class="field" width="\d+"/);
  });
});
