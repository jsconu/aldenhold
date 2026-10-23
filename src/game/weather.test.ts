import { describe, expect, it } from 'vitest';
import { renderBattle } from '../ui/battleView';
import { renderCampaign } from '../ui/campaignView';
import { renderHexMap } from '../ui/hexMapView';
import type { UIState } from '../ui/shared';
import { createBattle } from './battle';
import { advanceMonth, armyAt, makeTroop, newGame } from './campaign';
import { parseSave } from './saves';
import type { GameState, WeatherKind } from './types';
import { heroMaxHp } from './units';
import { campQuote, currentWeather, makeCamp, rollWeather, seasonOf, weatherMarch, weatherToll, WEATHER_GRACE_TURN } from './weather';
import { townLocation, worldOf } from './world';

const ui = (selected: string | null = null): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function at(state: GameState, kind: WeatherKind, turn = state.turn) {
  state.turn = turn;
  state.weather = { ...state.weather, kind, turn };
}

/** A western game with one of your armies standing in open country next to the capital. */
function inTheField(): { s: GameState; army: GameState['armies'][number] } {
  const s = newGame(3, 'western-realm');
  const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  const field = '6,14';
  const army = { id: s.nextId++, owner: 'player' as const, at: field, from: null, troops: [makeTroop(s, 'spearmen'), makeTroop(s, 'militia')] };
  s.armies.push(army);
  expect(home.at).not.toBe(field);
  return { s, army };
}

