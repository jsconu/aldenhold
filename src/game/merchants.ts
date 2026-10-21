import { ITEMS } from '../content/items';
import { MERCHANTS, type MerchantDefinition } from '../content/merchants';
import { QUESTS } from '../content/quests';
import { neighborsOf, nodeName } from './campaign';
import { recordPurchase } from './economy';
import type { GameState } from './types';
import { townLocation } from './world';

/** Whether a merchant trades with you now, on what terms, and the line its town panel shows. */
export type MerchantStatus = { open: true; markup: number; note: string } | { open: false; note: string };

export function merchantStatus(state: GameState, m: MerchantDefinition): MerchantStatus | null {
  if (!QUESTS[m.quest]?.campaignIds.includes(state.campaignId)) return null;
  const terms = m.terms.find((t) => state.flags.includes(t.flag));
  if (terms && state.towns[m.at]?.owner === 'orcs') return { open: false, note: `${nodeName(state, m.at)} is in orc hands; the stall is boarded up.` };
  if (terms) return { open: true, markup: terms.markup, note: terms.note };
  const closed = m.closedBy.find((c) => state.flags.includes(c.flag));
  return closed ? { open: false, note: closed.note } : null;
}

/** Merchants with something to say in this town (open, or closed for a reason the player should see). */
export function merchantsAt(state: GameState, townId: string): MerchantDefinition[] {
  return Object.values(MERCHANTS).filter((m) => m.at === townId && merchantStatus(state, m) !== null);
}

/** Purchases of this item from this merchant this month, from the treasury's pending entries. */
export function boughtThisMonth(state: GameState, merchantId: string, itemId: string): number {
  const prefix = `buy:${merchantId}:${itemId}:`;
  return state.treasury.pending.filter((e) => e.category === 'item-purchase' && e.actionId.startsWith(prefix)).length;
}

export interface BuyQuote {
  gold: number;
  /** How many more the stall can sell this month. */
  left: number;
  reason: string | null;
}

/** The price of one, how many are left this month, and why you can't buy now (`reason` null means you can). */
export function buyQuote(state: GameState, merchantId: string, itemId: string): BuyQuote {
  const m = MERCHANTS[merchantId];
  const line = m?.stock.find((s) => s.item === itemId);
  const status = m ? merchantStatus(state, m) : null;
  const gold = status?.open && line ? Math.ceil(ITEMS[itemId].value * status.markup) : 0;
  const left = line ? Math.max(0, line.perMonth - boughtThisMonth(state, merchantId, itemId)) : 0;
  const refuse = (reason: string): BuyQuote => ({ gold, left, reason });
  if (!m || !line) return refuse('Not sold here.');
  if (!status?.open) return refuse(status?.note ?? 'Not open.');
  if (state.status !== 'playing' || state.battle) return refuse('Not during a battle.');
  const at = townLocation(state, m.at);
  if (!state.armies.some((a) => a.owner === 'player' && (a.at === at || neighborsOf(state, at).includes(a.at)))) {
    return refuse(`Send an army to ${nodeName(state, m.at)} or a neighbouring road to trade.`);
  }
  if (left < 1) return refuse('Sold out until next month.');
  if (state.gold < gold) return refuse(`You need ${gold} gold.`);
  return { gold, left, reason: null };
}

/** Buy one of an item. Paid through the treasury; the inventory records it as bought. */
export function buyItem(state: GameState, merchantId: string, itemId: string): string | null {
  const quote = buyQuote(state, merchantId, itemId);
  if (quote.reason) return quote.reason;
  const m = MERCHANTS[merchantId];
  state.gold -= quote.gold;
  recordPurchase(state, m.at, 'item-purchase', quote.gold,
    `buy:${m.id}:${itemId}:${state.turn}:${boughtThisMonth(state, m.id, itemId) + 1}`, m.name);
  const h = state.items[itemId] ?? (state.items[itemId] = { qty: 0, spent: 0, archived: false });
  h.qty += 1;
  h.bought = (h.bought ?? 0) + 1;
  return null;
}
