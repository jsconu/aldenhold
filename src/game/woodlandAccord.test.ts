import { describe, expect, it } from 'vitest';
import { LAND } from '../content/rules';
import { renderCampaign } from '../ui/campaignView';
import { advanceMonth, armyAt, canRecruitAt, neighborsOf, newGame, recruit, recruitQuote } from './campaign';
import { buildCity, constructionQuote, yieldFactor } from './cities';
import { usesBow } from './equipment';
import { advanceQuests, chooseQuest, onTownOwnershipChange, questQuote, trackedQuests } from './quests';
import { parseSave } from './saves';
import type { UIState } from '../ui/shared';
import type { GameState } from './types';
import { landAt, townLocation } from './world';

/** A Western Realm game in month 3, with the home army camped on the road next to Greenveil. */
function atGreenveil(): GameState {
  const s = newGame(1, 'western-realm');
  s.turn = 3;
  advanceQuests(s);
  const gv = townLocation(s, 'greenveil');
  const camp = neighborsOf(s, gv).find((k) => Number.isFinite(LAND[landAt(s, k)].move) && !s.armies.some((a) => a.at === k))!;
  armyAt(s, townLocation(s, 'aldenhold'), 'player')!.at = camp;
  return s;
}

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

/** Give Aldenhold a working lumber camp and the timber and gold to upgrade it. */
function withLumberCamp(s: GameState) {
  s.cityEconomies.aldenhold.buildings.lumber = 1;
  s.cityEconomies.aldenhold.goods.timber = 50;
  s.gold = 2000;
}

