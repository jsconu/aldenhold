import { describe, expect, it } from 'vitest';
import { armyAt, marchQuote, newGame } from '../game/campaign';
import { townLocation } from '../game/world';
import { mapClickIntent } from './mapClick';
import type { UIState } from './shared';

const ui = (selected: string | null, checked: number[] = []): UIState =>
  ({ selected, checked: new Set(checked), battleUnit: null, battleSpell: null, message: '', view: 'map' });

describe('clicking the map', () => {
  it('a defended town lit next to your army is attacked, not opened', () => {
    const s = newGame(1, 'western-realm');
    const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    army.at = '7,7';
    const fenwick = townLocation(s, 'fenwick');
    const ids = army.troops.map((t) => t.id);
    expect(marchQuote(s, army.at, ids, fenwick)).toMatchObject({ reason: null, ends: 'battle' });
    expect(mapClickIntent(s, ui(army.at, ids), fenwick)).toBe('march');
  });

  it('a town you are not marching on opens its city screen; open ground is just selected', () => {
    const s = newGame(1, 'western-realm');
    const home = townLocation(s, 'aldenhold');
    expect(mapClickIntent(s, ui(null), home)).toBe('city');
    expect(mapClickIntent(s, ui(null), townLocation(s, 'fenwick'))).toBe('city');
    // Troops at the capital but none ticked: nothing is lit, so a far town opens rather than marches.
    expect(mapClickIntent(s, ui(home), townLocation(s, 'westmere'))).toBe('city');
    expect(mapClickIntent(s, ui(null), '6,14')).toBe('select');
  });

  it('march mode marches anywhere, and planning a route picks its destination', () => {
    const s = newGame(1, 'western-realm');
    const home = townLocation(s, 'aldenhold');
    expect(mapClickIntent(s, { ...ui(home), marchMode: true }, townLocation(s, 'westmere'))).toBe('march');
    expect(mapClickIntent(s, { ...ui(home), routeOrigin: home }, townLocation(s, 'westmere'))).toBe('route');
  });
});
