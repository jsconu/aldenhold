import { hasPassage } from './diplomacy';
import type { GameState } from './types';

export type RoutePreference = 'shortest' | 'safer';
export type RouteRisk = 'orc garrison' | 'independent militia';
export interface RouteStop { id: string; risk: RouteRisk | null }
export interface RoutePreview {
  stops: RouteStop[];
  /** One named-road leg per campaign month, excluding battles and interruptions. */
  legs: number;
  cost: number;
  preference: RoutePreference;
}

/** Risk uses *known* quick-play garrisons; real scouting/fog is future campaign work. */
export function routeRisk(state: GameState, to: string): RouteRisk | null {
  if (state.towns[to]?.owner === 'orcs' || state.armies.some((a) => a.at === to && a.owner === 'orcs')) {
    return 'orc garrison';
  }
  if (!hasPassage(state, 'player', to) &&
      (state.towns[to]?.owner === 'neutral' || state.armies.some((a) => a.at === to && a.owner === 'neutral'))) {
    return 'independent militia';
  }
  return null;
}

/** Deterministic graph Dijkstra; no movement, time advance or save mutation. */
export function previewRoute(
  state: Pick<GameState, 'nodes' | 'edges'> & GameState,
  from: string,
  to: string,
  preference: RoutePreference = 'shortest',
): RoutePreview | null {
  const names = state.nodes.map((n) => n.id);
  if (!names.includes(from) || !names.includes(to)) return null;
  if (from === to) return { stops: [{ id: from, risk: null }], legs: 0, cost: 0, preference };
  const neighbors = new Map(names.map((id) => [id, [] as string[]]));
  for (const [a, b] of state.edges) {
    neighbors.get(a)?.push(b);
    neighbors.get(b)?.push(a);
  }
  for (const list of neighbors.values()) list.sort();
  const unsettled = new Set(names);
  const scores = new Map(names.map((id) => [id, id === from ? 0 : Infinity]));
  const steps = new Map(names.map((id) => [id, id === from ? 0 : Infinity]));
  const prev = new Map<string, string>();
  while (unsettled.size) {
    const current = [...unsettled].sort((a, b) => (scores.get(a)! - scores.get(b)!) ||
      (steps.get(a)! - steps.get(b)!) || a.localeCompare(b))[0];
    if (!Number.isFinite(scores.get(current)!)) break;
    unsettled.delete(current);
    if (current === to) break;
    for (const next of neighbors.get(current) ?? []) {
      if (!unsettled.has(next)) continue;
      const risk = routeRisk(state, next);
      const extra = preference === 'safer' ? (risk === 'orc garrison' ? 7 : risk ? 3 : 0) : 0;
      const candidate = scores.get(current)! + 1 + extra;
      const candidateLegs = steps.get(current)! + 1;
      if (candidate < scores.get(next)! || (candidate === scores.get(next)! && candidateLegs < steps.get(next)!)) {
        scores.set(next, candidate);
        steps.set(next, candidateLegs);
        prev.set(next, current);
      }
    }
  }
  if (!Number.isFinite(scores.get(to)!)) return null;
  const ids = [to];
  while (ids[0] !== from) {
    const preceding = prev.get(ids[0]);
    if (!preceding) return null;
    ids.unshift(preceding);
  }
  return { stops: ids.map((id, index) => ({ id, risk: index === 0 ? null : routeRisk(state, id) })),
    legs: ids.length - 1, cost: scores.get(to)!, preference };
}
