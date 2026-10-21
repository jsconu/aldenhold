import type { CampaignId, StartTroop } from '../game/types';

export interface EncounterDefinition {
  id: string;
  quest: string;
  campaignIds: CampaignId[];
  name: string;
  /** Named landmark; a choice starts combat only when the player's army reaches it. */
  at: string;
  mode: 'army' | 'heroes';
  warning: string;
  enemies: StartTroop[];
}

/** Optional, one-attempt site battles. No random trigger or composition reroll. */
export const ENCOUNTERS: Record<string, EncounterDefinition> = {
  'quarry-one-eye': {
    id: 'quarry-one-eye', quest: 'Q02', campaignIds: ['western-realm'], name: 'One Eye at the Quarry', at: 'quarry', mode: 'army',
    warning: 'A troll and two orc war bands hold the quarry. Your whole army fights. Retreat or defeat ends the bounty without its reward.',
    enemies: ['troll', 'warband', 'warband'],
  },
  'tower-keeper': {
    id: 'tower-keeper', quest: 'Q03', campaignIds: ['western-realm'], name: 'Beneath the Old Tower', at: 'watchtower', mode: 'heroes',
    warning: 'Only heroes fit through the buried stair. An orc shaman and a war band wait below. Other formations stay outside, unharmed and without combat XP. Your ruler can die if sent inside. Bring companions or leave the site alone.',
    enemies: [{ type: 'shaman', name: 'The Tower Keeper' }, 'warband'],
  },
  'caravan-rescue': {
    id: 'caravan-rescue', quest: 'Q05', campaignIds: ['western-realm'], name: 'The Missing Caravan', at: 'bridge', mode: 'army',
    warning: 'Two war bands and orc archers are holding the wagons near Stone Bridge. Your whole army fights. This is an optional, one-attempt rescue.',
    enemies: ['warband', 'warband', 'orcArchers'],
  },
};
