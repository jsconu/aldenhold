import { describe, expect, it } from 'vitest';
import { newGame } from '../game/campaign';
import { getCampaign } from '../content';
import { renderHexMap } from './hexMapView';
import { WESTERN_PLACE_ART } from './settlementSprites';
import type { UIState } from './shared';

const ui: UIState = { selected: '4,14', checked: new Set(), battleUnit: null, battleSpell: null,
  message: '', view: 'map' };
const expectedSites = ['aldenhold', 'fenwick', 'millbrook', 'greenveil', 'harrowgate',
  'westmere', 'duskwater', 'reedhaven', 'gharzak', 'bridge'];
const palette = new Set('.kwgGsSbByRrHcFLov'.split(''));

describe('original Western Realm settlements', () => {
  it('makes each named site a 34×24 pixel silhouette with supported palette pixels', () => {
    expect(Object.keys(WESTERN_PLACE_ART).sort()).toEqual([...expectedSites].sort());
    for (const [id, rows] of Object.entries(WESTERN_PLACE_ART)) {
      expect(rows, id).toHaveLength(24);
      expect(rows.every((r) => r.length === 34), id).toBe(true);
      expect([...rows.join('')].every((p) => palette.has(p)), id).toBe(true);
      expect(rows.join('').replaceAll('.', '').length, id).toBeGreaterThan(100);
    }
  });

  it('does not reuse the same artwork between any two named settlements', () => {
    const paintings = Object.values(WESTERN_PLACE_ART).map((rows) => rows.join(''));
    expect(new Set(paintings).size).toBe(expectedSites.length);
  });

  it('provides faction-color flags for all capital and settlement landmarks except the neutral bridge', () => {
    for (const id of expectedSites.filter((id) => id !== 'bridge')) {
      expect(WESTERN_PLACE_ART[id].join('')).toContain('F');
    }
    expect(WESTERN_PLACE_ART.bridge.join('')).not.toContain('F');
  });

  it('binds the actual world places to matching symbols without changing state', () => {
    const game = newGame(7, 'western-realm');
    const realm = getCampaign('western-realm').hex!;
    const before = JSON.stringify(game);
    const rendered = renderHexMap(game, ui, realm, new Map());
    for (const place of realm.places) {
      if (!WESTERN_PLACE_ART[place.id]) continue;
      const owner = place.kind === 'town' ? game.towns[place.id].owner : 'neutral';
      if (place.kind === 'town') expect(rendered).toContain('/assets/overland/settlements-atlas-v1.png');
      else if (place.id === 'bridge') expect(rendered).toContain('/assets/overland/stone-bridge-v1.png');
      else expect(rendered, place.id).toContain(`href="#map-${place.id}-${owner}"`);
      expect(rendered).toContain(`id="map-${place.id}-${owner}" viewBox="0 0 34 24"`);
    }
    expect(JSON.stringify(game)).toBe(before);
    expect(rendered).toContain('class="map-place-sprite"');
  });
});
