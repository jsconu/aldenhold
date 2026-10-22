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

/**
 * Why a move can't be taken back, or null if it can. Undo is only for repositioning: a move that revealed
 * something (new ground, a lair), cost men (a battle wound from rough ground), took a town or started a battle
 * has consequences the player has already seen, so it stands.
 */
export function undoBlocked(before: GameState, now: GameState): string | null {
  if (!before.battle && now.battle) return 'That march started a battle.';
  if (Object.entries(now.towns).some(([id, t]) => before.towns[id]?.owner !== t.owner)) return 'That march took a town.';
  const lost = (was: { id: number; men: number }[], is: { id: number; men: number }[]) =>
    was.some((t) => (is.find((x) => x.id === t.id)?.men ?? 0) < t.men);
  const troops = (s: GameState) => s.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops);
  if (lost(troops(before), troops(now))) return 'That move cost men.';
  if (before.battle && now.battle && lost(before.battle.units, now.battle.units)) return 'That move cost men.';
  if ((now.challenge?.explored.length ?? 0) > (before.challenge?.explored.length ?? 0)) return 'That march revealed new ground.';
  if (Object.entries(now.lairs ?? {}).some(([id, l]) => l.discovered && !before.lairs?.[id]?.discovered)) return 'That march found a lair.';
  return null;
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
