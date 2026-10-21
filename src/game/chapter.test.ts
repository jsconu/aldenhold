import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { raidPath } from './ai';
import { advanceMonth, applyBattle, armyAt, checkStatus, makeTroop, neighborsOf, newGame, startLocation } from './campaign';
import { autoResolve } from './battle';
import { settleHeldQuests, advanceQuests, chooseQuest, conditionText, onTownOwnershipChange, questQuote } from './quests';
import { parseSave } from './saves';
import type { GameState, QuestEvent } from './types';
import { landAt, townLocation } from './world';
import { LAND } from '../content/rules';
import { settleTreasury } from './economy';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** Close the month's books, then run the next month's quest phase and ending check, without the orc AI. */
function month(s: GameState) {
  settleTreasury(s, [], []);
  s.turn += 1;
  advanceQuests(s);
  settleHeldQuests(s);
  checkStatus(s);
}

function raise(s: GameState, n: number) {
  const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  for (let i = 0; i < n; i++) home.troops.push(makeTroop(s, 'militia'));
}

function take(s: GameState, town: string, owner: 'player' | 'orcs' = 'player') {
  s.towns[town].owner = owner;
  onTownOwnershipChange(s, town, owner);
  checkStatus(s);
}

/** Camp your home army on open ground next to a town, in envoy range. */
function campBy(s: GameState, town: string) {
  const at = townLocation(s, town);
  armyAt(s, townLocation(s, 'aldenhold'), 'player')!.at = neighborsOf(s, at)
    .find((k) => Number.isFinite(LAND[landAt(s, k)].move) && !s.armies.some((a) => a.at === k))!;
}

/** A chapter game with M01 and M02 done and M03 just offered. */
function atM03(): GameState {
  const s = newGame(1, 'western-realm');
  raise(s, 2);
  month(s); // M01 done; M02 offered the same month
  s.cityEconomies.aldenhold.goods.food = 400; // still 160 after Q01's granary rot (keeps 40%)
  take(s, 'fenwick');
  month(s); // M02 done; M03 offered
  expect(s.quests.M03).toMatchObject({ status: 'available', stageTurn: s.turn });
  return s;
}

describe('Act I: M01 The Inheritance', () => {
  it('is the first objective of the Western Realm, shown with live progress', () => {
    const s = newGame(1, 'western-realm');
    expect(s.quests.M01).toMatchObject({ status: 'available', stage: 'muster' });
    expect(newGame(1).quests.M01.status).toBe('unavailable');
    expect(conditionText(s, { kind: 'formations', atLeast: 7 })).toBe('Field 7 formations (now 5)');
    const html = renderCampaign(s, ui(townLocation(s, 'aldenhold')));
    expect(html).toContain('Objective: The Inheritance');
    expect(html).toContain('○ Field 7 formations (now 5)');
    expect(html).toContain('Goals are checked at the end of each month.');
  });

  it('completes at month end once two more formations are raised, paying its reward exactly once', () => {
    let s = newGame(1, 'western-realm');
    raise(s, 1);
    month(s);
    expect(s.quests.M01.status).toBe('available');
    raise(s, 1);
    const gold = s.gold;
    month(s);
    expect(s.quests.M01).toMatchObject({ status: 'succeeded', resolvedBy: 'objective' });
    expect(s.gold).toBe(gold + 100);
    expect(s.quests.M02).toMatchObject({ status: 'available', stageTurn: s.turn });
    s = reload(s);
    month(s);
    expect(s.gold).toBe(gold + 100);
  });
});

describe('Act I: M02 Bread and Law', () => {
  it('needs both a full granary and three towns by rule or alliance', () => {
    const s = newGame(1, 'western-realm');
    raise(s, 2);
    month(s);
    month(s);
    expect(s.quests.M02.status).toBe('available');
    s.cityEconomies.aldenhold.goods.food = 400; // still 160 after Q01's granary rot (keeps 40%)
    month(s);
    expect(s.quests.M02.status).toBe('available');
    // An alliance counts toward standing just as conquest does.
    s.armies.find((a) => a.owner === 'player')!.at = townLocation(s, 'millbrook');
    s.treaties.fenwick = { relation: 'ally', passage: true, signedTurn: s.turn };
    expect(conditionText(s, { kind: 'standing', atLeast: 3 })).toBe('Rule or ally with 3 towns (now 3)');
    month(s);
    expect(s.quests.M02.status).toBe('succeeded');
  });
});

