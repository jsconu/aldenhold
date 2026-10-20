import { describe, expect, it } from 'vitest';
import {
  alive, attack, attackTargets, autoResolve, castSpell, createBattle, endSideTurn, reachable, spellTargets,
} from './battle';
import { applyBattle, armyAt, endTurn, hireHero, lordOf, makeTroop, moveTroops, newGame } from './campaign';
import type { Army, Battle, BattleUnit, GameState } from './types';

function army(state: GameState, owner: Army['owner'], at: string, types: string[]): Army {
  const a: Army = { id: state.nextId++, owner, at, from: null, troops: types.map((t) => makeTroop(state, t, t === 'lord' ? 'Aldric' : undefined)) };
  state.armies.push(a);
  return a;
}

function battle(attackers: string[], defenders: string[]): { b: Battle; mine: BattleUnit[]; foes: BattleUnit[] } {
  const s = newGame(1);
  const b = createBattle('x', army(s, 'player', 'x', attackers), army(s, 'orcs', 'x', defenders), false, 11);
  return { b, mine: alive(b, 'attacker'), foes: alive(b, 'defender') };
}

function place(u: BattleUnit, col: number, row: number) {
  u.col = col;
  u.row = row;
}

describe('morale', () => {
  it('a leader in the army raises starting morale', () => {
    const led = battle(['lord', 'militia'], ['warband']).mine.find((u) => u.type === 'militia')!;
    const unled = battle(['militia'], ['warband']).mine[0];
    expect(led.morale - unled.morale).toBe(15);
  });

  it('losses break a shaken troop, and a side with no one left fighting loses', () => {
    const { b, mine, foes } = battle(['militia'], ['warband']);
    place(mine[0], 5, 4);
    place(foes[0], 6, 4);
    foes[0].morale = 26;
    expect(attack(b, mine[0].id, foes[0].id)).toBe(true);
    expect(foes[0].routing).toBe(true);
    expect(b.outcome).toBe('attacker');
  });

  it('running troops cannot act, head for their edge and leave the field', () => {
    const { b, mine } = battle(['militia', 'spearmen'], ['warband']);
    const runner = mine[0];
    place(runner, 1, 4);
    runner.routing = true;
    runner.morale = 0;
    expect(reachable(b, runner).size).toBe(0);
    expect(attackTargets(b, runner)).toHaveLength(0);
    b.active = 'defender';
    endSideTurn(b);
    expect(runner.fled).toBe(true);
    expect(runner.col).toBe(0);
    expect(alive(b, 'attacker')).not.toContain(runner);
  });

  it('a running troop rallies once its nerve returns', () => {
    const { b, mine } = battle(['militia', 'spearmen'], ['warband']);
    mine[0].routing = true;
    mine[0].morale = 40;
    b.active = 'defender';
    endSideTurn(b);
    expect(mine[0].routing).toBe(false);
    expect(mine[0].fled).toBe(false);
  });

  it('heroes never break', () => {
    const { b, mine, foes } = battle(['lord'], ['troll']);
    place(mine[0], 5, 4);
    place(foes[0], 6, 4);
    b.active = 'defender';
    for (let i = 0; i < 3 && mine[0].men > 0; i++) {
      foes[0].acted = false;
      attack(b, foes[0].id, mine[0].id);
    }
    expect(mine[0].routing).toBe(false);
  });
});

