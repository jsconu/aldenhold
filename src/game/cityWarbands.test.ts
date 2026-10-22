import {describe,it,expect} from 'vitest';
import {createRulerCampaign} from './rulerCreation';
import {newGame,armyAt,makeTroop} from './campaign';
import {cityWarbandTurn} from './cityWarbands';
import {parseSave} from './saves';
import {neighbors,stepCost,townLocation} from './world';
import {chooseQuest,settleHeldQuests} from './quests';
import {relationWith} from './diplomacy';
import {bannerFor} from '../ui/hexMapView';
function fixture(){
 const s=createRulerCampaign('western-realm',{name:'Aldric',gender:'male',skin:'fair'},7);s.turn=6;
 const g=armyAt(s,townLocation(s,'fenwick'),'neutral')!;while(g.troops.length<6)g.troops.push(makeTroop(s,'spearmen'));
 for(const t of g.troops)t.mp=0;
 s.cityPolitics={lastTurn:5,rivals:{fenwick:{nextRaidTurn:14,warning:{target:'millbrook',launchTurn:7}}}};
 return {s,g};
}
function launch(){const f=fixture();f.s.turn=7;cityWarbandTurn(f.s);return {...f,party:f.s.armies.find(a=>a.cityRaid?.origin==='fenwick')!};}
describe('rival city expeditions',()=>{
 it('leaves legacy campaigns unchanged and gives an advance muster warning',()=>{
 const old=newGame(1,'western-realm'),before=JSON.stringify(old);old.turn=8;const at8=JSON.stringify(old);cityWarbandTurn(old);expect(JSON.stringify(old)).toBe(at8);expect(before).not.toBe(at8);
 const s=createRulerCampaign('western-realm',{name:'A',gender:'female',skin:'deep'},1);s.turn=6;
 for(const a of s.armies.filter(a=>a.owner==='neutral'))while(a.troops.length<6)a.troops.push(makeTroop(s,'spearmen'));
 cityWarbandTurn(s);expect(Object.values(s.cityPolitics!.rivals).some(r=>r.warning?.launchTurn===7)).toBe(true);expect(s.armies.some(a=>a.cityRaid)).toBe(false);expect(s.journal.at(-1)?.text).toContain('mustering');
 });
 it('launches actual troops while retaining the home garrison and respecting cooldowns',()=>{
 const {s,g,party}=launch();expect(party).toBeDefined();expect(party.troops).toHaveLength(2);expect(g.troops).toHaveLength(4);expect(g.troops.some(t=>party.troops.includes(t))).toBe(false);expect(s.cityPolitics!.rivals.fenwick.warning).toBeUndefined();expect(s.cityPolitics!.rivals.fenwick.nextRaidTurn).toBe(15);
 const before=JSON.stringify(s);cityWarbandTurn(s);expect(JSON.stringify(s)).toBe(before);expect(parseSave(JSON.stringify(s)).armies.some(a=>a.cityRaid?.origin==='fenwick')).toBe(true);
 });
 it('uses per-city hostility and does not make every free city an enemy',()=>{
 const {s}=fixture();expect(relationWith(s,'fenwick')).toBe('hostile');expect(bannerFor(s,'fenwick')).toBe('enemy');expect(relationWith(s,'greenveil')).toBe('neutral');
 });
 it('an earned alliance cancels musters and recalls an existing party',()=>{
 const {s,party}=launch();s.armies.find(a=>a.owner==='player')!.at=townLocation(s,'fenwick');expect(chooseQuest(s,'Q00','sign')).toBeNull();s.turn++;
 cityWarbandTurn(s);expect(relationWith(s,'fenwick')).toBe('ally');expect(s.armies.includes(party)).toBe(false);expect(parseSave(JSON.stringify(s)).treaties.fenwick.relation).toBe('ally');
 });
 it('conquest of the source cancels a planned attack',()=>{
 const {s}=fixture();s.towns.fenwick.owner='player';s.turn=7;cityWarbandTurn(s);expect(s.cityPolitics!.rivals.fenwick.warning).toBeUndefined();expect(s.armies.some(a=>a.cityRaid?.origin==='fenwick')).toBe(false);
 });
 it('marches over real terrain and captures an undefended player city',()=>{
 const {s,party}=launch(),goal=townLocation(s,'millbrook');s.armies=s.armies.filter(a=>!(a.owner==='player'&&a.at===goal));party.at=neighbors(s,goal).find(at=>Number.isFinite(stepCost(s,at))&&!s.armies.some(a=>a.at===at))!;party.troops.forEach(t=>t.mp=12);s.turn=8;
 cityWarbandTurn(s);expect(s.towns.millbrook.owner).toBe('neutral');expect(relationWith(s,'millbrook')).toBe('hostile');expect(party.at).toBe(goal);expect(party.troops.every(t=>t.mp===0)).toBe(true);
 expect(parseSave(JSON.stringify(s)).towns.millbrook.owner).toBe('neutral');
 });
 it('starts a normal defensive battle against a garrison',()=>{
 const {s,party}=launch(),goal=townLocation(s,'millbrook');party.at=neighbors(s,goal).find(at=>Number.isFinite(stepCost(s,at))&&!s.armies.some(a=>a.at===at))!;party.troops.forEach(t=>t.mp=12);s.turn=8;
 cityWarbandTurn(s);expect(s.battle?.owners.defender).toBe('player');expect(s.battle?.owners.attacker).toBe('neutral');expect(s.battle?.at).toBe(goal);expect(parseSave(JSON.stringify(s)).battle?.at).toBe(goal);
 });
 it('rejects forged party origins and invalid warning dates',()=>{
 const {s}=launch();const invalid=JSON.parse(JSON.stringify(s));invalid.armies.find((a:{cityRaid?:unknown})=>a.cityRaid).cityRaid.origin='unknown';expect(()=>parseSave(JSON.stringify(invalid))).toThrow('city war party');
 const bad=JSON.parse(JSON.stringify(s));bad.cityPolitics.rivals.fenwick.warning={target:'aldenhold',launchTurn:-1};expect(()=>parseSave(JSON.stringify(bad))).toThrow('muster warning');
 });
 it('Millbrook must be retaken if a rival city captures it during the incursion',()=>{
 const {s}=fixture();s.turn=10;s.quests.M04={status:'active',stage:'hold',choice:null,resolvedTurn:null,resolvedBy:null,stageTurn:6,history:[]};s.towns.millbrook.owner='neutral';settleHeldQuests(s);expect(s.quests.M04.stage).toBe('retake');expect(s.quests.M04.status).toBe('active');
 });
 it('keeps hostile city groups separate from unrelated friendly garrisons',()=>{
 const {s,g,party}=launch();expect(party.at).toBe(g.at);expect(s.armies.includes(g)).toBe(true);expect(s.armies.includes(party)).toBe(true);expect(s.armies.filter(a=>a.cityRaid).length).toBeLessThanOrEqual(2);
 });
});
