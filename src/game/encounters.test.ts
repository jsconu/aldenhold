import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { autoResolve, createBattle, playerEndTurn, retreat } from './battle';
import { applyBattle, armyAt, makeTroop, neighborsOf, newGame, startLocation } from './campaign';
import { yieldFactor } from './cities';
import { heldQty } from './items';
import { advanceQuests, chooseQuest, onTownOwnershipChange, questQuote } from './quests';
import { parseSave } from './saves';
import type { Army, GameState } from './types';
import { landAt, townLocation } from './world';
import { LAND } from '../content/rules';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** Your home army, marched straight to a place. */
function sendHome(s: GameState, place: string): Army {
  const army = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  army.at = startLocation(s, place);
  return army;
}

/** Strengthen an army so its fights can be won. */
function reinforce(s: GameState, army: Army, n = 4) {
  for (let i = 0; i < n; i++) army.troops.push(makeTroop(s, 'knights'));
}

/** Fight the current battle to the end, keeping at it (a fresh attempt each time) until the quest moves on. */
function fightUntilWon(s: GameState, quest: string, choice: string) {
  for (let attempt = 0; attempt < 6 && s.quests[quest].status !== 'succeeded'; attempt++) {
    expect(chooseQuest(s, quest, choice)).toBeNull();
    autoResolve(s.battle!);
    applyBattle(s, s.battle!);
  }
  expect(s.quests[quest]).toMatchObject({ status: 'succeeded', resolvedBy: 'encounter' });
}

describe('encounters: Q02 One Eye at the Quarry', () => {
  function offered(): GameState {
    const s = newGame(1, 'western-realm');
    s.turn = 4;
    advanceQuests(s);
    expect(s.quests.Q02.status).toBe('available');
    return s;
  }

  it('needs your army at the quarry, and the card shows there with the battle named', () => {
    const s = offered();
    expect(questQuote(s, 'Q02', 'hunt').reason).toBe('Bring an army to Old Quarry first.');
    sendHome(s, 'quarry');
    expect(questQuote(s, 'Q02', 'hunt').reason).toBeNull();
    const html = renderCampaign(s, ui(startLocation(s, 'quarry')));
    expect(html).toContain('One Eye at the Quarry');
    expect(html).toMatch(/data-choice="hunt"\s*>Hunt the cyclops · battle at Old Quarry/);
  });

  it('starts a battle against the cyclops; retreating leaves the quest open and the cyclops gone from the map', () => {
    let s = offered();
    const army = sendHome(s, 'quarry');
    expect(chooseQuest(s, 'Q02', 'hunt')).toBeNull();
    expect(s.battle!.encounter).toMatchObject({ quest: 'Q02', choice: 'hunt', army: army.id });
    const guardian = s.armies.find((a) => a.id === s.battle!.encounter!.guardian)!;
    expect(guardian.troops.map((t) => t.type)).toEqual(['cyclops']);
    s = reload(s);
    retreat(s.battle!, 'attacker');
    applyBattle(s, s.battle!);
    expect(s.battle).toBeNull();
    expect(s.quests.Q02).toMatchObject({ status: 'active', stage: 'rumor' });
    expect(s.quests.Q02.history.map((h) => h.choice)).toEqual(['hunt', 'hunt:lost']);
    expect(s.armies.some((a) => a.owner === 'orcs' && a.at === startLocation(s, 'quarry'))).toBe(false);
    // Your army stays where it is, ready to try again.
    expect(armyAt(s, startLocation(s, 'quarry'), 'player')).toBeDefined();
    expect(reload(s).quests.Q02.stage).toBe('rumor');
  });

  it('winning clears the quarry once: gold, and a quarter more ore from your mines', () => {
    let s = offered();
    reinforce(s, sendHome(s, 'quarry'));
    const gold = s.gold;
    expect(yieldFactor(s, 'aldenhold', 'mine')).toBe(1);
    fightUntilWon(s, 'Q02', 'hunt');
    expect(s.gold).toBe(gold + 100 + s.treasury.pending.filter(e=>e.category==='battle-spoils').reduce((sum,e)=>sum+e.amount,0));
    expect(s.flags).toContain('quarry-cleared');
    expect(yieldFactor(s, 'aldenhold', 'mine')).toBe(1.25);
    expect(yieldFactor(s, 'aldenhold', 'farm')).toBe(1);
    s = reload(s);
    expect(chooseQuest(s, 'Q02', 'hunt')).toBe('This matter is settled.');
  });

  it('diverting the workers costs a quarter of your ore instead', () => {
    const s = offered();
    expect(chooseQuest(s, 'Q02', 'divert')).toBeNull();
    expect(s.quests.Q02.status).toBe('failed');
    expect(yieldFactor(s, 'aldenhold', 'mine')).toBe(0.75);
    expect(yieldFactor(s, 'fenwick', 'mine')).toBe(1);
  });
});

