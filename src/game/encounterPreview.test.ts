import { describe, expect, it } from 'vitest';
import { FIELD_LIMIT } from './battle';
import { armyAt, makeTroop, newGame, startLocation } from './campaign';
import { advanceQuests, chooseQuest, questQuote } from './quests';
import { parseSave } from './saves';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function tower() {
  const state = newGame(1, 'western-realm');
  const army = armyAt(state, startLocation(state, 'aldenhold'), 'player')!;
  army.at = startLocation(state, 'watchtower');
  advanceQuests(state);
  return { state, army };
}

describe('encounter participation quotes', () => {
  it('explains that a ruler and formations cannot enter the heroes-only trial', () => {
    const { state, army } = tower();
    const quote = questQuote(state, 'Q03', 'enter');
    expect(quote.reason).toContain('Bring a hired hero');
    expect(quote.encounter).toMatchObject({
      heroesOnly: true, deployed: [], reserves: [], waiting: army.troops.map((t) => t.id),
    });
    const html = renderCampaign(state, ui(army.at));
    expect(html.includes('Expedition: 0 deployed · 5 stay outside')).toBe(true);
    expect(html.includes('Only hired heroes enter; your lord and formations stay outside.')).toBe(true);
  });

  it('quotes the exact hero party used after save/reload and safely displays its names and health', () => {
    const { state, army } = tower();
    const priest = makeTroop(state, 'priest', 'Osric <the Wise>');
    const champion = makeTroop(state, 'champion', 'Edith');
    army.troops.push(priest, champion);
    const before = JSON.stringify(state);
    const quote = questQuote(state, 'Q03', 'enter');
    expect(JSON.stringify(state)).toBe(before);
    expect(quote.encounter?.deployed).toEqual([priest.id, champion.id]);
    expect(quote.encounter?.waiting).toContain(army.troops.find((t) => t.type === 'lord')!.id);
    const html = renderCampaign(state, ui(army.at));
    expect(html.includes('Osric &#60;the Wise&#62; (Lv 1, 18 HP)')).toBe(true);
    expect(html.includes('Expedition: 2 deployed · 5 stay outside')).toBe(true);
    const loaded = parseSave(before);
    expect(questQuote(loaded, 'Q03', 'enter')).toEqual(quote);
    expect(chooseQuest(loaded, 'Q03', 'enter')).toBeNull();
    const actual = loaded.battle!.units.filter((u) => u.side === 'attacker' && !u.reserve).map((u) => u.troopId);
    expect(actual).toEqual(quote.encounter!.deployed);
    expect(loaded.armies.find((a) => a.id === army.id)!.troops.map((t) => t.id)).toEqual(quote.encounter!.waiting);
  });

  it('distinguishes field troops and off-field reserves using the actual deployment cap', () => {
    const state = newGame(1, 'western-realm');
    const army = armyAt(state, startLocation(state, 'aldenhold'), 'player')!;
    army.at = startLocation(state, 'quarry');
    for (let i = 0; i < FIELD_LIMIT; i++) army.troops.push(makeTroop(state, 'militia'));
    state.turn = 4;
    advanceQuests(state);
    const quote = questQuote(state, 'Q02', 'hunt');
    expect(quote.reason).toBeNull();
    expect(quote.encounter!.deployed).toHaveLength(FIELD_LIMIT);
    expect(quote.encounter!.reserves).toHaveLength(5);
    expect(quote.encounter!.waiting).toEqual([]);
    expect(chooseQuest(state, 'Q02', 'hunt')).toBeNull();
    const units = state.battle!.units.filter((u) => u.side === 'attacker');
    expect(units.filter((u) => !u.reserve).map((u) => u.troopId)).toEqual(quote.encounter!.deployed);
    expect(units.filter((u) => u.reserve).map((u) => u.troopId)).toEqual(quote.encounter!.reserves);
  });

  it('has no party preview for a locked quest or a noncombat choice, and finds no distant army', () => {
    const state = newGame(1, 'western-realm');
    expect(questQuote(state, 'Q03', 'enter').encounter).toBeUndefined();
    state.turn = 4;
    advanceQuests(state);
    expect(questQuote(state, 'Q02', 'divert').encounter).toBeUndefined();
    const quote = questQuote(state, 'Q02', 'hunt');
    expect(quote.reason).toContain('Bring an army to Old Quarry');
    expect(quote.encounter).toMatchObject({ armyId: null, deployed: [], reserves: [], waiting: [] });
  });
});
