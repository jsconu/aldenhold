import type { GameState, QuestEffect } from '../game/types';
import { QUESTS } from '../content/quests';
import { ITEMS } from '../content/items';
import { UNIT_TYPES, SPELLS } from '../game/data';
import { isResolved, resolutionOf } from '../game/quests';
import { nodeName } from '../game/campaign';
import { isHero, heroLevel, isRulerType } from '../game/units';
import { esc } from './shared';
export type GameplayNotice={kind:'quest';id:string}|{kind:'hero';id:number};
export function feedbackSnapshot(state:GameState){return {quests:new Set(Object.keys(state.quests).filter(id=>isResolved(state.quests[id]))),heroes:new Set(state.armies.filter(a=>a.owner==='player').flatMap(a=>a.troops.filter(t=>isHero(t.type)).map(t=>t.id)))};}
export function newFeedback(state:GameState,before:ReturnType<typeof feedbackSnapshot>):GameplayNotice[]{
 const quests:GameplayNotice[]=Object.values(QUESTS).filter(q=>q.kind==='side' && state.quests[q.id] && isResolved(state.quests[q.id]) && !before.quests.has(q.id)).map(q=>({kind:'quest',id:q.id}));
 return [...quests,...state.armies.filter(a=>a.owner==='player').flatMap(a=>a.troops.filter(t=>isHero(t.type) && !isRulerType(t.type) && !before.heroes.has(t.id)).map(t=>({kind:'hero' as const,id:t.id})))];
}
const FLAGS:Record<string,string>={
 'logging-cap':'Lumber camps are capped at level 1 throughout your realm.', 'greenveil-rejected':'Greenveil remains independent; ordinary archer recruitment stays available.',
 'quarry-cleared':'Your ore mines produce 25% more ore.', 'quarry-diverted':'Your ore mines produce 25% less ore.',
 'caravan-rescued':'Merra’s stall in Fenwick opens with her rescued stock.', 'caravan-ransomed':'Merra’s stall opens, but ransom raises her prices.', 'caravan-lost':'The caravan stock is lost; Merra’s stall is empty.',
 'miller-convicted':'The verdict against the miller is recorded.', 'miller-pardoned':'The miller has been pardoned.', 'miller-dismissed':'The charges against the miller have been dismissed.', 'miller-judged-unheard':'The trial ended without hearing the evidence.'};
