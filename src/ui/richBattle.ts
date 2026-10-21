import type { Battle, Terrain } from '../game/types';
const HUMAN=['militia','spearmen','archers','woodlandArchers','knights','lord','champion','priest','mage'];
const MONSTER=['warband','orcArchers','cyclops','minotaur','goblinSkirmishers','goblinArchers','giant','titan','troll','warchief','shaman'];
export function richUnit(type: string,cx: number,cy: number,mirror: boolean): string {
  const human=HUMAN.includes(type);const index=(human?HUMAN:MONSTER).indexOf(type);
  if(index<0)return '';
  const cols=human?3:4;
  const size=['giant','titan','cyclops','minotaur','troll','knights'].includes(type)?58:50;
  return '<g class="rich-battle-unit" pointer-events="none"'+(mirror?' transform="translate('+cx*2+' 0) scale(-1 1)"':'')+'><svg x="'+(cx-size/2)+'" y="'+(cy-size+10)+'" width="'+size+'" height="'+size+'" viewBox="'+(index%cols)+' '+Math.floor(index/cols)+' 1 1"><image href="/assets/battle/'+(human?'humans':'monsters')+'-v1.png" width="'+cols+'" height="3" preserveAspectRatio="none"/></svg></g>';
}
const SAMPLE: Record<Terrain,number>={plain:0,forest:2,hill:4,stream:7,marsh:6,thorns:3,ruins:8,rocks:5,spring:7};
export function richBattleGround(b: Battle, polygon: (x:number,y:number)=>string): string {
  let defs='',ground='';
  for(const [terrain,index] of Object.entries(SAMPLE))defs+='<pattern id="battle-rich-'+terrain+'" patternUnits="userSpaceOnUse" width="180" height="180" viewBox="'+index%3+' '+Math.floor(index/3)+' 1 1"><image href="/assets/overland/terrain-atlas-v1.png" width="3" height="3" preserveAspectRatio="none"/></pattern>';
  for(let col=0;col<b.width;col++)for(let row=0;row<b.height;row++){
    const x=36+col*45,y=6+Math.sqrt(3)*30*(row+.5*(col&1)+.5);
    ground+='<polygon points="'+polygon(x,y)+'" fill="url(#battle-rich-'+b.terrain[col][row]+')"/>';
  }
  return '<g class="rich-battle-ground" pointer-events="none"><defs>'+defs+'</defs>'+ground+'</g>';
}
