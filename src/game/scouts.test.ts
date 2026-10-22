import { describe, expect, it } from 'vitest';
import { renderCampaign } from '../ui/campaignView';
import { renderHexMap } from '../ui/hexMapView';
import { createBattle, FIELD_LIMIT, planDeployment } from './battle';
import { startBattle, marchQuote, armyAt, campaignOf, makeTroop, newGame, recruit } from './campaign';
import { hexDistance, hexKey } from './hex';
import { garrisonDefense } from './raids';
import { parseSave } from './saves';
import { assignScout, inSight, observeOrcRoutes, SCOUT_RANGE } from './scouts';
import type { GameState } from './types';
import { parseKey, townLocation, worldOf } from './world';

/** Every hex of the western map at exactly `d` hexes from `from`. */
function ring(s: GameState, from: string, d: number): string[] {
  const world = worldOf(s);
  if (world.kind !== 'hex') throw new Error('Western Realm should have hex geography');
  return world.rows.flatMap((row, y) => [...row].map((_, x) => hexKey({ col: x, row: y })))
    .filter((at) => hexDistance(parseKey(from), parseKey(at)) === d);
}

describe('scouts on watch', () => {
  it('keeps watch where it stands, reports an orc force coming into sight once, and reloads the order', () => {
    const s = newGame(7, 'western-realm');
    const capital = campaignOf(s).capital;
    const home = townLocation(s, capital);
    expect(recruit(s, capital, 'scout')).toBeNull();
    const scout = armyAt(s, home, 'player')!.troops.find((t) => t.type === 'scout')!;
    const before = garrisonDefense(s, capital);
    expect(assignScout(s, scout.id, 'watch')).toBeNull();
    expect(scout.scoutPost).toBe('watch');
    expect(garrisonDefense(s, capital)).toBe(before);

    // An orc force within sight is reported once.
    const start = ring(s, home, SCOUT_RANGE)[0];
    const enemy = { id: s.nextId++, owner: 'orcs' as const, at: start, from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(enemy);
    const route = [ring(s, home, SCOUT_RANGE).find((at) => hexDistance(parseKey(at), parseKey(start)) === 1)!, home];
    observeOrcRoutes(s, enemy, route);
    expect(s.journal.at(-1)!.text).toMatch(/^Scout at Aldenhold reports an orc force moving toward Aldenhold/);
    const count = s.journal.length;
    observeOrcRoutes(s, enemy, route);
    expect(s.journal).toHaveLength(count);

    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.scoutReports).toEqual(s.scoutReports);
    expect(loaded.armies.flatMap((a) => a.troops).find((t) => t.id === scout.id)?.scoutPost).toBe('watch');
    expect(assignScout(loaded, scout.id, 'recall')).toBeNull();
  });

  it('sees nothing beyond its range', () => {
    const s = newGame(7, 'western-realm');
    const home = townLocation(s, campaignOf(s).capital);
    const scout = makeTroop(s, 'scout');
    armyAt(s, home, 'player')!.troops.push(scout);
    expect(assignScout(s, scout.id, 'watch')).toBeNull();
    const far = ring(s, home, SCOUT_RANGE + 4);
    const enemy = { id: s.nextId++, owner: 'orcs' as const, at: far[0], from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(enemy);
    expect(ring(s, home, SCOUT_RANGE).every((at) => inSight(s, home, at))).toBe(true);
    expect(ring(s, home, SCOUT_RANGE + 1).some((at) => inSight(s, home, at))).toBe(false);
    const count = s.journal.length;
    // A future route into sight must not expose a currently unseen army.
    observeOrcRoutes(s, enemy, [home]);
    observeOrcRoutes(s, enemy, [far[1]]);
    expect(s.journal).toHaveLength(count);
  });

  it('reads older city and road posts as the same watch', () => {
    const s = newGame(7, 'western-realm');
    const home = townLocation(s, campaignOf(s).capital);
    const scout = makeTroop(s, 'scout');
    scout.scoutPost = 'road';
    armyAt(s, home, 'player')!.troops.push(scout);
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.armies.flatMap((a) => a.troops).find((t) => t.id === scout.id)?.scoutPost).toBe('road');
    const enemy = { id: loaded.nextId++, owner: 'orcs' as const, at: ring(loaded, home, 2)[0], from: null, troops: [makeTroop(loaded, 'warband')] };
    loaded.armies.push(enemy);
    observeOrcRoutes(loaded, enemy, [home]);
    expect(loaded.journal.at(-1)!.text).toMatch(/^Scout at Aldenhold reports/);
  });

  it('says plainly what it watches, and the map shades its range', () => {
    const s = newGame(7, 'western-realm');
    const home = townLocation(s, campaignOf(s).capital);
    const scout = makeTroop(s, 'scout');
    armyAt(s, home, 'player')!.troops.push(scout);
    const ui = { selected: home, checked: new Set<number>(), battleUnit: null, battleSpell: null, message: '', view: 'map' as const };
    expect(renderCampaign(s, ui)).toContain('Keep watch here');
    expect(renderCampaign(s, ui)).not.toContain('Watch road');
    expect(assignScout(s, scout.id, 'watch')).toBeNull();
    const panel = renderCampaign(s, ui);
    expect(panel).toContain('On watch over Aldenhold');
    expect(panel).toContain(`sees ${SCOUT_RANGE} hexes all around (shaded on the map)`);
    const world = worldOf(s);
    if (world.kind !== 'hex') throw new Error('hex map');
    const map = renderHexMap(s, ui, world, new Map());
    const shaded = (map.match(/class="watch-range watched-here"/g) ?? []).length;
    expect(shaded).toBe([0, 1, 2, 3].reduce((n, d) => n + ring(s, home, d).length, 0));
  });
});

