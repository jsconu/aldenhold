import { describe, expect, it } from 'vitest';
import { CATALOG, getCampaign } from '../content';
import { LAIRS, lairsOf, SPECIES } from '../content/lairs';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import { renderHexMap } from '../ui/hexMapView';
import type { UIState } from '../ui/shared';
import { createBattle, endSideTurn } from './battle';
import { advanceMonth, applyBattle, armyAt, makeTroop, newGame, startLocation } from './campaign';
import { hexDistance } from './hex';
import { discoverLairs, lairGarrison, lairLocation, settleLairs } from './lairs';
import { parseSave } from './saves';
import type { Army, GameState } from './types';
import { hexLand, locationName, parseKey, townLocation } from './world';

const ui = (selected: string | null): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** Put the home army right next to a lair (3 hexes off is enough to find it). */
function scoutNear(s: GameState, lairId: string): Army {
  const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  const at = parseKey(lairLocation(s, LAIRS[lairId]));
  home.at = `${at.col - 2},${at.row}`;
  return home;
}

describe('the lair registry', () => {
  it('places goblin, troll, giant and titan lairs on their own ground, with garrisons, far enough from the capital', () => {
    const lairs = lairsOf('western-realm');
    expect(new Set(lairs.map((l) => l.species))).toEqual(new Set(['goblins', 'trolls', 'giants', 'titans']));
    const world = getCampaign('western-realm').hex!;
    const s = newGame(1, 'western-realm');
    const capital = parseKey(townLocation(s, 'aldenhold'));
    for (const l of lairs) {
      const at = lairLocation(s, l);
      expect(SPECIES[l.species].lands).toContain(hexLand(world, at).id);
      expect(hexDistance(parseKey(at), capital)).toBeGreaterThanOrEqual(SPECIES[l.species].minDistance);
      expect(lairGarrison(s, l)!.troops.map((t) => t.type)).toEqual(l.garrison);
      expect(s.lairs[l.id]).toEqual({ status: 'active', discovered: false, clearedTurn: null });
    }
    // The titan's sanctum is far out in the east.
    expect(hexDistance(parseKey(lairLocation(s, LAIRS.eldersanctum)), capital)).toBeGreaterThan(40);
    expect(newGame(1).lairs).toEqual({});
  });

  it('keeps a lair and its garrison hidden until an army comes within 3 hexes, then records the find', () => {
    let s = newGame(1, 'western-realm');
    const map = () => renderHexMap(s, ui(null), getCampaign('western-realm').hex!, new Map());
    const at = lairLocation(s, LAIRS.briarwood);
    expect(map()).not.toContain('Briarwood Warren');
    expect(locationName(s, at)).not.toContain('Briarwood');
    scoutNear(s, 'briarwood');
    expect(discoverLairs(s)).toEqual(['Found Briarwood Warren.']);
    expect(s.lairs.briarwood.discovered).toBe(true);
    expect(s.journal.at(-1)!.text).toMatch(/^Your scouts found Briarwood Warren/);
    expect(discoverLairs(s)).toEqual([]);
    s = reload(s);
    expect(map()).toContain('Briarwood Warren: goblins lair, tier 1. Active. Garrison: Goblins: 4 troops');
    expect(locationName(s, at)).toBe('Briarwood Warren');
    expect(renderCampaign(s, ui(at))).toMatch(/Briarwood Warren <small>Goblins · tier 1<\/small>[\s\S]*120 gold in plunder/);
  });

  it('defeating the garrison clears the lair for good and pays its plunder once, through the ledger', () => {
    let s = newGame(1, 'western-realm');
    const home = scoutNear(s, 'briarwood');
    discoverLairs(s);
    const garrison = lairGarrison(s, LAIRS.briarwood)!;
    home.at = garrison.at;
    for (let i = 0; i < 6; i++) home.troops.push(makeTroop(s, 'knights'));
    const b = createBattle(garrison.at, home, garrison, false, 1);
    b.units.filter((u) => u.side === 'defender').forEach((u) => { u.men = 0; });
    b.outcome = 'attacker';
    const gold = s.gold;
    applyBattle(s, b);
    expect(s.lairs.briarwood).toMatchObject({ status: 'cleared', discovered: true, clearedTurn: 1 });
    expect(s.gold).toBe(gold + 120);
    expect(s.treasury.pending.some((e) => e.category === 'lair-plunder' && e.amount === 120)).toBe(true);
    expect(settleLairs(s)).toEqual([]);
    s = reload(s);
    expect(s.gold).toBe(gold + 120);
    const report = advanceMonth(s)!;
    expect(report.ledger!.entries.some((e) => e.category === 'balance-correction')).toBe(false);
    expect(renderHexMap(s, ui(null), getCampaign('western-realm').hex!, new Map())).toContain('Briarwood Warren: goblins lair, tier 1. Cleared.');
  });

  it('the month finds lairs your armies marched near', () => {
    const s = newGame(1, 'western-realm');
    scoutNear(s, 'blackmire');
    const report = advanceMonth(s)!;
    expect(report.phases.find((p) => p.id === 'lairs')!.notes.map((n) => n.text)).toContain('Found Blackmire Den.');
  });

  it('save validation keeps lairs honest; v13 saves gain lairs and their garrisons', () => {
    const s = newGame(1, 'western-realm');
    const forged = structuredClone(s);
    forged.lairs.stonejaw = { status: 'cleared', discovered: false, clearedTurn: 1 };
    expect(() => reload(forged)).toThrow(/cleared lair/);
    const orphan = structuredClone(s);
    orphan.armies = orphan.armies.filter((a) => a.owner !== 'giants');
    expect(() => reload(orphan)).toThrow(/lair garrison/);
    const v13 = JSON.parse(JSON.stringify(s));
    v13.version = 13;
    delete v13.lairs;
    v13.armies = v13.armies.filter((a: Army) => !['goblins', 'trolls', 'giants', 'titans'].includes(a.owner));
    const restored = parseSave(JSON.stringify(v13));
    expect(restored.version).toBe(14);
    expect(Object.keys(restored.lairs).sort()).toEqual(Object.keys(LAIRS).sort());
    expect(lairGarrison(restored, LAIRS.eldersanctum)!.troops.map((t) => t.type)).toEqual(['titan', 'giant', 'giant']);
    expect(() => reload(restored)).not.toThrow();
  });

  it('content validation checks lair ground, distance and garrisons', () => {
    const check = (edit: (c: typeof CATALOG) => void) => {
      const copy = structuredClone(CATALOG);
      edit(copy);
      return validateContent(copy).join('\n');
    };
    expect(validateContent(CATALOG)).toEqual([]);
    expect(check((c) => (c.lairs.blackmire.species = 'giants'))).toMatch(/lair "blackmire" stands on swamp, not giants ground/);
    expect(check((c) => (c.species.goblins.minDistance = 40))).toMatch(/lair "briarwood" is too close to the capital/);
    expect(check((c) => (c.lairs.briarwood.garrison = ['dragon']))).toMatch(/lair "briarwood" has an empty or unknown garrison/);
    expect(startLocation(newGame(1, 'western-realm'), 'eldersanctum')).toBe('47,8');
  });

  it('trolls regenerate a man at the start of each of their turns', () => {
    const s = newGame(1, 'western-realm');
    const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'militia')] };
    const foe: Army = { id: 901, owner: 'trolls', at: 'x', from: null, troops: [makeTroop(s, 'troll')] };
    const b = createBattle('x', mine, foe, false, 1);
    const troll = b.units.find((u) => u.type === 'troll')!;
    troll.men = 3;
    b.active = 'attacker';
    endSideTurn(b); // the trolls' turn begins
    expect(troll.men).toBe(4);
    expect(b.log.some((l) => /Troll regenerates: 1 back/.test(l))).toBe(true);
  });
});
