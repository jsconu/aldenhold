import { describe, expect, it } from 'vitest';
import { CATALOG, getCampaign } from '../content';
import { WESTERN_ADDED_TOWNS } from '../content/campaigns/westernExpansion';
import { WESTERN_REVISION_1_ROWS, WESTERN_REVISION_1_TOWNS } from '../content/campaigns/westernRevision1';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import { autoResolve, playerEndTurn, retreat, deploymentZone } from './battle';
import { advanceMonth, applyBattle, armyAt, makeTroop, moveTroops, neighborsOf, newGame, startLocation } from './campaign';
import { advanceCities, buildCity, endowment } from './cities';
import { beginRefit } from './equipment';
import { advanceQuests, chooseQuest, questQuote } from './quests';
import { settleTreasury } from './economy';
import { parseSave } from './saves';
import { hasRoad, hexLand, marchOptions, stepCost, townAt, placeKey, roadsOf, townLocation, worldOf } from './world';
import type { GameState } from './types';
import type { UIState } from '../ui/shared';

const added = new Set(WESTERN_ADDED_TOWNS.map((t) => t.id));
const ui: UIState = { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
function legacy(seed = 1): GameState {
  const s = newGame(seed, 'western-realm');
  const newLocations = new Set(WESTERN_ADDED_TOWNS.map((t) => townLocation(s, t.id)));
  const arrivals = s.armies.filter((a) => newLocations.has(a.at));
  s.nextId = Math.min(...arrivals.flatMap((a) => [a.id, ...a.troops.map((t) => t.id)]));
  s.armies = s.armies.filter((a) => !newLocations.has(a.at));
  for (const id of added) { delete s.towns[id]; delete s.cityEconomies[id]; }
  s.campaignRevision = 1;
  return s;
}
function migrate(s: GameState) { return parseSave(JSON.stringify(s)); }
function preserved(old: GameState, current: GameState) {
  for (const id of WESTERN_REVISION_1_TOWNS) {
    expect(current.towns[id]).toEqual(old.towns[id]);
    expect(current.cityEconomies[id]).toEqual(old.cityEconomies[id]);
  }
  expect(current.armies.filter((a) => old.armies.some((b) => b.id === a.id))).toEqual(old.armies);
  for (const key of ['seed', 'turn', 'gold', 'treasury', 'items', 'treaties', 'flags', 'quests', 'journal', 'log', 'offers', 'status', 'endingReason', 'pending', 'battle'] as const) expect(current[key]).toEqual(old[key]);
}

describe('Western Realm revision 2', () => {
  it('adds 76% more cells while preserving all original terrain and town/site coordinates', () => {
    const s = newGame(1, 'western-realm'), w = getCampaign('western-realm').hex!;
    expect([w.rows[0].length, w.rows.length]).toEqual([52, 38]);
    expect(w.rows.slice(0, 28).map((r) => r.slice(0, 40))).toEqual(WESTERN_REVISION_1_ROWS);
    const oldPositions = { aldenhold: '4,14', millbrook: '6,21', fenwick: '8,7', greenveil: '3,4', harrowgate: '20,6', westmere: '19,12', duskwater: '20,20', reedhaven: '24,22', gharzak: '35,12', watchtower: '30,22', quarry: '24,15', mine: '26,3' };
    for (const [id, at] of Object.entries(oldPositions)) expect(startLocation(s, id)).toBe(at);
    expect(Object.keys(s.towns)).toHaveLength(15);
    expect(w.places.filter((p) => p.kind === 'landmark')).toHaveLength(12);
    expect(validateContent(CATALOG)).toEqual([]);
  });
  it('gives every new city a reachable route and a real garrison outside the old map bounds', () => {
    const s = newGame(2, 'western-realm'), w = getCampaign('western-realm').hex!;
    s.armies = s.armies.filter((a) => a.owner === 'player');
    const reach = marchOptions(s, townLocation(s, 'aldenhold'), 'player', Infinity, true);
    for (const id of added) {
      const place = w.places.find((p) => p.id === id)!;
      expect(place.col >= 40 || place.row >= 28).toBe(true);
      expect(reach.has(placeKey(place)), id).toBe(true);
      const fresh = newGame(2, 'western-realm');
      expect(armyAt(fresh, townLocation(fresh, id), 'neutral')?.troops.length).toBeGreaterThan(0);
    }
    expect(roadsOf(w).every((road) => road.length > 1)).toBe(true);
    expect(hasRoad(s, startLocation(s, 'southford'))).toBe(true);
    expect(hexLand(w, startLocation(s, 'southford')).id).toBe('water');
  });
  it('makes the economic differences real and describes them on each city panel', () => {
    expect(endowment('oakcross').fertility).toBeGreaterThan(endowment('thornwatch').fertility);
    expect(endowment('redford').ore).toBeGreaterThan(endowment('oakcross').ore);
    expect(endowment('bellwater').ore).toBe(0);
    expect(endowment('saltwick').ore).toBe(0);
    const s = newGame(3, 'western-realm'); s.towns.bellwater.owner = 'player'; s.towns.thornwatch.owner = 'player';
    advanceCities(s);
    expect(s.cityEconomies.bellwater.lastMonth!.produced.food).toBeGreaterThan(s.cityEconomies.thornwatch.lastMonth!.produced.food);
    for (const id of added) {
      const html = renderCampaign(s, { ...ui, selected: townLocation(s, id) });
      expect(html).toContain(getCampaign('western-realm').settlementProfiles![id].role);
    }
  });
  it('supports normal conquest, treasury settlement and reload in the expanded area', () => {
    const s = newGame(4, 'western-realm');
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    home.at = startLocation(s, 'saltroad');
    for (let i = 0; i < 5; i++) home.troops.push(makeTroop(s, 'knights'));
    expect(moveTroops(s, home.at, home.troops.map((t) => t.id), townLocation(s, 'saltwick'))).toBeNull();
    expect(s.battle).not.toBeNull(); autoResolve(s.battle!); applyBattle(s, s.battle!);
    expect(s.towns.saltwick.owner).toBe('player');
    expect(migrate(s)).toEqual(s);
    advanceMonth(s); while (s.battle) { autoResolve(s.battle); applyBattle(s, s.battle); }
    expect(migrate(s)).toEqual(s);
    expect(s.treasury.history.at(-1)!.entries.some((e) => e.city === 'saltwick' && e.category === 'tax')).toBe(true);
  });
});

describe('additive Western map migration', () => {
  it('retains development, paid refits, treaty, equipment and every existing ID without adding historic revenue', () => {
    const old = legacy(7);
    old.gold = 5000; old.treasury.opening = 5000;
    old.cityEconomies.aldenhold.buildings.forge = 1;
    old.cityEconomies.aldenhold.goods = { food: 123, timber: 40, ore: 20, tools: 20 };
    const spear = armyAt(old, townLocation(old, 'aldenhold'), 'player')!.troops.find((t) => t.type === 'spearmen')!;
    spear.xp = 3;
    expect(beginRefit(old, 'aldenhold', spear.id, 'chain')).toBeNull();
    expect(buildCity(old, 'aldenhold', 'lumber')).toBeNull();
    armyAt(old, townLocation(old, 'millbrook'), 'player')!.at = neighborsOf(old, townLocation(old, 'fenwick')).find((at) => Number.isFinite(stepCost(old, at)) && !armyAt(old, at))!;
    expect(chooseQuest(old, 'Q00', 'sign')).toBeNull();
    const current = migrate(old); preserved(old, current);
    expect(current.campaignRevision).toBe(2);
    expect(current.nextId).toBeGreaterThan(old.nextId);
    const newcomers = current.armies.filter((a) => !old.armies.some((b) => b.id === a.id));
    expect(newcomers).toHaveLength(6);
    expect(newcomers.every((a) => a.owner === 'neutral' && a.troops.every((t) => t.mp === 0))).toBe(true);
    const twice = migrate(current); expect(twice).toEqual(current);
  });
  it('preserves a mid-battle cyclops aim and continues the same tactical result', () => {
    const old = legacy(11); old.turn = 4; advanceQuests(old);
    const home = armyAt(old, townLocation(old, 'aldenhold'), 'player')!;
    home.at = startLocation(old, 'quarry');
    expect(chooseQuest(old, 'Q02', 'hunt')).toBeNull();
    const cyclops = old.battle!.units.find((u) => u.type === 'cyclops')!;
    const target = old.battle!.units.find((u) => u.side === 'attacker' && u.type === 'militia')!;
    // The target at the front of its zone, the cyclops 3 hexes out, everyone else back where they can't interfere.
    const zone = deploymentZone(old.battle!, 'attacker');
    old.battle!.units.filter((u) => u.side === 'attacker' && u !== target).forEach((u, i) => { u.col = zone.cols[2]; u.row = zone.top + 2 + i; });
    target.col = zone.cols[0]; target.row = zone.top; cyclops.col = zone.cols[0] + 3; cyclops.row = zone.top;
    playerEndTurn(old.battle!); expect(cyclops.aim).toBeDefined();
    const current = migrate(old); preserved(old, current);
    autoResolve(old.battle!); autoResolve(current.battle!);
    expect(current.battle).toEqual(old.battle);
    applyBattle(current, current.battle!);
    expect(migrate(current)).toEqual(current);
  });
  it('migrates an active hero-only party without adding formations to that battle', () => {
    const old = legacy(3); const home = armyAt(old, townLocation(old, 'aldenhold'), 'player')!;
    home.at = startLocation(old, 'watchtower'); home.troops.push(makeTroop(old, 'champion', 'Edith'));
    advanceQuests(old); expect(chooseQuest(old, 'Q03', 'enter')).toBeNull();
    const current = migrate(old); preserved(old, current);
    expect(current.battle!.units.length).toBe(old.battle!.units.length);
    retreat(current.battle!, 'attacker'); applyBattle(current, current.battle!);
    expect(migrate(current)).toEqual(current);
  });
  it('rejects an incomplete/mixed legacy registry and previously out-of-bounds positions', () => {
    const missing = legacy(); delete missing.towns.fenwick;
    expect(() => migrate(missing)).toThrow(/legacy Western/);
    const mixed = legacy(); mixed.towns.oakcross = { ...WESTERN_ADDED_TOWNS[0] };
    expect(() => migrate(mixed)).toThrow(/legacy Western/);
    const outside = legacy(); outside.armies[0].at = '44,5';
    expect(() => migrate(outside)).toThrow(/legacy Western army location/);
  });
  it('keeps quick-play and already-current saves unchanged and refuses unknown revisions', () => {
    const quick = newGame(9); expect(migrate(quick)).toEqual(quick);
    const s = newGame(9, 'western-realm'); expect(migrate(s)).toEqual(s);
    s.campaignRevision = 99; expect(() => migrate(s)).toThrow(/unsupported campaign revision/);
    expect(worldOf(quick).kind).toBe('graph');
  });
});

// This guard also protects migrated encounters from stale completion callbacks.
describe('encounter settlement integrity', () => {
  it('does not repeat casualties, XP, history or loot when the same encounter settles twice', () => {
    const s = newGame(1, 'western-realm'); s.turn = 4; advanceQuests(s);
    armyAt(s, townLocation(s, 'aldenhold'), 'player')!.at = startLocation(s, 'quarry');
    chooseQuest(s, 'Q02', 'hunt');
    const b = s.battle!; retreat(b, 'attacker'); applyBattle(s, b);
    const once = JSON.stringify(s); applyBattle(s, b); expect(JSON.stringify(s)).toBe(once);
    expect(questQuote(s, 'Q02', 'hunt').reason).toContain('next campaign month');
    s.turn++; advanceQuests(s);
    expect(questQuote(s, 'Q02', 'hunt').reason).toBeNull();
  });
});


describe('end-of-month hold-out settlement', () => {
  it('waits for a same-month attack before awarding Act I victory, including a save during that battle', () => {
    const s = newGame(5, 'western-realm');
    const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
    home.troops.push(makeTroop(s, 'spearmen'), makeTroop(s, 'archers'));
    s.towns.fenwick.owner = 'player';
    s.cityEconomies.aldenhold.goods.food = 150;
    advanceQuests(s); advanceQuests(s);
    const quietMonth = () => { settleTreasury(s, [], []); s.turn++; advanceQuests(s); };
    while (s.quests.M04.status === 'unavailable') quietMonth();
    while (s.turn < s.quests.M04.stageTurn! + 3) quietMonth();
    s.armies = s.armies.filter((a) => a.owner !== 'orcs');
    const target = townLocation(s, 'millbrook');
    const near = neighborsOf(s, target).find((at) => Number.isFinite(stepCost(s, at)) && !townAt(s, at) && !armyAt(s, at))!;
    s.armies.push({ id: s.nextId++, owner: 'orcs', at: near, from: null, target: 'millbrook', troops: Array.from({ length: 12 }, () => makeTroop(s, 'warband')) });
    const report = advanceMonth(s)!;
    expect(report.battlePending).toBe(true);
    expect(s.quests.M04.stage).toBe('hold'); expect(s.status).toBe('playing');
    expect(s.journal.some((j) => j.kind === 'ending')).toBe(false);
    expect(migrate(s)).toEqual(s);
    const b = s.battle!; expect(b.at).toBe(target);
    b.units.filter((u) => u.side === 'defender').forEach((u) => { u.men = 0; });
    b.outcome = 'attacker'; applyBattle(s, b);
    expect(s.towns.millbrook.owner).toBe('orcs');
    expect(s.quests.M04.stage).toBe('retake'); expect(s.status).toBe('playing');
    expect(s.journal.some((j) => j.kind === 'ending')).toBe(false);
    expect(migrate(s)).toEqual(s);
  });
});
