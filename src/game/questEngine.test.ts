import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { QUESTS } from '../content/quests';
import { validateContent } from '../content/validate';
import { advanceMonth, newGame } from './campaign';
import { advanceQuests, chooseQuest, onTownOwnershipChange, questQuote } from './quests';
import { parseSave } from './saves';
import type { GameState, QuestDefinition } from './types';

/** A two-stage fixture quest: pay the miller, then collect a reward before the deadline. */
const TOLL: QuestDefinition = {
  id: 'TEST-TOLL',
  campaignIds: ['valley-quickplay'],
  kind: 'side',
  name: 'The Toll Road',
  giver: 'Millbrook Miller',
  at: 'millbrook',
  summary: 'The miller will open a toll road if you fund it.',
  prerequisites: [{ kind: 'month', atLeast: 2 }],
  needsEnvoy: false,
  stages: [
    {
      id: 'offer',
      text: 'Fund the road for 50 gold, or refuse.',
      choices: [
        { id: 'fund', label: 'Fund the road', gold: 50, then: { stage: 'collect' } },
        { id: 'refuse', label: 'Refuse', then: { status: 'failed', effects: [], journal: 'You refused the miller.' } },
      ],
    },
    {
      id: 'collect',
      text: 'Collect the first tolls.',
      choices: [{ id: 'collect', label: 'Collect', then: { status: 'succeeded', effects: [{ kind: 'gold', amount: 120 }, { kind: 'flag', flag: 'toll-road' }], journal: 'The toll road pays out.' } }],
      deadline: { months: 2, outcome: { status: 'failed', effects: [], journal: 'The miller gave up waiting.' } },
    },
  ],
  onLocationLost: { status: 'superseded', effects: [], journal: 'The miller fled.' },
};

/** Unlocks only once the toll road succeeded. */
const FOLLOW: QuestDefinition = {
  ...TOLL,
  id: 'TEST-FOLLOW',
  name: 'Traffic on the Road',
  prerequisites: [{ kind: 'quest', quest: 'TEST-TOLL', status: 'succeeded' }],
  stages: [{ id: 'go', text: 'Go.', choices: [{ id: 'ok', label: 'Ok', then: { status: 'succeeded', effects: [], journal: 'Done.' } }] }],
};

beforeEach(() => {
  QUESTS[TOLL.id] = TOLL;
  QUESTS[FOLLOW.id] = FOLLOW;
});
afterEach(() => {
  delete QUESTS[TOLL.id];
  delete QUESTS[FOLLOW.id];
});

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

describe('quest engine', () => {
  it('unlocks a quest when its prerequisites hold, announcing it in the month report', () => {
    const s = newGame(1);
    expect(s.quests[TOLL.id].status).toBe('unavailable');
    const report = advanceMonth(s)!;
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'available', stage: 'offer', stageTurn: 2 });
    expect(report.phases.find((p) => p.id === 'quests')!.notes.map((n) => n.text)).toContain('New quest: The Toll Road, offered at Millbrook.');
  });

  it('does not fire stage-start spawns for a giver lost before the quest became eligible', () => {
    QUESTS[TOLL.id] = structuredClone(TOLL);
    QUESTS[TOLL.id].stages[0].onStart = [{ kind: 'spawn', owner: 'orcs', at: 'millbrook', troops: ['warband'] }];
    const s = newGame(1);
    s.towns.millbrook.owner = 'orcs';
    s.turn = 2;
    const armies = structuredClone(s.armies);
    const nextId = s.nextId;
    const news = advanceQuests(s);
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'superseded', resolvedBy: 'location-lost' });
    expect(s.armies).toEqual(armies);
    expect(s.nextId).toBe(nextId);
    expect(news).not.toContain('New quest: The Toll Road, offered at Millbrook.');
    expect(reload(s).quests[TOLL.id].status).toBe('superseded');
  });

  it('a full success: pays the cost once, moves through stages, and grants gold and a flag exactly once', () => {
    let s = newGame(1);
    advanceMonth(s);
    const gold = s.gold;
    expect(chooseQuest(s, TOLL.id, 'fund')).toBeNull();
    expect(s.gold).toBe(gold - 50);
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'active', stage: 'collect' });
    s = reload(s);
    expect(chooseQuest(s, TOLL.id, 'fund')).toBe('That choice is not open now.');
    expect(chooseQuest(s, TOLL.id, 'collect')).toBeNull();
    expect(s.gold).toBe(gold - 50 + 120);
    expect(s.flags).toEqual(['toll-road']);
    s = reload(s);
    expect(chooseQuest(s, TOLL.id, 'collect')).toBe('This matter is settled.');
    expect(s.gold).toBe(gold - 50 + 120);
    expect(s.quests[TOLL.id].history.map((h) => h.choice)).toEqual(['fund', 'collect']);
    // The quest's gold went through the ledger: the month reconciles with no correction.
    const report = advanceMonth(s)!;
    expect(report.ledger!.entries.map((e) => e.category)).toEqual(expect.arrayContaining(['quest', 'quest-reward']));
    expect(report.ledger!.entries.some((e) => e.category === 'balance-correction')).toBe(false);
    // And it unlocked the follow-up quest.
    expect(s.quests[FOLLOW.id].status).toBe('available');
  });

  it('a refusal ends the quest failed, and the follow-up never unlocks', () => {
    const s = newGame(1);
    advanceMonth(s);
    expect(chooseQuest(s, TOLL.id, 'refuse')).toBeNull();
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'failed', resolvedBy: 'choice' });
    advanceMonth(s);
    expect(s.quests[FOLLOW.id].status).toBe('unavailable');
  });

  it('a missed deadline fails the stage on the month it runs out, recorded in the history', () => {
    const s = newGame(1);
    advanceMonth(s); // month 2: unlocked
    chooseQuest(s, TOLL.id, 'fund'); // collect stage begins in month 2, two months to finish
    advanceMonth(s); // month 3: still open
    expect(s.quests[TOLL.id].status).toBe('active');
    advanceMonth(s); // month 4: time is up
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'failed', resolvedBy: 'deadline', resolvedTurn: 4 });
    expect(s.quests[TOLL.id].history.at(-1)!.choice).toBe('(deadline)');
    expect(s.journal.at(-1)!.text).toBe('The miller gave up waiting.');
    expect(reload(s).quests[TOLL.id].status).toBe('failed');
  });

  it('losing the quest’s town ends it with its fallback, and its rewards can no longer be claimed', () => {
    const s = newGame(1);
    advanceMonth(s);
    s.towns.millbrook.owner = 'orcs';
    onTownOwnershipChange(s, 'millbrook', 'orcs');
    expect(s.quests[TOLL.id]).toMatchObject({ status: 'superseded', resolvedBy: 'location-lost' });
    expect(questQuote(s, TOLL.id, 'fund').reason).toBe('This matter is settled.');
  });

  it('save validation rejects forged rewards and impossible progress', () => {
    const s = newGame(1);
    advanceMonth(s);
    chooseQuest(s, TOLL.id, 'fund');
    chooseQuest(s, TOLL.id, 'collect');
    const forgedFlag = structuredClone(s);
    forgedFlag.flags.push('free-castle');
    expect(() => reload(forgedFlag)).toThrow(/flag with no quest/);
    const missingFlag = structuredClone(s);
    missingFlag.flags = [];
    expect(() => reload(missingFlag)).toThrow(/missing quest flag/);
    const badStage = structuredClone(s);
    badStage.quests[FOLLOW.id] = { ...badStage.quests[FOLLOW.id], status: 'available', stage: 'nowhere', stageTurn: 2 };
    expect(() => reload(badStage)).toThrow(/quest stage/);
  });
});

