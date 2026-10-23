import { describe, expect, it } from 'vitest';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { createBattle, deploymentZone, planDeployment } from './battle';
import { ARMY_CAP, advanceMonth, armyAt, hireQuote, makeTroop, marchQuote, neighborsOf, newGame, recruitQuote } from './campaign';
import { parseSave } from './saves';
import type { Army, GameState } from './types';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function home(s: GameState): Army {
  return armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
}

describe('army cap', () => {
  it('cities can recruit and hire beyond 24 units when their realm supports the people', () => {
    const s = newGame(1, 'western-realm'); s.gold=5000; s.towns.aldenhold.pop=30000;
    const army=home(s); while(army.troops.length<ARMY_CAP+1) army.troops.push(makeTroop(s,'militia'));
    expect(recruitQuote(s,'aldenhold','militia').reason).toBeNull();
    expect(hireQuote(s,s.offers[0]).reason).toBeNull();
  });

  it('troops can’t march into an army that would go over 24', () => {
    const s = newGame(1, 'western-realm');
    const army = home(s);
    const next = neighborsOf(s, army.at).find((k) => marchQuote(s, army.at, [army.troops[1].id], k).reason === null)!;
    const camp: Army = { id: s.nextId++, owner: 'player', at: next, from: null, troops: [] };
    for (let i = 0; i < ARMY_CAP - 1; i++) camp.troops.push(makeTroop(s, 'militia'));
    s.armies.push(camp);
    expect(marchQuote(s, army.at, [army.troops[1].id, army.troops[2].id], next).reason).toMatch(/^Only 1 more unit fits in the army at .+ \(24 at most\)\.$/);
    expect(marchQuote(s, army.at, [army.troops[1].id], next).reason).toBeNull();
  });

  it('the orc Hold stops growing its garrison at 24', () => {
    const s = newGame(1, 'western-realm');
    const lair = armyAt(s, townLocation(s, 'gharzak'), 'orcs')!;
    while (lair.troops.length < ARMY_CAP) lair.troops.push(makeTroop(s, 'warband'));
    s.armies = s.armies.filter((a) => a.owner !== 'orcs' || a === lair);
    s.turn = 2; // the Hold spawns on month 3 and raids on month 4
    advanceMonth(s);
    expect(armyAt(s, townLocation(s, 'gharzak'), 'orcs')!.troops.length).toBeLessThanOrEqual(ARMY_CAP);
  });
});

describe('automatic deployment', () => {
  it('puts healthy strong melee ahead of weak melee, archers, casters and the ruler', () => {
    const s = newGame(1, 'western-realm');
    const a = home(s);
    const militia = a.troops.find((t) => t.type === 'militia')!;
    militia.men = 4;
    const spear = a.troops.find((t) => t.type === 'spearmen')!;
    a.troops.push(makeTroop(s, 'priest'), makeTroop(s, 'mage'));
    const plan = planDeployment(a);
    const at = (type: string) => plan.get(a.troops.find((t) => t.type === type)!.id)!;
    expect(at('spearmen').depth).toBe(0);
    expect(plan.get(spear.id)!.row).toBe(4);
    expect(at('archers').depth).toBe(1);
    expect(at('lord').depth).toBe(1);
    expect(at('priest').depth).toBe(1);
    expect(at('mage').depth).toBe(1);
    expect(plan.get(militia.id)!.row).toBe(5);
  });

  it('ignores older saved custom plans in new battles', () => {
    const s = newGame(1, 'western-realm');
    const a = home(s);
    const spear = a.troops.find((t) => t.type === 'spearmen')!;
    const archer = a.troops.find((t) => t.type === 'archers')!;
    a.tactics = { stance: 'custom', layout: { [String(archer.id)]: { depth: 0, row: 0 } } };
    const restored = reload(s);
    const army = home(restored);
    expect(planDeployment(army).get(archer.id)!.depth).toBe(1);
    expect(planDeployment(army).get(spear.id)!.depth).toBe(0);
    const foe: Army = { id: 999, owner: 'orcs', at: army.at, from: null, troops: [makeTroop(restored, 'warband')] };
    const b = createBattle(army.at, army, foe, false, 1);
    const zone = deploymentZone(b, 'attacker');
    const archers = b.units.find((u) => u.troopId === archer.id)!;
    expect(archers.col).toBe(zone.cols[1]);
    expect(b.stances).toBeUndefined();
  });

  it('removes the editable city battle grid while explaining setup', () => {
    const s = newGame(1, 'western-realm');
    const html = renderCampaign(s, ui(townLocation(s, 'aldenhold')));
    expect(html).toContain('toughest melee units set up in front');
    expect(html).not.toContain('data-action="tactics-cell"');
    expect(html).not.toContain('data-action="set-stance"');
  });
});

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}
