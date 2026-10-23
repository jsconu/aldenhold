import { UNIT_TYPES } from './data';
import { FIELD_LIMIT } from './battle';
import { getCampaign } from '../content';
import { QUESTS } from '../content/quests';
import { armyAt, deed, findArmy, makeTroop, nodeName, neighborsOf, startBattle, startLocation } from './campaign';
import { relationWith } from './diplomacy';
import { isHero, isRulerType } from './units';
import { recordPurchase, recordReceipt } from './economy';
import { archiveItem, grantItem, heldQty } from './items';
import { ITEMS } from '../content/items';
import type {
  Battle, FactionId, GameState, QuestChoice, QuestCondition, QuestDefinition, QuestEncounter, QuestNext, QuestProgress,
  QuestResolution, QuestStage,
} from './types';
import { townLocation, worldOf, parseKey } from './world';
import { hexDistance } from './hex';

/**
 * The quest engine. Quests are data (content/quests.ts); this module unlocks them, quotes and applies choices,
 * enforces deadlines, and resolves each quest exactly once. A resolution's effects (treaty, item, gold, flag) are
 * applied inside that single transition, so reloading, repeating a command or revisiting a place can never
 * award them twice.
 */

/** History marker for a stage that ended because its deadline passed. */
export const DEADLINE = '(deadline)';
/** History marker for a stage that ended because the quest's town changed hands. */
export const LOCATION_LOST = '(location-lost)';

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

/** Months until an open quest's current stage ends on its own (0 = this month), or null if it has no deadline. */
export function monthsLeft(state: GameState, questId: string): number | null {
  const def = QUESTS[questId];
  const p = state.quests[questId];
  if (!def || !p || !isOpen(p)) return null;
  const months = deadlineMonths(state, def, p.stage);
  return months === undefined || p.stageTurn === null ? null : Math.max(0, p.stageTurn + months - state.turn);
}

/** Failure deadlines have twice the response window; timed successes keep their duration. */
function deadlineMonths(state: GameState, def: QuestDefinition, stageId: string): number | undefined {
  const deadline = stageOf(def, stageId)?.deadline;
  return deadline ? deadline.months * (state.questPacing && def.kind === 'side' && deadline.outcome.status === 'failed' ? 2 : 1) : undefined;
}

/** Highlight pacing changes presentation and failure deadlines, never quest availability or existing progress. */
export function enableQuestPacing(state: GameState): void {
  if (state.campaignId === 'western-realm') state.questPacing = {highlights:2};
}

/** Two useful side quests: immediate opportunities, started work, urgent deadlines and nearby destinations. */
export function sideQuestHighlights(state: GameState, selected?: string | null): QuestDefinition[] {
  const places=state.armies.filter(a=>a.owner==='player').map(a=>a.at);
  const score=(def: QuestDefinition) => {
    const p=state.quests[def.id], stage=stageOf(def,p.stage);
    const encounter=stage?.choices.find(c=>'encounter' in c.then)?.then;
    const at=def.adventureSite ? startLocation(state,def.adventureSite) : encounter && 'encounter' in encounter ? startLocation(state,encounter.encounter.site) : townLocation(state,def.at);
    const left=monthsLeft(state,def.id);
    const distance=(from:string)=>worldOf(state).kind==='hex' ? hexDistance(parseKey(from),parseKey(at)) : from===at ? 0 : neighborsOf(state,from).includes(at) ? 1 : 10;
    const nearest=Math.min(30,...places.map(distance));
    const food=def.id==='Q01' && state.cityEconomies.aldenhold.goods.food < Math.ceil(state.towns.aldenhold.pop/100)*2;
    return (selected===at ? 70 : 0)+(nearest===0 ? 80 : nearest<=3 ? 25 : 0)+(p.status==='active' ? 40 : 0)
      +(left===null ? 0 : left<=2 ? 45 : left<=4 ? 25 : 5)+(food ? 40 : 0)-nearest;
  };
  return campaignQuests(state).filter(q=>q.kind==='side' && isOpen(state.quests[q.id]))
    .sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id)).slice(0,2);
}

/** The journal tracks at most this many quests; the header shows them as shortcuts to their towns. */
export const MAX_TRACKED = 3;

