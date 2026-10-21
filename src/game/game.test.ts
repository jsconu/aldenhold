import { isHero } from './units';
import { describe, expect, it } from 'vitest';
import { stepTowardTarget } from './ai';
import { alive, attackTargets, autoResolve, createBattle, reachable, deploymentZone } from './battle';
import {
  applyBattle, armyAt, endTurn, makeTroop, monthlyIncome, monthlyUpkeep, moveTroops, newGame, recruit,
} from './campaign';
import { hexDistance, hexNeighbors } from './hex';
import type { Army, GameState } from './types';

function army(state: GameState, owner: Army['owner'], at: string, types: string[]): Army {
  const a: Army = { id: state.nextId++, owner, at, from: null, troops: types.map((t) => makeTroop(state, t)) };
  state.armies.push(a);
  return a;
}

describe('hex grid', () => {
  it('neighbors are all at distance 1', () => {
    for (const h of [{ col: 3, row: 3 }, { col: 4, row: 3 }, { col: 0, row: 0 }]) {
      const ns = hexNeighbors(h);
      expect(ns).toHaveLength(6);
      for (const n of ns) expect(hexDistance(h, n)).toBe(1);
    }
  });

  it('measures distance across columns', () => {
    expect(hexDistance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3);
    expect(hexDistance({ col: 0, row: 0 }, { col: 0, row: 4 })).toBe(4);
  });
});

describe('economy', () => {
  it('recruiting costs gold and population and adds a troop that cannot march yet', () => {
    const s = newGame(1);
    const pop = s.towns.aldenhold.pop;
    const before = armyAt(s, 'aldenhold', 'player')!.troops.length;
    expect(recruit(s, 'aldenhold', 'spearmen')).toBeNull();
    expect(s.gold).toBe(300 - 120);
    expect(s.towns.aldenhold.pop).toBe(pop - 20);
    const troops = armyAt(s, 'aldenhold', 'player')!.troops;
    expect(troops).toHaveLength(before + 1);
    expect(troops.at(-1)!.mp).toBe(0);
  });

  it('refuses knights outside the capital and recruits you cannot afford', () => {
    const s = newGame(1);
    expect(recruit(s, 'millbrook', 'knights')).not.toBeNull();
    s.gold = 10;
    expect(recruit(s, 'aldenhold', 'militia')).toMatch(/gold/);
  });

  it('pays income minus upkeep at month end', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.owner === 'player');
    const expected = s.gold + monthlyIncome(s) - monthlyUpkeep(s);
    endTurn(s);
    expect(s.gold).toBe(expected);
    expect(s.turn).toBe(2);
  });

  it('troops desert when the treasury runs dry', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.owner === 'player');
    for (const t of Object.values(s.towns)) t.tax = 0;
    s.gold = 0;
    const count = s.armies.flatMap((a) => a.troops).length;
    endTurn(s);
    expect(s.armies.flatMap((a) => a.troops).length).toBe(count - 1);
  });
});

describe('marching', () => {
  it('moves selected troops to an empty neighbor and splits the army', () => {
    const s = newGame(1);
    const home = armyAt(s, 'aldenhold', 'player')!;
    const first = home.troops[0].id;
    expect(moveTroops(s, 'aldenhold', [first], 'bridge')).toBeNull();
    expect(armyAt(s, 'bridge', 'player')!.troops.map((t) => t.id)).toEqual([first]);
    expect(armyAt(s, 'aldenhold', 'player')!.troops).toHaveLength(4);
    // Already marched this month.
    expect(moveTroops(s, 'bridge', [first], 'aldenhold')).not.toBeNull();
  });

  it('rejects moves to places that are not adjacent', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    expect(moveTroops(s, 'aldenhold', ids, 'gharzak')).not.toBeNull();
  });

  it('marching into a defended town starts a battle; winning takes the town', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    moveTroops(s, 'aldenhold', ids, 'fenwick');
    expect(s.battle).not.toBeNull();
    expect(s.battle!.walls).toBe(true);
    autoResolve(s.battle!);
    expect(s.battle!.outcome).toBe('attacker');
    applyBattle(s, s.battle!);
    expect(s.battle).toBeNull();
    expect(s.towns.fenwick.owner).toBe('player');
    expect(armyAt(s, 'fenwick', 'neutral')).toBeUndefined();
    // Every formation gains 1 XP; heroes gain more for their deeds.
    expect(armyAt(s, 'fenwick', 'player')!.troops.every((t) => (isHero(t.type) ? t.xp >= 1 : t.xp === 1))).toBe(true);
  });

  it('a beaten attacker falls back to where it came from', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.at !== 'bridge');
    const weak = army(s, 'player', 'bridge', ['militia']);
    moveTroops(s, 'bridge', weak.troops.map((t) => t.id), 'harrowgate');
    s.battle!.outcome = 'defender';
    s.battle!.retreated = 'attacker';
    applyBattle(s, s.battle!);
    expect(armyAt(s, 'bridge', 'player')).toBeDefined();
    expect(s.towns.harrowgate.owner).toBe('neutral');
  });

  it('taking Gharzak Hold wins the game', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.owner !== 'orcs');
    army(s, 'player', 'pass', ['knights']);
    moveTroops(s, 'pass', [armyAt(s, 'pass', 'player')!.troops[0].id], 'gharzak');
    expect(s.status).toBe('won');
  });
});

