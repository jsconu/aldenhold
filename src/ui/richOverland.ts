import type { HexWorld, Land } from '../game/types';
import { hexLand, roadsOf, parseKey } from '../game/world';
import { tileCenter, tilePolygon } from './pixelTiles';

const LANDS: Land[] = ['plains','farmland','forest','deepwood','hills','mountains','swamp','water','badlands'];
/** Texture samples follow real terrain cells; roads follow the rules' cached paths. */
export function richOverland(world: HexWorld): string {
  const paths = new Map<Land,string>(LANDS.map(id=>[id,'']));
  world.rows.forEach((line,row)=>{for(let col=0;col<line.length;col++){
    const land=hexLand(world,col+','+row).id;
    paths.set(land,paths.get(land)!+'M'+tilePolygon(col,row).replaceAll(' ','L')+'Z');
  }});
  const defs=LANDS.map((id,i)=>'<pattern id="rich-'+id+'" patternUnits="userSpaceOnUse" width="96" height="96" viewBox="'+(i%3)+' '+Math.floor(i/3)+' 1 1"><image href="/assets/overland/terrain-atlas-v1.png" width="3" height="3" preserveAspectRatio="none"/></pattern>').join('');
  let roads='';
  const crossings=new Map<string,string>();
  for(const road of roadsOf(world))for(let i=1;i<road.length;i++){
    const a=parseKey(road[i-1]),b=parseKey(road[i]);
    const start=tileCenter(a.col,a.row),end=tileCenter(b.col,b.row);
    const bridge=[road[i-1],road[i]].some(k=>hexLand(world,k).id==='water');
    const d='M'+start.join(',')+'L'+end.join(',');
    roads+='<path d="'+d+'" stroke="#514633" stroke-width="'+(bridge?5:2.8)+'"/><path d="'+d+'" stroke="'+(bridge?'#bea17b':'#c4ac7c')+'" stroke-width="'+(bridge?3.3:1.6)+'"/>';
    for (const key of [road[i-1],road[i]]) if(hexLand(world,key).id==='water' && !crossings.has(key)) {
      const p=parseKey(key),[x,y]=tileCenter(p.col,p.row);
      const stone=world.places.some(place=>place.id==='bridge' && place.col===p.col && place.row===p.row);
      if(!stone){ const angle=Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI+28;
        crossings.set(key,'<image href="/assets/overland/wood-bridge-v1.png" x="'+(x-18)+'" y="'+(y-12)+'" width="36" height="24" transform="rotate('+angle+' '+x+' '+y+')"/>'); }
    }
    if(bridge)roads+='<path d="'+d+'" stroke="#705a40" stroke-width="3.3" stroke-dasharray=".6 1.7"/>';
  }
  return '<g class="rich-overland" pointer-events="none"><defs>'+defs+'</defs>'+LANDS.map(id=>'<path d="'+paths.get(id)+'" fill="url(#rich-'+id+')"/>').join('')+'<g fill="none" stroke-linecap="round">'+roads+'</g>'+[...crossings.values()].join('')+'</g>';
}

export function richSettlement(kind: 'capital'|'town'|'lair', forest: boolean, cx: number, cy: number): string {
  const index=kind==='capital'?0:kind==='lair'?2:forest?3:1;
  return '<svg x="'+(cx-19)+'" y="'+(cy-27)+'" width="38" height="38" viewBox="'+(index%2)+' '+Math.floor(index/2)+' 1 1" class="rich-settlement" pointer-events="none"><image href="/assets/overland/settlements-atlas-v1.png" width="2" height="2" preserveAspectRatio="none"/></svg>';
}
