import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { armyAt, checkStatus, makeTroop, neighborsOf, newGame, recruit, recruitQuote } from './campaign';
import { settleTreasury } from './economy';
import { heldQty } from './items';
import { advanceQuests, chooseQuest, onTownOwnershipChange, questQuote, trackedQuests } from './quests';
import { parseSave } from './saves';
import type { GameState, QuestEvent } from './types';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

function month(s: GameState) {
  settleTreasury(s, [], []);
  s.turn += 1;
  advanceQuests(s);
  checkStatus(s);
}

const food = (s: GameState, town: string) => s.cityEconomies[town].goods.food;

/** A Western Realm game in month 3 with M01 done, so the granary has just rotted. */
function granary(): { s: GameState; before: number } {
  const s = newGame(1, 'western-realm');
  const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  home.troops.push(makeTroop(s, 'militia'), makeTroop(s, 'militia'));
  month(s); // month 2: M01 done
  s.cityEconomies.aldenhold.goods.food = 100;
  month(s); // month 3: Q01 offered, the rot strikes
  expect(s.quests.Q01).toMatchObject({ status: 'available', stage: 'warning' });
  return { s, before: 100 };
}

describe('Q01 The Empty Granary', () => {
  it('the rot strikes once, as the quest begins', () => {
    const { s } = granary();
    expect(food(s, 'aldenhold')).toBe(40);
    const again = reload(s);
    month(again);
    expect(food(again, 'aldenhold')).toBe(40);
  });

  it('buying grain costs gold and refills the stores', () => {
    const { s } = granary();
    const gold = s.gold;
    expect(chooseQuest(s, 'Q01', 'buy')).toBeNull();
    expect(s.gold).toBe(gold - 150);
    expect(food(s, 'aldenhold')).toBe(120);
    expect(chooseQuest(s, 'Q01', 'buy')).toBe('This matter is settled.');
  });

  it('an escort moves Millbrook’s grain, but needs your army in Millbrook', () => {
    const { s } = granary();
    const guard = armyAt(s, townLocation(s, 'millbrook'), 'player')!;
    guard.at = neighborsOf(s, guard.at)[0];
    expect(questQuote(s, 'Q01', 'escort').reason).toBe('First: Bring an army to Millbrook.');
    const html = renderCampaign(s, ui(townLocation(s, 'aldenhold')));
    expect(html).toMatch(/data-choice="escort"[^>]*disabled[\s\S]*?<small class="hint">First: Bring an army to Millbrook\.<\/small>/);
    guard.at = townLocation(s, 'millbrook');
    const millbrook = food(s, 'millbrook');
    expect(chooseQuest(s, 'Q01', 'escort')).toBeNull();
    expect(food(s, 'millbrook')).toBe(millbrook - 60);
    expect(food(s, 'aldenhold')).toBe(100);
  });

  it('rationing stops recruiting in Aldenhold for three months, then the stores recover', () => {
    let { s } = granary();
    expect(chooseQuest(s, 'Q01', 'ration')).toBeNull();
    expect(recruitQuote(s, 'aldenhold', 'militia').reason).toBe('Aldenhold is rationing grain (The Empty Granary): no new recruits for now.');
    expect(recruit(s, 'aldenhold', 'militia')).toMatch(/rationing/);
    expect(recruitQuote(s, 'millbrook', 'militia').reason).toBeNull();
    s = reload(s);
    month(s);
    month(s);
    expect(s.quests.Q01.stage).toBe('rationing');
    const stores = food(s, 'aldenhold');
    month(s);
    expect(s.quests.Q01).toMatchObject({ status: 'succeeded', resolvedBy: 'deadline' });
    expect(food(s, 'aldenhold')).toBe(stores + 60);
    expect(recruitQuote(s, 'aldenhold', 'militia').reason).toBeNull();
  });

  it('is tracked ahead of open-ended side quests because it runs out', () => {
    const { s } = granary();
    expect(trackedQuests(s).map((q) => q.id)).toEqual(['M02', 'Q01', 'Q04']);
  });

  it('doing nothing for two months drives people away', () => {
    const { s } = granary();
    const pop = s.towns.aldenhold.pop;
    month(s);
    expect(s.quests.Q01.status).toBe('available');
    month(s);
    expect(s.quests.Q01).toMatchObject({ status: 'failed', resolvedBy: 'deadline' });
    expect(s.towns.aldenhold.pop).toBe(pop - 200);
  });
});

