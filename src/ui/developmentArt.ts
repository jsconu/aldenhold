import type { CityEconomy, BuildingId } from '../game/types';
const CELLS:Record<BuildingId,[number,number]>={farm:[0,1],lumber:[2,3],mine:[4,5],forge:[6,7]};
const PLOTS:Record<BuildingId,[number,number,number]>={farm:[22,195,96],lumber:[347,207,66],mine:[269,211,58],forge:[187,212,60]};
function asset(index:number,x:number,y:number,width:number,label:string):string{
 return '<svg x="'+x+'" y="'+y+'" width="'+width+'" height="'+width*2/3+'" viewBox="'+index%3+' '+Math.floor(index/3)+' 1 1" preserveAspectRatio="none" class="development-art" pointer-events="none"><title>'+label+'</title><image href="/assets/scenes/improvements-v1.png" width="3" height="3" preserveAspectRatio="none"/></svg>';
}
export function developmentArt(city:CityEconomy):string{
 let art='';
 for(const kind of Object.keys(CELLS) as BuildingId[]){const level=city.buildings[kind];if(!level)continue;const [x,y,w]=PLOTS[kind];art+='<g data-building="'+kind+'" data-level="'+level+'">'+asset(CELLS[kind][level>1?1:0],x,y,w,kind+' level '+level)+'</g>';}
 if(city.project){const [x,y,w]=PLOTS[city.project.kind];art+='<g data-construction="'+city.project.kind+'">'+asset(8,x+w*.35,y,w*.7,'Under construction')+'</g>';}
 return art;
}
