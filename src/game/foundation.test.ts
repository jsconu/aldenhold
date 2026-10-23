import { describe, expect, it } from 'vitest';
import { alive, attackTargets, autoResolve, castSpell, createBattle, reachable, reserves, retreat, spellTargets, unitAt } from './battle';
import { applyBattle, armyAt, checkStatus, endTurn, makeTroop, moveTroops, newGame } from './campaign';
import { LEGACY_SAVE_KEY, loadGame, parseSave, SAVE_KEY, saveGame, type SaveStorage } from './saves';
import type { GameState } from './types';
import { renderBattle } from '../ui/battleView';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';

const ui: UIState = { selected: 'aldenhold', checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
function largeBattle(count = 28) {
  const s = newGame(1);
  const a = armyAt(s, 'aldenhold', 'player')!;
  while (a.troops.length < count) a.troops.push(makeTroop(s, 'archers'));
  const d = armyAt(s, 'gharzak', 'orcs')!;
  while (d.troops.length < count) d.troops.push(makeTroop(s, 'warband'));
  a.at = 'gharzak';
  a.from = 'pass';
  s.battle = createBattle('gharzak', a, d, true, 7);
  return { s, b: s.battle, a, d };
}
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: SaveStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
  return { data, storage };
}
function legacy(state: GameState): string {
  const { campaignId: _campaignId, campaignRevision: _revision, endingReason: _reason, ...old } = state;
  return JSON.stringify({ ...old, version: 2, battle: old.battle ? { ...old.battle, units: old.battle.units.filter((u) => !u.reserve).map(({ reserve: _reserve, ...u }) => u) } : null });
}

