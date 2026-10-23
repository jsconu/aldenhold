import { explored } from '../game/challenge';
import type { GameState } from '../game/types';
import { armyAt } from '../game/campaign';
import { townAt } from '../game/world';
import { moveTargets } from './campaignView';
import type { UIState } from './shared';

/**
 * What a click on a map location means:
 * - `route`: picking the destination of a route being planned;
 * - `march`: your selected troops march (or attack) there, because it is lit as reachable, or march mode is on;
 * - `choose`: a town where your troops stand asks whether to move them or open the city screen;
 * - `city`: a known town you aren't marching on opens its city screen;
 * - `select`: anything else selects the location.
 * A lit town is always a march, so a defended town next to your army can be attacked with one click.
 */
export function mapClickIntent(state: GameState, ui: UIState, at: string): 'route' | 'march' | 'choose' | 'city' | 'select' {
  if (ui.routeOrigin && !ui.routeDestination) return 'route';
  if (ui.selected && (ui.marchMode || moveTargets(state, ui).has(at))) return 'march';
  if (townAt(state, at) && armyAt(state, at, 'player')) return 'choose';
  if (explored(state, at) && townAt(state, at) && !ui.routeOrigin) return 'city';
  return 'select';
}
