import type {GameState} from './types';
import {UNIT_TYPES} from './data';
import {townAt} from './world';
import {isHero} from './units';
import {EQUIPMENT} from './equipment';
import {recordPurchase} from './economy';
import {recruitBan} from './quests';
import {formationCapacity} from './formationCapacity';
import {armySupportReason} from './armySupport';
export function replacementQuote(state:GameState,troopId:number,requested?:number){
 const army=state.armies.find(a=>a.owner==='player' && a.troops.some(t=>t.id===troopId)),troop=army?.troops.find(t=>t.id===troopId),town=army?townAt(state,army.at):undefined;
 const type=troop?UNIT_TYPES[troop.type]:undefined,capacity=troop?formationCapacity(troop):0;
 const available=type&&!type.hero?Math.max(0,capacity-troop!.men):0;
 const men=requested===undefined?available:Math.min(available,requested);
 const gear=troop?[troop.gear.armor,troop.gear.bow].filter(x=>x!==null).reduce((n,id)=>n+(id?EQUIPMENT[id].goldPerMan:0),0):0;
 const gold=type?Math.ceil(men*(type.cost/type.men+gear)):0;
 let reason:string|null=null;
 if(requested!==undefined && (!Number.isSafeInteger(requested)||requested<=0))reason='Choose a positive whole number of recruits.';
 else if(!troop||!type||!men)reason='This unit is already at full strength.';
 else if(type.recruit===null||troop.type==='scout')reason='This unit cannot recruit additional soldiers.';
 else if(state.battle||state.status!=='playing')reason='Finish the battle before recruiting replacements.';
 else if(isHero(troop.type))reason='Heroes recover health each month; recruit replacements for units.';
 else if(!town||town.owner!=='player'||town.kind==='lair')reason='Return to a town you rule to recruit replacements.';
 else if(recruitBan(state,town.id))reason='This town is rationing grain and cannot spare recruits.';
 else if(troop.refit||troop.mp<=0)reason='This unit has already acted or is refitting; wait until next month.';
 else if(town.pop-men<500)reason='This town cannot spare enough recruits.';
 else if(state.gold<gold)reason='You need '+gold+' gold.';
 else reason=armySupportReason(state,men,town.id);
 return {men,gold,capacity,reason,town,troop};
}
export function recruitReplacements(state:GameState,id:number,requested?:number):string|null{
 const q=replacementQuote(state,id,requested);if(q.reason)return q.reason;
 const t=q.troop!,old=t.men;t.xp=Math.floor(t.xp*old/(old+q.men));t.men+=q.men;t.mp=0;
 q.town!.pop-=q.men;state.gold-=q.gold;
 recordPurchase(state,q.town!.id,'recruitment',q.gold,'replace:'+t.id+':'+state.turn+':'+old,'Replacement recruits');
 return null;
}
