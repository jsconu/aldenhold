import {UNIT_TYPES} from '../game/data';
import { isRulerType } from '../game/units';
import { rulerArt } from '../game/rulerCreation';
import type { Battle, Terrain, RulerAppearance } from '../game/types';
const HUMAN=['militia','spearmen','archers','woodlandArchers','knights','lord','champion','priest','mage'];
const MONSTER=['warband','orcArchers','cyclops','minotaur','goblinSkirmishers','goblinArchers','giant','titan','troll','warchief','shaman'];
export function richUnit(type: string,cx: number,cy: number,mirror: boolean,appearance?:RulerAppearance,gender?:'male'|'female'): string {
  if(isRulerType(type) && (appearance || type!=='lord')){
    appearance ??= {gender:'male',skin:'fair',rulerClass:type==='rulerPriest'?'priest':'mage'};
    const index=['fair','olive','brown','deep'].indexOf(appearance.skin);
    return '<g class="rich-battle-unit" pointer-events="none"'+(mirror?' transform="translate('+cx*2+' 0) scale(-1 1)"':'')+'><svg x="'+(cx-25)+'" y="'+(cy-57)+'" width="50" height="67" preserveAspectRatio="none" viewBox="'+index+' '+(appearance.gender==='female'?1:0)+' 1 1"><image href="'+rulerArt(appearance)+'" width="4" height="2" preserveAspectRatio="none"/></svg></g>';
  }
  const human=HUMAN.includes(type);const index=(human?HUMAN:MONSTER).indexOf(type);
  if(index<0)return '';
  const cols=human?3:4;
  const size=['giant','titan','cyclops','minotaur','troll','knights'].includes(type)?58:50;
  return '<g class="rich-battle-unit" pointer-events="none"'+(mirror?' transform="translate('+cx*2+' 0) scale(-1 1)"':'')+'><svg x="'+(cx-size/2)+'" y="'+(cy-size+10)+'" width="'+size+'" height="'+size+'" viewBox="'+(index%cols)+' '+Math.floor(index/cols)+' 1 1"><image href="/assets/battle/'+(human?(gender==='female'?'humans-female':'humans'):'monsters')+'-v1.png" width="'+cols+'" height="3" preserveAspectRatio="none"/></svg></g>';
}
const SAMPLE: Record<Terrain,number>={plain:0,forest:2,hill:4,stream:7,marsh:6,thorns:3,ruins:0,rocks:5,spring:7,fort:0,bridge:7};
export function richBattleGround(b: Battle, polygon: (x:number,y:number)=>string): string {
  let defs='',ground='';
  for(const [terrain,index] of Object.entries(SAMPLE))defs+='<pattern id="battle-rich-'+terrain+'" patternUnits="userSpaceOnUse" width="180" height="180" viewBox="'+index%3+' '+Math.floor(index/3)+' 1 1"><image href="/assets/overland/terrain-atlas-v1.png" width="3" height="3" preserveAspectRatio="none"/></pattern>';
  for(let col=0;col<b.width;col++)for(let row=0;row<b.height;row++){
    const x=36+col*45,y=6+Math.sqrt(3)*30*(row+.5*(col&1)+.5);
    ground+='<polygon points="'+polygon(x,y)+'" fill="url(#battle-rich-'+b.terrain[col][row]+')"/>';
    if(b.terrain[col][row]==='thorns'){
      const variant=(col*31+row*7)%4,id='thorn-ground-'+col+'-'+row;
      ground+='<clipPath id="'+id+'"><polygon points="'+polygon(x,y)+'"/></clipPath><g clip-path="url(#'+id+')"><svg x="'+(x-30)+'" y="'+(y-26)+'" width="60" height="52" viewBox="'+variant%2+' '+Math.floor(variant/2)+' 1 1" preserveAspectRatio="none"><image href="/assets/battle/thorns-v1.png" width="2" height="2" preserveAspectRatio="none"/></svg></g>';
    }
  }
  return '<g class="rich-battle-ground" pointer-events="none"><defs>'+defs+'</defs>'+ground+'</g>';
}

