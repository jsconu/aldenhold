import { deed, nodeName } from './campaign';
import { hexDistance } from './hex';
import { parseKey, stepCost, townAt, worldOf } from './world';
import type { Army, GameState, Troop } from './types';

/** How far a scout on watch sees, in hexes (on the valley map: its own place and the places next to it). */
export const SCOUT_RANGE = 3;

/** Whether this troop is a scout keeping watch. Saves from before the single watch post say 'city' or 'road'. */
export function onWatch(t: Troop): boolean {
  return t.type === 'scout' && !!t.scoutPost;
}

/** Whether `at` is within sight of a scout standing at `from`. */
export function inSight(state: GameState, from: string, at: string): boolean {
  if (worldOf(state).kind === 'hex') return hexDistance(parseKey(from), parseKey(at)) <= SCOUT_RANGE;
  return at === from || state.edges.some(([a, b]) => (a === from && b === at) || (b === from && a === at));
}

/** A scout keeps watch where it stands until it marches or is recalled. */
export function assignScout(state: GameState, troopId: number, post: 'watch' | 'recall'): string | null {
  if (state.battle || state.status !== 'playing') return 'Not during a battle.';
  const army = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.id === troopId && t.type === 'scout'));
  if (!army) return 'That scout is not here.';
  const scout = army.troops.find((t) => t.id === troopId)!;
  if (post === 'recall') delete scout.scoutPost;
  else scout.scoutPost = 'watch';
  return null;
}

/** Report visible hostile armies. Routes beyond sight do not grant advance knowledge. */
export function observeOrcRoutes(state: GameState, army: Army, route: string[]): void {
  if (!route.length || (army.owner !== 'orcs' && !army.cityRaid)) return;
  const goal = route.at(-1)!;
  const town = townAt(state, goal);
  const pace = Math.min(...army.troops.map((t) => t.mp || 1));
  const cost = route.reduce((sum, at) => sum + stepCost(state, at), 0);
  const months = Math.max(1, Math.ceil(cost / pace));
  const reports = state.scoutReports ?? (state.scoutReports = []);
  for (const watcher of state.armies.filter((a) => a.owner === 'player')) {
    for (const scout of watcher.troops.filter(onWatch)) {
      if (!inSight(state, watcher.at, army.at)) continue;
      const key = `${army.id}:${scout.id}:${goal}`;
      if (reports.includes(key)) continue;
      reports.push(key);
      const destination = town ? nodeName(state, goal) : 'the road ahead';
      const force = army.cityRaid ? 'a rival city force' : 'an orc force';
      deed(state, 'realm', `Scout at ${nodeName(state, watcher.at)} reports ${force} moving toward ${destination} (estimated destination); it may arrive in about ${months} ${months === 1 ? 'month' : 'months'}.`, goal);
    }
  }
}
