import { campaignOf, deed, makeTroop, nodeName } from './campaign';
import { hexDistance, hexKey } from './hex';
import { garrisonDefense } from './raids';
import { random } from './rng';
import { inSight, SCOUT_RANGE } from './scouts';
import type { Army, FactionId, GameState, Troop } from './types';
import { isCovert, parseKey, stepCost, townAt, townLocation, worldOf } from './world';
import { level } from './units';

/**
 * Scouts and spies (owner request, October 22, 2026).
 * - Your scouts can be stationed anywhere: a stationed scout leaves its army and keeps watch alone.
 * - The orcs and rival towns post hidden scouts near your towns. They never block a march (an army walking onto one
 *   catches it), and while unseen they show the orcs your weakest town in sight, which their war parties go for.
 * - Spies hunt scouts: each month every spy may unmask enemy scouts within SCOUT_RANGE hexes, more likely as the
 *   spy outranks the scout. Enemy spies (abstract, growing more skilled each year) hunt your stationed scouts the
 *   same way. Scouts on watch gain experience each month, so veterans are harder to find.
 */

/** Months before the orcs start sending scouts. */
const ENEMY_SCOUTS_FROM = 6;
/** Most hidden scouts one faction keeps out at a time. */
const MAX_ENEMY_SCOUTS = 2;

/** Chance that a spy of `spyLevel` unmasks a scout of `scoutLevel` in a month. */
export function detectChance(spyLevel: number, scoutLevel: number, base = 0.35): number {
  return Math.max(0.05, Math.min(0.95, base + 0.1 * (spyLevel - scoutLevel)));
}

/** The skill of enemy spies: they grow better each year. */
export function enemySpyLevel(state: GameState): number {
  return 1 + Math.floor(state.turn / 12);
}

/** Station a scout where it stands: it leaves its army (if it has one) and keeps watch there alone. */
export function stationScout(state: GameState, troopId: number): string | null {
  if (state.battle || state.status !== 'playing') return 'Not during a battle.';
  const army = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.id === troopId && t.type === 'scout'));
  if (!army) return 'That scout is not here.';
  const scout = army.troops.find((t) => t.id === troopId)!;
  scout.scoutPost = 'watch';
  if (army.troops.length > 1) {
    army.troops = army.troops.filter((t) => t !== scout);
    state.armies.push({ id: state.nextId++, owner: 'player', at: army.at, from: null, troops: [scout] });
  }
  deed(state, 'realm', `A scout is stationed at ${nodeName(state, army.at)} to keep watch.`, army.at);
  return null;
}

function covertOf(state: GameState, owner: FactionId): Army[] {
  return state.armies.filter((a) => a.owner === owner && isCovert(a));
}

/** An empty, passable spot two hexes from a town, for a hidden scout to lie up in. */
function hideout(state: GameState, townId: string): string | null {
  const world = worldOf(state);
  if (world.kind !== 'hex') return null;
  const at = parseKey(townLocation(state, townId));
  for (let row = 0; row < world.rows.length; row++) {
    for (let col = 0; col < world.rows[row].length; col++) {
      const key = hexKey({ col, row });
      if (hexDistance(at, { col, row }) !== 2 || !(stepCost(state, key) < Infinity) || townAt(state, key)) continue;
      if (state.armies.some((a) => a.at === key)) continue;
      return key;
    }
  }
  return null;
}

/** The orcs and rival towns post hidden scouts near your least defended towns. */
function postEnemyScouts(state: GameState): void {
  const yours = Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair')
    .sort((a, b) => garrisonDefense(state, a.id) - garrisonDefense(state, b.id) || a.id.localeCompare(b.id));
  if (!yours.length) return;
  const post = (owner: FactionId) => {
    const watched = new Set(covertOf(state, owner).flatMap((a) => yours.filter((t) => inSight(state, a.at, townLocation(state, t.id))).map((t) => t.id)));
    const town = yours.find((t) => !watched.has(t.id));
    const at = town && hideout(state, town.id);
    if (!at) return;
    const scout = makeTroop(state, 'scout');
    scout.scoutPost = 'watch';
    state.armies.push({ id: state.nextId++, owner, at, from: null, troops: [scout] });
  };
  if (state.turn >= ENEMY_SCOUTS_FROM && state.towns[campaignOf(state).lair]?.owner === 'orcs' && state.turn % 3 === 0
    && covertOf(state, 'orcs').length < MAX_ENEMY_SCOUTS) post('orcs');
  // Rival free towns watch you too, one scout each at a time.
  const rivals = Object.keys(state.cityPolitics?.rivals ?? {}).filter((id) => state.towns[id]?.owner === 'neutral');
  if (rivals.length && state.turn % 4 === 0 && covertOf(state, 'neutral').length < Math.min(MAX_ENEMY_SCOUTS, rivals.length)) post('neutral');
}

