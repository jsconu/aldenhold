import { describe, expect, it } from 'vitest';
import { armyAt, moveTroops, newGame } from './campaign';
import { hasPassage } from './diplomacy';
import { chooseQuest, onTownOwnershipChange } from './quests';
import { parseSave } from './saves';

describe('Fenwick Charter quest foundation', () => {
  it('starts as one undecided quest and no free item or treaty', () => {
    const s = newGame(1);
    expect(s.version).toBe(15);
    expect(s.quests.Q00).toEqual({ status: 'available', stage: 'decision', choice: null, resolvedTurn: null,
      resolvedBy: null, stageTurn: 1, history: [] });
    expect(s.items).toEqual({});
    expect(s.treaties).toEqual({});
  });

  it('signs a treaty, awards exactly one unique item, and records the decision', () => {
    const s = newGame(1);
    expect(chooseQuest(s, 'Q00', 'sign')).toBeNull();
    expect(s.quests.Q00).toMatchObject({ status: 'succeeded', choice: 'sign', resolvedTurn: 1 });
    expect(s.items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
    expect(s.treaties.fenwick).toEqual({ relation: 'ally', passage: true, signedTurn: 1 });
    expect(s.journal.at(-1)?.text).toContain('Signed the Fenwick Charter');
    expect(chooseQuest(s, 'Q00', 'sign')).toContain('already decided');
    expect(chooseQuest(s, 'Q00', 'decline')).toContain('already decided');
    expect(Object.keys(s.items)).toHaveLength(1);
    expect(s.journal.filter((j) => j.text.includes('Signed the Fenwick Charter'))).toHaveLength(1);
  });

  it('allows passage by Fenwick neutral garrison but not other neutral towns', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    expect(hasPassage(s, 'player', 'fenwick')).toBe(true);
    expect(hasPassage(s, 'player', 'harrowgate')).toBe(false);
    expect(hasPassage(s, 'orcs', 'fenwick')).toBe(false);
    const army = armyAt(s, 'aldenhold', 'player')!;
    expect(moveTroops(s, 'aldenhold', army.troops.map((t) => t.id), 'fenwick')).toBeNull();
    expect(s.battle).toBeNull();
    expect(s.towns.fenwick.owner).toBe('neutral');
    expect(armyAt(s, 'fenwick', 'neutral')).toBeDefined();
    expect(armyAt(s, 'fenwick', 'player')).toBeDefined();
  });

  it('declining keeps Fenwick independent and hostile passage rules intact', () => {
    const s = newGame(1);
    expect(chooseQuest(s, 'Q00', 'decline')).toBeNull();
    expect(s.quests.Q00).toMatchObject({ status: 'failed', choice: 'decline' });
    expect(s.items).toEqual({});
    expect(hasPassage(s, 'player', 'fenwick')).toBe(false);
    const a = armyAt(s, 'aldenhold', 'player')!;
    moveTroops(s, 'aldenhold', a.troops.map((t) => t.id), 'fenwick');
    expect(s.battle).not.toBeNull();
  });

  it('does not allow a remote or battle-time council decision', () => {
    const s = newGame(1);
    s.armies.filter((a) => a.owner === 'player').forEach((a) => { a.at = 'millbrook'; });
    expect(chooseQuest(s, 'Q00', 'sign')).toContain('neighboring road');
    expect(Object.keys(s.items)).toHaveLength(0);
    expect(s.quests.Q00.status).toBe('available');
  });

  it('loads the completed treaty, reward and choice without replaying them', () => {
    const s = newGame(12);
    chooseQuest(s, 'Q00', 'sign');
    const saved = JSON.stringify(s);
    const restored = parseSave(saved);
    expect(restored).toEqual(s);
    expect(chooseQuest(restored, 'Q00', 'sign')).toContain('already decided');
    expect(restored.items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
  });

  it('ends the passage on conquest without removing a previously earned item', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    s.towns.fenwick.owner = 'orcs';
    onTownOwnershipChange(s, 'fenwick', 'orcs');
    expect(hasPassage(s, 'player', 'fenwick')).toBe(false);
    expect(s.treaties.fenwick).toBeUndefined();
    expect(s.items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
    expect(s.quests.Q00.status).toBe('succeeded');
    expect(parseSave(JSON.stringify(s)).items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
  });

  it('supersedes an undecided quest when Fenwick is taken', () => {
    const s = newGame(1);
    s.towns.fenwick.owner = 'player';
    onTownOwnershipChange(s, 'fenwick', 'player');
    expect(s.quests.Q00.status).toBe('superseded');
    expect(s.items).toEqual({});
    expect(chooseQuest(s, 'Q00', 'sign')).not.toBeNull();
  });

  it('migrates v4 without retroactive rewards or diplomatic access', () => {
    const s = newGame(7);
    const { quests: _quests, items: _items, treaties: _treaties, ...prior } = s;
    const migrated = parseSave(JSON.stringify({ ...prior, version: 4 }));
    expect(migrated.version).toBe(15);
    expect(migrated.quests.Q00.status).toBe('available');
    expect(migrated.items).toEqual({});
    expect(migrated.treaties).toEqual({});
    const alreadyConquered = parseSave(JSON.stringify({ ...prior, version: 4,
      towns: { ...prior.towns, fenwick: { ...prior.towns.fenwick, owner: 'player' } } }));
    expect(alreadyConquered.quests.Q00.status).toBe('superseded');
  });

  it('rejects duplicated, forged or inconsistent rewards', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    const corrupted = structuredClone(s);
    corrupted.items['fenwick-charter'].qty = 2;
    expect(() => parseSave(JSON.stringify(corrupted))).toThrow(/inventory/);
    corrupted.items = { 'fake-object': { qty: 1, spent: 0, archived: false } };
    expect(() => parseSave(JSON.stringify(corrupted))).toThrow(/inventory/);
    corrupted.items = {};
    expect(() => parseSave(JSON.stringify(corrupted))).toThrow(/missing quest reward/);
    corrupted.items = { 'fenwick-charter': { qty: 1, spent: 0, archived: false } };
    corrupted.treaties.nowhere = { relation: 'ally', passage: true, signedTurn: 1 };
    expect(() => parseSave(JSON.stringify(corrupted))).toThrow(/treaty/);
  });
});
