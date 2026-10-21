import { QUESTS } from '../content/quests';
import { deed, nodeName, neighborsOf } from './campaign';
import { recordPurchase, recordReceipt } from './economy';
import type {
  FactionId, GameState, QuestChoice, QuestCondition, QuestDefinition, QuestProgress, QuestResolution, QuestStage,
} from './types';
import { townLocation } from './world';

/**
 * The quest engine. Quests are data (content/quests.ts); this module unlocks them, quotes and applies choices,
 * enforces deadlines, and resolves each quest exactly once. A resolution's effects (treaty, item, gold, flag) are
 * applied inside that single transition, so reloading, repeating a command or revisiting a place can never
 * award them twice.
 */

/** History marker for a stage that ended because its deadline passed. */
export const DEADLINE = '(deadline)';

const RESOLVED = new Set(['succeeded', 'failed', 'superseded']);

/** Every quest in the catalog starts locked; quests outside the current campaign stay locked. */
export function newQuestState(): Record<string, QuestProgress> {
  return Object.fromEntries(Object.keys(QUESTS).map((id) => [id, lockedProgress()]));
}

export function lockedProgress(): QuestProgress {
  return { status: 'unavailable', stage: 'locked', choice: null, resolvedTurn: null, resolvedBy: null, stageTurn: null, history: [] };
}

export function isResolved(progress: QuestProgress): boolean {
  return RESOLVED.has(progress.status);
}

export function isOpen(progress: QuestProgress): boolean {
  return progress.status === 'available' || progress.status === 'active';
}

/** The quests that belong to this game's campaign. */
export function campaignQuests(state: GameState): QuestDefinition[] {
  return Object.values(QUESTS).filter((q) => q.campaignIds.includes(state.campaignId));
}

/** Quests offered at a town in this campaign. */
export function questsAt(state: GameState, townId: string): QuestDefinition[] {
  return campaignQuests(state).filter((q) => q.at === townId);
}

export function stageOf(def: QuestDefinition, stageId: string): QuestStage | undefined {
  return def.stages.find((s) => s.id === stageId);
}

function conditionHolds(state: GameState, c: QuestCondition): boolean {
  switch (c.kind) {
    case 'quest': return state.quests[c.quest]?.status === c.status;
    case 'town-owner': return state.towns[c.town]?.owner === c.owner;
    case 'flag': return state.flags.includes(c.flag);
    case 'month': return state.turn >= c.atLeast;
  }
}

/**
 * Unlock every quest of this campaign whose prerequisites now hold. Returns news lines for the newly unlocked
 * quests (at the start of a game the opening quests simply begin available).
 */
export function unlockQuests(state: GameState): string[] {
  const news: string[] = [];
  for (const def of campaignQuests(state)) {
    const progress = state.quests[def.id];
    if (progress.status !== 'unavailable' || !def.prerequisites.every((c) => conditionHolds(state, c))) continue;
    progress.status = 'available';
    progress.stage = def.stages[0].id;
    progress.stageTurn = state.turn;
    news.push(`New ${def.kind === 'main' ? 'objective' : 'quest'}: ${def.name}, offered at ${nodeName(state, def.at)}.`);
  }
  return news;
}

export interface QuestQuote {
  gold: number;
  /** Why the choice can't be made now; null means it can. */
  reason: string | null;
}

/** What making this choice would cost, and why it can't be made now (`reason` null means it can). */
export function questQuote(state: GameState, questId: string, choiceId: string): QuestQuote {
  const def = QUESTS[questId];
  const progress = state.quests[questId];
  const choice = def && progress ? stageOf(def, progress.stage)?.choices.find((c) => c.id === choiceId) : undefined;
  const gold = choice?.gold ?? 0;
  const refuse = (reason: string): QuestQuote => ({ gold, reason });
  if (!def || !progress || !def.campaignIds.includes(state.campaignId)) return refuse('No such quest here.');
  if (state.status !== 'playing' || state.battle) return refuse(def.refusals?.battle ?? 'Not during a battle.');
  if (!isOpen(progress)) return refuse(isResolved(progress) ? def.refusals?.resolved ?? 'This matter is settled.' : 'This quest is not open yet.');
  if (!choice) return refuse('That choice is not open now.');
  if (def.needsEnvoy) {
    const at = townLocation(state, def.at);
    const inRange = state.armies.some((a) => a.owner === 'player' && (a.at === at || neighborsOf(state, at).includes(a.at)));
    if (!inRange) return refuse(def.refusals?.envoy ?? `Bring an army to ${nodeName(state, def.at)} or next to it first.`);
  }
  if (state.gold < gold) return refuse(`You need ${gold} gold.`);
  return { gold, reason: null };
}