describe('seasons and weather', () => {
  it('names the season from the month: winter is December to February', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12, 13].map(seasonOf)).toEqual(
      ['winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter', 'winter']);
  });

  it('keeps the first months clear, then rolls weather that fits the season, without touching any other dice', () => {
    const s = newGame(5, 'western-realm');
    expect(currentWeather(s).kind).toBe('clear');
    const seen: Record<string, Set<WeatherKind>> = { winter: new Set(), spring: new Set(), summer: new Set(), autumn: new Set() };
    const dice = s.seed;
    for (let turn = 2; turn <= 120; turn++) {
      s.turn = turn;
      rollWeather(s);
      if (turn < WEATHER_GRACE_TURN) expect(s.weather.kind).toBe('clear');
      seen[seasonOf(turn)].add(s.weather.kind);
    }
    expect(s.seed).toBe(dice);
    expect([...seen.winter].sort()).toEqual(['blizzard', 'clear', 'snow']);
    for (const season of ['spring', 'summer', 'autumn']) {
      expect(seen[season].has('snow') || seen[season].has('blizzard')).toBe(false);
      expect(seen[season].has('rain')).toBe(true);
    }
  });

  it('is repeatable for the same game, and survives a reload', () => {
    const roll = () => {
      const s = newGame(9, 'western-realm');
      const out: WeatherKind[] = [];
      for (let m = 0; m < 14; m++) { advanceMonth(s); out.push(s.weather.kind); }
      return { out, s };
    };
    const a = roll(), b = roll();
    expect(a.out).toEqual(b.out);
    expect(parseSave(JSON.stringify(a.s)).weather).toEqual(a.s.weather);
  });

  it('slows marching: rain and storms to three quarters, snow to half, and a blizzard stops it', () => {
    const s = newGame(1, 'western-realm');
    const expected: Record<WeatherKind, number> = { clear: 12, rain: 9, storm: 9, snow: 6, blizzard: 0 };
    for (const kind of Object.keys(expected) as WeatherKind[]) {
      at(s, kind);
      expect(weatherMarch(s, 12)).toBe(expected[kind]);
    }
    const valley = newGame(1);
    at(valley, 'snow');
    expect(weatherMarch(valley, 1)).toBe(1);
    at(valley, 'blizzard');
    expect(weatherMarch(valley, 1)).toBe(0);
  });

  it('rain, storms and snow cost men in the open, but not in your towns or allied ones', () => {
    const { s, army } = inTheField();
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    const homeMen = home.troops.map((t) => t.men);
    const men = () => army.troops.map((t) => t.men);
    const after = (rate: number, before: number[]) => before.map((m) => m - Math.round(m * rate));
    at(s, 'clear');
    expect(weatherToll(s)).toEqual([]);
    for (const [kind, rate] of [['rain', 0.03], ['storm', 0.05], ['snow', 0.1], ['blizzard', 0.2]] as const) {
      const before = men();
      at(s, kind);
      weatherToll(s);
      expect(men(), kind).toEqual(after(rate, before));
    }
    expect(home.troops.map((t) => t.men)).toEqual(homeMen);
    expect(s.journal.at(-1)!.text).toMatch(/^The blizzard cost \d+ of your men/);
  });

  it('setting up camp halves the loss, ends the march for the month, and is only offered where it helps', () => {
    const { s, army } = inTheField();
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    at(s, 'clear');
    expect(campQuote(s, army.id).reason).toBe('No need to camp in this weather.');
    at(s, 'snow');
    expect(campQuote(s, home.id).reason).toBe('This army is already sheltered in a town.');
    expect(campQuote(s, army.id)).toEqual({ reason: null, loss: 0.05 });
    const before = army.troops.map((t) => t.men);
    expect(makeCamp(s, army.id)).toBeNull();
    expect(army.troops.every((t) => t.mp === 0)).toBe(true);
    expect(campQuote(s, army.id).reason).toBe('This army has already made camp this month.');
    expect(parseSave(JSON.stringify(s)).armies.find((a) => a.id === army.id)!.campTurn).toBe(s.turn);
    weatherToll(s);
    expect(army.troops.map((t) => t.men)).toEqual(before.map((m) => m - Math.round(m * 0.05)));
    expect(s.journal.at(-1)!.text).toMatch(/\(in camp\)\.$/);
    // Camp lasts the month it was made: next month the army is in the open again.
    at(s, 'snow', s.turn + 1);
    expect(campQuote(s, army.id).reason).toBeNull();
  });

  it('can wipe out a small party, wears heroes down without killing them, and spares the orcs', () => {
    const { s, army } = inTheField();
    const scout = makeTroop(s, 'militia');
    scout.men = 1;
    const hero = makeTroop(s, 'champion', 'Brannoc');
    army.troops = [scout, hero];
    const orcs = { id: s.nextId++, owner: 'orcs' as const, at: '7,14', from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(orcs);
    at(s, 'blizzard');
    for (let i = 0; i < 12; i++) weatherToll(s);
    expect(army.troops.map((t) => t.type)).toEqual(['champion']);
    expect(army.troops[0].men).toBe(1);
    expect(heroMaxHp('champion', hero.xp)).toBeGreaterThan(1);
    expect(orcs.troops[0].men).toBe(20);
  });

  it('a storm strikes one of your towns: food, people, and never its farms', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = newGame(seed, 'western-realm');
      s.turn = 10;
      rollWeather(s);
      if (s.weather.kind !== 'storm') continue;
      expect(s.journal.at(-1)!.text).toMatch(/^A storm battered (Aldenhold|Millbrook)/);
      expect(s.journal.at(-1)!.text).not.toMatch(/farms lost/);
      return;
    }
    throw new Error('no seed rolled a storm');
  });

  it('a quest incursion keeps its authored pace whatever the weather; other armies are slowed', () => {
    const s = newGame(2, 'western-realm');
    const orcs = s.armies.find((a) => a.owner === 'orcs')!;
    const raiders = { ...structuredClone(orcs), id: s.nextId++, target: 'millbrook' };
    s.armies.push(raiders);
    s.turn = 11;
    s.weather = { ...s.weather, seed: 0 };
    // Find a weather seed that gives December a blizzard, then run the month into it.
    for (let seed = 0; seed < 500; seed++) {
      const t = structuredClone(s);
      t.weather.seed = seed;
      t.turn = 12;
      rollWeather(t);
      if (t.weather.kind === 'blizzard') { s.weather.seed = seed; break; }
    }
    const start = raiders.at;
    advanceMonth(s);
    expect(currentWeather(s).kind).toBe('blizzard');
    expect(orcs.troops.every((t) => t.mp === 0)).toBe(true);
    expect(s.armies.find((x) => x.id === raiders.id)?.at ?? 'gone').not.toBe(start);
  });

  it('saves validate the weather, and version 16 saves start the month clear', () => {
    const s = newGame(4, 'western-realm');
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    (bad.weather as Record<string, unknown>).kind = 'hail';
    expect(() => parseSave(JSON.stringify(bad))).toThrow(/weather/);
    const old = structuredClone(s) as unknown as Record<string, unknown>;
    old.version = 16;
    delete old.weather;
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.version).toBe(18);
    expect(migrated.weather).toMatchObject({ kind: 'clear', turn: s.turn });
  });
});

