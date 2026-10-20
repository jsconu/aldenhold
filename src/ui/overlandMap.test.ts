import { describe, expect, it } from 'vitest';
import { newGame, armyAt } from '../game/campaign';
import type { UIState } from './shared';
import {
  atlasTiles, ATLAS_COLS, ATLAS_ROWS, overlandTerrainNames, renderOverland,
} from './overlandMap';
import { moveTargets, renderCampaign } from './campaignView';

function ui(overrides: Partial<UIState> = {}): UIState {
  return { selected: 'aldenhold', checked: new Set(), battleUnit: null,
    battleSpell: null, message: '', view: 'map', ...overrides };
}

describe('overland atlas and navigation', () => {
  it('paints a deterministic, dense, varied hex landscape without altering campaign data', () => {
    const game = newGame(11);
    const before = JSON.stringify(game);
    const first = atlasTiles(game);
    const second = atlasTiles(game);
    expect(first).toEqual(second);
    expect(first).toHaveLength(ATLAS_COLS * ATLAS_ROWS);
    expect(first.map((t) => t.col + ':' + t.row).filter((v, i, a) => a.indexOf(v) === i)).toHaveLength(first.length);
    expect(first.every((t) => Number.isFinite(t.x) && Number.isFinite(t.y))).toBe(true);
    const present = new Set(first.map((t) => t.terrain));
    for (const terrain of ['forest', 'farmland', 'hills', 'mountains', 'wetlands', 'river'])
      expect(present.has(terrain as never)).toBe(true);
    expect(overlandTerrainNames()).toContain('river');
    expect(JSON.stringify(game)).toBe(before);
  });

  it('keeps all nine original locations interactive and exactly the existing travel routes', () => {
    const state = newGame(1);
    const screen = renderOverland(state, ui(), []);
    for (const node of state.nodes) {
      expect(screen).toContain(`data-node="${node.id}"`);
      expect(screen).toContain(node.name);
    }
    const renderedRoutes = [...screen.matchAll(/data-route="([^"]+)"/g)].map((m) => m[1]);
    expect(renderedRoutes).toHaveLength(state.edges.length);
    expect(new Set(renderedRoutes)).toEqual(new Set(state.edges.map(([a, b]) => a + ':' + b)));
    expect(screen.match(/class="atlas-tile biome-/g)).toHaveLength(ATLAS_COLS * ATLAS_ROWS);
    expect(screen).not.toContain('data-action="hex"');
  });

  it('highlights only legal adjacent march targets, not every visible hex', () => {
    const state = newGame(1);
    const selected = 'aldenhold';
    const soldiers = armyAt(state, selected, 'player')!.troops.map((t) => t.id);
    const presentation = ui({ selected, checked: new Set(soldiers) });
    const legal = moveTargets(state, presentation);
    expect(legal.sort()).toEqual(['bridge', 'fenwick', 'millbrook']);
    const markup = renderOverland(state, presentation, legal);
    expect(markup.match(/class="atlas-site [^"]*can-march"/g)).toHaveLength(legal.length);
    expect(markup).toContain('Selected troops can march here this month.');
    expect(markup).not.toContain('data-action="hex"');
  });

  it('offers map layers, the right legend and honest map-travel guidance', () => {
    const state = newGame(1);
    const html = renderCampaign(state, ui());
    expect(html).toContain('data-action="map-layer" data-layer="terrain"');
    expect(html).toContain('data-action="map-layer" data-layer="political"');
    expect(html).toContain('data-action="map-zoom" data-zoom="in"');
    expect(html).toContain('data-action="node" data-node="bridge"');
    expect(html).toContain('Hex-by-hex travel is planned');
    expect(html).toContain('Travel road');
    expect(html).toContain('March →');
  });

  it('switches political rendering without mutating the save or losing markers', () => {
    const state = newGame(2);
    const before = JSON.stringify(state);
    const html = renderOverland(state, ui({ mapLayer: 'political' }), []);
    expect(html).toContain('layer-political');
    expect(html).toContain('own-glow-player');
    expect(html).toContain('own-glow-orcs');
    expect(html).toContain('data-node="gharzak"');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('focus zooms to the selected node while clamping inside original atlas bounds', () => {
    const state = newGame(1);
    const overview = renderOverland(state, ui(), []);
    expect(overview).toContain('viewBox="0.0 0.0 840.0 500.0"');
    const zoomed = renderOverland(state, ui({ selected: 'gharzak', mapZoom: 2 }), []);
    const box = zoomed.match(/viewBox="([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)"/);
    expect(box).not.toBeNull();
    const [, x, y, w, h] = box!.map(Number);
    expect(w).toBe(420);
    expect(h).toBe(250);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(840);
    expect(y + h).toBeLessThanOrEqual(500);
  });

  it('preserves the exact game JSON after layer and selection renders', () => {
    const state = newGame(45);
    const before = JSON.stringify(state);
    renderCampaign(state, ui({ selected: 'fenwick', mapLayer: 'political', mapZoom: 1.5 }));
    renderCampaign(state, ui({ selected: 'millbrook', mapLayer: 'terrain' }));
    expect(JSON.stringify(state)).toBe(before);
  });
});
