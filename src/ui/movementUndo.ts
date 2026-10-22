import type { GameState } from '../game/types';
import type { UIState } from './shared';

export interface MovementUndo {
  state: GameState;
  selected: string | null;
  checked: Set<number>;
  battleUnit: number | null;
  battleUnits: Set<number>;
  routeOrigin: string | null | undefined;
  routeDestination: string | null | undefined;
  label: string;
}

/** Exact, in-session position before a successful march or tactical move. */
export function captureMove(state: GameState, ui: UIState, label: string): MovementUndo {
  return { state: structuredClone(state), selected: ui.selected, checked: new Set(ui.checked),
    battleUnit: ui.battleUnit, battleUnits: new Set(ui.battleUnits),
    routeOrigin: ui.routeOrigin, routeDestination: ui.routeDestination, label };
}

/** Restore campaign and map selection together; callers autosave the returned position. */
export function restoreMove(before: MovementUndo, ui: UIState): GameState {
  ui.selected = before.selected;
  ui.checked = before.checked;
  ui.battleUnit = before.battleUnit;
  ui.battleUnits = before.battleUnits;
  ui.battleSpell = null;
  ui.battleTarget = null;
  ui.battleDestination = null;
  ui.routeOrigin = before.routeOrigin;
  ui.routeDestination = before.routeDestination;
  ui.view = 'map';
  return before.state;
}