function consequence(state:GameState,e:QuestEffect):string{
 switch(e.kind){
  case 'item':return 'Received '+(e.qty??1)+' × '+ITEMS[e.item].name+'. '+ITEMS[e.item].rules+(ITEMS[e.item].equip?' Equip it from Journal → Inventory at a friendly settlement; it is not equipped automatically.':'');
  case 'gold':return (e.amount>=0?'Gold received: +':'Gold lost: ')+e.amount+'g.';
  case 'treaty':return nodeName(state,e.town)+': '+e.relation+(e.passage?'. Your armies gain peaceful passage.':' . No passage granted.')+' The town retains its own rule and pays you no taxes.';
  case 'goods':return nodeName(state,e.town)+': '+(e.amount>0?'+':'')+e.amount+' '+e.good+'.';
  case 'population':return nodeName(state,e.town)+': '+(e.amount>0?'+':'')+e.amount+' residents.';
  case 'archive':return ITEMS[e.item].name+' is archived as evidence in your Journal.';
  case 'flag':return FLAGS[e.flag]??'';
 }
}
export function questOutcome(state:GameState,id:string):string{
 const def=QUESTS[id],p=state.quests[id];if(!def||!p||!isResolved(p))return '';
 const result=resolutionOf(def,p);if(!result)return '';
 const paid=p.history.reduce((sum,h)=>sum+(def.stages.find(s=>s.id===h.stage)?.choices.find(c=>c.id===h.choice)?.gold??0),0);
 const lines=result.effects.map(e=>consequence(state,e)).filter(Boolean);
 return '<section class="quest-outcome"><h3>'+esc(def.name)+' · '+(p.status==='succeeded'?'Completed':p.status==='failed'?'Failed':'No longer available')+'</h3><p>'+esc(result.journal)+'</p>'+(paid?'<p>Gold paid during this quest: '+paid+'g.</p>':'')+(lines.length?'<h4>Rewards and realm changes</h4><ul>'+lines.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul>':'<p>No items or gold were awarded.</p>')+'<p class="sub">This outcome is saved in your Journal. Quest rewards are applied once; battle spoils are separate.</p></section>';
}
const ROLES:Record<string,string>={lord:'Lead your army and protect the ruler. Ruler death ends the campaign.',champion:'A durable frontline fighter. Use them to lead melee attacks and support nearby units.',priest:'A support spellcaster. Heal restores battle losses; Rally steadies morale. Keep the priest protected behind your frontline.',mage:'A fragile offensive spellcaster. Keep them behind your frontline and spend mana on spells when they will matter.',warchief:'A frontline commander who strengthens nearby troops.',shaman:'A spellcaster who supports the army with magic.'};
export function heroGuide(state:GameState,id:number):string{
 const army=state.armies.find(a=>a.owner==='player'&&a.troops.some(t=>t.id===id)),hero=army?.troops.find(t=>t.id===id);if(!hero||!army)return '';
 const type=UNIT_TYPES[hero.type],known=(type.hero?.spells??[]).filter(s=>SPELLS[s].level<=heroLevel(hero.xp));
 const gear=Object.values(hero.kit??{}).filter(Boolean).map(item=>ITEMS[item!]?.name??item).join(', ');
 return '<section class="hero-guide"><h3>'+esc(hero.name??type.name)+' · '+esc(hero.type==='lord' && state.rulerAppearance ? 'Knight' : type.name)+' · Level '+heroLevel(hero.xp)+'</h3><p>'+esc((isRulerType(hero.type)?'Your ruler: their death ends the campaign. ':'')+(ROLES[hero.type==='rulerPriest'?'priest':hero.type==='rulerMage'?'mage':hero.type]??'A hero who fights with your army.'))+'</p><dl class="stats"><dt>Location</dt><dd>'+esc(nodeName(state,army.at))+'</dd><dt>Monthly upkeep</dt><dd>'+type.upkeep+' gold</dd><dt>Health</dt><dd>'+hero.men+' HP</dd><dt>Mana</dt><dd>'+hero.mana+'</dd><dt>Equipment</dt><dd>'+esc(gear||'No hero equipment equipped')+'</dd></dl><h4>What to do next</h4><ol><li>'+(hero.mp===0?'This hero has no movement left this month. End month restores movement. New hires always wait until next month before marching.':'Select the hero’s map location, tick their troop checkbox and click a gold-bordered destination to march.')+'</li><li>Keep other troops ticked to travel together; untick them to send the hero separately.</li><li>'+(known.length?'In battle, select this hero, choose a spell, click a highlighted target and confirm Cast. Mana is spent when you cast.':'In battle, select this hero and click a marked enemy to move into range and attack.')+'</li><li>Open Journal → Inventory at a friendly settlement to equip any compatible weapon, armor or accessory.</li></ol>'+(known.length?'<h4>Spells available now</h4><ul>'+known.map(s=>'<li><b>'+esc(SPELLS[s].name)+'</b>: '+esc(SPELLS[s].text)+'</li>').join('')+'</ul>':'')+'<button class="ghost" data-action="goto" data-node="'+esc(army.at)+'">Show '+esc(nodeName(state,army.at))+'</button></section>';
}
export function renderFeedback(state:GameState,notices:GameplayNotice[]):string{
 const n=notices[0];if(!n)return '';
 return '<div class="feedback-overlay"><section class="feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-heading"><h2 id="feedback-heading" tabindex="-1">'+(n.kind==='quest'?'Quest outcome':'A new hero has joined')+'</h2>'+(n.kind==='quest'?questOutcome(state,n.id):heroGuide(state,n.id))+'<div class="feedback-actions"><button class="primary" data-action="feedback-dismiss">Continue'+(notices.length>1?' ('+(notices.length-1)+' more)':'')+'</button><button data-action="feedback-journal" '+(state.battle?'disabled':'')+'>Open Journal</button></div></section></div>';
}
