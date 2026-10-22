import { developmentArt } from './developmentArt';
import type { GameState, MonsterSpecies } from '../game/types';
import { hexLand, townLocation, worldOf } from '../game/world';
import { BUILDINGS } from '../game/cities';
import { esc } from './shared';

/** Rich scenery with separately rendered, saved development levels. */
export function placeScene(state: GameState, townId: string, species?: MonsterSpecies, cleared = false): string {
  const world = worldOf(state);
  const land = world.kind === 'hex' ? hexLand(world, townLocation(state, townId)).id : 'plains';
  const rocky = species === 'giants' || species === 'titans' || ['hills', 'mountains', 'badlands'].includes(land);
  const wet = species === 'trolls' || ['swamp', 'water'].includes(land);
  const woods = species === 'goblins' || ['forest', 'deepwood'].includes(land);
  const city = state.cityEconomies[townId];
  const setting=woods?'forest':wet?'marsh':land==='badlands'?'badlands':rocky?'mountains':'plains';
  const scene = species ?? (state.towns[townId]?.kind === 'capital' ? 'capital' : state.towns[townId]?.kind==='lair' ? 'town-badlands' : 'town-'+setting);
  let art = '<image href="/assets/scenes/'+scene+'-v1.png" x="0" y="0" width="480" height="260" preserveAspectRatio="xMidYMid slice"/>';
  if(city && !species) art += developmentArt(city);
  const levels = city && !species ? Object.entries(city.buildings).filter(([,n])=>n>0).map(([id,n])=>BUILDINGS[id as keyof typeof BUILDINGS].name+' '+n).join(' · ') : '';
  const title = species ? ({goblins:'Goblin camp',trolls:'Troll den',giants:'Giant stronghold',titans:'Titan sanctuary'})[species] : 'Settlement on '+land+' terrain';
  return '<figure class="place-scene'+(cleared ? ' cleared' : '')+'"><svg viewBox="0 0 480 260" role="img" aria-label="'+esc(title)+'">'+art+'</svg><figcaption>'+esc(title)+(cleared ? ' · cleared' : '')+(levels ? '<span>'+esc(levels)+'</span>' : '')+(city?.project ? '<span>Under construction: '+esc(BUILDINGS[city.project.kind].name)+'</span>' : '')+'</figcaption></figure>';
}

