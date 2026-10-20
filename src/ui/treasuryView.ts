import type { GameState, MonthlyLedger } from '../game/types';
import { currentMonthSpending } from '../game/economy';
import { dateLabel, nodeName } from '../game/campaign';
import { esc } from './shared';

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${Math.abs(amount).toLocaleString()}g`;
}

function period(state: GameState, m: MonthlyLedger): string {
  return `<details class="finance-period"><summary>
    <b>${esc(dateLabel(m.turn))}</b>
    <span>Revenue +${m.income.toLocaleString()}g</span>
    <span>Costs −${m.expenses.toLocaleString()}g</span>
    <span>Closing ${m.closing.toLocaleString()}g</span></summary>
    <p class="sub">Opening treasury: ${m.opening.toLocaleString()}g.
      ${m.unpaidUpkeep ? `Unpaid wages: ${m.unpaidUpkeep.toLocaleString()}g (soldiers may desert).` : 'All wages paid.'}</p>
    <table class="finance-table"><thead><tr><th>Location</th><th>Source / action</th><th>Amount</th></tr></thead><tbody>
    ${m.entries.map((e) => `<tr><td>${esc(e.city ? nodeName(state, e.city) : 'Realm')}</td>
      <td>${esc(e.counterparty)} <small>(${esc(e.category)})</small></td>
      <td class="${e.amount < 0 ? 'neg' : 'pos'}">${money(e.amount)}</td></tr>`).join('')}
    </tbody></table></details>`;
}

/** A lightweight consolidated cash view, not yet a commodities market or city construction screen. */
export function renderTreasury(state: GameState): string {
  const periods = [...state.treasury.history].reverse().slice(0, 12);
  return `<main class="journal finance">
    <h1>Royal Treasury</h1>
    <p class="sub">Every month reconciles opening gold, town tax receipts, army pay and purchases.
      Unpaid wages are shown separately from money actually spent.</p>
    <dl class="tally">
      <div><dt>Cash on hand</dt><dd>${state.gold.toLocaleString()}g</dd></div>
      <div><dt>Spent this month</dt><dd>${currentMonthSpending(state).toLocaleString()}g</dd></div>
      <div><dt>Closed months</dt><dd>${state.treasury.history.length}</dd></div>
    </dl>
    ${state.treasury.pending.length ? `<h2>Current month purchases</h2><ul>${state.treasury.pending.map((e) =>
      `<li>${esc(nodeName(state, e.city ?? 'aldenhold'))}: ${esc(e.counterparty)} — ${money(e.amount)}</li>`).join('')}</ul>` : ''}
    <h2>Monthly cash ledgers</h2>
    ${periods.length ? periods.map((m) => period(state, m)).join('') :
      '<p class="hint">End the first month to see an itemized record.</p>'}
  </main>`;
}
