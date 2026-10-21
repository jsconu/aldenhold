import { describe, expect, it } from 'vitest';
import { autoResolve } from './battle';
import { advanceMonth, applyBattle, MONTH_ORDER, newGame } from './campaign';
import type { GameState } from './types';

/** A game where the orcs' next move is an attack on the player's capital from Stone Bridge. */
function orcsAboutToAttack(): GameState {
  const s = newGame(1);
  s.armies = s.armies.filter((a) => a.at !== 'pass' && a.owner !== 'neutral');
  for (const id of ['fenwick', 'harrowgate']) s.towns[id].owner = 'orcs';
  s.armies.push({ id: s.nextId++, owner: 'orcs', at: 'bridge', from: null,
    troops: [{ id: s.nextId++, type: 'warband', men: 20, xp: 0, mp: 1, gear: { bow: null, armor: 'leather' }, refit: null }] });
  return s;
}

describe('month pipeline', () => {
  it('runs its phases in the documented order, every month', () => {
    expect(MONTH_ORDER).toEqual([
      'snapshot', 'cities', 'population', 'heroes', 'treasury', 'construction', 'refits', 'shortages',
      'desertion', 'calendar', 'offers', 'quests', 'ai', 'ending',
    ]);
    const s = newGame(1);
    const report = advanceMonth(s)!;
    expect(report.month).toBe(1);
    expect(report.phases.map((p) => p.id)).toEqual(MONTH_ORDER);
    expect(s.turn).toBe(2);
    expect(report.ledger).not.toBeNull();
  });

  it('writes the chronicle and journal from the report, in phase order', () => {
    const s = newGame(1);
    s.gold = 0;
    for (const t of Object.values(s.towns)) t.tax = 0; // nothing to pay wages with: someone deserts
    s.treasury.opening = 0;
    const journalBefore = s.journal.length;
    const report = advanceMonth(s)!;
    const deserted = report.phases.find((p) => p.id === 'desertion')!.notes;
    expect(deserted).toEqual([{ text: expect.stringMatching(/desert at/), deed: { kind: 'realm', place: expect.any(String) } }]);
    expect(s.journal.slice(journalBefore).map((j) => j.text)).toContain(deserted[0].text);
    // Every note became a chronicle line, in phase order (the chronicle lists newest first).
    const written = report.phases.flatMap((p) => p.notes.map((n) => n.text));
    expect(written.length).toBeGreaterThan(0);
    const newest = s.log.slice(0, written.length).reverse().map((line) => line.replace(/^[^:]+: /, ''));
    expect(newest).toEqual(written);
  });

  it('does nothing during a battle or after the campaign has ended', () => {
    const s = newGame(1);
    s.status = 'won';
    expect(advanceMonth(s)).toBeNull();
    expect(s.turn).toBe(1);
  });

  it('a battle the orcs start is fought after the month closes, without re-running the month', () => {
    const s = orcsAboutToAttack();
    const report = advanceMonth(s)!;
    expect(report.phases.map((p) => p.id)).toEqual(MONTH_ORDER); // the month finished, ending check included
    expect(report.battlePending).toBe(true);
    expect(s.battle!.owners).toEqual({ attacker: 'orcs', defender: 'player' });
    const turn = s.turn;
    const gold = s.gold;
    const ledgerEntries = s.treasury.pending.length;
    autoResolve(s.battle!);
    applyBattle(s, s.battle!);
    expect([s.turn, s.gold, s.treasury.pending.length]).toEqual([turn, gold, ledgerEntries]);
  });

  it('is deterministic: the same seed gives the same reports and the same world', () => {
    const run = () => {
      const s = newGame(7);
      const reports = Array.from({ length: 6 }, () => {
        const r = advanceMonth(s);
        while (s.battle) {
          autoResolve(s.battle);
          applyBattle(s, s.battle);
        }
        return r;
      });
      return { reports, state: JSON.stringify(s) };
    };
    expect(run()).toEqual(run());
  });
});
