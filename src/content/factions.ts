import type { FactionId, Relation } from '../game/types';

export interface FactionDefinition {
  id: FactionId;
  /** Full name, for the journal and tooltips. */
  name: string;
  /** Short owner label for map and panel badges ("Yours", "Free town"). */
  ownerLabel: string;
  /** Prefix for its troops in battle ("Your Archers", "Enemy Warband"). */
  troopPrefix: string;
  /** The player; raiders who attack everyone; or free towns that each keep their own treaty with you. */
  kind: 'player' | 'raiders' | 'free';
  /** Banner colour on the overland maps. */
  colour: string;
  /** How its towns stand toward you when no treaty says otherwise. */
  defaultRelation: Relation;
}

/** Every faction in the game. Free towns share one faction; each keeps its own treaty with you. */
export const FACTIONS: Record<FactionId, FactionDefinition> = {
  player: { id: 'player', name: 'Your realm', ownerLabel: 'Yours', troopPrefix: 'Your', kind: 'player', colour: '#5555ff', defaultRelation: 'ally' },
  orcs: { id: 'orcs', name: 'The orcs of Gharzak', ownerLabel: 'Orcs', troopPrefix: 'Enemy', kind: 'raiders', colour: '#ff3333', defaultRelation: 'hostile' },
  neutral: { id: 'neutral', name: 'The free towns', ownerLabel: 'Free town', troopPrefix: 'Town', kind: 'free', colour: '#ffdd55', defaultRelation: 'neutral' },
};
