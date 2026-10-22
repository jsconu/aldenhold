import { deed, nodeName } from './campaign';
import { BUILDINGS } from './cities';
import { knockDown } from './raids';
import { random } from './rng';
import type { Army, GameState, Season, WeatherKind } from './types';
import { hasPassage } from './diplomacy';
import { heroMaxHp, isHero } from './units';
import { townAt, townLocation, worldOf } from './world';

/**
 * Seasons and weather (in the spirit of the original's random weather and deadly winters). Each month has one
 * season, from its place in the year, and one weather for the whole realm, rolled from the seeded RNG when the
 * month begins:
 * - rain and storms slow marching, snow halves it, and in a blizzard nobody marches at all;
 * - in rain, storms and snow, your armies out in the open (not in your own or an allied town) lose men at month end;
 *   setting up camp halves the loss but ends the army's march for the month (the weather slows the orcs too, but
 *   they are hardened to it, so their invasions stay a threat);
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
  /** Share of men lost at month end by your armies out in the open (half that if they camped). */
  exposure: number;
  /** One line for the player: what it does. */
  text: string;
}

export const WEATHER: Record<WeatherKind, WeatherRule> = {
  clear: { name: 'Clear', march: 1, exposure: 0, text: 'Good marching weather.' },
  rain: { name: 'Rain', march: 0.75, exposure: 0.03, text: 'Muddy roads: troops have three quarters of their movement. Armies in the open lose 3% of their men at month end.' },
  storm: { name: 'Storm', march: 0.75, exposure: 0.05, text: 'A storm: troops have three quarters of their movement, armies in the open lose 5% of their men at month end, and it may strike one of your towns.' },
  snow: { name: 'Snow', march: 0.5, exposure: 0.1, text: 'Snow: troops have half their movement. Armies in the open lose 10% of their men at month end.' },
  blizzard: { name: 'Blizzard', march: 0, exposure: 0.2, text: 'Blizzard: nobody can march. Armies in the open lose 20% of their men at month end.' },
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

/** Whether one of your armies at `at` is sheltered from the weather: in one of your towns, or a town that gives you passage. */
export function sheltered(state: GameState, at: string): boolean {
  const town = townAt(state, at);
  return !!town && (town.owner === 'player' || hasPassage(state, 'player', town.id));
}

/** The share of its men one of your armies loses to this month's weather: 0 under shelter, half if camped. */
export function exposureLoss(state: GameState, army: Army): number {
  const { rule } = currentWeather(state);
  if (!rule.exposure || sheltered(state, army.at)) return 0;
  return army.campTurn === state.turn ? rule.exposure / 2 : rule.exposure;
}

/**
 * Whether an army can set up camp: one of yours, out in the open in weather that costs men, not camped yet. Camp
 * ends its march for the month and halves what the weather costs it (`loss`).
 */
export function campQuote(state: GameState, armyId: number): { reason: string | null; loss: number } {
  const army = state.armies.find((a) => a.id === armyId && a.owner === 'player');
  if (!army || state.battle || state.status !== 'playing') return { reason: 'Not now.', loss: 0 };
  if (sheltered(state, army.at)) return { reason: 'This army is already sheltered in a town.', loss: 0 };
  const { rule } = currentWeather(state);
  if (!rule.exposure) return { reason: 'No need to camp in this weather.', loss: 0 };
  if (army.campTurn === state.turn) return { reason: 'This army has already made camp this month.', loss: 0 };
  return { reason: null, loss: rule.exposure / 2 };
}

export function makeCamp(state: GameState, armyId: number): string | null {
  const quote = campQuote(state, armyId);
  if (quote.reason) return quote.reason;
  const army = state.armies.find((a) => a.id === armyId)!;
  army.campTurn = state.turn;
  for (const t of army.troops) t.mp = 0;
  return null;
}

/**
 * The month that just ended takes its toll: in rain, storms and snow, each of your armies in the open loses men
 * (half as many if it camped). Soldiers can die of it; heroes are worn down but never below 1 HP. Returns the news.
 */
export function weatherToll(state: GameState): string[] {
  const { rule } = currentWeather(state);
  if (!rule.exposure) return [];
  const news: string[] = [];
  for (const army of state.armies.filter((a) => a.owner === 'player')) {
    const rate = exposureLoss(state, army);
    if (!rate) continue;
    const camped = army.campTurn === state.turn;
    let lost = 0;
    for (const t of army.troops) {
      if (isHero(t.type)) {
        t.men = Math.max(1, t.men - Math.ceil(heroMaxHp(t.type, t.xp) * rate));
        continue;
      }
      // Snow and blizzards always cost a formation at least one man, so they can finish off a small party.
      const gone = Math.min(t.men, Math.max(Math.round(t.men * rate), rate >= 0.1 ? 1 : 0));
      lost += gone;
      t.men -= gone;
    }
    army.troops = army.troops.filter((t) => t.men > 0);
    if (!army.troops.length) state.armies = state.armies.filter((a) => a !== army);
    if (lost) {
      const where = nodeName(state, army.at);
      deed(state, 'loss', `The ${rule.name.toLowerCase()} cost ${lost} of your men at ${where}${camped ? ' (in camp)' : ''}${army.troops.length ? '' : '; none survived'}.`, army.at);
      news.push(`${rule.name}: ${lost} men lost in the open at ${where}.`);
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
