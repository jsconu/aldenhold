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
  const centerOf=(key:string)=>{const p=parseKey(key);return tileCenter(p.col,p.row);};
  for(const road of roadsOf(world)) {
    for(let i=1;i<road.length;i++) {
      if(hexLand(world,road[i-1]).id==='water' || hexLand(world,road[i]).id==='water')continue;
      const start=centerOf(road[i-1]),end=centerOf(road[i]);
      const d='M'+start.join(',')+'L'+end.join(',');
      roads+='<path d="'+d+'" stroke="#514633" stroke-width="2.8"/><path d="'+d+'" stroke="#c4ac7c" stroke-width="1.6"/>';
    }
    // Treat an entire run of water cells as one crossing, including both banks.
    for(let i=0;i<road.length;i++) {
      if(hexLand(world,road[i]).id!=='water')continue;
      const first=i;
      while(i+1<road.length && hexLand(world,road[i+1]).id==='water')i++;
      const cells=road.slice(first,i+1);
      if(first===0 || i+1===road.length)continue;
      const stone=world.places.some(place=>place.id==='bridge' && cells.includes(place.col+','+place.row));
      if(stone)continue;
      const key=[...cells].sort().join(' ');
      if(crossings.has(key))continue;
      const a=centerOf(road[first-1]),b=centerOf(road[i+1]);
      const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
      const width=Math.max(38,Math.hypot(b[0]-a[0],b[1]-a[1])*1.22);
      let angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
      if(angle>90)angle-=180;
      if(angle< -90)angle+=180;
      const view=Math.abs(angle)<15?0:angle<0?1:2;
      // Select an already drawn perspective: rotating a 3D sprite would tilt its upright posts.
      crossings.set(key,'<svg class="wooden-crossing" data-water-cells="'+cells.join(' ')+'" data-bridge-span="'+road[first-1]+' '+road[i+1]+'" x="'+(x-width/2)+'" y="'+(y-width/2)+'" width="'+width+'" height="'+width+'" viewBox="'+view+' 0 1 1"><image href="/assets/overland/wood-bridges-v2.png" width="3" height="1" preserveAspectRatio="none"/></svg>');
    }
  }
  return '<g class="rich-overland" pointer-events="none"><defs>'+defs+'</defs>'+LANDS.map(id=>'<path d="'+paths.get(id)+'" fill="url(#rich-'+id+')"/>').join('')+'<g fill="none" stroke-linecap="round">'+roads+'</g>'+[...crossings.values()].join('')+'</g>';
}

export function richSettlement(kind: 'capital'|'town'|'lair', forest: boolean, cx: number, cy: number): string {
  const index=kind==='capital'?0:kind==='lair'?2:forest?3:1;
  return '<svg x="'+(cx-19)+'" y="'+(cy-27)+'" width="38" height="38" viewBox="'+(index%2)+' '+Math.floor(index/2)+' 1 1" class="rich-settlement" pointer-events="none"><image href="/assets/overland/settlements-atlas-v1.png" width="2" height="2" preserveAspectRatio="none"/></svg>';
}

