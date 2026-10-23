import { describe, expect, it } from 'vitest';
import { renderCityAssault } from '../ui/cityAssault';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { advanceMonth, armyAt, captureTown, makeTroop, moveTroops, newGame } from './campaign';
import { parseSave } from './saves';
import { acceptTerms, advanceSieges, beginSiege, blockade, liftSiege, refuseTerms, siegeOf, siegeOutlook, siegeQuote, surrenderPolicy, wallsBreached } from './sieges';
import type { GameState } from './types';
import { townLocation } from './world';

const ui = (selected: string | null): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });
const CAMP = '7,7';

/** Your main army camped beside Fenwick (a defended free town), ready to besiege it. */
function beforeFenwick(extra: string[] = []): GameState {
  const s = newGame(1, 'western-realm');
  const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  army.at = CAMP;
  for (const t of extra) army.troops.push(makeTroop(s, t));
  return s;
}

const fenwick = (s: GameState) => townLocation(s, 'fenwick');
const garrison = (s: GameState) => s.armies.filter((a) => a.at === fenwick(s) && a.owner === 'neutral').flatMap((a) => a.troops);

describe('sieges', () => {
  it('can only be laid beside a defended hostile town, once, by one army', () => {
    const s = beforeFenwick();
    expect(siegeQuote(s, townLocation(s, 'aldenhold'), fenwick(s)).reason).toBe('You have no army there.');
    expect(siegeQuote(s, CAMP, townLocation(s, 'westmere')).reason).toMatch(/^Move next to Westmere first/);
    expect(siegeQuote(s, CAMP, fenwick(s)).reason).toBeNull();
    expect(beginSiege(s, CAMP, fenwick(s))).toBeNull();
    expect(siegeQuote(s, CAMP, fenwick(s)).reason).toBe('You are already besieging it.');
    expect(armyAt(s, CAMP, 'player')!.troops.every((t) => t.mp === 0)).toBe(true);
    expect(s.journal.at(-1)!.text).toBe('You lay siege to Fenwick.');
    expect(parseSave(JSON.stringify(s)).sieges).toEqual(s.sieges);
    const empty = beforeFenwick();
    empty.armies = empty.armies.filter((a) => a.at !== fenwick(empty));
    expect(siegeQuote(empty, CAMP, fenwick(empty)).reason).toBe('It is undefended: march in to take it.');
  });

  it('wears walls, supplies and morale down each month, faster with a bigger army; a starving garrison loses men', () => {
    const small = beforeFenwick();
    // A lone militia cannot surround the town the way a full army can.
    armyAt(small, CAMP, 'player')!.troops = [makeTroop(small, 'militia')];
    const big = beforeFenwick(['spearmen', 'spearmen', 'spearmen', 'militia', 'militia', 'archers']);
    for (const s of [small, big]) beginSiege(s, CAMP, fenwick(s));
    expect(blockade(big, siegeOf(big, 'fenwick')!)).toBeGreaterThan(blockade(small, siegeOf(small, 'fenwick')!));
    const siege = siegeOf(big, 'fenwick')!;
    const start = { ...siege };
    const outlook = siegeOutlook(big, siege);
    advanceSieges(big);
    expect(siege.walls).toBe(start.walls - outlook.walls);
    expect(siege.supplies).toBeCloseTo(start.supplies - outlook.supplies, 5);
    expect(siege.morale).toBeLessThan(start.morale);
    const men = garrison(big).reduce((n, t) => n + t.men, 0);
    while (siege.supplies > 0) advanceSieges(big);
    expect(advanceSieges(big)).toContain('Fenwick is starving under your siege.');
    expect(garrison(big).reduce((n, t) => n + t.men, 0)).toBeLessThan(men);
  });

  it('breached walls no longer protect the defenders in an assault', () => {
    const s = beforeFenwick();
    beginSiege(s, CAMP, fenwick(s));
    siegeOf(s, 'fenwick')!.walls = 40;
    expect(wallsBreached(s, 'fenwick')).toBe(true);
    const army = armyAt(s, CAMP, 'player')!;
    for (const t of army.troops) t.mp = 10;
    expect(moveTroops(s, CAMP, army.troops.map((t) => t.id), fenwick(s))).toBeNull();
    expect(s.battle?.walls).toBe(false);
  });

  it('a free town whose morale breaks offers to become your vassal; accepting grants passage once and survives a reload', () => {
    const s = beforeFenwick(['spearmen', 'spearmen', 'spearmen', 'militia']);
    beginSiege(s, CAMP, fenwick(s));
    expect(surrenderPolicy(s, 'fenwick').terms).toBe(true);
    for (let i = 0; i < 40 && !siegeOf(s, 'fenwick')!.offer; i++) advanceSieges(s);
    expect(siegeOf(s, 'fenwick')!.offer).toBe(true);
    expect(s.journal.at(-1)!.text).toBe('Fenwick offers to become your vassal if you lift the siege.');
    const html = renderCampaign(s, ui(fenwick(s)));
    expect(html).toContain('data-action="siege-accept"');
    expect(acceptTerms(s, 'fenwick')).toBeNull();
    expect(s.treaties.fenwick).toMatchObject({ relation: 'vassal', passage: true });
    expect(siegeOf(s, 'fenwick')).toBeUndefined();
    expect(s.siegeLog.at(-1)).toMatchObject({ town: 'fenwick', result: 'vassal' });
    expect(acceptTerms(s, 'fenwick')).not.toBeNull();
    expect(parseSave(JSON.stringify(s)).treaties.fenwick.relation).toBe('vassal');
  });

  it('refused terms keep the siege going; capitals, the Hold and orc-held towns never offer terms', () => {
    const s = beforeFenwick(['spearmen', 'spearmen', 'spearmen', 'militia']);
    beginSiege(s, CAMP, fenwick(s));
    for (let i = 0; i < 40 && !siegeOf(s, 'fenwick')!.offer; i++) advanceSieges(s);
    expect(refuseTerms(s, 'fenwick')).toBeNull();
    expect(siegeOf(s, 'fenwick')).toMatchObject({ offer: false });
    expect(surrenderPolicy(s, 'aldenhold').terms).toBe(false);
    expect(surrenderPolicy(s, 'gharzak')).toEqual({ terms: false, why: 'Gharzak Hold will fight to the last.' });
    s.towns.westmere.owner = 'orcs';
    expect(surrenderPolicy(s, 'westmere').terms).toBe(false);
  });

  it('ends when lifted, when the army marches away, when the garrison is gone, or when the town is stormed', () => {
    const lifted = beforeFenwick();
    beginSiege(lifted, CAMP, fenwick(lifted));
    expect(liftSiege(lifted, 'fenwick')).toBeNull();
    expect(lifted.siegeLog.at(-1)).toMatchObject({ result: 'lifted' });

    const walked = beforeFenwick();
    beginSiege(walked, CAMP, fenwick(walked));
    armyAt(walked, CAMP, 'player')!.at = '6,8';
    expect(advanceSieges(walked)).toEqual(['The siege of Fenwick is lifted: the besieging army has gone.']);

    const emptied = beforeFenwick();
    beginSiege(emptied, CAMP, fenwick(emptied));
    emptied.armies = emptied.armies.filter((a) => a.at !== fenwick(emptied));
    expect(advanceSieges(emptied)).toEqual(["Fenwick's garrison is gone. March in to take the town."]);

    const stormed = beforeFenwick();
    beginSiege(stormed, CAMP, fenwick(stormed));
    captureTown(stormed, stormed.towns.fenwick, 'player');
    expect(siegeOf(stormed, 'fenwick')).toBeUndefined();
    expect(stormed.siegeLog.at(-1)).toMatchObject({ result: 'stormed' });
  });

  it('runs in the month pipeline and offers Besiege in the assault decision', () => {
    const s = beforeFenwick();
    const army = armyAt(s, CAMP, 'player')!;
    const html = renderCityAssault(s, { from: CAMP, to: fenwick(s), troopIds: army.troops.map((t) => t.id) });
    expect(html).toContain('<button data-action="assault-besiege" >Besiege</button>');
    beginSiege(s, CAMP, fenwick(s));
    const walls = siegeOf(s, 'fenwick')!.walls;
    advanceMonth(s);
    expect(siegeOf(s, 'fenwick')!.walls).toBeLessThan(walls);
    const panel = renderCampaign(s, ui(fenwick(s)));
    expect(panel).toContain('Under your siege since January, year 1');
    expect(panel).toContain('data-action="siege-storm"');
    expect(renderCampaign(s, ui(CAMP))).toContain('Besieging Fenwick.');
  });

  it('saves validate sieges, and version 17 saves start with none', () => {
    const s = beforeFenwick();
    beginSiege(s, CAMP, fenwick(s));
    const bad = structuredClone(s);
    bad.sieges[0].walls = 140;
    expect(() => parseSave(JSON.stringify(bad))).toThrow(/siege/);
    const old = structuredClone(s) as unknown as Record<string, unknown>;
    old.version = 17;
    delete old.sieges;
    delete old.siegeLog;
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.version).toBe(18);
    expect(migrated.sieges).toEqual([]);
  });
});

describe('clicking a town with your troops', () => {
  it('asks whether to move troops or open the city, then lists troops to toggle with select all / deselect all', () => {
    const s = newGame(1, 'western-realm');
    const home = townLocation(s, 'aldenhold');
    const choose = renderCampaign(s, { ...ui(home), townChoice: { at: home, step: 'choose' } });
    expect(choose).toContain('data-action="town-choice-move"');
    expect(choose).toContain('data-action="town-choice-city"');
    const ids = armyAt(s, home, 'player')!.troops.map((t) => t.id);
    const troops = renderCampaign(s, { ...ui(home), checked: new Set([ids[0]]), townChoice: { at: home, step: 'troops' } });
    expect(troops).toContain('data-action="troops-all"');
    expect(troops).toContain('data-action="troops-none"');
    expect((troops.match(/data-change="check"/g) ?? []).length).toBeGreaterThanOrEqual(ids.length);
    expect(troops).toContain('<button data-action="town-choice-close" class="primary" >Choose destination</button>');
  });
});