/** Open quests to show first: main objectives, then whatever runs out soonest, then the longest-waiting. */
export function trackedQuests(state: GameState): QuestDefinition[] {
  if(state.questPacing) return [...campaignQuests(state).filter(q=>q.kind==='main' && isOpen(state.quests[q.id])),...sideQuestHighlights(state)].slice(0,MAX_TRACKED);
  const due = (def: QuestDefinition) => {
    const p = state.quests[def.id];
    const months = deadlineMonths(state, def, p.stage);
    return months === undefined || p.stageTurn === null ? Infinity : p.stageTurn + months;
  };
  return campaignQuests(state)
    .filter((def) => isOpen(state.quests[def.id]) && (!def.adventureSite || state.quests[def.id].history.length>0 || state.armies.some(a=>a.owner==='player' && a.at===startLocation(state,def.adventureSite!) && a.troops.some(t=>isRulerType(t.type)))))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1) ||
      (due(a) === due(b) ? 0 : due(a) < due(b) ? -1 : 1) ||
      (state.quests[a.id].stageTurn ?? 0) - (state.quests[b.id].stageTurn ?? 0))
    .slice(0, MAX_TRACKED);
}

/** Open quests with an encounter waiting at this town or landmark, so you can fight from where you stand. */
export function questsAtSite(state: GameState, placeId: string): QuestDefinition[] {
  return campaignQuests(state).filter((def) => {
    const progress = state.quests[def.id];
    return isOpen(progress) && (def.adventureSite === placeId || (def.at !== placeId && (stageOf(def, progress.stage)?.choices ?? [])
      .some((c) => 'encounter' in c.then && c.then.encounter.site === placeId)));
  });
}

/** The open quest stage that forbids raising troops in this town (rationing), if any. */
export function recruitBan(state: GameState, townId: string): QuestDefinition | undefined {
  return campaignQuests(state).find((def) => isOpen(state.quests[def.id]) &&
    stageOf(def, state.quests[def.id].stage)?.recruitBan?.includes(townId));
}

/** Stages this quest has begun (the current one and every one in its history): their entry events have run. */
export function enteredStages(def: QuestDefinition, progress: QuestProgress): QuestStage[] {
  const ids = new Set(progress.history.map((h) => h.stage));
  if (isOpen(progress)) ids.add(progress.stage);
  return def.stages.filter((st) => ids.has(st.id));
}

/** Quests offered at a town in this campaign. */
export function questsAt(state: GameState, townId: string): QuestDefinition[] {
  return campaignQuests(state).filter((q) => q.at === townId);
}

export function stageOf(def: QuestDefinition, stageId: string): QuestStage | undefined {
  return def.stages.find((s) => s.id === stageId);
}

/** Every way a choice can turn out: its next step, or both results of its encounter. */
export function choiceOutcomes(choice: QuestChoice): QuestNext[] {
  return 'encounter' in choice.then ? [choice.then.encounter.win, choice.then.encounter.lose] : [choice.then];
}

export function isResolution(next: QuestNext): next is QuestResolution {
  return 'status' in next;
}

/** History marker for an encounter's result: the choice that started it, and whether you won. */
export function encounterMark(choiceId: string, won: boolean): string {
  return `${choiceId}:${won ? 'won' : 'lost'}`;
}

/** The number a counting condition measures now, for checks and for progress shown to the player. */
function measure(state: GameState, c: QuestCondition): number | null {
  switch (c.kind) {
    case 'towns-ruled': return Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair').length;
    case 'standing': return Object.values(state.towns).filter((t) => t.kind !== 'lair' &&
      ['self', 'ally', 'vassal'].includes(relationWith(state, t.id) ?? '')).length;
    case 'units': return state.armies.filter((a) => a.owner === 'player')
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
    case 'month': return state.turn >= c.atLeast;
    case 'any': return c.of.some((x) => conditionHolds(state, x));
    case 'army-at': return !!armyAt(state, startLocation(state, c.place), 'player');
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
    case 'month': return `Month ${c.atLeast} arrives`;
    case 'towns-ruled': return `Rule ${c.atLeast} towns${progress}`;
    case 'standing': return `Rule or ally with ${c.atLeast} towns${progress}`;
    case 'units': return `Field ${c.atLeast} units${progress}`;
    case 'food': return `Store ${c.atLeast} food in ${nodeName(state, c.town)}${progress}`;
    case 'any': return c.of.map((x) => conditionText(state, x)).join(', or ');
    case 'army-at': return `Bring an army to ${nodeName(state, startLocation(state, c.place))}`;
  }
}