export function richRuin(cx:number,cy:number,seed:number):string{
 const index=Math.abs(seed)%4;
 return '<svg x="'+(cx-23)+'" y="'+(cy-29)+'" width="46" height="46" viewBox="'+index%2+' '+Math.floor(index/2)+' 1 1" class="rich-ruin" pointer-events="none"><image href="/assets/battle/ruins-v1.png" width="2" height="2" preserveAspectRatio="none"/></svg>';
}

/** A formation is a group of people; heroes and individual giant creatures keep a single silhouette. */
const SKIN_ORDER = ['fair', 'olive', 'brown', 'deep'] as const;

/** A scout's look, fixed for that scout: one of two figures and four skin tones, picked from its id. */
export function scoutLook(troopId: number): { gender: 'male' | 'female'; skin: (typeof SKIN_ORDER)[number] } {
  const h = Math.imul(troopId + 0x9e37, 2654435761) >>> 0;
  return { gender: (h >>> 7) & 1 ? 'female' : 'male', skin: SKIN_ORDER[(h >>> 11) % 4] };
}

/** One scout figure from the scout atlas (4 skin tones across, male then female down). */
export function scoutUnit(cx: number, cy: number, mirror: boolean, troopId: number): string {
  const look = scoutLook(troopId);
  const col = SKIN_ORDER.indexOf(look.skin), row = look.gender === 'female' ? 1 : 0;
  return '<g class="rich-battle-unit" pointer-events="none"' + (mirror ? ' transform="translate(' + cx * 2 + ' 0) scale(-1 1)"' : '') + '><svg x="' + (cx - 25) + '" y="' + (cy - 40) + '" width="50" height="50" viewBox="' + col + ' ' + row + ' 1 1"><image href="/assets/battle/scouts-v1.png" width="4" height="2" preserveAspectRatio="none"/></svg></g>';
}

/** A scout in battle: a single figure at the scale of a formation's soldiers. */
export function scoutFigure(cx: number, cy: number, mirror: boolean, troopId: number): string {
  return '<g class="battle-formation" pointer-events="none" role="img" aria-label="Scout"><g transform="translate(' + cx + ' ' + (cy + 3) + ') scale(.64)">' + scoutUnit(0, 0, mirror, troopId) + '</g></g>';
}

export function battleFigure(type:string,cx:number,cy:number,mirror:boolean,men:number,appearance?:RulerAppearance,gender?:'male'|'female'):string{
 // A unit without illustrated art draws nothing here, so the caller falls back to its pixel sprite.
 if(!richUnit(type,0,0,false,appearance,gender))return '';
 if(UNIT_TYPES[type]?.hero){
  // Portrait cells are taller than square troop cells; normalize both to a roughly 32px person.
  const scale=isRulerType(type) && (appearance || type!=='lord')?.48:.64;
  return '<g class="battle-hero-figure" transform="translate('+cx+' '+cy+') scale('+scale+')">'+richUnit(type,0,0,mirror,appearance,gender)+'</g>';
 }
 if(['giant','titan','cyclops','minotaur'].includes(type))return '<g class="battle-creature-figure" transform="translate('+cx+' '+(cy+4)+') scale(.72)">'+richUnit(type,0,0,mirror,undefined,gender)+'</g>';
 const figures=Math.min(3,Math.max(1,men)),positions=figures===3?[[-12,-5],[12,-5],[0,7]]:figures===2?[[-10,1],[10,1]]:[[0,3]];
 return '<g class="battle-formation" pointer-events="none" role="img" aria-label="'+men+' soldiers in formation">'+positions.map(([x,y],i)=>'<g transform="translate('+(cx+x)+' '+(cy+y)+') scale(.64)">'+richUnit(type,0,0,mirror,undefined,i===1?(gender==='female'?'male':'female'):gender)+'</g>').join('')+'</g>';
}
