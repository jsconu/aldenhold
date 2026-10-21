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

/** Overland terrain on hex campaigns. */
export type Land = 'plains' | 'farmland' | 'forest' | 'deepwood' | 'hills' | 'mountains' | 'swamp' | 'water' | 'badlands';

export interface LandType {
  id: Land;
  name: string;
  /** Character used for this land in a campaign's ASCII map. */
  char: string;
  /** Movement points to enter off-road; Infinity = impassable. Roads always cost 1. */
  move: number;
  /** Battlefield features scattered over the middle of a field fought on this land. */
  battleScatter: [Terrain, number][];
  /** Chance that a battlefield here has a stream across it. */
  battleStream: number;
  text: string;
}

export type SpellId = 'fireball' | 'ward' | 'terror' | 'frost' | 'haste' | 'slow' | 'lightning' | 'dispel' | 'entangle' | 'teleport' | 'quake' | 'chain-lightning' | 'firestorm' | 'disintegrate' | 'heal' | 'rally';
export type EffectId = 'ward' | 'frost' | 'haste' | 'slow' | 'entangle';
export type DamageKind = 'fire' | 'cold' | 'lightning' | 'earth' | 'arcane';
export interface SpellEffect { id: EffectId; turns: number; }

export interface Spell {
  id: SpellId;
  name: string;
  cost: number;
  range: number;
  target: 'enemy' | 'friend' | 'either';
  level: number;
  radius: number;
  lineOfSight: boolean;
  damageKind?: DamageKind;
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
  resistances?: Partial<Record<DamageKind, number>>;
  /** Overland movement points per month on hex campaigns. */
  march: number;
  /** Present for heroes. For heroes, `men` is base hit points and `cost` the hiring fee. */
  hero?: HeroTraits;
}

