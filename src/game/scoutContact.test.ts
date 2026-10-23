import {describe,it,expect} from 'vitest';
import {armyAt,makeTroop,newGame} from './campaign';
import {assignScout,observeOrcRoutes,refreshScoutContacts,scoutContactStatus} from './scouts';
import {parseSave} from './saves';
import {townLocation,neighbors} from './world';
import {renderCampaign} from '../ui/campaignView';

function fixture(){
 const s=newGame(7,'western-realm'),home=townLocation(s,'aldenhold');
 const scout=makeTroop(s,'scout');armyAt(s,home,'player')!.troops.push(scout);assignScout(s,scout.id,'watch');
 const enemy={id:s.nextId++,owner:'orcs' as const,at:neighbors(s,home)[0],from:null,troops:[makeTroop(s,'warband')]};
 s.armies.push(enemy);return {s,home,scout,enemy};
}
describe('current scout intelligence',()=>{
 it('updates destination and stopped movement, and deduplicates after reload',()=>{
  const {s,home,enemy}=fixture();observeOrcRoutes(s,enemy,[home]);
  const count=s.journal.length;
  observeOrcRoutes(s,enemy,[home]);expect(s.journal.length).toBe(count);
  const goal=townLocation(s,'millbrook');observeOrcRoutes(s,enemy,[goal]);
  expect(s.scoutContacts).toHaveLength(1);expect(s.scoutContacts![0].destination).toBe(goal);
  expect(s.journal.length).toBe(count+1);
  enemy.troops[0].mp=0;observeOrcRoutes(s,enemy,[goal]);
  expect(s.scoutContacts![0].arrivalTurn).toBeNull();expect(s.journal.at(-1)!.text).toContain('arrival unknown');
  const loaded=parseSave(JSON.stringify(s)),n=loaded.journal.length;
  observeOrcRoutes(loaded,loaded.armies.find(a=>a.id===enemy.id)!,[goal]);
  expect(loaded.journal.length).toBe(n);
 });
 it('retires lost contacts once without revealing hidden outcomes, then reacquires them',()=>{
  const {s,home,enemy}=fixture();observeOrcRoutes(s,enemy,[home]);
  const near=enemy.at;enemy.at=townLocation(s,'gharzak');
  refreshScoutContacts(s);const n=s.journal.length;
  expect(s.scoutContacts![0].active).toBe(false);expect(s.journal.at(-1)!.text).toContain('contact lost');
  expect(s.journal.at(-1)!.text).not.toContain('Gharzak');
  refreshScoutContacts(s);expect(s.journal.length).toBe(n);
  enemy.at=near;observeOrcRoutes(s,enemy,[home]);
  expect(s.scoutContacts![0].active).toBe(true);expect(s.journal.length).toBe(n+1);
  s.armies=s.armies.filter(a=>a!==enemy);refreshScoutContacts(s);
  expect(scoutContactStatus(s,s.scoutContacts![0])).toBe('lost');
 });
 it('ends recalled watches immediately and labels the old estimate in the city screen',()=>{
  const {s,home,scout,enemy}=fixture();observeOrcRoutes(s,enemy,[home]);
  assignScout(s,scout.id,'recall');
  expect(scoutContactStatus(s,s.scoutContacts![0])).toBe('watch-ended');
  const html=renderCampaign(s,{selected:home,checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'city',cityTab:'overview'});
  expect(html).toContain('Watch ended — previous estimate withdrawn');
  expect(html).not.toContain('Estimated arrival: month');
  expect(parseSave(JSON.stringify(s)).scoutContacts).toEqual(s.scoutContacts);
 });
 it('upgrades old report-only saves quietly and rejects malformed contacts',()=>{
  const {s,home,enemy,scout}=fixture();s.scoutReports=[`${enemy.id}:${scout.id}:${home}`];
  const n=s.journal.length;observeOrcRoutes(s,enemy,[home]);expect(s.journal.length).toBe(n);
  expect(s.scoutContacts).toHaveLength(1);
  for(const patch of [{seenTurn:s.turn+1},{arrivalTurn:-1},{post:'999,999'},{scoutId:s.nextId+1},{active:'yes'}]){
   const bad=JSON.parse(JSON.stringify(s));Object.assign(bad.scoutContacts[0],patch);
   expect(()=>parseSave(JSON.stringify(bad))).toThrow(/scout contact/);
  }
  const bad=JSON.parse(JSON.stringify(s));bad.scoutContacts.push({...bad.scoutContacts[0]});expect(()=>parseSave(JSON.stringify(bad))).toThrow(/scout contact/);
 });
});
