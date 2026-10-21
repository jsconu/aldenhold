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
      status: 'succeeded', effects: [{ kind: 'gold', amount: 100 }, { kind: 'item', item: 'oathlance' }],
      journal: 'The council of Aldenhold swore to you before your new companies, returned your father\u2019s Oathlance, and granted 100 gold.',
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
      objectives: [{ id: 'already-held', label: 'Secured Westmere', when: [{ kind: 'town-owner', town: 'westmere', owner: 'player' }], then: {
        status: 'succeeded', effects: [], journal: 'Westmere is already yours, and the bridge tolls with it. The guild’s dispute is settled.',
      } }],
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
      deadline: { months: 4, afterBattles: true, outcome: {
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

/*
 * Western chapter side quests with encounters (9c). Each fight happens at a landmark; your army must be there.
 * Losing or retreating leaves the quest open to try again, until its deadline if it has one.
 */
export const Q02_ONE_EYE: QuestDefinition = {
  id: 'Q02', campaignIds: WEST, kind: 'side', name: 'One Eye at the Quarry', giver: 'Quarrymen at court', at: 'aldenhold',
  summary: 'A cyclops has driven the quarrymen out of the Old Quarry. Ore from the hills has slowed to a trickle.',
  prerequisites: [{ kind: 'month', atLeast: 4 }], needsEnvoy: false,
  stages: [{
    id: 'rumor',
    text: 'Hunt the cyclops at the Old Quarry (it hurls boulders, but warns you a turn ahead), or divert the workers to safer ground: your ore mines produce a quarter less.',
    choices: [
      { id: 'hunt', label: 'Hunt the cyclops', then: { encounter: {
        site: 'quarry', owner: 'orcs', troops: ['cyclops'],
        win: { status: 'succeeded', effects: [{ kind: 'flag', flag: 'quarry-cleared' }, { kind: 'gold', amount: 100 }],
          journal: 'The cyclops of the Old Quarry is dead. The quarrymen are back, and your ore mines produce a quarter more.' },
        lose: { stage: 'rumor' },
      } } },
      { id: 'divert', label: 'Divert the workers', then: {
        status: 'failed', effects: [{ kind: 'flag', flag: 'quarry-diverted' }],
        journal: 'The quarrymen were moved to poorer seams. The cyclops keeps the Old Quarry, and your ore mines produce a quarter less.',
      } },
    ],
  }],
  onLocationLost: CAPITAL_LOST,
};

export const Q03_OLD_TOWER: QuestDefinition = {
  id: 'Q03', campaignIds: WEST, kind: 'side', name: 'Beneath the Old Tower', giver: 'An old soldier at the watchtower', at: 'aldenhold',
  summary: 'Below the Old Watchtower is a vault where a minotaur guards the tower\u2019s last pay chest. Only heroes fit through the passage.',
  prerequisites: [{ kind: 'army-at', place: 'watchtower' }], needsEnvoy: false,
  stages: [{
    id: 'trial',
    text: 'Send your heroes into the vault (your lord stays outside, and the rest of the army waits), or leave the tower be. Heroes may retreat from the fight.',
    choices: [
      { id: 'enter', label: 'Send in your heroes', then: { encounter: {
        site: 'watchtower', owner: 'orcs', troops: ['minotaur'], heroesOnly: true,
        win: { status: 'succeeded', effects: [{ kind: 'gold', amount: 250 }, { kind: 'item', item: 'healing-draught' }, { kind: 'item', item: 'old-watch-shield' }],
          journal: 'Your heroes slew the minotaur beneath the Old Watchtower and carried out the pay chest (250 gold and a healing draught) and the Shield of the Old Watch.' },
        lose: { stage: 'trial' },
      } } },
      { id: 'leave', label: 'Leave the tower be', then: { status: 'failed', effects: [], journal: 'You left the vault beneath the Old Watchtower sealed.' } },
    ],
  }],
  onLocationLost: CAPITAL_LOST,
};

export const Q05_MISSING_CARAVAN: QuestDefinition = {
  id: 'Q05', campaignIds: WEST, kind: 'side', name: 'The Missing Caravan', giver: 'Merra, a Fenwick merchant', at: 'fenwick',
  summary: 'Goblins took Merra\u2019s caravan on the north road and dragged it into the Abandoned Mine.',
  prerequisites: [{ kind: 'month', atLeast: 5 }, { kind: 'any', of: [
    { kind: 'town-owner', town: 'fenwick', owner: 'neutral' },
    { kind: 'town-owner', town: 'fenwick', owner: 'player' },
  ] }],
  needsEnvoy: true,
  survivesConquest: true,
  stages: [
    {
      id: 'plea', text: 'Track the goblins to the Abandoned Mine within three months, or pay their 200 gold ransom for the survivors.',
      choices: [
        { id: 'track', label: 'Track the goblins', then: { stage: 'track' } },
        { id: 'ransom', label: 'Pay the ransom', gold: 200, then: {
          status: 'succeeded', effects: [{ kind: 'flag', flag: 'caravan-ransomed' }],
          journal: 'You paid the goblins. Merra\u2019s drivers came home; her goods did not.',
        } },
      ],
    },
    {
      id: 'track', text: 'Clear the goblins out of the Abandoned Mine.',
      choices: [
        { id: 'raid', label: 'Storm the mine', then: { encounter: {
          site: 'mine', owner: 'orcs', troops: ['goblinSkirmishers', 'goblinSkirmishers', 'orcArchers'],
          win: { status: 'succeeded', effects: [{ kind: 'flag', flag: 'caravan-rescued' }, { kind: 'gold', amount: 150 }, { kind: 'item', item: 'healing-draught', qty: 2 }],
            journal: 'You freed Merra\u2019s drivers and her wagons from the Abandoned Mine. She paid 150 gold and two healing draughts from her stock.' },
          lose: { stage: 'track' },
        } } },
      ],
      deadline: { months: 3, outcome: {
        status: 'failed', effects: [{ kind: 'flag', flag: 'caravan-lost' }],
        journal: 'Three months passed. The goblins sold Merra\u2019s caravan off piece by piece, and her drivers were never seen again.',
      } },
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'Fenwick fell, and Merra fled west with what she had left.' },
  refusals: { envoy: 'Send an army to Fenwick or a neighbouring road to hear Merra out.', battle: 'Not during a battle.' },
};

/*
 * Western chapter city quests (9d): decisions inside your own towns, paid for in gold, grain, recruits or people.
 */
export const Q01_EMPTY_GRANARY: QuestDefinition = {
  id: 'Q01', campaignIds: WEST, kind: 'side', name: 'The Empty Granary', giver: 'The Aldenhold granary keeper', at: 'aldenhold',
  summary: 'Rot got into the Aldenhold granary and most of the grain had to be burned. The stores will not last.',
  prerequisites: [{ kind: 'quest', quest: 'M01', status: 'succeeded' }, { kind: 'month', atLeast: 3 }],
  needsEnvoy: false,
  stages: [
    {
      id: 'warning',
      text: 'Buy grain from the river traders, escort a shipment from Millbrook (your army must be there), or ration: Aldenhold raises no troops for three months while the stores recover.',
      onStart: [{ kind: 'spoil', town: 'aldenhold', good: 'food', keep: 0.4 }],
      choices: [
        { id: 'buy', label: 'Buy grain', gold: 150, then: {
          status: 'succeeded', effects: [{ kind: 'goods', town: 'aldenhold', good: 'food', amount: 80 }],
          journal: 'You bought 80 loads of grain from the river traders. Aldenhold\u2019s granary is filling again.',
        } },
        { id: 'escort', label: 'Escort grain from Millbrook',
          needs: [{ kind: 'town-owner', town: 'millbrook', owner: 'player' }, { kind: 'army-at', place: 'millbrook' }, { kind: 'food', town: 'millbrook', atLeast: 60 }],
          then: {
            status: 'succeeded', effects: [
              { kind: 'goods', town: 'millbrook', good: 'food', amount: -60 },
              { kind: 'goods', town: 'aldenhold', good: 'food', amount: 60 },
            ],
            journal: 'Your soldiers brought 60 wagonloads of Millbrook grain safely to Aldenhold.',
          } },
        { id: 'ration', label: 'Ration the grain', then: { stage: 'rationing' } },
      ],
      deadline: { months: 2, outcome: {
        status: 'failed', effects: [{ kind: 'population', town: 'aldenhold', amount: -200 }],
        journal: 'No help came for the granary. Two hundred people left Aldenhold for towns with bread.',
      } },
    },
    {
      id: 'rationing', text: 'Aldenhold is on short rations and raises no troops until the stores recover.', choices: [],
      recruitBan: ['aldenhold'],
      deadline: { months: 3, outcome: {
        status: 'succeeded', effects: [{ kind: 'goods', town: 'aldenhold', good: 'food', amount: 60 }],
        journal: 'Three hard months of rationing are over. Aldenhold\u2019s stores have recovered and recruiting resumes.',
      } },
    },
  ],
  onLocationLost: CAPITAL_LOST,
};

export const Q06_MILLER_ON_TRIAL: QuestDefinition = {
  id: 'Q06', campaignIds: WEST, kind: 'side', name: 'The Miller on Trial', giver: 'The people of Millbrook', at: 'millbrook',
  summary: 'Millbrook accuses Hobb the miller of hoarding grain while the village went hungry, and asks for your judgment.',
  prerequisites: [{ kind: 'month', atLeast: 6 }, { kind: 'town-owner', town: 'millbrook', owner: 'player' }],
  needsEnvoy: false,
  stages: [
    {
      id: 'charge',
      text: 'Investigate (your army must be in Millbrook to question the witnesses), fine Hobb on the villagers\u2019 word, or dismiss the charge.',
      choices: [
        { id: 'investigate', label: 'Question the witnesses', needs: [{ kind: 'army-at', place: 'millbrook' }], then: { stage: 'evidence' } },
        { id: 'fine', label: 'Fine him on their word', then: {
          status: 'failed', effects: [{ kind: 'gold', amount: 100 }, { kind: 'population', town: 'millbrook', amount: -150 }, { kind: 'flag', flag: 'miller-judged-unheard' }],
          journal: 'You fined Hobb 100 gold without hearing him. Half of Millbrook calls it justice; a hundred and fifty of the other half packed up and left.',
        } },
        { id: 'dismiss', label: 'Dismiss the charge', then: {
          status: 'failed', effects: [{ kind: 'population', town: 'millbrook', amount: -100 }, { kind: 'flag', flag: 'miller-dismissed' }],
          journal: 'You dismissed the charge against Hobb. His accusers say there is no justice in Millbrook, and a hundred of them left.',
        } },
      ],
    },
    {
      id: 'evidence',
      text: 'Hobb\u2019s own grain ledger shows he sold Millbrook\u2019s grain to Westmere at famine prices. Convict him, or pardon him if he gives the grain back.',
      onStart: [{ kind: 'item', item: 'hobbs-ledger' }],
      choices: [
        { id: 'convict', label: 'Convict him', requires: ['hobbs-ledger'], then: {
          status: 'succeeded',
          effects: [{ kind: 'archive', item: 'hobbs-ledger' }, { kind: 'gold', amount: 150 }, { kind: 'population', town: 'millbrook', amount: 150 }, { kind: 'flag', flag: 'miller-convicted' }],
          journal: 'With his own ledger before the court, Hobb was convicted and fined 150 gold. Families who had left Millbrook came home.',
        } },
        { id: 'pardon', label: 'Pardon him for the grain', requires: ['hobbs-ledger'], then: {
          status: 'succeeded',
          effects: [{ kind: 'archive', item: 'hobbs-ledger' }, { kind: 'goods', town: 'millbrook', good: 'food', amount: 80 }, { kind: 'flag', flag: 'miller-pardoned' }],
          journal: 'Shown his own ledger, Hobb begged pardon and returned 80 loads of grain to Millbrook\u2019s stores.',
        } },
      ],
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'Millbrook fell before Hobb could be judged.' },
};

export const QUESTS: Record<string, QuestDefinition> = {
  [FENWICK_CHARTER.id]: FENWICK_CHARTER,
  [WOODLAND_ACCORD.id]: WOODLAND_ACCORD,
  [M01_INHERITANCE.id]: M01_INHERITANCE,
  [M02_BREAD_AND_LAW.id]: M02_BREAD_AND_LAW,
  [M03_CROSSING.id]: M03_CROSSING,
  [M04_INCURSION.id]: M04_INCURSION,
  [Q01_EMPTY_GRANARY.id]: Q01_EMPTY_GRANARY,
  [Q02_ONE_EYE.id]: Q02_ONE_EYE,
  [Q03_OLD_TOWER.id]: Q03_OLD_TOWER,
  [Q05_MISSING_CARAVAN.id]: Q05_MISSING_CARAVAN,
  [Q06_MILLER_ON_TRIAL.id]: Q06_MILLER_ON_TRIAL,
};
