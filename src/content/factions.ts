import type { FactionId, Relation } from '../game/types';

export interface FactionDefinition {
  id: FactionId;
  /** Full name, for the journal and tooltips. */
  name: string;
  /** Short owner label for map and panel badges ("Yours", "Free town"). */
  ownerLabel: string;
  /** Prefix for its troops in battle ("Your Archers", "Enemy Warband"). */
  troopPrefix: string;
  /** The player; raiders who attack everyone; free towns that each keep their own treaty with you; or monsters in their lairs. */
  kind: 'player' | 'raiders' | 'free' | 'monsters';
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
  goblins: { id: 'goblins', name: 'Goblins', ownerLabel: 'Goblins', troopPrefix: 'Wild', kind: 'monsters', colour: '#8fbf3f', defaultRelation: 'hostile' },
  trolls: { id: 'trolls', name: 'Trolls', ownerLabel: 'Trolls', troopPrefix: 'Wild', kind: 'monsters', colour: '#5f8a6a', defaultRelation: 'hostile' },
  giants: { id: 'giants', name: 'Giants', ownerLabel: 'Giants', troopPrefix: 'Wild', kind: 'monsters', colour: '#a08060', defaultRelation: 'hostile' },
  titans: { id: 'titans', name: 'Titans', ownerLabel: 'Titans', troopPrefix: 'Ancient', kind: 'monsters', colour: '#c0a0e0', defaultRelation: 'hostile' },
};
