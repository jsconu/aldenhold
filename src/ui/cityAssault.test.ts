import { describe, expect, it } from 'vitest';
import { newGame } from '../game/campaign';
import { hexNeighbors, hexKey } from '../game/hex';
import { townLocation } from '../game/world';
import { cityAssault, renderCityAssault } from './cityAssault';

describe('defended city decision', () => {
  it('previews defenders before a march, without moving or spending troops; unguarded towns stay ordinary marches', () => {
    const state = newGame(7, 'western-realm');
    const town = Object.values(state.towns).find((t) => t.owner !== 'player' && t.kind === 'town' &&
      state.armies.some((a) => a.at === townLocation(state, t.id) && a.owner === t.owner))!;
    expect(town).toBeDefined();
    const to = townLocation(state, town.id);
    const [col, row] = to.split(',').map(Number);
    const from = hexKey(hexNeighbors({ col, row }).find((h) => h.col >= 0 && h.row >= 0)!);
    const army = state.armies.find((a) => a.owner === 'player')!;
    army.at = from;
    army.troops.forEach((t) => { t.mp = 10; });
    const snapshot = JSON.stringify(state);
    const decision = cityAssault(state, from, to, army.troops.map((t) => t.id));
    expect(decision).not.toBeNull();
    expect(renderCityAssault(state, decision!)).toContain('Attack');
    expect(renderCityAssault(state, decision!)).toContain('Retreat');
    expect(JSON.stringify(state)).toBe(snapshot);
    state.armies = state.armies.filter((a) => a.at !== to || a.owner === 'player');
    expect(cityAssault(state, from, to, army.troops.map((t) => t.id))).toBeNull();
  });
});
