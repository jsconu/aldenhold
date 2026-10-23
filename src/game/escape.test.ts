import { describe, expect, it } from 'vitest';
import { createBattle, escapeQuote, tryEscape } from './battle';
import { makeTroop, newGame } from './campaign';
import type { Army, Battle } from './types';

/** A fresh field battle; `playerAttacks` decides which side is yours. Units start well apart. */
function battle(playerAttacks: boolean, seed = 5): Battle {
  const s = newGame(1, 'western-realm');
  const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'militia'), makeTroop(s, 'spearmen')] };
  const foe: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'warband'), makeTroop(s, 'warband')] };
  const b = playerAttacks ? createBattle('x', mine, foe, false, seed) : createBattle('x', foe, mine, false, seed);
  for (const col of b.terrain) col.fill('plain');
  b.active = playerAttacks ? 'attacker' : 'defender';
  return b;
}

describe('running away', () => {
  it('an army that attacked can try after turn 4', () => {
    const b = battle(true);
    b.round = 4;
    expect(escapeQuote(b, 'attacker')).toMatchObject({ after: 4, reason: 'You can try to run away after turn 4.' });
    expect(tryEscape(b, 'attacker')).toBeNull();
    expect(b.outcome).toBeNull();
    b.round = 5;
    expect(escapeQuote(b, 'attacker')).toMatchObject({ reason: null, chance: 0.75 });
  });

  it('an army that was attacked, or a party in a quest encounter, only after turn 8', () => {
    const defending = battle(false);
    defending.round = 8;
    expect(escapeQuote(defending, 'defender').reason).toBe('You can try to run away after turn 8.');
    defending.round = 9;
    expect(escapeQuote(defending, 'defender').reason).toBeNull();
    const encounter = battle(true);
    encounter.encounter = { quest: 'Q02', choice: 'hunt', guardian: 901, army: 900 };
    encounter.round = 5;
    expect(escapeQuote(encounter, 'attacker')).toMatchObject({ after: 8, reason: 'You can try to run away after turn 8.' });
  });

  it('is harder with enemies already at grips: 10% less per unit in contact, never below 20%', () => {
    const b = battle(true);
    b.round = 5;
    const [m1, m2] = b.units.filter((u) => u.side === 'attacker');
    const [o1, o2] = b.units.filter((u) => u.side === 'defender');
    Object.assign(m1, { col: 5, row: 4 }); Object.assign(m2, { col: 5, row: 6 });
    Object.assign(o1, { col: 6, row: 4 }); Object.assign(o2, { col: 12, row: 4 });
    expect(escapeQuote(b, 'attacker').chance).toBeCloseTo(0.65);
    Object.assign(o2, { col: 6, row: 6 });
    expect(escapeQuote(b, 'attacker').chance).toBeCloseTo(0.55);
  });

  it('a success ends the battle as a retreat; a failure spends the turn', () => {
    const results = new Map<boolean, Battle>();
    for (let seed = 1; seed < 200 && results.size < 2; seed++) {
      const b = battle(true, seed);
      b.round = 5;
      const got = tryEscape(b, 'attacker');
      if (got !== null && !results.has(got)) results.set(got, b);
    }
    const away = results.get(true)!;
    expect(away).toMatchObject({ outcome: 'defender', retreated: 'attacker' });
    expect(away.log.some((l) => l.startsWith('Your army breaks away'))).toBe(true);
    const held = results.get(false)!;
    expect(held.outcome === null || held.outcome === 'defender').toBe(true);
    expect(held.retreated).toBeNull();
    expect(held.log.some((l) => l.startsWith('You try to break away, but the enemy holds you'))).toBe(true);
    // The enemy took its turn; it's your move again in the next round.
    if (!held.outcome) expect(held).toMatchObject({ active: 'attacker', round: 6 });
  });
});
