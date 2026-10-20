import { describe, expect, it } from 'vitest';
import { newGame, armyAt, moveTroops } from './campaign';
import { previewRoute, routeRisk } from './overlandRoutes';
import { renderCampaign } from '../ui/campaignView';
import { renderOverland } from '../ui/overlandMap';
import type { UIState } from '../ui/shared';

function ui(partial: Partial<UIState>): UIState {
  return { selected: 'aldenhold', checked: new Set(), battleUnit: null, battleSpell: null,
    message: '', view: 'map', ...partial };
}

describe('strategic route preview', () => {
  it('routes on the actual save graph with no extra or fake connections', () => {
    const state = newGame(1);
    const plan = previewRoute(state, 'aldenhold', 'gharzak')!;
    expect(plan.stops[0].id).toBe('aldenhold');
    expect(plan.stops.at(-1)?.id).toBe('gharzak');
    expect(plan.legs).toBe(plan.stops.length - 1);
    for (let i = 1; i < plan.stops.length; i++) {
      const prev = plan.stops[i - 1].id, curr = plan.stops[i].id;
      expect(state.edges.some(([a, b]) => (a === prev && b === curr) || (a === curr && b === prev))).toBe(true);
    }
    expect(plan.legs).toBeGreaterThan(1);
  });

  it('identifies hostile and independent militia but respects the signed Fenwick treaty', () => {
    const state = newGame(1);
    expect(routeRisk(state, 'gharzak')).toBe('orc garrison');
    expect(routeRisk(state, 'fenwick')).toBe('independent militia');
    state.treaties.fenwick = { relation: 'ally', passage: true, signedTurn: 1 };
    expect(routeRisk(state, 'fenwick')).toBeNull();
  });

  it('can favor lower-threat alternatives while remaining deterministic', () => {
    const state = newGame(3);
    const quick = previewRoute(state, 'aldenhold', 'gharzak', 'shortest')!;
    const safer = previewRoute(state, 'aldenhold', 'gharzak', 'safer')!;
    expect(safer.preference).toBe('safer');
    expect(safer.stops[0].id).toBe('aldenhold');
    expect(safer.stops.at(-1)?.id).toBe('gharzak');
    expect(previewRoute(state, 'aldenhold', 'gharzak', 'safer')).toEqual(safer);
    expect(safer.legs).toBeGreaterThanOrEqual(quick.legs);
  });

  it('handles unreachable, same-site, invalid start and destination safely', () => {
    const state = newGame(5);
    expect(previewRoute(state, 'missing', 'fenwick')).toBeNull();
    expect(previewRoute(state, 'aldenhold', 'missing')).toBeNull();
    expect(previewRoute(state, 'aldenhold', 'aldenhold')).toEqual({
      stops: [{ id: 'aldenhold', risk: null }], legs: 0, cost: 0, preference: 'shortest',
    });
    state.edges = [];
    expect(previewRoute(state, 'aldenhold', 'gharzak')).toBeNull();
  });

  it('renders previews with numbered stops and real route segments, no save changes', () => {
    const state = newGame(2);
    const userUI = ui({ routeOrigin: 'aldenhold', routeDestination: 'gharzak', routePreference: 'safer',
      checked: new Set(armyAt(state, 'aldenhold', 'player')!.troops.map((t) => t.id)) });
    const before = JSON.stringify(state);
    const html = renderCampaign(state, userUI);
    const preview = previewRoute(state, 'aldenhold', 'gharzak', 'safer')!;
    expect(html).toContain('Journey planner');
    expect(html).toContain('March first leg');
    expect(html).toContain('atlas-route-planned');
    expect(html).toContain('route-stops');
    expect(html).toContain('Prefer fewer garrisons');
    expect(html).toContain(preview.legs + ' road legs');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('does not issue an automatic march or spend a turn on rendering', () => {
    const state = newGame(7);
    const start = state.turn;
    const beforeArmies = JSON.stringify(state.armies);
    const plan = previewRoute(state, 'millbrook', 'gharzak');
    renderOverland(state, ui({ routeOrigin: 'millbrook', routeDestination: 'gharzak' }),
      [], plan?.stops.map((stop) => stop.id));
    expect(state.turn).toBe(start);
    expect(JSON.stringify(state.armies)).toBe(beforeArmies);
  });

  it('a chosen first leg still follows normal movement rules and cannot be repeated', () => {
    const state = newGame(1);
    const plan = previewRoute(state, 'aldenhold', 'gharzak')!;
    const first = plan.stops[1].id;
    const ids = armyAt(state, 'aldenhold', 'player')!.troops.map((t) => t.id);
    expect(moveTroops(state, 'aldenhold', ids, first)).toBeNull();
    if (state.battle) return;
    expect(moveTroops(state, first, ids, 'aldenhold')).toMatch(/cannot march/);
  });
});
