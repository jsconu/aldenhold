import { scoutSees } from './scouts';
import { scoutedTarget } from './intel';
import { ARMY_CAP, armyAt, campaignOf, enterNode, log, makeTroop, marchAlong, neighborsOf, nodeName, sharedMp } from './campaign';
import type { Army, GameState } from './types';
import { marchOptions, pathTo, stepCost, stopsMarch, townAt, townLocation, worldOf, isCovert } from './world';
import { isHero } from './units';

const SPAWN_EVERY = 3;
const RAID_EVERY = 4;
const RAID_MIN_GARRISON = 4;

/** Orc strategy: the Hold grows its garrison and sends raiders at the nearest town not held by orcs. */
export function orcTurn(state: GameState, beforeMarch?: (state: GameState, army: Army, route: string[]) => void) {
  const lairId = campaignOf(state).lair;
  const LAIR = townLocation(state, lairId);
  if (state.towns[lairId].owner === 'orcs') {
    // The Hold's garrison grows to a full army and no further.
    if (state.turn % SPAWN_EVERY === 0 && (armyAt(state, LAIR, 'orcs')?.troops.length ?? 0) < ARMY_CAP) {
      const type = state.turn % (SPAWN_EVERY * 2) === 0 ? 'troll' : 'warband';
      const garrison = armyAt(state, LAIR, 'orcs');
      if (garrison) garrison.troops.push(makeTroop(state, type));
      else state.armies.push({ id: state.nextId++, owner: 'orcs', at: LAIR, from: null, troops: [makeTroop(state, type)] });
    }
    const garrison = armyAt(state, LAIR, 'orcs');
    if (state.turn % RAID_EVERY === 0 && garrison && garrison.troops.filter((t) => !isHero(t.type)).length >= RAID_MIN_GARRISON) {
      // The warchief and shaman stay home; half the rank and file ride out.
      const ranks = garrison.troops.filter((t) => !isHero(t.type));
      if(state.challenge && garrison.troops.length<=8){ranks.length=0;}
      const raiders = ranks.slice(0,state.challenge?Math.min(2,Math.max(0,garrison.troops.length-8)):Math.ceil(ranks.length / 2));
      garrison.troops = garrison.troops.filter((t) => !raiders.includes(t));
      if(raiders.length)state.armies.push({ id: state.nextId++, owner: 'orcs', at: LAIR, from: null, troops: raiders });
      if(raiders.length && scoutSees(state, LAIR))log(state, 'A war party rides out of Gharzak Hold.');
    }
  }

  // Everything outside the Hold, plus a fresh war party, marches one step.
  const marching = state.armies.filter((a) => a.owner === 'orcs' && !isCovert(a) && (a.at !== LAIR || a !== armyAt(state, LAIR, 'orcs')));
  const hex = worldOf(state).kind === 'hex';
  for (const army of marching) {
    if (state.status !== 'playing' || !state.armies.includes(army)) continue;
    if (hex) {
      raidAcrossHexes(state, army, beforeMarch);
      continue;
    }
    const step = stepTowardTarget(state, army.at);
    if (!step) continue;
    if (state.armies.some((a) => a.at === step && a.owner === 'player')) {
      log(state, `Orcs attack your troops at ${nodeName(state, step)}!`);
    }
    enterNode(state, army, step);
  }
}

/** First step on the shortest path to the closest town not held by orcs. */
export function stepTowardTarget(state: GameState, from: string): string | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const town = townAt(state, cur);
    if (cur !== from && town && town.owner !== 'orcs') {
      let step = cur;
      while (prev.get(step) !== from) step = prev.get(step)!;
      return step;
    }
    for (const n of neighborsOf(state, cur)) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  return null;
}

/** Planning cost of pushing through an enemy army, so raiders go around strong points when there's a fair way round. */
const FIGHT_COST = 4;

/** On a hex map, march along the cheapest raid route as far as this month's movement allows. */
function raidAcrossHexes(state: GameState, army: Army, beforeMarch?: (state: GameState, army: Army, route: string[]) => void) {
  let budget = sharedMp(army.troops);
  const steps: string[] = [];
  const route = raidPath(state, army);
  beforeMarch?.(state, army, route);
  for (const at of route) {
    budget -= stepCost(state, at);
    if (budget < 0) break;
    steps.push(at);
    if (stopsMarch(state, at, 'orcs')) break;
  }
  if (!steps.length) return;
  const end = steps.at(-1)!;
  if (state.armies.some((a) => a.at === end && a.owner === 'player')) log(state, `Orcs attack your troops at ${nodeName(state, end)}!`);
  for (const t of army.troops) t.mp = 0;
  marchAlong(state, army, steps);
}

/** Cheapest route to the nearest town not held by orcs, fighting through anyone in the way unless a detour is cheap. */
export function raidPath(state: GameState, army: Army): string[] {
  const options = marchOptions(state, army.at, 'orcs', Infinity, true);
  let best: { at: string; cost: number } | null = null;
  // A quest's incursion keeps its target.
  const target = army.target && state.towns[army.target]?.owner !== 'orcs' ? townLocation(state, army.target) : null;
  if (target && options.has(target)) best = { at: target, cost: options.get(target)!.cost };
  for (const [at, step] of target && best ? [] : options) {
    const town = townAt(state, at);
    if (!town || town.owner === 'orcs') continue;
    if (!best || step.cost < best.cost) best = { at, cost: step.cost };
  }
  // A war party's usual target is the nearest town; a weak town of yours that the orcs' hidden scouts have seen
  // draws it instead, if it isn't much further (at most half as far again).
  if (!target && best && army.owner === 'orcs') {
    const nearest = best.cost;
    const scouted = scoutedTarget(state, (at) => options.has(at) && options.get(at)!.cost <= nearest * 1.5);
    if (scouted) best = { at: scouted, cost: options.get(scouted)!.cost };
  }
  if (!best) return [];
  const path = pathTo(options, best.at);
  const fights = path.filter((k) => state.armies.some((a) => a.at === k && a.owner !== 'orcs')).length;
  if (fights) {
    const around = marchOptions(state, army.at, 'orcs', Infinity);
    const detour = around.get(best.at);
    if (detour && detour.cost <= best.cost + fights * FIGHT_COST) return pathTo(around, best.at);
  }
  return path;
}
