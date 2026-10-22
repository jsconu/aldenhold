import { describe, expect, it } from 'vitest';
import { armyAt, moveTroops, newGame } from '../game/campaign';
import { createBattle, moveUnit, reachable } from '../game/battle';
import { parseSave } from '../game/saves';
import { renderCampaign } from './campaignView';
import { renderBattle } from './battleView';
import { captureMove, restoreMove } from './movementUndo';
import type { UIState } from './shared';

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

  it('restores a battle move including terrain losses and its tactical selection', () => {
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
    expect(renderBattle(state, { ...ui, undoMoveLabel: undo.label })).toContain('Undo battle move');
    ui.battleUnit = null;
    state = restoreMove(undo, ui);
    expect(JSON.stringify(state)).toBe(before);
    expect(parseSave(JSON.stringify(state))).toEqual(state);
    expect(ui.battleUnit).toBe(unit.id);
  });
});
