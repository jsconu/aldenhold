import { LAIRS } from '../content/lairs';
import { retreat } from './battle';
import { describe, expect, it } from 'vitest';
import { CATALOG, getCampaign } from '../content';
import { REED_COAST_TOWNS, WESTERN_REVISION_2_ROWS } from '../content/campaigns/reedCoast';
import { validateContent } from '../content/validate';
import { advanceQuests, chooseQuest, questQuote, sideQuestHighlights } from './quests';
import { applyBattle, armyAt, makeTroop, moveTroops, neighborsOf, newGame, recruit, startBattle } from './campaign';
import { buildCity, endowment } from './cities';
import { parseSave } from './saves';
import { hasRoad, hexLand, marchOptions, stepCost, townLocation, worldOf, locationName } from './world';
import { questFocus } from '../ui/questNavigation';
import { renderCampaign } from '../ui/campaignView';
import type { GameState } from './types';

const coastal = new Set(REED_COAST_TOWNS.map(t => t.id));
function revision2() {
  const s = newGame(8, 'western-realm');
  const arrivals = s.armies.filter(a => REED_COAST_TOWNS.some(t => a.at === townLocation(s, t.id)));
  s.nextId = Math.min(...arrivals.flatMap(a => [a.id, ...a.troops.map(t => t.id)]));
  s.armies = s.armies.filter(a => !arrivals.includes(a));
  for (const id of coastal) { delete s.towns[id]; delete s.cityEconomies[id]; }
  for (const id of ['R01', 'Q40', 'Q44']) delete s.quests[id];
  s.campaignRevision = 2;
  return s;
}
function envoy(s: GameState, town: string) {
  const a = s.armies.find(a => a.owner === 'player' && a.troops.some(t => t.type === 'lord'))!;
  a.at = neighborsOf(s, townLocation(s, town)).find(at => stepCost(s, at) < Infinity && !s.armies.some(a => a.at === at))!;
  return a;
}
function compactReady() {
  const s = newGame(1, 'western-realm'); s.gold = 1500; s.treasury.opening = 1500;
  expect(recruit(s, 'aldenhold', 'militia')).toBeNull();
  expect(recruit(s, 'aldenhold', 'militia')).toBeNull();
  advanceQuests(s); advanceQuests(s);
  expect(s.quests.R01.status).toBe('available');
  return s;
}

