/**
 * Compatibility surface for the rules modules. Content now lives in src/content (BASE-03); the names below are
 * the quick-play campaign's, which is the only campaign so far. New code should read the campaign from
 * `getCampaign(state.campaignId)` rather than these constants.
 */
import { VALLEY_QUICKPLAY } from '../content/campaigns/valleyQuickplay';

export { HERO_NAMES, HIREABLE_HEROES, LAND, SPELLS, TERRAIN, UNIT_TYPES } from '../content/rules';
export type { StartTroop } from './types';

export const LORD_NAME = VALLEY_QUICKPLAY.lordName;
export const CAPITAL = VALLEY_QUICKPLAY.capital;
export const LAIR = VALLEY_QUICKPLAY.lair;
export const MAP_NODES = VALLEY_QUICKPLAY.nodes;
export const MAP_EDGES = VALLEY_QUICKPLAY.edges;
export const START_TOWNS = VALLEY_QUICKPLAY.towns;
export const START_ARMIES = VALLEY_QUICKPLAY.armies;
export const STARTING_GOLD = VALLEY_QUICKPLAY.startingGold;
export const START_OFFER = VALLEY_QUICKPLAY.offers[0];
