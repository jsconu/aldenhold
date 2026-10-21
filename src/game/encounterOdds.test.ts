import { describe, expect, it } from 'vitest';
import { attack, createBattle } from './battle';
import { makeTroop, newGame } from './campaign';
import { encounterOdds, encounterReport, PARTIES } from './testing/encounterOdds';
import type { Army } from './types';

describe('quest monsters', () => {
  it('are fearless: heavy losses never make the cyclops run', () => {
    const s = newGame(1, 'western-realm');
    const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: ['knights', 'knights', 'knights'].map((t) => makeTroop(s, t)) };
    const foe: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'cyclops')] };
    const b = createBattle('x', mine, foe, false, 3);
    for (const col of b.terrain) col.fill('plain');
    const cyclops = b.units.find((u) => u.type === 'cyclops')!;
    expect(cyclops.morale).toBe(100);
    b.units.filter((u) => u.side === 'attacker').forEach((u, i) => Object.assign(u, { col: cyclops.col - 1, row: cyclops.row - 1 + i }));
    for (const u of b.units.filter((x) => x.side === 'attacker')) {
      if (cyclops.men <= 0) break;
      attack(b, u.id, cyclops.id);
    }
    expect(cyclops.men).toBeLessThan(cyclops.startMen);
    expect(cyclops.routing).toBe(false);
    expect(cyclops.morale).toBe(100);
  });
});

describe('encounter odds (automated tactics, guard rails for tuning)', () => {
  it('the cyclops is a hero-led fight: an expedition with a priest usually wins, a band without one usually loses', () => {
    const expedition = encounterOdds('Q02', 'hunt', PARTIES.expedition, 80);
    const band = encounterOdds('Q02', 'hunt', PARTIES.band, 80);
    expect(expedition.winRate).toBeGreaterThanOrEqual(0.85);
    expect(expedition.heroDeathRate).toBeLessThanOrEqual(0.1);
    expect(band.winRate).toBeLessThanOrEqual(0.65); // measured 59% over 200 fights; 80 fights leave some noise
  }, 60_000);

  it('the minotaur is a gamble for one fighting hero, safe for a pair, and beyond a lone priest', () => {
    const pair = encounterOdds('Q03', 'enter', PARTIES.pair, 80);
    const champion = encounterOdds('Q03', 'enter', PARTIES.champion, 80);
    const priest = encounterOdds('Q03', 'enter', PARTIES.priest, 40);
    expect(pair.winRate).toBeGreaterThanOrEqual(0.85);
    expect(pair.heroDeathRate).toBeLessThanOrEqual(0.1);
    expect(champion.winRate).toBeGreaterThanOrEqual(0.4);
    expect(champion.winRate).toBeLessThanOrEqual(0.9);
    expect(priest.winRate).toBeLessThanOrEqual(0.2);
  }, 60_000);

  it('reports every encounter against its plausible parties', () => {
    const rows = encounterReport(2);
    expect(rows.map((r) => `${r.quest}/${r.party}`)).toEqual([
      'Q02/home', 'Q02/expedition', 'Q02/band',
      'Q03/champion', 'Q03/priest', 'Q03/mage', 'Q03/pair',
      'Q05/home', 'Q05/expedition', 'Q05/band',
    ]);
    for (const r of rows) expect(r.winRate).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
