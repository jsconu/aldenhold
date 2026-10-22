import {describe,it,expect} from 'vitest';
import {createRulerCampaign,SKIN_TONES,RULER_CLASSES} from './rulerCreation';
import {lordOf,armyAt,moveTroops,applyBattle,advanceMonth} from './campaign';
import {knownSpells,castSpell} from './battle';
import {parseSave} from './saves';
import {heroCanUse} from './units';
import {renderRulerSelection} from '../ui/rulerSelection';
import {richUnit} from '../ui/richBattle';
import type {RulerClass} from './types';
describe('playable ruler classes',()=>{
 for(const role of Object.keys(RULER_CLASSES) as RulerClass[])it(role+' keeps identity, appearance, class stats and defeat rules',()=>{
 for(const gender of ['male','female'] as const)for(const skin of SKIN_TONES){
 const s=createRulerCampaign('valley-quickplay',{name:'Rowan',gender,skin,rulerClass:role},1),r=lordOf(s)!;
 expect(r.type).toBe(RULER_CLASSES[role].type);expect(r.name).toBe('Rowan');
 expect(r.men).toBe(role==='knight'?30:role==='priest'?22:18);
 expect(r.mana).toBe(role==='knight'?0:12);expect(heroCanUse(r.type,['lord'])).toBe(true);
 expect(lordOf(parseSave(JSON.stringify(s)))!.type).toBe(r.type);
 expect(richUnit(r.type,0,0,false,s.rulerAppearance)).toContain(RULER_CLASSES[role].art);
 const ids=armyAt(s,'aldenhold','player')!.troops.map(t=>t.id);moveTroops(s,'aldenhold',ids,'fenwick');
 const b=s.battle!,u=b.units.find(u=>u.troopId===r.id)!;
 const spells=knownSpells(u);expect(spells).toEqual(role==='knight'?[]:role==='priest'?['heal','rally']:['fireball','ward']);
 if(role!=='knight'){
 const spell=role==='priest'?'heal':'ward';if(role==='priest')u.men-=6;
 expect(castSpell(b,u.id,spell,u.id)).toBe(true);expect(u.mana).toBe(9);
 }
 u.men=0;b.outcome='attacker';applyBattle(s,b);expect(s.status).toBe('lost');expect(s.endingReason).toBe('lord-dead');
 }
 });
 it('restores caster mana through the month pipeline and retains it after reload',()=>{
 const s=createRulerCampaign('western-realm',{name:'Elara',gender:'female',skin:'deep',rulerClass:'mage'},4);
 lordOf(s)!.mana=0;advanceMonth(s);expect(lordOf(s)!.mana).toBe(12);expect(lordOf(parseSave(JSON.stringify(s)))!.mana).toBe(12);
 });
 it('renders class choices and rejects unknown classes',()=>{
 const html=renderRulerSelection({creatingFor:'western-realm',rulerDraft:{name:'Rowan',gender:'male',skin:'brown',rulerClass:'mage'},selected:null,checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'map'});
 expect(html).toContain('data-action="ruler-class"');expect(html).toContain('Your role: Mage');expect(html).toContain('ruler-mages-v1.png');
 const s=createRulerCampaign('valley-quickplay',{name:'A',gender:'male',skin:'fair'},1);
 const forged=JSON.stringify(s).replace('"rulerClass":"knight"','"rulerClass":"dragon"');expect(()=>parseSave(forged)).toThrow('ruler appearance');
 });
});