describe('Q06 The Miller on Trial', () => {
  function trial(): GameState {
    const s = newGame(1, 'western-realm');
    s.turn = 6;
    advanceQuests(s);
    expect(s.quests.Q06).toMatchObject({ status: 'available', stage: 'charge' });
    return s;
  }

  it('questioning the witnesses brings the ledger to light exactly once, and convicting with it wins Millbrook back', () => {
    let s = trial();
    expect(heldQty(s, 'hobbs-ledger')).toBe(0);
    expect(questQuote(s, 'Q06', 'convict').reason).toBe('That choice is not open now.');
    expect(chooseQuest(s, 'Q06', 'investigate')).toBeNull();
    expect(s.quests.Q06).toMatchObject({ status: 'active', stage: 'evidence' });
    expect(s.items['hobbs-ledger']).toEqual({ qty: 1, spent: 0, archived: false });
    s = reload(s);
    expect(chooseQuest(s, 'Q06', 'investigate')).toBe('That choice is not open now.');
    const gold = s.gold;
    const pop = s.towns.millbrook.pop;
    expect(chooseQuest(s, 'Q06', 'convict')).toBeNull();
    expect(s.gold).toBe(gold + 150);
    expect(s.towns.millbrook.pop).toBe(pop + 150);
    expect(s.items['hobbs-ledger']).toEqual({ qty: 1, spent: 0, archived: true });
    expect(reload(s).quests.Q06.status).toBe('succeeded');
  });

  it('pardoning him with the ledger returns the grain', () => {
    const s = trial();
    chooseQuest(s, 'Q06', 'investigate');
    const grain = food(s, 'millbrook');
    expect(chooseQuest(s, 'Q06', 'pardon')).toBeNull();
    expect(food(s, 'millbrook')).toBe(grain + 80);
    expect(s.flags).toEqual(['miller-pardoned']);
  });

  it('judging without evidence, either way, costs Millbrook people', () => {
    const fined = trial();
    const pop = fined.towns.millbrook.pop;
    const gold = fined.gold;
    expect(chooseQuest(fined, 'Q06', 'fine')).toBeNull();
    expect(fined).toMatchObject({ gold: gold + 100 });
    expect(fined.towns.millbrook.pop).toBe(pop - 150);
    const dismissed = trial();
    expect(chooseQuest(dismissed, 'Q06', 'dismiss')).toBeNull();
    expect(dismissed.towns.millbrook.pop).toBe(pop - 100);
    expect(dismissed.quests.Q06.status).toBe('failed');
  });

  it('the questioning needs your army in Millbrook', () => {
    const s = trial();
    const guard = armyAt(s, townLocation(s, 'millbrook'), 'player')!;
    guard.at = neighborsOf(s, guard.at)[0];
    expect(questQuote(s, 'Q06', 'investigate').reason).toBe('First: Bring an army to Millbrook.');
  });

  it('if Millbrook falls mid-trial the evidence stays on record, and the save still accounts for it', () => {
    const s = trial();
    chooseQuest(s, 'Q06', 'investigate');
    s.towns.millbrook.owner = 'orcs';
    onTownOwnershipChange(s, 'millbrook', 'orcs');
    expect(s.quests.Q06).toMatchObject({ status: 'superseded', resolvedBy: 'location-lost' });
    expect(s.quests.Q06.history.at(-1)!.choice).toBe('(location-lost)');
    expect(reload(s).items['hobbs-ledger'].qty).toBe(1);
  });

  it('save validation rejects the ledger before the witnesses are questioned', () => {
    const s = trial();
    s.items['hobbs-ledger'] = { qty: 1, spent: 0, archived: false };
    expect(() => reload(s)).toThrow(/inventory object with no quest that granted it/);
  });
});

describe('city quest content validation', () => {
  const check = (edit: (c: typeof CATALOG) => void) => {
    const copy = structuredClone(CATALOG);
    edit(copy);
    return validateContent(copy).join('\n');
  };

  it('checks spoilage, evidence events, goods and choice needs', () => {
    const rot = (c: typeof CATALOG) => c.quests.Q01.stages[0].onStart![0] as Extract<QuestEvent, { kind: 'spoil' }>;
    expect(check((c) => (rot(c).keep = 1.5))).toMatch(/invalid spoilage fraction/);
    expect(check((c) => (rot(c).town = 'atlantis'))).toMatch(/spoils goods in unknown town "atlantis"/);
    expect(check((c) => (c.quests.Q06.stages[1].onStart = [{ kind: 'item', item: 'healing-draught' }]))).toMatch(/can only bring evidence to light/);
    expect(check((c) => (c.quests.Q01.stages[0].choices[0].then = { status: 'succeeded', journal: '', effects: [{ kind: 'goods', town: 'atlantis', good: 'food', amount: 5 }] })))
      .toMatch(/changes unknown town "atlantis"/);
    expect(check((c) => (c.quests.Q01.stages[0].choices[1].needs = [{ kind: 'army-at', place: 'atlantis' }]))).toMatch(/requires unknown place "atlantis"/);
    expect(check((c) => (c.quests.Q01.stages[1].recruitBan = ['atlantis']))).toMatch(/bans recruiting in unknown town "atlantis"/);
  });
});
