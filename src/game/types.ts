export type FactionId = 'player' | 'orcs' | 'neutral';
export type Side = 'attacker' | 'defender';
export type Terrain = 'plain' | 'forest' | 'hill';

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
}

export interface Troop {
  id: number;
  type: string;
  men: number;
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
  men: number;
  startMen: number;
  xp: number;
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

export interface GameState {
  version: 1;
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
  log: string[];
  status: 'playing' | 'won' | 'lost';
}
