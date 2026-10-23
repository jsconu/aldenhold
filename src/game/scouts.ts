import { deed, nodeName } from './campaign';
import { hexDistance } from './hex';
import { parseKey, stepCost, townAt, worldOf } from './world';
import type { Army, GameState, Troop, ScoutContact } from './types';

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

/** Advance warnings require a living scout on watch near the observed force, not just any scout in the realm. */
export function scoutSees(state: GameState, at: string): boolean {
  return state.armies.some((army) => army.owner === 'player' && inSight(state, army.at, at)
    && army.troops.some((troop) => troop.men > 0 && onWatch(troop)));
}

/** A scout keeps watch where it stands until it marches or is recalled. */
export function assignScout(state: GameState, troopId: number, post: 'watch' | 'recall'): string | null {
  if (state.battle || state.status !== 'playing') return 'Not during a battle.';
  const army = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.id === troopId && t.type === 'scout'));
  if (!army) return 'That scout is not here.';
  const scout = army.troops.find((t) => t.id === troopId)!;
  if (post === 'recall') delete scout.scoutPost;
  else scout.scoutPost = 'watch';
  refreshScoutContacts(state);
  return null;
}

/** Report visible hostile armies. Routes beyond sight do not grant advance knowledge. */
export function observeOrcRoutes(state: GameState, army: Army, route: string[]): void {
  if (!route.length || (army.owner !== 'orcs' && !army.cityRaid)) return;
  const goal = route.at(-1)!;
  const town = townAt(state, goal);
  const pace = Math.min(...army.troops.map((t) => t.mp));
  const cost = route.reduce((sum, at) => sum + stepCost(state, at), 0);
  const months = pace > 0 ? Math.max(1, Math.ceil(cost / pace)) : null;
  const arrivalTurn = months === null ? null : state.turn + months - 1;
  const reports = state.scoutReports ?? (state.scoutReports = []);
  for (const watcher of state.armies.filter((a) => a.owner === 'player')) {
    for (const scout of watcher.troops.filter(onWatch)) {
      if (!inSight(state, watcher.at, army.at)) continue;
      const key = `${army.id}:${scout.id}:${goal}`;
      const contacts = state.scoutContacts ??= [];
      const prior = contacts.find(c => c.armyId === army.id && c.scoutId === scout.id);
      const changed = !prior || !prior.active || prior.post !== watcher.at || prior.destination !== goal || prior.arrivalTurn !== arrivalTurn;
      const observation: ScoutContact = {armyId:army.id, scoutId:scout.id, post:watcher.at, destination:goal, seenTurn:state.turn, arrivalTurn, active:true};
      if (prior) Object.assign(prior, observation); else contacts.push(observation);
      if (!changed) continue;
      // Upgrade old deduplication-only saves without repeating an unchanged historical report.
      const legacy = !prior && reports.includes(key);
      if (!reports.includes(key)) reports.push(key);
      if (legacy) continue;
      const destination = town ? nodeName(state, goal) : 'the road ahead';
      const force = army.cityRaid ? 'a rival city force' : 'an orc force';
      deed(state, 'realm', `Scout at ${nodeName(state, watcher.at)} reports ${force} moving toward ${destination} (estimated destination); ${months === null ? "movement is halted; arrival unknown" : `estimated arrival month ${arrivalTurn} (about ${months} ${months === 1 ? "month" : "months"})`}.`, goal);
    }
  }
}

/** Derive confidence from current visibility; never reveal why an unseen force disappeared. */
export function scoutContactStatus(state: GameState, contact: ScoutContact): 'current' | 'watch-ended' | 'lost' {
  const watcher = state.armies.find(a => a.owner === 'player' && a.at === contact.post && a.troops.some(t => t.id === contact.scoutId && onWatch(t)));
  if (!watcher) return 'watch-ended';
  const enemy = state.armies.find(a => a.id === contact.armyId);
  if (!contact.active || !enemy || (enemy.owner !== 'orcs' && !enemy.cityRaid) || !inSight(state, watcher.at, enemy.at) || contact.seenTurn < state.turn - 1) return 'lost';
  return 'current';
}

/** Retire each contact once when observation ends; reacquisition creates a fresh estimate. */
export function refreshScoutContacts(state: GameState): void {
  for (const contact of state.scoutContacts ?? []) {
    if (!contact.active) continue;
    const status = scoutContactStatus(state, contact);
    if (status === 'current') continue;
    contact.active = false;
    deed(state, 'realm', 'Scout at ' + nodeName(state, contact.post) + ': ' + (status === 'watch-ended' ? 'watch ended' : 'contact lost') + '. The previous arrival estimate for ' + nodeName(state, contact.destination) + ' is no longer current.', contact.destination);
  }
}
