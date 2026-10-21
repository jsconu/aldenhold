import { describe, expect, it } from 'vitest';
import { armyAt, endTurn, hireHero, moveTroops, newGame, recruit, setTax } from '../game/campaign';
import { cashReport } from '../game/economy';
import { parseSave } from '../game/saves';
import type { LedgerEntry, MonthlyLedger } from '../game/types';
import { townLocation } from '../game/world';
import { renderTreasury } from './treasuryView';

const entry = (category: LedgerEntry['category'], amount: number, city: string | null): LedgerEntry =>
  ({ turn: 1, category, amount, city, counterparty: category, actionId: category });

describe('treasury cash reports', () => {
  it('includes rewards and sales, separates adjustments, and reconciles both category and location totals', () => {
    const entries = [entry('tax', 100, 'aldenhold'), entry('quest-reward', 150, 'aldenhold'),
      entry('item-sale', 20, 'millbrook'), entry('wages', -30, 'millbrook'),
      entry('construction', -90, 'aldenhold'), entry('balance-correction', -10, null)];
    const before = JSON.stringify(entries);
    const report = cashReport(entries);
    expect(report).toMatchObject({ receipts: 270, payments: 120, adjustments: -10, net: 140 });
    expect(report.categories.reduce((sum, row) => sum + row.amount, 0)).toBe(report.net);
    expect(report.locations.reduce((sum, row) => sum + row.net, 0)).toBe(report.net);
    expect(report.locations.find((row) => row.city === 'aldenhold')).toMatchObject({ receipts: 250, payments: 90, net: 160 });
    expect(JSON.stringify(entries)).toBe(before);
    const state = newGame(1);
    const month: MonthlyLedger = { turn: 1, opening: 300, closing: 440, income: 100, expenses: 120,
      unpaidUpkeep: 80, unpaidMaintenance: 0, entries };
    state.treasury.history.push(month);
    state.treasury.opening = state.gold = 440;
    state.turn = 2;
    const html = renderTreasury(state);
    expect(html.includes('Receipts +270g')).toBe(true);
    expect(html.includes('Payments −120g')).toBe(true);
    expect(html.includes('Opening 300g + receipts 270g − payments 120g − adjustment 10g = 440g.')).toBe(true);
    expect(html.includes('Unpaid wages: 80g')).toBe(true);
    expect(html.includes('Cash by category')).toBe(true);
    expect(html.includes('Cash by location')).toBe(true);
    expect(html.includes('Item sales')).toBe(true);
  });

  it('shows a real month-end objective reward as current-month income rather than a purchase', () => {
    const state = newGame(1, 'western-realm');
    expect(recruit(state, 'aldenhold', 'militia')).toBeNull();
    expect(recruit(state, 'aldenhold', 'militia')).toBeNull();
    endTurn(state);
    expect(state.quests.M01.status).toBe('succeeded');
    const pending = cashReport(state.treasury.pending);
    expect(pending).toMatchObject({ receipts: 100, payments: 0, net: 100 });
    const before = JSON.stringify(state);
    const html = renderTreasury(parseSave(before));
    expect(html.includes('Current month activity')).toBe(true);
    expect(html.includes('Quest rewards')).toBe(true);
    expect(html.includes('Current month purchases')).toBe(false);
    expect(html).not.toContain('<dd>-0g</dd>');
    expect(html.includes(`Opening ${state.treasury.opening}g + receipts 100g − payments 0g = ${state.gold}g.`)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps real field-army payroll separate from town cash contributions', () => {
    const state = newGame(1, 'western-realm');
    const home = townLocation(state, 'aldenhold');
    const militia = armyAt(state, home, 'player')!.troops.find((t) => t.type === 'militia')!;
    expect(moveTroops(state, home, [militia.id], '3,14')).toBeNull();
    endTurn(state);
    const latest = state.treasury.history.at(-1)!;
    const field = cashReport(latest.entries).locations.find((row) => row.city === null)!;
    expect(field).toMatchObject({ receipts: 0, payments: 4, net: -4 });
    expect(renderTreasury(parseSave(JSON.stringify(state))).includes('Field / realm')).toBe(true);
  });

  it('does not count unpaid bills as cash payments or invent history for a legacy import', () => {
    const state = newGame(1, 'western-realm');
    expect(hireHero(state, state.offers[0])).toBeNull();
    setTax(state, 'aldenhold', 0);
    setTax(state, 'millbrook', 0);
    endTurn(state);
    // The priest was paid before month end; the wages due at settlement remain unpaid.
    const latest = state.treasury.history.at(-1)!;
    expect(latest.unpaidUpkeep).toBeGreaterThan(0);
    expect(cashReport(latest.entries).payments).toBe(300);
    const html = renderTreasury(state);
    expect(html.includes(`Unpaid wages: ${latest.unpaidUpkeep}g`)).toBe(true);
    expect(html.includes('Payments −300g')).toBe(true);
    const fresh = newGame(1);
    const { treasury: _treasury, ...legacy } = fresh;
    const loaded = parseSave(JSON.stringify({ ...legacy, version: 5 }));
    expect(loaded.treasury.history).toEqual([]);
    expect(renderTreasury(loaded).includes('End the first month to see an itemized record.')).toBe(true);
  });
});
