import { describe, expect, it } from 'vitest';
import { endTurn, newGame, recruit } from './campaign';
import { captureRecovery, clearRecovery, readManualSlot, readRecovery, RECOVERY_KEY, writeManualSlot } from './saveSlots';
import type { SaveStorage } from './saves';
import { renderSaveManager } from '../ui/saveManagerView';

function memory() {
  const data = new Map<string, string>();
  const storage: SaveStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
  return { data, storage };
}

describe('manual positions and recovery history', () => {
  it('keeps three independent manual campaigns and restores the exact month, quest and treasury', () => {
    const { storage } = memory();
    const western = newGame(71, 'western-realm');
    expect(recruit(western, 'aldenhold', 'militia')).toBeNull();
    expect(recruit(western, 'aldenhold', 'militia')).toBeNull();
    endTurn(western);
    const original = JSON.stringify(western);
    expect(writeManualSlot(storage, 1, western, 'The crossing', new Date('2026-10-21T12:00:00Z'))).toBeNull();
    expect(writeManualSlot(storage, 2, newGame(33), 'Valley')).toBeNull();
    expect(readManualSlot(storage, 3)).toEqual({ status: 'empty' });
    endTurn(western);
    const loaded = readManualSlot(storage, 1);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;
    expect(JSON.stringify(loaded.save.state)).toBe(original);
    expect(loaded.save.state.turn).toBe(2);
    expect(loaded.save.state.quests.M01.status).toBe('succeeded');
    expect(loaded.save.state.treasury.history).toHaveLength(1);
    expect(readManualSlot(storage, 2).status).toBe('ready');
    expect(renderSaveManager(storage, true)).toContain('The crossing');
    expect(renderSaveManager(storage, false)).toContain('disabled');
  });

  it('rotates three distinct pre-action states without rewriting equal checkpoints', () => {
    const { storage } = memory();
    const game = newGame(52, 'western-realm');
    const states: string[] = [];
    for (let i = 0; i < 4; i++) {
      states.push(JSON.stringify(game));
      expect(captureRecovery(storage, game, 'Before month')).toBeNull();
      expect(captureRecovery(storage, game, 'Before quest choice')).toBeNull();
      endTurn(game);
    }
    const history = readRecovery(storage);
    expect(history.invalid).toBe(false);
    expect(history.slots.map((s) => s.state.turn)).toEqual([4, 3, 2]);
    expect(history.slots.map((s) => JSON.stringify(s.state))).toEqual(states.slice(1).reverse());
    expect(game.turn).toBe(5);
  });

  it('preserves corrupted saves and old positions on failed validation or quota errors', () => {
    const { data, storage } = memory();
    const good = newGame(9);
    expect(writeManualSlot(storage, 1, good)).toBeNull();
    const originalSlot = data.get('aragon-manual-1-v1');
    const invalid = structuredClone(good);
    (invalid as unknown as { version: number }).version = 999;
    expect(writeManualSlot(storage, 1, invalid)).toMatch(/could not be saved/);
    expect(data.get('aragon-manual-1-v1')).toBe(originalSlot);
    expect(captureRecovery(storage, good, 'Before month')).toBeNull();
    const originalHistory = data.get(RECOVERY_KEY);
    const full: SaveStorage = { getItem: storage.getItem, setItem: () => { throw new Error('Quota'); } };
    endTurn(good);
    expect(captureRecovery(full, good, 'Before month')).toMatch(/could not be saved/);
    expect(writeManualSlot(full, 2, good)).toMatch(/could not be saved/);
    expect(data.get(RECOVERY_KEY)).toBe(originalHistory);
    data.set(RECOVERY_KEY, '{broken');
    expect(readRecovery(storage).invalid).toBe(true);
    expect(captureRecovery(storage, good, 'Before month')).toMatch(/could not be saved/);
    expect(data.get(RECOVERY_KEY)).toBe('{broken');
    expect(clearRecovery(storage)).toBeNull();
    expect(readRecovery(storage)).toEqual({ slots: [], invalid: false });
    data.set('aragon-manual-2-v1', '{broken');
    expect(readManualSlot(storage, 2).status).toBe('invalid');
    expect(readManualSlot(storage, 1).status).toBe('ready');
  });
});
