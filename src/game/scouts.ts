import { deed, nodeName } from './campaign';
import { hexDistance } from './hex';
import { stepCost, hasRoad, townAt } from './world';
import type { Army, GameState } from './types';

/** A scout keeps its post only while its army remains at the assigned location. */
export function assignScout(state: GameState, troopId: number, post: 'city' | 'road' | 'recall'): string | null {
  if (state.battle || state.status !== 'playing') return 'Not during a battle.';
  const army = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.id === troopId && t.type === 'scout'));
  if (!army) return 'That scout is not here.';
  const scout = army.troops.find((t) => t.id === troopId)!;
  if (post === 'recall') { delete scout.scoutPost; return null; }
  if (post === 'city' && townAt(state, army.at)?.owner !== 'player') return 'City watch requires a friendly city.';
  if (post === 'road' && !hasRoad(state, army.at)) return 'Road posts must stand on a road hex.';
  scout.scoutPost = post;
  return null;
}

/** Observe an orc army's planned route before it moves. Each scout/army/target combination reports once. */
export function observeOrcRoutes(state: GameState, army: Army, route: string[]): void {
  if (!route.length || army.owner !== 'orcs') return;
  const goal = route.at(-1)!;
  const town = townAt(state, goal);
  const pace = Math.min(...army.troops.map((t) => t.mp || 1));
  const cost = route.reduce((sum, at) => sum + stepCost(state, at), 0);
  const months = Math.max(1, Math.ceil(cost / pace));
  const reports = state.scoutReports ?? (state.scoutReports = []);
  for (const watcher of state.armies.filter((a) => a.owner === 'player')) {
    for (const scout of watcher.troops.filter((t) => t.type === 'scout' && t.scoutPost)) {
      const [watchCol, watchRow] = watcher.at.split(',').map(Number);
      const crossing = route.findIndex((at) => {
        const [col, row] = at.split(',').map(Number);
        return hexDistance({ col, row }, { col: watchCol, row: watchRow }) <= 1;
      });
      const road = scout.scoutPost === 'road' && crossing >= 0;
      const city = scout.scoutPost === 'city' && town?.owner === 'player' && watcher.at === goal;
      // The road post sees an approach within this month's march, not an army on a distant future road.
      if (!(road && cost <= 3 * pace && route.slice(0, crossing + 1).reduce((sum, at) => sum + stepCost(state, at), 0) <= pace) &&
        !(city && cost <= 2 * pace)) continue;
      const key = `${army.id}:${scout.id}:${goal}`;
      if (reports.includes(key)) continue;
      reports.push(key);
      const destination = town ? nodeName(state, goal) : 'the road ahead';
      const when = months;
      deed(state, 'realm', `Scout at ${nodeName(state, watcher.at)} reports an orc force moving toward ${destination}; it may arrive in about ${when} ${when === 1 ? 'month' : 'months'}.`, goal);
    }
  }
}
