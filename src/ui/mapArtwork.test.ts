import { describe, expect, it } from 'vitest';
import { createBattle } from '../game/battle';
import { armyAt, newGame } from '../game/campaign';
import { getCampaign } from '../content';
import { battleScenery } from './battleScenery';
import { renderBattle } from './battleView';
import { renderHexMap } from './hexMapView';
import { atlasTiles, renderOverland } from './overlandMap';
import { paintTerrain, softenHexSeams } from './pixelTiles';
import { moveTargets, renderCampaign } from './campaignView';
import { townLocation } from '../game/world';
import type { UIState } from './shared';

const ui: UIState = { selected: 'aldenhold', checked: new Set(), battleUnit: null,
  battleSpell: null, message: '', view: 'map' };

describe('continuous map artwork without exposed tile outlines', () => {
  it('uses a blended underpainting and separate sharp symbols in the valley atlas', () => {
    const s = newGame(1);
    const before = JSON.stringify(s);
    const html = renderOverland(s, ui, []);
    expect(html).toContain('atlas-landscape-soften');
    expect(html).toContain('atlas-terrain-details');
    expect(html).toContain('atlas-river-water');
    expect(html).toContain('class="atlas-ground"');
    expect(html.match(/data-tile="/g)).toHaveLength(atlasTiles(s).length);
    expect(JSON.stringify(s)).toEqual(before);
  });

  it('blends Western Realm pixel seams without leaking to transparent map edges', () => {
    const realm = getCampaign('western-realm').hex!;
    const terrain = paintTerrain(realm);
    const beforeAlpha = new Uint8Array(terrain.data.length / 4);
    for (let p = 0; p < beforeAlpha.length; p++) beforeAlpha[p] = terrain.data[p * 4 + 3];
    const pixelsBefore = terrain.data.slice();
    const softened = softenHexSeams(terrain, realm);
    expect(softened).toBeGreaterThan(10000);
    let changed = 0;
    let alphaChanged = 0;
    for (let p = 0; p < beforeAlpha.length; p++) {
      if (terrain.data[p * 4 + 3] !== beforeAlpha[p]) alphaChanged++;
      if (terrain.data[p * 4] !== pixelsBefore[p * 4]) changed++;
    }
    expect(alphaChanged).toBe(0);
    expect(changed).toBeGreaterThan(1000);
  });

  it('marks tactical targets with circles but keeps the invisible hex hit geometry', () => {
    const s = newGame(12, 'western-realm');
    const world = getCampaign('western-realm').hex!;
    const view = renderHexMap(s, { ...ui, selected: '4,14' }, world, new Map());
    expect(view).toContain('class="selected"');
    expect(view).toContain('<ellipse');
    expect(view).not.toMatch(/<polygon[^>]+class="selected"/);
    expect(view).toContain('class="cell" data-action="node"');
    expect(view).toContain('overland-march-glow');
    expect(view).toContain('class="army-halo"');
  });

  it('keeps the march instructions tied to the actually selected troops and reachable cells', () => {
    const state = newGame(12, 'western-realm');
    const at = townLocation(state, 'aldenhold');
    const troops = armyAt(state, at, 'player')!.troops;
    const selected = { ...ui, selected: at, checked: new Set(troops.map((t) => t.id)) };
    const before = JSON.stringify(state);
    const screen = renderCampaign(state, selected);
    expect(screen).toContain(`${troops.length} of ${troops.length} ready troops ticked`);
    expect(screen).toContain(`(${moveTargets(state, selected).size} reachable now)`);
    expect(screen).toContain('Click a glowing hex');
    const inspecting = renderCampaign(state, { ...selected, selected: '0,0', checked: new Set() });
    expect(inspecting).toContain('Show a ready army');
    expect(inspecting).toContain(`data-action="locate-army" data-node="${at}"`);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('blends battle ground and paints local details above it with separate click targets', () => {
    const s = newGame(1);
    const a = armyAt(s, 'aldenhold', 'player')!;
    const d = armyAt(s, 'gharzak', 'orcs')!;
    const b = createBattle('aldenhold', a, d, false, 12);
    b.terrain[3][3] = 'stream';
    b.terrain[4][3] = 'stream';
    const old = JSON.stringify(b);
    s.battle = b;
    const html = renderBattle(s, ui);
    expect(html).toContain('battle-terrain-blend');
    expect(html).toContain('battle-landscape-scenery');
    expect(html).toContain('battle-water-ribbon');
    expect(html).toContain('class="hit" data-action="hex"');
    expect(html).not.toContain('class="hit reach"');
    expect(html).not.toMatch(/<polygon[^>]+class="mark"/);
    expect(JSON.stringify(b)).toBe(old);
  });

  it('continuous creeks cross neighboring battlefield terrain cells deterministically', () => {
    const s = newGame(1);
    const b = createBattle('aldenhold',
      armyAt(s, 'aldenhold', 'player')!, armyAt(s, 'gharzak', 'orcs')!, false, 4);
    for (const col of b.terrain) col.fill('plain');
    b.terrain[3][3] = 'stream';
    b.terrain[4][3] = 'stream';
    const before = JSON.stringify(b);
    const art = battleScenery(b);
    expect(art).toContain('battle-water-ribbon');
    expect(art).toContain('battle-water-pool');
    expect(battleScenery(b)).toBe(art);
    expect(JSON.stringify(b)).toBe(before);
  });
});