function removeTroop(state: GameState, army: Army, troop: Troop) {
  army.troops = army.troops.filter((t) => t !== troop);
  if (!army.troops.length) state.armies = state.armies.filter((a) => a !== army);
}

/** Who a hidden scout works for, in the player's words. */
function whose(owner: FactionId): string {
  return owner === 'orcs' ? 'an orc scout' : 'a scout from a rival town';
}

/**
 * The month's intelligence work: enemy scouts are posted, scouts on watch gain experience, your spies hunt the
 * enemy's scouts, and enemy spies hunt your stationed scouts. Returns the news.
 */
export function advanceIntel(state: GameState): string[] {
  if (worldOf(state).kind !== 'hex') return [];
  postEnemyScouts(state);
  const news: string[] = [];
  for (const a of state.armies) for (const t of a.troops) if (t.type === 'scout' && t.scoutPost) t.xp += 1;
  // Your spies, wherever they are.
  for (const army of state.armies.filter((a) => a.owner === 'player')) {
    for (const spy of army.troops.filter((t) => t.type === 'spy')) {
      for (const enemy of state.armies.filter((a) => isCovert(a) && inSight(state, army.at, a.at))) {
        const scout = enemy.troops[0];
        if (random(state) >= detectChance(level(spy.xp), level(scout.xp))) continue;
        spy.xp += 2;
        state.armies = state.armies.filter((a) => a !== enemy);
        deed(state, 'realm', `Your spy near ${nodeName(state, army.at)} unmasked ${whose(enemy.owner)} hiding at ${nodeName(state, enemy.at)}.`, enemy.at);
        news.push(`A spy unmasked ${whose(enemy.owner)}.`);
      }
    }
  }
  // Enemy spies hunt your stationed scouts near their lands and armies.
  const hostile = [
    ...Object.values(state.towns).filter((t) => t.owner === 'orcs' || (t.owner === 'neutral' && state.cityPolitics?.rivals[t.id])).map((t) => townLocation(state, t.id)),
    ...state.armies.filter((a) => a.owner === 'orcs' && !isCovert(a)).map((a) => a.at),
  ];
  for (const army of [...state.armies.filter((a) => a.owner === 'player')]) {
    for (const scout of army.troops.filter((t) => t.type === 'scout' && t.scoutPost)) {
      if (!hostile.some((at) => hexDistance(parseKey(at), parseKey(army.at)) <= 2 * SCOUT_RANGE)) continue;
      if (random(state) >= detectChance(enemySpyLevel(state), level(scout.xp), 0.15)) continue;
      const where = nodeName(state, army.at);
      removeTroop(state, army, scout);
      deed(state, 'loss', `Enemy spies found your scout at ${where}. The scout was killed.`, army.at);
      news.push(`A scout was lost to enemy spies at ${where}.`);
    }
  }
  return news;
}

/** Your army marching through hidden enemy scouts catches them. Returns the news. */
export function catchScouts(state: GameState, path: string[]): string[] {
  const news: string[] = [];
  for (const enemy of state.armies.filter((a) => isCovert(a) && path.includes(a.at))) {
    state.armies = state.armies.filter((a) => a !== enemy);
    deed(state, 'battle', `Your troops caught ${whose(enemy.owner)} hiding at ${nodeName(state, enemy.at)}.`, enemy.at);
    news.push(`Caught ${whose(enemy.owner)}.`);
  }
  return news;
}

/**
 * The orcs' hidden scouts show them your towns in sight: their war parties (not quest incursions) go for the
 * weakest of those, if they can reach it. Returns the town location, or null to keep their usual choice.
 */
export function scoutedTarget(state: GameState, reachable: (at: string) => boolean): string | null {
  const eyes = covertOf(state, 'orcs');
  if (!eyes.length) return null;
  const seen = Object.values(state.towns).filter((t) => t.owner === 'player' && t.kind !== 'lair'
    && eyes.some((a) => inSight(state, a.at, townLocation(state, t.id))) && reachable(townLocation(state, t.id)));
  seen.sort((a, b) => garrisonDefense(state, a.id) - garrisonDefense(state, b.id) || a.id.localeCompare(b.id));
  return seen.length ? townLocation(state, seen[0].id) : null;
}
