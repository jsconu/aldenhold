import { UNIT_TYPES } from '../../content/rules';
import { autoResolve } from '../battle';
import { applyBattle, marchQuote, moveTroops, sharedMp, startLocation } from '../campaign';
import { parseSave } from '../saves';
import type { GameState } from '../types';
import { campQuote, currentWeather, makeCamp, sheltered } from '../weather';
import { marchOptions, neighbors, pathTo, stopsMarch } from '../world';

/** Follow a real quoted route, never stepping onto an enemy or taking a town with a diplomatic party. */
export function marchParty(state: GameState, ids: number[], place: string, adjacent = false): string | null {
  const army = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => ids.includes(t.id)));
  if (!army) return null;
  const target = startLocation(state, place);
  const targets = adjacent ? [target, ...neighbors(state, target)] : [target];
  if (targets.includes(army.at)) return null;
  // Like a sensible player, wait out snow and blizzards in a friendly town rather than march into the cold.
  if (currentWeather(state).rule.exposure >= 0.1 && sheltered(state, army.at)) return null;
  const routes = marchOptions(state, army.at, 'player', Infinity);
  const destination = targets.filter((at) => !stopsMarch(state, at, 'player') && routes.has(at))
    .sort((a, b) => routes.get(a)!.cost - routes.get(b)!.cost)[0];
  if (!destination) return null;
  const troops = army.troops.filter((t) => ids.includes(t.id));
  const next = pathTo(routes, destination).filter((at) => routes.get(at)!.cost <= sharedMp(troops)).at(-1);
  if (!next) return null;
  const quote = marchQuote(state, army.at, troops.map((t) => t.id), next);
  if (quote.reason || quote.ends) return null;
  const reason = moveTroops(state, army.at, troops.map((t) => t.id), next);
  if (reason) throw new Error(`Quoted march failed: ${reason}`);
  return next;
}

/** Before the month ends, every army of yours left out in harsh weather sets up camp. */
export function campInTheOpen(state: GameState) {
  for (const army of state.armies.filter((a) => a.owner === 'player')) if (!campQuote(state, army.id).reason) makeCamp(state, army.id);
}

export interface EncounterResult { quest: string; won: boolean; participants: string[] }

/** Strictly import the pending fight and its resolved result before settlement, just as a resumed game does. */
export function resumeBattles(initial: GameState) {
  let state = initial;
  let battles = 0;
  let casualties = 0;
  const encounters: EncounterResult[] = [];
  const soldiers = () => state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops)
    .filter((t) => !UNIT_TYPES[t.type].hero).reduce((sum, t) => sum + t.men, 0);
  while (state.battle) {
    if (++battles > 50) throw new Error('Battle queue did not drain.');
    const before = soldiers();
    state = parseSave(JSON.stringify(state));
    autoResolve(state.battle!);
    state = parseSave(JSON.stringify(state));
    const battle = state.battle!;
    if (battle.encounter) encounters.push({
      quest: battle.encounter.quest,
      won: battle.owners[battle.outcome!] === 'player',
      participants: battle.units.filter((u) => battle.owners[u.side] === 'player').map((u) => u.type),
    });
    applyBattle(state, battle);
    casualties += Math.max(0, before - soldiers());
  }
  return { state, battles, casualties, encounters };
}
