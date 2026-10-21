import { UNIT_TYPES } from '../../content/rules';
import { advanceMonth, armyAt, hireHero, hireQuote, lordOf, newGame, recruit, recruitQuote } from '../campaign';
import { buildCity, constructionQuote, yieldFactor } from '../cities';
import { heldQty } from '../items';
import { chooseQuest, questQuote } from '../quests';
import { parseSave } from '../saves';
import { townLocation } from '../world';
import { marchParty, resumeBattles, type EncounterResult } from './campaignCommands';

/** An affordable side-quest tour; withhold the optional Fenwick signature so the chapter does not end mid-tour. */
export function playQuestExpedition(seed: number, options: { finishChapter?: boolean; maxMonths?: number } = {}) {
  const maxMonths = options.maxMonths ?? (options.finishChapter ? 36 : 24);
  let state = newGame(seed, 'western-realm');
  const party = armyAt(state, townLocation(state, 'aldenhold'), 'player')!.troops;
  // Leave the ruler and one militia at home. Add the starting priest through a paid, expiring offer.
  const partyIds = [party.find((t) => t.type === 'militia')!.id,
    party.find((t) => t.type === 'spearmen')!.id, party.find((t) => t.type === 'archers')!.id];
  let priestId: number | undefined;
  let months = 0;
  let minimumGold = state.gold;
  let unpaid = 0;
  let foodShortages = 0;
  let corrections = 0;
  let battles = 0;
  let casualties = 0;
  const actions: string[] = [];
  const encounters: EncounterResult[] = [];
  const completed: Record<string, number> = {};
  const note = (action: string) => {
    actions.push(`${state.turn}: ${action}`);
    minimumGold = Math.min(minimumGold, state.gold);
  };
  const must = (reason: string | null) => { if (reason) throw new Error(`Seed ${seed}, month ${state.turn}: ${reason}`); };
  const fight = () => {
    const result = resumeBattles(state);
    state = result.state;
    battles += result.battles;
    casualties += result.casualties;
    encounters.push(...result.encounters);
    if (result.battles) note(`resolved ${result.battles} battles`);
  };
  const allDone = () => ['Q02', 'Q03', 'Q05'].every((id) => state.quests[id].status === 'succeeded');
  for (; months < maxMonths && state.status === 'playing' && (!allDone() || options.finishChapter); months++) {
    if (priestId === undefined) {
      const offer = state.offers.find((o) => o.type === 'priest' && !hireQuote(state, o).reason);
      if (offer) {
        must(hireHero(state, offer));
        priestId = armyAt(state, townLocation(state, offer.town), 'player')!.troops.find((t) => t.type === 'priest')!.id;
        partyIds.push(priestId);
        note('hire priest');
      }
    }
    if (state.quests.M01.status === 'available') {
      const count = state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops)
        .filter((t) => !UNIT_TYPES[t.type].hero).length;
      for (let n = count; n < 7; n++) {
        if (recruitQuote(state, 'aldenhold', 'militia').reason) break;
        must(recruit(state, 'aldenhold', 'militia'));
        note('recruit militia at aldenhold');
      }
    }
    if (state.cityEconomies.aldenhold.buildings.farm < 2 && !constructionQuote(state, 'aldenhold', 'farm').reason) {
      must(buildCity(state, 'aldenhold', 'farm'));
      note('upgrade capital farms');
    }
    for (const [type, target] of [['spearmen', 3], ['archers', 2]] as const) {
      const count = armyAt(state, townLocation(state, 'millbrook'), 'player')?.troops.filter((t) => t.type === type).length ?? 0;
      for (let n = count; n < target; n++) {
        const quote = recruitQuote(state, 'millbrook', type);
        if (quote.reason || state.gold - quote.gold < 20) break;
        must(recruit(state, 'millbrook', type));
        note(`recruit ${type} at millbrook`);
      }
    }
    const caravan = state.quests.Q05;
    const destination = allDone() ? 'fenwick' : caravan.status === 'unavailable' || caravan.stage === 'plea' ? 'fenwick'
      : caravan.status !== 'succeeded' ? 'mine' : state.quests.Q02.status !== 'succeeded' ? 'quarry' : 'watchtower';
    const next = marchParty(state, partyIds, destination, destination === 'fenwick');
    if (next) note(`expedition toward ${destination}: ${next}`);
    if (allDone() && !questQuote(state, 'Q00', 'sign').reason) {
      must(chooseQuest(state, 'Q00', 'sign'));
      note('Q00: sign after expedition');
    }
    for (const [quest, choice] of [['Q05', 'track'], ['Q05', 'raid'], ['Q02', 'hunt'], ['Q03', 'enter']]) {
      if (questQuote(state, quest, choice).reason) continue;
      must(chooseQuest(state, quest, choice));
      note(`${quest}: ${choice}`);
      fight();
      if (state.quests[quest].status === 'succeeded') completed[quest] = state.turn;
    }
    const closed = advanceMonth(state);
    if (!closed?.ledger) throw new Error('Month did not close.');
    unpaid += closed.ledger.unpaidUpkeep + closed.ledger.unpaidMaintenance;
    corrections += closed.ledger.entries.filter((e) => e.category === 'balance-correction').length;
    foodShortages += Object.values(state.towns).filter((t) => t.owner === 'player')
      .reduce((sum, t) => sum + (state.cityEconomies[t.id].lastMonth?.unmetFood ?? 0), 0);
    fight();
    note(`month ${closed.month} closed: ${state.gold} gold`);
    state = parseSave(JSON.stringify(state));
  }
  const priest = state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops).find((t) => t.id === priestId);
  return {
    seed, months, status: state.status, gold: state.gold, minimumGold, unpaid, foodShortages, corrections,
    battles, casualties, rulerAlive: (lordOf(state)?.men ?? 0) > 0, priestAlive: (priest?.men ?? 0) > 0,
    priestXp: priest?.xp ?? 0, draughts: heldQty(state, 'healing-draught'), quarryYield: yieldFactor(state, 'aldenhold', 'mine'),
    completed, encounters, actions,
    resolutions: Object.fromEntries(['Q02', 'Q03', 'Q05'].map((id) => [id, state.quests[id].status])),
    chapter: state.quests.M02.status, ending: state.endingReason,
    crossing: state.quests.M03.status, westmereOwner: state.towns.westmere.owner,
  };
}
