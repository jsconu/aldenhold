import { describe, expect, it } from 'vitest';
import { BUILDINGS, advanceCities, buildCity, constructionQuote, developmentSites, emptyGoods, initialCityEconomy } from './cities';
import { endTurn, newGame } from './campaign';
import { parseSave } from './saves';

describe('city development and conservation', () => {
  it('starts with local physical stocks and a grandfathered farm', () => {
    const s = newGame(1);
    expect(s.version).toBe(11);
    expect(s.cityEconomies.aldenhold.buildings).toEqual({ farm: 1, lumber: 0, mine: 0, forge: 0 });
    expect(s.cityEconomies.aldenhold.goods.food).toBeGreaterThan(0);
    expect(developmentSites(s.cityEconomies.aldenhold)).toBe(1);
    expect(initialCityEconomy(s.towns.gharzak).buildings.farm).toBe(0);
  });

  it('pays construction costs in full once, and does not finish until after production', () => {
    const s = newGame(1);
    const beforeGold = s.gold;
    const beforeTimber = s.cityEconomies.aldenhold.goods.timber;
    const q = constructionQuote(s, 'aldenhold', 'lumber');
    expect(q.reason).toBeNull();
    expect(buildCity(s, 'aldenhold', 'lumber')).toBeNull();
    expect(s.gold).toBe(beforeGold - q.gold);
    expect(s.cityEconomies.aldenhold.goods.timber).toBe(beforeTimber - q.materials.timber!);
    expect(s.cityEconomies.aldenhold.project?.targetLevel).toBe(1);
    expect(buildCity(s, 'aldenhold', 'mine')).toMatch(/One construction project/);
    expect(s.treasury.pending.filter((e) => e.category === 'construction')).toHaveLength(1);
    endTurn(s);
    expect(s.cityEconomies.aldenhold.buildings.lumber).toBe(1);
    expect(s.cityEconomies.aldenhold.project).toBeNull();
    expect(s.cityEconomies.aldenhold.lastMonth?.produced.timber).toBe(0);
    expect(s.treasury.history[0].entries.filter((e) => e.category === 'construction')).toHaveLength(1);
    endTurn(s);
    expect(s.cityEconomies.aldenhold.lastMonth?.produced.timber).toBeGreaterThan(0);
  });

  it('requires local deposits, development sites and resources; never takes partial payment', () => {
    const s = newGame(1);
    const initialGold = s.gold;
    const initialStock = { ...s.cityEconomies.millbrook.goods };
    expect(buildCity(s, 'millbrook', 'mine')).toMatch(/lacks the required resources/);
    expect(s.gold).toBe(initialGold);
    expect(s.cityEconomies.millbrook.goods).toEqual(initialStock);
    expect(buildCity(s, 'aldenhold', 'forge')).toMatch(/Not enough local construction materials/);
    const city = s.cityEconomies.aldenhold;
    city.buildings.lumber = 1;
    city.buildings.mine = 1;
    expect(buildCity(s, 'aldenhold', 'forge')).toMatch(/No development sites/);
  });

  it('production and civilian consumption conserve local goods and cannot create negative stock', () => {
    const s = newGame(5);
    const city = s.cityEconomies.millbrook;
    const before = city.goods.food;
    const consumption = Math.ceil(s.towns.millbrook.pop / 100);
    advanceCities(s);
    const latest = city.lastMonth!;
    expect(latest.consumedFood).toBe(consumption);
    expect(city.goods.food).toBe(before + latest.produced.food - latest.consumedFood);
    expect(Object.values(city.goods).every((x) => x >= 0)).toBe(true);
    expect(latest.employed).toBeLessThanOrEqual(latest.workforce);
  });

  it('input recipes use beginning-of-month ore and timber, never this month\'s mining', () => {
    const s = newGame(6);
    const city = s.cityEconomies.fenwick;
    city.buildings = { farm: 0, lumber: 1, mine: 1, forge: 1 };
    city.goods = emptyGoods();
    advanceCities(s);
    expect(city.lastMonth!.produced.ore).toBeGreaterThan(0);
    expect(city.lastMonth!.produced.timber).toBeGreaterThan(0);
    expect(city.lastMonth!.produced.tools).toBe(0);
    const afterFirst = { ...city.goods };
    advanceCities(s);
    expect(city.lastMonth!.produced.tools).toBeGreaterThan(0);
    expect(city.lastMonth!.inputs.ore).toBe(city.lastMonth!.produced.tools);
    expect(city.lastMonth!.inputs.timber).toBe(city.lastMonth!.produced.tools);
    expect(city.goods.ore).toBe(afterFirst.ore - city.lastMonth!.inputs.ore + city.lastMonth!.produced.ore);
  });

  it('workforce shortage proportionately reduces an under-staffed farm', () => {
    const s = newGame(1);
    const city = s.cityEconomies.aldenhold;
    s.towns.aldenhold.pop = 100; // 45 workers for a 100-worker farm
    city.goods.food = 100;
    advanceCities(s);
    expect(city.lastMonth!.workforce).toBe(45);
    expect(city.lastMonth!.employed).toBe(45);
    expect(city.lastMonth!.produced.food).toBe(18);
  });

  it('a food shortage is visible and slows population growth, without instant destruction', () => {
    const s = newGame(3);
    const city = s.cityEconomies.aldenhold;
    city.goods.food = 0;
    city.buildings.farm = 0;
    const pop = s.towns.aldenhold.pop;
    endTurn(s);
    expect(city.lastMonth!.unmetFood).toBe(Math.ceil(pop / 100));
    expect(s.towns.aldenhold.pop).toBeGreaterThan(pop - 100);
    expect(s.log.some((m) => m.includes('lacks') && m.includes('food'))).toBe(true);
  });

  it('new levels create upkeep next month and appear in the reconciled treasury ledger', () => {
    const s = newGame(1);
    expect(buildCity(s, 'aldenhold', 'lumber')).toBeNull();
    endTurn(s);
    const first = s.treasury.history.at(-1)!;
    expect(first.entries.filter((e) => e.category === 'maintenance')).toHaveLength(0);
    expect(first.expenses).toBeGreaterThanOrEqual(BUILDINGS.lumber.gold);
    endTurn(s);
    const second = s.treasury.history.at(-1)!;
    expect(second.entries.filter((e) => e.category === 'maintenance')
      .reduce((sum, e) => sum - e.amount, 0)).toBe(BUILDINGS.lumber.upkeep);
    expect(second.opening + second.entries.reduce((sum, e) => sum + e.amount, 0)).toBe(second.closing);
  });

  it('retains investment across conquest and save/load; never recharges completed construction', () => {
    const s = newGame(1);
    buildCity(s, 'aldenhold', 'lumber');
    const unfinished = parseSave(JSON.stringify(s));
    expect(unfinished.cityEconomies.aldenhold.project?.kind).toBe('lumber');
    const first = unfinished.gold;
    endTurn(unfinished);
    expect(unfinished.gold).toBeGreaterThan(first);
    const completed = parseSave(JSON.stringify(unfinished));
    expect(completed.cityEconomies.aldenhold.buildings.lumber).toBe(1);
    completed.towns.aldenhold.owner = 'orcs';
    expect(completed.cityEconomies.aldenhold.buildings.lumber).toBe(1);
  });

  it('migrates a saved v6 cash history without inventing past output or losing the gold ledger', () => {
    const s = newGame(1);
    endTurn(s);
    const { cityEconomies: _cities, ...old } = s;
    const before = { ...old, version: 6, treasury: structuredClone(s.treasury) };
    for (const row of before.treasury.history) delete (row as { unpaidMaintenance?: number }).unpaidMaintenance;
    const migrated = parseSave(JSON.stringify(before));
    expect(migrated.version).toBe(11);
    expect(migrated.treasury.history[0].unpaidMaintenance).toBe(0);
    expect(migrated.treasury.history[0].closing).toBe(s.treasury.history[0].closing);
    expect(migrated.cityEconomies.aldenhold.project).toBeNull();
    expect(migrated.cityEconomies.aldenhold.lastMonth).toBeNull();
  });

  it('rejects tampered materials, invalid projects and out-of-range levels', () => {
    const s = newGame(1);
    buildCity(s, 'aldenhold', 'lumber');
    const broken = structuredClone(s);
    broken.cityEconomies.aldenhold.goods.timber = -5;
    expect(() => parseSave(JSON.stringify(broken))).toThrow(/city goods/);
    broken.cityEconomies.aldenhold.goods.timber = s.cityEconomies.aldenhold.goods.timber;
    broken.cityEconomies.aldenhold.project!.paidGold = 1;
    expect(() => parseSave(JSON.stringify(broken))).toThrow(/city project gold/);
    broken.cityEconomies.aldenhold.project = null;
    broken.cityEconomies.aldenhold.buildings.farm = 3;
    expect(() => parseSave(JSON.stringify(broken))).toThrow(/city buildings/);
  });
});
