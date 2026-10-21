import { ENCOUNTERS } from '../content/encounters';
import { QUESTS } from '../content/quests';
import { isHero } from './units';
import { startLocation } from './campaign';
import type { GameState } from './types';

const check = (ok: unknown, message: string) => { if (!ok) throw new Error(`Invalid save: encounter ${message}.`); };
function record(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'record');
  return value as Record<string, unknown>;
}
function int(value: unknown, min: number, max: number) { return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max; }
function ids(value: unknown, nextId: number): number[] {
  check(Array.isArray(value) && value.every((id) => int(id, 1, nextId - 1)) && new Set(value).size === value.length, 'participant list');
  return value as number[];
}
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id));

/** Called after ordinary quest/army/battle validation; this binds the three into one saved attempt. */
export function validateEncounterSaves(state: GameState) {
  const attempts = record(state.encounters);
  const active: string[] = [];
  for (const [id, raw] of Object.entries(attempts)) {
    const def = Object.hasOwn(ENCOUNTERS, id) ? ENCOUNTERS[id] : undefined;
    check(def && def.campaignIds.includes(state.campaignId), 'unknown definition or campaign');
    const p = record(raw);
    check(['active', 'won', 'lost', 'withdrawn'].includes(String(p.status)) && int(p.startedTurn, 1, state.turn), 'state or start month');
    check(int(p.seed, -2147483648, 2147483647), 'seed');
    for (const key of ['sourceArmyId', 'armyId', 'enemyArmyId']) check(int(p[key], 1, state.nextId - 1), 'army identity');
    check(new Set([p.sourceArmyId, p.armyId, p.enemyArmyId]).size === 3, 'distinct army identities');
    const participants = ids(p.participantIds, state.nextId), waiting = ids(p.waitingIds, state.nextId);
    check(participants.length > 0 && waiting.every((id) => !participants.includes(id)), 'empty or overlapping expedition');
    check(def!.mode !== 'army' || waiting.length === 0, 'army expedition has excluded troops');
    const quest = state.quests[def!.quest];
    const starts = quest.history.filter((h) => QUESTS[def!.quest].stages.find((s) => s.id === h.stage)?.choices.find((c) => c.id === h.choice)?.encounter === id);
    check(starts.length === 1 && starts[0].turn === p.startedTurn, 'attempt without exactly one committed choice');
    if (p.status === 'active') {
      active.push(id);
      check(p.resolvedTurn === null, 'active resolution');
      const battle = state.battle, army = state.armies.find((a) => a.id === p.armyId), enemy = state.armies.find((a) => a.id === p.enemyArmyId);
      check(battle?.encounterId === id && battle.attackerId === p.armyId && battle.defenderId === p.enemyArmyId && !battle.walls, 'battle reference');
      check(army?.owner === 'player' && enemy?.owner === 'orcs' && battle!.at === startLocation(state, def!.at), 'expedition location or faction');
      check(sameIds(army!.troops.map((t) => t.id), participants), 'participant snapshot');
      check(def!.mode !== 'heroes' || army!.troops.every((t) => isHero(t.type)), 'non-hero inside hero expedition');
      const source = state.armies.find((a) => a.id === p.sourceArmyId);
      check(waiting.length ? source?.owner === 'player' && source.at === army!.at && sameIds(source.troops.map((t) => t.id), waiting) : source === undefined, 'waiting army snapshot');
      check(enemy!.troops.length === def!.enemies.length && enemy!.troops.every((t, i) => t.type === (typeof def!.enemies[i] === 'string' ? def!.enemies[i] : (def!.enemies[i] as { type: string }).type)), 'enemy roster');
      const choice = QUESTS[def!.quest].stages.find((s) => s.id === starts[0].stage)!.choices.find((c) => c.id === starts[0].choice)!;
      check(['active', 'available'].includes(quest.status) && 'stage' in choice.then && quest.stage === choice.then.stage, 'quest awaiting battle');
    } else {
      check(int(p.resolvedTurn, Number(p.startedTurn), state.turn), 'resolution month');
      check(!state.armies.some((a) => a.id === p.enemyArmyId), 'finished site enemy still roaming');
      check(['succeeded', 'failed', 'superseded'].includes(quest.status), 'finished expedition with open quest');
      const h = quest.history.at(-1), objective = h && QUESTS[def!.quest].stages.find((s) => s.id === h.stage)?.objectives?.find((o) => o.id === h.choice);
      const outcomeCondition = objective?.when.some((c) => c.kind === 'encounter' ? c.encounter === id && c.status === p.status
        : c.kind === 'any' && c.of.some((x) => x.kind === 'encounter' && x.encounter === id && x.status === p.status));
      check(quest.resolvedBy === 'objective' && outcomeCondition && quest.resolvedTurn === p.resolvedTurn, 'outcome does not match quest');
    }
  }
  check(active.length <= 1 && (state.battle?.encounterId === undefined ? active.length === 0 : active.includes(state.battle.encounterId)), 'active battle binding');
  for (const def of Object.values(QUESTS)) for (const h of state.quests[def.id].history) {
    const choice = def.stages.find((s) => s.id === h.stage)?.choices.find((c) => c.id === h.choice);
    if (choice?.encounter) check(Object.hasOwn(attempts, choice.encounter), 'missing committed attempt');
    const objective = def.stages.find((s) => s.id === h.stage)?.objectives?.find((o) => o.id === h.choice);
    if (objective?.when.some((c) => c.kind === 'encounter' || (c.kind === 'any' && c.of.some((x) => x.kind === 'encounter')))) {
      check(Object.values(ENCOUNTERS).some((e) => e.quest === def.id && Object.hasOwn(attempts, e.id)), 'objective with no encounter result');
    }
  }
}
