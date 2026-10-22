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
  /** Tactical formation IDs selected for a simultaneous move (the battleUnit is the lead). */
  battleUnits?: Set<number>;
  /** An in-session movement snapshot is available; it is never part of the save. */
  undoMoveLabel?: string;
  /** Spell the selected hero is about to cast. */
  battleSpell: SpellId | null;
  battleTarget?: number | null;
  /** Battle camera zoom (1 = the field's drawn size); the field scrolls inside its frame. */
  battleZoom?: number;
  battleDestination?: { col: number; row: number } | null;
  message: string;
  /** Campaign screen: the province map or the full journal. */
  view: 'map' | 'journal' | 'treasury';
  /** Ephemeral map presentation; deliberately not part of the saved campaign. */
  mapLayer?: 'terrain' | 'political';
  mapZoom?: number;
  /** Western Realm hex map zoom (see HEX_ZOOMS); absent means the default. */
  hexZoom?: number;
  /** Planning is a preview, not a saved army order. */
  routeOrigin?: string | null;
  routeDestination?: string | null;
  routePreference?: 'shortest' | 'safer';
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
