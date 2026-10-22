import { describe,expect,it } from 'vitest';
import { UNIT_TYPES } from '../game/data';
import { battleFigure, richUnit } from './richBattle';
import { pixelSprite } from './pixelSprites';
import { newGame } from '../game/campaign';
import { renderHexMap } from './hexMapView';
import { getCampaign } from '../content';
describe('illustrated battle units and map heraldry',()=>{
  it('covers every current unit with a separate atlas cell and mirrors defenders without changing position',()=>{
    // Scouts have no atlas cell yet: they draw with their pixel sprite instead of an empty figure.
    const illustrated=Object.keys(UNIT_TYPES).filter(id=>id!=='scout');
    const art=illustrated.map(id=>richUnit(id,90,80,false));
    expect(art.every(s=>s.includes('/assets/battle/'))).toBe(true);
    expect(new Set(art).size).toBe(illustrated.length);
    expect(battleFigure('scout',90,80,false,1)).toBe('');
    expect(pixelSprite('scout','mine',90,80,2.5,false)).not.toBe('');
    expect(richUnit('lord',90,80,true)).toContain('translate(180 0) scale(-1 1)');
    expect(richUnit('unknown',0,0,false)).toBe('');
  });
  it('uses cloth heraldry and the masonry bridge while preserving map commands',()=>{
    const state=newGame(1,'western-realm');
    const saved=JSON.stringify(state);
    const html=renderHexMap(state,{selected:null,checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'map'},getCampaign('western-realm').hex!,new Map());
    expect(html).toContain('/assets/overland/stone-bridge-v1.png');
    for(const kind of ['player','enemy','free','lair','cleared'])expect(html).toContain('id="cloth-'+kind+'"');
    expect(html).not.toContain('href="#map-bridge-neutral"');
    expect(html).toContain('data-action="node" data-node="11,14"');
    expect(JSON.stringify(state)).toBe(saved);
  });
});
