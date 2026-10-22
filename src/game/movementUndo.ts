import type {GameState} from './types';
/** One reversible player move, scoped to this browser session and guarded against later game actions. */
export class MovementUndo {
 private entry:{before:GameState;after:string;location:string|null}|null=null;
 private unavailable='Make a move to enable undo.';
 clear(){this.entry=null;this.unavailable='Make a move to enable undo.';}
 record(before:GameState,after:GameState,location:string|null):void{
  this.entry=null;
  if(JSON.stringify(before)===JSON.stringify(after)){this.unavailable='No movement was made.';return;}
  const changed=(a:unknown,b:unknown)=>JSON.stringify(a)!==JSON.stringify(b);
  if(before.battle || after.battle){
   if(!before.battle || !after.battle || before.battle.round!==after.battle.round || before.battle.active!==after.battle.active || after.battle.outcome || changed(before.battle.units.map(u=>[u.id,u.men,u.morale,u.acted,u.mana,u.fled,u.routing,u.deeds,u.effects]),after.battle.units.map(u=>[u.id,u.men,u.morale,u.acted,u.mana,u.fled,u.routing,u.deeds,u.effects]))){this.unavailable='Combat or casualties prevent undo.';return;}
  }else if(changed(before.challenge?.explored,after.challenge?.explored)||changed(before.lairs,after.lairs)){
   this.unavailable='New terrain or a lair was revealed; this move cannot be undone.';return;
  }
  if(before.status!==after.status || changed(before.towns,after.towns)||changed(before.quests,after.quests)||changed(before.items,after.items)||changed(before.flags,after.flags)){
   this.unavailable='A capture, quest or campaign event prevents undo.';return;
  }
  this.entry={before:structuredClone(before),after:JSON.stringify(after),location};this.unavailable='';
 }
 status(state:GameState):{available:boolean;reason:string}{
  const available=!!this.entry && this.entry.after===JSON.stringify(state);
  return {available,reason:available?'Undo the last move.':this.entry?'Another game action has happened; undo is no longer available.':this.unavailable};
 }
 undo(state:GameState):{state:GameState;location:string|null}|null{
  if(!this.status(state).available)return null;
  const entry=this.entry!;this.clear();return {state:structuredClone(entry.before),location:entry.location};
 }
}
