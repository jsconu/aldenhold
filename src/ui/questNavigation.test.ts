import { describe, expect, it } from 'vitest';
import { armyAt, newGame, startLocation } from '../game/campaign';
import { advanceQuests, chooseQuest } from '../game/quests';
import { townLocation } from '../game/world';
import type { UIState } from './shared';
import { renderCampaign } from './campaignView';
import { renderJournal } from './journalView';
import { questFocus, questSites } from './questNavigation';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

describe('quest destination navigation', () => {
  it('keeps a caravan plea at Fenwick, then exposes the mine only after tracking is chosen', () => {
    const state = newGame(1, 'western-realm');
    state.turn = 5;
    advanceQuests(state);
    expect(questFocus(state, 'Q05')).toBe(townLocation(state, 'fenwick'));
    expect(questSites(state, 'Q05')).toEqual([]);
    expect(renderJournal(state)).not.toContain('Show Abandoned Mine');
    armyAt(state, townLocation(state, 'aldenhold'), 'player')!.at = '7,7';
    expect(chooseQuest(state, 'Q05', 'track')).toBeNull();
    const before = JSON.stringify(state);
    expect(questFocus(state, 'Q05')).toBe(startLocation(state, 'mine'));
    expect(renderJournal(state)).toContain('data-node="26,3">Show Abandoned Mine');
    const html = renderCampaign(state, {...ui(townLocation(state,'fenwick')),view:'city',cityTab:'quests'});
    expect(html).toContain('data-node="26,3">Show Abandoned Mine');
    expect(html).toContain('Storm the mine');
    expect(JSON.stringify(state)).toBe(before); // inspecting a destination never moves or pays for the party
  });

  it('offers the quarry on both the giver card and shortcut while retaining the noncombat choice', () => {
    const state = newGame(1, 'western-realm');
    state.turn = 4;
    advanceQuests(state);
    expect(questFocus(state, 'Q02')).toBe(startLocation(state, 'quarry'));
    armyAt(state, townLocation(state, 'aldenhold'), 'player')!.at = '7,7';
    expect(chooseQuest(state, 'Q00', 'decline')).toBeNull();
    const html = renderCampaign(state, {...ui(townLocation(state,'aldenhold')),view:'city',cityTab:'quests'});
    expect(html.includes('title="Show Old Quarry on the map"')).toBe(true);
    expect(html).toContain('data-node="24,15">Show Old Quarry');
    expect(html).toContain('Divert the workers');
    expect(chooseQuest(state, 'Q02', 'divert')).toBeNull();
    expect(questFocus(state, 'Q02')).toBe(townLocation(state, 'aldenhold'));
    expect(renderJournal(state)).not.toContain('Show Old Quarry');
  });

  it('does not reveal an undiscovered tower, but links its encounter after discovery', () => {
    const state = newGame(1, 'western-realm');
    expect(questFocus(state, 'Q03')).toBeNull();
    expect(questFocus(state, 'missing')).toBeNull();
    expect(renderJournal(state)).not.toContain('Show Old Watchtower');
    armyAt(state, townLocation(state, 'aldenhold'), 'player')!.at = startLocation(state, 'watchtower');
    advanceQuests(state);
    expect(questFocus(state, 'Q03')).toBe(startLocation(state, 'watchtower'));
    expect(renderJournal(state)).toContain('data-node="30,22">Show Old Watchtower');
    expect(renderCampaign(state, ui(startLocation(state, 'watchtower')))).toContain('Send in your heroes');
  });

  it('retains graph locations for quick-play diplomacy and hides Western-only destinations', () => {
    const state = newGame(1);
    expect(questFocus(state, 'Q00')).toBe('fenwick');
    expect(questFocus(state, 'Q02')).toBeNull();
    expect(questSites(state, 'Q02')).toEqual([]);
  });
});
