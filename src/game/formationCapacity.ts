import { UNIT_TYPES } from './data';
import type { Troop } from './types';

export const FORMATION_SPACE = 200;
/** Capacity budget for one formation; combining multiple formations in a hex remains separate work. */
export function formationCapacity(troop: Pick<Troop, 'type' | 'gear'>): number {
  const type = UNIT_TYPES[troop.type];
  if (!type || type.hero || troop.type === 'scout' || type.recruit === null) return type?.men ?? 0;
  const space = troop.type === 'knights' ? (troop.gear.armor === 'plate' ? 8 : troop.gear.armor === 'chain' ? 6 : 4) : 2;
  return Math.floor(FORMATION_SPACE / space);
}
