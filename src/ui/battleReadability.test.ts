import { expect, it } from 'vitest';
import { advanceMonth, armyAt, makeTroop, newGame } from '../game/campaign';
import { createBattle } from '../game/battle';
import { heroMaxHp } from '../game/units';
import { townLocation } from '../game/world';
import { renderBattle } from './battleView';
import type { UIState } from './shared';

it('shows one leader with HP, panic, honest noncombatant labels and group-selection controls', () => {
  const s=newGame(1,'western-realm'), a=armyAt(s,townLocation(s,'aldenhold'),'player')!;
  a.troops.push(makeTroop(s,'scout'));
  const d=s.armies.find(a=>a.owner==='orcs')!;
  s.battle=createBattle(a.at,a,d,false,1);
  const ruler=s.battle.units.find(u=>u.type==='lord')!;
  ruler.men-=12;
  s.battle.units.find(u=>u.type==='militia')!.routing=true;
  const ui:UIState={selected:null,checked:new Set(),battleUnit:ruler.id,battleSpell:null,message:'',view:'map'};
  const html=renderBattle(s,ui);
  expect(html).toContain('One leader · 18/30 HP');
  expect(html).toContain('aria-label="Leader health"');
  expect(html).toContain('>PANIC</text>');
  expect(html).not.toContain('>RUN</text>');
  expect(html).toContain('noncombatant: stays outside battle');
  expect(html).not.toContain('reserve (field full)');
  expect(html).toContain('data-action="battle-select-all"');
  expect(html).toContain('data-action="battle-select-none"');
  s.battle.outcome='attacker';
  const result=renderBattle(s,ui);
  expect(result).toContain('12 HP lost · 18/30 HP remaining');
  expect(result).toContain('Wounded');
  expect(result).toContain('0 soldiers lost · 12 leader HP lost');
});

it('enlarges the actual SVG dimensions on zoom without changing the logical field', () => {
  const s=newGame(1),a=s.armies.find(a=>a.owner==='player')!,d=s.armies.find(a=>a.owner==='orcs')!;
  s.battle=createBattle(a.at,a,d,false,1);
  const ui:UIState={selected:null,checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'map'};
  const size=(html:string)=>Number(html.match(/class="field" style="width:(\d+)px/)![1]);
  expect(size(renderBattle(s,{...ui,battleZoom:5}))/size(renderBattle(s,ui))).toBeCloseTo(5/1.8,2);
});

it('a wounded ruler recovers actual HP at month end without exceeding full health', () => {
  const s=newGame(1), ruler=s.armies.flatMap(a=>a.troops).find(t=>t.type==='lord')!;
  ruler.men=18;
  advanceMonth(s);
  expect(ruler.men).toBe(18+Math.ceil(heroMaxHp(ruler.type,ruler.xp)/4));
  advanceMonth(s);
  expect(ruler.men).toBe(heroMaxHp(ruler.type,ruler.xp));
});
