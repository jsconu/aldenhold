import type { Battle } from './types';
import { UNIT_TYPES } from './data';
/** Victory spoils for the deployed opposition; preview and settlement share this calculation. */
export function battleSpoils(b: Battle): number {
  if(!b.outcome || b.owners[b.outcome]!=='player')return 0;
  const defeated=b.outcome==='attacker'?'defender':'attacker';
  return Math.min(1000,25+b.units.filter(u=>u.side===defeated && !u.reserve).reduce((sum,u)=>{
    const type=UNIT_TYPES[u.type];return sum+(type.hero?50:Math.ceil(u.startMen*(type.attack+type.defense)/4));
  },0));
}
