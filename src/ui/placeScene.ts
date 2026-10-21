import type { GameState, MonsterSpecies } from '../game/types';
import { hexLand, townLocation, worldOf } from '../game/world';
import { BUILDINGS } from '../game/cities';
import { esc } from './shared';

/** Original vector scenery: layered buildings reflect the saved settlement, never a stock screenshot. */
export function placeScene(state: GameState, townId: string, species?: MonsterSpecies, cleared = false): string {
  const world = worldOf(state);
  const land = world.kind === 'hex' ? hexLand(world, townLocation(state, townId)).id : 'plains';
  const rocky = species === 'giants' || species === 'titans' || ['hills', 'mountains', 'badlands'].includes(land);
  const wet = species === 'trolls' || ['swamp', 'water'].includes(land);
  const woods = species === 'goblins' || ['forest', 'deepwood'].includes(land);
  const city = state.cityEconomies[townId];
  const house = (x: number, y: number, scale = 1) => '<g transform="translate('+x+' '+y+') scale('+scale+')"><path d="M0 0 25 -13 50 0 25 14Z" fill="#b77b43"/><path d="M0 0V28L25 42V14Z" fill="#b2a27b"/><path d="M25 14V42L50 28V0Z" fill="#716a53"/><path d="M-3 0 23 -26 53 0 25 14Z" fill="#844631"/><path d="M23 -26 25 14 53 0Z" fill="#b1643d"/><path d="M33 23V36L41 32V19Z" fill="#332b26"/><path d="M8 14V22L16 27V19Z" fill="#e4ba69"/></g>';
  const tree = (x: number, y: number) => '<g transform="translate('+x+' '+y+')"><path d="M-2 0V-28H3V0" stroke="#564738" stroke-width="4"/><path d="M0 -66 -17 -35 -10 -35 -22 -14 0 -20 22 -14 10 -35 17 -35Z" fill="#294a3d" stroke="#456447" stroke-width="2"/></g>';
  let art = '<rect width="480" height="260" fill="'+(wet ? '#6e8991' : '#8baba5')+'"/><path d="M0 115 75 35 128 103 201 25 286 111 363 42 480 107V260H0Z" fill="'+(rocky ? '#667578' : '#667d67')+'"/><path d="M0 156Q130 78 250 146T480 125V260H0Z" fill="'+(wet ? '#465d50' : '#6d8050')+'"/>';
  if (rocky) art += '<path d="M0 260 58 140 160 113 276 150 400 122 480 204V260Z" fill="#7d7967"/><path d="M58 140 76 215 111 168 135 260M276 150 247 230 281 260M400 122 368 222 394 260" fill="none" stroke="#555e57" stroke-width="8"/>';
  art += '<path d="M0 235Q104 184 219 214T480 191V260H0Z" fill="'+(wet ? '#477a7b' : '#9a9864')+'"/><path d="M204 260 227 209 273 181 295 140" stroke="#c3b081" stroke-width="15" fill="none"/>';
  for(let i=0;i<15;i++) if(woods || i<6) art += tree(15+(i*73)%460, 130+(i*19)%85);
  if (species === 'goblins') {
    for(let i=0;i<4;i++) art += '<path d="M'+(80+i*75)+' 190l28 -61 28 61 -27 -9Z" fill="#b09366" stroke="#514233" stroke-width="3"/>';
    art += '<path d="M220 220 232 191 239 207 245 183 255 220Z" fill="#edab48"/>';
  } else if (species === 'trolls') {
    art += '<path d="M92 190Q87 72 240 88T389 190Z" fill="#58635c"/><path d="M165 191Q170 106 241 120T314 191Z" fill="#172c2c"/><path d="M117 114Q210 161 347 112" stroke="#77815b" stroke-width="15" fill="none"/>';
  } else {
    art += house(175,128,1.5);
    if (rocky || state.towns[townId]?.kind === 'capital') art += '<g fill="#aaa58a" stroke="#595b50" stroke-width="2"><path d="M140 188V113H164V188ZM307 183V103H333V183Z"/><path d="M132 112V99H143V106H151V99H163V106H173V119ZM300 103V90H311V97H319V90H332V97H342V111Z"/><path d="M153 180 193 201 308 178V197L193 221 153 200Z"/></g>';
    if(species === 'titans') art += '<path d="M222 145V51H266V145M214 54V38H275V54" fill="#8b9278" stroke="#46584e" stroke-width="4"/><path d="M232 81V62H241V81M250 81V62H259V81" stroke="#243c37" stroke-width="5"/>';
    if(!species) for(let i=0;i<5;i++) art += house(72+i*67,174+(i%2)*21,.7);
  }
  const setting=woods?'forest':wet?'marsh':land==='badlands'?'badlands':rocky?'mountains':'plains';
  const scene = species ?? (state.towns[townId]?.kind === 'capital' ? 'capital' : state.towns[townId]?.kind==='lair' ? 'town-badlands' : 'town-'+setting);
  if (scene) art = '<image href="/assets/scenes/'+scene+'-v1.png" x="0" y="0" width="480" height="260" preserveAspectRatio="xMidYMid slice"/>';
  if(city && !species) {
    if(city.buildings.farm) for(let i=0;i<city.buildings.farm*4;i++) art += '<path d="M'+(15+i*15)+' 238l37 -17 9 5 -37 17Z" fill="#ccad59" stroke="#727244"/>';
    if(city.buildings.lumber) {art += house(340,165,.75); art += '<path d="M360 219l45 -15m-45 22 45 -15m-45 22 45 -15" stroke="#79523a" stroke-width="7"/>';}
    if(city.buildings.mine) art += '<path d="M47 181V151Q64 126 83 151V181Z" fill="#303b36" stroke="#9d9476" stroke-width="7"/>';
    if(city.buildings.forge) { art += house(292,202,.85); art += '<path d="M315 197V163H325V200" stroke="#666258" stroke-width="9"/><path d="M319 158q-14 -18 0 -30t0 -25" fill="none" stroke="#d1c5a0" stroke-width="6" opacity=".65"/>'; }
    if(city.project) art += '<g stroke="#d7b372" stroke-width="3" fill="none"><path d="M392 207V141M430 207V141M388 156H435M388 177H435M392 207 430 141"/></g>';
  }
  const levels = city && !species ? Object.entries(city.buildings).filter(([,n])=>n>0).map(([id,n])=>BUILDINGS[id as keyof typeof BUILDINGS].name+' '+n).join(' · ') : '';
  const title = species ? ({goblins:'Goblin camp',trolls:'Troll den',giants:'Giant stronghold',titans:'Titan sanctuary'})[species] : 'Settlement on '+land+' terrain';
  return '<figure class="place-scene'+(cleared ? ' cleared' : '')+'"><svg viewBox="0 0 480 260" role="img" aria-label="'+esc(title)+'">'+art+'</svg><figcaption>'+esc(title)+(cleared ? ' · cleared' : '')+(levels ? '<span>'+esc(levels)+'</span>' : '')+(city?.project ? '<span>Under construction: '+esc(BUILDINGS[city.project.kind].name)+'</span>' : '')+'</figcaption></figure>';
}

