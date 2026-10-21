import { describe, expect, it } from 'vitest';
import { autoResolve } from './battle';
import { applyBattle, armyAt, checkStatus, deed, endTurn, hireHero, moveTroops, newGame, recruit } from './campaign';
import { parseSave } from './saves';
import type { GameState } from './types';

function takeFenwick(): GameState {
  const s = newGame(1);
  const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
  moveTroops(s, 'aldenhold', ids, 'fenwick');
  autoResolve(s.battle!);
  applyBattle(s, s.battle!);
  return s;
}

/** A v3 save as Codex's foundation increment wrote it: no journal yet. */
function asV3(s: GameState): string {
  const { journal: _journal, ...rest } = s;
  return JSON.stringify({ ...rest, version: 3 });
}

describe('campaign journal', () => {
  it('opens with the campaign story, placed at the capital', () => {
    const s = newGame(1);
    expect(s.journal).toEqual([{ id: 1, turn: 1, kind: 'story', text: expect.stringMatching(/Aldenhold is yours/), place: 'aldenhold' }]);
  });

  it('records a won battle and the capture it brings, in order, at the place they happened', () => {
    const s = takeFenwick();
    const recent = s.journal.slice(1).map((j) => [j.kind, j.place, j.text]);
    expect(recent).toEqual([
      ['battle', 'fenwick', 'Victory at Fenwick.'],
      ['story', 'fenwick', 'The Fenwick council can no longer offer a charter after the town changed hands.'],
      ['capture', 'fenwick', 'Fenwick now flies your banner.'],
    ]);
    expect(s.journal.map((j) => j.id)).toEqual([1, 2, 3, 4]);
  });

  it('keeps routine news out of the journal', () => {
    const s = newGame(1);
    recruit(s, 'aldenhold', 'militia');
    expect(s.journal).toHaveLength(1);
    expect(s.log[0]).toMatch(/Militia raised/);
  });

  it('records heroes joining and losses of your towns', () => {
    const s = newGame(1);
    hireHero(s, s.offers[0]);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'hero', place: 'aldenhold', text: expect.stringMatching(/Brother Osric/) });
    // Leave Millbrook empty with an orc band next door at Duskwater; every other town is already theirs.
    for (const id of ['fenwick', 'harrowgate', 'duskwater']) s.towns[id].owner = 'orcs';
    s.armies = s.armies.filter((a) => a.owner !== 'neutral' && a.at !== 'millbrook' && a.at !== 'pass');
    s.armies.push({ id: s.nextId++, owner: 'orcs', at: 'duskwater', from: null, troops: [{ id: s.nextId++, type: 'warband', men: 20, xp: 0, mp: 1, gear: { bow: null, armor: 'leather' }, refit: null }] });
    endTurn(s);
    expect(s.towns.millbrook.owner).toBe('orcs');
    expect(s.journal.at(-1)).toMatchObject({ kind: 'loss', place: 'millbrook', text: 'Orcs have taken Millbrook from you.' });
  });

  it('is permanent: deeds outlive the 60-line chronicle', () => {
    const s = newGame(1);
    for (let i = 0; i < 100; i++) deed(s, 'realm', `Deed ${i}`);
    expect(s.log).toHaveLength(60);
    expect(s.journal).toHaveLength(101);
    expect(s.journal.at(-1)!.text).toBe('Deed 99');
  });

  it('records the ending exactly once', () => {
    const s = newGame(1);
    s.towns.gharzak.owner = 'player';
    checkStatus(s);
    checkStatus(s);
    expect(s.journal.filter((j) => j.kind === 'ending')).toEqual([expect.objectContaining({ place: 'gharzak', text: 'Gharzak Hold is broken. The valley is yours.' })]);
  });

  it('survives saving and reloading unchanged', () => {
    const s = takeFenwick();
    expect(parseSave(JSON.stringify(s)).journal).toEqual(s.journal);
  });
});

describe('save migration v3 → v4', () => {
  it('turns the surviving chronicle into earlier journal entries, oldest first, with their months', () => {
    const s = takeFenwick();
    endTurn(s);
    const migrated = parseSave(asV3(s));
    expect(migrated.version).toBe(14);
    expect(migrated.journal.every((j) => j.kind === 'earlier' && j.place === null)).toBe(true);
    expect(migrated.journal.map((j) => j.text)).toEqual(s.log.map((l) => l.replace(/^[A-Za-z]+, year \d+: /, '')).reverse());
    expect(migrated.journal[0]).toMatchObject({ id: 1, turn: 1 });
    expect(migrated.journal.at(-1)!.turn).toBe(2);
  });

  it('rejects a journal that refers to a place that does not exist, or skips an entry', () => {
    const s = newGame(1);
    expect(() => parseSave(JSON.stringify({ ...s, journal: [{ ...s.journal[0], place: 'atlantis' }] }))).toThrow(/journal place/);
    expect(() => parseSave(JSON.stringify({ ...s, journal: [{ ...s.journal[0], id: 2 }] }))).toThrow(/journal entry/);
  });
});
