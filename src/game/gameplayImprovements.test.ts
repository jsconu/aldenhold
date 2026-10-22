import { describe,it,expect } from 'vitest';
import { newGame,applyBattle } from './campaign';
import { createBattle,attackOrder,attackOrderQuote } from './battle';
import { battleSpoils } from './battleRewards';
import { parseSave } from './saves';
import { chooseQuest,questQuote } from './quests';
import { townLocation } from './world';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';

function fixture(){
 const s=newGame(3);const mine=s.armies.find(a=>a.owner==='player')!,foe=s.armies.find(a=>a.owner==='orcs')!;
 mine.at='gharzak';mine.from='pass';
 const b=createBattle('gharzak',mine,foe,false,3);s.battle=b;
 const u=b.units.find(x=>x.type==='spearmen')!,t=b.units.find(x=>x.side==='defender')!;
 for(const x of b.units){x.reserve=x!==u && x!==t;if(x.reserve){x.col=-1;x.row=-1;}}
 for(const col of b.terrain)col.fill('plain');
 Object.assign(u,{col:2,row:3});Object.assign(t,{col:5,row:3});
 return {s,b,u,t};
}
describe('battle orders and spoils',()=>{
 it('moves and attacks from one command while the quote stays read-only',()=>{
  const {b,u,t}=fixture();const saved=JSON.stringify(b);const quote=attackOrderQuote(b,u.id,t.id);
  expect(quote.reason).toBeNull();expect(quote.destination).not.toBeNull();expect(JSON.stringify(b)).toBe(saved);
  const men=t.men;expect(attackOrder(b,u.id,t.id)).toBe(true);expect(t.men).toBeLessThan(men);expect(u.acted).toBe(true);
  expect(attackOrder(b,u.id,t.id)).toBe(false);
 });
 it('refuses unreachable or spent attacks without moving or consuming a turn',()=>{
  const {b,u,t}=fixture();t.col=b.width-1;const saved=JSON.stringify(b);
  expect(attackOrder(b,u.id,t.id)).toBe(false);expect(JSON.stringify(b)).toBe(saved);
 });
 it('awards victory spoils exactly once after reload and records them in the treasury',()=>{
  const {s,b}=fixture();b.outcome='attacker';const amount=battleSpoils(b),gold=s.gold;
  expect(amount).toBeGreaterThan(0);
  const restored=parseSave(JSON.stringify(s));const completed=restored.battle!;
  applyBattle(restored,completed);expect(restored.gold).toBe(gold+amount);
  expect(restored.treasury.pending.filter(e=>e.category==='battle-spoils')).toHaveLength(1);
  const settled=JSON.stringify(restored);applyBattle(restored,completed);expect(JSON.stringify(restored)).toBe(settled);
  expect(parseSave(settled).gold).toBe(gold+amount);
 });
 it('gives no victory gold for defeat or an unfinished fight',()=>{
  const {b}=fixture();expect(battleSpoils(b)).toBe(0);b.outcome='defender';expect(battleSpoils(b)).toBe(0);
 });
});
describe('ruler landmark adventures',()=>{
 it('validates all authored clues and relic references',()=>expect(validateContent(CATALOG)).toEqual([]));
 it('requires the ruler at the barrow, remembers clues, and grants the signet only once',()=>{
  let s=newGame(3,'western-realm');const army=s.armies.find(a=>a.troops.some(t=>t.type==='lord'))!;
  expect(questQuote(s,'H01','examine').reason).toContain('Bring your ruler');
  army.at=townLocation(s,'barrow');
  expect(chooseQuest(s,'H01','examine')).toBeNull();
  expect(chooseQuest(s,'H01','crown')).toBeNull();expect(s.quests.H01.stage).toBe('echo');
  expect(chooseQuest(s,'H01','reconsider')).toBeNull();s=parseSave(JSON.stringify(s));
  expect(s.quests.H01.stage).toBe('inscription');
  expect(chooseQuest(s,'H01','offer')).toBeNull();expect(chooseQuest(s,'H01','oath')).toBeNull();
  expect(s.items['keepers-signet']?.qty === 1).toBe(true);
  const saved=JSON.stringify(s);expect(chooseQuest(s,'H01','oath')).not.toBeNull();expect(JSON.stringify(s)).toBe(saved);
  expect(parseSave(saved).quests.H01.status).toBe('succeeded');
 });
 it('allows a monastery mistake to be corrected before a single relic reward',()=>{
  const s=newGame(3,'western-realm');s.armies.find(a=>a.troops.some(t=>t.type==='lord'))!.at=townLocation(s,'monastery');
  for(const choice of ['listen','red','read','silver','accept'])expect(chooseQuest(s,'H02',choice)).toBeNull();
  expect(s.items['hillcrest-medallion']?.qty === 1).toBe(true);
  expect(parseSave(JSON.stringify(s)).quests.H02.status).toBe('succeeded');
 });
 it('does not let an army without the ruler solve the monastery',()=>{
  const s=newGame(3,'western-realm');const other=s.armies.find(a=>a.owner==='player' && !a.troops.some(t=>t.type==='lord'))!;
  other.at=townLocation(s,'monastery');expect(questQuote(s,'H02','listen').reason).toContain('Bring your ruler');
 });
});

