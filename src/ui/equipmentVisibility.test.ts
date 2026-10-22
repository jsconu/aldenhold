import {describe,it,expect} from 'vitest';
import {newGame} from '../game/campaign';
import {renderCampaign} from './campaignView';
import {beginRefit,refitQuote} from '../game/equipment';
import {UIState} from './shared';
const ui:UIState={selected:'aldenhold',checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'city',cityTab:'army'};
describe('visible equipment and battle plans',()=>{
 it('shows equipment previews and battle plans without opening menus',()=>{
 const s=newGame(1),html=renderCampaign(s,ui);
 expect(html).toContain('data-action="inspect-refit"');
 expect(html).not.toContain('<details class="refit-panel"');
 expect(html).not.toContain('<details class="tactics"');
 expect(html).toContain('aria-pressed="true"');
 });
 it('lets a player inspect locked equipment and explains how to unlock it',()=>{
 const s=newGame(1),t=s.armies.find(a=>a.owner==='player')!.troops.find(t=>t.type==='militia')!;
 const html=renderCampaign(s,{...ui,refitChoice:{troop:t.id,item:'chain'}});
 expect(html).toContain('Confirm refit');expect(html).toContain('Requires level 2.');
 expect(refitQuote(s,'aldenhold',t.id,'chain').reason).toBe('Requires level 2.');
 const before=JSON.stringify(s);expect(beginRefit(s,'aldenhold',t.id,'chain')).toBe('Requires level 2.');expect(JSON.stringify(s)).toBe(before);
 t.xp=2;s.cityEconomies.aldenhold.buildings.forge=1;s.cityEconomies.aldenhold.goods.tools=50;
 expect(refitQuote(s,'aldenhold',t.id,'chain').reason).toBeNull();
 expect(beginRefit(s,'aldenhold',t.id,'chain')).toBeNull();expect(t.refit?.item).toBe('chain');
 });
});