describe('orc AI', () => {
  it('heads for the nearest town not held by orcs', () => {
    const s = newGame(1);
    expect(['harrowgate', 'duskwater']).toContain(stepTowardTarget(s, 'pass'));
    expect(stepTowardTarget(s, 'watchtower')).toBe('duskwater');
  });

  it('orcs attacking the player open an interactive battle with the player defending', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.at !== 'pass');
    s.towns.fenwick.owner = 'orcs';
    s.towns.harrowgate.owner = 'orcs';
    s.armies = s.armies.filter((a) => a.owner !== 'neutral');
    army(s, 'orcs', 'bridge', ['warband']);
    endTurn(s);
    const b = s.battle!;
    expect(b).not.toBeNull();
    expect(b.owners.attacker).toBe('orcs');
    expect(b.owners.defender).toBe('player');
    // The AI attacker has already played its first turn; it is now the player's move.
    expect(b.active === 'defender' || b.outcome !== null).toBe(true);
  });
});

describe('battle', () => {
  it('deploys each army in its own zone, the attacker west of the defender', () => {
    const s = newGame(1);
    const a = army(s, 'player', 'x', ['militia', 'archers']);
    const d = army(s, 'orcs', 'x', ['warband']);
    const b = createBattle('x', a, d, false, 7);
    expect(alive(b, 'attacker').every((u) => deploymentZone(b, 'attacker').cols.includes(u.col))).toBe(true);
    expect(alive(b, 'defender').every((u) => deploymentZone(b, 'defender').cols.includes(u.col))).toBe(true);
    expect(Math.max(...alive(b, 'attacker').map((u) => u.col))).toBeLessThan(Math.min(...alive(b, 'defender').map((u) => u.col)));
  });

  it('units cannot move through others and stop next to enemies', () => {
    const s = newGame(1);
    const a = army(s, 'player', 'x', ['militia']);
    const d = army(s, 'orcs', 'x', ['warband']);
    const b = createBattle('x', a, d, false, 7);
    const [me] = alive(b, 'attacker');
    const [foe] = alive(b, 'defender');
    foe.col = me.col + 2;
    foe.row = me.row;
    const reach = reachable(b, me);
    expect(reach.has(`${foe.col},${foe.row}`)).toBe(false);
    expect(attackTargets(b, me)).toHaveLength(0);
  });

  it('archers can shoot at range but not while engaged', () => {
    const s = newGame(1);
    const a = army(s, 'player', 'x', ['archers', 'militia']);
    const d = army(s, 'orcs', 'x', ['warband', 'warband']);
    const b = createBattle('x', a, d, false, 7);
    const archer = alive(b, 'attacker').find((u) => u.type === 'archers')!;
    Object.assign(alive(b, 'attacker').find((u) => u.type === 'militia')!, { col: 0, row: 0 });
    archer.col = 5;
    archer.row = 4;
    const [far, near] = alive(b, 'defender');
    far.col = 8;
    far.row = 4;
    near.col = 11;
    near.row = 8;
    expect(attackTargets(b, archer)).toEqual([far]);
    near.col = 5;
    near.row = 5;
    expect(attackTargets(b, archer)).toEqual([near]);
  });

  it('a much stronger army wins on auto-resolve', () => {
    const s = newGame(1);
    const a = army(s, 'player', 'x', ['knights', 'knights', 'spearmen', 'spearmen', 'archers']);
    const d = army(s, 'orcs', 'x', ['warband']);
    const b = createBattle('x', a, d, false, 3);
    autoResolve(b);
    expect(b.outcome).toBe('attacker');
  });
});

describe('long run', () => {
  it('36 idle months play out without errors', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(seed);
      for (let i = 0; i < 36 && s.status === 'playing'; i++) {
        endTurn(s);
        while (s.battle) {
          autoResolve(s.battle);
          applyBattle(s, s.battle);
        }
      }
      const owners = Object.entries(s.towns).map(([id, t]) => `${id}:${t.owner}`).join(' ');
      console.log(`seed ${seed}: turn ${s.turn} ${s.status} gold ${s.gold} | ${owners}`);
      expect(s.armies.every((a) => a.troops.length > 0)).toBe(true);
    }
  });
});

describe('deployment', () => {
  it('puts missile troops behind the melee line', () => {
    const s = newGame(1);
    const a = army(s, 'player', 'x', ['archers', 'militia', 'spearmen']);
    const d = army(s, 'orcs', 'x', ['orcArchers', 'warband']);
    const b = createBattle('x', a, d, false, 7);
    const col = (side: 'attacker' | 'defender', type: string) => b.units.find((u) => u.side === side && u.type === type)!.col;
    expect(col('attacker', 'archers')).toBeLessThan(col('attacker', 'militia'));
    expect(col('defender', 'orcArchers')).toBeGreaterThan(col('defender', 'warband'));
  });
});
