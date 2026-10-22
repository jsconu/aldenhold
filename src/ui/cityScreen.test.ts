import {describe,it,expect} from 'vitest';
import {newGame,armyAt} from '../game/campaign';
import {renderCampaign} from './campaignView';
import type {UIState} from './shared';
const ui:UIState={selected:'aldenhold',checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'map'};
describe('dedicated city management',()=>{
 it('keeps construction, recruitment and equipment controls off the overland map',()=>{
 const html=renderCampaign(newGame(1),ui);expect(html.includes('data-action="open-city"')).toBe(true);for(const action of ['construct','recruit','inspect-refit','set-stance'])expect(html.includes('data-action="'+action+'"')).toBe(false);
 });
 for(const [tab,action] of [['development','construct'],['recruitment','recruit'],['army','inspect-refit'],['quests','quest-choice']] as const)it('shows '+tab+' in its own city screen',()=>{
 const s=newGame(1),at=tab==='quests'?'fenwick':'aldenhold';const html=renderCampaign(s,{...ui,selected:at,view:'city',cityTab:tab});
 expect(html.includes('class="city-screen"')).toBe(true);expect(html.includes('Back to overland map')).toBe(true);expect(html.includes('data-action="'+action+'"')).toBe(true);expect(html.includes('class="map overland"')).toBe(false);expect(html.includes('class="map-wrap"')).toBe(false);
 });
 it('shows replacements and battle plans in the army tab',()=>{
 const s=newGame(1);armyAt(s,'aldenhold','player')!.troops[1].men=10;const html=renderCampaign(s,{...ui,view:'city',cityTab:'army'});expect(html).toContain('Recruit replacements');expect(html).toContain('Battle plan: Offensive');
 });
});
