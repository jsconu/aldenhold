import { ITEMS } from '../content/items';
import { campaignOf, deed } from './campaign';
import { recordReceipt } from './economy';
import { UNIT_TYPES } from './data';
import { heroMaxHp, heroMaxMana, isHero, heroCanUse } from './units';
import { relationWith } from './diplomacy';
import type { Army, GameState, HeroSlot, ItemHolding, Troop } from './types';
import { townAt } from './world';

/**
 * Campaign inventory. Each object's behaviour comes from its definition's policy and use data, never from its
 * name or icon. Holdings conserve count: `qty` held plus `spent` (used, sold or thrown away) always equals what
 * quests have granted, which save validation checks. Evidence that a quest takes as proof is archived, not
 * deleted, so the journal keeps the record. Equipment a hero carries leaves `qty` while carried and counts as
 * carried in that check; it comes back when taken off.
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

export const HERO_SLOTS: readonly HeroSlot[] = ['weapon', 'armor', 'accessory'];

export { kitBonus } from './units';

/** How many of this item your heroes are carrying. */
export function carriedQty(state: GameState, itemId: string): number {
  let n = 0;
  for (const a of state.armies) {
    if (a.owner !== 'player') continue;
    for (const t of a.troops) for (const id of Object.values(t.kit ?? {})) if (id === itemId) n++;
  }
  return n;
}

function heroAndArmy(state: GameState, troopId: number): { hero: Troop; army: Army } | undefined {
  for (const army of state.armies) {
    if (army.owner !== 'player') continue;
    const hero = army.troops.find((t) => t.id === troopId);
    if (hero) return isHero(hero.type) ? { hero, army } : undefined;
  }
  return undefined;
}

/** Equipment changes hands only in a town you rule or one allied with you, and never mid-battle. */
function kitPlaceReason(state: GameState, army: Army): string | null {
  if (state.status !== 'playing' || state.battle) return 'Not during a battle.';
  const town = townAt(state, army.at);
  const relation = town ? relationWith(state, town.id) : null;
  return relation === 'self' || relation === 'ally' || relation === 'vassal' ? null : 'Equipment changes hands in a town you rule or one allied with you.';
}

export interface EquipQuote {
  /** The item it would replace in that slot, which goes back to the inventory. */
  replaces: string | null;
  reason: string | null;
}

/** Whether this hero can take up this item now, and what it would replace. */
export function equipQuote(state: GameState, itemId: string, troopId: number): EquipQuote {
  const def = ITEMS[itemId];
  const found = heroAndArmy(state, troopId);
  const replaces = def?.equip && found ? found.hero.kit?.[def.equip.slot] ?? null : null;
  const refuse = (reason: string): EquipQuote => ({ replaces, reason });
  if (!def?.equip) return refuse('That is not equipment.');
  if (heldQty(state, itemId) < 1) return refuse(`You have no ${def.name} to hand out.`);
  if (!found) return refuse('Choose one of your heroes.');
  if (!heroCanUse(found.hero.type,def.equip.heroes)) {
    return refuse(`Only a ${(def.equip.heroes??[]).map((t) => UNIT_TYPES[t].name).join(' or ')} can carry the ${def.name}.`);
  }
  const place = kitPlaceReason(state, found.army);
  return place ? refuse(place) : { replaces, reason: null };
}

/** Give a hero an item from the inventory; whatever was in that slot goes back. Returns the refusal, or null. */
export function equipItem(state: GameState, itemId: string, troopId: number): string | null {
  const quote = equipQuote(state, itemId, troopId);
  if (quote.reason) return quote.reason;
  const { hero } = heroAndArmy(state, troopId)!;
  const slot = ITEMS[itemId].equip!.slot;
  if (quote.replaces) state.items[quote.replaces].qty += 1;
  state.items[itemId].qty -= 1;
  hero.kit = { ...hero.kit, [slot]: itemId };
  return null;
}

export function unequipQuote(state: GameState, troopId: number, slot: HeroSlot): { reason: string | null } {
  const found = heroAndArmy(state, troopId);
  if (!found || !found.hero.kit?.[slot]) return { reason: 'Nothing is carried there.' };
  return { reason: kitPlaceReason(state, found.army) };
}

/** Take an item off a hero and back into the inventory. */
export function unequipItem(state: GameState, troopId: number, slot: HeroSlot): string | null {
  const quote = unequipQuote(state, troopId, slot);
  if (quote.reason) return quote.reason;
  const { hero } = heroAndArmy(state, troopId)!;
  state.items[hero.kit![slot]!].qty += 1;
  const kit = { ...hero.kit };
  delete kit[slot];
  hero.kit = Object.keys(kit).length ? kit : undefined;
  if (!hero.kit) delete hero.kit;
  return null;
}

/**
 * One of your heroes has fallen. Survivors carry home what they can: everything comes back to the inventory if
 * any of your troops held the field or got away; otherwise ordinary items are lost with them. An heirloom (which
 * can't be thrown away) is always recovered. Returns the journal line, or null if the hero carried nothing.
 */
export function recoverFallenKit(state: GameState, hero: Troop, survivors: boolean): string | null {
  const ids = Object.values(hero.kit ?? {}).filter((id): id is string => !!id);
  if (!ids.length) return null;
  const back: string[] = [];
  const lost: string[] = [];
  for (const id of ids) {
    if (survivors || !ITEMS[id].policy.discard) {
      state.items[id].qty += 1;
      back.push(ITEMS[id].name);
    } else {
      state.items[id].spent += 1;
      lost.push(ITEMS[id].name);
    }
  }
  delete hero.kit;
  return [
    back.length ? `Survivors carried ${back.join(' and ')} home.` : '',
    lost.length ? `${lost.join(' and ')} ${lost.length > 1 ? 'were' : 'was'} lost on the field.` : '',
  ].filter(Boolean).join(' ');
}
