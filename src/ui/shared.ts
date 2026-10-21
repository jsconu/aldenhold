import type { SpellId } from '../game/types';

export interface UIState {
  /** The campaign chooser is open. */
  choosing?: boolean;
  /** Selected map node. */
  selected: string | null;
  /** Troops ticked to march from the selected node. */
  checked: Set<number>;
  /** Selected unit in the current battle. */
  battleUnit: number | null;
  /** Spell the selected hero is about to cast. */
  battleSpell: SpellId | null;
  battleTarget?: number | null;
  /** Battle camera zoom (1 = the field's drawn size); the field scrolls inside its frame. */
  battleZoom?: number;
  /** Tactics screen: the formation picked up to move to another cell. */
  tacticsTroop?: number | null;
  battleDestination?: { col: number; row: number } | null;
  message: string;
  /** Campaign screen: the province map or the full journal. */
  view: 'map' | 'journal' | 'treasury';
  /** Ephemeral map presentation; deliberately not part of the saved campaign. */
  mapLayer?: 'terrain' | 'political';
  mapZoom?: number;
  /** Planning is a preview, not a saved army order. */
  routeOrigin?: string | null;
  routeDestination?: string | null;
  routePreference?: 'shortest' | 'safer';
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