describe('Act I: M03 The Crossing Dispute', () => {
  it('does not revive a fallen guild when Westmere was lost before the dispute unlocked', () => {
    const s = newGame(1, 'western-realm');
    raise(s, 2);
    month(s);
    take(s, 'westmere', 'orcs');
    s.cityEconomies.aldenhold.goods.food = 400; // still 160 after Q01's granary rot (keeps 40%)
    take(s, 'fenwick');
    month(s);
    expect(s.quests.M03).toMatchObject({ status: 'superseded', resolvedBy: 'location-lost' });
    expect(questQuote(s, 'M03', 'charter').reason).toBe('This matter is settled.');
    expect(reload(s).quests.M03.status).toBe('superseded');
    month(s);
    expect(s.quests.M04.status).toBe('available');
  });

  it('recognizes Westmere already conquered before the dispute is offered', () => {
    const s = newGame(1, 'western-realm');
    raise(s, 2);
    month(s);
    take(s, 'westmere');
    s.cityEconomies.aldenhold.goods.food = 400; // still 160 after Q01's granary rot (keeps 40%)
    month(s);
    expect(s.quests.M03).toMatchObject({ status: 'succeeded', resolvedBy: 'objective' });
    expect(s.treaties.westmere).toBeUndefined();
    expect(reload(s).quests.M03.status).toBe('succeeded');
  });

  it('blocks a stale imported offer immediately and settles its fallen giver next month', () => {
    let s = atM03();
    campBy(s, 'westmere');
    // A save made by the older engine could retain this open offer after an earlier loss.
    s.towns.westmere.owner = 'orcs';
    s = reload(s);
    const gold = s.gold;
    expect(questQuote(s, 'M03', 'charter').reason).toBe('The quest giver’s town has changed hands.');
    expect(chooseQuest(s, 'M03', 'charter')).toBe('The quest giver’s town has changed hands.');
    expect(s.gold).toBe(gold);
    expect(s.treaties.westmere).toBeUndefined();
    month(s);
    expect(reload(s).quests.M03.status).toBe('superseded');
  });

  it('keeps conquered councils unavailable while retaining merchants who survive conquest', () => {
    const s = newGame(1, 'western-realm');
    take(s, 'greenveil');
    take(s, 'fenwick');
    while (s.turn < 5) month(s);
    expect(s.quests.Q04.status).toBe('unavailable');
    expect(s.quests.Q05.status).toBe('available');
    expect(reload(s).quests.Q05.status).toBe('available');
  });

  it('buying the charter allies Westmere with passage', () => {
    const s = atM03();
    expect(s.quests.M03.status).toBe('available');
    expect(questQuote(s, 'M03', 'charter').reason).toBe('Send an army to Westmere or a neighbouring road to talk to the guild.');
    campBy(s, 'westmere');
    s.gold = 1000;
    expect(chooseQuest(s, 'M03', 'charter')).toBeNull();
    expect(s.gold).toBe(750);
    expect(s.treaties.westmere).toMatchObject({ relation: 'ally', passage: true });
    expect(reload(s).quests.M03.status).toBe('succeeded');
  });

  it('taking Westmere by force completes it, rather than counting as losing the town', () => {
    const s = atM03();
    campBy(s, 'westmere');
    chooseQuest(s, 'M03', 'refuse');
    expect(s.quests.M03).toMatchObject({ status: 'active', stage: 'seize' });
    take(s, 'westmere');
    expect(s.quests.M03).toMatchObject({ status: 'succeeded', resolvedBy: 'objective' });
    expect(reload(s).quests.M03.history.map((h) => h.choice)).toEqual(['refuse', 'taken']);
  });

  it('ignoring the guild for six months fails it, and the chapter still goes on', () => {
    const s = atM03();
    for (let i = 0; i < 6; i++) month(s);
    expect(s.quests.M03).toMatchObject({ status: 'failed', resolvedBy: 'deadline' });
    month(s);
    expect(s.quests.M04.status).toBe('available');
  });
});

