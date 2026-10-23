import {lordOf,recruit,recruitQuote,moveTroops,marchQuote} from '../campaign';
import {constructionQuote,buildCity} from '../cities';
import {beginRefit,refitQuote} from '../equipment';
import {equipItem,equipQuote} from '../items';
import {replacementQuote,recruitReplacements} from '../replacements';
import {chooseQuest,questQuote} from '../quests';
import {campaignObjectives} from '../challenge';
import {hexDistance} from '../hex';
import {parseKey,townLocation,marchOptions,pathTo} from '../world';
import {currentWeather,sheltered} from '../weather';
import type {GameState} from '../types';

/** A diagnostic player policy. Every change goes through a public quoted command. */
export function runPreparationTurn(s:GameState,note:(text:string)=>void):void {
 if(s.battle||s.status!=='playing')return;
 const home=townLocation(s,'aldenhold');
 if(s.cityEconomies.aldenhold.buildings.farm>=2 && !s.cityEconomies.aldenhold.buildings.forge && !constructionQuote(s,'aldenhold','forge').reason){buildCity(s,'aldenhold','forge');note('build capital forge');}
 for(const [q,choices] of [['H01',['examine','offer','oath']],['H02',['listen','silver','accept']]] as const)
   for(const choice of choices)if(!questQuote(s,q,choice).reason){chooseQuest(s,q,choice);note(q+': '+choice);}
 const lord=lordOf(s);if(!lord)return;
 for(const item of ['oathlance','keepers-signet','hillcrest-medallion'])if(!equipQuote(s,item,lord.id).reason){equipItem(s,item,lord.id);note('equip '+item);}
 const army=s.armies.find(a=>a.owner==='player' && a.troops.some(t=>t.id===lord.id))!;
 if(army.at===home){
   for(const t of army.troops){
     const q=replacementQuote(s,t.id);if(!q.reason && s.gold-q.gold>=150){recruitReplacements(s,t.id);note('replace losses '+t.id);}
     if(!refitQuote(s,'aldenhold',t.id,'chain').reason && s.gold-refitQuote(s,'aldenhold',t.id,'chain').gold>=150){beginRefit(s,'aldenhold',t.id,'chain');note('refit '+t.id);}
   }
   if(s.quests.M04.status==='succeeded')for(let i=army.troops.length;i<12;i++){
     const type=i%3===0?'archers':'spearmen',q=recruitQuote(s,'aldenhold',type);
     if(q.reason||s.gold-q.gold<250)break;recruit(s,'aldenhold',type);note('raise expedition '+type);
   }
 }
 // Keep the ruler home until the authored incursion is resolved, then gather both relics and assault the Hold.
 if(s.quests.M04.status!=='succeeded')return;
 const destination=s.quests.H01.status!=='succeeded'?'barrow':s.quests.H02.status!=='succeeded'?'monastery':
   !campaignObjectives(s).find(o=>o.id==='veterans')!.done && army.troops.some(t=>t.xp>=2 && !t.name && t.gear.armor==='leather')?'aldenhold':'gharzak';
 const goal=townLocation(s,destination);if(army.at===goal)return;
 if(currentWeather(s).rule.exposure>=0.1 && sheltered(s,army.at))return;
 const ids=army.troops.map(t=>t.id),options=marchOptions(s,army.at,'player',Infinity);
 // Use only explored routes and the next frontier hex, following the known objective's direction.
 const end=options.has(goal)?goal:[...options.keys()].filter(at=>!s.challenge!.explored.includes(at))
   .sort((a,b)=>hexDistance(parseKey(a),parseKey(goal))-hexDistance(parseKey(b),parseKey(goal))||options.get(a)!.cost-options.get(b)!.cost)[0];
 if(!end)return;
 const next=pathTo(options,end).filter(at=>!marchQuote(s,army.at,ids,at).reason).at(-1);
 if(next){const reason=moveTroops(s,army.at,ids,next);if(reason)throw new Error(reason);note('expedition toward '+destination+': '+next);}
}