describe('the cyclops boulder', () => {
  function duel() {
    const s = newGame(1, 'western-realm');
    const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'spearmen')] };
    const foe: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'cyclops')] };
    const b = createBattle('x', mine, foe, false, 7, 'plains');
    const [spear, cyclops] = [b.units.find((u) => u.side === 'attacker')!, b.units.find((u) => u.side === 'defender')!];
    for (const u of b.units) u.reserve = false;
    Object.assign(spear, { col: 4, row: 4 });
    Object.assign(cyclops, { col: 7, row: 4 });
    for (const col of b.terrain) col.fill('plain');
    return { b, spear, cyclops };
  }

  it('takes aim one turn, announcing its target, and throws the next if the target stays in reach', () => {
    const { b, spear, cyclops } = duel();
    const men = spear.men;
    playerEndTurn(b);
    expect(cyclops.aim).toBe(spear.id);
    expect(spear.men).toBe(men);
    expect(b.log.at(-1)).toMatch(/takes aim at Your Spearmen\. Get them out of reach!/);
    playerEndTurn(b);
    expect(cyclops.aim).toBeUndefined();
    expect(spear.men).toBeLessThan(men);
    expect(b.log.some((l) => /hurls a boulder at Your Spearmen/.test(l))).toBe(true);
  });

  it('aims at formations before heroes, so it never quietly snipes your lord', () => {
    const s = newGame(1, 'western-realm');
    const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'lord', 'Aldric'), makeTroop(s, 'militia')] };
    const foe: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'cyclops')] };
    const b = createBattle('x', mine, foe, false, 7, 'plains');
    for (const col of b.terrain) col.fill('plain');
    const lord = b.units.find((u) => u.type === 'lord')!;
    const militia = b.units.find((u) => u.type === 'militia')!;
    const cyclops = b.units.find((u) => u.type === 'cyclops')!;
    Object.assign(lord, { col: 5, row: 4 });
    Object.assign(militia, { col: 4, row: 6 });
    Object.assign(cyclops, { col: 8, row: 4 });
    playerEndTurn(b);
    expect(cyclops.aim).toBe(militia.id);
  });

  it('gives up the throw if the target gets out of reach', () => {
    const { b, spear, cyclops } = duel();
    playerEndTurn(b);
    expect(cyclops.aim).toBe(spear.id);
    spear.col = 0;
    spear.row = 0;
    const men = spear.men;
    playerEndTurn(b);
    expect(spear.men).toBe(men);
    expect(b.log.some((l) => /hurls a boulder/.test(l))).toBe(false);
  });
});

describe('encounters: Q03 Beneath the Old Tower', () => {
  it('is found by reaching the watchtower, and only hired heroes go in, never the lord', () => {
    let s = newGame(1, 'western-realm');
    const army = sendHome(s, 'watchtower');
    advanceQuests(s);
    expect(s.quests.Q03.status).toBe('available');
    expect(questQuote(s, 'Q03', 'enter').reason).toMatch(/council will not risk your lord/);
    const champion = makeTroop(s, 'champion', 'Brannoc');
    army.troops.push(champion);
    expect(chooseQuest(s, 'Q03', 'enter')).toBeNull();
    const e = s.battle!.encounter!;
    const party = s.armies.find((a) => a.id === e.party)!;
    expect(party.troops.map((t) => t.type)).toEqual(['champion']);
    expect(army.troops.some((t) => t.type === 'lord')).toBe(true);
    s = reload(s);
    retreat(s.battle!, 'attacker');
    applyBattle(s, s.battle!);
    // The party comes back out and rejoins the army.
    const home = armyAt(s, startLocation(s, 'watchtower'), 'player')!;
    expect(home.troops.some((t) => t.name === 'Brannoc')).toBe(true);
    expect(s.armies.filter((a) => a.owner === 'player' && a.at === home.at)).toHaveLength(1);
    expect(s.quests.Q03.stage).toBe('trial');
  });

  it('leaving the tower ends it, with no fight', () => {
    const s = newGame(1, 'western-realm');
    sendHome(s, 'watchtower');
    advanceQuests(s);
    expect(chooseQuest(s, 'Q03', 'leave')).toBeNull();
    expect(s.quests.Q03.status).toBe('failed');
    expect(s.battle).toBeNull();
  });
});

