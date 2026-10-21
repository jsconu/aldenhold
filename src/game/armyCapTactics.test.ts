import { describe, expect, it } from 'vitest';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { createBattle, holdsGround, planDeployment, runAI } from './battle';
import { ARMY_CAP, advanceMonth, armyAt, hireQuote, makeTroop, marchQuote, moveTroops, neighborsOf, newGame, recruitQuote } from './campaign';
import { parseSave } from './saves';
import { placeFormation, setStance } from './tactics';
import type { Army, GameState } from './types';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function home(s: GameState): Army {
  return armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
}

describe('army cap', () => {
  it('a full army takes no recruits or hired heroes', () => {
    const s = newGame(1, 'western-realm');
    s.gold = 5000;
    const army = home(s);
    while (army.troops.length < ARMY_CAP) army.troops.push(makeTroop(s, 'militia'));
    expect(recruitQuote(s, 'aldenhold', 'militia').reason).toBe('The army at Aldenhold is full: 12 formations is the most one army can hold.');
    expect(hireQuote(s, s.offers[0]).reason).toMatch(/is full: 12 formations/);
    army.troops.pop();
    expect(recruitQuote(s, 'aldenhold', 'militia').reason).toBeNull();
  });

  it('troops can’t march into an army that would go over 12', () => {
    const s = newGame(1, 'western-realm');
    const army = home(s);
    const next = neighborsOf(s, army.at).find((k) => marchQuote(s, army.at, [army.troops[1].id], k).reason === null)!;
    const camp: Army = { id: s.nextId++, owner: 'player', at: next, from: null, troops: [] };
    for (let i = 0; i < ARMY_CAP - 1; i++) camp.troops.push(makeTroop(s, 'militia'));
    s.armies.push(camp);
    expect(marchQuote(s, army.at, [army.troops[1].id, army.troops[2].id], next).reason).toMatch(/^Only 1 more formation fits in the army at .+ \(12 at most\)\.$/);
    expect(marchQuote(s, army.at, [army.troops[1].id], next).reason).toBeNull();
  });

  it('the orc Hold stops growing its garrison at 12', () => {
    const s = newGame(1, 'western-realm');
    const lair = armyAt(s, townLocation(s, 'gharzak'), 'orcs')!;
    while (lair.troops.length < ARMY_CAP) lair.troops.push(makeTroop(s, 'warband'));
    s.armies = s.armies.filter((a) => a.owner !== 'orcs' || a === lair);
    s.turn = 2; // the Hold spawns on month 3 and raids on month 4
    advanceMonth(s);
    expect(armyAt(s, townLocation(s, 'gharzak'), 'orcs')!.troops.length).toBeLessThanOrEqual(ARMY_CAP);
  });
});

describe('tactics', () => {
  function plan(stance: 'offensive' | 'defensive' | 'skirmish') {
    const s = newGame(1, 'western-realm');
    const army = home(s); // lord, militia, militia, spearmen, archers
    setStance(s, army.id, stance);
    const p = planDeployment(army);
    const cellOf = (type: string) => p.get(army.troops.find((t) => t.type === type)!.id)!;
    return { s, army, cellOf };
  }

  it('Offensive: melee and the lord in front, archers behind (the old setup)', () => {
    const { cellOf } = plan('offensive');
    expect(cellOf('spearmen').depth).toBe(0);
    expect(cellOf('lord').depth).toBe(0);
    expect(cellOf('archers').depth).toBe(1);
  });

  it('Defensive: a melee line, archers behind, the lord safe at the back', () => {
    const { cellOf } = plan('defensive');
    expect(cellOf('spearmen').depth).toBe(0);
    expect(cellOf('archers').depth).toBe(1);
    expect(cellOf('lord').depth).toBe(2);
  });

  it('Skirmish: archers out front on a flank, melee in the middle column', () => {
    const { cellOf } = plan('skirmish');
    expect(cellOf('archers')).toEqual({ depth: 0, row: 0 });
    expect(cellOf('spearmen').depth).toBe(1);
  });

  it('Custom: placing a formation swaps it with whoever was there, and battles start from the plan', () => {
    let s = newGame(1, 'western-realm');
    const army = home(s);
    const archers = army.troops.find((t) => t.type === 'archers')!;
    const spear = army.troops.find((t) => t.type === 'spearmen')!;
    const spearCell = planDeployment(army).get(spear.id)!;
    const archerCell = planDeployment(army).get(archers.id)!;
    expect(placeFormation(s, army.id, archers.id, spearCell)).toBeNull();
    expect(army.tactics!.stance).toBe('custom');
    expect(planDeployment(army).get(archers.id)).toEqual(spearCell);
    expect(planDeployment(army).get(spear.id)).toEqual(archerCell);
    s = reload(s);
    const restored = home(s);
    const foe: Army = { id: 999, owner: 'orcs', at: restored.at, from: null, troops: [makeTroop(s, 'warband')] };
    const b = createBattle(restored.at, restored, foe, false, 1);
    const unit = b.units.find((u) => u.troopId === archers.id)!;
    expect({ col: unit.col, row: unit.row }).toEqual({ col: [2, 1, 0][spearCell.depth], row: spearCell.row });
    expect(b.stances).toEqual({ attacker: 'custom' });
  });

  it('a Defensive army holds its ground until the enemy comes within 3 hexes', () => {
    const s = newGame(1, 'western-realm');
    const army = home(s);
    setStance(s, army.id, 'defensive');
    const foe: Army = { id: 999, owner: 'orcs', at: army.at, from: null, troops: [makeTroop(s, 'warband')] };
    const b = createBattle(army.at, foe, army, false, 1);
    for (const col of b.terrain) col.fill('plain');
    const mine = b.units.filter((u) => u.side === 'defender');
    const before = mine.map((u) => [u.col, u.row]);
    expect(mine.every((u) => holdsGround(b, u))).toBe(true);
    b.active = 'defender';
    runAI(b);
    expect(mine.map((u) => [u.col, u.row])).toEqual(before);
  });

  it('marching troops keep their army’s plan, and saves reject a broken layout', () => {
    const s = newGame(1, 'western-realm');
    const army = home(s);
    setStance(s, army.id, 'skirmish');
    const next = neighborsOf(s, army.at).find((k) => marchQuote(s, army.at, army.troops.map((t) => t.id), k).reason === null)!;
    expect(moveTroops(s, army.at, army.troops.map((t) => t.id), next)).toBeNull();
    expect(armyAt(s, next, 'player')!.tactics).toEqual({ stance: 'skirmish' });
    const broken = structuredClone(s);
    armyAt(broken, next, 'player')!.tactics = { stance: 'custom', layout: { '1': { depth: 3, row: 0 } } };
    expect(() => reload(broken)).toThrow(/custom layout/);
  });

  it('shows the battle plan with its stance buttons and deployment grid', () => {
    const s = newGame(1, 'western-realm');
    const html = renderCampaign(s, ui(townLocation(s, 'aldenhold')));
    expect(html).toContain('Battle plan: Offensive');
    expect(html).toContain('data-action="set-stance"');
    expect(html).toContain('<th>Back</th><th>Middle</th><th>Front</th>');
    expect(html).toMatch(/data-action="tactics-cell"[^>]*>\s*Aldric<\/button>|>Aldric<\/button>/);
  });
});

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}
