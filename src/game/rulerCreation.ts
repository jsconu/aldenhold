import type { CampaignId, RulerAppearance, RulerClass, Difficulty } from './types';
import { newGame, lordOf, makeTroop } from './campaign';
import {DIFFICULTIES,explore,holdLocation} from './challenge';
import {UNIT_TYPES} from './data';
import {heroMaxHp,heroMaxMana} from './units';
export type RulerChoice=RulerAppearance & {name:string;difficulty?:Difficulty};
export const SKIN_TONES=['fair','olive','brown','deep'] as const;
export const RULER_CLASSES:Record<RulerClass,{name:string;type:string;art:string;summary:string;equipment:string}>={
 knight:{name:'Knight',type:'lord',art:'rulers-v1.png',equipment:'Sword, shield and command',summary:'A durable frontline ruler: 30 HP, attack 4, defense 5 and leadership +15. No spells. Lead melee attacks and steady your formations.'},
 priest:{name:'Priest',type:'rulerPriest',art:'ruler-priests-v1.png',equipment:'Staff, prayer book and healing',summary:'A support ruler: 22 HP, attack 2, defense 3, leadership +10 and 12 mana. Heal restores losses and Rally steadies morale. Keep behind your frontline.'},
 mage:{name:'Mage',type:'rulerMage',art:'ruler-mages-v1.png',equipment:'Crystal staff, spellbook and arcane magic',summary:'A fragile spellcaster: 18 HP, attack 1, defense 2, leadership +5 and 12 mana. Begin with Fireball and Ward; unlock more spells as you gain levels. Protect your ruler behind the army.'}
};
export function rulerArt(appearance:RulerAppearance):string{return '/assets/battle/'+RULER_CLASSES[appearance.rulerClass??'knight'].art;}
export function createRulerCampaign(campaign:CampaignId,choice:RulerChoice,seed?:number){
 if(!['male','female'].includes(choice.gender)||!SKIN_TONES.includes(choice.skin)||!Object.hasOwn(RULER_CLASSES,choice.rulerClass??'knight'))throw new Error('Choose a supported appearance and class.');
 const state=newGame(seed,campaign),rulerClass=choice.rulerClass??'knight';
 state.rulerAppearance={gender:choice.gender,skin:choice.skin,rulerClass};
 const lord=lordOf(state)!;
 const originalId=lord.id;
 if(rulerClass!=='knight'){Object.assign(lord,makeTroop(state,RULER_CLASSES[rulerClass].type));lord.id=originalId;}
 lord.name=choice.name.trim().slice(0,40)||(choice.gender==='female'?'Elara':'Aldric');
 const difficulty=choice.difficulty??'normal';
 if(!Object.hasOwn(DIFFICULTIES,difficulty))throw new Error('Choose a supported difficulty.');
 state.challenge={difficulty,fog:difficulty!=='easy' && campaign==='western-realm',explored:[]};
 const settings=DIFFICULTIES[difficulty],hold=state.armies.find(a=>a.at===holdLocation(state)&&a.owner==='orcs');
 for(const a of state.armies.filter(a=>a.owner!=='player' && a.owner!=='neutral'))for(const t of a.troops){t.xp=a===hold?settings.holdXp:settings.enemyXp;if(UNIT_TYPES[t.type].hero){t.men=heroMaxHp(t.type,t.xp);t.mana=heroMaxMana(t.type,t.xp);}}
 if(hold){while(hold.troops.length<(difficulty==='hard'?12:difficulty==='normal'?10:8)){const t=makeTroop(state,hold.troops.length%3===0?'troll':hold.troops.length%2?'orcArchers':'warband');t.xp=settings.holdXp;hold.troops.push(t);}hold.tactics={stance:'defensive'};}
 if(difficulty==='hard'){state.gold=Math.max(0,state.gold-100);state.treasury.opening=state.gold;}
 explore(state);
 return state;
}
