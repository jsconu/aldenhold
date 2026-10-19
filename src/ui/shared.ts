export interface UIState {
  /** Selected map node. */
  selected: string | null;
  /** Troops ticked to march from the selected node. */
  checked: Set<number>;
  /** Selected unit in the current battle. */
  battleUnit: number | null;
  message: string;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
