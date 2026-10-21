import { ITEMS } from '../content/items';
import { campaignOf, deed } from './campaign';
import { recordReceipt } from './economy';
import { heroMaxHp, heroMaxMana, isHero } from './units';
import type { GameState, ItemHolding, Troop } from './types';

/**
 * Campaign inventory. Each object's behaviour comes from its definition's policy and use data, never from its
 * name or icon. Holdings conserve count: `qty` held plus `spent` (used, sold or thrown away) always equals what
 * quests have granted, which save validation checks. Evidence that a quest takes as proof is archived, not
 * deleted, so the journal keeps the record.
 */

/** How many of this object you hold and can still use or present (archived evidence doesn't count). */
export function heldQty(state: GameState, itemId: string): number {
  const h = state.items[itemId];
  return h && !h.archived ? h.qty : 0;
}

export function grantItem(state: GameState, itemId: string, qty = 1) {
  const h: ItemHolding = state.items[itemId] ?? (state.items[itemId] = { qty: 0, spent: 0, archived: false });
  h.qty += qty;
}

/** A quest took this evidence as proof: it stays in the record but can't be presented again. */
export function archiveItem(state: GameState, itemId: string) {
  const h = state.items[itemId];
  if (h) h.archived = true;
}

function spend(state: GameState, itemId: string) {
  const h = state.items[itemId];
  h.qty -= 1;
  h.spent += 1;
}

function playerHero(state: GameState, troopId: number): Troop | undefined {
  for (const a of state.armies) {
    if (a.owner !== 'player') continue;
    const t = a.troops.find((x) => x.id === troopId);
    if (t) return isHero(t.type) ? t : undefined;
  }
  return undefined;
}

export interface UseQuote {
  /** Hit points and mana the object would actually restore (never above the hero's maximum). */
  hp: number;
  mana: number;
  reason: string | null;
}

/** What using this object on this hero would do, and why it can't be used now (`reason` null means it can). */
export function useQuote(state: GameState, itemId: string, troopId: number): UseQuote {
  const def = ITEMS[itemId];
  const use = def?.use;
  const hero = playerHero(state, troopId);
  const none = (reason: string): UseQuote => ({ hp: 0, mana: 0, reason });
  if (!def || !use) return none('That object cannot be used.');
  if (heldQty(state, itemId) < 1) return none(`You have no ${def.name}.`);
  if (state.status !== 'playing') return none('The campaign is over.');
  if (use.phase === 'campaign' && state.battle) return none('Use it between battles.');
  if (!hero) return none('Choose one of your heroes.');
  const hp = Math.min(use.hp ?? 0, heroMaxHp(hero.type, hero.xp) - hero.men);
  const mana = Math.min(use.mana ?? 0, heroMaxMana(hero.type, hero.xp) - (hero.mana ?? 0));
  if (hp <= 0 && mana <= 0) return { hp: 0, mana: 0, reason: `${hero.name ?? 'This hero'} would gain nothing from it.` };
  return { hp, mana, reason: null };
}

/** Use one of a consumable on a hero. Subtracts exactly one. Returns the refusal reason, or null. */
export function useItem(state: GameState, itemId: string, troopId: number): string | null {
  const quote = useQuote(state, itemId, troopId);
  if (quote.reason) return quote.reason;
  const hero = playerHero(state, troopId)!;
  hero.men += quote.hp;
  if (quote.mana) hero.mana = (hero.mana ?? 0) + quote.mana;
  spend(state, itemId);
  const gains = [quote.hp ? `${quote.hp} HP` : '', quote.mana ? `${quote.mana} mana` : ''].filter(Boolean).join(' and ');
  deed(state, 'realm', `${hero.name ?? 'A hero'} drank a ${ITEMS[itemId].name} and recovered ${gains}.`, null);
  return null;
}

/** Sale price and why it can't be sold. Relics and evidence never sell (content validation enforces it). */
export function sellQuote(state: GameState, itemId: string): { gold: number; reason: string | null } {
  const def = ITEMS[itemId];
  const gold = def?.value ?? 0;
  if (!def || heldQty(state, itemId) < 1) return { gold, reason: 'You do not have that.' };
  if (!def.policy.sell) return { gold, reason: `The ${def.name} cannot be sold.` };
  if (state.status !== 'playing' || state.battle) return { gold, reason: 'Not during a battle.' };
  if (state.towns[campaignOf(state).capital]?.owner !== 'player') return { gold, reason: 'You need your capital to trade.' };
  return { gold, reason: null };
}

export function sellItem(state: GameState, itemId: string): string | null {
  const quote = sellQuote(state, itemId);
  if (quote.reason) return quote.reason;
  spend(state, itemId);
  state.gold += quote.gold;
  const h = state.items[itemId];
  recordReceipt(state, campaignOf(state).capital, quote.gold, `sell:${itemId}:${h.spent}`, ITEMS[itemId].name, 'item-sale');
  return null;
}

export function discardQuote(state: GameState, itemId: string): { reason: string | null } {
  const def = ITEMS[itemId];
  if (!def || heldQty(state, itemId) < 1) return { reason: 'You do not have that.' };
  if (!def.policy.discard) return { reason: `The ${def.name} cannot be thrown away.` };
  if (state.status !== 'playing' || state.battle) return { reason: 'Not during a battle.' };
  return { reason: null };
}

export function discardItem(state: GameState, itemId: string): string | null {
  const quote = discardQuote(state, itemId);
  if (quote.reason) return quote.reason;
  spend(state, itemId);
  return null;
}
