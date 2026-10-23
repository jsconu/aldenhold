import type { GameState, LedgerCategory, LedgerEntry, MonthlyLedger } from '../game/types';
import { cashReport, currentMonthSpending } from '../game/economy';
import { dateLabel, nodeName } from '../game/campaign';
import { esc } from './shared';

const CATEGORY: Record<LedgerCategory, string> = {
  tax: 'Town taxes', wages: 'Army wages', recruitment: 'Recruitment', 'hero-hire': 'Hero hiring',
  construction: 'Construction', maintenance: 'City maintenance', refit: 'Unit refits',
  quest: 'Quest payments', 'quest-reward': 'Quest rewards', 'item-sale': 'Item sales', 'item-purchase': 'Merchant purchases', 'lair-plunder': 'Lair plunder', 'raid-loss': 'Raid losses', 'battle-spoils': 'Battle spoils', 'balance-correction': 'Balance adjustment',
};

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${Math.abs(amount).toLocaleString()}g`;
}

const place = (state: GameState, city: string | null) => city === null ? 'Field / realm' : nodeName(state, city);
const amount = (value: number) => `<td class="${value < 0 ? 'neg' : 'pos'}">${money(value)}</td>`;

function reconciliation(opening: number, entries: readonly LedgerEntry[], closing: number): string {
  const report = cashReport(entries);
  return `<p class="finance-reconciliation">Opening ${opening.toLocaleString()}g + receipts ${report.receipts.toLocaleString()}g − payments ${report.payments.toLocaleString()}g${report.adjustments ? ` ${report.adjustments > 0 ? '+' : '−'} adjustment ${Math.abs(report.adjustments).toLocaleString()}g` : ''} = ${closing.toLocaleString()}g.</p>`;
}

function breakdowns(state: GameState, entries: readonly LedgerEntry[]): string {
  const report = cashReport(entries);
  const categories = `<div class="finance-scroll"><table class="finance-table"><caption>Cash by category</caption>
    <thead><tr><th scope="col">Category</th><th scope="col">Amount</th></tr></thead><tbody>
    ${report.categories.map((row) => `<tr><th scope="row">${CATEGORY[row.category]}</th>${amount(row.amount)}</tr>`).join('')}
    </tbody></table></div>`;
  const showAdjustments = report.locations.some((row) => row.adjustments !== 0);
  const locations = `<div class="finance-scroll"><table class="finance-table"><caption>Cash by location</caption>
    <thead><tr><th scope="col">Location</th><th scope="col">Receipts</th><th scope="col">Payments</th>${showAdjustments ? '<th scope="col">Adjustment</th>' : ''}<th scope="col">Net cash</th></tr></thead><tbody>
    ${report.locations.map((row) => `<tr><th scope="row">${esc(place(state, row.city))}</th>${amount(row.receipts)}${amount(-row.payments)}${showAdjustments ? amount(row.adjustments) : ''}${amount(row.net)}</tr>`).join('')}
    </tbody></table></div>`;
  return categories + locations;
}

function transactions(state: GameState, entries: readonly LedgerEntry[]): string {
  return `<div class="finance-scroll"><table class="finance-table"><caption>Individual transactions</caption>
    <thead><tr><th scope="col">Location</th><th scope="col">Source / action</th><th scope="col">Amount</th></tr></thead><tbody>
    ${entries.map((entry) => `<tr><td>${esc(place(state, entry.city))}</td>
      <td>${esc(entry.counterparty)} <small>(${CATEGORY[entry.category]})</small></td>${amount(entry.amount)}</tr>`).join('')}
    </tbody></table></div>`;
}

function period(state: GameState, month: MonthlyLedger): string {
  const report = cashReport(month.entries);
  return `<details class="finance-period"><summary>
    <b>${esc(dateLabel(month.turn))}</b>
    <span>Receipts +${report.receipts.toLocaleString()}g</span>
    <span>Payments −${report.payments.toLocaleString()}g</span>
    ${report.adjustments ? `<span>Adjustment ${money(report.adjustments)}</span>` : ''}
    <span>Closing ${month.closing.toLocaleString()}g</span></summary>
    ${reconciliation(month.opening, month.entries, month.closing)}
    <p class="sub">${month.unpaidUpkeep ? `Unpaid wages: ${month.unpaidUpkeep.toLocaleString()}g (soldiers may desert).` : 'All wages paid.'}
      ${month.unpaidMaintenance ? `Unpaid city maintenance: ${month.unpaidMaintenance.toLocaleString()}g.` : ''}</p>
    ${breakdowns(state, month.entries)}${transactions(state, month.entries)}
  </details>`;
}

/** Reports actual shared-treasury cash flows; location totals do not invent separate city bank accounts. */
export function renderTreasury(state: GameState): string {
  const periods = [...state.treasury.history].reverse().slice(0, 12);
  return `<main class="journal finance">
    <h1>Royal Treasury</h1>
    <p class="sub">Taxes, quest rewards and item sales are receipts. Paid wages, hiring, construction, maintenance, refits and quest fees are payments.
      Unpaid bills and balance adjustments are shown separately.</p>
    <dl class="tally">
      <div><dt>Cash on hand</dt><dd>${state.gold.toLocaleString()}g</dd></div>
      <div><dt>Spent this month</dt><dd>${currentMonthSpending(state).toLocaleString()}g</dd></div>
      <div><dt>Closed months</dt><dd>${state.treasury.history.length}</dd></div>
    </dl>
    <h2>Current month activity</h2>
    <p class="sub">Posted activity so far. This month's taxes, army pay and city maintenance settle when you end the month.</p>
    ${reconciliation(state.treasury.opening, state.treasury.pending, state.gold)}
    ${state.treasury.pending.length ? breakdowns(state, state.treasury.pending) + transactions(state, state.treasury.pending) : '<p class="hint">No receipts or payments posted yet.</p>'}
    <h2>Monthly cash ledgers</h2>
    <p class="sub">Location totals group the actual payments and receipts recorded there. Army costs outside towns appear under Field / realm; all locations share the royal treasury.</p>
    ${periods.length ? periods.map((month) => period(state, month)).join('') : '<p class="hint">End the first month to see an itemized record.</p>'}
  </main>`;
}
