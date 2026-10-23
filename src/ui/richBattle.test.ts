import { describe,expect,it } from 'vitest';
import { UNIT_TYPES } from '../game/data';
import { richUnit, scoutLook, scoutUnit } from './richBattle';
import { newGame } from '../game/campaign';
import { renderHexMap } from './hexMapView';
import { getCampaign } from '../content';
describe('illustrated battle units and map heraldry',()=>{
  it('covers every current unit with a separate atlas cell and mirrors defenders without changing position',()=>{
    // Scouts draw from their own atlas (scoutUnit), with a look fixed per scout.
    // Engineers and spies draw with their pixel sprites until painted art exists (spies never take the field).
    const illustrated=Object.keys(UNIT_TYPES).filter(id=>!['scout','engineer','spy'].includes(id));
    const art=illustrated.map(id=>richUnit(id,90,80,false));
    expect(art.every(s=>s.includes('/assets/battle/'))).toBe(true);
    expect(new Set(art).size).toBe(illustrated.length);
    expect(scoutUnit(90,80,false,7)).toContain('/assets/battle/scouts-v1.png');
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
  it('gives each scout a lasting look: both figures and all four skin tones turn up', ()=>{
    const looks=Array.from({length:64},(_,i)=>scoutLook(i+1));
    expect(scoutLook(5)).toEqual(scoutLook(5));
    expect(new Set(looks.map(l=>l.gender))).toEqual(new Set(['male','female']));
    expect(new Set(looks.map(l=>l.skin))).toEqual(new Set(['fair','olive','brown','deep']));
    expect(new Set(looks.map(l=>l.gender+l.skin)).size).toBe(8);
  });
});
