import { describe, expect, it } from 'vitest';
import { alive, attackOrder, autoResolve, build, castSpell, createBattle, defenseOf, runAI } from './battle';
import { applyBattle, armyAt, makeTroop, moveTroops, newGame } from './campaign';
import { beginCityCombat, cityBuildingAt, cityBuildingDefense, cityTreasuryMoney, cityDeploymentCells, openCityWalls, pillageCityBuilding, placeCityDefender, prepareCityBattle } from './cityBattle';
import { parseSave } from './saves';
import { battleSpoils } from './battleRewards';
import { renderBattle } from '../ui/battleView';
import type { UIState } from '../ui/shared';

const ui: UIState = { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
function assault(defending = false) {
  const s = newGame(1), a = armyAt(s, defending ? 'pass' : 'aldenhold')!, d = armyAt(s, defending ? 'aldenhold' : 'fenwick')!;
  const at = defending ? 'aldenhold' : 'fenwick'; a.at = at; a.from = defending ? 'bridge' : 'aldenhold';
  s.cityEconomies[at].buildings = { farm: 3, lumber: 2, mine: 1, forge: 2 };
  const b = createBattle(at, a, d, true, 5); prepareCityBattle(b, s.towns[at], s.cityEconomies[at].buildings, cityTreasuryMoney(s, s.towns[at])); s.battle = b;
  return { s, a, d, b };
}
describe('settlement battlefields', () => {
  it('actually starts a city layout from the campaign attack command, with more buildings after development', () => {
    const s = newGame(1, 'western-realm'), a = s.armies.find(a => a.owner === 'player')!;
    a.at = '7,7'; for (const t of a.troops) t.mp = 20;
    expect(moveTroops(s, a.at, a.troops.map(t => t.id), '8,7')).toBeNull();
    expect(s.battle?.city?.town).toBe('fenwick');
    const { s: rich, b } = assault();
    expect(b.terrain[16].filter(t => t === 'rocks')).toHaveLength(17);
    expect(b.terrain[16][10]).toBe('plain');
    expect(alive(b, 'defender').every(u => cityBuildingAt(b, u))).toBe(true);
    const poor = createBattle(b.at, armyAt(rich, b.at, 'player')!, armyAt(rich, b.at, 'neutral')!, true, 5);
    prepareCityBattle(poor, rich.towns.fenwick, { farm: 1, lumber: 0, mine: 0, forge: 0 });
    expect(b.city!.buildings.length).toBeGreaterThan(poor.city!.buildings.length);
    expect(parseSave(JSON.stringify(rich)).battle?.city).toEqual(b.city);
    const html = renderBattle(rich, ui); expect(html).toContain('city-battle-art'); expect(html).toContain('Town treasury');
    b.walls = false; openCityWalls(b); expect(b.terrain[16].every(t => t === 'plain')).toBe(true);
  });
  it('lets a player place defenders without spending actions, saves placement, then runs the attackers', () => {
    const { s, b } = assault(true), u = alive(b, 'defender')[0];
    expect(b.city!.deploying).toBe(true);
    const before = JSON.stringify(b); runAI(b); expect(JSON.stringify(b)).toBe(before);
    expect(attackOrder(b, alive(b, 'attacker')[0].id, u.id)).toBe(false);
    expect(castSpell(b, u.id, 'fireball', alive(b, 'attacker')[0].id)).toBe(false);
    expect(build(b, u.id, 'fort')).toBe(false);
    const empty = cityDeploymentCells(b).find(h => !alive(b).some(x => x.col === h.col && x.row === h.row))!;
    expect(placeCityDefender(b, u.id, { col: 1, row: 1 })).toBe(false);
    expect(placeCityDefender(b, u.id, empty)).toBe(true);
    expect(u.moved || u.acted).toBe(false);
    const restored = parseSave(JSON.stringify(s));
    expect(restored.battle!.city!.deploying).toBe(true);
    expect(renderBattle(restored, { ...ui, battleUnit: u.id })).toContain('Begin city assault');
    beginCityCombat(restored.battle!);
    expect(restored.battle!.city!.deploying).toBe(false);
    expect(restored.battle!.active === 'defender' || restored.battle!.outcome !== null).toBe(true);
  });
  it('gives occupying units real cover and permanently removes a level when pillaged, once after reload', () => {
    const { s, b } = assault(), u = alive(b, 'attacker')[0];
    const site = b.city!.buildings.find(x => x.kind === 'forge')!;
    const occupant = alive(b).find(x => x.col === site.col && x.row === site.row);
    if (occupant) { occupant.col = 23; occupant.row = 2; }
    Object.assign(u, { col: site.col, row: site.row });
    const covered = defenseOf(b, u); expect(cityBuildingDefense(b, u)).toBeGreaterThan(0);
    expect(pillageCityBuilding(b, u.id)).toBe(true);
    expect(pillageCityBuilding(b, u.id)).toBe(false);
    expect(defenseOf(b, u)).toBeLessThan(covered);
    b.outcome = 'defender'; b.retreated = 'attacker';
    const loaded = parseSave(JSON.stringify(s)), battle = loaded.battle!;
    const level = loaded.cityEconomies.fenwick.buildings.forge;
    applyBattle(loaded, battle); expect(loaded.cityEconomies.fenwick.buildings.forge).toBe(level - 1);
    const after = JSON.stringify(loaded); applyBattle(loaded, battle); expect(JSON.stringify(loaded)).toBe(after);
    expect(parseSave(after).cityEconomies.fenwick.buildings.forge).toBe(level - 1);
  });
  it('takes city money once even on a surviving retreat and records the receipt', () => {
    const { s, b } = assault(), u = alive(b, 'attacker')[0];
    const treasury = b.city!.buildings.find(x => x.kind === 'treasury')!;
    const occupant = alive(b).find(x => x.col === treasury.col && x.row === treasury.row);
    if (occupant) { occupant.col = 24; occupant.row = 1; }
    Object.assign(u, { col: treasury.col, row: treasury.row });
    expect(pillageCityBuilding(b, u.id)).toBe(true);
    b.outcome = 'defender'; b.retreated = 'attacker';
    const stale = structuredClone(b);
    const gold = s.gold; applyBattle(s, b); expect(s.gold).toBe(gold + b.city!.money);
    expect(s.treasury.pending.some(e => e.actionId.endsWith(':pillage') && e.amount === b.city!.money)).toBe(true);
    applyBattle(s, b); applyBattle(s, stale); expect(s.gold).toBe(gold + b.city!.money);
    expect(cityTreasuryMoney(s, s.towns.fenwick)).toBe(0);
    s.turn++; expect(cityTreasuryMoney(s, s.towns.fenwick)).toBeGreaterThan(0);
  });
  it('auto-resolves settlement fights and keeps both sides to 24 deployed units', () => {
    const { s, a, d, b } = assault(true);
    while (d.troops.length < 28) d.troops.push(makeTroop(s, 'militia'));
    const large = createBattle(b.at, a, d, false, 5); prepareCityBattle(large, s.towns.aldenhold, s.cityEconomies.aldenhold.buildings);
    expect(alive(large, 'defender')).toHaveLength(24);
    autoResolve(large); expect(large.outcome).not.toBeNull();
  });
  it('records enemy treasury pillage as a bounded loss and keeps its cooldown after reload', () => {
    const { s, b } = assault(true), u = alive(b, 'attacker')[0];
    b.city!.deploying = false;
    const site = b.city!.buildings.find(x => x.kind === 'treasury')!;
    const occupant = alive(b).find(x => x.col === site.col && x.row === site.row)!;
    occupant.col = 23; occupant.row = 2;
    Object.assign(u, { col: site.col, row: site.row });
    expect(pillageCityBuilding(b, u.id)).toBe(true);
    b.outcome = 'defender'; b.retreated = 'attacker';
    const gold = s.gold, loot = b.city!.money, spoils = battleSpoils(b);
    const restored = parseSave(JSON.stringify(s)); applyBattle(restored, restored.battle!);
    expect(restored.gold).toBe(gold - loot + spoils);
    expect(restored.treasury.pending.filter(e => e.actionId.endsWith(':pillage')).map(e => e.amount)).toEqual([-loot]);
    expect(parseSave(JSON.stringify(restored)).cityEconomies.aldenhold.lastTreasuryPillage).toBe(s.turn);
  });
});
