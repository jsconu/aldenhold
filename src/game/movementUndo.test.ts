import {describe,it,expect} from 'vitest';
import {newGame,armyAt,moveTroops,makeTroop} from './campaign';
import {createBattle,moveUnit,reachable,moveGroup,groupMovementOptions} from './battle';
import {MovementUndo} from './movementUndo';
import {parseSave} from './saves';
import {createRulerCampaign} from './rulerCreation';
import {townLocation} from './world';
describe('one-step movement undo',()=>{
 it('restores army merges, movement points, IDs and saves exactly once',()=>{
 const s=newGame(1),before=structuredClone(s),history=new MovementUndo(),ids=armyAt(s,'aldenhold','player')!.troops.map(t=>t.id);
 expect(moveTroops(s,'aldenhold',ids,'millbrook')).toBeNull();history.record(before,s,'aldenhold');expect(history.status(s).available).toBe(true);
 const restored=history.undo(s)!;expect(restored.location).toBe('aldenhold');expect(restored.state).toEqual(before);expect(parseSave(JSON.stringify(restored.state))).toEqual(before);expect(history.undo(restored.state)).toBeNull();
 });
 it('locks after a later game action and after a capture or battle',()=>{
 const s=newGame(1),before=structuredClone(s),h=new MovementUndo(),ids=armyAt(s,'aldenhold','player')!.troops.map(t=>t.id);moveTroops(s,'aldenhold',ids,'millbrook');h.record(before,s,'aldenhold');s.gold--;expect(h.undo(s)).toBeNull();
 const t=newGame(1),old=structuredClone(t);moveTroops(t,'aldenhold',armyAt(t,'aldenhold','player')!.troops.map(t=>t.id),'fenwick');h.record(old,t,'aldenhold');expect(h.status(t).available).toBe(false);
 });
 it('never erases newly revealed terrain or lair discoveries',()=>{
 const s=createRulerCampaign('western-realm',{name:'A',gender:'male',skin:'fair'},1),before=structuredClone(s),h=new MovementUndo();s.challenge!.explored.push(townLocation(s,'gharzak'));h.record(before,s,null);expect(h.status(s).available).toBe(false);expect(h.status(s).reason).toContain('revealed');
 });
 it('restores pure battlefield moves but not movement with wounds',()=>{
 const s=newGame(1),a=armyAt(s,'aldenhold','player')!,d=armyAt(s,'gharzak','orcs')!;a.troops=[makeTroop(s,'spearmen')];s.battle=createBattle('aldenhold',a,d,false,1);s.battle.terrain=s.battle.terrain.map(col=>col.map(()=>'plain'));const u=s.battle.units.find(u=>u.side==='attacker')!,key=[...reachable(s.battle,u).keys()][0],[col,row]=key.split(',').map(Number),h=new MovementUndo(),before=structuredClone(s);
 moveUnit(s.battle,u.id,{col,row});h.record(before,s,null);expect(h.undo(s)!.state).toEqual(before);
 s.battle=structuredClone(before.battle);s.battle!.terrain[col][row]='thorns';const old=structuredClone(s);moveUnit(s.battle!,u.id,{col,row});h.record(old,s,null);expect(h.status(s).available).toBe(false);expect(h.status(s).reason).toContain('casualties');
 });
 it('undoes all members of a group together and does not persist history across reloads',()=>{
 const s=newGame(1);s.battle=createBattle('aldenhold',armyAt(s,'aldenhold','player')!,armyAt(s,'gharzak','orcs')!,false,1);s.battle.terrain=s.battle.terrain.map(c=>c.map(()=>'plain'));const us=s.battle.units.filter(u=>u.side==='attacker');us.forEach((u,i)=>{u.col=2;u.row=2+i;});const ids=us.map(u=>u.id),key=[...groupMovementOptions(s.battle,ids,ids[0]).keys()][0],[col,row]=key.split(',').map(Number),before=structuredClone(s),h=new MovementUndo();
 expect(moveGroup(s.battle,ids,ids[0],{col,row})).toBeNull();h.record(before,s,null);expect(h.undo(s)!.state).toEqual(before);expect(new MovementUndo().status(s).available).toBe(false);
 });
});
