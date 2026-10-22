import {it,expect} from 'vitest';
import {createRulerCampaign} from './rulerCreation';
import {makeTroop,armyAt} from './campaign';
import {heroMaxHp,heroMaxMana,isHero} from './units';
import {townLocation} from './world';
import {createBattle,autoResolve} from './battle';
it('a developed twelve-formation veteran army can defeat the Normal Hold',()=>{
 const s=createRulerCampaign('western-realm',{name:'Elara',gender:'female',skin:'deep',difficulty:'normal'},7),a=s.armies.find(a=>a.owner==='player')!,lord=a.troops[0];
 a.troops=[lord,...['knights','knights','knights','knights','knights','archers','archers','archers','archers','priest','mage'].map(type=>makeTroop(s,type))];
 for(const t of a.troops){t.xp=isHero(t.type)?15:12;if(isHero(t.type)){t.men=heroMaxHp(t.type,t.xp);t.mana=heroMaxMana(t.type,t.xp);}else{t.gear.armor=t.type==='archers'?'chain':'plate';if(t.type==='archers')t.gear.bow='compound-bow';}}
 lord.kit={weapon:'oathlance',accessory:'hillcrest-medallion'};
 const d=armyAt(s,townLocation(s,'gharzak'),'orcs')!,b=createBattle(d.at,a,d,true,7);autoResolve(b);expect(b.outcome).toBe('attacker');expect(b.units.find(u=>u.troopId===lord.id)!.men).toBeGreaterThan(0);
},120000);
