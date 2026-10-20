import { armyAt, campaignOf, enterNode, log, makeTroop, neighborsOf, nodeName } from './campaign';
import type { GameState } from './types';
import { isHero } from './units';

const SPAWN_EVERY = 3;
const RAID_EVERY = 4;
const RAID_MIN_GARRISON = 4;

/** Orc strategy: the Hold grows its garrison and sends raiders at the nearest town not held by orcs. */
export function orcTurn(state: GameState) {
  const LAIR = campaignOf(state).lair;
  if (state.towns[LAIR].owner === 'orcs') {
    if (state.turn % SPAWN_EVERY === 0) {
      const type = state.turn % (SPAWN_EVERY * 2) === 0 ? 'troll' : 'warband';
      const garrison = armyAt(state, LAIR, 'orcs');
      if (garrison) garrison.troops.push(makeTroop(state, type));
      else state.armies.push({ id: state.nextId++, owner: 'orcs', at: LAIR, from: null, troops: [makeTroop(state, type)] });
    }
    const garrison = armyAt(state, LAIR, 'orcs');
    if (state.turn % RAID_EVERY === 0 && garrison && garrison.troops.filter((t) => !isHero(t.type)).length >= RAID_MIN_GARRISON) {
      // The warchief and shaman stay home; half the rank and file ride out.
      const ranks = garrison.troops.filter((t) => !isHero(t.type));
      const raiders = ranks.slice(0, Math.ceil(ranks.length / 2));
      garrison.troops = garrison.troops.filter((t) => !raiders.includes(t));
      state.armies.push({ id: state.nextId++, owner: 'orcs', at: LAIR, from: null, troops: raiders });
      log(state, 'A war party rides out of Gharzak Hold.');
    }
  }

  // Everything outside the Hold, plus a fresh war party, marches one step.
  const marching = state.armies.filter((a) => a.owner === 'orcs' && (a.at !== LAIR || a !== armyAt(state, LAIR, 'orcs')));
  for (const army of marching) {
    if (state.status !== 'playing' || !state.armies.includes(army)) continue;
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
    const town = state.towns[cur];
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
