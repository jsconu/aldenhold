export type FactionId = 'player' | 'orcs' | 'neutral' | MonsterSpecies;

/** Monster peoples who hold lairs (monster raids spec): each is its own faction. */
export type MonsterSpecies = 'goblins' | 'trolls' | 'giants' | 'titans';
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
  /** Fighting weight in the damage formula at level 1; a hero's hit points don't make them hit harder. */
  power: number;
  /**
   * Share of `power` gained per level after the first. Fighting classes grow fast and become very strong; casters
   * grow slowly and rely on their spells.
   */
  growth: number;
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
  /**
   * Where the player can raise it: any owned town, the capital only, a free town allied by treaty
   * (its own people, drawn from its population), or never.
   */
  recruit: 'any' | 'capital' | { ally: string } | null;
  resistances?: Partial<Record<DamageKind, number>>;
  /** Overland movement points per month on hex campaigns. */
  march: number;
  /** Bow carried by a newly raised formation, if better than the short bow every missile troop starts with. */
  startingBow?: 'long-bow';
  /**
   * A thrown-boulder attack (the cyclops): the unit takes aim at a formation one turn, announcing it, and throws the
   * next if the target is still within `range`. Damage is multiplied by `factor` and can't be struck back.
   */
  boulder?: { range: number; factor: number };
  /** Never loses morale or runs (quest monsters): it fights until it falls. */
  fearless?: boolean;
  /** Regains this many men (up to its starting strength) at the start of each of its turns: trolls. */
  regenerate?: number;
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
  /** A stationary watch assignment; moving the scout clears it. */
  /** A scout keeping watch where it stands ('city' and 'road' are the same watch, from older saves). */
  scoutPost?: 'watch' | 'city' | 'road';
  /** Heroes only: campaign equipment they carry, by slot (item ids). */
  kit?: HeroKit;
}

/** A hero's equipment slots (ITEM-02). */
export type HeroSlot = 'weapon' | 'armor' | 'accessory';
export type HeroKit = Partial<Record<HeroSlot, string>>;

export interface Army {
  id: number;
  owner: FactionId;
  at: string;
  /** Node the army last came from; where it falls back to after a failed attack. */
  from: string | null;
  troops: Troop[];
  /** Raiders only: the town this force marches on (a quest's incursion) instead of the nearest one. */
  target?: string;
  /** Independent-city expedition; its home town has its own diplomacy. */
  cityRaid?:{origin:string;target:string;launched:number;returning?:boolean};
  /** How this army sets up and fights; absent means Offensive. */
  tactics?: Tactics;
  /** The month this army set up camp against the weather (game/weather.ts). */
  campTurn?: number;
  /** A monster raiding party from this lair: it never captures, and leaves after its battle. */
  raid?: { lair: string };
}

/** An army's battle plan: a preset stance, or Custom with your own placements (TAC-01). */
export type Stance = 'offensive' | 'defensive' | 'skirmish' | 'custom';

/** A place in a side's 3-column deployment zone: depth 0 is the front column, 2 the back; rows 0–8. */
export interface DeployCell { depth: number; row: number }

export interface Tactics {
  stance: Stance;
  /** Custom only: where each formation starts, by troop id. Formations without a place are set up as Offensive. */
  layout?: Record<string, DeployCell>;
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
  /** Boulder throwers: the enemy formation they have taken aim at, thrown at on their next turn. */
  aim?: number;
  /** Heroes: their equipment as the battle began. */
  kit?: HeroKit;
}

