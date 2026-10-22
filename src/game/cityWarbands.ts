import {observeOrcRoutes} from './scouts';
import {armyAt,deed,makeTroop,marchAlong,nodeName,sharedMp} from './campaign';
import {relationWith} from './diplomacy';
import {marchOptions,pathTo,stepCost,townLocation,worldOf} from './world';
import {isHero} from './units';
import type {Army,GameState} from './types';
const SETTINGS={easy:{start:10,cadence:12,active:1,size:1},normal:{start:6,cadence:8,active:2,size:2},hard:{start:5,cadence:6,active:3,size:3}};
function peaceful(state:GameState,id:string){return state.towns[id]?.owner!=='neutral'||['ally','vassal','truce'].includes(relationWith(state,id)??'');}
function destination(state:GameState,from:string):string|null{
 const routes=marchOptions(state,from,'neutral',Infinity);
 const targets=Object.values(state.towns).filter(t=>t.owner==='player').map(t=>({id:t.id,cost:routes.get(townLocation(state,t.id))?.cost??Infinity,guard:armyAt(state,townLocation(state,t.id),'player')?.troops.length??0})).filter(t=>Number.isFinite(t.cost));
 targets.sort((a,b)=>(a.cost+a.guard*3)-(b.cost+b.guard*3)||a.id.localeCompare(b.id));
 return targets[0]?.id??null;
}
/** Visible, bounded rival expeditions. They use real city garrisons, terrain and the normal battle pipeline. */
export function cityWarbandTurn(state:GameState):void{
 if(!state.challenge || state.campaignId!=='western-realm' || state.status!=='playing' || worldOf(state).kind!=='hex')return;
 const cfg=SETTINGS[state.challenge.difficulty],politics=state.cityPolitics??={lastTurn:0,rivals:{}};
 if(politics.lastTurn===state.turn)return;politics.lastTurn=state.turn;
 // A charter or conquest can cancel a muster and demobilize a party before it attacks.
 for(const [origin,rival] of Object.entries(politics.rivals))if(peaceful(state,origin)&&rival.warning){delete rival.warning;deed(state,'realm',nodeName(state,origin)+' cancels its war muster after the change in relations.',townLocation(state,origin));}
 for(const army of [...state.armies].filter(a=>a.cityRaid)){
  if(peaceful(state,army.cityRaid!.origin)){state.armies=state.armies.filter(a=>a!==army);deed(state,'realm',nodeName(state,army.cityRaid!.origin)+' orders its war party to stand down.',army.at);}
 }
 if(state.turn>=cfg.start){
  // Free cities replenish their own small defensive muster; their manpower is not unlimited.
  if(state.turn%3===0)for(const town of Object.values(state.towns).filter(t=>t.owner==='neutral'&&t.kind==='town'&&!peaceful(state,t.id))){
   const garrison=armyAt(state,townLocation(state,town.id),'neutral');
   if(garrison && !garrison.cityRaid && garrison.troops.length<6 && town.pop>=820){
    const type=garrison.troops.some(t=>t.type==='archers')?'archers':'spearmen',troop=makeTroop(state,type);
    troop.xp=state.challenge.difficulty==='hard'?4:state.challenge.difficulty==='normal'?2:0;
    town.pop-=troop.men;garrison.troops.push(troop);
   }
  }
  for(const [origin,rival] of Object.entries(politics.rivals)){
   const warning=rival.warning;if(!warning || warning.launchTurn>state.turn || peaceful(state,origin))continue;
   const garrison=armyAt(state,townLocation(state,origin),'neutral'),ranks=garrison?.troops.filter(t=>!isHero(t.type))??[];
   if(!garrison || state.towns[warning.target]?.owner!=='player' || ranks.length<cfg.size+2){delete rival.warning;rival.nextRaidTurn=state.turn+cfg.cadence;continue;}
   if(state.armies.filter(a=>a.cityRaid).length>=cfg.active){warning.launchTurn=state.turn+1;continue;}
   const troops=ranks.slice(-cfg.size);garrison.troops=garrison.troops.filter(t=>!troops.includes(t));
   const party:Army={id:state.nextId++,owner:'neutral',at:garrison.at,from:null,troops,cityRaid:{origin,target:warning.target,launched:state.turn}};
   state.armies.push(party);delete rival.warning;rival.nextRaidTurn=state.turn+cfg.cadence;
   deed(state,'realm',nodeName(state,origin)+' sends '+troops.length+' formations toward '+nodeName(state,warning.target)+'. Its home garrison remains in place.',garrison.at);
  }
  const sources=Object.values(state.towns).filter(t=>t.owner==='neutral' && t.kind==='town').sort((a,b)=>a.id.localeCompare(b.id));
  for(const [index,town] of sources.entries()){
   const pending=Object.values(politics.rivals).filter(r=>r.warning).length;
   if(state.armies.filter(a=>a.cityRaid).length+pending>=cfg.active)break;
   if(peaceful(state,town.id) || state.armies.some(a=>a.cityRaid?.origin===town.id))continue;
   const rival=politics.rivals[town.id];if(rival?.warning || (rival ? rival.nextRaidTurn>state.turn : (state.turn+index)%cfg.cadence!==0))continue;
   const garrison=armyAt(state,townLocation(state,town.id),'neutral');
   if(!garrison || garrison.cityRaid || garrison.troops.filter(t=>!isHero(t.type)).length<cfg.size+2)continue;
   const target=destination(state,garrison.at);if(!target)continue;
   politics.rivals[town.id]={nextRaidTurn:state.turn+cfg.cadence,warning:{target,launchTurn:state.turn+1}};
   deed(state,'realm',nodeName(state,town.id)+' is mustering a hostile war party against '+nodeName(state,target)+'. It marches next month; reinforce the city or seek an alliance.',garrison.at);
  }
 }
 for(const army of [...state.armies].filter(a=>a.cityRaid)){
  if(!state.armies.includes(army))continue;const raid=army.cityRaid!;
  if(state.towns[raid.target].owner!=='player'){
   if(army.at===townLocation(state,raid.target)){delete army.cityRaid;continue;}
   raid.returning=true;
  }
  const goal=townLocation(state,raid.returning?raid.origin:raid.target);
  if(army.at===goal){delete army.cityRaid;continue;}
  const options=marchOptions(state,army.at,army.owner,sharedMp(army.troops));
  const full=marchOptions(state,army.at,army.owner,Infinity),route=pathTo(full,goal);if(!route.length)continue;
  observeOrcRoutes(state,army,route);
  const steps:string[]=[];let budget=sharedMp(army.troops);
  for(const at of route){budget-=stepCost(state,at);if(budget<0||!options.has(at))break;steps.push(at);}
  if(!steps.length)continue;for(const troop of army.troops)troop.mp=0;
  if(raid.returning && steps.at(-1)===goal){delete army.cityRaid;deed(state,'realm',nodeName(state,raid.origin)+' recalls its war party home.',goal);}
  marchAlong(state,army,steps);
 }
}
