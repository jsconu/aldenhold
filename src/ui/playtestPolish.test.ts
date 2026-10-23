import { describe, expect, it } from 'vitest';
import { createBattle } from '../game/battle';
import { advanceQuests, monthsLeft } from '../game/quests';
import { armyAt, makeTroop, newGame } from '../game/campaign';
import type { Army } from '../game/types';
import { townLocation } from '../game/world';
import { renderBattle } from './battleView';
import { renderCampaign } from './campaignView';
import type { UIState } from './shared';

const ui = (selected: string | null, extra: Partial<UIState> = {}): UIState =>
  ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map', ...extra });

describe('quests', () => {
  it('have their own screen, with how long each has left; a town on the map names its quests in one line', () => {
    const s = newGame(1, 'western-realm');
    s.turn = 4;
    advanceQuests(s);
    const home = townLocation(s, 'aldenhold');
    const map = renderCampaign(s, ui(home));
    expect(map).toMatch(/<button data-action="quests" class="ghost">Quests \(\d+\)<\/button>/);
    expect(map).toMatch(/class="quest-pointer">\d+ quests? offered here: /);
    expect(map).not.toContain('class="quest-card"');
    const screen = renderCampaign(s, ui(home, { view: 'quests' }));
    expect(screen).toContain('<h1>Open quests</h1>');
    expect(screen).toContain('class="quest-card"');
    const timed = Object.keys(s.quests).find((id) => monthsLeft(s, id) !== null);
    if (timed) expect(screen).toMatch(/class="due-badge( urgent)?"[^>]*>ends (this month|next month|in \d+ months)</);
  });
});

describe('the action bar above the map', () => {
  it('offers the selected place’s actions at the top: move troops, select all, open the town', () => {
    const s = newGame(1, 'western-realm');
    const home = townLocation(s, 'aldenhold');
    const html = renderCampaign(s, ui(home));
    const bar = html.slice(html.indexOf('class="action-bar"'), html.indexOf('class="map-toolbar"'));
    expect(html.indexOf('class="action-bar"')).toBeLessThan(html.indexOf('class="map overland"'));
    expect(bar).toContain('data-action="troops-pick"');
    expect(bar).toContain('data-action="troops-all"');
    expect(bar).toContain('data-action="open-city"');
  });

  it('shows camp, station scout and besiege when they apply', () => {
    const s = newGame(1, 'western-realm');
    const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    army.at = '7,7';
    army.troops.push(makeTroop(s, 'scout'));
    s.weather = { ...s.weather, kind: 'rain', turn: s.turn };
    const bar = renderCampaign(s, ui('7,7'));
    expect(bar).toContain('data-action="make-camp"');
    expect(bar).toContain('data-action="station-scout"');
    expect(bar).toContain('data-action="siege-begin"');
  });
});

describe('popups', () => {
  it('a new unit is announced in a popup with an OK button', () => {
    const s = newGame(1, 'western-realm');
    const html = renderCampaign(s, ui(null, { notice: { title: 'New unit created', lines: ['Spearmen: 20 men, level 1, raised in Aldenhold.'] } }));
    expect(html).toContain('<h2 id="notice-title">New unit created</h2>');
    expect(html).toContain('data-action="notice-close"');
  });
});

describe('the battle screen', () => {
  it('marks your units and the enemy’s differently, labels your army at the start, and zooms further', () => {
    const s = newGame(1, 'western-realm');
    const a: Army = { id: s.nextId++, owner: 'player', at: '6,14', from: null, troops: [makeTroop(s, 'spearmen')] };
    const d: Army = { id: s.nextId++, owner: 'orcs', at: '6,14', from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(a, d);
    s.battle = createBattle('6,14', a, d, false, 1);
    const html = renderBattle(s, ui(null, { battleZoom: 5 }));
    expect(html).toContain('class="pennant mine"');
    expect(html).toContain('class="pennant foe"');
    expect(html).toContain('class="side-ring"');
    expect(html).toContain('>Your army</text>');
    expect(html).toContain('<output class="zoom-level">500%</output>');
    expect(html).toMatch(/data-dir="1" class="ghost" title="Zoom in" disabled/);
  });
});
