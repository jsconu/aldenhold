import {describe,it,expect} from 'vitest';
import {newGame,hireHero,playerMarchOptions} from '../game/campaign';
import {chooseQuest} from '../game/quests';
import {parseSave} from '../game/saves';
import {createRulerCampaign,SKIN_TONES} from '../game/rulerCreation';
import {feedbackSnapshot,newFeedback,questOutcome,heroGuide,renderFeedback} from './gameplayFeedback';
import {developmentArt} from './developmentArt';
import {placeScene} from './placeScene';
import {rulerFigure,renderRulerSelection} from './rulerSelection';
import {richUnit,richRuin} from './richBattle';
import {renderBattle} from './battleView';
import {renderHexMap} from './hexMapView';
import {renderJournal} from './journalView';
import {createBattle} from '../game/battle';
import {getCampaign} from '../content';
const ui={selected:null,checked:new Set<number>(),battleUnit:null,battleSpell:null,message:'',view:'map' as const};
describe('playtest artwork and movement readability',()=>{
 it('draws actual improvement tiers with rich assets and no primitive buildings',()=>{
  const s=newGame(1,'western-realm'),city=s.cityEconomies.aldenhold;
  city.buildings.farm=2;city.buildings.lumber=1;
  const saved=JSON.stringify(s),art=placeScene(s,'aldenhold');
  expect(art).toContain('/assets/scenes/improvements-v1.png');
  expect(art).toContain('data-building="farm" data-level="2"');
  expect(art).toContain('data-building="lumber" data-level="1"');
  expect(art).not.toContain('<path');expect(art).not.toContain('data-building="forge"');
  expect(JSON.stringify(s)).toBe(saved);
 });
 it('represents construction separately and upgrades use distinct artwork',()=>{
  const city=newGame(1).cityEconomies.aldenhold;
  const before=developmentArt(city);city.buildings.farm=2;
  expect(developmentArt(city)).not.toBe(before);
  city.project={kind:'forge',targetLevel:1,startedTurn:1,finishTurn:2,paidGold:180,paidGoods:{}};
  expect(developmentArt(city)).toContain('data-construction="forge"');
 });
 it('uses illustrated ruins and bordered move polygons while preserving terrain and click targets',()=>{
  const s=newGame(1,'western-realm'),mine=s.armies.find(a=>a.owner==='player')!,foe=s.armies.find(a=>a.owner==='orcs')!;
  const b=createBattle(mine.at,mine,foe,false,3);s.battle=b;for(const col of b.terrain)col.fill('plain');b.terrain[3][3]='ruins';
  const saved=JSON.stringify(s),html=renderBattle(s,{...ui,battleUnit:b.units[0].id});
  expect(html).toContain('/assets/battle/ruins-v1.png');expect(html).toContain('class="move-border"');expect(html).toContain('class="battle-spot battle-spot-reach"');
  expect(html).toContain('data-action="hex"');expect(JSON.stringify(s)).toBe(saved);
  expect(new Set([0,1,2,3].map(i=>richRuin(0,0,i))).size).toBe(4);
 });
 it('renders bordered reachable overland hexes from the real movement quote',()=>{
  const s=newGame(1,'western-realm'),army=s.armies.find(a=>a.owner==='player')!;
  const targets=playerMarchOptions(s,army.at,army.troops.map(t=>t.id));
  expect(targets.size).toBeGreaterThan(0);
  const html=renderHexMap(s,ui,getCampaign('western-realm').hex!,targets);
  expect(html).toContain('class="move-border"');expect(html).toContain('class="reach');
 });
});
describe('quest and hero explanations',()=>{
 it('announces a completed side quest once and preserves its actual consequences after reload',()=>{
  let s=newGame(1);const before=feedbackSnapshot(s);expect(chooseQuest(s,'Q00','sign')).toBeNull();
  expect(newFeedback(s,before)).toEqual([{kind:'quest',id:'Q00'}]);
  const saved=JSON.stringify(s),html=questOutcome(s,'Q00');
  expect(html).toContain('Sealed Fenwick Charter');expect(html).toContain('peaceful passage');expect(html).toContain('pays you no taxes');
  expect(JSON.stringify(s)).toBe(saved);expect(newFeedback(s,feedbackSnapshot(s))).toEqual([]);
  s=parseSave(saved);expect(renderJournal(s)).toContain('Rewards and consequences');expect(questOutcome(s,'Q00')).toBe(html);
  expect(renderFeedback(s,[{kind:'quest',id:'Q00'}])).toContain('aria-modal="true"');
 });
 it('explains a new priest, monthly cost, waiting to march, spells and equipment',()=>{
  const s=newGame(1),before=feedbackSnapshot(s);expect(hireHero(s,s.offers[0])).toBeNull();
  const notices=newFeedback(s,before);expect(notices).toHaveLength(1);expect(notices[0].kind).toBe('hero');
  const id=s.armies.flatMap(a=>a.troops).find(t=>t.type==='priest')!.id;
  const html=heroGuide(s,id);expect(html).toContain('20 gold');expect(html).toContain('End month restores movement');expect(html).toContain('Heal');expect(html).toContain('Rally');expect(html).toContain('confirm Cast');expect(html).toContain('Journal → Inventory');
  expect(renderJournal(parseSave(JSON.stringify(s)))).toContain('how to use this hero');
  expect(newFeedback(s,feedbackSnapshot(s))).toEqual([]);
 });
 it('does not announce a failed hire or an unfinished quest choice',()=>{
  const s=newGame(1);s.gold=0;const before=feedbackSnapshot(s);expect(hireHero(s,s.offers[0])).not.toBeNull();expect(newFeedback(s,before)).toEqual([]);
 });
});
describe('ruler creation',()=>{
 it('supports all eight appearances, persists them and applies the chosen battle artwork',()=>{
  const figures:string[]=[];
  for(const gender of ['male','female'] as const)for(const skin of SKIN_TONES){
   const choice={name:'Rowan',gender,skin},s=createRulerCampaign('western-realm',choice,9);
   expect(parseSave(JSON.stringify(s)).rulerAppearance).toEqual({gender,skin,rulerClass:'knight'});
   expect(s.armies.flatMap(a=>a.troops).find(t=>t.type==='lord')!.name).toBe('Rowan');
   expect(richUnit('lord',10,20,false,s.rulerAppearance)).toContain('/assets/battle/rulers-v1.png');
   figures.push(rulerFigure(choice));
  }
  expect(new Set(figures).size).toBe(8);
 });
 it('keeps stats and starting resources equal across appearances and supports legacy saves',()=>{
  const a=createRulerCampaign('western-realm',{name:'Rowan',gender:'male',skin:'fair'},7),b=createRulerCampaign('western-realm',{name:'Rowan',gender:'female',skin:'deep'},7);
  expect(a.armies).toEqual(b.armies);expect(a.gold).toBe(b.gold);expect(a.cityEconomies).toEqual(b.cityEconomies);
  expect(parseSave(JSON.stringify(newGame(1))).rulerAppearance).toBeUndefined();
 });
 it('escapes the name in selection and rejects forged appearance data',()=>{
  const choice={name:'<Rowan>',gender:'female' as const,skin:'brown' as const};
  const html=renderRulerSelection({...ui,creatingFor:'western-realm',rulerDraft:choice});
  expect(html).toContain('&#60;Rowan&#62;');expect(html).toContain('Begin campaign');
  const forged=JSON.parse(JSON.stringify(createRulerCampaign('western-realm',choice,1)));forged.rulerAppearance.skin='invalid';
  expect(()=>parseSave(JSON.stringify(forged))).toThrow('ruler appearance');
 });
});