export interface Battle {
  /** Set only when writing a completed result back; active saved battles must remain unsettled. */
  settled?: boolean;
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
  /** Each side's stance, fixed as the battle begins; absent sides fight Offensive. */
  stances?: Partial<Record<Side, Stance>>;
  /** A quest encounter: which choice started it, the guardian army, and the hero party split off for it. */
  encounter?: { quest: string; choice: string; guardian: number; army: number; party?: number };
  /** A monster raid on one of your towns: the lair it came from and the town it struck. */
  raid?: { lair: string; town: string };
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

export type EndingReason = 'lair-captured' | 'chapter-complete' | 'capital-lost' | 'lord-dead';

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
  /** Static local economic context; mechanics use the town's actual resource endowment. */
  settlementProfiles?: Record<string, { region: string; role: string }>;
  /** Start locations are node ids on the valley and place ids on a hex map. */
  armies: { owner: FactionId; at: string; troops: StartTroop[] }[];
  offers: HeroOffer[];
  /** A chapter campaign: finishing this main quest completes it (a win). */
  chapter?: { title: string; finale: string; ending: string };
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
/** How a town stands toward you (DIP-01). */
export type Relation = 'hostile' | 'neutral' | 'truce' | 'ally' | 'vassal';

export interface Treaty {
  relation: Relation;
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
  resolvedBy: 'choice' | 'encounter' | 'objective' | 'deadline' | 'location-lost' | null;
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
  | { kind: 'month'; atLeast: number }
  /** Towns (not lairs) you rule. */
  | { kind: 'towns-ruled'; atLeast: number }
  /** Towns you rule plus free towns allied with you or your vassals: your standing in the realm. */
  | { kind: 'standing'; atLeast: number }
  /** Your formations in the field and in garrison, heroes not counted. */
  | { kind: 'formations'; atLeast: number }
  /** One of your armies stands at this town or landmark (a discovery). */
  | { kind: 'army-at'; place: string }
  /** Food stored in one of your cities. */
  | { kind: 'food'; town: string; atLeast: number }
  /** Any one of these holds. */
  | { kind: 'any'; of: QuestCondition[] };

/** Where a quest goes next: another stage, or an ending. */
export type QuestNext = { stage: string } | QuestResolution;

/**
 * An authored battle at a landmark, started by a quest choice. Your army must stand at the site. The guardian
 * force appears for the fight and leaves afterwards; it never roams the map. Losing or retreating takes `lose`.
 */
export interface QuestEncounter {
  /** A town or landmark id. */
  site: string;
  owner: FactionId;
  troops: StartTroop[];
  /** Only your heroes fight (not your lord, whom the council won't risk); the rest of the army waits. */
  heroesOnly?: boolean;
  win: QuestNext;
  lose: QuestNext;
}

/** Something that happens in the world when a quest stage begins. */
export type QuestEvent = {
  kind: 'spawn';
  owner: FactionId;
  /** A town or landmark id. Joins an army of the same owner already there. */
  at: string;
  troops: StartTroop[];
  /** Town the force marches on. */
  target?: string;
}
  /** Spoilage or loss: a city you rule keeps only this fraction of one good. */
  | { kind: 'spoil'; town: string; good: GoodId; keep: number }
  /** Evidence or a find that comes to light as the stage begins. Granted once, since a stage is entered once. */
  | { kind: 'item'; item: string };

/**
 * A stage goal checked against the world at each month's end (and when the quest's town changes hands). The
 * first one whose conditions all hold moves the quest on, before any deadline is applied.
 */
export interface QuestObjective {
  id: string;
  /** Shown in the journal once reached ("Held the line"). */
  label: string;
  when: QuestCondition[];
  then: QuestNext;
}

/** What a quest's resolution changes in the campaign. Applied exactly once. */
export type QuestEffect =
  | { kind: 'treaty'; town: string; relation: Treaty['relation']; passage: boolean }
  | { kind: 'item'; item: string; qty?: number }
  /** The quest takes this evidence as proof: it stays in the record, archived, and can't be presented again. */
  | { kind: 'archive'; item: string }
  | { kind: 'gold'; amount: number }
  /** Goods added to (or taken from) one of your cities; nothing happens if you no longer rule it. */
  | { kind: 'goods'; town: string; good: GoodId; amount: number }
  /** People arriving in (or leaving) a town. */
  | { kind: 'population'; town: string; amount: number }
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
  /** Objects you must hold (not archived) to make this choice: evidence to present, a charter to show. */
  requires?: string[];
  /** World conditions the choice needs (an army in place, a town held); the first unmet one is the refusal. */
  needs?: QuestCondition[];
  /** Move to another stage, end the quest, or fight an encounter whose result decides. */
  then: QuestNext | { encounter: QuestEncounter };
}

export interface QuestStage {
  id: string;
  text: string;
  choices: QuestChoice[];
  /** Goals that move the quest on by themselves when the world meets them. */
  objectives?: QuestObjective[];
  /** What happens in the world as the stage begins (applied once, on entering it). */
  onStart?: QuestEvent[];
  /** Towns that raise no troops while this stage is open (rationing). */
  recruitBan?: string[];
  /** Months after the stage begins before it ends this way (a failure, or for "hold out" goals a success). */
  deadline?: { months: number; outcome: QuestResolution; afterBattles?: boolean };
}

export interface QuestDefinition {
  /** A narrative adventure entered by the ruler alone; their army waits at this site. */
  adventureSite?: string;
  id: string;
  campaignIds: CampaignId[];
  kind: 'main' | 'side';
  name: string;
  giver: string;
  /** Town id where the quest is offered and decided. */
  at: string;
  summary: string;
  prerequisites: QuestCondition[];
  /** A player army must stand at the quest's town or next to it to choose (encounter choices need the site instead). */
  needsEnvoy: boolean;
  /** The first stage is where the quest starts. */
  stages: QuestStage[];
  /** What happens if the quest's town changes hands before it is resolved. */
  onLocationLost: QuestResolution;
  /** The giver stays on if you take the town yourself (a merchant, not a ruling council). */
  survivesConquest?: boolean;
  /** Quest-specific wording for refusals; generic wording is used otherwise. */
  refusals?: { resolved?: string; envoy?: string; battle?: string };
}

/** Signed cash movements: positive receipts, negative actual payments. */
export type LedgerCategory = 'tax' | 'wages' | 'recruitment' | 'hero-hire' | 'construction' | 'maintenance' | 'refit' | 'quest' | 'quest-reward' | 'item-sale' | 'item-purchase' | 'lair-plunder' | 'raid-loss' | 'battle-spoils' | 'balance-correction';

/** A monster lair's state: active until its garrison is destroyed; hidden until found. */
export interface LairState {
  status: 'active' | 'cleared';
  discovered: boolean;
  clearedTurn: number | null;
  /** Month of its last raid, for its cooldown. */
  lastRaid: number | null;
}

/** A raid announced in one month, arriving its species' warning later. */
export interface PendingRaid {
  lair: string;
  target: string;
  announced: number;
  arrives: number;
}

/**
 * How a raid ended: it never came (its lair was cleared), turned back from a strong garrison, was beaten off in
 * battle, plundered the town, sacked it (a siege: plunder and a building knocked down), or took it.
 */
export type RaidResult = 'never-came' | 'turned-back' | 'beaten-off' | 'plundered' | 'sacked' | 'taken';

export interface RaidRecord {
  turn: number;
  lair: string;
  target: string;
  result: RaidResult;
  /** Whether the garrison fought it. */
  battle: boolean;
  gold: number;
  people: number;
  damaged: BuildingId | null;
  /** Men lost on each side (heroes not counted). */
  garrisonLost: number;
  raidersLost: number;
}

/** One kind of object in the campaign inventory. `qty` + `spent` always equals the number quests granted. */
export interface ItemHolding {
  qty: number;
  /** Used, sold or thrown away. */
  spent: number;
  /** Evidence a quest took as proof: kept in the record, no longer presentable. */
  archived: boolean;
  /** Bought from a merchant; absent means none. Counts alongside quest grants in the inventory's balance. */
  bought?: number;
}
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
  /** Tax receipts only. All posted receipts (including rewards/sales) are derived by cashReport. */
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

export type Difficulty='easy'|'normal'|'hard';
export interface CampaignChallenge {difficulty:Difficulty;fog:boolean;explored:string[];}
export type RulerClass='knight'|'priest'|'mage';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'blizzard';

/** A siege: an army camped beside a hostile town, wearing down its walls, supplies and morale month by month. */
export interface Siege {
  town: string;
  /** The besieging army, and the hex beside the town it camps on. */
  army: number;
  camp: string;
  startedTurn: number;
  /** 0–100; below 50 an assault no longer faces the walls. */
  walls: number;
  /** Months of food left in the town (tenths of a month). */
  supplies: number;
  /** 0–100; a town that can surrender offers terms at 40 or below. */
  morale: number;
  /** The town has offered to become your vassal. */
  offer: boolean;
}

export interface SiegeRecord {
  town: string;
  turn: number;
  result: 'vassal' | 'lifted' | 'stormed' | 'broken';
}

export interface RulerAppearance { rulerClass?:RulerClass; gender:'male'|'female'; skin:'fair'|'olive'|'brown'|'deep' }

export interface ScoutContact {
  armyId: number;
  scoutId: number;
  post: string;
  destination: string;
  seenTurn: number;
  arrivalTurn: number | null;
  active: boolean;
}

export interface GameState {
  /** Cosmetic ruler choice; absent on legacy saves. */
  cityPolitics?:{lastTurn:number;rivals:Record<string,{nextRaidTurn:number;warning?:{target:string;launchTurn:number}}>};
  challenge?:CampaignChallenge;
  rulerAppearance?: RulerAppearance;
  version: 18;
  /** Your sieges in progress (game/sieges.ts). */
  sieges: Siege[];
  /** How each siege ended, once. */
  siegeLog: SiegeRecord[];
  /** This month's weather (game/weather.ts), rolled when the month began. */
  /**
   * This month's weather (game/weather.ts), rolled when the month began, and the weather's own random stream, so
   * rolling it never changes any other seeded outcome.
   */
  weather: { kind: WeatherKind; turn: number; seed: number };
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
  /** Campaign inventory by item id. See game/items.ts. */
  items: Record<string, ItemHolding>;
  /** Location-scoped treaties; no accidental world-wide neutral-faction alliance. */
  treaties: Record<string, Treaty>;
  /** Campaign flags set by quest outcomes, read by later quests and rules. */
  flags: string[];
  /** Monster lairs of this campaign (content/lairs.ts), by id. */
  lairs: Record<string, LairState>;
  /** Raids announced and on their way (monster raids spec, step 3). */
  raids: PendingRaid[];
  /** Every raid that came due, and how it ended (monster raids spec, step 4). */
  raidLog: RaidRecord[];
  /** Deduplication keys for scout reports, which themselves are preserved in the journal. */
  scoutReports?: string[];
  /** Latest observation per scout/force pair; old journal entries remain historical. */
  scoutContacts?: ScoutContact[];
  status: 'playing' | 'won' | 'lost';
}
