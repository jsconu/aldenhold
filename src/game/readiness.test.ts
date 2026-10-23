import { describe, expect, it } from 'vitest';
import { advanceMonth, armyAt, makeTroop, moveTroops, newGame, playerMarchOptions, townIncome } from './campaign';
import { createBattle } from './battle';
import { advanceReadiness, campaignMorale, marchMorale, townUnrest, unrestOutlook } from './readiness';
import { parseSave } from './saves';
import { townLocation } from './world';

function setup() {
  const state = newGame(1, 'western-realm');
  const army = armyAt(state, townLocation(state, 'aldenhold'), 'player')!;
  return { state, army, troop: army.troops.find((t) => t.type === 'spearmen')!, town: state.towns.aldenhold };
}

describe('campaign morale', () => {
  it('charges an actual snowy march once per month, leaves heroes untouched, and survives reload', () => {
    const { state, army, troop } = setup();
    state.weather = { ...state.weather, kind: 'snow', turn: state.turn };
    const destination = [...playerMarchOptions(state, army.at, [troop.id]).keys()].find((at) => at !== army.at)!;
    expect(moveTroops(state, army.at, [troop.id], destination)).toBeNull();
    expect(campaignMorale(troop)).toBe(90);
    marchMorale(state, [troop]);
    expect(campaignMorale(troop)).toBe(90);
    const saved = parseSave(JSON.stringify(state));
    const loaded = saved.armies.flatMap((a) => a.troops).find((t) => t.id === troop.id)!;
    marchMorale(saved, [loaded]);
    expect(campaignMorale(loaded)).toBe(90);
    marchMorale(state, [army.troops[0]]);
    expect(campaignMorale(army.troops[0])).toBe(100);
  });

  it('recovers with shelter and priests, including a priest ruler, without exceeding 100', () => {
    for (const type of ['priest', 'rulerPriest']) {
      const { state, army, troop } = setup();
      troop.campaignMorale = 70;
      army.troops.push(makeTroop(state, type, 'Healer'));
      advanceReadiness(state);
      expect(campaignMorale(troop)).toBe(85);
      advanceReadiness(state);
      expect(campaignMorale(troop)).toBe(100);
    }
  });

  it('low readiness lowers starting battle morale while default saves keep the old value', () => {
    const { state, army, troop } = setup();
    const foe = state.armies.find((a) => a.owner === 'orcs')!;
    const normal = createBattle(army.at, army, foe, false, 4).units.find((u) => u.troopId === troop.id)!.morale;
    troop.campaignMorale = 60;
    const tired = createBattle(army.at, army, foe, false, 4).units.find((u) => u.troopId === troop.id)!.morale;
    expect(tired).toBe(normal - 20);
  });
});

describe('town unrest', () => {
  it('responds to high taxes, missing garrisons and actual food shortages, then recovers', () => {
    const { state, army, town } = setup();
    town.tax = 50;
    army.at = '7,7';
    const city = state.cityEconomies.aldenhold;
    city.goods.food = 0;
    city.buildings.farm = 0;
    const report = advanceMonth(state)!;
    expect(city.lastMonth!.unmetFood).toBeGreaterThan(0);
    expect(townUnrest(town)).toBeGreaterThan(0);
    expect(report.phases.find((p) => p.id === 'public-order')!.notes.some((n) => n.text.includes('food shortage'))).toBe(true);
    const before = townUnrest(town);
    town.tax = 15;
    army.at = townLocation(state, town.id);
    city.lastMonth!.unmetFood = 0;
    expect(unrestOutlook(state, town).reasons).toEqual([]);
    advanceReadiness(state);
    expect(townUnrest(town)).toBe(before - 3);
  });

  it('reduces actual tax income, stays bounded, and ignores foreign towns', () => {
    const { state, town } = setup();
    const income = townIncome(town);
    town.unrest = 100;
    expect(townIncome(town)).toBe(Math.floor(income / 2));
    town.tax = 50;
    advanceReadiness(state);
    expect(townUnrest(town)).toBe(100);
    expect(state.towns.fenwick.unrest).toBeUndefined();
    town.unrest = 0;
    town.tax = 0;
    advanceReadiness(state);
    expect(townUnrest(town)).toBe(0);
  });

  it('accepts older saves and round trips new fields, rejecting corrupt morale and unrest', () => {
    const { state, troop, town } = setup();
    expect(campaignMorale(troop)).toBe(100);
    expect(townUnrest(town)).toBe(0);
    expect(parseSave(JSON.stringify(state)).version).toBe(18);
    troop.campaignMorale = 47;
    town.unrest = 28;
    const loaded = parseSave(JSON.stringify(state));
    expect(loaded.towns.aldenhold.unrest).toBe(28);
    expect(loaded.armies.flatMap((a) => a.troops).find((t) => t.id === troop.id)!.campaignMorale).toBe(47);
    troop.campaignMorale = 101;
    expect(() => parseSave(JSON.stringify(state))).toThrow('campaign morale');
    troop.campaignMorale = 100;
    town.unrest = -1;
    expect(() => parseSave(JSON.stringify(state))).toThrow('town unrest');
  });
});
