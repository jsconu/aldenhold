import type { QuestDefinition, QuestResolution } from '../game/types';

const LOST: QuestResolution = { status: 'failed', effects: [], journal: 'The expedition did not prevail. The attempt is over and no reward is granted.' };
const CHANGED: QuestResolution = { status: 'superseded', effects: [], journal: 'The sponsoring town changed rulers. Its expedition request is withdrawn.' };
function siteQuest(id: string, name: string, at: string, encounter: string, summary: string, reward: QuestResolution): QuestDefinition {
  return { id, campaignIds: ['western-realm'], kind: 'side', name, at, giver: 'Western road wardens', summary,
    prerequisites: [{ kind: 'month', atLeast: 2 }], needsEnvoy: false, onLocationLost: CHANGED,
    stages: [
      { id: 'trail', text: 'March to the named site, review the force and risks, then commit. You may leave this optional expedition alone.', choices: [
        { id: 'fight', label: 'Enter the encounter', encounter, then: { stage: 'battle' } },
        { id: 'leave', label: 'Abandon this request', then: { status: 'failed', effects: [], journal: `Declined ${name}. No expedition was sent.` } },
      ] },
      { id: 'battle', text: 'Resolve the committed expedition. Retreat remains possible; rewards require victory.', choices: [], objectives: [
        { id: 'won', label: 'Won the expedition', when: [{ kind: 'encounter', encounter, status: 'won' }], then: reward },
        { id: 'beaten', label: 'The expedition did not prevail', when: [{ kind: 'any', of: [
          { kind: 'encounter', encounter, status: 'lost' }, { kind: 'encounter', encounter, status: 'withdrawn' },
        ] }], then: LOST },
      ] },
    ],
  };
}

/** First playable versions use existing opponents; the planned monster-specific boss mechanics follow later. */
export const ENCOUNTER_QUESTS: Record<string, QuestDefinition> = {
  Q02: siteQuest('Q02', 'One Eye at the Quarry', 'harrowgate', 'quarry-one-eye',
    'The road wardens report a troll called One Eye and its orc handlers in the Old Quarry. Bring an army to clear them. The wardens offer 120 gold and two Healing Draughts.',
    { status: 'succeeded', effects: [{ kind: 'gold', amount: 120 }, { kind: 'item', item: 'healing-draught', qty: 2 }], journal: 'Cleared One Eye’s quarry camp. The wardens paid 120 gold and two Healing Draughts.' }),
  Q03: siteQuest('Q03', 'Beneath the Old Tower', 'duskwater', 'tower-keeper',
    'An orc keeper guards the buried stair beneath the Old Watchtower. Only heroes can enter. The buried stores hold healing and mana draughts.',
    { status: 'succeeded', effects: [{ kind: 'item', item: 'healing-draught', qty: 2 }, { kind: 'item', item: 'mana-draught', qty: 2 }], journal: 'Defeated the keeper beneath the Old Tower. The expedition recovered two Healing Draughts and two Mana Draughts.' }),
  Q05: {
    ...siteQuest('Q05', 'The Missing Caravan', 'fenwick', 'caravan-rescue',
      'Fenwick’s merchants found tracks leading to raiders near Stone Bridge. Pay their ransom now, or reach the bridge and rescue the caravan within three months.',
      { status: 'succeeded', effects: [{ kind: 'gold', amount: 150 }, { kind: 'item', item: 'healing-draught' }, { kind: 'flag', flag: 'caravan-rescued' }], journal: 'Rescued the missing caravan. The merchants paid 150 gold and a Healing Draught; your support is recorded.' }),
    giver: 'Fenwick Merchants',
  },
};
// A visible timer and an alternative to combat; the next stage has no deadline while the battle is active.
ENCOUNTER_QUESTS.Q05.stages[0].deadline = { months: 3, outcome: {
  status: 'failed', effects: [{ kind: 'flag', flag: 'caravan-lost' }], journal: 'Three months passed without rescuing or ransoming the caravan. Fenwick’s merchants recorded the loss.',
} };
ENCOUNTER_QUESTS.Q05.stages[0].choices.push({ id: 'ransom', label: 'Pay ransom — 100 gold', gold: 100, then: {
  status: 'succeeded', effects: [{ kind: 'flag', flag: 'caravan-ransomed' }], journal: 'Paid 100 gold to ransom the caravan. Its people returned safely; no bounty was paid.',
} });