/** Make a quest choice. Returns the refusal reason, or null. */
export function chooseQuest(state: GameState, questId: string, choiceId: string): string | null {
  const quote = questQuote(state, questId, choiceId);
  if (quote.reason) return quote.reason;
  const def = QUESTS[questId];
  const progress = state.quests[questId];
  const choice = stageOf(def, progress.stage)!.choices.find((c) => c.id === choiceId) as QuestChoice;
  if (quote.gold > 0) {
    state.gold -= quote.gold;
    recordPurchase(state, def.at, 'quest', quote.gold, `quest:${def.id}:${progress.stage}:${choice.id}`, def.name);
  }
  progress.history.push({ stage: progress.stage, choice: choice.id, turn: state.turn });
  progress.choice = choice.id;
  if ('stage' in choice.then) {
    progress.status = 'active';
    progress.stage = choice.then.stage;
    progress.stageTurn = state.turn;
  } else {
    resolveQuest(state, def, choice.then, 'choice');
  }
  return null;
}

/** End a quest and apply its effects. Does nothing if it has already ended: effects can only ever apply once. */
function resolveQuest(state: GameState, def: QuestDefinition, resolution: QuestResolution, by: QuestProgress['resolvedBy']) {
  const progress = state.quests[def.id];
  if (isResolved(progress)) return;
  progress.status = resolution.status;
  progress.stage = 'resolved';
  progress.stageTurn = null;
  progress.resolvedTurn = state.turn;
  progress.resolvedBy = by;
  for (const effect of resolution.effects) {
    switch (effect.kind) {
      case 'treaty':
        state.treaties[effect.town] = { relation: effect.relation, passage: effect.passage, signedTurn: state.turn };
        break;
      case 'item':
        if (!state.items.includes(effect.item)) state.items.push(effect.item);
        break;
      case 'gold':
        state.gold += effect.amount;
        recordReceipt(state, def.at, effect.amount, `quest-reward:${def.id}`, def.name);
        break;
      case 'flag':
        if (!state.flags.includes(effect.flag)) state.flags.push(effect.flag);
        break;
    }
  }
  deed(state, 'story', resolution.journal, townLocation(state, def.at));
}

/** The month's quest phase: unlock quests whose time has come, then end stages whose deadline has passed. */
export function advanceQuests(state: GameState): string[] {
  const news = unlockQuests(state);
  for (const def of campaignQuests(state)) {
    const progress = state.quests[def.id];
    if (!isOpen(progress)) continue;
    const deadline = stageOf(def, progress.stage)?.deadline;
    if (deadline && progress.stageTurn !== null && state.turn - progress.stageTurn >= deadline.months) {
      progress.history.push({ stage: progress.stage, choice: DEADLINE, turn: state.turn });
      resolveQuest(state, def, deadline.outcome, 'deadline');
    }
  }
  return news;
}

/**
 * A town changed hands. Treaties with it end (conquest or loss ends the right to pass), and any unresolved quest
 * offered there ends with its fallback outcome. Items already earned stay earned.
 */
export function onTownOwnershipChange(state: GameState, townId: string, owner: FactionId) {
  if (state.treaties[townId] && owner !== 'neutral') {
    delete state.treaties[townId];
    deed(state, 'realm', `The ${nodeName(state, townId)} passage treaty has ended with the change of ruler.`, townLocation(state, townId));
  }
  for (const def of questsAt(state, townId)) {
    if (isOpen(state.quests[def.id])) resolveQuest(state, def, def.onLocationLost, 'location-lost');
  }
}

/** The resolution a quest actually ended with, or null if it hasn't ended. */
export function resolutionOf(def: QuestDefinition, progress: QuestProgress): QuestResolution | null {
  if (!isResolved(progress)) return null;
  if (progress.resolvedBy === 'location-lost') return def.onLocationLost;
  const last = progress.history.at(-1);
  if (!last) return null;
  const stage = stageOf(def, last.stage);
  if (progress.resolvedBy === 'deadline') return stage?.deadline?.outcome ?? null;
  const choice = stage?.choices.find((c) => c.id === last.choice);
  return choice && !('stage' in choice.then) ? choice.then : null;
}

/** A short status line for the journal and panels. */
export function questSummary(state: GameState, questId: string): string {
  const def = QUESTS[questId];
  const p = state.quests[questId];
  if (!def || !p) return 'Unknown quest';
  switch (p.status) {
    case 'unavailable': return 'Not yet offered';
    case 'available': return 'Awaiting your choice';
    case 'active': return 'Under way';
    case 'superseded': return 'No longer available';
    default: {
      if (p.resolvedBy === 'deadline') return p.status === 'succeeded' ? 'Succeeded' : 'Failed: time ran out';
      const label = def.stages.flatMap((s) => s.choices).find((c) => c.id === p.choice)?.label;
      return `${p.status === 'succeeded' ? 'Succeeded' : 'Failed'}${label ? ` (${label.toLowerCase()})` : ''}`;
    }
  }
}
