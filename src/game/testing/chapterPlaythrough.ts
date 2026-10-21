import { UNIT_TYPES } from '../../content/rules';
import { advanceMonth, armyAt, lordOf, newGame, recruit, recruitQuote } from '../campaign';
import { buildCity, constructionQuote } from '../cities';
import { chooseQuest, questQuote } from '../quests';
import { parseSave } from '../saves';
import type { GameState, RaidRecord } from '../types';
import { townLocation } from '../world';
import { marchParty, resumeBattles } from './campaignCommands';

export interface ChapterPlaythrough {
  seed: number;
  crossing: 'charter' | 'ignore';
  status: GameState['status'];
  ending: GameState['endingReason'];
  months: number;
  gold: number;
  minimumGold: number;
  battles: number;
  casualties: number;
  rulerAlive: boolean;
  unpaid: number;
  foodShortages: number;
  corrections: number;
  completed: Record<string, number>;
  resolutions: Record<string, string>;
  actions: string[];
  /** Every raid that came due during the tour. */
  raids: RaidRecord[];
}

/** A conservative public-command policy, not a fixture: it never grants resources or edits game state. */
export function playChapter(seed: number, crossing: 'charter' | 'ignore' = 'charter', maxMonths = 30): ChapterPlaythrough {
  let state = newGame(seed, 'western-realm');
  const envoyId = armyAt(state, townLocation(state, 'aldenhold'), 'player')!.troops.find((t) => t.type === 'militia')!.id;
  const report: ChapterPlaythrough = {
    seed, crossing, status: state.status, ending: state.endingReason, months: 0, gold: state.gold, minimumGold: state.gold,
    battles: 0, casualties: 0, rulerAlive: true, unpaid: 0, foodShortages: 0, corrections: 0, completed: {}, resolutions: {}, actions: [], raids: [],
  };
  const note = (action: string) => {
    report.actions.push(`${state.turn}: ${action}`);
    report.minimumGold = Math.min(report.minimumGold, state.gold);
  };
  const must = (reason: string | null) => { if (reason) throw new Error(`Seed ${seed}, month ${state.turn}: ${reason}`); };
  const resolveBattles = () => {
    const result = resumeBattles(state);
    state = result.state;
    report.battles += result.battles;
    report.casualties += result.casualties;
    if (result.battles) note(`resolved ${result.battles} battles`);
  };
  const raise = (town: string, type: string, reserve: number) => {
    const quote = recruitQuote(state, town, type);
    if (quote.reason || state.gold - quote.gold < reserve) return false;
    must(recruit(state, town, type));
    note(`recruit ${type} at ${town}`);
    return true;
  };
  const sendEnvoy = (town: string) => {
    const next = marchParty(state, [envoyId], town, true);
    if (next) note(`envoy toward ${town}: ${next}`);
  };
  for (let month = 0; month < maxMonths && state.status === 'playing'; month++) {
    if (state.cityEconomies.aldenhold.buildings.farm < 2 && !constructionQuote(state, 'aldenhold', 'farm').reason) {
      must(buildCity(state, 'aldenhold', 'farm'));
      note('upgrade capital farms');
    }
    if (state.quests.M01.status === 'available') {
      const count = state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops).filter((t) => !UNIT_TYPES[t.type].hero).length;
      for (let n = count; n < 7; n++) if (!raise('aldenhold', 'militia', 0)) break;
    }
    const destination = state.quests.Q00.status !== 'succeeded' ? 'fenwick' : 'westmere';
    if (destination === 'fenwick' || crossing === 'charter') sendEnvoy(destination);
    for (const [quest, choice] of [['Q00', 'sign'], ['M03', 'charter']]) {
      if (quest === 'M03' && crossing === 'ignore') continue;
      if (!questQuote(state, quest, choice).reason) { must(chooseQuest(state, quest, choice)); note(`${quest}: ${choice}`); }
    }
    const reserve = crossing === 'ignore' || state.quests.M03.status === 'succeeded' ? 100 : 250;
    const mill = armyAt(state, townLocation(state, 'millbrook'), 'player');
    if (state.towns.millbrook.owner === 'player') {
      for (const [type, target] of [['spearmen', 3], ['archers', 2]] as const) {
        const count = mill?.troops.filter((t) => t.type === type).length ?? 0;
        for (let n = count; n < target; n++) if (!raise('millbrook', type, reserve)) break;
      }
    }
    const closed = advanceMonth(state);
    if (!closed?.ledger) throw new Error('Month did not close.');
    report.unpaid += closed.ledger.unpaidUpkeep + closed.ledger.unpaidMaintenance;
    report.corrections += closed.ledger.entries.filter((e) => e.category === 'balance-correction').length;
    report.foodShortages += Object.values(state.towns).filter((t) => t.owner === 'player')
      .reduce((sum, t) => sum + (state.cityEconomies[t.id].lastMonth?.unmetFood ?? 0), 0);
    resolveBattles();
    for (const id of ['M01', 'M02', 'M03', 'M04']) {
      report.resolutions[id] = state.quests[id].status;
      if (state.quests[id].status === 'succeeded' && !(id in report.completed)) report.completed[id] = closed.month;
    }
    report.months++;
    note(`month ${closed.month} closed: ${state.gold} gold; M04 ${state.quests.M04.stage}`);
    // Every checkpoint passes the same strict validation used by the player's import/load command.
    state = parseSave(JSON.stringify(state));
  }
  report.status = state.status;
  report.ending = state.endingReason;
  report.gold = state.gold;
  report.raids = state.raidLog;
  report.rulerAlive = (lordOf(state)?.men ?? 0) > 0;
  return report;
}
