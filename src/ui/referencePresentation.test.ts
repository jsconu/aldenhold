import { describe, expect, it } from 'vitest';
import { newGame } from '../game/campaign';
import { createBattle } from '../game/battle';
import { townLocation } from '../game/world';
import { LAIRS } from '../content/lairs';
import { placeScene } from './placeScene';
import { renderBattle } from './battleView';
import type { UIState } from './shared';
const ui: UIState = { selected:null, checked:new Set(), battleUnit:null, battleSpell:null, message:'', view:'map' };
describe('reference-led presentation',()=> {
  it('shows real buildings and construction without changing the save',()=> {
    const s=newGame(1,'western-realm');
    const before=placeScene(s,'aldenhold');
    s.cityEconomies.aldenhold.buildings.forge=1;
    s.cityEconomies.aldenhold.project={kind:'mine',targetLevel:1,startedTurn:1,finishTurn:2,paidGold:140,paidGoods:{}};
    const saved=JSON.stringify(s);
    const after=placeScene(s,'aldenhold');
    expect(after).not.toBe(before);
    expect(after).toContain('Tool Forge 1');
    expect(after).toContain('Under construction: Ore Mine');
    expect(JSON.stringify(s)).toBe(saved);
  });
  it('renders distinct scenes for all four species and marks cleared sites',()=> {
    const s=newGame(1,'western-realm');
    const scenes=Object.values(LAIRS).filter(l=>l.campaignId===s.campaignId).map(l=>placeScene(s,l.place,l.species));
    expect(new Set(scenes).size).toBe(4);
    expect(scenes.join('')).toContain('Titan sanctuary');
    expect(placeScene(s,'aldenhold','goblins',true)).toContain('· cleared');
  });
  it('shows losses, hero death and advancement before continuing, without granting XP during render',()=> {
    const s=newGame(1,'western-realm');
    const mine=s.armies.find(a=>a.owner==='player')!;
    const foe=s.armies.find(a=>a.owner==='orcs')!;
    s.battle=createBattle(townLocation(s,'aldenhold'),mine,foe,false,5);
    s.battle.outcome='attacker';
    s.battle.units.find(u=>u.type==='lord')!.men=0;
    const saved=JSON.stringify(s);
    const html=renderBattle(s,ui);
    expect(html).toContain('Victory at Aldenhold');
    expect(html).toContain('Fallen');
    expect(html).toContain('Enemy army');
    expect(html).toContain('+1 XP');
    expect(html).toContain('Continue to the realm');
    expect(JSON.stringify(s)).toBe(saved);
  });
});

