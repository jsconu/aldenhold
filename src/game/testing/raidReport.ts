import { LAIRS } from '../../content/lairs';
import { autoResolve } from '../battle';
import { advanceMonth, applyBattle, makeTroop, newGame } from '../campaign';
import { raidOdds, RAID_GRACE_MONTH, strike } from '../raids';
import type { GameState, RaidResult } from '../types';
import { townLocation } from '../world';
import { resumeBattles } from './campaignCommands';
import { playQuestExpedition } from './questExpedition';

/**
 * Seeded raid balancing (monster raids spec, step 4). Two views: how each lair's raid fares against a few
 * typical garrisons at Westmere, and how often raids come and what they cost over full chapter tours.
 */

/** Garrisons a player might leave in a town, smallest first. */
export const GARRISONS: Record<string, string[]> = {
  none: [],
  militia: ['militia', 'militia'],
  'spears and bows': ['spearmen', 'spearmen', 'archers'],
  'strong': ['spearmen', 'spearmen', 'spearmen', 'archers', 'archers', 'knights'],
};

export interface GarrisonRow {
  lair: string;
  garrison: string;
  defence: number;
  /** Chance a routine raid from this lair alone is planned in a month, with this garrison. */
  chance: number;
  deterred: boolean;
  runs: number;
  /** Share of forced raids beaten off in battle (an empty town always falls), even where the garrison deters them. */
  held: number;
  garrisonLost: number;
  gold: number;
  people: number;
}

function westmereRaid(seed: number, lair: string, troops: string[]): GameState {
  const s = newGame(seed, 'western-realm');
  s.turn = RAID_GRACE_MONTH;
  s.towns.westmere.owner = 'player';
  const at = townLocation(s, 'westmere');
  s.armies = s.armies.filter((a) => a.at !== at);
  if (troops.length) s.armies.push({ id: s.nextId++, owner: 'player', at, from: null, troops: troops.map((t) => makeTroop(s, t)) });
  // Only this lair threatens the town, so the odds are its own.
  for (const id of Object.keys(s.lairs)) if (id !== lair) s.lairs[id] = { ...s.lairs[id], status: 'cleared', discovered: true, clearedTurn: 1 };
  return s;
}

/** Each western lair against each garrison: odds, and `runs` seeded raids forced to arrive and fight. */
export function garrisonReport(runs: number): GarrisonRow[] {
  const rows: GarrisonRow[] = [];
  for (const lair of ['briarwood', 'blackmire', 'stonejaw', 'eldersanctum']) {
    for (const [garrison, troops] of Object.entries(GARRISONS)) {
      const odds = raidOdds(westmereRaid(1, lair, troops), 'westmere');
      const row: GarrisonRow = { lair: LAIRS[lair].name, garrison, defence: odds.defense, chance: odds.chance, deterred: odds.deterred, runs, held: 0, garrisonLost: 0, gold: 0, people: 0 };
      for (let seed = 1; seed <= runs; seed++) {
        const s = westmereRaid(seed, lair, troops);
        s.turn += 1;
        strike(s, { lair, target: 'westmere' });
        if (s.battle) {
          autoResolve(s.battle);
          applyBattle(s, s.battle);
        }
        const entry = s.raidLog.at(-1)!;
        if (entry.result === 'beaten-off') row.held += 1;
        row.garrisonLost += entry.garrisonLost;
        row.gold += entry.gold;
        row.people += entry.people;
      }
      row.held /= runs;
      row.garrisonLost /= runs;
      row.gold /= runs;
      row.people /= runs;
      rows.push(row);
    }
  }
  return rows;
}

export interface TourRaids {
  seed: number;
  ending: GameState['endingReason'];
  months: number;
  raids: number;
  results: Partial<Record<RaidResult, number>>;
  battles: number;
  gold: number;
  people: number;
  damaged: number;
}

/**
 * Raids over full seeded campaign tours (the quest expedition controller, finishing the chapter). It never
 * garrisons against raids, so this is the pressure on a player who ignores them.
 */
export function tourReport(seeds: number[]): TourRaids[] {
  return seeds.map((seed) => {
    const tour = playQuestExpedition(seed, { finishChapter: true });
    const results: Partial<Record<RaidResult, number>> = {};
    for (const r of tour.raids) results[r.result] = (results[r.result] ?? 0) + 1;
    return {
      seed, ending: tour.ending, months: tour.months, raids: tour.raids.length, results,
      battles: tour.raids.filter((r) => r.battle).length,
      gold: tour.raids.reduce((n, r) => n + r.gold, 0),
      people: tour.raids.reduce((n, r) => n + r.people, 0),
      damaged: tour.raids.filter((r) => r.damaged).length,
    };
  });
}

/** The western towns some lair can reach: where raids happen once you expand. */
export const FRONTIER = ['fenwick', 'harrowgate', 'westmere', 'duskwater', 'reedhaven', 'thornwatch', 'redford', 'ironbridge'];

export interface FrontierRow {
  garrison: string;
  seeds: number;
  /** Raids that came due, per town per year. */
  raidsPerTownYear: number;
  results: Partial<Record<RaidResult, number>>;
  gold: number;
  people: number;
  damaged: number;
  garrisonLost: number;
}

/**
 * Hold every frontier town with the same garrison (never reinforced) for `months`, with the orcs out of the
 * way, and count what the raids do. Battles are auto-resolved, and every month goes through save validation.
 */
export function frontierReport(seeds: number[], months = 24): FrontierRow[] {
  return Object.entries(GARRISONS).map(([garrison, troops]) => {
    const row: FrontierRow = { garrison, seeds: seeds.length, raidsPerTownYear: 0, results: {}, gold: 0, people: 0, damaged: 0, garrisonLost: 0 };
    for (const seed of seeds) {
      let s = newGame(seed, 'western-realm');
      s.gold = 20000;
      s.armies = s.armies.filter((a) => a.owner !== 'orcs');
      for (const town of FRONTIER) {
        const at = townLocation(s, town);
        s.towns[town].owner = 'player';
        s.towns[town].tax = 15;
        s.armies = s.armies.filter((a) => a.at !== at);
        if (troops.length) s.armies.push({ id: s.nextId++, owner: 'player', at, from: null, troops: troops.map((t) => makeTroop(s, t)) });
      }
      for (let m = 0; m < months && s.status === 'playing'; m++) {
        advanceMonth(s);
        s = resumeBattles(s).state;
      }
      for (const r of s.raidLog) {
        row.results[r.result] = (row.results[r.result] ?? 0) + 1;
        row.gold += r.gold;
        row.people += r.people;
        row.damaged += r.damaged ? 1 : 0;
        row.garrisonLost += r.garrisonLost;
      }
      row.raidsPerTownYear += s.raidLog.length;
    }
    const per = seeds.length;
    row.raidsPerTownYear /= per * FRONTIER.length * (months / 12);
    row.gold /= per;
    row.people /= per;
    row.damaged /= per;
    row.garrisonLost /= per;
    return row;
  });
}
