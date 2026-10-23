import { describe, expect, it } from 'vitest';
import { renderHexMap } from '../ui/hexMapView';
import type { UIState } from '../ui/shared';
import { attackTargets, build, buildTargets, createBattle } from './battle';
import { armyAt, arrivalOutcome, makeTroop, moveTroops, newGame } from './campaign';
import { advanceIntel, catchScouts, detectChance, infiltrate, infiltrateQuote, spyOnTheMove, stationScout } from './intel';
import { parseSave } from './saves';
import { beginSiege, siegeOf, siegeOutlook } from './sieges';
import type { Army, GameState } from './types';
import { level } from './units';
import { isCovert, townLocation, worldOf } from './world';

const ui = (): UIState => ({ selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function fieldBattle(walls = false) {
  const s = newGame(1, 'western-realm');
  const a: Army = { id: s.nextId++, owner: 'player', at: '6,14', from: null, troops: [makeTroop(s, 'spearmen'), makeTroop(s, 'engineer'), makeTroop(s, 'spy')] };
  const d: Army = { id: s.nextId++, owner: 'orcs', at: '6,14', from: null, troops: [makeTroop(s, 'warband')] };
  const b = createBattle('6,14', a, d, walls, 1);
  for (const column of b.terrain) column.fill('plain');
  return { s, b, engineer: b.units.find((u) => u.type === 'engineer')!, spy: b.units.find((u) => u.type === 'spy')! };
}

describe('engineers', () => {
  it('take the field behind the line but never attack; spies stay off the field', () => {
    const { b, engineer, spy } = fieldBattle();
    expect(engineer.reserve).toBe(false);
    expect(spy.reserve).toBe(true);
    expect(attackTargets(b, engineer)).toEqual([]);
  });

  it('build a field fort on an empty hex next to them, spending their turn', () => {
    const { b, engineer } = fieldBattle();
    const [at] = buildTargets(b, engineer, 'fort');
    expect(at).toBeDefined();
    expect(build(b, engineer.id, 'fort', at)).toBe(true);
    expect(b.terrain[at.col][at.row]).toBe('fort');
    expect(engineer.acted && engineer.moved).toBe(true);
    expect(buildTargets(b, engineer, 'fort')).toEqual([]);
  });

  it('lay bridges only over water or marsh, and roll siege towers only against walls', () => {
    const { b, engineer } = fieldBattle();
    expect(buildTargets(b, engineer, 'bridge')).toEqual([]);
    const next = buildTargets(b, engineer, 'fort')[0];
    b.terrain[next.col][next.row] = 'stream';
    expect(build(b, engineer.id, 'bridge', next)).toBe(true);
    expect(b.terrain[next.col][next.row]).toBe('bridge');
    expect(buildTargets(fieldBattle().b, fieldBattle().engineer, 'tower')).toEqual([]);
    const walled = fieldBattle(true);
    expect(build(walled.b, walled.engineer.id, 'tower')).toBe(true);
    expect(walled.b.walls).toBe(false);
  });

  it('a battle with forts and bridges survives a save and reload', () => {
    const s = newGame(1, 'western-realm');
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    home.troops.push(makeTroop(s, 'engineer'));
    home.at = '7,7';
    expect(moveTroops(s, '7,7', home.troops.map((t) => t.id), townLocation(s, 'fenwick'))).toBeNull();
    const b = s.battle!;
    const engineer = b.units.find((u) => u.type === 'engineer')!;
    if (b.active === engineer.side) {
      const at = buildTargets(b, engineer, 'fort')[0];
      if (at) build(b, engineer.id, 'fort', at);
    }
    expect(() => parseSave(JSON.stringify(s))).not.toThrow();
  });

  it('batter siege walls down; without them the walls barely fall', () => {
    const plain = newGame(1, 'western-realm');
    const withEngineers = newGame(1, 'western-realm');
    for (const s of [plain, withEngineers]) {
      const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
      army.at = '7,7';
      if (s === withEngineers) army.troops.push(makeTroop(s, 'engineer'));
      beginSiege(s, '7,7', townLocation(s, 'fenwick'));
    }
    const slow = siegeOutlook(plain, siegeOf(plain, 'fenwick')!);
    const fast = siegeOutlook(withEngineers, siegeOf(withEngineers, 'fenwick')!);
    expect(slow.walls).toBeLessThanOrEqual(5);
    expect(fast.walls).toBeGreaterThanOrEqual(15);
  });
});

describe('scouts and spies', () => {
  it('a scout can be stationed anywhere: it leaves its army and keeps watch alone, gaining experience', () => {
    const s = newGame(1, 'western-realm');
    const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    army.at = '6,14';
    const scout = makeTroop(s, 'scout');
    army.troops.push(scout);
    expect(stationScout(s, scout.id)).toBeNull();
    expect(army.troops).not.toContain(scout);
    const post = s.armies.find((a) => a.troops.includes(scout))!;
    expect(post).toMatchObject({ at: '6,14', owner: 'player' });
    expect(scout.scoutPost).toBe('watch');
    const xp = scout.xp;
    advanceIntel(s);
    expect(scout.xp).toBe(xp + 1);
  });

  it('a better spy finds scouts more easily; a veteran scout is harder to find', () => {
    expect(detectChance(5, 1)).toBeGreaterThan(detectChance(1, 1));
    expect(detectChance(1, 5)).toBeLessThan(detectChance(1, 1));
    expect(detectChance(30, 1)).toBe(0.95);
    expect(detectChance(1, 30)).toBe(0.05);
  });

  it('the orcs post hidden scouts near your weakest town; they are not drawn, do not block, and are caught on the march', () => {
    const s = newGame(2, 'western-realm');
    s.turn = 6;
    advanceIntel(s);
    const eyes = s.armies.filter((a) => a.owner === 'orcs' && isCovert(a));
    expect(eyes).toHaveLength(1);
    const world = worldOf(s);
    if (world.kind !== 'hex') throw new Error('hex map');
    expect(renderHexMap(s, ui(), world, new Map())).not.toContain(`Orc host: 1 troop`);
    expect(arrivalOutcome(s, eyes[0].at)).toBeNull();
    expect(parseSave(JSON.stringify(s)).armies.some((a) => isCovert(a))).toBe(true);
    // An army marching through the scout's hex catches it.
    expect(catchScouts(s, ['6,14', eyes[0].at])).toEqual(['Caught an orc scout.']);
    expect(s.armies.some((a) => isCovert(a))).toBe(false);
    expect(s.journal.at(-1)!.text).toMatch(/^Your troops caught an orc scout hiding at/);
  });

  it('your spies unmask hidden scouts in range and grow more skilled; enemy spies can find your stationed scouts', () => {
    const s = newGame(2, 'western-realm');
    s.turn = 6;
    advanceIntel(s);
    const eye = s.armies.find((a) => a.owner === 'orcs' && isCovert(a))!;
    const spy = makeTroop(s, 'spy');
    s.armies.push({ id: s.nextId++, owner: 'player', at: eye.at.split(',').map((n, i) => (i === 0 ? Number(n) + 1 : n)).join(','), from: null, troops: [spy] });
    for (let i = 0; i < 30 && s.armies.includes(eye); i++) advanceIntel(s);
    expect(s.armies.includes(eye)).toBe(false);
    expect(spy.xp).toBeGreaterThanOrEqual(2);
    expect(s.journal.some((j) => /^Your spy near .* unmasked an orc scout/.test(j.text))).toBe(true);

    const t: GameState = newGame(3, 'western-realm');
    const orcHome = townLocation(t, 'gharzak');
    const [c, r] = orcHome.split(',').map(Number);
    const scout = makeTroop(t, 'scout');
    scout.scoutPost = 'watch';
    t.armies.push({ id: t.nextId++, owner: 'player', at: `${c - 2},${r}`, from: null, troops: [scout] });
    t.turn = 48;
    for (let i = 0; i < 40 && t.armies.some((a) => a.troops.includes(scout)); i++) advanceIntel(t);
    expect(t.armies.some((a) => a.troops.includes(scout))).toBe(false);
    expect(t.journal.some((j) => j.text.startsWith('Enemy spies found your scout'))).toBe(true);
    expect(level(scout.xp)).toBeGreaterThanOrEqual(1);
  });
});

describe('spies on their own', () => {
  function spyBy(s: GameState, at: string) {
    const spy = makeTroop(s, 'spy');
    const army: Army = { id: s.nextId++, owner: 'player', at, from: null, troops: [spy] };
    s.armies.push(army);
    return { spy, army };
  }

  it('slip past armies and into towns without fighting or taking them', () => {
    const s = newGame(1, 'western-realm');
    const { spy } = spyBy(s, '7,7');
    spy.mp = 18;
    const fenwick = townLocation(s, 'fenwick');
    expect(moveTroops(s, '7,7', [spy.id], fenwick)).toBeNull();
    expect(s.battle).toBeNull();
    expect(s.towns.fenwick.owner).toBe('neutral');
    const moved = s.armies.find((x) => x.troops.includes(spy))!;
    expect(moved.at).toBe(fenwick);
    expect(isCovert(moved)).toBe(true);
  });

  it('pick up a clue to a hidden scout further off, with a direction', () => {
    const s = newGame(2, 'western-realm');
    s.turn = 6;
    advanceIntel(s);
    const eye = s.armies.find((a) => a.owner === 'orcs' && isCovert(a))!;
    const [c, r] = eye.at.split(',').map(Number);
    const { army } = spyBy(s, `${c - 6},${r}`);
    spyOnTheMove(s, army, [army.at]);
    expect(s.journal.at(-1)!.text).toMatch(/^Your spy found signs of a hidden scout about 6 hexes (east|north-east|south-east) of /);
  });

  it('infiltrate a town, report on it each month, and may be caught', () => {
    const s = newGame(1, 'western-realm');
    const { spy, army } = spyBy(s, '7,7');
    spy.mp = 18;
    expect(infiltrateQuote(s, army.id)).toEqual({ reason: null, town: 'fenwick' });
    expect(infiltrate(s, army.id)).toBeNull();
    expect(spy.infiltrating).toBe('fenwick');
    expect(s.intel!.fenwick.lines[0]).toMatch(/^Garrison: /);
    expect(parseSave(JSON.stringify(s)).intel!.fenwick).toEqual(s.intel!.fenwick);
    s.turn += 1;
    advanceIntel(s);
    expect(s.armies.includes(army) ? s.intel!.fenwick.turn : s.turn).toBe(s.turn);
    for (let i = 0; i < 80 && s.armies.includes(army); i++) advanceIntel(s);
    expect(s.journal.some((j) => j.text === 'Your spy in Fenwick was caught and executed.')).toBe(true);
  });
});