/** Enter a stage: record when it began and set its events in motion (exactly once, on entry). */
function enterStage(state: GameState, def: QuestDefinition, stageId: string, runEvents = true) {
  const progress = state.quests[def.id];
  progress.stage = stageId;
  progress.stageTurn = state.turn;
  if (!runEvents) return;
  for (const event of stageOf(def, stageId)?.onStart ?? []) {
    if (event.kind === 'item') {
      grantItem(state, event.item);
      continue;
    }
    if (event.kind === 'spoil') {
      const city = state.cityEconomies[event.town];
      if (city && state.towns[event.town]?.owner === 'player') city.goods[event.good] = Math.floor(city.goods[event.good] * event.keep);
      continue;
    }
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
    goTo(state, def, objective.then, 'objective');
  }
}

/** Givers belong to the authored town's original ruler, except merchants who explicitly survive our conquest. */
function giverLost(state: GameState, def: QuestDefinition): boolean {
  const owner = state.towns[def.at]?.owner;
  const original = getCampaign(state.campaignId).towns.find((town) => town.id === def.at)?.owner;
  return owner !== original && !(owner === 'player' && def.survivesConquest);
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
    const lost = giverLost(state, def);
    enterStage(state, def, def.stages[0].id, !lost);
    if (lost) {
      // A conquest objective takes precedence over losing its council, including before the quest was offered.
      checkObjectives(state, def);
      if (isOpen(progress)) resolveQuest(state, def, def.onLocationLost, 'location-lost');
      continue;
    }
    news.push(`New ${def.kind === 'main' ? 'objective' : 'quest'}: ${def.name}, offered at ${nodeName(state, def.at)}.`);
  }
  return news;
}

export interface EncounterPreview {
  site: string;
  heroesOnly: boolean;
  armyId: number | null;
  deployed: number[];
  reserves: number[];
  waiting: number[];
}

export interface QuestQuote {
  gold: number;
  encounter?: EncounterPreview;
  /** Why the choice can't be made now; null means it can. */
  reason: string | null;
}

/** What making this choice would cost, and why it can't be made now (`reason` null means it can). */
export function questQuote(state: GameState, questId: string, choiceId: string): QuestQuote {
  const def = QUESTS[questId];
  const progress = state.quests[questId];
  const choice = def && progress ? stageOf(def, progress.stage)?.choices.find((c) => c.id === choiceId) : undefined;
  const gold = choice?.gold ?? 0;
  let encounter: EncounterPreview | undefined;
  const refuse = (reason: string | null): QuestQuote => ({ gold, reason, ...(encounter ? { encounter } : {}) });
  if (!def || !progress || !def.campaignIds.includes(state.campaignId)) return refuse('No such quest here.');
  if (state.status !== 'playing' || state.battle) return refuse(def.refusals?.battle ?? 'Not during a battle.');
  if (!isOpen(progress)) return refuse(isResolved(progress) ? def.refusals?.resolved ?? 'This matter is settled.' : 'This quest is not open yet.');
  if (!choice) return refuse('That choice is not open now.');
  if (giverLost(state, def)) return refuse('The quest giver’s town has changed hands.');
  const missing = choice.requires?.find((item) => heldQty(state, item) < 1);
  if (missing) return refuse(`You need the ${ITEMS[missing]?.name ?? missing}.`);
  const unmet = choice.needs?.find((c) => !conditionHolds(state, c));
  if (unmet) return refuse(`First: ${conditionText(state, unmet)}.`);
  if(def.adventureSite){
    const site=startLocation(state,def.adventureSite);
    const present=state.armies.some(a=>a.owner==='player' && a.at===site && a.troops.some(t=>isRulerType(t.type) && t.men>0));
    if(!present)return refuse('Bring your ruler to '+nodeName(state,site)+'. Only the ruler enters; the army waits outside.');
  }
  // Talking needs an envoy near the giver; an encounter instead needs your army at its site (checked below).
  if (def.needsEnvoy && !('encounter' in choice.then)) {
    const at = townLocation(state, def.at);
    const inRange = state.armies.some((a) => a.owner === 'player' && (a.at === at || neighborsOf(state, at).includes(a.at)));
    if (!inRange) return refuse(def.refusals?.envoy ?? `Bring an army to ${nodeName(state, def.at)} or next to it first.`);
  }
  if ('encounter' in choice.then) {
    const enc = choice.then.encounter;
    encounter = previewEncounter(state, enc);
    if (progress.history.some((h) => h.choice === encounterMark(choice.id, false) && h.turn === state.turn)) return refuse('The expedition must regroup. Try again next campaign month.');
    const army = armyAt(state, startLocation(state, enc.site), 'player');
    if (!army) return refuse(`Bring an army to ${nodeName(state, startLocation(state, enc.site))} first.`);
    if (enc.heroesOnly && !partyOf(army.troops).length) return refuse('Leaders only: bring your ruler or a hired hero. Ordinary units stay outside.');
  }
  if (state.gold < gold) return refuse(`You need ${gold} gold.`);
  return refuse(null);
}

