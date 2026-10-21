import { FACTIONS } from '../content/factions';
import type { FactionId, GameState, Relation } from './types';

/**
 * How a town stands toward you: 'self' if you rule it; otherwise its treaty with you, or its faction's default
 * (orcs hostile, free towns neutral). Treaties are scoped to their settlement; other free towns stay independent.
 */
export function relationWith(state: GameState, townId: string): Relation | 'self' | null {
  const town = state.towns[townId];
  if (!town) return null;
  if (town.owner === 'player') return 'self';
  return state.treaties[townId]?.relation ?? FACTIONS[town.owner].defaultRelation;
}

/** Whether your armies may enter this town without fighting: allies and vassals that granted passage. */
export function hasPassage(state: GameState, mover: FactionId, townId: string): boolean {
  const relation = relationWith(state, townId);
  return mover === 'player' && state.towns[townId]?.owner !== 'player'
    && (relation === 'ally' || relation === 'vassal') && state.treaties[townId]?.passage === true;
}

export const RELATION_LABEL: Record<Relation, string> = {
  hostile: 'Hostile', neutral: 'Neutral', truce: 'Truce', ally: 'Allied', vassal: 'Your vassal',
};