describe('Q04 The Woodland Accord', () => {
  it('is offered at Greenveil from month 3, only in the Western Realm', () => {
    const s = newGame(1, 'western-realm');
    expect(s.quests.Q04.status).toBe('unavailable');
    s.turn = 3;
    expect(advanceQuests(s)).toContain('New quest: The Woodland Accord, offered at Greenveil.');
    expect(s.quests.Q04).toMatchObject({ status: 'available', stage: 'envoy' });
    const valley = newGame(1);
    valley.turn = 5;
    advanceQuests(valley);
    expect(valley.quests.Q04.status).toBe('unavailable');
  });

  it('needs an army at or next to Greenveil to answer', () => {
    const s = newGame(1, 'western-realm');
    s.turn = 3;
    advanceQuests(s);
    expect(questQuote(s, 'Q04', 'cap').reason).toBe('Send an army to Greenveil or a neighboring road before answering the envoy.');
    expect(questQuote(atGreenveil(), 'Q04', 'cap').reason).toBeNull();
  });

  it('sustainable logging wins the alliance, reduces output and still permits expansion after reload', () => {
    let s = atGreenveil();
    withLumberCamp(s);
    expect(constructionQuote(s, 'aldenhold', 'lumber').reason).toBeNull();
    const greenveil = s.towns.greenveil;
    expect(canRecruitAt(s, greenveil, 'woodlandArchers')).toBe(false);

    expect(chooseQuest(s, 'Q04', 'cap')).toBeNull();
    expect(s.quests.Q04).toMatchObject({ status: 'succeeded', resolvedBy: 'choice' });
    expect(s.treaties.greenveil).toMatchObject({ relation: 'ally', passage: true });
    expect(s.items['woodland-charter']).toEqual({ qty: 1, spent: 0, archived: false });
    expect(s.flags).toContain('logging-cap');

    s = reload(s);
    expect(constructionQuote(s, 'aldenhold', 'lumber').reason).toBeNull();
    expect(yieldFactor(s, 'aldenhold', 'lumber')).toBe(.75);
    expect(buildCity(s, 'aldenhold', 'lumber')).toBeNull();
    expect(s.cityEconomies.aldenhold.buildings.lumber).toBe(1);
    // The output tradeoff leaves construction available in every town.
    s.cityEconomies.millbrook.goods.timber = 50;
    expect(constructionQuote(s, 'millbrook', 'lumber').reason).toBeNull();

    // Woodland archers are raised in Greenveil itself, from its people, and join your army there.
    expect(canRecruitAt(s, s.towns.greenveil, 'woodlandArchers')).toBe(true);
    expect(canRecruitAt(s, s.towns.aldenhold, 'woodlandArchers')).toBe(false);
    const pop = s.towns.greenveil.pop;
    const gold = s.gold;
    expect(recruit(s, 'greenveil', 'woodlandArchers')).toBeNull();
    expect(s.gold).toBe(gold - 150);
    expect(s.towns.greenveil.pop).toBe(pop - 15);
    const [woodfolk] = armyAt(s, townLocation(s, 'greenveil'), 'player')!.troops;
    expect(woodfolk).toMatchObject({ type: 'woodlandArchers', gear: { bow: 'long-bow', armor: 'leather' } });
    // They are archers for equipment: bows yes, plate no.
    expect(usesBow('woodlandArchers')).toBe(true);
    expect(s.towns.greenveil.owner).toBe('neutral');
    s = reload(s);
    expect(chooseQuest(s, 'Q04', 'cap')).toBe('The woodland court has its answer.');
  });

  it('paying for the groves wins the alliance without the logging cap', () => {
    const s = atGreenveil();
    withLumberCamp(s);
    const gold = s.gold;
    expect(questQuote(s, 'Q04', 'compensate').gold).toBe(200);
    expect(chooseQuest(s, 'Q04', 'compensate')).toBeNull();
    expect(s.gold).toBe(gold - 200);
    expect(s.flags).not.toContain('logging-cap');
    expect(constructionQuote(s, 'aldenhold', 'lumber').reason).toBeNull();
    expect(recruitQuote(s, 'greenveil', 'woodlandArchers').reason).toBeNull();
    expect(s.treasury.pending.some((e) => e.category === 'quest' && e.amount === -200)).toBe(true);
  });

  it('rejecting the envoy loses woodland archers, but ordinary archers can still be raised at home', () => {
    const s = atGreenveil();
    expect(chooseQuest(s, 'Q04', 'reject')).toBeNull();
    expect(s.quests.Q04.status).toBe('failed');
    expect(s.flags).toEqual(['greenveil-rejected']);
    expect(s.treaties.greenveil).toBeUndefined();
    expect(recruitQuote(s, 'greenveil', 'woodlandArchers').reason).toBe("You can't raise Woodland Archers here.");
    expect(recruitQuote(s, 'aldenhold', 'archers').reason).toBeNull();
    expect(recruitQuote(s, 'millbrook', 'archers').reason).toBeNull();
    expect(reload(s).quests.Q04.status).toBe('failed');
  });

  it('an unanswered envoy leaves after four months', () => {
    const s = atGreenveil();
    for (const turn of [4, 5, 6]) {
      s.turn = turn;
      advanceQuests(s);
      expect(s.quests.Q04.status).toBe('available');
    }
    s.turn = 7;
    advanceQuests(s);
    expect(s.quests.Q04).toMatchObject({ status: 'failed', resolvedBy: 'deadline' });
    expect(s.flags).toEqual(['greenveil-rejected']);
    expect(reload(s).quests.Q04.status).toBe('failed');
  });

  it('losing Greenveil ends the quest, the alliance and the woodland recruits', () => {
    const open = atGreenveil();
    open.towns.greenveil.owner = 'orcs';
    onTownOwnershipChange(open, 'greenveil', 'orcs');
    expect(open.quests.Q04.status).toBe('superseded');

    const allied = atGreenveil();
    chooseQuest(allied, 'Q04', 'cap');
    allied.towns.greenveil.owner = 'player';
    onTownOwnershipChange(allied, 'greenveil', 'player');
    expect(allied.treaties.greenveil).toBeUndefined();
    expect(allied.quests.Q04.status).toBe('succeeded');
    // Conquered woodfolk will not serve; the town raises ordinary troops like any other.
    expect(canRecruitAt(allied, allied.towns.greenveil, 'woodlandArchers')).toBe(false);
    expect(canRecruitAt(allied, allied.towns.greenveil, 'archers')).toBe(true);
    // The promise to cap logging still stands.
    expect(allied.flags).toContain('logging-cap');
    expect(reload(allied).items['woodland-charter'].qty).toBe(1);
  });

  it('a save made before Q04 existed loads with it locked, and it unlocks the next month', () => {
    const s = newGame(1, 'western-realm');
    s.turn = 2;
    const old = JSON.parse(JSON.stringify(s));
    delete old.quests.Q04;
    const restored = parseSave(JSON.stringify(old));
    expect(restored.quests.Q04.status).toBe('unavailable');
    restored.armies = restored.armies.filter((a) => a.owner !== 'orcs');
    advanceMonth(restored);
    expect(restored.quests.Q04.status).toBe('available');
    const forged = JSON.parse(JSON.stringify(s));
    forged.quests.Q99 = forged.quests.Q00;
    expect(() => parseSave(JSON.stringify(forged))).toThrow(/quest registry/);
  });
});

describe('quest tracking', () => {
  it('tracks at most three open quests and offers them as header shortcuts', () => {
    const s = atGreenveil();
    expect(trackedQuests(s).map((q) => q.id)).toEqual(['M01', 'Q04', 'Q00']); // Q04's envoy waits four months; Q00 has no deadline
    const html = renderCampaign(s, {...ui(townLocation(s,'greenveil')),view:'city',cityTab:'recruitment'});
    expect(html).toContain('data-action="view-quest" data-quest="Q04"');
    chooseQuest(s, 'Q04', 'cap');
    expect(trackedQuests(s).map((q) => q.id)).toEqual(['M01', 'Q00']);
  });

  it('shows Greenveil’s allied recruits in its panel once the accord is signed', () => {
    const s = atGreenveil();
    chooseQuest(s, 'Q04', 'cap');
    const html = renderCampaign(s, {...ui(townLocation(s,'greenveil')),view:'city',cityTab:'recruitment'});
    expect(html).toContain('Allied troops');
    expect(html).toContain('data-action="recruit" data-node="greenveil" data-type="woodlandArchers"');
  });
});
