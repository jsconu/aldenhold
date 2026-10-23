import type { CampaignId } from '../game/types';
import type { RulerChoice } from '../game/rulerCreation';
import type { SpellId } from '../game/types';

export interface UIState {
  refitChoice?: {troop:number;item:import('../game/types').EquipmentId};
  creatingFor?: CampaignId;
  rulerDraft?: RulerChoice;
  /** The campaign chooser is open. */
  choosing?: boolean;
  /** Selected map node. */
  selected: string | null;
  /** Troops ticked to march from the selected node. */
  checked: Set<number>;
  /** A short popup to acknowledge something that just happened (a new unit, …); OK closes it. */
  notice?: { title: string; lines: string[] } | null;
  /** A town with your troops was clicked: move troops (choosing which) or open the city screen. */
  townChoice?: { at: string; step: 'choose' | 'troops' } | null;
  /** Choice before committing a march into a defended hostile settlement. */
  assault?: { from: string; to: string; troopIds: number[] } | null;
  /** Selected unit in the current battle. */
  battleUnit: number | null;
  /** Tactical unit IDs selected for a simultaneous move (the battleUnit is the lead). */
  battleUnits?: Set<number>;
  /** An in-session movement snapshot is available; it is never part of the save. */
  undoMoveLabel?: string;
  /** Why the last move can't be undone (shown on a disabled Undo button right after it). */
  undoMoveBlocked?: string;
  /** What the selected engineers are about to build (game/battle.ts BUILDS). */
  battleBuild?: import('../game/battle').Build | null;
  /** Spell the selected hero is about to cast. */
  battleSpell: SpellId | null;
  battleTarget?: number | null;
  /** Battle camera zoom (1 = the field's drawn size); the field scrolls inside its frame. */
  battleZoom?: number;
  battleDestination?: { col: number; row: number } | null;
  message: string;
  /** Campaign screen: the province map or the full journal. */
  view: 'map' | 'journal' | 'treasury' | 'city' | 'quests';
  cityTab?:'overview'|'development'|'recruitment'|'army'|'quests';
  marchMode?:boolean;
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
