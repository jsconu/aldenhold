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

const ACCORD_EFFECTS = [
  { kind: 'treaty', town: 'greenveil', relation: 'ally', passage: true },
  { kind: 'item', item: 'woodland-charter' },
] as const;

/**
 * Q04: Greenveil's woodland court objects to Aldenhold's logging. Capping it costs future timber, compensating
 * costs gold now; either wins the court's archers. Rejecting it sours relations, but ordinary archers can still
 * be raised in your own towns, so no path to Harrowgate depends on this quest (QUEST-06).
 */
export const WOODLAND_ACCORD: QuestDefinition = {
  id: 'Q04',
  campaignIds: ['western-realm'],
  kind: 'side',
  name: 'The Woodland Accord',
  giver: 'Warden Ilsabet of Greenveil',
  at: 'greenveil',
  summary: 'Greenveil\'s court says Aldenhold\'s woodcutters are pushing into their forest. They will ally with you, and lend you their archers, if the felling stops or is paid for.',
  prerequisites: [{ kind: 'town-owner', town: 'greenveil', owner: 'neutral' }, { kind: 'month', atLeast: 3 }],
  needsEnvoy: true,
  stages: [
    {
      id: 'envoy',
      text: 'Cap logging (no lumber camp may grow past its first tier), pay 200 gold for the felled groves, or send the envoy away.',
      choices: [
        {
          id: 'cap',
          label: 'Cap logging',
          then: {
            status: 'succeeded',
            effects: [...ACCORD_EFFECTS, { kind: 'flag', flag: 'logging-cap' }],
            journal: 'Signed the Woodland Accord: no lumber camp will grow past its first tier. Greenveil is now your ally and its archers will march for you.',
          },
        },
        {
          id: 'compensate',
          label: 'Pay for the groves',
          gold: 200,
          then: {
            status: 'succeeded',
            effects: [...ACCORD_EFFECTS],
            journal: 'Paid Greenveil for its felled groves and signed the Woodland Accord. Greenveil is now your ally and its archers will march for you.',
          },
        },
        {
          id: 'reject',
          label: 'Send the envoy away',
          then: {
            status: 'failed',
            effects: [{ kind: 'flag', flag: 'greenveil-rejected' }],
            journal: 'Sent Greenveil\'s envoy away. The woodland court will not forget it, and its archers stay home.',
          },
        },
      ],
      deadline: {
        months: 4,
        outcome: {
          status: 'failed',
          effects: [{ kind: 'flag', flag: 'greenveil-rejected' }],
          journal: 'Greenveil\'s envoy waited four months for an answer and went home. The woodland court takes the silence as a refusal.',
        },
      },
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'Greenveil changed hands. There is no longer a court to make an accord with.' },
  refusals: {
    resolved: 'The woodland court has its answer.',
    envoy: 'Send an army to Greenveil or a neighboring road before answering the envoy.',
    battle: 'You cannot negotiate during a battle.',
  },
};

export const QUESTS: Record<string, QuestDefinition> = {
  [FENWICK_CHARTER.id]: FENWICK_CHARTER,
  [WOODLAND_ACCORD.id]: WOODLAND_ACCORD,
};
