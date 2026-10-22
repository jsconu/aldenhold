import { deed, nodeName } from './campaign';
import { BUILDINGS } from './cities';
import { knockDown } from './raids';
import { random } from './rng';
import type { GameState, Season, WeatherKind } from './types';
import { hasPassage } from './diplomacy';
import { heroMaxHp, isHero } from './units';
import { townAt, townLocation, worldOf } from './world';

/**
 * Seasons and weather (in the spirit of the original's random weather and deadly winters). Each month has one
 * season, from its place in the year, and one weather for the whole realm, rolled from the seeded RNG when the
 * month begins:
 * - rain and storms slow marching, snow halves it, and in a blizzard nobody marches at all;
 * - at the end of a snowy month, your armies out in the cold (not in your own or an allied town) lose men (the weather
 *   slows the orcs too, but they are hardened to it, so their invasions stay a threat);
 * - a storm strikes one of your towns: food spoiled, people lost, sometimes a building damaged.
 * The first months of a campaign are always clear, so a new game isn't snowed in.
 */

/** Months 1 and 2 of a campaign are always clear. */
export const WEATHER_GRACE_TURN = 3;

export function seasonOf(turn: number): Season {
  const month = (turn - 1) % 12;
  return month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn';
}

export const SEASON_NAME: Record<Season, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };

export interface WeatherRule {
  name: string;
  /** Share of a troop's usual movement it has this month. */
  march: number;
  /** Share of men lost at month end by armies out in the cold. */
  cold: number;
  /** One line for the player: what it does. */
  text: string;
}

export const WEATHER: Record<WeatherKind, WeatherRule> = {
  clear: { name: 'Clear', march: 1, cold: 0, text: 'Good marching weather.' },
  rain: { name: 'Rain', march: 0.75, cold: 0, text: 'Muddy roads: troops have three quarters of their movement.' },
  storm: { name: 'Storm', march: 0.75, cold: 0, text: 'A storm: troops have three quarters of their movement, and it may strike one of your towns.' },
  snow: { name: 'Snow', march: 0.5, cold: 0.1, text: 'Snow: troops have half their movement, and armies outside your own or allied towns lose a tenth of their men at month end.' },
  blizzard: { name: 'Blizzard', march: 0, cold: 0.2, text: 'Blizzard: nobody can march, and armies outside your own or allied towns lose a fifth of their men at month end.' },
};

/** Weather odds by season (they sum to 1). */
const ODDS: Record<Season, [WeatherKind, number][]> = {
  spring: [['clear', 0.55], ['rain', 0.35], ['storm', 0.1]],
  summer: [['clear', 0.75], ['rain', 0.15], ['storm', 0.1]],
  autumn: [['clear', 0.45], ['rain', 0.35], ['storm', 0.2]],
  winter: [['clear', 0.25], ['snow', 0.55], ['blizzard', 0.2]],
};

/** This month's weather and season. */
export function currentWeather(state: GameState): { season: Season; kind: WeatherKind; rule: WeatherRule } {
  const kind = state.weather?.turn === state.turn ? state.weather.kind : 'clear';
  return { season: seasonOf(state.turn), kind, rule: WEATHER[kind] };
}

/** A troop's movement for this month, given the weather. On the valley map a march is all or nothing. */
export function weatherMarch(state: GameState, full: number): number {
  const factor = currentWeather(state).rule.march;
  if (worldOf(state).kind === 'graph') return factor > 0 ? full : 0;
  return Math.floor(full * factor);
}

/** Whether one of your armies at `at` is sheltered from the cold: in one of your towns, or a town that gives you passage. */
export function sheltered(state: GameState, at: string): boolean {
  const town = townAt(state, at);
  return !!town && (town.owner === 'player' || hasPassage(state, 'player', town.id));
}

/**
 * The month that just ended takes its toll: in snow or a blizzard, every army out in the cold loses men. Soldiers
 * can die of it; heroes are worn down but never below 1 HP. Returns the news for your own armies.
 */
export function winterToll(state: GameState): string[] {
  const { rule } = currentWeather(state);
  if (!rule.cold) return [];
  const news: string[] = [];
  for (const army of state.armies.filter((a) => a.owner === 'player')) {
    if (sheltered(state, army.at)) continue;
    let lost = 0;
    for (const t of army.troops) {
      if (isHero(t.type)) {
        t.men = Math.max(1, t.men - Math.ceil(heroMaxHp(t.type, t.xp) * rule.cold));
        continue;
      }
      const left = Math.floor(t.men * (1 - rule.cold));
      lost += t.men - left;
      t.men = left;
    }
    army.troops = army.troops.filter((t) => t.men > 0);
    if (!army.troops.length) state.armies = state.armies.filter((a) => a !== army);
    if (lost) {
      const where = nodeName(state, army.at);
      deed(state, 'loss', `The cold took ${lost} of your men at ${where}${army.troops.length ? '' : '; none survived'}.`, army.at);
      news.push(`Winter: ${lost} men lost to the cold at ${where}.`);
    }
  }
  return news;
}

/** Roll the new month's weather. A storm strikes one of your towns. Returns the news. */
export function rollWeather(state: GameState): string[] {
  const season = seasonOf(state.turn);
  let kind: WeatherKind = 'clear';
  const sky = state.weather;
  if (state.turn >= WEATHER_GRACE_TURN) {
    const roll = random(sky);
    let sum = 0;
    kind = ODDS[season].find(([, p]) => (sum += p) > roll)?.[0] ?? 'clear';
  }
  state.weather = { kind, turn: state.turn, seed: sky.seed };
  const news = [`${SEASON_NAME[season]}: ${WEATHER[kind].name.toLowerCase()}. ${WEATHER[kind].text}`];
  if (kind === 'storm') news.push(...storm(state));
  return news;
}

/** A storm hits one of your towns: a fifth of its stored food spoils, some people leave, and it may lose a building. */
function storm(state: GameState): string[] {
  const towns = Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair');
  if (!towns.length) return [];
  const town = towns[Math.floor(random(state.weather) * towns.length)];
  const city = state.cityEconomies[town.id];
  const food = city ? Math.floor(city.goods.food / 5) : 0;
  if (city) city.goods.food -= food;
  const people = Math.min(Math.max(0, town.pop - 100), Math.round(town.pop * 0.03));
  town.pop -= people;
  const damaged = random(state.weather) < 1 / 3 ? knockDown(state, town.id, ['farm']) : null;
  const name = nodeName(state, town.id);
  const parts = [food ? `${food} food spoiled` : '', people ? `${people} people left` : '', damaged ? `the ${BUILDINGS[damaged].name.toLowerCase()} lost a level` : ''].filter(Boolean);
  deed(state, 'loss', `A storm battered ${name}${parts.length ? `: ${parts.join(', ')}` : ''}.`, townLocation(state, town.id));
  return [`A storm struck ${name}.`];
}
