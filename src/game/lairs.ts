import { LAIRS, lairsOf, type LairDefinition } from '../content/lairs';
import { campaignOf, deed, startLocation } from './campaign';
import { recordReceipt } from './economy';
import { hexDistance } from './hex';
import type { Army, CampaignId, GameState } from './types';
import { parseKey, worldOf } from './world';

/**
 * Lair state (monster raids spec, step 2). A lair is active until its garrison is destroyed, then cleared for
 * good, paying its plunder once. It is hidden until one of your armies comes within DISCOVERY_RANGE hexes.
 */

/** How near an army must come to find a lair. */
export const DISCOVERY_RANGE = 3;

export function newLairState(campaignId: CampaignId): GameState['lairs'] {
  return Object.fromEntries(lairsOf(campaignId).map((l) => [l.id, { status: 'active' as const, discovered: false, clearedTurn: null }]));
}

/** Where a lair stands on the map. */
export function lairLocation(state: GameState, def: LairDefinition): string {
  return startLocation(state, def.place);
}

/** The lair standing at a map location, if any. */
export function lairAt(state: GameState, at: string): LairDefinition | undefined {
  return lairsOf(state.campaignId).find((l) => lairLocation(state, l) === at);
}

/** The monsters holding a lair, if any remain. */
export function lairGarrison(state: GameState, def: LairDefinition): Army | undefined {
  const at = lairLocation(state, def);
  return state.armies.find((a) => a.at === at && a.owner === def.species);
}

/** Whether this location shows to the player: hidden lairs and their garrisons don't. */
export function hiddenLairAt(state: GameState, at: string): boolean {
  const def = lairAt(state, at);
  return !!def && !state.lairs[def.id]?.discovered;
}

/** Find any lair one of your armies has come near. Returns the news. */
export function discoverLairs(state: GameState): string[] {
  if (worldOf(state).kind !== 'hex') return [];
  const news: string[] = [];
  const mine = state.armies.filter((a) => a.owner === 'player').map((a) => parseKey(a.at));
  for (const def of lairsOf(state.campaignId)) {
    const lair = state.lairs[def.id];
    if (!lair || lair.discovered) continue;
    const at = parseKey(lairLocation(state, def));
    if (!mine.some((h) => hexDistance(h, at) <= DISCOVERY_RANGE)) continue;
    lair.discovered = true;
    deed(state, 'realm', def.discovery, lairLocation(state, def));
    news.push(`Found ${def.name}.`);
  }
  return news;
}

/**
 * Clear any active lair whose garrison is gone: it stays cleared, and its plunder is paid once, through the
 * treasury ledger. Returns the news.
 */
export function settleLairs(state: GameState): string[] {
  const news: string[] = [];
  for (const def of lairsOf(state.campaignId)) {
    const lair = state.lairs[def.id];
    if (!lair || lair.status !== 'active' || lairGarrison(state, def)) continue;
    lair.status = 'cleared';
    lair.discovered = true;
    lair.clearedTurn = state.turn;
    state.gold += def.loot.gold;
    recordReceipt(state, campaignOf(state).capital, def.loot.gold, `lair:${def.id}`, def.name, 'lair-plunder');
    deed(state, 'realm', `${def.cleared} Plunder: ${def.loot.gold} gold.`, lairLocation(state, def));
    news.push(`${def.name} cleared.`);
  }
  return news;
}

export { LAIRS };
