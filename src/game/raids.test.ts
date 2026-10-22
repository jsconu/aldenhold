import { describe, expect, it } from 'vitest';
import { LAIRS } from '../content/lairs';
import { renderBattle } from '../ui/battleView';
import { renderCampaign } from '../ui/campaignView';
import { renderJournal } from '../ui/journalView';
import type { UIState } from '../ui/shared';
import { autoResolve } from './battle';
import { advanceMonth, applyBattle, armyAt, makeTroop, newGame } from './campaign';
import { garrisonDefense, planRaids, raidOdds, resolveRaids, RAID_GRACE_MONTH, threatSources } from './raids';
import { saveGame } from './saves';
import { frontierReport, garrisonReport } from './testing/raidReport';
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
  }, 20_000);
});

describe('raids', () => {
  /** A raid from this lair on this town, due next month. */
  function announced(lair = 'stonejaw', target = 'westmere', s = westmereYours()): GameState {
    s.raids.push({ lair, target, announced: s.turn, arrives: s.turn + 1 });
    s.lairs[lair].lastRaid = s.turn;
    return s;
  }

  it('goblins harass an undefended town: gold and people, no building damage, and it stays yours', () => {
    const s = announced('briarwood');
    s.turn += 1;
    const gold = s.gold;
    const pop = s.towns.westmere.pop;
    const buildings = { ...s.cityEconomies.westmere.buildings };
    expect(resolveRaids(s)).toEqual(['Westmere was raided.']);
    expect(s.towns.westmere.owner).toBe('player');
    expect(s.gold).toBe(gold - Math.min(gold, 25 * LAIRS.briarwood.raid.strength));
    expect(s.towns.westmere.pop).toBe(pop - 15 * LAIRS.briarwood.raid.strength);
    expect(s.cityEconomies.westmere.buildings).toEqual(buildings);
    expect(s.treasury.pending.some((e) => e.category === 'raid-loss')).toBe(true);
    expect(s.raids).toEqual([]);
    expect(s.raidLog).toEqual([{ turn: s.turn, lair: 'briarwood', target: 'westmere', result: 'plundered', battle: false, gold: gold - s.gold, people: pop - s.towns.westmere.pop, damaged: null, garrisonLost: 0, raidersLost: 0 }]);
    expect(reload(s).towns.westmere.owner).toBe('player');
  });

  it('a giants’ siege also knocks down a building, but the town stays yours', () => {
    const s = announced();
    s.turn += 1;
    const farms = s.cityEconomies.westmere.buildings.farm;
    expect(farms).toBeGreaterThan(0);
    expect(resolveRaids(s)).toEqual(['Westmere was sacked.']);
    expect(s.towns.westmere.owner).toBe('player');
    expect(s.cityEconomies.westmere.buildings.farm).toBe(farms - 1);
    expect(s.raidLog.at(-1)).toMatchObject({ result: 'sacked', damaged: 'farm' });
    expect(s.journal.at(-1)!.text).toMatch(/sacked Westmere: .* the farms lost a level\. The town is still yours\./);
    expect(() => reload(s)).not.toThrow();
  });

  it('titans take a town they win, but never your capital', () => {
    const s = announced('eldersanctum');
    s.turn += 1;
    expect(resolveRaids(s)).toEqual(['Westmere was taken.']);
    expect(s.towns.westmere.owner).toBe('titans');
    const holders = s.armies.find((a) => a.at === townLocation(s, 'westmere'))!;
    expect(holders).toMatchObject({ owner: 'titans' });
    expect(holders.raid).toBeUndefined();
    expect(reload(s).towns.westmere.owner).toBe('titans');

    const c = newGame(1, 'western-realm');
    c.turn = RAID_GRACE_MONTH;
    c.armies = c.armies.filter((a) => a.at !== townLocation(c, 'aldenhold'));
    announced('eldersanctum', 'aldenhold', c);
    c.turn += 1;
    expect(resolveRaids(c)).toEqual(['Aldenhold was sacked.']);
    expect(c.towns.aldenhold.owner).toBe('player');
    expect(c.armies.some((a) => a.owner === 'titans' && a.at === townLocation(c, 'aldenhold'))).toBe(false);
  });

  it('every raid is announced with what losing it would cost, and long warnings get a reminder', () => {
    const s = westmereYours();
    s.raids.push({ lair: 'eldersanctum', target: 'westmere', announced: s.turn, arrives: s.turn + 3 });
    const html = renderCampaign(s, ui(townLocation(s, 'westmere')));
    expect(html).toContain('Raid expected in 3 months: titans from an unknown lair. This is a siege: if they win, they plunder, knock down a building and take the town.');
    s.turn += 1;
    expect(resolveRaids(s)).toEqual([]);
    s.turn += 1;
    expect(resolveRaids(s)).toEqual(['Raiders reach Westmere next month.']);
    expect(s.journal.at(-1)!.text).toBe('Titans from an unknown lair will reach Westmere next month.');
    expect(s.raids).toHaveLength(1);
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
    expect(s.battle!.walls).toBe(true);
    expect(s.battle!.raid).toEqual({ lair: 'stonejaw', town: 'westmere' });
    autoResolve(s.battle!);
    expect(renderBattle(s, ui(''))).toMatch(/The raid is beaten off\. Westmere is safe\.|The raiders break into Westmere\. They plunder it and knock down a building\. The town stays yours\./);
    applyBattle(s, s.battle!);
    expect(s.towns.westmere.owner).toBe('player');
    expect(s.armies.some((a) => a.raid)).toBe(false);
    expect(s.journal.at(-1)!.text).toMatch(/sacked Westmere|was beaten off/);
    const entry = s.raidLog.at(-1)!;
    expect(entry).toMatchObject({ lair: 'stonejaw', target: 'westmere', battle: true });
    expect(['beaten-off', 'sacked']).toContain(entry.result);
    expect(entry.garrisonLost + entry.raidersLost).toBeGreaterThan(0);
  });

  it('a garrison that loses still cuts the plunder by the raiders it killed', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = announced();
      s.seed = seed;
      garrison(s, 'westmere', ['militia', 'archers']);
      s.turn += 1;
      resolveRaids(s);
      autoResolve(s.battle!);
      applyBattle(s, s.battle!);
      const entry = s.raidLog.at(-1)!;
      if (entry.result !== 'sacked' || !entry.raidersLost) continue;
      expect(entry.gold).toBeLessThan(25 * LAIRS.stonejaw.raid.strength);
      expect(entry.people).toBeLessThan(15 * LAIRS.stonejaw.raid.strength);
      return;
    }
    throw new Error('no seed had the garrison lose after hurting the raiders');
  });

  it('raid results survive saving and reloading, and appear in the journal’s raid history', () => {
    const s = announced('briarwood');
    s.turn += 1;
    resolveRaids(s);
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as Storage;
    expect(saveGame(storage, s)).toBeNull();
    const again = reload(s);
    expect(again.raidLog).toEqual(s.raidLog);
    const journal = renderJournal(again);
    expect(journal).toContain('<h2>Raids</h2>');
    expect(journal).toMatch(/<b>Westmere<\/b>, goblins from an unknown lair: .*Plundered \(\d+ gold; \d+ people\)\./);
    expect(renderCampaign(again, ui(townLocation(again, 'westmere')))).toContain('Last raids:');
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
      const warning = s.raids[0].arrives - s.turn;
      expect(s.raids[0].arrives - s.raids[0].announced).toBe(LAIRS[s.raids[0].lair].species === 'giants' ? 2 : 1);
      expect(report.phases.find((p) => p.id === 'raids')!.notes.map((n) => n.text)).toContain(`Raid expected at Westmere ${warning === 1 ? 'next month' : `in ${warning} months`}.`);
      expect(s.journal.at(-1)!.text).toMatch(/^Warning: (Giants|Goblins) from an unknown lair are gathering to raid Westmere (next month|in 2 months)\. /);
      const again = reload(s);
      expect(again.raids).toEqual(s.raids);
      expect(planRaids(again)).toEqual([]);
      return;
    }
    throw new Error('no seed planned a raid');
  });

  it('save validation rejects forged raids, raiders and raid records', () => {
    const s = announced();
    const forged = structuredClone(s);
    forged.raids[0].arrives = forged.turn + 5;
    expect(() => reload(forged)).toThrow(/pending raid/);
    const record = structuredClone(s);
    record.raidLog.push({ turn: record.turn, lair: 'stonejaw', target: 'westmere', result: 'turned-back', battle: false, gold: 0, people: 0, damaged: null, garrisonLost: 3, raidersLost: 0 });
    expect(() => reload(record)).toThrow(/raid record/);
    const odd = structuredClone(s);
    odd.armies.push({ id: odd.nextId++, owner: 'goblins', at: townLocation(s, 'westmere'), from: null, raid: { lair: 'stonejaw' }, troops: [makeTroop(odd, 'giant')] });
    expect(() => reload(odd)).toThrow(/raiding party/);
  });

  it('the town panel shows the threat, the odds and what would deter raids, and a warning when one is due', () => {
    const s = announced();
    const html = renderCampaign(s, ui(townLocation(s, 'westmere')));
    expect(html).toContain('<h3>Raid threat</h3>');
    expect(html).toContain('Raid expected next month: giants from an unknown lair. This is a siege: if they win, they plunder and knock down a building; the town stays yours.');
    expect(html).toMatch(/\d+% chance of a raid each month\. Garrison 0\.0 against a threat of \d\.\d; \d\.\d would deter raids\./);
    expect(garrisonDefense(s, 'westmere')).toBe(0);
  });
});

describe('raid saves', () => {
  it('a version 15 save gains an empty raid log', () => {
    const s = westmereYours() as unknown as Record<string, unknown>;
    s.version = 15;
    delete s.raidLog;
    const migrated = parseSave(JSON.stringify(s));
    expect(migrated.version).toBe(17);
    expect(migrated.raidLog).toEqual([]);
  });
});

describe('raid balance (seeded)', () => {
  it('a garrison that deters a lair really does beat its raids, and raids thin out as garrisons grow', () => {
    for (const row of garrisonReport(12)) {
      if (row.deterred) expect(row.held, `${row.lair} vs ${row.garrison}`).toBeGreaterThanOrEqual(0.9);
      if (row.garrison === 'none') expect(row.held).toBe(0);
    }
    const frontier = Object.fromEntries(frontierReport([1, 2], 12).map((r) => [r.garrison, r]));
    expect(frontier.none.raidsPerTownYear).toBeGreaterThan(frontier.strong.raidsPerTownYear);
    expect(frontier.none.gold).toBeGreaterThan(frontier['spears and bows'].gold);
    expect(frontier.strong.raidsPerTownYear).toBe(0);
  }, 60000);
});
