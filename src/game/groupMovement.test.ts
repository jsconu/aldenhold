import { describe, expect, it } from 'vitest';
import { createBattle, groupReachable, moveGroup, movementOf, reachable } from './battle';
import { armyAt, newGame } from './campaign';
import { hexDistance } from './hex';
import { parseSave } from './saves';
import { renderBattle } from '../ui/battleView';
import type { UIState } from '../ui/shared';

function field() {
  const state = newGame(7);
  const attacker = armyAt(state, 'aldenhold', 'player')!;
  const defender = armyAt(state, 'gharzak', 'orcs')!;
  attacker.at = 'gharzak';
  attacker.from = 'pass';
  state.battle = createBattle('gharzak', attacker, defender, false, 7);
  const battle = state.battle;
  for (const column of battle.terrain) column.fill('plain');
  const lead = battle.units.find((u) => u.type === 'lord')!;
  const companion = battle.units.find((u) => u.side === lead.side && u.type === 'spearmen')!;
  return { state, battle, lead, companion };
}

describe('simultaneous battle movement', () => {
  it('keeps a formation together under the slowest movement budget and reloads exactly', () => {
    const { state, battle, lead, companion } = field();
    const ids = [lead.id, companion.id];
    const spacing = hexDistance(lead, companion);
    expect(movementOf(lead)).toBeGreaterThan(movementOf(companion));
    const solo = reachable(battle, lead);
    const group = groupReachable(battle, ids);
    expect(group.size).toBeGreaterThan(0);
    expect([...group.values()].every((cost) => cost <= movementOf(companion))).toBe(true);
    expect([...solo.keys()].some((key) => !group.has(key))).toBe(true);
    const destination = [...group.keys()].find((key) => Number(key.split(',')[0]) > lead.col)!;
    const [col, row] = destination.split(',').map(Number);
    expect(moveGroup(battle, ids, { col, row })).toBe(true);
    expect([lead.col, lead.row]).toEqual([col, row]);
    expect(hexDistance(lead, companion)).toBe(spacing);
    expect([lead.moved, companion.moved]).toEqual([true, true]);
    expect(groupReachable(battle, ids).size).toBe(0);
    expect(parseSave(JSON.stringify(state))).toEqual(state);
  });

  it('rejects a blocked member or impassable ground without moving anyone', () => {
    const { battle, lead, companion } = field();
    const ids = [lead.id, companion.id];
    const target = { col: lead.col + 1, row: lead.row };
    // The lead's right-hand hex is open, but the companion's translated hex is not.
    battle.terrain[target.col][companion.row] = 'rocks';
    const before = JSON.stringify(battle);
    expect(groupReachable(battle, ids).has(`${target.col},${target.row}`)).toBe(false);
    expect(moveGroup(battle, ids, target)).toBe(false);
    expect(lead.moved).toBe(false);
    expect(companion.moved).toBe(false);
    expect(JSON.stringify(battle)).toBe(before);
  });

  it('shows selection, shared range and the undo control without changing battle data', () => {
    const { state, battle, lead, companion } = field();
    const before = JSON.stringify(battle);
    const ui: UIState = { selected: 'aldenhold', checked: new Set(), battleUnit: lead.id,
      battleUnits: new Set([lead.id, companion.id]), battleSpell: null, message: '', view: 'map', undoMoveLabel: 'Undo battle move' };
    const html = renderBattle(state, ui);
    expect(html).toContain('Move together (2 selected)');
    expect(html).toContain('The slowest has 3 movement');
    expect(html).toContain('data-action="undo-move"');
    expect((html.match(/class="unit mine[^\"]* sel/g) ?? []).length).toBe(2);
    expect(JSON.stringify(battle)).toBe(before);
  });
});