describe('quest content validation', () => {
  const check = (edit: (q: Record<string, QuestDefinition>) => void) => {
    const copy = structuredClone(CATALOG);
    edit(copy.quests);
    return validateContent(copy).join('\n');
  };

  it('accepts the fixtures', () => {
    expect(validateContent(CATALOG)).toEqual([]);
  });

  it('catches prerequisite loops and outcomes a quest can never produce', () => {
    expect(check((q) => q[TOLL.id].prerequisites.push({ kind: 'quest', quest: FOLLOW.id, status: 'succeeded' }))).toMatch(/prerequisites loop: .*TEST-TOLL/);
    expect(check((q) => (q[FOLLOW.id].prerequisites = [{ kind: 'quest', quest: 'Q00', status: 'superseded' }]))).toBe('');
    expect(check((q) => (q[FOLLOW.id].prerequisites = [{ kind: 'quest', quest: TOLL.id, status: 'superseded' }]))).toBe('');
    q0NeverSucceeds: {
      const out = check((q) => {
        q.Q00.stages[0].choices = q.Q00.stages[0].choices.filter((c) => c.id !== 'sign');
        q[FOLLOW.id].prerequisites = [{ kind: 'quest', quest: 'Q00', status: 'succeeded' }];
      });
      expect(out).toMatch(/requires "Q00" to end succeeded, which it never can/);
    }
  });

  it('catches broken stage links, unknown items and towns outside the campaign', () => {
    expect(check((q) => ((q[TOLL.id].stages[0].choices[0].then as { stage: string }).stage = 'nowhere'))).toMatch(/leads to unknown stage "nowhere"/);
    expect(check((q) => (q[TOLL.id].onLocationLost.effects = [{ kind: 'item', item: 'crown' }]))).toMatch(/unknown item "crown"/);
    expect(check((q) => (q[TOLL.id].at = 'greenveil'))).toMatch(/town "greenveil" is not in campaign "valley-quickplay"/);
  });
});

describe('save migration v10 → v11', () => {
  it('converts the old quest record, keeping a signed charter signed with its history', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    const v10 = JSON.parse(JSON.stringify(s));
    v10.version = 10;
    delete v10.flags;
    v10.quests = { Q00: { status: 'succeeded', stage: 'resolved', choice: 'sign', resolvedTurn: 1 } };
    const restored = parseSave(JSON.stringify(v10));
    expect(restored.version).toBe(12);
    expect(restored.quests.Q00).toEqual({ status: 'succeeded', stage: 'resolved', choice: 'sign', resolvedTurn: 1,
      resolvedBy: 'choice', stageTurn: null, history: [{ stage: 'decision', choice: 'sign', turn: 1 }] });
    expect(restored.quests[TOLL.id].status).toBe('unavailable');
    expect(restored.flags).toEqual([]);
    expect(restored.items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
  });
});
