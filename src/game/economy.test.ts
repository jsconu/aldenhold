import { describe, expect, it } from 'vitest';
import { endTurn, hireHero, newGame, recruit, monthlyUpkeep } from './campaign';
import { currentMonthSpending } from './economy';
import { parseSave, saveGame } from './saves';
import type { GameState } from './types';

function balanced(state: GameState) {
  const month = state.treasury.history.at(-1)!;
  expect(month.opening + month.entries.reduce((sum, row) => sum + row.amount, 0)).toBe(month.closing);
  expect(state.gold).toBe(month.closing);
  expect(state.treasury.opening).toBe(month.closing);
  return month;
}

describe('reconciled treasury', () => {
  it('starts a truthful balance without inventing historical transactions', () => {
    const s = newGame(1);
    expect(s.treasury).toEqual({ opening: 300, pending: [], history: [] });
  });

  it('records per-city receipts and army wages without altering legacy math', () => {
    const s = newGame(1);
    const upkeep = monthlyUpkeep(s);
    const initial = s.gold;
    endTurn(s);
    const month = balanced(s);
    expect(month.turn).toBe(1);
    const receipts = month.entries.filter((e) => e.category === 'tax');
    const wageEntries = month.entries.filter((e) => e.category === 'wages');
    expect(receipts.map((e) => e.city).sort()).toEqual(['aldenhold', 'millbrook']);
    expect(month.income).toBe(receipts.reduce((n, e) => n + e.amount, 0));
    expect(month.expenses).toBe(upkeep);
    expect(wageEntries.reduce((n, e) => n - e.amount, 0)).toBe(upkeep);
    expect(month.closing).toBe(initial + month.income - upkeep);
    expect(month.unpaidUpkeep).toBe(0);
  });

  it('books recruitment and hero hiring once, with unique action identifiers', () => {
    const s = newGame(1);
    expect(recruit(s, 'aldenhold', 'spearmen')).toBeNull();
    expect(currentMonthSpending(s)).toBe(120);
    expect(hireHero(s, s.offers[0])).toMatch(/need/); // only 180g left, priest costs 300
    expect(s.treasury.pending).toHaveLength(1);
    endTurn(s);
    const month = balanced(s);
    expect(month.expenses).toBeGreaterThanOrEqual(120);
    expect(month.entries.find((e) => e.category === 'recruitment')?.amount).toBe(-120);
    expect(new Set(month.entries.map((e) => e.actionId)).size).toBe(month.entries.length);
    expect(s.treasury.pending).toHaveLength(0);
  });

  it('books a hired hero once and survives a save round-trip', () => {
    const s = newGame(1);
    const offer = s.offers[0];
    expect(hireHero(s, offer)).toBeNull();
    expect(s.gold).toBe(0);
    expect(currentMonthSpending(s)).toBe(300);
    expect(s.treasury.pending[0]).toMatchObject({ category: 'hero-hire', amount: -300, city: 'aldenhold' });
    const restored = parseSave(JSON.stringify(s));
    expect(restored.treasury).toEqual(s.treasury);
    endTurn(restored);
    expect(balanced(restored).entries.some((e) => e.category === 'hero-hire')).toBe(true);
  });

  it('separates unpaid upkeep from cash spending and preserves desertion', () => {
    const s = newGame(1);
    for (const t of Object.values(s.towns)) t.tax = 0;
    s.gold = 0;
    const due = monthlyUpkeep(s);
    const count = s.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops).length;
    endTurn(s);
    const row = balanced(s);
    expect(row.unpaidUpkeep).toBe(due);
    expect(row.expenses).toBe(0);
    expect(row.entries.find((e) => e.category === 'balance-correction')?.amount).toBe(-300);
    expect(s.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops)).toHaveLength(count - 1);
  });

  it('reconciles consecutive months and preserves the balances on reload', () => {
    const s = newGame(16);
    for (let i = 0; i < 4; i++) {
      if (s.status !== 'playing') break;
      endTurn(s);
      balanced(s);
    }
    const saved = parseSave(JSON.stringify(s));
    expect(saved.treasury).toEqual(s.treasury);
    expect(saved.treasury.history.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < saved.treasury.history.length; i++) {
      expect(saved.treasury.history[i].opening).toBe(saved.treasury.history[i - 1].closing);
    }
  });

  it('migrates schema v5 without hallucinating earlier transactions', () => {
    const s = newGame(1);
    const { treasury: _old, ...before } = s;
    const v5 = { ...before, version: 5 };
    const restored = parseSave(JSON.stringify(v5));
    expect(restored.version).toBe(6);
    expect(restored.treasury).toEqual({ opening: s.gold, pending: [], history: [] });
  });

  it('rejects tampered monthly ledger balances and duplicate action identifiers', () => {
    const s = newGame(1);
    endTurn(s);
    const bad = structuredClone(s);
    bad.treasury.history[0].closing++;
    expect(() => parseSave(JSON.stringify(bad))).toThrow(/treasury does not reconcile/);
    bad.treasury.history[0].closing--;
    bad.treasury.history[0].entries.push({ ...bad.treasury.history[0].entries[0] });
    expect(() => parseSave(JSON.stringify(bad))).toThrow(/treasury transaction/);
  });

  it('refuses an inconsistent ledger during autosave', () => {
    const s = newGame(1);
    endTurn(s);
    s.treasury.history[0].income = -1;
    const store = { getItem: () => null, setItem: () => { throw new Error('should not write'); } };
    expect(saveGame(store, s)).toMatch(/Autosave failed/);
  });
});
