import { describe, expect, it } from 'vitest';
import { armySupport, cityArmySupport, personnel } from './armySupport';
import { ARMY_CAP, armyAt, hireHero, makeTroop, marchQuote, moveTroops, neighborsOf, newGame, recruit } from './campaign';
import { advanceCities, buildCity, constructionQuote } from './cities';
import { recruitReplacements } from './replacements';
import { parseSave } from './saves';
import { cityGrowthAdvice, renderCitySummary } from '../ui/citySummary';

describe('city-supported personnel', () => {
  it('counts soldiers individually and a wounded or healthy hero once', () => {
    expect(personnel({ type: 'militia', men: 100 })).toBe(100);
    expect(personnel({ type: 'lord', men: 20 })).toBe(1);
    expect(personnel({ type: 'lord', men: 1 })).toBe(1);
    expect(personnel({ type: 'lord', men: 0 })).toBe(0);
    const s = newGame(1);
    const before = armySupport(s);
    s.cityEconomies.aldenhold.buildings.forge = 4;
    s.towns.millbrook.owner = 'neutral';
    expect(armySupport(s).capacity).toBe(before.capacity + 40 - 90);
  });
  it('blocks recruitment, hiring and replacements without payment or deleting existing troops', () => {
    const s = newGame(1); s.gold = 10000;
    s.cityEconomies.aldenhold.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0 };
    s.cityEconomies.millbrook.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0 };
    s.towns.aldenhold.pop = 510; s.towns.millbrook.pop = 510;
    const a = armyAt(s, 'aldenhold', 'player')!;
    a.troops.push(makeTroop(s, 'militia'), makeTroop(s, 'militia'));
    // Preserve enough population for recruitment, while the existing army is already beyond support.
    s.towns.aldenhold.pop = 600;
    a.troops[1].men = 10;
    const before = JSON.stringify(s);
    expect(recruit(s, 'aldenhold', 'militia')).toMatch(/Army support/);
    expect(hireHero(s, s.offers[0])).toMatch(/Army support/);
    expect(recruitReplacements(s, a.troops[1].id, 10)).toMatch(/Army support/);
    expect(JSON.stringify(s)).toBe(before);
    expect(parseSave(before).armies).toEqual(s.armies);
  });
  it('completed improvements and population growth open more support places', () => {
    const s = newGame(1); s.gold = 10000;
    const before = armySupport(s).capacity;
    expect(buildCity(s, 'aldenhold', 'lumber')).toBeNull();
    expect(armySupport(s).capacity).toBe(before);
    advanceCities(s);
    expect(armySupport(s).capacity).toBe(before + 10);
    s.towns.aldenhold.pop += 400;
    expect(armySupport(s).capacity).toBe(before + 30);
    expect(cityArmySupport(s, s.towns.fenwick)).toBe(0);
  });
  it('lets a city retain more than 24 units, but refuses to march more than 24', () => {
    const s = newGame(1, 'western-realm'), a = s.armies.find(a => a.owner === 'player')!;
    while (a.troops.length < 25) a.troops.push(makeTroop(s, 'militia'));
    for (const t of a.troops) t.mp = 12;
    const next = neighborsOf(s, a.at).find(to => !marchQuote(s, a.at, [a.troops[0].id], to).reason)!;
    expect(marchQuote(s, a.at, a.troops.map(t => t.id), next).reason).toMatch(/at most 24/);
    expect(moveTroops(s, a.at, a.troops.slice(0, ARMY_CAP).map(t => t.id), next)).toBeNull();
    expect(a.troops).toHaveLength(1);
    expect(parseSave(JSON.stringify(s)).armies.some(a => a.troops.length === 24)).toBe(true);
  });
  it('allows a marching army to join a city garrison that already exceeds 24 units', () => {
    const s = newGame(1), city = armyAt(s, 'aldenhold', 'player')!;
    while (city.troops.length < 30) city.troops.push(makeTroop(s, 'militia'));
    const incoming = { id: s.nextId++, owner: 'player' as const, at: 'bridge', from: null, troops: [makeTroop(s, 'militia')] };
    s.armies.push(incoming);
    expect(moveTroops(s, incoming.at, incoming.troops.map(t => t.id), city.at)).toBeNull();
    expect(city.troops).toHaveLength(31);
    expect(parseSave(JSON.stringify(s)).armies.find(a => a.id === city.id)!.troops).toHaveLength(31);
  });
});

describe('uncapped development and growth overview', () => {
  it('builds beyond level two and saves all four industries with high levels', () => {
    const s = newGame(1); s.gold = 10000;
    const c = s.cityEconomies.aldenhold; c.goods.timber = 500; c.goods.ore = 500;
    c.buildings = { farm: 5, lumber: 4, mine: 3, forge: 2 };
    expect(buildCity(s, 'aldenhold', 'forge')).toBeNull();
    const restored = parseSave(JSON.stringify(s)); advanceCities(restored);
    expect(restored.cityEconomies.aldenhold.buildings.forge).toBe(3);
    expect(parseSave(JSON.stringify(restored)).cityEconomies.aldenhold.buildings.farm).toBe(5);
  });
  it('quotes every material shortage alongside available amounts without partial spending', () => {
    const s = newGame(1); s.gold = 2;
    s.cityEconomies.aldenhold.goods.timber = 1;
    s.cityEconomies.aldenhold.goods.ore = 0;
    const before = JSON.stringify(s);
    const q = constructionQuote(s, 'aldenhold', 'forge');
    expect(q.reason).toContain('timber: need 8, have 1 (short 7)');
    expect(q.reason).toContain('ore: need 3, have 0 (short 3)');
    expect(q.reason).toContain('gold: need 180, have 2 (short 178)');
    expect(buildCity(s, 'aldenhold', 'forge')).toBe(q.reason);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('lists owned cities, population and specific next steps that react to food and tax', () => {
    const s = newGame(1); s.towns.aldenhold.tax = 40;
    s.cityEconomies.aldenhold.goods.food = 0;
    const html = renderCitySummary(s);
    expect(html).toContain('3,000'); expect(html).toContain('1,600');
    expect(html).toContain('Lower taxes below 25%'); expect(html).toContain('Secure food for growth');
    expect(html).toContain('data-action="summary-city"');
    expect(html).not.toContain('Open Fenwick');
    expect(cityGrowthAdvice(s, s.towns.aldenhold).length).toBeLessThanOrEqual(3);
  });
});
