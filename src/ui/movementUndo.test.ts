import { describe, expect, it } from 'vitest';
import { armyAt, moveTroops, newGame } from '../game/campaign';
import { createBattle, moveUnit, reachable } from '../game/battle';
import { parseSave } from '../game/saves';
import { renderCampaign } from './campaignView';
import { renderBattle } from './battleView';
import { captureMove, restoreMove, undoBlocked } from './movementUndo';
import type { UIState } from './shared';
import type { GameState } from '../game/types';
import { townLocation } from '../game/world';

function selection(at: string): UIState {
  return { selected: at, checked: new Set(), battleUnit: null, battleUnits: new Set(),
    battleSpell: null, message: '', view: 'map' };
}

describe('one-step movement restoration', () => {
  it('restores the exact overland position, movement points and selected party after a march', () => {
    let state = newGame(11);
    const at = 'aldenhold';
    const ids = armyAt(state, at, 'player')!.troops.map((t) => t.id);
    const ui = selection(at);
    ui.checked = new Set(ids);
    const before = JSON.stringify(state);
    const undo = captureMove(state, ui, 'Undo march');
    expect(moveTroops(state, at, ids, 'millbrook')).toBeNull();
    ui.selected = 'millbrook';
    ui.checked.clear();
    expect(JSON.stringify(state)).not.toBe(before);
    expect(renderCampaign(state, { ...ui, undoMoveLabel: undo.label })).toContain('data-action="undo-move"');
    state = restoreMove(undo, ui);
    expect(JSON.stringify(state)).toBe(before);
    expect(parseSave(JSON.stringify(state))).toEqual(state);
    expect(ui.selected).toBe(at);
    expect([...ui.checked]).toEqual(ids);
  });

  it('won’t take back a battle move that cost men on rough ground', () => {
    let state = newGame(3);
    const a = armyAt(state, 'aldenhold', 'player')!;
    const d = armyAt(state, 'gharzak', 'orcs')!;
    a.at = 'gharzak'; a.from = 'pass';
    state.battle = createBattle('gharzak', a, d, false, 3);
    for (const column of state.battle.terrain) column.fill('plain');
    const unit = state.battle.units.find((u) => u.type === 'lord')!;
    const key = [...reachable(state.battle, unit).keys()][0];
    const [col, row] = key.split(',').map(Number);
    state.battle.terrain[col][row] = 'thorns';
    const ui = selection('gharzak');
    ui.battleUnit = unit.id;
    ui.battleUnits = new Set([unit.id]);
    const before = JSON.stringify(state);
    const undo = captureMove(state, ui, 'Undo battle move');
    expect(moveUnit(state.battle, unit.id, { col, row })).toBe(true);
    expect(state.battle.units.find((u) => u.id === unit.id)!.men).toBeLessThan(unit.startMen);
    expect(JSON.stringify(undo.state)).toBe(before);
    expect(undoBlocked(undo.state, state)).toBe('That move cost men.');
    expect(renderBattle(state, { ...ui, undoMoveBlocked: 'That move cost men.' })).toContain('disabled title="That move cost men.">Can’t undo</button>');
  });

  it('restores a plain battle move and its tactical selection', () => {
    let state = newGame(3);
    const a = armyAt(state, 'aldenhold', 'player')!;
    const d = armyAt(state, 'gharzak', 'orcs')!;
    a.at = 'gharzak'; a.from = 'pass';
    state.battle = createBattle('gharzak', a, d, false, 3);
    for (const column of state.battle.terrain) column.fill('plain');
    const unit = state.battle.units.find((u) => u.type === 'lord')!;
    const [col, row] = [...reachable(state.battle, unit).keys()][0].split(',').map(Number);
    const ui = selection('gharzak');
    ui.battleUnit = unit.id;
    ui.battleUnits = new Set([unit.id]);
    const before = JSON.stringify(state);
    const undo = captureMove(state, ui, 'Undo battle move');
    expect(moveUnit(state.battle, unit.id, { col, row })).toBe(true);
    expect(undoBlocked(undo.state, state)).toBeNull();
    expect(renderBattle(state, { ...ui, undoMoveLabel: undo.label })).toContain('Undo battle move');
    ui.battleUnit = null;
    state = restoreMove(undo, ui);
    expect(JSON.stringify(state)).toBe(before);
    expect(parseSave(JSON.stringify(state))).toEqual(state);
    expect(ui.battleUnit).toBe(unit.id);
  });

  it('won’t take back a move that revealed ground or a lair, cost men, took a town or started a battle', () => {
    const before = newGame(1, 'western-realm');
    before.challenge = { difficulty: 'normal', fog: true, explored: [] };
    const after = (change: (s: GameState) => void) => { const s = structuredClone(before); change(s); return undoBlocked(before, s); };
    expect(after(() => {})).toBeNull();
    expect(after((s) => { s.challenge!.explored.push('10,10'); })).toBe('That march revealed new ground.');
    expect(after((s) => { s.lairs.briarwood.discovered = true; })).toBe('That march found a lair.');
    expect(after((s) => { s.towns.fenwick.owner = 'player'; })).toBe('That march took a town.');
    expect(after((s) => { s.armies.find((x) => x.owner === 'player')!.troops[0].men -= 1; })).toBe('That move cost men.');

    // A real march into a defended town starts a battle, so it stands.
    const s = newGame(1, 'western-realm');
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    const undo = captureMove(s, selection(home.at), 'Undo march');
    expect(moveTroops(s, home.at, home.troops.map((t) => t.id), townLocation(s, 'fenwick'))).toBeNull();
    expect(undoBlocked(undo.state, s)).toBe('That march started a battle.');
  });
});
