import { describe,expect,it } from 'vitest';
import { getCampaign } from '../content';
import { richOverland,richSettlement } from './richOverland';
import { roadsOf,parseKey } from '../game/world';
import { tileCenter } from './pixelTiles';
describe('rich map artwork',()=>{
  it('covers all nine gameplay land types and draws actual road connections without changing the world',()=>{
    const world=getCampaign('western-realm').hex!;
    const saved=JSON.stringify(world);
    const html=richOverland(world);
    for(const land of ['plains','farmland','forest','deepwood','hills','mountains','swamp','water','badlands'])expect(html).toContain('id="rich-'+land+'"');
    const road=roadsOf(world)[0];const a=parseKey(road[0]),b=parseKey(road[1]);
    expect(html).toContain('M'+tileCenter(a.col,a.row).join(',')+'L'+tileCenter(b.col,b.row).join(','));
    expect(JSON.stringify(world)).toBe(saved);
  });
  it('selects different atlas cells for capital, town, fortress and woodland settlement',()=>{
    const scenes=[richSettlement('capital',false,10,10),richSettlement('town',false,10,10),richSettlement('lair',false,10,10),richSettlement('town',true,10,10)];
    expect(new Set(scenes).size).toBe(4);
    for(const scene of scenes)expect(scene).toContain('pointer-events="none"');
  });
});
