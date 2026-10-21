import { ENCOUNTER_QUESTS } from './encounterQuests';
import type { QuestDefinition, QuestResolution } from '../game/types';

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

/*
 * Act I, "The Inheritance": the Western chapter's main objectives (M01–M04). Finishing M04 completes the chapter.
 * Each one unlocks the next. Goals are checked at the end of each month. Side quests can help (an alliance counts
 * toward M02's standing) but are never the only way through (QUEST-06).
 */
const WEST: QuestDefinition['campaignIds'] = ['western-realm'];
const CAPITAL_LOST: QuestResolution = { status: 'superseded', effects: [], journal: 'Aldenhold has fallen.' };

export const M01_INHERITANCE: QuestDefinition = {
  id: 'M01', campaignIds: WEST, kind: 'main', name: 'The Inheritance', giver: 'The Aldenhold council', at: 'aldenhold',
  summary: 'Your father is dead and the hall is yours. The council will swear to you once Aldenhold can defend itself.',
  prerequisites: [], needsEnvoy: false,
  stages: [{
    id: 'muster', text: 'Raise two more formations to guard the realm.', choices: [],
    objectives: [{ id: 'mustered', label: 'Mustered the guard', when: [{ kind: 'formations', atLeast: 7 }], then: {
      status: 'succeeded', effects: [{ kind: 'gold', amount: 100 }],
      journal: 'The council of Aldenhold swore to you before your new companies, and the treasury granted 100 gold.',
    } }],
  }],
  onLocationLost: CAPITAL_LOST,
};

export const M02_BREAD_AND_LAW: QuestDefinition = {
  id: 'M02', campaignIds: WEST, kind: 'main', name: 'Bread and Law', giver: 'The Aldenhold council', at: 'aldenhold',
  summary: 'A ruler who cannot feed the people or keep the neighbours will not last the winter.',
  prerequisites: [{ kind: 'quest', quest: 'M01', status: 'succeeded' }], needsEnvoy: false,
  stages: [{
    id: 'secure', text: 'Fill Aldenhold’s granary and win the standing of three towns, by rule or by alliance.', choices: [],
    objectives: [{ id: 'secured', label: 'Fed the realm and won its towns', when: [
      { kind: 'food', town: 'aldenhold', atLeast: 120 },
      { kind: 'standing', atLeast: 3 },
    ], then: {
      status: 'succeeded', effects: [{ kind: 'gold', amount: 150 }],
      journal: 'Aldenhold’s granary is full and three towns answer to you. The guilds sent 150 gold in thanks.',
    } }],
  }],
  onLocationLost: CAPITAL_LOST,
};

export const M03_CROSSING: QuestDefinition = {
  id: 'M03', campaignIds: WEST, kind: 'main', name: 'The Crossing Dispute', giver: 'Westmere Guild of Tolls', at: 'westmere',
  summary: 'Westmere’s guild claims the tolls of Stone Bridge and has barred your soldiers from crossing without paying.',
  prerequisites: [{ kind: 'quest', quest: 'M02', status: 'succeeded' }], needsEnvoy: true,
  stages: [
    {
      id: 'dispute', text: 'Buy the guild’s charter for 250 gold and make Westmere an ally, or refuse and take the town.',
      choices: [
        { id: 'charter', label: 'Buy the toll charter', gold: 250, then: {
          status: 'succeeded', effects: [{ kind: 'treaty', town: 'westmere', relation: 'ally', passage: true }],
          journal: 'You bought the Stone Bridge charter. Westmere is now your ally and your armies cross freely.',
        } },
        { id: 'refuse', label: 'Refuse and march', then: { stage: 'seize' } },
      ],
      deadline: { months: 6, outcome: {
        status: 'failed', effects: [],
        journal: 'Six months passed without an answer. Westmere keeps the bridge tolls, and the dispute is left unsettled.',
      } },
    },
    {
      id: 'seize', text: 'Take Westmere by force.', choices: [],
      objectives: [{ id: 'taken', label: 'Took Westmere', when: [{ kind: 'town-owner', town: 'westmere', owner: 'player' }], then: {
        status: 'succeeded', effects: [], journal: 'Westmere is yours, and the bridge tolls with it.',
      } }],
      deadline: { months: 6, outcome: {
        status: 'failed', effects: [], journal: 'Westmere held out against you. The bridge stays in the guild’s hands.',
      } },
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'Westmere fell to the orcs before the dispute was settled.' },
  refusals: { envoy: 'Send an army to Westmere or a neighbouring road to talk to the guild.', battle: 'You cannot negotiate during a battle.' },
};

export const M04_INCURSION: QuestDefinition = {
  id: 'M04', campaignIds: WEST, kind: 'main', name: 'The First Incursion', giver: 'Your scouts', at: 'aldenhold',
  summary: 'Two war bands have left the east together: one through Grey Pass for Millbrook, one from the goblin camp for Aldenhold.',
  prerequisites: [{ kind: 'any', of: [
    { kind: 'quest', quest: 'M03', status: 'succeeded' },
    { kind: 'quest', quest: 'M03', status: 'failed' },
    { kind: 'quest', quest: 'M03', status: 'superseded' },
  ] }],
  needsEnvoy: false,
  stages: [
    {
      id: 'hold', text: 'Hold Aldenhold and Millbrook for four months.', choices: [],
      onStart: [
        { kind: 'spawn', owner: 'orcs', at: 'pass', troops: ['warband', 'warband', 'orcArchers', 'troll'], target: 'millbrook' },
        { kind: 'spawn', owner: 'orcs', at: 'camp', troops: ['warband', 'warband', 'orcArchers'], target: 'aldenhold' },
      ],
      objectives: [{ id: 'millbrook-lost', label: 'Lost Millbrook', when: [{ kind: 'town-owner', town: 'millbrook', owner: 'orcs' }], then: { stage: 'retake' } }],
      deadline: { months: 4, outcome: {
        status: 'succeeded', effects: [],
        journal: 'Four months on, the incursion has broken against your towns. The west is safe for now.',
      } },
    },
    {
      id: 'retake', text: 'Millbrook has fallen. Take it back.', choices: [],
      objectives: [{ id: 'retaken', label: 'Retook Millbrook', when: [{ kind: 'town-owner', town: 'millbrook', owner: 'player' }], then: {
        status: 'succeeded', effects: [], journal: 'Millbrook is free again. The incursion is broken.',
      } }],
    },
  ],
  onLocationLost: CAPITAL_LOST,
};

export const QUESTS: Record<string, QuestDefinition> = {
  ...ENCOUNTER_QUESTS,
  [FENWICK_CHARTER.id]: FENWICK_CHARTER,
  [WOODLAND_ACCORD.id]: WOODLAND_ACCORD,
  [M01_INHERITANCE.id]: M01_INHERITANCE,
  [M02_BREAD_AND_LAW.id]: M02_BREAD_AND_LAW,
  [M03_CROSSING.id]: M03_CROSSING,
  [M04_INCURSION.id]: M04_INCURSION,
};
