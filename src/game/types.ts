export type FactionId = 'player' | 'orcs' | 'neutral';
export type Side = 'attacker' | 'defender';
export type Terrain = 'plain' | 'forest' | 'hill';
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

export interface GameState {
  version: 2;
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
  status: 'playing' | 'won' | 'lost';
}
