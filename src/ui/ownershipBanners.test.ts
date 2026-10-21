import { describe, expect, it } from 'vitest';
import { getCampaign } from '../content';
import { newGame } from '../game/campaign';
import { renderCampaign } from './campaignView';
import { bannerFor, renderHexMap } from './hexMapView';
import type { UIState } from './shared';

const ui: UIState = { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };

describe('ownership banners', () => {
  it('each settlement flies the banner of its owner: crowned, crossed swords, plain, or a skull for a lair', () => {
    const s = newGame(3, 'western-realm');
    s.towns.harrowgate.owner = 'orcs';
    expect(bannerFor(s, 'aldenhold')).toBe('player');
    expect(bannerFor(s, 'harrowgate')).toBe('enemy');
    expect(bannerFor(s, 'fenwick')).toBe('free');
    expect(bannerFor(s, 'gharzak')).toBe('lair');
  });

  it('shows the banner with the owner, relation and garrison on the map, without relying on colour', () => {
    const s = newGame(3, 'western-realm');
    s.treaties.fenwick = { relation: 'ally', passage: true, signedTurn: 1 };
    const map = renderHexMap(s, ui, getCampaign('western-realm').hex!, new Map());
    // Every banner kind is its own symbol with its own glyph.
    for (const kind of ['player', 'enemy', 'free', 'lair']) expect(map).toContain(`id="owner-banner-${kind}"`);
    expect(map).toContain('<title>Aldenhold: Yours. Garrison: Your troops: 5 troops');
    expect(map).toContain('<title>Fenwick: Free town (allied). Garrison: Town militia');
    expect(map).toContain('<title>Gharzak Hold: Monster lair. Garrison: Orc host');
    expect(map.match(/class="settlement-owner"/g)!.length).toBe(Object.keys(s.towns).length);
  });

  it('the map has a legend for the four banners', () => {
    const s = newGame(3, 'western-realm');
    const html = renderCampaign(s, { ...ui, selected: '4,14' });
    expect(html).toMatch(/class="map-legend"[\s\S]*Yours[\s\S]*Enemy-held[\s\S]*Free town[\s\S]*Monster lair/);
  });
});
