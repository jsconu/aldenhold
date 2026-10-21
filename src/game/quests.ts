import { ENCOUNTERS } from '../content/encounters';
import { encounterQuote, launchEncounter } from './encounters';
import { QUESTS } from '../content/quests';
import { armyAt, deed, makeTroop, nodeName, neighborsOf, startLocation } from './campaign';
import { relationWith } from './diplomacy';
import { isHero } from './units';
import { recordPurchase, recordReceipt } from './economy';
import { archiveItem, grantItem, heldQty } from './items';
import { ITEMS } from '../content/items';
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

/** The journal tracks at most this many quests; the header shows them as shortcuts to their towns. */
export const MAX_TRACKED = 3;

/** Open quests to show first: main objectives before side quests, then the longest-waiting. */
export function trackedQuests(state: GameState): QuestDefinition[] {
  return campaignQuests(state)
    .filter((def) => isOpen(state.quests[def.id]))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1) || (state.quests[a.id].stageTurn ?? 0) - (state.quests[b.id].stageTurn ?? 0))
    .slice(0, MAX_TRACKED);
}

/** Quests offered at a town in this campaign. */
export function questsAt(state: GameState, townId: string): QuestDefinition[] {
  return campaignQuests(state).filter((q) => q.at === townId);
}

export function stageOf(def: QuestDefinition, stageId: string): QuestStage | undefined {
  return def.stages.find((s) => s.id === stageId);
}

/** The number a counting condition measures now, for checks and for progress shown to the player. */
function measure(state: GameState, c: QuestCondition): number | null {
  switch (c.kind) {
    case 'towns-ruled': return Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair').length;
    case 'standing': return Object.values(state.towns).filter((t) => t.kind !== 'lair' &&
      ['self', 'ally', 'vassal'].includes(relationWith(state, t.id) ?? '')).length;
    case 'formations': return state.armies.filter((a) => a.owner === 'player')
      .reduce((n, a) => n + a.troops.filter((t) => !isHero(t.type)).length, 0);
    case 'food': return state.towns[c.town]?.owner === 'player' ? state.cityEconomies[c.town]?.goods.food ?? 0 : 0;
    default: return null;
  }
}

export function conditionHolds(state: GameState, c: QuestCondition): boolean {
  switch (c.kind) {
    case 'quest': return state.quests[c.quest]?.status === c.status;
    case 'town-owner': return state.towns[c.town]?.owner === c.owner;
    case 'flag': return state.flags.includes(c.flag);
    case 'encounter': return state.encounters[c.encounter]?.status === c.status;
    case 'month': return state.turn >= c.atLeast;
    case 'any': return c.of.some((x) => conditionHolds(state, x));
    default: return (measure(state, c) ?? 0) >= c.atLeast;
  }
}

/** A goal in plain words, with where you stand ("Rule 3 towns (now 2)"). */
export function conditionText(state: GameState, c: QuestCondition): string {
  const now = measure(state, c);
  const progress = now === null ? '' : ` (now ${now})`;
  switch (c.kind) {
    case 'quest': return `${QUESTS[c.quest]?.name ?? c.quest} ends ${c.status}`;
    case 'town-owner': return c.owner === 'player' ? `Take ${nodeName(state, c.town)}` : `${nodeName(state, c.town)} falls to the ${c.owner}`;
    case 'flag': return `Event: ${c.flag}`;
    case 'encounter': return `${ENCOUNTERS[c.encounter]?.name ?? c.encounter}: ${c.status === 'won' ? 'victory' : c.status === 'withdrawn' ? 'withdrawal' : 'defeat'}`;
    case 'month': return `Month ${c.atLeast} arrives`;
    case 'towns-ruled': return `Rule ${c.atLeast} towns${progress}`;
    case 'standing': return `Rule or ally with ${c.atLeast} towns${progress}`;
    case 'formations': return `Field ${c.atLeast} formations${progress}`;
    case 'food': return `Store ${c.atLeast} food in ${nodeName(state, c.town)}${progress}`;
    case 'any': return c.of.map((x) => conditionText(state, x)).join(', or ');
  }
}

/** Enter a stage: record when it began and set its events in motion (exactly once, on entry). */
function enterStage(state: GameState, def: QuestDefinition, stageId: string) {
  const progress = state.quests[def.id];
  progress.stage = stageId;
  progress.stageTurn = state.turn;
  for (const event of stageOf(def, stageId)?.onStart ?? []) {
    const at = startLocation(state, event.at);
    const troops = event.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name)));
    const army = armyAt(state, at, event.owner);
    if (army) {
      army.troops.push(...troops);
      if (event.target) army.target = event.target;
    } else {
      state.armies.push({ id: state.nextId++, owner: event.owner, at, from: null, troops, ...(event.target ? { target: event.target } : {}) });
    }
  }
}