/** Leaders-only encounters admit the ruler and hired heroes, never ordinary units. */
function partyOf(troops: GameState['armies'][number]['troops']) {
  return troops.filter((t) => isHero(t.type) && t.men > 0);
}

/** Read only: matches the party split and first-in-army deployment used by the actual encounter. */
function previewEncounter(state: GameState, encounter: QuestEncounter): EncounterPreview {
  const army = armyAt(state, startLocation(state, encounter.site), 'player');
  const troops = army?.troops ?? [];
  const eligible = encounter.heroesOnly ? partyOf(troops) : troops;
  const ids = eligible.filter(t=>t.type!=='scout' && UNIT_TYPES[t.type].noncombat!=='spy').slice(0,FIELD_LIMIT).map(t=>t.id);
  return {
    site: encounter.site, heroesOnly: !!encounter.heroesOnly, armyId: army?.id ?? null,
    deployed: ids, reserves: eligible.filter(t=>!ids.includes(t.id)).map(t=>t.id),
    waiting: troops.filter((t) => !eligible.includes(t)).map((t) => t.id),
  };
}

/** Move a quest on: to another stage, or to its end. */
function goTo(state: GameState, def: QuestDefinition, next: QuestNext, by: QuestProgress['resolvedBy']) {
  if (isResolution(next)) {
    resolveQuest(state, def, next, by);
  } else {
    state.quests[def.id].status = 'active';
    enterStage(state, def, next.stage);
  }
}

/**
 * Start an encounter: the guardians appear at the site and your army there attacks them at once. For a
 * heroes-only encounter the heroes split off as a party; they rejoin the army when the fight ends.
 */
function startEncounter(state: GameState, def: QuestDefinition, choice: QuestChoice, enc: QuestEncounter) {
  const at = startLocation(state, enc.site);
  const army = armyAt(state, at, 'player')!;
  let fighters = army;
  let party: number | undefined;
  if (enc.heroesOnly) {
    const heroes = partyOf(army.troops);
    if (heroes.length < army.troops.length) {
      army.troops = army.troops.filter((t) => !heroes.includes(t));
      fighters = { id: state.nextId++, owner: 'player', at, from: null, troops: heroes };
      state.armies.push(fighters);
      party = fighters.id;
    }
  }
  const troops = enc.troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name)));
  const guardian = { id: state.nextId++, owner: enc.owner, at, from: null, troops };
  state.armies.push(guardian);
  startBattle(state, fighters.id, guardian.id);
  state.battle!.encounter = { quest: def.id, choice: choice.id, guardian: guardian.id, army: army.id, ...(party ? { party } : {}) };
}

/**
 * An encounter's battle has ended (losses already written back). The guardians leave, the hero party rejoins its
 * army, and the quest follows the result: winning takes `win`; losing or retreating takes `lose`.
 */