describe('encounters: Q05 The Missing Caravan', () => {
  function offered(): GameState {
    const s = newGame(1, 'western-realm');
    s.turn = 5;
    advanceQuests(s);
    expect(s.quests.Q05.status).toBe('available');
    const gv = townLocation(s, 'fenwick');
    armyAt(s, townLocation(s, 'aldenhold'), 'player')!.at = neighborsOf(s, gv)
      .find((k) => Number.isFinite(LAND[landAt(s, k)].move) && !s.armies.some((a) => a.at === k))!;
    return s;
  }

  it('tracking the goblins to the mine and winning frees the caravan, with draughts as the reward', () => {
    let s = offered();
    expect(chooseQuest(s, 'Q05', 'track')).toBeNull();
    expect(s.quests.Q05).toMatchObject({ status: 'active', stage: 'track' });
    const army = s.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.type === 'lord'))!;
    army.at = startLocation(s, 'mine');
    reinforce(s, army, 5);
    fightUntilWon(s, 'Q05', 'raid');
    expect(s.flags).toContain('caravan-rescued');
    expect(heldQty(s, 'healing-draught')).toBe(2);
    s = reload(s);
    expect(s.items['healing-draught']).toEqual({ qty: 2, spent: 0, archived: false });
  });

  it('three months without storming the mine and the caravan is lost', () => {
    const s = offered();
    chooseQuest(s, 'Q05', 'track');
    for (const turn of [6, 7]) {
      s.turn = turn;
      advanceQuests(s);
    }
    expect(s.quests.Q05.status).toBe('active');
    s.turn = 8;
    advanceQuests(s);
    expect(s.quests.Q05).toMatchObject({ status: 'failed', resolvedBy: 'deadline' });
    expect(s.flags).toContain('caravan-lost');
  });

  it('the ransom ends it without a fight', () => {
    const s = offered();
    const gold = s.gold;
    expect(chooseQuest(s, 'Q05', 'ransom')).toBeNull();
    expect(s.gold).toBe(gold - 200);
    expect(s.flags).toEqual(['caravan-ransomed']);
  });

  it('the merchant stays if you take Fenwick, and flees if the orcs do', () => {
    const s = offered();
    s.towns.fenwick.owner = 'player';
    onTownOwnershipChange(s, 'fenwick', 'player');
    expect(s.quests.Q05.status).toBe('available');
    s.towns.fenwick.owner = 'orcs';
    onTownOwnershipChange(s, 'fenwick', 'orcs');
    expect(s.quests.Q05.status).toBe('superseded');
  });
});

describe('encounter rules in saves and content', () => {
  it('rejects a battle that claims to be an encounter it is not', () => {
    const s = newGame(1, 'western-realm');
    s.turn = 4;
    advanceQuests(s);
    sendHome(s, 'quarry');
    chooseQuest(s, 'Q02', 'hunt');
    const forged = structuredClone(s);
    forged.battle!.encounter!.guardian = forged.battle!.attackerId;
    expect(() => reload(forged)).toThrow(/quest encounter/);
    const aimless = structuredClone(s);
    aimless.battle!.units.find((u) => u.side === 'attacker')!.aim = 5;
    expect(() => reload(aimless)).toThrow(/boulder aim/);
  });

  it('validates encounter sites, sides and units', () => {
    const check = (edit: (c: typeof CATALOG) => void) => {
      const copy = structuredClone(CATALOG);
      edit(copy);
      return validateContent(copy).join('\n');
    };
    const hunt = (c: typeof CATALOG) => {
      const then = c.quests.Q02.stages[0].choices[0].then;
      if (!('encounter' in then)) throw new Error('fixture');
      return then.encounter;
    };
    expect(check((c) => (hunt(c).site = 'atlantis'))).toMatch(/encounter at unknown place "atlantis"/);
    expect(check((c) => (hunt(c).owner = 'player'))).toMatch(/fights an invalid faction "player"/);
    expect(check((c) => (hunt(c).troops = ['dragon']))).toMatch(/fights an unknown unit/);
    expect(check((c) => (hunt(c).lose = { stage: 'nowhere' }))).toMatch(/"hunt" leads to unknown stage "nowhere"/);
    expect(check((c) => (c.quests.Q03.prerequisites = [{ kind: 'army-at', place: 'atlantis' }]))).toMatch(/requires unknown place "atlantis"/);
  });
});