describe('Reed Coast geography and migration', () => {
  it('refreshes cached map descriptions when a scout discovers a previously hidden lair', () => {
    const s=newGame(1,'western-realm'), def=Object.values(LAIRS).find(l=>l.place==='eldersanctum')!;
    const before=locationName(s,'48,8'); expect(before).not.toContain('The Elder Sanctum');
    s.lairs[def.id].discovered=true; expect(locationName(s,'48,8')).toContain('The Elder Sanctum');
  });
  it('doubles map area without changing any revision-2 terrain, and connects all five towns', () => {
    const s = newGame(1, 'western-realm'), w = getCampaign('western-realm').hex!;
    expect([w.rows[0].length, w.rows.length]).toEqual([76, 52]);
    expect(w.rows.slice(0, 38).map(r => r.slice(0, 52))).toEqual(WESTERN_REVISION_2_ROWS);
    expect(validateContent(CATALOG)).toEqual([]);
    const reach = marchOptions(s, townLocation(s, 'redford'), 'player', Infinity, true);
    for (const id of coastal) {
      expect(reach.has(townLocation(s, id)), id).toBe(true);
      expect(armyAt(s, townLocation(s, id), 'neutral')?.troops.length).toBeGreaterThan(0);
    }
    for (const id of ['willowbridge', 'lanternford']) {
      const at = townLocation(s, id); expect(hexLand(w, at).id).toBe('water'); expect(hasRoad(s, at)).toBe(true); expect(stepCost(s, at)).toBe(1);
    }
    expect(endowment('reedspire').fertility).toBeGreaterThan(endowment('miretooth').fertility);
    expect(endowment('willowford').ore).toBe(0);
    expect(stepCost(s,'76,1')).toBe(Infinity); expect(stepCost(s,'1,52')).toBe(Infinity);
  });
  it('preserves armies, investment, treasury, random state and an active city battle on import, once', () => {
    const old = revision2(); old.gold = 1000; old.treasury.opening = 1000;
    expect(buildCity(old, 'aldenhold', 'lumber')).toBeNull();
    const a = armyAt(old, townLocation(old, 'aldenhold'), 'player')!, d = armyAt(old, townLocation(old, 'fenwick'), 'neutral')!;
    a.at = d.at; a.from = townLocation(old, 'aldenhold'); startBattle(old, a.id, d.id);
    const before = structuredClone(old), migrated = parseSave(JSON.stringify(old));
    for (const id of Object.keys(before.towns)) { expect(migrated.towns[id]).toEqual(before.towns[id]); expect(migrated.cityEconomies[id]).toEqual(before.cityEconomies[id]); }
    expect(migrated.armies.filter(a => before.armies.some(b => b.id === a.id))).toEqual(before.armies);
    for (const key of ['gold', 'treasury', 'seed', 'turn', 'battle', 'journal', 'log', 'flags', 'items'] as const) expect(migrated[key]).toEqual(before[key]);
    expect(migrated.campaignRevision).toBe(3);
    expect(migrated.armies.filter(a => a.id >= before.nextId)).toHaveLength(5);
    expect(migrated.armies.filter(a => a.id >= before.nextId).every(a => a.troops.every(t => t.mp === 0))).toBe(true);
    expect(parseSave(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('rejects incomplete old registries and positions outside their historical bounds', () => {
    const missing = revision2(); delete missing.towns.fenwick;
    expect(() => parseSave(JSON.stringify(missing))).toThrow(/revision-2 Western town/);
    const outside = revision2(); outside.armies[0].at = '60,40';
    expect(() => parseSave(JSON.stringify(outside))).toThrow(/revision-2 Western army location/);
  });
  it('supports a real march and city assault at a new coastal settlement', () => {
    const s = newGame(1, 'western-realm'), a = s.armies.find(a => a.owner === 'player')!;
    a.at = townLocation(s, 'coastgate'); a.troops.push(makeTroop(s, 'knights'));
    expect(moveTroops(s, a.at, a.troops.map(t => t.id), townLocation(s, 'willowford'))).toBeNull();
    expect(s.battle?.city?.town).toBe('willowford');
    expect(parseSave(JSON.stringify(s)).battle).toEqual(s.battle);
  });
});

describe('coastal regional and local quests', () => {
  it('requires the correct peaceful stop, follows navigation, pays once and grants the compact after all stages', () => {
    let s = compactReady();
    expect(questQuote(s, 'R01', 'accept').reason).toContain('Reedhaven');
    envoy(s, 'reedhaven'); expect(chooseQuest(s, 'R01', 'accept')).toBeNull();
    expect(questFocus(s, 'R01')).toBe(townLocation(s, 'willowford'));
    const gold = s.gold; expect(chooseQuest(s, 'R01', 'repair')).toContain('Willowford'); expect(s.gold).toBe(gold);
    envoy(s, 'willowford'); expect(chooseQuest(s, 'R01', 'repair')).toBeNull();
    s = parseSave(JSON.stringify(s));
    expect(questFocus(s, 'R01')).toBe(townLocation(s, 'miretooth'));
    envoy(s, 'miretooth'); expect(chooseQuest(s, 'R01', 'settle')).toBeNull();
    envoy(s, 'brineport'); expect(chooseQuest(s, 'R01', 'sign')).toBeNull();
    expect(s.gold).toBe(gold - 120 - 160 - 100 + 200);
    for (const id of coastal) expect(s.treaties[id]).toMatchObject({ relation: 'ally', passage: true });
    const after = JSON.stringify(s); expect(chooseQuest(s, 'R01', 'sign')).not.toBeNull(); expect(JSON.stringify(s)).toBe(after);
    expect(parseSave(after).quests.R01.status).toBe('succeeded');
  });
  it('offers the causeway battle as an alternative and preserves a retry after retreat', () => {
    const s = compactReady(); envoy(s, 'reedhaven'); chooseQuest(s, 'R01', 'accept'); envoy(s, 'willowford'); chooseQuest(s, 'R01', 'repair');
    const a = envoy(s, 'miretooth'); a.at = townLocation(s, 'reedden');
    expect(chooseQuest(s, 'R01', 'fight')).toBeNull();
    expect(s.battle?.encounter?.quest).toBe('R01'); expect(s.battle?.units.filter(u => u.side === 'defender').map(u => u.type)).toEqual(['troll', 'troll']);
    expect(parseSave(JSON.stringify(s)).battle).toEqual(s.battle);
    retreat(s.battle!, 'attacker'); applyBattle(s, s.battle!);
    expect(s.quests.R01.stage).toBe('tolls');
    expect(questQuote(s,'R01','fight').reason).toContain('next campaign month');
    s.turn++; a.at=townLocation(s,'reedden');
    expect(questQuote(s,'R01','fight').reason).toBeNull();
  });
  it('changes actual population for the census and requires visiting the beacon before restoring the banner', () => {
    const s = newGame(1, 'western-realm'); s.gold = 1000; s.treasury.opening = 1000;
    envoy(s, 'reedspire'); advanceQuests(s); const pop = s.towns.reedspire.pop;
    expect(chooseQuest(s, 'Q40', 'inspect')).toBeNull(); expect(chooseQuest(s, 'Q40', 'restore')).toBeNull(); expect(s.towns.reedspire.pop).toBe(pop + 180);
    const a = envoy(s, 'gullmere'); advanceQuests(s); expect(chooseQuest(s, 'Q44', 'accept')).toBeNull();
    expect(questQuote(s, 'Q44', 'read').reason).toContain('Beacon');
    a.at = townLocation(s, 'reedbeacon'); expect(chooseQuest(s, 'Q44', 'read')).toBeNull();
    envoy(s, 'gullmere'); expect(chooseQuest(s, 'Q44', 'report')).toBeNull();
    expect(parseSave(JSON.stringify(s)).treaties.gullmere.passage).toBe(true);
  });
  it('separates regional campaigns from the two relevant local highlights', () => {
    const s = compactReady(); expect(sideQuestHighlights(s).every(q => q.scope !== 'regional')).toBe(true);
    const html = renderCampaign(s, { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'quests' });
    expect(html).toContain('Regional campaigns'); expect(html).toContain('The Reed Coast Compact');
    expect(worldOf(s).kind).toBe('hex');
  });
});