describe('ending precedence', () => {
  it('loses when the lord dies in the final winning battle, and persists the correct banner', () => {
    const { s, b } = largeBattle();
    b.units.find((u) => u.type === 'lord')!.men = 0;
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(s.towns.gharzak.owner).toBe('player');
    expect(s.status).toBe('lost');
    expect(s.endingReason).toBe('lord-dead');
    const restored = parseSave(JSON.stringify(s));
    expect(renderCampaign(restored, ui)).toContain('You have lost. Your lord is dead.');
    expect(renderCampaign(restored, ui)).not.toContain('Aldenhold has fallen.');
  });
  it('gives capital loss priority over both ruler death and conquest, only once', () => {
    const s = newGame(1);
    s.towns.aldenhold.owner = 'orcs';
    s.towns.gharzak.owner = 'player';
    s.armies = s.armies.filter((a) => a.owner !== 'player');
    checkStatus(s);
    const log = [...s.log];
    checkStatus(s);
    expect(s.status).toBe('lost');
    expect(s.endingReason).toBe('capital-lost');
    expect(s.log).toEqual(log);
    expect(parseSave(JSON.stringify(s)).endingReason).toBe('capital-lost');
  });
  it('still wins a clean final conquest and records the reason', () => {
    const { s, b } = largeBattle();
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(s.status).toBe('won');
    expect(parseSave(JSON.stringify(s)).endingReason).toBe('lair-captured');
  });
  it('does not write back an unfinished battle', () => {
    const { s, b } = largeBattle();
    const before = JSON.stringify(s);
    applyBattle(s, b);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('explicit reserves', () => {
  it.each([27, 28, 60])('accounts for every unit in %i-unit armies on both sides', (count) => {
    const { s, b, a, d } = largeBattle(count);
    expect(b.units).toHaveLength(count * 2);
    expect(new Set(b.units.map((u) => u.troopId))).toEqual(new Set([...a.troops, ...d.troops].map((t) => t.id)));
    for (const side of ['attacker', 'defender'] as const) {
      expect(alive(b, side)).toHaveLength(27);
      expect(reserves(b, side)).toHaveLength(count - 27);
    }
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    if (count > 27) expect(renderBattle(s, ui)).toContain(`Reserves (${2 * (count - 27)} units)`);
  });
  it('cannot select, move, attack with, target, or cast from a reserve', () => {
    const { s, a, d } = largeBattle(27);
    a.troops.push(makeTroop(s, 'mage'));
    d.troops.push(makeTroop(s, 'shaman'));
    const b = createBattle(a.at, a, d, true, 7);
    const mage = reserves(b, 'attacker')[0];
    const enemy = alive(b, 'defender')[0];
    expect(unitAt(b, mage)).toBeUndefined();
    expect(reachable(b, mage).size).toBe(0);
    expect(attackTargets(b, mage)).toEqual([]);
    expect(spellTargets(b, mage, 'fireball')).toEqual([]);
    expect(castSpell(b, mage.id, 'fireball', enemy.id)).toBe(false);
    expect(alive(b)).not.toContain(mage);
  });
  it('preserves reserves without combat losses or XP on victory', () => {
    const { s, b, a } = largeBattle();
    const reserve = a.troops.at(-1)!;
    const before = { ...reserve };
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(s.armies.flatMap((a) => a.troops).find((t) => t.id === reserve.id)).toEqual(before);
    expect(a.troops[0].xp).toBeGreaterThan(0);
  });
  it('applies ordinary pursuit attrition to reserve soldiers on retreat', () => {
    const { s, b, a } = largeBattle();
    const t = a.troops.at(-1)!;
    const men = t.men;
    s.armies = s.armies.filter((a) => a.at !== 'pass');
    retreat(b, 'attacker');
    applyBattle(s, b);
    expect(a.at).toBe('pass');
    expect(t.men).toBe(Math.floor(men * 0.9));
    expect(t.xp).toBe(0);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('does not keep a defeated field army fighting solely because it has reserves', () => {
    const { b } = largeBattle();
    for (const u of alive(b, 'attacker')) u.men = 0;
    autoResolve(b);
    expect(b.outcome).toBe('defender');
    expect(reserves(b, 'attacker')).toHaveLength(1);
  });
});

describe('save migration and recovery', () => {
  it('round-trips a new campaign and loads an empty browser safely', () => {
    const s = newGame(7);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(loadGame(memory().storage)).toEqual({ state: null, warning: '', blocked: false });
  });
  it('migrates v2 without modifying its stored bytes or reinterpreting its world', () => {
    const raw = legacy(newGame(1));
    const { storage, data } = memory({ [LEGACY_SAVE_KEY]: raw });
    const loaded = loadGame(storage);
    expect(loaded.blocked).toBe(false);
    expect(loaded.state?.campaignId).toBe('valley-quickplay');
    expect(loaded.state?.nodes).toHaveLength(9);
    expect(saveGame(storage, loaded.state!)).toBeNull();
    expect(data.get(LEGACY_SAVE_KEY)).toBe(raw);
    expect(data.has(SAVE_KEY)).toBe(true);
  });
  it('restores units omitted by the old deployment code without rerolling the battle', () => {
    const { s, b } = largeBattle(30);
    const migrated = parseSave(legacy(s));
    expect(migrated.battle!.units).toHaveLength(60);
    expect(reserves(migrated.battle!)).toHaveLength(6);
    expect(migrated.battle!.seed).toBe(b.seed);
    expect(migrated.battle!.terrain).toEqual(b.terrain);
    expect(alive(migrated.battle!)).toEqual(alive(b));
  });
  it('corrects contradictory legacy victories to the defeat reason', () => {
    const s = newGame(1);
    s.towns.gharzak.owner = 'player';
    s.armies.forEach((a) => { a.troops = a.troops.filter((t) => t.type !== 'lord'); });
    s.status = 'won';
    const restored = parseSave(legacy(s));
    expect(restored.status).toBe('lost');
    expect(restored.endingReason).toBe('lord-dead');
  });
  it('resumes a saved battle with identical auto-resolve results', () => {
    const s = newGame(5);
    const a = armyAt(s, 'aldenhold', 'player')!;
    moveTroops(s, a.at, a.troops.map((t) => t.id), 'fenwick');
    const restored = parseSave(JSON.stringify(s));
    autoResolve(s.battle!);
    autoResolve(restored.battle!);
    expect(restored.battle).toEqual(s.battle);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    applyBattle(s, s.battle!);
    applyBattle(restored, restored.battle!);
    expect(restored).toEqual(s);
  });
  it('keeps corrupt saves untouched, even with a valid legacy fallback available', () => {
    const { storage, data } = memory({ [SAVE_KEY]: '{broken', [LEGACY_SAVE_KEY]: legacy(newGame(1)) });
    const result = loadGame(storage);
    expect(result.state).toBeNull();
    expect(result.blocked).toBe(true);
    expect(result.warning).toContain('original save has been kept');
    expect(data.get(SAVE_KEY)).toBe('{broken');
  });
  it('returns visible warnings when storage is unavailable or full', () => {
    const storage: SaveStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadGame(storage).warning).toContain('could not be loaded');
    expect(saveGame(storage, newGame(1))).toContain('export it now');
  });
  it('prefers current saves when both versions exist', () => {
    const current = newGame(1); current.gold = 999;
    const { storage } = memory({ [SAVE_KEY]: JSON.stringify(current), [LEGACY_SAVE_KEY]: legacy(newGame(2)) });
    expect(loadGame(storage).state?.gold).toBe(999);
  });
  it.each([
    ['future version', (s: GameState) => Object.assign(s, { version: 999 })],
    ['unknown campaign', (s: GameState) => Object.assign(s, { campaignId: 'frontier' })],
    ['missing town', (s: GameState) => { delete s.towns.aldenhold; }],
    ['bad road', (s: GameState) => { s.edges[0][0] = 'missing'; }],
    ['unknown unit', (s: GameState) => { s.armies[0].troops[0].type = 'missing'; }],
    ['prototype unit name', (s: GameState) => { s.armies[0].troops[0].type = 'constructor'; }],
    ['duplicate ID', (s: GameState) => { s.armies[0].troops[1].id = s.armies[0].id; }],
    ['negative gold', (s: GameState) => { s.gold = -1; }],
    ['missing collections', (s: GameState) => { Object.assign(s, { armies: null }); }],
    ['false victory', (s: GameState) => { s.status = 'won'; s.endingReason = 'lair-captured'; }],
  ] as const)('rejects %s', (_name, corrupt) => {
    const s = newGame(1); corrupt(s);
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it('rejects invalid battle terrain, overlap, omitted units and off-map positions', () => {
    for (const corrupt of [
      (s: GameState) => { s.battle!.terrain[0][0] = 'lava' as never; },
      (s: GameState) => { Object.assign(s.battle!.units[1], { col: s.battle!.units[0].col, row: s.battle!.units[0].row }); },
      (s: GameState) => { s.battle!.units.pop(); },
      (s: GameState) => { s.battle!.units[0].col = 99; },
    ]) {
      const { s } = largeBattle(); corrupt(s);
      expect(() => parseSave(JSON.stringify(s))).toThrow();
    }
  });
  it('accepts actual campaign states over 36 months, including pending and resolved battles', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(seed);
      for (let month = 0; month < 36 && s.status === 'playing'; month++) {
        endTurn(s);
        expect(() => parseSave(JSON.stringify(s))).not.toThrow();
        while (s.battle) {
          autoResolve(s.battle);
          expect(() => parseSave(JSON.stringify(s))).not.toThrow();
          applyBattle(s, s.battle);
          expect(() => parseSave(JSON.stringify(s))).not.toThrow();
        }
      }
    }
  });
});
