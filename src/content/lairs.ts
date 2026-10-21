import type { CampaignId, Land, MonsterSpecies, StartTroop } from '../game/types';

/**
 * Monster lairs (monster raids spec, step 2): persistent home bases on the authored map. Each is a named place
 * with a garrison of its species. Lairs are found by bringing an army near, and cleared by defeating the
 * garrison, which pays out its plunder once. Raid planning from lairs is step 3; the raid fields here
 * (radius, activity, strength, cooldown) are its inputs, tuned then.
 */

export interface SpeciesProfile {
  name: string;
  /** Ground its lairs are found on (content validation enforces it). */
  lands: Land[];
  /** How they fight, and what counters them: shown on the lair panel. */
  tactics: string;
  counter: string;
  /** No lair of this species is placed closer than this to the player's capital (hexes). */
  minDistance: number;
}

export const SPECIES: Record<MonsterSpecies, SpeciesProfile> = {
  goblins: {
    name: 'Goblins', lands: ['forest', 'deepwood', 'hills'], minDistance: 6,
    tactics: 'Frequent light raids by skirmishers and archers, often from ambush.',
    counter: 'Scout patrols and a modest garrison; clear the warren.',
  },
  trolls: {
    name: 'Trolls', lands: ['swamp', 'water', 'forest'], minDistance: 10,
    tactics: 'Slow, durable attackers that regenerate, striking along rivers and crossings.',
    counter: 'Focused fire and defended crossings.',
  },
  giants: {
    name: 'Giants', lands: ['hills', 'mountains', 'badlands'], minDistance: 12,
    tactics: 'Rare heavy raids; they hurl boulders and pressure walls.',
    counter: 'Fortifications and strong formations led by heroes.',
  },
  titans: {
    name: 'Titans', lands: ['hills', 'mountains', 'badlands'], minDistance: 30,
    tactics: 'A very rare world-shaking threat, preceded by long warning.',
    counter: 'A prepared coalition of heroes and veteran troops.',
  },
};

export interface LairDefinition {
  id: string;
  name: string;
  species: MonsterSpecies;
  campaignId: CampaignId;
  /** The map place it stands on (a landmark). */
  place: string;
  /** 1 (a warren) to 4 (a titan's sanctum). */
  tier: 1 | 2 | 3 | 4;
  garrison: StartTroop[];
  /** Plunder for clearing it, paid once. */
  loot: { gold: number };
  /** Raid inputs for step 3 (hexes of reach, monthly activity 0–1, strength, months between raids). */
  raid: { radius: number; activity: number; strength: number; cooldown: number };
  /** Journal lines: when found, and when cleared. */
  discovery: string;
  cleared: string;
}

const W: CampaignId = 'western-realm';

export const LAIRS: Record<string, LairDefinition> = {
  briarwood: {
    id: 'briarwood', name: 'Briarwood Warren', species: 'goblins', campaignId: W, place: 'briarwood', tier: 1,
    garrison: ['goblinSkirmishers', 'goblinSkirmishers', 'goblinArchers', 'goblinArchers'],
    loot: { gold: 120 }, raid: { radius: 9, activity: 0.5, strength: 3, cooldown: 2 },
    discovery: 'Your scouts found Briarwood Warren: goblin burrows under the thorn thickets, with a trail worn toward Fenwick.',
    cleared: 'Briarwood Warren is cleared. The goblins who survived scattered into the hills, and the burrows were burned.',
  },
  hollowpine: {
    id: 'hollowpine', name: 'Hollowpine Warren', species: 'goblins', campaignId: W, place: 'hollowpine', tier: 1,
    garrison: ['goblinSkirmishers', 'goblinSkirmishers', 'goblinSkirmishers', 'goblinArchers'],
    loot: { gold: 120 }, raid: { radius: 9, activity: 0.5, strength: 3, cooldown: 2 },
    discovery: 'Your scouts found Hollowpine Warren in the southern pines, its middens full of Thornwatch’s stolen goods.',
    cleared: 'Hollowpine Warren is cleared. Thornwatch’s woodcutters can work the southern pines again.',
  },
  blackmire: {
    id: 'blackmire', name: 'Blackmire Den', species: 'trolls', campaignId: W, place: 'blackmire', tier: 2,
    garrison: ['troll', 'troll', 'troll'],
    loot: { gold: 220 }, raid: { radius: 8, activity: 0.35, strength: 6, cooldown: 3 },
    discovery: 'Your scouts found Blackmire Den: a troll lair in the drowned heart of the great swamp, ringed with gnawed bones.',
    cleared: 'Blackmire Den is cleared. The trolls are dead, their hoard of river tolls carried home.',
  },
  stonejaw: {
    id: 'stonejaw', name: 'Stonejaw Crag', species: 'giants', campaignId: W, place: 'stonejaw', tier: 3,
    garrison: ['giant', 'giant'],
    loot: { gold: 350 }, raid: { radius: 10, activity: 0.2, strength: 10, cooldown: 5 },
    discovery: 'Your scouts found Stonejaw Crag, where hill giants pile boulders above the road between Westmere and the mountains.',
    cleared: 'Stonejaw Crag is cleared. The giants’ boulder heaps are quiet, and their tribute stores are yours.',
  },
  eldersanctum: {
    id: 'eldersanctum', name: 'The Elder Sanctum', species: 'titans', campaignId: W, place: 'eldersanctum', tier: 4,
    garrison: ['titan', 'giant', 'giant'],
    loot: { gold: 800 }, raid: { radius: 14, activity: 0.05, strength: 24, cooldown: 12 },
    discovery: 'Your scouts found the Elder Sanctum, a ruined temple in the eastern hills where a titan sleeps among its giant servants.',
    cleared: 'The Elder Sanctum has fallen silent. The titan is dead; the songs of this victory will outlast your house.',
  },
};

/** The lairs of one campaign. */
export function lairsOf(campaignId: CampaignId): LairDefinition[] {
  return Object.values(LAIRS).filter((l) => l.campaignId === campaignId);
}
