import {describe,it,expect} from 'vitest';
import {createRulerCampaign} from './rulerCreation';
import {newGame,lordOf,endingReason,armyAt,moveTroops,marchQuote,playerMarchOptions} from './campaign';
import {campaignObjectives,holdApproachReason,explore,explored} from './challenge';
import {replacementQuote,recruitReplacements} from './replacements';
import {townLocation,marchOptions} from './world';
import {parseSave} from './saves';
import {createBattle,autoResolve} from './battle';
import {renderHexMap} from '../ui/hexMapView';
import {renderCampaign} from '../ui/campaignView';
import {getCampaign} from '../content';
import {chooseQuest} from './quests';
import {richUnit} from '../ui/richBattle';
const choice={name:'Rowan',gender:'female' as const,skin:'brown' as const};
describe('campaign challenge and exploration',()=>{
 it('preserves legacy campaign endings while new Western campaigns require the final assault',()=>{
 const legacy=newGame(1,'western-realm');legacy.quests.M04.status='succeeded';expect(endingReason(legacy)).toBe('chapter-complete');
 const s=createRulerCampaign('western-realm',choice,1);s.quests.M04.status='succeeded';expect(endingReason(s)).toBeNull();
 const hold=townLocation(s,'gharzak'),home=townLocation(s,'aldenhold');
 expect(holdApproachReason(s,hold)).toContain('Signet');expect(marchQuote(s,home,[lordOf(s)!.id],hold).reason).toContain('final assault');
 expect(playerMarchOptions(s,home,[lordOf(s)!.id]).has(hold)).toBe(false);
 expect(campaignObjectives(s).filter(o=>!o.done).length).toBeGreaterThan(3);
 });
 it('opens the final assault only after the relics, development and veteran equipment are ready',()=>{
 const s=createRulerCampaign('western-realm',choice,1);s.quests.M04.status='succeeded';
 for(const id of ['oathlance','keepers-signet','hillcrest-medallion'])s.items[id]={qty:1,spent:0,archived:false};
 s.cityEconomies.aldenhold.buildings.farm=2;s.cityEconomies.aldenhold.buildings.forge=1;
 const troops=s.armies.find(a=>a.owner==='player')!.troops.filter(t=>t.type!=='lord');troops[0].gear.armor='chain';troops[1].gear.armor='chain';
 expect(holdApproachReason(s,townLocation(s,'gharzak'))).toBeNull();
 s.towns.gharzak.owner='player';expect(endingReason(s)).toBe('lair-captured');
 });
 it('keeps exploration permanent, hides labels and armies, and stops blind pathfinding after a frontier hex',()=>{
 const s=createRulerCampaign('western-realm',choice,4),home=townLocation(s,'aldenhold'),hold=townLocation(s,'gharzak');
 expect(explored(s,home)).toBe(true);expect(explored(s,hold)).toBe(false);
 expect(marchOptions(s,home,'player',Infinity).has(hold)).toBe(false);
 const ui={selected:home,checked:new Set<number>(),battleUnit:null,battleSpell:null,message:'',view:'map' as const};
 const html=renderHexMap(s,ui,getCampaign('western-realm').hex!,new Map());expect(html.includes('unexplored-fog')).toBe(true);expect(html.includes('Gharzak Hold')).toBe(false);
 const before=[...s.challenge!.explored],a=s.armies.find(a=>a.owner==='player')!;a.at=hold;explore(s);expect(explored(s,hold)).toBe(true);a.at=home;explore(s);expect(before.every(at=>explored(s,at))).toBe(true);
 expect(parseSave(JSON.stringify(s)).challenge).toEqual(s.challenge);
 });
 it('scouting a reachable frontier reveals terrain immediately and survives a reload',()=>{
 const s=createRulerCampaign('western-realm',choice,4),home=townLocation(s,'aldenhold'),a=armyAt(s,home,'player')!,ids=a.troops.map(t=>t.id);
 const frontier=[...playerMarchOptions(s,home,ids).keys()].find(at=>!explored(s,at));expect(frontier).toBeDefined();
 expect(moveTroops(s,home,ids,frontier!)).toBeNull();expect(explored(s,frontier!)).toBe(true);expect(parseSave(JSON.stringify(s)).challenge!.explored).toContain(frontier);
 });
 it('sets difficulty before play and rejects malformed exploration saves',()=>{
 const easy=createRulerCampaign('western-realm',{...choice,difficulty:'easy'},1),hard=createRulerCampaign('western-realm',{...choice,difficulty:'hard'},1);
 expect(easy.challenge!.fog).toBe(false);expect(hard.gold).toBeLessThan(easy.gold);expect(parseSave(JSON.stringify(hard)).gold).toBe(hard.gold);
 const bad=JSON.parse(JSON.stringify(hard));bad.challenge.explored=['999,999'];expect(()=>parseSave(JSON.stringify(bad))).toThrow();
 });
 it('allows expensive atonement if the essential barrow relic is initially rejected',()=>{
 const s=createRulerCampaign('western-realm',choice,1);s.armies.find(a=>a.owner==='player')!.at=townLocation(s,'barrow');
 expect(chooseQuest(s,'H01','force')).toBeNull();expect(s.quests.H01.stage).toBe('atonement');
 expect(chooseQuest(s,'H01','repair')).toBeNull();for(const c of ['examine','offer','oath'])expect(chooseQuest(s,'H01',c)).toBeNull();
 expect(s.items['keepers-signet'].qty).toBe(1);expect(parseSave(JSON.stringify(s)).quests.H01.status).toBe('succeeded');
 });
 for(const difficulty of ['normal','hard'] as const)it(difficulty+' elite Hold defeats the starting army across seeded battles',()=>{
 for(const seed of [1,7,19]){
 const s=createRulerCampaign('western-realm',{...choice,difficulty},seed),a=s.armies.find(a=>a.owner==='player')!,d=armyAt(s,townLocation(s,'gharzak'),'orcs')!;
 const b=createBattle(d.at,a,d,true,seed);autoResolve(b);expect(b.outcome).toBe('defender');
 }
 },120000);
});
describe('replacement recruits and female formations',()=>{
 it('fills an existing formation, charges once, preserves gear and dilutes experience',()=>{
 const s=newGame(1),t=armyAt(s,'aldenhold','player')!.troops.find(t=>t.type==='spearmen')!;t.men=12;t.xp=8;t.gear.armor='chain';
 const q=replacementQuote(s,t.id),gold=s.gold,pop=s.towns.aldenhold.pop;expect(q.men).toBe(8);expect(q.reason).toBeNull();
 expect(recruitReplacements(s,t.id)).toBeNull();expect(t.men).toBe(20);expect(t.xp).toBe(4);expect(t.mp).toBe(0);expect(t.gear.armor).toBe('chain');
 expect(s.gold).toBe(gold-q.gold);expect(s.towns.aldenhold.pop).toBe(pop-8);expect(s.treasury.pending.at(-1)?.category).toBe('recruitment');
 expect(recruitReplacements(s,t.id)).not.toBeNull();expect(s.gold).toBe(gold-q.gold);expect(parseSave(JSON.stringify(s)).gold).toBe(s.gold);
 });
 it('refuses replacements outside towns, without gold, or after marching without mutation',()=>{
 const s=newGame(1),a=armyAt(s,'aldenhold','player')!,t=a.troops.find(t=>t.type==='militia')!;t.men=10;t.mp=0;
 let before=JSON.stringify(s);expect(recruitReplacements(s,t.id)).toContain('already acted');expect(JSON.stringify(s)).toBe(before);
 t.mp=12;s.gold=0;before=JSON.stringify(s);expect(recruitReplacements(s,t.id)).toContain('gold');expect(JSON.stringify(s)).toBe(before);
 s.gold=300;a.at='bridge';expect(replacementQuote(s,t.id).reason).toContain('town');
 });
 it('shows replacements when a depleted formation is selected and has female artwork for all human classes',()=>{
 const s=newGame(1);armyAt(s,'aldenhold','player')!.troops[1].men=10;
 const html=renderCampaign(s,{selected:'aldenhold',checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'city',cityTab:'army'});expect(html.includes('data-action="replacements"')).toBe(true);
 for(const type of ['militia','spearmen','archers','woodlandArchers','knights','lord','champion','priest','mage'])expect(richUnit(type,0,0,false,undefined,'female')).toContain('humans-female-v1.png');
 });
});
