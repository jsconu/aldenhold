import {describe,it,expect} from 'vitest';
import {battleFigure} from './richBattle';
describe('formations and hero silhouettes',()=>{
 it('shows a group for regular formations, including mixed human artwork',()=>{
 const art=battleFigure('spearmen',50,60,false,20,undefined,'male');
 expect(art).toContain('20 soldiers in formation');expect(art.match(/rich-battle-unit/g)).toHaveLength(3);expect(art).toContain('humans-female-v1.png');expect(art).toContain('humans-v1.png');
 expect(battleFigure('archers',50,60,false,2).match(/rich-battle-unit/g)).toHaveLength(2);
 });
 it('keeps heroes and individual giant creatures as one larger figure',()=>{
 for(const type of ['lord','champion','mage','priest','rulerMage','rulerPriest','cyclops','giant','titan']){
 const art=battleFigure(type,50,60,true,20);expect(art.match(/rich-battle-unit/g)).toHaveLength(1);expect(art).not.toContain('scale(.64)');
 }
 });
});