/**
 * Move a quest on if its current stage's goals are met. Checks repeat so a stage met on arrival passes at once;
 * each stage can only be passed once, so this always stops.
 */
function checkObjectives(state: GameState, def: QuestDefinition) {
  for (let guard = 0; guard <= def.stages.length; guard++) {
    const progress = state.quests[def.id];
    if (!isOpen(progress)) return;
    const objective = stageOf(def, progress.stage)?.objectives?.find((o) => o.when.every((c) => conditionHolds(state, c)));
    if (!objective) return;
    progress.history.push({ stage: progress.stage, choice: objective.id, turn: state.turn });
    if ('stage' in objective.then) {
      progress.status = 'active';
      enterStage(state, def, objective.then.stage);
    } else {
      resolveQuest(state, def, objective.then, 'objective');
    }
  }
}

/** Battle completion checks only this expedition's sponsoring quest, without advancing campaign time. */
export function resolveEncounterQuest(state: GameState, questId: string) {
  const def = QUESTS[questId];
  if (def) checkObjectives(state, def);
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
    enterStage(state, def, def.stages[0].id);
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
  const missing = choice.requires?.find((item) => heldQty(state, item) < 1);
  if (missing) return refuse(`You need the ${ITEMS[missing]?.name ?? missing}.`);
  if (def.needsEnvoy) {
    const at = townLocation(state, def.at);
    const inRange = state.armies.some((a) => a.owner === 'player' && (a.at === at || neighborsOf(state, at).includes(a.at)));
    if (!inRange) return refuse(def.refusals?.envoy ?? `Bring an army to ${nodeName(state, def.at)} or next to it first.`);
  }
  if (choice.encounter) { const encounter = encounterQuote(state, choice.encounter); if (encounter.reason) return refuse(encounter.reason); }
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
  const expedition = choice.encounter ? encounterQuote(state, choice.encounter) : null;
  if (quote.gold > 0) {
    state.gold -= quote.gold;
    recordPurchase(state, def.at, 'quest', quote.gold, `quest:${def.id}:${progress.stage}:${choice.id}`, def.name);
  }
  progress.history.push({ stage: progress.stage, choice: choice.id, turn: state.turn });
  progress.choice = choice.id;
  if ('stage' in choice.then) {
    progress.status = 'active';
    enterStage(state, def, choice.then.stage);
    if (choice.encounter && expedition) launchEncounter(state, choice.encounter, expedition);
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
        grantItem(state, effect.item, effect.qty ?? 1);
        break;
      case 'archive':
        archiveItem(state, effect.item);
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

/**
 * The month's quest phase: unlock quests whose time has come, move on quests whose goals are met, end stages
 * whose deadline has passed (a goal met in the deadline's month counts), then offer any follow-ups.
 */
export function advanceQuests(state: GameState): string[] {
  const news = unlockQuests(state);
  for (const def of campaignQuests(state)) {
    checkObjectives(state, def);
    const progress = state.quests[def.id];
    if (!isOpen(progress)) continue;
    const deadline = stageOf(def, progress.stage)?.deadline;
    if (deadline && progress.stageTurn !== null && state.turn - progress.stageTurn >= deadline.months) {
      progress.history.push({ stage: progress.stage, choice: DEADLINE, turn: state.turn });
      resolveQuest(state, def, deadline.outcome, 'deadline');
    }
  }
  // Follow-ups to quests that just ended are offered the same month; their goals are checked from next month.
  return [...news, ...unlockQuests(state)];
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
    // Taking the town may be the quest's goal: that is checked first, so it isn't mistaken for losing it.
    checkObjectives(state, def);
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
  const step = progress.resolvedBy === 'objective'
    ? stage?.objectives?.find((o) => o.id === last.choice)
    : stage?.choices.find((c) => c.id === last.choice);
  return step && !('stage' in step.then) ? step.then : null;
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
      if (p.resolvedBy === 'deadline') return p.status === 'succeeded' ? 'Succeeded: you held out' : 'Failed: time ran out';
      if (p.resolvedBy === 'objective') {
        const reached = def.stages.flatMap((s) => s.objectives ?? []).find((o) => o.id === p.history.at(-1)?.choice);
        return `${p.status === 'succeeded' ? 'Succeeded' : 'Failed'}${reached ? ` (${reached.label.toLowerCase()})` : ''}`;
      }
      const label = def.stages.flatMap((s) => s.choices).find((c) => c.id === p.choice)?.label;
      return `${p.status === 'succeeded' ? 'Succeeded' : 'Failed'}${label ? ` (${label.toLowerCase()})` : ''}`;
    }
  }
}