describe('spells', () => {
  it('fireball burns a target in range and costs mana', () => {
    const { b, mine, foes } = battle(['mage', 'militia'], ['warband']);
    const mage = mine.find((u) => u.type === 'mage')!;
    place(mage, 2, 4);
    place(foes[0], 6, 4);
    expect(spellTargets(b, mage, 'fireball')).toContain(foes[0]);
    expect(castSpell(b, mage.id, 'fireball', foes[0].id)).toBe(true);
    expect(foes[0].men).toBe(20 - 6);
    expect(mage.mana).toBe(12 - 4);
    expect(spellTargets(b, mage, 'terror')).toHaveLength(0); // already acted this turn
  });

  it('out-of-range targets and empty mana pools are refused', () => {
    const { b, mine, foes } = battle(['mage', 'militia'], ['warband']);
    const mage = mine.find((u) => u.type === 'mage')!;
    place(mage, 0, 0);
    place(foes[0], 11, 8);
    expect(spellTargets(b, mage, 'fireball')).toHaveLength(0);
    place(foes[0], 3, 0);
    mage.mana = 1;
    expect(castSpell(b, mage.id, 'fireball', foes[0].id)).toBe(false);
  });

  it('heal restores battle losses but never past full strength', () => {
    const { b, mine } = battle(['priest', 'militia'], ['warband']);
    const priest = mine.find((u) => u.type === 'priest')!;
    const troop = mine.find((u) => u.type === 'militia')!;
    troop.men = 12;
    expect(castSpell(b, priest.id, 'heal', troop.id)).toBe(true);
    expect(troop.men).toBe(18);
    priest.acted = false;
    castSpell(b, priest.id, 'heal', troop.id);
    expect(troop.men).toBe(20);
    priest.acted = false;
    expect(spellTargets(b, priest, 'heal')).not.toContain(troop);
  });

  it('rally turns a running troop around', () => {
    const { b, mine } = battle(['priest', 'militia'], ['warband']);
    const priest = mine.find((u) => u.type === 'priest')!;
    const troop = mine.find((u) => u.type === 'militia')!;
    troop.routing = true;
    troop.morale = 10;
    expect(castSpell(b, priest.id, 'rally', troop.id)).toBe(true);
    expect(troop.routing).toBe(false);
  });

  it('the battle AI casts spells', () => {
    const { b } = battle(['militia', 'militia'], ['shaman', 'warband', 'warband']);
    autoResolve(b);
    expect(b.log.some((l) => l.includes('hurls fire'))).toBe(true);
  });
});

describe('heroes on campaign', () => {
  it('starts with the lord and a priest offering service in the capital', () => {
    const s = newGame(1);
    expect(lordOf(s)?.name).toBe('Aldric');
    expect(s.offers).toEqual([expect.objectContaining({ town: 'aldenhold', type: 'priest' })]);
  });

  it('hiring a hero costs gold and adds them to the army there', () => {
    const s = newGame(1);
    expect(hireHero(s, s.offers[0])).toBeNull();
    expect(s.gold).toBe(0);
    expect(s.offers).toHaveLength(0);
    const priest = armyAt(s, 'aldenhold', 'player')!.troops.find((t) => t.type === 'priest')!;
    expect(priest).toMatchObject({ name: 'Brother Osric', mana: 12, men: 18, mp: 0 });
  });

  it('offers lapse after their time is up', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.owner === 'player');
    for (let i = 0; i < 5; i++) endTurn(s);
    expect(s.offers.find((o) => o.name === 'Brother Osric')).toBeUndefined();
  });

  it('heroes mend between battles and refill their mana', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.owner === 'player');
    hireHero(s, s.offers[0]);
    const lord = lordOf(s)!;
    const priest = armyAt(s, 'aldenhold', 'player')!.troops.find((t) => t.type === 'priest')!;
    lord.men = 10;
    priest.mana = 0;
    s.gold = 500;
    endTurn(s);
    expect(lord.men).toBe(10 + Math.ceil(30 / 4));
    expect(priest.mana).toBe(12);
  });

  it('heroes earn extra experience for their deeds', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    moveTroops(s, 'aldenhold', ids, 'fenwick');
    const b = s.battle!;
    b.units.find((u) => u.type === 'lord')!.deeds = 4;
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(lordOf(s)!.xp).toBe(3);
  });

  it('the game is lost if the lord dies', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    moveTroops(s, 'aldenhold', ids, 'fenwick');
    const b = s.battle!;
    b.units.find((u) => u.type === 'lord')!.men = 0;
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(s.status).toBe('lost');
  });

  it('beaten defenders who escape fall back to open country, never into an enemy town', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    moveTroops(s, 'aldenhold', ids, 'fenwick');
    const b = s.battle!;
    const militia = b.units.find((u) => u.side === 'defender')!;
    militia.fled = true;
    b.outcome = 'attacker';
    applyBattle(s, b);
    expect(s.towns.fenwick.owner).toBe('player');
    expect(s.towns.aldenhold.owner).toBe('player');
    // Harrowgate is the nearest town the free folk still hold.
    expect(armyAt(s, 'harrowgate', 'neutral')!.troops).toHaveLength(3);
  });

  it('orc raiding parties leave their heroes at home', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.at === 'gharzak');
    s.turn = 3;
    endTurn(s); // turn 4: raid
    const home = armyAt(s, 'gharzak', 'orcs')!;
    expect(home.troops.filter((t) => t.name).map((t) => t.name).sort()).toEqual(['Gorrash', 'Murg']);
    const raiders = s.armies.filter((a) => a.owner === 'orcs' && a !== home);
    expect(raiders.flatMap((a) => a.troops).every((t) => !t.name)).toBe(true);
  });
});