describe('Act I: M04 The First Incursion', () => {
  function atM04(): GameState {
    const s = atM03();
    while (s.quests.M04.status === 'unavailable' && s.turn < 30) month(s);
    expect(s.quests.M04).toMatchObject({ status: 'available', stageTurn: s.turn });
    return s;
  }

  it('sends two war bands at your towns exactly once', () => {
    let s = atM04();
    const pass = armyAt(s, startLocation(s, 'pass'), 'orcs')!;
    expect(pass.target).toBe('millbrook');
    expect(pass.troops.map((t) => t.type)).toEqual(expect.arrayContaining(['troll', 'orcArchers']));
    expect(armyAt(s, startLocation(s, 'camp'), 'orcs')!.target).toBe('aldenhold');
    const count = s.armies.filter((a) => a.owner === 'orcs').reduce((n, a) => n + a.troops.length, 0);
    s = reload(s);
    month(s);
    expect(s.armies.filter((a) => a.owner === 'orcs').reduce((n, a) => n + a.troops.length, 0)).toBe(count);
    // The pass band plans its route to Millbrook, not the nearest free town.
    expect(raidPath(s, armyAt(s, startLocation(s, 'pass'), 'orcs')!).at(-1)).toBe(townLocation(s, 'millbrook'));
  });

  it('holding out four months completes the chapter', () => {
    let s = atM04();
    for (let i = 0; i < 3; i++) month(s);
    expect(s.status).toBe('playing');
    month(s);
    expect(s.quests.M04).toMatchObject({ status: 'succeeded', resolvedBy: 'deadline' });
    expect(s).toMatchObject({ status: 'won', endingReason: 'chapter-complete' });
    expect(s.journal.at(-1)!.text).toBe('The incursion is broken and the west holds. Act I is complete: the house of Aldenhold endures.');
    s = reload(s);
    expect(renderCampaign(s, ui(townLocation(s, 'aldenhold')))).toContain('Act I: The Inheritance is complete.');
  });

  it('losing Millbrook turns it into a fight to retake the town', () => {
    const s = atM04();
    take(s, 'millbrook', 'orcs');
    month(s);
    expect(s.quests.M04).toMatchObject({ status: 'active', stage: 'retake' });
    for (let i = 0; i < 5; i++) month(s);
    expect(s.status).toBe('playing');
    take(s, 'millbrook');
    month(s);
    expect(s.quests.M04).toMatchObject({ status: 'succeeded', resolvedBy: 'objective' });
    expect(s.endingReason).toBe('chapter-complete');
  });
});

describe('Act I under the real month pipeline', () => {
  it('the incursion marches on an undefended Millbrook; retaking it completes the chapter', () => {
    const s = newGame(1, 'western-realm');
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    for (let m = 0; m < 30 && s.quests.M04.stage !== 'retake'; m++) {
      if (s.quests.M01.status === 'available') home.troops.push(makeTroop(s, 'spearmen'), makeTroop(s, 'archers'));
      if (s.quests.M02.status === 'available') {
        s.cityEconomies.aldenhold.goods.food = Math.max(130, s.cityEconomies.aldenhold.goods.food);
        take(s, 'fenwick');
      }
      advanceMonth(s);
      while (s.battle) {
        autoResolve(s.battle);
        applyBattle(s, s.battle);
      }
      expect(() => reload(s)).not.toThrow();
    }
    expect(s.status).toBe('playing');
    expect(s.towns.millbrook.owner).toBe('orcs');
    expect(s.quests.M04.stage).toBe('retake');
    take(s, 'millbrook');
    advanceMonth(s);
    while (s.battle) { autoResolve(s.battle); applyBattle(s, s.battle); }
    expect(s).toMatchObject({ status: 'won', endingReason: 'chapter-complete' });
  }, 20_000);
});

describe('chapter rules in saves and content', () => {
  it('rejects a target on your own armies and an unearned chapter win', () => {
    const s = newGame(1, 'western-realm');
    const forged = structuredClone(s);
    forged.armies.find((a) => a.owner === 'player')!.target = 'harrowgate';
    expect(() => reload(forged)).toThrow(/army target/);
    const won = structuredClone(s);
    won.status = 'won';
    won.endingReason = 'chapter-complete';
    expect(() => reload(won)).toThrow(/campaign ending/);
  });

  it('validates objectives, stage events and nested conditions', () => {
    const check = (edit: (c: typeof CATALOG) => void) => {
      const copy = structuredClone(CATALOG);
      edit(copy);
      return validateContent(copy).join('\n');
    };
    expect(validateContent(CATALOG)).toEqual([]);
    expect(check((c) => (c.quests.M04.stages[0].objectives![0].then = { stage: 'nowhere' }))).toMatch(/"millbrook-lost" leads to unknown stage "nowhere"/);
    const spawn = (c: typeof CATALOG) => c.quests.M04.stages[0].onStart![0] as Extract<QuestEvent, { kind: 'spawn' }>;
    expect(check((c) => (spawn(c).at = 'atlantis'))).toMatch(/spawns at unknown place "atlantis"/);
    expect(check((c) => (spawn(c).troops = ['dragon']))).toMatch(/spawns unknown unit/);
    expect(check((c) => (c.quests.M04.prerequisites = [{ kind: 'any', of: [{ kind: 'quest', quest: 'M03', status: 'superseded' }, { kind: 'quest', quest: 'M01', status: 'failed' }] }])))
      .toMatch(/requires "M01" to end failed, which it never can/);
    expect(check((c) => (c.quests.M01.prerequisites = [{ kind: 'any', of: [{ kind: 'quest', quest: 'M04', status: 'succeeded' }] }])))
      .toMatch(/prerequisites loop/);
  });
});
