import {describe,it,expect} from 'vitest';
import {newGame,armyAt,makeTroop} from './campaign';
import {createBattle,groupMoveQuote,groupMovementOptions,moveGroup,reachable,moveUnit} from './battle';
import {hexDistance,hexKey} from './hex';
import {renderBattle} from '../ui/battleView';
function fixture(){const s=newGame(3),a=armyAt(s,'aldenhold','player')!,d=armyAt(s,'gharzak','orcs')!;a.troops=['knights','spearmen','archers'].map(t=>makeTroop(s,t));s.battle=createBattle('aldenhold',a,d,false,1);const b=s.battle;b.terrain=b.terrain.map(col=>col.map(()=>'plain'));const us=b.units.filter(u=>u.side==='attacker');us.forEach((u,i)=>{u.col=2;u.row=3+i;});b.units.filter(u=>u.side==='defender').forEach((u,i)=>{u.col=14;u.row=i+1;});return {s,b,us};}
describe('group movement',()=>{
 it('preserves hex spacing across odd and even columns at the slowest pace',()=>{
 const {b,us}=fixture(),ids=us.map(u=>u.id),before=hexDistance(us[0],us[1]),options=groupMovementOptions(b,ids,us[0].id);
 expect(options.size).toBeGreaterThan(0);expect(options.has('8,3')).toBe(false);
 const target=[...options.keys()].find(k=>k.startsWith('3,'))!,[col,row]=target.split(',').map(Number),q=groupMoveQuote(b,ids,us[0].id,{col,row});
 expect(q.budget).toBe(3);expect(q.reason).toBeNull();expect(moveGroup(b,ids,us[0].id,{col,row})).toBeNull();expect(hexDistance(us[0],us[1])).toBe(before);expect(us.every(u=>u.moved&&!u.acted)).toBe(true);
 });
 it('can advance a column through hexes vacated by selected members',()=>{
 const {b,us}=fixture();expect(moveGroup(b,us.map(u=>u.id),us[0].id,{col:2,row:4})).toBeNull();expect(us.map(u=>u.row)).toEqual([4,5,6]);expect(new Set(us.map(hexKey)).size).toBe(3);
 });
 it('refuses an invalid member or blocked destination without partially moving anyone',()=>{
 const {b,us}=fixture(),ids=us.map(u=>u.id);us[1].acted=true;let before=JSON.stringify(b);expect(moveGroup(b,ids,us[0].id,{col:3,row:3})).not.toBeNull();expect(JSON.stringify(b)).toBe(before);
 us[1].acted=false;b.terrain[3][3]='rocks';before=JSON.stringify(b);expect(moveGroup(b,ids,us[0].id,{col:3,row:3})).not.toBeNull();expect(JSON.stringify(b)).toBe(before);
 });
 it('applies normal terrain wounds and leaves each formation able to attack',()=>{
 const {b,us}=fixture(),ids=us.map(u=>u.id);const to={col:3,row:3},q=groupMoveQuote(b,ids,us[0].id,to);expect(q.reason).toBeNull();const move=q.moves[1];b.terrain[move.to.col][move.to.row]='thorns';const men=us[1].men;
 expect(moveGroup(b,ids,us[0].id,to)).toBeNull();expect(us[1].men).toBe(men-2);expect(us.every(u=>!u.acted)).toBe(true);
 });
 it('does not bypass an enemy zone of control or another unit',()=>{
 const {b,us}=fixture(),e=b.units.find(u=>u.side==='defender')!;e.col=3;e.row=3;
 expect(groupMoveQuote(b,us.map(u=>u.id),us[0].id,{col:3,row:3}).reason).not.toBeNull();
 const group=groupMovementOptions(b,[us[0].id],us[0].id),single=reachable(b,us[0]);for(const key of group.keys())expect(single.has(key)).toBe(true);
 expect(moveUnit(b,us[0].id,{col:3,row:3})).toBe(false);
 });
 it('shows selection controls, shared destinations and undo in the battle view',()=>{
 const {s,us}=fixture();const html=renderBattle(s,{selected:null,checked:new Set(),battleUnit:us[0].id,battleGroup:us.map(u=>u.id),battleSpell:null,message:'Keep the group clear.',view:'map',movementUndo:{available:true,reason:'Undo the last move.'}});
 expect(html).toContain('Select all ready');expect(html).toContain('3 selected');expect(html).toContain('data-action="undo-move"');expect(html).toContain('Keep the group clear.');
 });
});