export function endEncounter(state: GameState, b: Battle) {
  const e = b.encounter!;
  state.armies = state.armies.filter((a) => a.id !== e.guardian);
  const party = e.party === undefined ? undefined : findArmy(state, e.party);
  const army = findArmy(state, e.army);
  if (party && army) {
    army.troops.push(...party.troops);
    state.armies = state.armies.filter((a) => a !== party);
  }
  const def = QUESTS[e.quest];
  const progress = state.quests[e.quest];
  if (!def || !progress || !isOpen(progress)) return;
  const choice = stageOf(def, progress.stage)?.choices.find((c) => c.id === e.choice);
  if (!choice || !('encounter' in choice.then)) return;
  const won = b.outcome === 'attacker';
  progress.history.push({ stage: progress.stage, choice: encounterMark(choice.id, won), turn: state.turn });
  goTo(state, def, won ? choice.then.encounter.win : choice.then.encounter.lose, 'encounter');
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
  if ('encounter' in choice.then) {
    progress.status = 'active';
    startEncounter(state, def, choice, choice.then.encounter);
  } else {
    goTo(state, def, choice.then, 'choice');
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
      case 'goods': {
        const city = state.cityEconomies[effect.town];
        if (city && state.towns[effect.town]?.owner === 'player') city.goods[effect.good] = Math.max(0, city.goods[effect.good] + effect.amount);
        break;
      }
      case 'population': {
        const town = state.towns[effect.town];
        if (town && town.kind !== 'lair') town.pop = Math.max(100, town.pop + effect.amount);
        break;
      }
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
    // Also repair an older save that imported an open quest after its giver had already fallen.
    if (giverLost(state, def)) {
      resolveQuest(state, def, def.onLocationLost, 'location-lost');
      continue;
    }
    const deadline = stageOf(def, progress.stage)?.deadline;
    if (deadline && !deadline.afterBattles && progress.stageTurn !== null && state.turn - progress.stageTurn >= deadlineMonths(state, def, progress.stage)!) {
      progress.history.push({ stage: progress.stage, choice: DEADLINE, turn: state.turn });
      resolveQuest(state, def, deadline.outcome, 'deadline');
    }
  }
  // Follow-ups to quests that just ended are offered the same month; their goals are checked from next month.
  return [...news, ...unlockQuests(state)];
}

/** Hold-out success is checked only after this month's attacks and all queued battles settle. */
export function settleHeldQuests(state: GameState) {
  if (state.status !== 'playing' || state.battle || state.pending.length) return;
  for (const def of campaignQuests(state).filter((q) => q.stages.some((s) => s.deadline?.afterBattles))) {
    checkObjectives(state, def);
    const progress = state.quests[def.id];
    if (!isOpen(progress)) continue;
    const deadline = stageOf(def, progress.stage)?.deadline;
    if (deadline?.afterBattles && progress.stageTurn !== null && state.turn - progress.stageTurn >= deadlineMonths(state, def, progress.stage)!) {
      progress.history.push({ stage: progress.stage, choice: DEADLINE, turn: state.turn });
      resolveQuest(state, def, deadline.outcome, 'deadline');
    }
  }
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
    if (owner === 'player' && def.survivesConquest) continue;
    const progress = state.quests[def.id];
    if (!isOpen(progress)) continue;
    progress.history.push({ stage: progress.stage, choice: LOCATION_LOST, turn: state.turn });
    resolveQuest(state, def, def.onLocationLost, 'location-lost');
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
  if (progress.resolvedBy === 'encounter') {
    const [choiceId, result] = last.choice.split(':');
    const choice = stage?.choices.find((c) => c.id === choiceId);
    if (!choice || !('encounter' in choice.then)) return null;
    const next = result === 'won' ? choice.then.encounter.win : choice.then.encounter.lose;
    return isResolution(next) ? next : null;
  }
  const next = progress.resolvedBy === 'objective'
    ? stage?.objectives?.find((o) => o.id === last.choice)?.then
    : stage?.choices.find((c) => c.id === last.choice)?.then;
  return next && !('encounter' in next) && isResolution(next) ? next : null;
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
