import { describe, expect, it } from 'vitest';
import { LAIRS } from '../content/lairs';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { autoResolve } from './battle';
import { advanceMonth, applyBattle, armyAt, makeTroop, newGame } from './campaign';
import { garrisonDefense, planRaids, raidOdds, resolveRaids, RAID_GRACE_MONTH, threatSources } from './raids';
import { parseSave } from './saves';
import type { GameState } from './types';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** A game where you hold Westmere (in reach of Stonejaw Crag's giants), its free-town garrison gone. */
function westmereYours(): GameState {
  const s = newGame(1, 'western-realm');
  s.turn = RAID_GRACE_MONTH;
  s.towns.westmere.owner = 'player';
  s.armies = s.armies.filter((a) => a.at !== townLocation(s, 'westmere'));
  return s;
}

function garrison(s: GameState, townId: string, troops: string[]) {
  const at = townLocation(s, townId);
  const army = armyAt(s, at, 'player') ?? (() => { const a = { id: s.nextId++, owner: 'player' as const, at, from: null, troops: [] as GameState['armies'][number]['troops'] }; s.armies.push(a); return a; })();
  for (const t of troops) army.troops.push(makeTroop(s, t));
  return army;
}

describe('raid threat and deterrence', () => {
  it('a town outside every lair’s reach has no raid threat at all', () => {
    const s = newGame(1, 'western-realm');
    expect(threatSources(s, 'aldenhold')).toEqual([]);
    expect(raidOdds(s, 'aldenhold').chance).toBe(0);
  });

  it('a town in reach faces a threat from the lairs that can reach it', () => {
    const s = westmereYours();
    const odds = raidOdds(s, 'westmere');
    expect(odds.sources.map((x) => x.lair.id).sort()).toEqual(['briarwood', 'stonejaw']);
    expect(odds.threat).toBeGreaterThan(0);
    expect(odds.chance).toBeGreaterThan(0);
  });

  it('reinforcing never raises the odds, and a strong enough garrison deters routine raids entirely', () => {
    const s = westmereYours();
    let last = raidOdds(s, 'westmere').chance;
    for (let i = 0; i < 8; i++) {
      garrison(s, 'westmere', ['spearmen']);
      const now = raidOdds(s, 'westmere');
      expect(now.chance).toBeLessThanOrEqual(last);
      last = now.chance;
    }
    const odds = raidOdds(s, 'westmere');
    expect(odds.deterred).toBe(true);
    expect(odds.chance).toBe(0);
    expect(odds.defense).toBeGreaterThanOrEqual(odds.needed);
  });

  it('clearing a lair removes its pressure, and only its own', () => {
    const s = westmereYours();
    const before = raidOdds(s, 'westmere').threat;
    s.lairs.stonejaw = { ...s.lairs.stonejaw, status: 'cleared', discovered: true, clearedTurn: 1 };
    const after = raidOdds(s, 'westmere');
    expect(after.sources.map((x) => x.lair.id)).toEqual(['briarwood']);
    expect(after.threat).toBeLessThan(before);
  });

  it('planning is repeatable for the same state, waits for the grace month, and runs once per town', () => {
    const plan = (seed: number, turn: number) => {
      const s = westmereYours();
      s.seed = seed;
      s.turn = turn;
      planRaids(s);
      return s.raids;
    };
    expect(plan(7, RAID_GRACE_MONTH - 1)).toEqual([]);
    for (let seed = 1; seed < 40; seed++) expect(plan(seed, RAID_GRACE_MONTH)).toEqual(plan(seed, RAID_GRACE_MONTH));
    const planned = Array.from({ length: 200 }, (_, i) => plan(i + 1, RAID_GRACE_MONTH).length);
    expect(Math.max(...planned)).toBe(1);
    expect(planned.some((n) => n === 1)).toBe(true);
  });
});

describe('raids', () => {
  function announced(): GameState {
    const s = westmereYours();
    s.raids.push({ lair: 'stonejaw', target: 'westmere', announced: s.turn, arrives: s.turn + 1 });
    s.lairs.stonejaw.lastRaid = s.turn;
    return s;
  }

  it('an undefended town is plundered of gold and people, and stays yours', () => {
    const s = announced();
    s.turn += 1;
    const gold = s.gold;
    const pop = s.towns.westmere.pop;
    expect(resolveRaids(s)).toEqual(['Westmere was raided.']);
    expect(s.towns.westmere.owner).toBe('player');
    expect(s.gold).toBe(gold - Math.min(gold, 25 * LAIRS.stonejaw.raid.strength));
    expect(s.towns.westmere.pop).toBe(pop - 15 * LAIRS.stonejaw.raid.strength);
    expect(s.treasury.pending.some((e) => e.category === 'raid-loss')).toBe(true);
    expect(s.raids).toEqual([]);
    expect(reload(s).towns.westmere.owner).toBe('player');
  });

  it('a garrison fights the raiders in a battle you can play; win or lose, the town is never taken', () => {
    const s = announced();
    garrison(s, 'westmere', ['militia']);
    s.turn += 1;
    expect(resolveRaids(s)).toEqual(['Raiders attack Westmere.']);
    expect(s.battle).not.toBeNull();
    const raiders = s.armies.find((a) => a.raid)!;
    expect(raiders).toMatchObject({ owner: 'giants', raid: { lair: 'stonejaw' } });
    expect(() => reload(s)).not.toThrow();
    autoResolve(s.battle!);
    applyBattle(s, s.battle!);
    expect(s.towns.westmere.owner).toBe('player');
    expect(s.armies.some((a) => a.raid)).toBe(false);
    expect(s.journal.at(-1)!.text).toMatch(/raided Westmere|was beaten off/);
  });

  it('reinforcing before the raid arrives turns the raiders back', () => {
    const s = announced();
    garrison(s, 'westmere', Array(8).fill('spearmen'));
    s.turn += 1;
    expect(resolveRaids(s)).toEqual(['The raid on Westmere turned back.']);
    expect(s.battle).toBeNull();
  });

  it('a raid is announced a month ahead in the month report, and reloading never plans it twice', () => {
    for (let seed = 1; seed < 80; seed++) {
      const s = westmereYours();
      s.seed = seed;
      s.armies = s.armies.filter((a) => a.owner !== 'orcs');
      const report = advanceMonth(s)!;
      if (!s.raids.length) continue;
      expect(report.phases.find((p) => p.id === 'raids')!.notes.map((n) => n.text)).toContain('Raid expected at Westmere.');
      expect(s.journal.at(-1)!.text).toMatch(/^Warning: Giants from an unknown lair are gathering to raid Westmere next month/);
      const again = reload(s);
      expect(again.raids).toEqual(s.raids);
      expect(planRaids(again)).toEqual([]);
      return;
    }
    throw new Error('no seed planned a raid');
  });

  it('save validation rejects forged raids and raiders', () => {
    const s = announced();
    const forged = structuredClone(s);
    forged.raids[0].arrives = forged.turn + 5;
    expect(() => reload(forged)).toThrow(/pending raid/);
    const odd = structuredClone(s);
    odd.armies.push({ id: odd.nextId++, owner: 'goblins', at: townLocation(s, 'westmere'), from: null, raid: { lair: 'stonejaw' }, troops: [makeTroop(odd, 'giant')] });
    expect(() => reload(odd)).toThrow(/raiding party/);
  });

  it('the town panel shows the threat, the odds and what would deter raids, and a warning when one is due', () => {
    const s = announced();
    const html = renderCampaign(s, ui(townLocation(s, 'westmere')));
    expect(html).toContain('<h3>Raid threat</h3>');
    expect(html).toContain('Raid expected next month: giants from an unknown lair.');
    expect(html).toMatch(/\d+% chance of a raid each month\. Garrison 0\.0 against a threat of \d\.\d; \d\.\d would deter raids\./);
    expect(garrisonDefense(s, 'westmere')).toBe(0);
  });
});
