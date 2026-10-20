/** Small diplomatic side-story used to validate the quest framework in the original quick-play valley. */
export const FENWICK_CHARTER = {
  id: 'Q00',
  name: 'The Fenwick Charter',
  giver: 'Fenwick Council',
  at: 'fenwick',
  text: 'Fenwick will recognize your protection if its council keeps self-rule. An allied charter permits peaceful passage through the town, without collecting its taxes.',
  rewardItem: 'fenwick-charter',
} as const;

export const QUESTS = { [FENWICK_CHARTER.id]: FENWICK_CHARTER };
