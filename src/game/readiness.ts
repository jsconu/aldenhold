import { UNIT_TYPES } from './data';
import type { GameState, Town, Troop } from './types';
import { isHero } from './units';
import { currentWeather, sheltered } from './weather';
import { townLocation } from './world';

/** Missing fields keep older saves at full morale and no unrest. */
export const campaignMorale = (troop: Troop): number => troop.campaignMorale ?? 100;
export const townUnrest = (town: Town): number => town.unrest ?? 0;

/** A bad-weather march strains each soldier unit once per month, even if its route is clicked in stages. */
export function marchMorale(state: GameState, troops: Troop[]) {
  const loss = { clear: 0, rain: 4, storm: 6, snow: 10, blizzard: 15 }[currentWeather(state).kind];
  if (!loss) return;
  for (const troop of troops) {
    if (isHero(troop.type) || troop.moraleMarchTurn === state.turn) continue;
    troop.campaignMorale = Math.max(0, campaignMorale(troop) - loss);
    troop.moraleMarchTurn = state.turn;
  }
}

export function unrestOutlook(state: GameState, town: Town): { change: number; reasons: string[] } {
  const reasons: string[] = [];
  let change = -3;
  if (town.tax > 25) { change += Math.ceil((town.tax - 25) / 5); reasons.push('high taxes'); }
  const garrison = state.armies.some((a) => a.owner === 'player' && a.at === townLocation(state, town.id)
    && a.troops.some((t) => t.men > 0 && t.type !== 'scout' && t.type !== 'spy'));
  if (!garrison) { change += 4; reasons.push('no garrison'); }
  if ((state.cityEconomies[town.id]?.lastMonth?.unmetFood ?? 0) > 0) {
    change += 8; reasons.push('food shortage');
  }
  return { change, reasons };
}

/** Runs once in the month pipeline, after food consumption and weather losses, before the calendar changes. */
export function advanceReadiness(state: GameState): string[] {
  const notes: string[] = [];
  for (const army of state.armies.filter((a) => a.owner === 'player')) {
    const priest = army.troops.some((t) => t.men > 0 && ['priest', 'rulerPriest'].includes(t.type));
    const recovery = (sheltered(state, army.at) ? 10 : currentWeather(state).kind === 'clear' ? 2 : 0) + (priest ? 5 : 0);
    for (const troop of army.troops) {
      if (isHero(troop.type)) continue;
      const before = campaignMorale(troop);
      troop.campaignMorale = Math.min(100, before + recovery);
      if (before < 50 && troop.campaignMorale >= 50) notes.push(`${UNIT_TYPES[troop.type].name} have recovered from low campaign morale.`);
    }
  }
  for (const town of Object.values(state.towns)) {
    if (town.owner !== 'player' || town.kind === 'lair') continue;
    const before = townUnrest(town), outlook = unrestOutlook(state, town);
    town.unrest = Math.max(0, Math.min(100, before + outlook.change));
    if (town.unrest > before) notes.push(`${state.nodes.find((n) => n.id === town.id)?.name ?? town.id}: unrest rises to ${town.unrest}/100 (${outlook.reasons.join(', ')}).`);
    else if (before >= 50 && town.unrest < 50) notes.push(`${town.id}: unrest has fallen below 50.`);
  }
  return notes;
}
