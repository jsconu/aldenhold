import { describe, expect, it } from 'vitest';
import { armyAt, campaignOf, makeTroop, newGame, recruit } from './campaign';
import { hexDistance, hexKey } from './hex';
import { garrisonDefense } from './raids';
import { parseSave } from './saves';
import { assignScout, observeOrcRoutes } from './scouts';
import { hasRoad, townLocation, worldOf } from './world';

describe('local scout watch', () => {
  it('posts scouts in cities and on roads, reports a crossing once, and reloads those orders', () => {
    const s = newGame(7, 'western-realm');
    const capital = campaignOf(s).capital;
    const home = townLocation(s, capital);
    const cityArmy = armyAt(s, home, 'player')!;
    expect(recruit(s, capital, 'scout')).toBeNull();
    const cityScout = cityArmy.troops.find((t) => t.type === 'scout')!;
    const before = garrisonDefense(s, capital);
    expect(assignScout(s, cityScout.id, 'city')).toBeNull();
    expect(garrisonDefense(s, capital)).toBe(before);

    const [cx, cy] = home.split(',').map(Number);
    const world = worldOf(s);
    if (world.kind !== 'hex') throw new Error('Western Realm should have hex geography');
    const roads = world.rows.flatMap((row, y) => [...row].map((_, x) => hexKey({ col: x, row: y })))
      .filter((at) => hasRoad(s, at) && at !== home && hexDistance({ col: cx, row: cy }, { col: Number(at.split(',')[0]), row: Number(at.split(',')[1]) }) <= 3);
    expect(roads.length).toBeGreaterThan(0);
    const road = roads[0];
    const roadScout = makeTroop(s, 'scout');
    s.armies.push({ id: s.nextId++, owner: 'player', at: road, from: null, troops: [roadScout] });
    expect(assignScout(s, roadScout.id, 'road')).toBeNull();
    const enemy = { id: s.nextId++, owner: 'orcs' as const, at: road, from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(enemy);
    const route = [road, home];
    observeOrcRoutes(s, enemy, route);
    expect(s.scoutReports?.length).toBeGreaterThan(0);
    const count = s.journal.length;
    observeOrcRoutes(s, enemy, route);
    expect(s.journal).toHaveLength(count);
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.scoutReports).toEqual(s.scoutReports);
    expect(loaded.armies.flatMap((a) => a.troops).find((t) => t.id === roadScout.id)?.scoutPost).toBe('road');
    expect(assignScout(loaded, roadScout.id, 'recall')).toBeNull();
  });
});
