export type FactionId = 'player' | 'orcs' | 'neutral';
export type Side = 'attacker' | 'defender';
export type Terrain = 'plain' | 'forest' | 'hill' | 'stream' | 'marsh' | 'thorns' | 'ruins' | 'rocks' | 'spring';

export interface TerrainType {
  id: Terrain;
  name: string;
  /** Movement points to enter; Infinity = impassable. */
  move: number;
  defense: number;
  /** Extra range for missile troops standing here. */
  rangeBonus: number;
  /** Men (or hero HP) restored at the start of the unit's turn, up to its strength at the start of the battle. */
  heal: number;
  /** Men (or hero HP) lost when a unit ends a move here. Never kills the last man. */
  moveLoss: number;
  /** Morale lost at the start of each turn spent here. */
  moraleDrain: number;
  text: string;
}
export type SpellId = 'fireball' | 'terror' | 'heal' | 'rally';

export interface Spell {
  id: SpellId;
  name: string;
  cost: number;
  range: number;
  target: 'enemy' | 'friend';
  text: string;
}

export interface HeroTraits {
  /** Morale bonus for every troop in the hero's army. */
  leadership: number;
  /** Fighting weight in the damage formula; a hero's hit points don't make them hit harder. */
  power: number;
  mana: number;
  spells: SpellId[];
}

export interface UnitType {
  id: string;
  name: string;
  short: string;
  attack: number;
  defense: number;
  move: number;
  /** 1 = melee only; higher = can fire at that many hexes. */
  range: number;
  men: number;
  cost: number;
  upkeep: number;
  /** Where the player can raise it: any owned town, the capital only, or never. */
  recruit: 'any' | 'capital' | null;
  /** Present for heroes. For heroes, `men` is base hit points and `cost` the hiring fee. */
  hero?: HeroTraits;
}

export interface Troop {
  id: number;
  type: string;
  /** Men in the troop; hit points for a hero. */
  men: number;
  /** Heroes only. */
  name?: string;
  mana?: number;
  xp: number;
  /** Already marched (or was raised) this month. */
  moved: boolean;
}

export interface Army {
  id: number;
  owner: FactionId;
  at: string;
  /** Node the army last came from; where it falls back to after a failed attack. */
  from: string | null;
  troops: Troop[];
}

export interface MapNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Town {
  id: string;
  owner: FactionId;
  pop: number;
  /** Percent, 0–50. */
  tax: number;
  kind: 'capital' | 'town' | 'lair';
}

export interface BattleUnit {
  /** Overflow formations remain off-field for this battle; no combat or XP. */
  reserve: boolean;
  id: number;
  side: Side;
  armyId: number;
  troopId: number;
  type: string;
  name?: string;
  men: number;
  startMen: number;
  /** Cap for healing: starting men for troops, full hit points for heroes. */
  maxMen: number;
  xp: number;
  mana: number;
  morale: number;
  routing: boolean;
  fled: boolean;
  /** Attacks and spells this battle; heroes earn extra experience from them. */
  deeds: number;
  col: number;
  row: number;
  moved: boolean;
  acted: boolean;
}

export interface Battle {
  at: string;
  attackerId: number;
  defenderId: number;
  owners: Record<Side, FactionId>;
  width: number;
  height: number;
  /** terrain[col][row] */
  terrain: Terrain[][];
  units: BattleUnit[];
  round: number;
  active: Side;
  walls: boolean;
  log: string[];
  outcome: Side | null;
  retreated: Side | null;
  seed: number;
}

export interface PendingBattle {
  attackerId: number;
  defenderId: number;
}

export interface HeroOffer {
  town: string;
  type: string;
  name: string;
  expires: number;
}

export type EndingReason = 'lair-captured' | 'capital-lost' | 'lord-dead';

export type CampaignId = 'valley-quickplay';

/** A troop in a campaign's starting setup: a unit type id, or a named hero. */
export type StartTroop = string | { type: string; name: string };

/** Static definition of a campaign: its world and opening position. Never mutated at runtime. */
export interface CampaignDefinition {
  id: CampaignId;
  revision: number;
  name: string;
  /** First journal entry of a new game. */
  intro: string;
  capital: string;
  lair: string;
  startingGold: number;
  lordName: string;
  nodes: MapNode[];
  edges: [string, string][];
  towns: Town[];
  armies: { owner: FactionId; at: string; troops: StartTroop[] }[];
  offers: HeroOffer[];
}

/** Kinds of deed the permanent journal keeps. 'earlier' holds chronicle lines carried over from older saves. */
export type DeedKind = 'story' | 'battle' | 'capture' | 'loss' | 'hero' | 'realm' | 'ending' | 'earlier';

/** One permanent journal entry. The chronicle (GameState.log) stays a short, rolling news feed. */
export interface JournalEntry {
  id: number;
  turn: number;
  kind: DeedKind;
  text: string;
  /** Map location the deed happened at, if any. */
  place: string | null;
}

export interface GameState {
  version: 4;
  campaignId: CampaignId;
  campaignRevision: number;
  endingReason: EndingReason | null;
  turn: number;
  gold: number;
  nextId: number;
  seed: number;
  nodes: MapNode[];
  edges: [string, string][];
  towns: Record<string, Town>;
  armies: Army[];
  battle: Battle | null;
  pending: PendingBattle[];
  offers: HeroOffer[];
  log: string[];
  journal: JournalEntry[];
  status: 'playing' | 'won' | 'lost';
}
