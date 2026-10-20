import { FENWICK_CHARTER } from '../content/quests';
import { deed, neighborsOf } from './campaign';
import type { FactionId, GameState, QuestProgress } from './types';
import { townLocation } from './world';

export function newQuestState(): Record<string, QuestProgress> {
  return { Q00: { status: 'available', stage: 'decision', choice: null, resolvedTurn: null } };
}

/** The first complete choice/reward/treaty slice. Side quests Q01–Q18 will use the same state contract. */
/** Whether the Fenwick council will hear an envoy now (`reason` null means it will), for both sign and decline. */
export function charterQuote(state: GameState): { reason: string | null } {
  if (state.status !== 'playing' || state.battle) return { reason: 'You cannot negotiate during a battle.' };
  const quest = state.quests[FENWICK_CHARTER.id];
  if (!quest || quest.status !== 'available' || state.towns.fenwick?.owner !== 'neutral') return { reason: 'The council has already decided.' };
  const fenwick = townLocation(state, 'fenwick');
  const envoyInRange = state.armies.some((a) => a.owner === 'player' &&
    (a.at === fenwick || neighborsOf(state, fenwick).includes(a.at)));
  if (!envoyInRange) return { reason: 'Send an army to Fenwick or a neighboring road before negotiating.' };
  return { reason: null };
}

export function decideFenwickCharter(state: GameState, choice: 'sign' | 'decline'): string | null {
  const { reason } = charterQuote(state);
  if (reason) return reason;
  const quest = state.quests[FENWICK_CHARTER.id];
  quest.status = choice === 'sign' ? 'succeeded' : 'failed';
  quest.stage = 'resolved';
  quest.choice = choice;
  quest.resolvedTurn = state.turn;
  if (choice === 'sign') {
    state.treaties.fenwick = { relation: 'ally', passage: true, signedTurn: state.turn };
    if (!state.items.includes(FENWICK_CHARTER.rewardItem)) state.items.push(FENWICK_CHARTER.rewardItem);
    deed(state, 'story', 'Signed the Fenwick Charter. The free council keeps its town; your troops gain peaceful passage and its sealed charter.', townLocation(state, 'fenwick'));
  } else {
    deed(state, 'story', 'Rejected the Fenwick Charter. Fenwick remains independent and its militia bars the road.', townLocation(state, 'fenwick'));
  }
  return null;
}

/** Conquest or loss ends the right to pass; a resolved quest is never reawarded. */
export function onTownOwnershipChange(state: GameState, id: string, owner: FactionId) {
  if (id !== 'fenwick' || owner === 'neutral') return;
  if (state.treaties.fenwick) {
    delete state.treaties.fenwick;
    deed(state, 'realm', 'The Fenwick passage treaty has ended with the change of ruler.', townLocation(state, 'fenwick'));
  }
  const quest = state.quests[FENWICK_CHARTER.id];
  if (quest?.status === 'available') {
    quest.status = 'superseded';
    quest.stage = 'resolved';
    quest.resolvedTurn = state.turn;
    deed(state, 'story', 'The Fenwick council can no longer offer a charter after the town changed hands.', townLocation(state, 'fenwick'));
  }
}

export function questSummary(state: GameState): string {
  const p = state.quests.Q00;
  if (!p) return 'Unknown quest';
  if (p.status === 'succeeded') return 'Treaty signed';
  if (p.status === 'failed') return 'Accord declined';
  if (p.status === 'superseded') return 'No longer available';
  return 'Awaiting your choice';
}
