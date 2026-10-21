import type { CampaignDefinition, CampaignId } from '../game/types';
import { VALLEY_QUICKPLAY } from './campaigns/valleyQuickplay';
import { WESTERN_REALM } from './campaigns/westernRealm';
import { FACTIONS } from './factions';
import { ITEMS } from './items';
import { MERCHANTS } from './merchants';
import { QUESTS } from './quests';
import { HERO_NAMES, HIREABLE_HEROES, LAND, SPELLS, TERRAIN, UNIT_TYPES } from './rules';

/** Everything static the game is built from. Runtime state lives in GameState and never edits these. */
export const CATALOG = {
  units: UNIT_TYPES,
  spells: SPELLS,
  terrain: TERRAIN,
  land: LAND,
  factions: FACTIONS,
  items: ITEMS,
  merchants: MERCHANTS,
  quests: QUESTS,
  hireableHeroes: HIREABLE_HEROES,
  heroNames: HERO_NAMES,
  campaigns: { 'western-realm': WESTERN_REALM, 'valley-quickplay': VALLEY_QUICKPLAY } as Record<CampaignId, CampaignDefinition>,
};

export type Catalog = typeof CATALOG;

export function getCampaign(id: CampaignId): CampaignDefinition {
  const def = CATALOG.campaigns[id];
  if (!def) throw new Error(`Unknown campaign: ${id}`);
  return def;
}
