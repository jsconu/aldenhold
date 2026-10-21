import { planDeployment } from './battle';
import { findArmy } from './campaign';
import type { Army, DeployCell, GameState, Stance } from './types';

/**
 * Army battle plans (the tactics screen). A preset stance sets up and fights by rule; Custom keeps your own
 * placement for each formation. Plans travel with the army and are used whenever it fights.
 */

export const STANCES: Record<Stance, { name: string; text: string }> = {
  offensive: { name: 'Offensive', text: 'Melee in front, archers and casters right behind. Everyone advances at once.' },
  defensive: { name: 'Defensive', text: 'A melee line in front, archers behind it, heroes at the back. Holds its ground until the enemy comes within 3 hexes.' },
  skirmish: { name: 'Skirmish', text: 'Archers out front on the flanks, melee in the middle guarding them, casters at the back. Melee holds until the enemy closes; archers keep their distance.' },
  custom: { name: 'Custom', text: 'Your own placement for each formation; anyone you haven’t placed sets up as Offensive. Advances like Offensive.' },
};

function playerArmy(state: GameState, armyId: number): Army | undefined {
  const army = findArmy(state, armyId);
  return army?.owner === 'player' ? army : undefined;
}

/** Why this army's plan can't be changed now, or null. */
export function tacticsReason(state: GameState, armyId: number): string | null {
  if (state.status !== 'playing' || state.battle) return 'Not during a battle.';
  return playerArmy(state, armyId) ? null : 'That is not one of your armies.';
}

/** Choose a stance. Switching to Custom starts from where the formations stand now. */
export function setStance(state: GameState, armyId: number, stance: Stance): string | null {
  const reason = tacticsReason(state, armyId);
  if (reason) return reason;
  const army = playerArmy(state, armyId)!;
  if (stance === 'custom') {
    army.tactics = { stance, layout: Object.fromEntries([...planDeployment(army)].map(([id, cell]) => [String(id), cell])) };
  } else if (stance === 'offensive') {
    delete army.tactics;
  } else {
    army.tactics = { stance };
  }
  return null;
}

/**
 * Put a formation in a cell of the deployment zone (front column is depth 0). A formation already there swaps
 * places with it. Placing makes the plan Custom, starting from the current arrangement.
 */
export function placeFormation(state: GameState, armyId: number, troopId: number, cell: DeployCell): string | null {
  const reason = tacticsReason(state, armyId);
  if (reason) return reason;
  const army = playerArmy(state, armyId)!;
  if (!army.troops.some((t) => t.id === troopId)) return 'That formation is not in this army.';
  if (!Number.isInteger(cell.depth) || cell.depth < 0 || cell.depth > 2 || !Number.isInteger(cell.row) || cell.row < 0 || cell.row > 8) return 'Not a deployment cell.';
  if (army.tactics?.stance !== 'custom') setStance(state, armyId, 'custom');
  const layout = army.tactics!.layout ?? (army.tactics!.layout = {});
  // Drop places for formations that have since left the army.
  for (const id of Object.keys(layout)) if (!army.troops.some((t) => String(t.id) === id)) delete layout[id];
  const from = layout[String(troopId)];
  const occupant = Object.entries(layout).find(([id, c]) => id !== String(troopId) && c.depth === cell.depth && c.row === cell.row)?.[0];
  if (occupant) {
    if (from) layout[occupant] = { ...from };
    else delete layout[occupant];
  }
  layout[String(troopId)] = { depth: cell.depth, row: cell.row };
  return null;
}
