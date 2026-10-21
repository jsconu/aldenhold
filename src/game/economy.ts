import type { GameState, LedgerCategory, LedgerEntry, MonthlyLedger, Treasury } from './types';

export function newTreasury(opening: number): Treasury {
  return { opening, pending: [], history: [] };
}

/** Records an expense already deducted by a rules action; no second charge happens here. */
export function recordPurchase(state: GameState, city: string, category: 'recruitment' | 'hero-hire' | 'construction' | 'refit' | 'quest', price: number, actionId: string, counterparty: string) {
  if (price <= 0) return;
  state.treasury.pending.push({ turn: state.turn, city, category, amount: -price, counterparty, actionId });
}

/** Records a one-time receipt (a quest reward or a sale) already added to gold by a rules action. Not tax income. */
export function recordReceipt(state: GameState, city: string, amount: number, actionId: string, counterparty: string,
  category: 'quest-reward' | 'item-sale' = 'quest-reward') {
  if (amount <= 0) return;
  state.treasury.pending.push({ turn: state.turn, city, category, amount, counterparty, actionId });
}

export interface CashFlow {
  city: string | null;
  amount: number;
  actionId: string;
  counterparty: string;
}

function entry(state: GameState, category: LedgerCategory, flow: CashFlow, amount: number): LedgerEntry {
  return { turn: state.turn, city: flow.city, category, amount, actionId: flow.actionId, counterparty: flow.counterparty };
}

/**
 * Book one month's real cash movements. Planned upkeep is not fabricated as cash when the treasury is empty:
 * unpaid wages are reported separately, and the existing desertion consequence stays in campaign rules.
 * The rules layer computes receipts after population growth, matching the original monthly economy.
 */
export function settleTreasury(state: GameState, taxes: CashFlow[], payroll: CashFlow[], maintenance: CashFlow[] = []): MonthlyLedger {
  const opening = state.treasury.opening;
  const entries = [...state.treasury.pending];
  const expectedCurrent = opening + entries.reduce((sum, movement) => sum + movement.amount, 0);
  // Import and test fixtures may set starting gold directly. Identify this explicitly rather than silently losing cash.
  const correction = state.gold - expectedCurrent;
  if (correction !== 0) {
    entries.push(entry(state, 'balance-correction', {
      city: null, amount: Math.abs(correction), actionId: `balance:${state.turn}`, counterparty: 'Opening balance correction',
    }, correction));
  }

  for (const flow of taxes) {
    if (flow.amount > 0) entries.push(entry(state, 'tax', flow, flow.amount));
  }

  const taxIncome = taxes.reduce((sum, flow) => sum + flow.amount, 0);
  const due = payroll.reduce((sum, flow) => sum + flow.amount, 0);
  let available = Math.max(0, state.gold + taxIncome);
  let paid = 0;
  for (const flow of payroll) {
    const amount = Math.min(flow.amount, available);
    if (amount > 0) entries.push(entry(state, 'wages', flow, -amount));
    available -= amount;
    paid += amount;
  }
  const unpaidUpkeep = due - paid;
  const maintenanceDue = maintenance.reduce((sum, flow) => sum + flow.amount, 0);
  let maintenancePaid = 0;
  for (const flow of maintenance) {
    const amount = Math.min(flow.amount, available);
    if (amount > 0) entries.push(entry(state, 'maintenance', flow, -amount));
    available -= amount;
    maintenancePaid += amount;
  }
  const unpaidMaintenance = maintenanceDue - maintenancePaid;
  state.gold = available;
  const income = entries.filter((e) => e.category === 'tax').reduce((s, e) => s + e.amount, 0);
  const expenses = Math.max(0, -entries.filter((e) => ['wages', 'recruitment', 'hero-hire', 'construction', 'maintenance', 'refit', 'quest'].includes(e.category)).reduce((s, e) => s + e.amount, 0));
  const closing = opening + entries.reduce((sum, movement) => sum + movement.amount, 0);
  if (closing !== state.gold) throw new Error('Treasury did not reconcile.');
  const row: MonthlyLedger = { turn: state.turn, opening, closing, income, expenses, unpaidUpkeep, unpaidMaintenance, entries };
  state.treasury.history.push(row);
  state.treasury.pending = [];
  state.treasury.opening = state.gold;
  return row;
}

export function currentMonthSpending(state: GameState): number {
  return -state.treasury.pending.filter((e) => e.amount < 0 && e.category !== 'balance-correction')
    .reduce((sum, e) => sum + e.amount, 0);
}