describe('scout noncombat behavior', () => {
  it('keeps scouts out of tactical slots while preserving save references', () => {
    const s = newGame(7, 'western-realm');
    const home = townLocation(s, campaignOf(s).capital);
    const army = armyAt(s, home, 'player')!;
    const ruler = army.troops.find(t => t.type === 'lord')!;
    army.troops = [makeTroop(s, 'scout'), ...Array.from({length: FIELD_LIMIT}, () => makeTroop(s, 'spearmen'))];
    const enemy = {id:s.nextId++,owner:'orcs' as const,at:home,from:null,troops:[makeTroop(s,'warband')]};
    expect(planDeployment(army).size).toBe(FIELD_LIMIT);
    const b = createBattle(home, army, enemy, false, 7);
    expect(b.units.find(u => u.type === 'scout')?.reserve).toBe(true);
    expect(b.units.filter(u => u.side === 'attacker' && !u.reserve)).toHaveLength(FIELD_LIMIT);
    // A normal-sized mixed force can reload mid-battle with the noncombat scout present.
    army.troops = [ruler, ...army.troops.slice(0, 3)];
    s.armies.push(enemy);
    s.battle = createBattle(home, army, enemy, false, 7);
    expect(parseSave(JSON.stringify(s)).battle?.units.find(u => u.type === 'scout')?.reserve).toBe(true);
  });

  it('automatically withdraws an intercepted watch without opening an empty battle', () => {
    const s = newGame(7, 'western-realm');
    const home = townLocation(s, campaignOf(s).capital);
    const defender = armyAt(s, home, 'player')!;
    const scout = makeTroop(s,'scout'); scout.scoutPost='watch';
    // Keep the ruler elsewhere so interception does not end the campaign.
    const original = defender.troops;
    defender.troops=[scout];
    s.armies.push({id:s.nextId++,owner:'player',at:townLocation(s,'millbrook'),from:null,troops:original});
    const enemy={id:s.nextId++,owner:'orcs' as const,at:home,from:null,troops:[makeTroop(s,'warband')]};
    s.armies.push(enemy);
    startBattle(s,enemy.id,defender.id);
    expect(s.battle).toBeNull();
    expect(s.towns[campaignOf(s).capital].owner).toBe('orcs');
    expect(scout.scoutPost).toBeUndefined();
    expect(s.armies.find(a=>a.id===defender.id)?.at).not.toBe(home);
    expect(s.journal.some(d=>d.text.includes('Scouts intercepted'))).toBe(true);
    expect(()=>parseSave(JSON.stringify(s))).not.toThrow();
  });

  it('refuses a lone scout attacking an adjacent hostile town', () => {
    const s = newGame(7);
    const army=armyAt(s,'aldenhold','player')!;
    const scout=makeTroop(s,'scout');army.troops.push(scout);
    expect(marchQuote(s,'aldenhold',[scout.id],'fenwick').reason).toMatch(/Scouts cannot attack/);
  });

  it('reports a visible rival expedition once and preserves deduplication on reload', () => {
    const s=newGame(7,'western-realm'),home=townLocation(s,campaignOf(s).capital);
    const scout=makeTroop(s,'scout');scout.scoutPost='watch';armyAt(s,home,'player')!.troops.push(scout);
    const enemy={id:s.nextId++,owner:'neutral' as const,at:ring(s,home,2)[0],from:null,troops:[makeTroop(s,'spearmen')],cityRaid:{origin:'fenwick',target:campaignOf(s).capital,launched:s.turn}};
    s.armies.push(enemy);
    observeOrcRoutes(s,enemy,[home]);
    expect(s.journal.at(-1)?.text).toContain('a rival city force');
    expect(s.journal.at(-1)?.text).toContain('estimated destination');
    const loaded=parseSave(JSON.stringify(s)),count=loaded.journal.length;
    observeOrcRoutes(loaded,loaded.armies.find(a=>a.id===enemy.id)!,[home]);
    expect(loaded.journal).toHaveLength(count);
  });
});
