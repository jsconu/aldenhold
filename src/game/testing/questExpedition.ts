import { UNIT_TYPES } from '../../content/rules';
import { advanceMonth, armyAt, hireHero, hireQuote, lordOf, newGame, recruit, recruitQuote } from '../campaign';
import { buildCity, constructionQuote, yieldFactor } from '../cities';
import { heldQty } from '../items';
import { chooseQuest, questQuote } from '../quests';
import { parseSave } from '../saves';
import { townLocation } from '../world';
import { campInTheOpen, marchParty, resumeBattles, type EncounterResult } from './campaignCommands';

/** An affordable side-quest tour; withhold the optional Fenwick signature so the chapter does not end mid-tour. */
export function playQuestExpedition(seed: number, options: {
  finishChapter?: boolean;
  maxMonths?: number;
  cityChoices?: 'buy-convict' | 'escort-convict' | 'ration-pardon';
  woodlandAccord?: boolean;
} = {}) {
  const maxMonths = options.maxMonths ?? (options.finishChapter ? 36 : 24);
  let state = newGame(seed, 'western-realm');
  const party = armyAt(state, townLocation(state, 'aldenhold'), 'player')!.troops;
  // Leave the ruler and one militia at home. Add the starting priest through a paid, expiring offer.
  const partyIds = [party.find((t) => t.type === 'militia')!.id,
    party.find((t) => t.type === 'spearmen')!.id, party.find((t) => t.type === 'archers')!.id];
  let priestId: number | undefined;
  // The vault's minotaur is beyond a lone priest: a hired champion or mage joins the party for the tower.
  let fighterId: number | undefined;
  let woodlandEnvoyId: number | undefined;
  let woodlandCompleted: number | undefined;
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
  const cityCompleted: Record<string, number> = {};
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
  // A side quest is done once it is settled: one whose deadline passed (say, held up by winter) is not retried.
  const allDone = () => ['Q02', 'Q03', 'Q05'].every((id) => ['succeeded', 'failed'].includes(state.quests[id].status));
  let heroesLost = 0;
  // Replacement units on their way to the party after a lost fight.
  const reinforcementIds: number[] = [];
  const partyFormations = () => state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => partyIds.includes(t.id)))
    ?.troops.filter((t) => partyIds.includes(t.id) && !UNIT_TYPES[t.type].hero).length ?? 0;
  const alive = (id: number) => state.armies.some((a) => a.owner === 'player' && a.troops.some((t) => t.id === id));
  for (; months < maxMonths && state.status === 'playing' && (!allDone() || options.finishChapter); months++) {
    // A hero who fell (say, in a lost tower fight) leaves the party; the tour hires another when one is offered.
    for (const id of [priestId, fighterId]) {
      if (id === undefined || alive(id)) continue;
      heroesLost++;
      if (partyIds.includes(id)) partyIds.splice(partyIds.indexOf(id), 1);
      if (id === priestId) priestId = undefined;
      if (id === fighterId) fighterId = undefined;
      note('a hero fell; seeking a replacement');
    }
    if (priestId === undefined) {
      const offer = state.offers.find((o) => o.type === 'priest' && !hireQuote(state, o).reason);
      if (offer) {
        must(hireHero(state, offer));
        priestId = armyAt(state, townLocation(state, offer.town), 'player')!.troops.find((t) => t.type === 'priest')!.id;
        partyIds.push(priestId);
        note('hire priest');
      }
    }
    if (fighterId === undefined && !(options.cityChoices && state.quests.Q01.status === 'available')) {
      // Hire only once the time-limited granary decision is settled, so its gold isn't spent first.
      const offer = state.offers.find((o) => (o.type === 'champion' || o.type === 'mage') && !hireQuote(state, o).reason);
      if (offer) {
        must(hireHero(state, offer));
        fighterId = armyAt(state, townLocation(state, offer.town), 'player')!.troops.find((t) => t.name === offer.name)!.id;
        note(`hire ${offer.type} ${offer.name}`);
      }
    }
    // The fighter joins the party when they meet (see the march below).
    const partyArmy = () => state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => partyIds.includes(t.id)));
    if (fighterId !== undefined && !partyIds.includes(fighterId)) {
      if (partyArmy()?.troops.some((t) => t.id === fighterId)) {
        partyIds.push(fighterId);
        note('fighter joins the expedition');
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
    if (options.woodlandAccord && state.quests.M01.status === 'succeeded' && state.quests.Q04.status === 'available') {
      woodlandEnvoyId ??= armyAt(state, townLocation(state, 'aldenhold'), 'player')?.troops
        .find((t) => t.type === 'militia' && !partyIds.includes(t.id))?.id;
      if (woodlandEnvoyId !== undefined) {
        const leg = marchParty(state, [woodlandEnvoyId], 'greenveil', true);
        if (leg) note(`woodland envoy toward greenveil: ${leg}`);
      }
      if (!questQuote(state, 'Q04', 'cap').reason) {
        must(chooseQuest(state, 'Q04', 'cap'));
        note('Q04: cap');
        state = parseSave(JSON.stringify(state));
        woodlandCompleted = state.turn;
      }
    }
    if (state.cityEconomies.aldenhold.buildings.farm < 2 && !constructionQuote(state, 'aldenhold', 'farm').reason) {
      must(buildCity(state, 'aldenhold', 'farm'));
      note('upgrade capital farms');
    }
    if (options.cityChoices) {
      const granaryChoice = options.cityChoices === 'ration-pardon' ? 'ration' :
        options.cityChoices === 'escort-convict' ? 'escort' : 'buy';
      if (state.quests.Q01.status === 'available' && !questQuote(state, 'Q01', granaryChoice).reason) {
        must(chooseQuest(state, 'Q01', granaryChoice));
        note(`Q01: ${granaryChoice}`);
        state = parseSave(JSON.stringify(state));
      }
      if (state.quests.Q06.status === 'available' && !questQuote(state, 'Q06', 'investigate').reason) {
        must(chooseQuest(state, 'Q06', 'investigate'));
        note('Q06: investigate');
        state = parseSave(JSON.stringify(state));
      }
      const verdict = options.cityChoices === 'ration-pardon' ? 'pardon' : 'convict';
      if (state.quests.Q06.status === 'active' && !questQuote(state, 'Q06', verdict).reason) {
        must(chooseQuest(state, 'Q06', verdict));
        note(`Q06: ${verdict}`);
        state = parseSave(JSON.stringify(state));
      }
      for (const id of ['Q01', 'Q06']) if (state.quests[id].status === 'succeeded' && !(id in cityCompleted)) cityCompleted[id] = state.turn;
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
    // With the side quests done and Fenwick's charter signed, the party goes home to winter in (and defend) the capital.
    const destination = allDone() ? state.quests.Q00.status === 'succeeded' ? 'aldenhold' : 'fenwick' : caravan.status === 'unavailable' || caravan.stage === 'plea' ? 'fenwick'
      : caravan.status !== 'succeeded' && caravan.status !== 'failed' ? 'mine' : state.quests.Q02.status !== 'succeeded' ? 'quarry' : 'watchtower';
    // A lost fight can strip the party of its soldiers. Like a player, rebuild before trying again: raise
    // replacements at the capital and march them to the party's next stop, where they join it.
    // If the whole party fell, the reinforcements become the party.
    if (!partyArmy() && reinforcementIds.some(alive)) {
      partyIds.splice(0, partyIds.length, ...reinforcementIds.filter(alive));
      reinforcementIds.length = 0;
      note('reinforcements take over the expedition');
    }
    for (const id of [...reinforcementIds]) {
      const party = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => partyIds.includes(t.id)));
      if (!alive(id)) reinforcementIds.splice(reinforcementIds.indexOf(id), 1);
      else if (party?.troops.some((t) => t.id === id)) {
        reinforcementIds.splice(reinforcementIds.indexOf(id), 1);
        partyIds.push(id);
        note('reinforcements join the expedition');
      }
    }
    if (!allDone() && partyFormations() + reinforcementIds.length < 3) {
      const quote = recruitQuote(state, 'aldenhold', 'spearmen');
      if (!quote.reason && state.gold - quote.gold >= 20) {
        must(recruit(state, 'aldenhold', 'spearmen'));
        reinforcementIds.push(armyAt(state, townLocation(state, 'aldenhold'), 'player')!.troops.at(-1)!.id);
        note('recruit spearmen to reinforce the expedition');
      }
    }
    // The fighter makes its own way to wherever the party is heading and joins it there.
    if (fighterId !== undefined && !partyIds.includes(fighterId)) {
      const leg = marchParty(state, [fighterId], destination, destination === 'fenwick');
      if (leg) note(`fighter toward ${destination}: ${leg}`);
    }
    if (reinforcementIds.length) {
      const leg = marchParty(state, reinforcementIds, destination, destination === 'fenwick');
      if (leg) note(`reinforcements toward ${destination}: ${leg}`);
    }
    const next = marchParty(state, partyIds, destination, destination === 'fenwick');
    if (next) note(`expedition toward ${destination}: ${next}`);
    if (allDone() && !questQuote(state, 'Q00', 'sign').reason) {
      must(chooseQuest(state, 'Q00', 'sign'));
      note('Q00: sign after expedition');
    }
    for (const [quest, choice] of [['Q05', 'track'], ['Q05', 'raid'], ['Q02', 'hunt'], ['Q03', 'enter']]) {
      if (questQuote(state, quest, choice).reason) continue;
      // Both leader-only bosses need a fighter alongside the priest.
      if ((quest === 'Q02' || quest === 'Q03') && !partyArmy()?.troops.some((t) => t.id === fighterId)) continue;
      // Don't take a monster or a goblin warren on without soldiers; wait for reinforcements.
      if (choice === 'raid' && partyFormations() < 2) continue;
      must(chooseQuest(state, quest, choice));
      note(`${quest}: ${choice}`);
      fight();
      if (state.quests[quest].status === 'succeeded') completed[quest] = state.turn;
    }
    campInTheOpen(state);
    const closed = advanceMonth(state);
    if (!closed?.ledger) throw new Error('Month did not close.');
    unpaid += closed.ledger.unpaidUpkeep + closed.ledger.unpaidMaintenance;
    corrections += closed.ledger.entries.filter((e) => e.category === 'balance-correction').length;
    foodShortages += Object.values(state.towns).filter((t) => t.owner === 'player')
      .reduce((sum, t) => sum + (state.cityEconomies[t.id].lastMonth?.unmetFood ?? 0), 0);
    fight();
    note(`month ${closed.month} closed: ${state.gold} gold`);
    state = parseSave(JSON.stringify(state));
    for (const id of ['Q01', 'Q06']) if (state.quests[id].status === 'succeeded' && !(id in cityCompleted)) cityCompleted[id] = closed.month;
  }
  const priest = state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops).find((t) => t.id === priestId);
  return {
    seed, months, status: state.status, gold: state.gold, minimumGold, unpaid, foodShortages, corrections,
    battles, casualties, heroesLost, rulerAlive: (lordOf(state)?.men ?? 0) > 0, priestAlive: (priest?.men ?? 0) > 0,
    priestXp: priest?.xp ?? 0, draughts: heldQty(state, 'healing-draught'), quarryYield: yieldFactor(state, 'aldenhold', 'mine'),
    completed, encounters, actions,
    cityCompleted, cityResolutions: Object.fromEntries(['Q01', 'Q06'].map((id) => [id, state.quests[id].status])),
    woodlandCompleted, woodlandResolution: state.quests.Q04.status,
    cityFlags: state.flags.filter((flag) => flag.startsWith('miller-')),
    resolutions: Object.fromEntries(['Q02', 'Q03', 'Q05'].map((id) => [id, state.quests[id].status])),
    chapter: state.quests.M02.status, ending: state.endingReason,
    crossing: state.quests.M03.status, westmereOwner: state.towns.westmere.owner, raids: state.raidLog,
  };
}