describe('seasons and weather on screen', () => {
  it('a weather ticker says what the weather does and who is exposed; an exposed army can set up camp', () => {
    const { s, army } = inTheField();
    at(s, 'snow', 12);
    const html = renderCampaign(s, ui(army.at));
    expect(html).toContain('<div class="weather-ticker harsh" role="status" aria-live="polite">❄ <b>Winter · Snow</b>');
    expect(html).toContain('1 of your armies is in the open: reach a town, or set up camp to halve the losses.');
    expect(html).toContain('In the open: this snow will cost the army 10% of its men at month end');
    expect(html).toContain('data-action="make-camp"');
    expect(renderCampaign(s, ui(townLocation(s, 'aldenhold')))).not.toContain('In the open:');
    makeCamp(s, army.id);
    const camped = renderCampaign(s, ui(army.at));
    expect(camped).toContain('In camp: this snow will cost the army 5% of its men at month end instead of 10%.');
    expect(camped).toContain('(1 camped)');
    expect(camped).not.toContain('data-action="make-camp"');
    at(s, 'clear', 13);
    expect(renderCampaign(s, ui(army.at))).toContain('<div class="weather-ticker" role="status" aria-live="polite">☀ <b>Winter · Clear</b>');
  });

  it('the overland map wears the season, with no falling weather drawn', () => {
    const s = newGame(1, 'western-realm');
    const world = worldOf(s);
    if (world.kind !== 'hex') throw new Error('hex map');
    const map = (turn: number, kind: WeatherKind) => { at(s, kind, turn); return renderHexMap(s, ui(), world, new Map()); };
    expect(map(1, 'snow')).toContain('class="season-layer season-winter"');
    expect(map(1, 'snow')).toContain('class="season-snow"');
    expect(map(1, 'snow')).not.toContain('weather-layer');
    expect(map(10, 'clear')).toContain('class="season-leaves"');
    expect(map(4, 'rain')).toContain('class="season-fresh"');
    expect(map(4, 'rain')).not.toContain('season-blossom');
    expect(map(7, 'storm')).not.toContain('weather-layer');
    // Decoration never takes a click: every hex still has its click target.
    expect((map(1, 'blizzard').match(/data-action="node"/g) ?? []).length).toBe(world.rows.length * world.rows[0].length);
  });

  it('a battle is fought in the month’s season, with no falling weather drawn', () => {
    const s = newGame(1, 'western-realm');
    const a = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    const d = s.armies.find((x) => x.owner === 'orcs')!;
    d.at = a.at;
    s.battle = createBattle(a.at, a, d, false, 1);
    at(s, 'blizzard', 1);
    const html = renderBattle(s, ui());
    expect(html).toContain('class="season-layer season-winter"');
    expect(html).not.toContain('weather-layer');
    at(s, 'clear', 7);
    expect(renderBattle(s, ui())).toContain('season-summer');
  });
});
