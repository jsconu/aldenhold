import { alive, BATTLE_SIZES, deploymentZone, runAI, unitAt } from './battle';
import { BUILDING_IDS, BUILDINGS } from './cities';
import { recordPurchase, recordReceipt } from './economy';
import { hexKey } from './hex';
import type { Hex } from './hex';
import { log, nodeName } from './campaign';
import { UNIT_TYPES } from './data';
import type { Battle, BattleUnit, BuildingLevels, GameState, Town } from './types';

export type CityBuilding = NonNullable<Battle['city']>['buildings'][number];
export function cityBuildingName(site: CityBuilding): string {
  return site.kind === 'homes' ? 'Houses' : site.kind === 'treasury' ? 'Town treasury' : BUILDINGS[site.kind].name;
}
export function cityBuildingAt(b: Battle, h: Hex): CityBuilding | undefined {
  return b.city?.buildings.find(s => s.col === h.col && s.row === h.row);
}
export function cityBuildingDefense(b: Battle, u: BattleUnit): number {
  const site = cityBuildingAt(b, u);
  return !site || site.pillaged ? 0 : Math.min(4, 1 + Math.floor(Math.log2(site.level + 1)));
}
export function cityDeploymentCells(b: Battle): Hex[] {
  const zone = deploymentZone(b, 'defender');
  return zone.cols.flatMap(col => Array.from({ length: 9 }, (_, i) => ({ col, row: zone.top + i })));
}
export function cityTreasuryMoney(state: GameState, town: Town): number {
  if (state.cityEconomies[town.id].lastTreasuryPillage === state.turn) return 0;
  const local = Math.min(500, 50 + Math.floor(town.pop / 10));
  return town.owner === 'player' ? Math.min(local, state.gold) : local;
}
export function openCityWalls(b: Battle): void {
  if (!b.city) return;
  const wall = deploymentZone(b, 'defender').cols[0] - 2;
  b.terrain[wall].fill('plain');
}

/** Streets and gated walls replace random wilderness. Development supplies the defensive positions. */
export function prepareCityBattle(b: Battle, town: Town, levels: BuildingLevels, money = Math.min(500, 50 + Math.floor(town.pop / 10))): void {
  const old = deploymentZone(b, 'attacker');
  b.width = BATTLE_SIZES.major.width; b.height = BATTLE_SIZES.major.height;
  const fresh = deploymentZone(b, 'attacker');
  for (const u of alive(b, 'attacker')) { u.col += fresh.cols[0] - old.cols[0]; u.row += fresh.top - old.top; }
  const zone = deploymentZone(b, 'defender');
  const wall = zone.cols[0] - 2, middle = Math.floor(b.height / 2);
  b.terrain = Array.from({ length: b.width }, (_, col) => Array.from({ length: b.height }, (_, row) =>
    col === wall && b.walls && Math.abs(row - middle) > 1 ? 'rocks' : 'plain'));
  const slots = cityDeploymentCells(b).sort((a, c) => Math.abs(a.row - middle) - Math.abs(c.row - middle) || c.col - a.col);
  const buildings: CityBuilding[] = [];
  const add = (kind: CityBuilding['kind'], level: number) => {
    const at = slots[buildings.length];
    if (at) buildings.push({ ...at, kind, level, pillaged: false });
  };
  add('treasury', 1 + Math.floor(town.pop / 2000));
  for (const kind of BUILDING_IDS) for (let i = 0; i < Math.min(4, Math.ceil(Math.sqrt(levels[kind]))); i++) add(kind, levels[kind]);
  for (let i = 0; i < Math.min(12, 3 + Math.floor(town.pop / 400)); i++) add('homes', 1 + Math.floor(town.pop / 2000));
  b.city = { town: town.id, deploying: b.owners.defender === 'player', money, buildings };
  // Everyone begins on a building when there are enough developed positions; the remaining garrison holds streets.
  const positions = [...buildings, ...slots.filter(s => !buildings.some(p => hexKey(p) === hexKey(s)))];
  alive(b, 'defender').forEach((u, i) => { u.col = positions[i].col; u.row = positions[i].row; });
  b.log.push('City assault: defenders hold buildings inside gated walls. Buildings provide cover to whoever occupies them.');
}

export function placeCityDefender(b: Battle, id: number, to: Hex): boolean {
  const u = b.units.find(x => x.id === id && x.side === 'defender' && !x.reserve && x.men > 0);
  if (!b.city?.deploying || b.outcome || !u || !cityDeploymentCells(b).some(h => hexKey(h) === hexKey(to)) || unitAt(b, to)) return false;
  u.col = to.col; u.row = to.row;
  return true;
}
export function beginCityCombat(b: Battle): void {
  if (!b.city?.deploying) return;
  b.city.deploying = false;
  b.log.push('The city defense is placed. The assault begins.');
  runAI(b);
}

export function pillageReason(b: Battle, u: BattleUnit): string | null {
  const site = cityBuildingAt(b, u);
  if (!b.city || b.city.deploying || b.outcome || b.active !== 'attacker' || u.side !== 'attacker' || u.reserve || u.fled || u.routing || u.men <= 0 || u.acted || UNIT_TYPES[u.type].noncombat) return 'Choose an attacking combat unit with an action remaining.';
  if (!site || site.kind === 'homes') return 'Occupy an improvement or the town treasury to pillage it.';
  if (site.pillaged) return 'This building has already been pillaged.';
  if (site.kind === 'treasury' && !b.city.money) return 'The treasury is empty; local tax money replenishes next month.';
  return null;
}
export function pillageCityBuilding(b: Battle, id: number): boolean {
  const u = b.units.find(x => x.id === id);
  if (!u || pillageReason(b, u)) return false;
  const site = cityBuildingAt(b, u)!;
  site.pillaged = true; u.acted = true; u.moved = true;
  b.log.push(`${cityBuildingName(site)} pillaged: ${site.kind === 'treasury' ? `${b.city!.money} gold taken` : 'one improvement level destroyed'}. Its cover is gone.`);
  return true;
}

/** Called exactly once by battle settlement, including retreats: pillage damage is persistent. */
export function settleCityPillage(state: GameState, b: Battle, actionId: string): void {
  if (!b.city) return;
  const town = state.towns[b.city.town], city = state.cityEconomies[town.id];
  for (const site of b.city.buildings.filter(s => s.pillaged)) {
    log(state, `${nodeName(state, town.id)}: ${cityBuildingName(site)} was pillaged${site.kind === 'treasury' ? '.' : '; one improvement level was destroyed.'}`);
    if (site.kind === 'homes') continue;
    if (site.kind !== 'treasury') {
      city.buildings[site.kind] = Math.max(0, city.buildings[site.kind] - 1);
      if (city.project?.kind === site.kind) city.project = null;
    } else if (b.units.some(u => u.side === 'attacker' && u.men > 0)) {
      city.lastTreasuryPillage = state.turn;
      if (b.owners.attacker === 'player') {
        state.gold += b.city.money;
        recordReceipt(state, town.id, b.city.money, actionId + ':pillage', 'Pillaged city treasury', 'battle-spoils');
      } else if (town.owner === 'player') {
        const lost = Math.min(state.gold, b.city.money); state.gold -= lost;
        if (lost) recordPurchase(state, town.id, 'raid-loss', lost, actionId + ':pillage', 'City treasury pillaged');
      }
    }
  }
}
