import type {GameState,Difficulty} from './types';
import {getCampaign} from '../content';
import {UNIT_TYPES} from './data';
import {worldOf,townLocation,parseKey} from './world';
import {hexDistance} from './hex';
export const DIFFICULTIES:Record<Difficulty,{name:string;description:string;holdXp:number;enemyXp:number}>={
 easy:{name:'Easy',description:'Gentler enemies and a fully revealed map. Western Realm objectives and three relics still required.',holdXp:4,enemyXp:0},
 normal:{name:'Normal',description:'Explore unknown terrain, develop towns and veteran troops, gather three relics and break a fortified Hold.',holdXp:12,enemyXp:2},
 hard:{name:'Hard',description:'Veteran enemy armies, a full elite Hold garrison and less starting gold. Intended for experienced rulers.',holdXp:18,enemyXp:6}
};
export function explored(state:GameState,at:string):boolean{return !state.challenge?.fog || state.challenge.explored.includes(at);}
/** Permanent exploration, revealed by armies and settlements under your rule. */
export function explore(state:GameState):void{
 const c=state.challenge,w=worldOf(state);if(!c?.fog||w.kind!=='hex')return;
 const seen=new Set(c.explored),origins=[...state.armies.filter(a=>a.owner==='player').map(a=>a.at),...Object.values(state.towns).filter(t=>t.owner==='player').map(t=>townLocation(state,t.id))].map(parseKey);
 w.rows.forEach((line,row)=>{for(let col=0;col<line.length;col++)if(origins.some(o=>hexDistance(o,{col,row})<=3))seen.add(col+','+row);});
 c.explored=[...seen];
}
export function campaignObjectives(state:GameState):{id:string;label:string;done:boolean;at?:string}[]{
 if(!state.challenge||state.campaignId!=='western-realm')return [];
 const owned=(id:string)=>((state.items[id]?.qty??0)>0 || state.armies.some(a=>a.owner==='player' && a.troops.some(t=>Object.values(t.kit??{}).includes(id))));
 const city=state.cityEconomies.aldenhold,upgraded=state.armies.filter(a=>a.owner==='player').flatMap(a=>a.troops).filter(t=>!UNIT_TYPES[t.type].hero && (['chain','plate'].includes(t.gear.armor??'') || ['long-bow','compound-bow'].includes(t.gear.bow??''))).length;
 return [
 {id:'chapter',label:'Secure the inheritance, feed the realm, settle Westmere and survive the incursion (M01–M04)',done:state.quests.M04?.status==='succeeded',at:'aldenhold'},
 {id:'forge',label:'Develop Aldenhold: Farms level 2 and a Tool Forge',done:city.buildings.farm>=2 && city.buildings.forge>=1,at:'aldenhold'},
 {id:'veterans',label:'Equip at least two formations with upgraded armor or bows',done:upgraded>=2,at:'aldenhold'},
 {id:'lance',label:'Claim the Oathlance from the Aldenhold council (M01)',done:owned('oathlance'),at:'aldenhold'},
 {id:'signet',label:'Earn the Keeper’s Signet at the Royal Barrow (H01)',done:owned('keepers-signet'),at:'barrow'},
 {id:'medallion',label:'Earn the Hillcrest Medallion at the monastery (H02)',done:owned('hillcrest-medallion'),at:'monastery'},
 {id:'hold',label:'Defeat the elite garrison and conquer Gharzak Hold',done:state.towns.gharzak.owner==='player',at:'gharzak'}
 ];
}
export function holdApproachReason(state:GameState,to:string):string|null{
 if(!state.challenge || state.campaignId!=='western-realm' || to!==townLocation(state,'gharzak') || state.towns.gharzak.owner==='player')return null;
 const missing=campaignObjectives(state).filter(o=>o.id!=='hold' && !o.done);
 return missing.length?'The final assault is not ready: '+missing.map(o=>o.label).join('; ')+'. Open Campaign objectives for guidance.':null;
}
export function challengeVictoryReady(state:GameState):boolean{return campaignObjectives(state).every(o=>o.done);}
export function holdLocation(state:GameState):string{return townLocation(state,getCampaign(state.campaignId).lair);}
