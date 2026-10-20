import type { CampaignDefinition, CampaignId } from '../game/types';
import { VALLEY_QUICKPLAY } from './campaigns/valleyQuickplay';
import { HERO_NAMES, HIREABLE_HEROES, SPELLS, TERRAIN, UNIT_TYPES } from './rules';

/** Everything static the game is built from. Runtime state lives in GameState and never edits these. */
export const CATALOG = {
  units: UNIT_TYPES,
  spells: SPELLS,
  terrain: TERRAIN,
  hireableHeroes: HIREABLE_HEROES,
  heroNames: HERO_NAMES,
  campaigns: { 'valley-quickplay': VALLEY_QUICKPLAY } as Record<CampaignId, CampaignDefinition>,
};

export type Catalog = typeof CATALOG;

export function getCampaign(id: CampaignId): CampaignDefinition {
  const def = CATALOG.campaigns[id];
  if (!def) throw new Error(`Unknown campaign: ${id}`);
  return def;
}