export type EquipmentId = 'short-bow' | 'long-bow' | 'compound-bow' | 'leather' | 'chain' | 'plate';
export type EquipmentSlot = 'bow' | 'armor';
export interface Loadout {
  bow: 'short-bow' | 'long-bow' | 'compound-bow' | null;
  armor: 'leather' | 'chain' | 'plate';
}
export interface PendingRefit {
  item: EquipmentId;
  startedTurn: number;
  orderedMen: number;
  paidGold: number;
  paidGoods: Partial<GoodsStock>;
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
  /**
   * Movement points left this month. On the nine-location valley a march costs the whole month (1 point); on a
   * hex map each unit type has its own budget. Troops raised, hired or refitting this month have 0.
   */
  mp: number;
  gear: Loadout;
  refit: PendingRefit | null;
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
  /** Turns remaining expire at the end of this formation's side turn. */
  effects: SpellEffect[];
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
  gear: Loadout;
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

export type CampaignId = 'valley-quickplay' | 'western-realm';

/** A troop in a campaign's starting setup: a unit type id, or a named hero. */
export type StartTroop = string | { type: string; name: string };

/** Static definition of a campaign: its world and opening position. Never mutated at runtime. */
/** A named hex on a hex campaign: a town (with an entry in `towns`) or a landmark. */
export interface Place {
  id: string;
  name: string;
  col: number;
  row: number;
  kind: 'town' | 'landmark';
}

/** A walkable hex overland map. Locations are hex keys "col,row"; towns and landmarks are named places. */
export interface HexWorld {
  /** One string per row, one character per hex; see LAND in content/rules.ts. */
  rows: string[];
  places: Place[];
  /** Roads, each a chain of place ids; laid along the easiest ground, bridging water. */
  routes: string[][];
}

export interface CampaignDefinition {
  id: CampaignId;
  revision: number;
  name: string;
  /** One line for the campaign chooser. */
  blurb: string;
  /** First journal entry of a new game. */
  intro: string;
  capital: string;
  lair: string;
  startingGold: number;
  lordName: string;
  /** The quick-play valley's locations and roads. Empty on hex campaigns. */
  nodes: MapNode[];
  edges: [string, string][];
  /** Present on hex campaigns: the walkable map. Town ids are then place ids, and locations are hex keys. */
  hex?: HexWorld;
  towns: Town[];
  /** Start locations are node ids on the valley and place ids on a hex map. */
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

/** A treaty belongs to one specific settlement, not to all neutral towns. */
export interface Treaty {
  relation: 'hostile' | 'neutral' | 'truce' | 'ally' | 'vassal';
  passage: boolean;
  signedTurn: number;
}

export type QuestStatus = 'unavailable' | 'available' | 'active' | 'succeeded' | 'failed' | 'superseded';
export type ResolvedQuestStatus = 'succeeded' | 'failed' | 'superseded';

/** Saved progress through one quest. Definitions (content) never change at runtime. */
export interface QuestProgress {
  status: QuestStatus;
  /** Current stage id; 'locked' before the quest becomes available, 'resolved' after it ends. */
  stage: string;
  /** The last choice made, if any. */
  choice: string | null;
  resolvedTurn: number | null;
  /** How the quest ended: a player choice, a missed deadline, or its town changing hands. */
  resolvedBy: 'choice' | 'deadline' | 'location-lost' | null;
  /** Month the current stage began (deadlines count from here); null while locked or resolved. */
  stageTurn: number | null;
  /** Every choice made, in order. */
  history: { stage: string; choice: string; turn: number }[];
}

/** When a quest unlocks: every condition must hold. */
export type QuestCondition =
  | { kind: 'quest'; quest: string; status: ResolvedQuestStatus }
  | { kind: 'town-owner'; town: string; owner: FactionId }
  | { kind: 'flag'; flag: string }
  | { kind: 'month'; atLeast: number };

/** What a quest's resolution changes in the campaign. Applied exactly once. */
export type QuestEffect =
  | { kind: 'treaty'; town: string; relation: Treaty['relation']; passage: boolean }
  | { kind: 'item'; item: string }
  | { kind: 'gold'; amount: number }
  | { kind: 'flag'; flag: string };

export interface QuestResolution {
  status: ResolvedQuestStatus;
  effects: QuestEffect[];
  /** Journal entry recorded when the quest ends this way. */
  journal: string;
}

export interface QuestChoice {
  id: string;
  label: string;
  /** Gold the choice costs, paid when chosen. */
  gold?: number;
  /** Move to another stage, or end the quest. */
  then: { stage: string } | QuestResolution;
}

export interface QuestStage {
  id: string;
  text: string;
  choices: QuestChoice[];
  /** Months after the stage begins before it fails, and what happens then. */
  deadline?: { months: number; outcome: QuestResolution };
}

export interface QuestDefinition {
  id: string;
  campaignIds: CampaignId[];
  kind: 'main' | 'side';
  name: string;
  giver: string;
  /** Town id where the quest is offered and decided. */
  at: string;
  summary: string;
  prerequisites: QuestCondition[];
  /** A player army must stand at the quest's town or next to it to choose. */
  needsEnvoy: boolean;
  /** The first stage is where the quest starts. */
  stages: QuestStage[];
  /** What happens if the quest's town changes hands before it is resolved. */
  onLocationLost: QuestResolution;
  /** Quest-specific wording for refusals; generic wording is used otherwise. */
  refusals?: { resolved?: string; envoy?: string; battle?: string };
}

/** Signed cash movements: positive receipts, negative actual payments. */
export type LedgerCategory = 'tax' | 'wages' | 'recruitment' | 'hero-hire' | 'construction' | 'maintenance' | 'refit' | 'quest' | 'quest-reward' | 'balance-correction';
export interface LedgerEntry {
  turn: number;
  city: string | null;
  category: LedgerCategory;
  amount: number;
  counterparty: string;
  actionId: string;
}
export interface MonthlyLedger {
  turn: number;
  opening: number;
  closing: number;
  income: number;
  expenses: number;
  /** Liability omitted from paid wages due to an empty treasury. */
  unpaidUpkeep: number;
  unpaidMaintenance: number;
  entries: LedgerEntry[];
}
export interface Treasury {
  /** Treasury balance at the beginning of the current month, before purchases. */
  opening: number;
  /** Current month's transactions, settled to a monthly ledger on End month. */
  pending: LedgerEntry[];
  history: MonthlyLedger[];
}

/** Local physical materials are not coins and cannot be spent by the treasury. */
export type GoodId = 'food' | 'timber' | 'ore' | 'tools';
export type BuildingId = 'farm' | 'lumber' | 'mine' | 'forge';
export type GoodsStock = Record<GoodId, number>;
export type BuildingLevels = Record<BuildingId, number>;

export interface Construction {
  kind: BuildingId;
  targetLevel: number;
  startedTurn: number;
  finishTurn: number;
  paidGold: number;
  paidGoods: Partial<GoodsStock>;
}
/** Last month's physical flows, separate from public money and taxes. */
export interface CityProduction {
  turn: number;
  produced: GoodsStock;
  inputs: GoodsStock;
  consumedFood: number;
  unmetFood: number;
  workforce: number;
  employed: number;
}
export interface CityEconomy {
  buildings: BuildingLevels;
  goods: GoodsStock;
  project: Construction | null;
  lastMonth: CityProduction | null;
}

export interface GameState {
  version: 11;
  campaignId: CampaignId;
  campaignRevision: number;
  endingReason: EndingReason | null;
  turn: number;
  gold: number;
  treasury: Treasury;
  cityEconomies: Record<string, CityEconomy>;
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
  /** Quest state is separate from immutable quest content. */
  quests: Record<string, QuestProgress>;
  /** Unique non-consumable campaign-held objects; future equipment is kept separately. */
  items: string[];
  /** Location-scoped treaties; no accidental world-wide neutral-faction alliance. */
  treaties: Record<string, Treaty>;
  /** Campaign flags set by quest outcomes, read by later quests and rules. */
  flags: string[];
  status: 'playing' | 'won' | 'lost';
}
