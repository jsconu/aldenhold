import type { GameState } from './types';
import { MAX_SAVE_BYTES, parseSave, type SaveStorage } from './saves';

export const MANUAL_SLOTS = 3;
export const RECOVERY_LIMIT = 3;
export const RECOVERY_KEY = 'aragon-recovery-v1';
const slotKey = (slot: number) => `aragon-manual-${slot}-v1`;

export type RecoveryReason = 'Before month' | 'Before quest choice' | 'Before new campaign' | 'Before import' | 'Before restore';

export interface SavedPosition {
  label: string;
  savedAt: string;
  reason: RecoveryReason | 'Manual';
  state: GameState;
}

export type SlotResult =
  | { status: 'empty' }
  | { status: 'ready'; save: SavedPosition }
  | { status: 'invalid' };

function validSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MANUAL_SLOTS) throw new Error('Invalid save slot.');
}

function position(value: unknown): SavedPosition {
  if (!value || typeof value !== 'object') throw new Error('Invalid save position.');
  const row = value as Record<string, unknown>;
  if (typeof row.label !== 'string' || row.label.length > 60 ||
    typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt)) ||
    !['Manual', 'Before month', 'Before quest choice', 'Before new campaign', 'Before import', 'Before restore'].includes(String(row.reason))) {
    throw new Error('Invalid save position metadata.');
  }
  // Every recovery path uses the same strict schema migration and validation as JSON import.
  const raw = JSON.stringify(row.state);
  if (new Blob([raw]).size > MAX_SAVE_BYTES) throw new Error('Save position is too large.');
  return { label: row.label, savedAt: row.savedAt, reason: row.reason as SavedPosition['reason'], state: parseSave(raw) };
}

function snapshot(state: GameState, label: string, reason: SavedPosition['reason'], now: Date): SavedPosition {
  return position({ label: label.trim().slice(0, 60), reason, savedAt: now.toISOString(), state });
}

export function readManualSlot(storage: SaveStorage, slot: number): SlotResult {
  validSlot(slot);
  try {
    const raw = storage.getItem(slotKey(slot));
    if (raw === null) return { status: 'empty' };
    return { status: 'ready', save: position(JSON.parse(raw)) };
  } catch {
    return { status: 'invalid' };
  }
}

export function writeManualSlot(storage: SaveStorage, slot: number, state: GameState, label = '', now = new Date()): string | null {
  validSlot(slot);
  try {
    // Validate before touching an existing slot; setItem is atomic in Web Storage.
    const save = snapshot(state, label || `Slot ${slot}`, 'Manual', now);
    storage.setItem(slotKey(slot), JSON.stringify(save));
    return null;
  } catch {
    return `Slot ${slot} could not be saved. Export your current game as a backup.`;
  }
}

export function readRecovery(storage: SaveStorage): { slots: SavedPosition[]; invalid: boolean } {
  try {
    const raw = storage.getItem(RECOVERY_KEY);
    if (raw === null) return { slots: [], invalid: false };
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || list.length > RECOVERY_LIMIT) throw new Error('Invalid recovery history.');
    return { slots: list.map(position), invalid: false };
  } catch {
    // Never erase unreadable data or silently replace it during rotation.
    return { slots: [], invalid: true };
  }
}

export function captureRecovery(storage: SaveStorage, state: GameState, reason: RecoveryReason, now = new Date()): string | null {
  try {
    const previous = readRecovery(storage);
    if (previous.invalid) throw new Error('Unreadable recovery history.');
    const next = snapshot(state, `${state.campaignId} · month ${state.turn}`, reason, now);
    // Opening a quest and ending the month without intervening changes need one checkpoint.
    if (previous.slots[0] && JSON.stringify(previous.slots[0].state) === JSON.stringify(next.state)) return null;
    storage.setItem(RECOVERY_KEY, JSON.stringify([next, ...previous.slots].slice(0, RECOVERY_LIMIT)));
    return null;
  } catch {
    return 'Recovery checkpoint could not be saved. Export your current game before continuing.';
  }
}

export function clearRecovery(storage: SaveStorage): string | null {
  try {
    storage.setItem(RECOVERY_KEY, '[]');
    return null;
  } catch {
    return 'Recovery history could not be cleared. Your existing saves were not changed.';
  }
}
