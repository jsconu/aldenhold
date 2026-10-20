import type { FactionId, GameState } from './types';

/** Treaties are scoped to their settlement. Other neutral towns remain independent. */
export function hasPassage(state: GameState, mover: FactionId, townId: string): boolean {
  const town = state.towns[townId];
  const treaty = state.treaties[townId];
  return mover === 'player' && town?.owner === 'neutral'
    && treaty?.relation === 'ally' && treaty.passage === true;
}
