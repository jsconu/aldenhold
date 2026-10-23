import { describe, expect, it } from 'vitest';
import { attackOf, commandOf, createBattle, powerOf } from './battle';
import { makeTroop, newGame } from './campaign';
import type { Army, Battle } from './types';

function field(troops: string[]): { b: Battle; mine: Battle['units'] } {
  const s = newGame(1, 'western-realm');
  const a: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: troops.map((t) => makeTroop(s, t)) };
  const d: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'warband')] };
  const b = createBattle('x', a, d, false, 1);
  for (const col of b.terrain) col.fill('plain');
  return { b, mine: b.units.filter((u) => u.side === 'attacker') };
}

describe('hero command', () => {
  it('a hero makes regular units within 2 hexes fight better: leadership plus 2 per level, in percent', () => {
    const { b, mine } = field(['lord', 'spearmen', 'militia']);
    const [lord, spear, militia] = mine;
    Object.assign(lord, { col: 3, row: 4 });
    Object.assign(spear, { col: 4, row: 4 });
    Object.assign(militia, { col: 6, row: 4 });
    expect(commandOf(b, spear)).toBeCloseTo(0.17); // lord: leadership 15 + 2 × level 1
    expect(attackOf(spear, b)).toBeCloseTo(attackOf(spear) * 1.17);
    expect(commandOf(b, militia)).toBe(0); // 3 hexes away
    expect(commandOf(b, lord)).toBe(0); // heroes command, they aren't commanded
    lord.xp = 27; // level 10
    expect(commandOf(b, spear)).toBeCloseTo(0.35);
  });

  it('only the best hero nearby counts, and a fallen hero commands no one', () => {
    const { b, mine } = field(['lord', 'priest', 'spearmen']);
    const [lord, priest, spear] = mine;
    Object.assign(lord, { col: 3, row: 4 });
    Object.assign(priest, { col: 4, row: 5 });
    Object.assign(spear, { col: 4, row: 4 });
    expect(commandOf(b, spear)).toBeCloseTo(0.17);
    lord.men = 0;
    expect(commandOf(b, spear)).toBeCloseTo(0.07); // priest: leadership 5 + 2
  });
});

describe('hero hitting power by class', () => {
  it('grows with level at the class rate: fighters become very strong, casters stay light hitters', () => {
    const at = (type: string, level: number) => powerOf({ type, xp: (level - 1) * 3, men: 1 });
    expect(at('champion', 1)).toBe(12);
    expect(at('champion', 10)).toBeCloseTo(39); // 12 × (1 + 0.25 × 9)
    expect(at('lord', 10)).toBeCloseTo(33.6); // 12 × (1 + 0.2 × 9)
    expect(at('priest', 10)).toBeCloseTo(15.2);
    expect(at('mage', 10)).toBeCloseTo(8.7);
    // A seasoned champion out-hits an elite unit of knights.
    const knights = powerOf({ type: 'knights', xp: 18, men: 10 });
    expect(at('champion', 10)).toBeGreaterThan(knights * 3);
  });
});
