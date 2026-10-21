import type { QuestDefinition } from '../game/types';

/**
 * Small diplomatic side-story used to validate the quest framework. Fenwick is a free town in both campaigns.
 * Not one of the planned authored side quests (Q01–Q72).
 */
export const FENWICK_CHARTER: QuestDefinition = {
  id: 'Q00',
  campaignIds: ['valley-quickplay', 'western-realm'],
  kind: 'side',
  name: 'The Fenwick Charter',
  giver: 'Fenwick Council',
  at: 'fenwick',
  summary: 'Fenwick will recognize your protection if its council keeps self-rule. An allied charter permits peaceful passage through the town, without collecting its taxes.',
  prerequisites: [{ kind: 'town-owner', town: 'fenwick', owner: 'neutral' }],
  needsEnvoy: true,
  stages: [
    {
      id: 'decision',
      text: 'Reward: Sealed Fenwick Charter. Sign to gain peaceful passage, or decline and keep the military option.',
      choices: [
        {
          id: 'sign',
          label: 'Sign the charter',
          then: {
            status: 'succeeded',
            effects: [
              { kind: 'treaty', town: 'fenwick', relation: 'ally', passage: true },
              { kind: 'item', item: 'fenwick-charter' },
            ],
            journal: 'Signed the Fenwick Charter. The free council keeps its town; your troops gain peaceful passage and its sealed charter.',
          },
        },
        {
          id: 'decline',
          label: 'Decline',
          then: { status: 'failed', effects: [], journal: 'Rejected the Fenwick Charter. Fenwick remains independent and its militia bars the road.' },
        },
      ],
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'The Fenwick council can no longer offer a charter after the town changed hands.' },
  refusals: {
    resolved: 'The council has already decided.',
    envoy: 'Send an army to Fenwick or a neighboring road before negotiating.',
    battle: 'You cannot negotiate during a battle.',
  },
};

export const QUESTS: Record<string, QuestDefinition> = { [FENWICK_CHARTER.id]: FENWICK_CHARTER };
