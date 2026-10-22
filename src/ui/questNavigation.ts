import { QUESTS } from '../content/quests';
import { startLocation } from '../game/campaign';
import { isOpen, stageOf } from '../game/quests';
import type { GameState } from '../game/types';

/** Known encounter destinations in the current stage only; never reveal a future quest or choice branch. */
export function questSites(state: GameState, questId: string): string[] {
  const def = QUESTS[questId];
  const progress = state.quests[questId];
  if (!def?.campaignIds.includes(state.campaignId) || !progress || !isOpen(progress)) return [];
  return [...new Set([...(def.adventureSite ? [def.adventureSite] : []), ...(stageOf(def, progress.stage)?.choices ?? [])
    .flatMap((choice) => 'encounter' in choice.then ? [choice.then.encounter.site] : [])])];
}

/** Header shortcuts show the active encounter's card at its site, or the giver for ordinary conversation. */
export function questFocus(state: GameState, questId: string): string | null {
  const def = QUESTS[questId];
  const progress = state.quests[questId];
  if (!def?.campaignIds.includes(state.campaignId) || !progress || progress.status === 'unavailable') return null;
  return startLocation(state, questSites(state, questId)[0] ?? def.at);
}
