import { QUESTS } from '../../content/quests';
import { autoResolve, createBattle } from '../battle';
import { makeTroop, newGame, startLocation } from '../campaign';
import type { Army, GameState, QuestEncounter, StartTroop } from '../types';
import { isHero } from '../units';
import { landAt } from '../world';

/**
 * Encounter odds: each quest encounter fought many times, with automated tactics on both sides, against the
 * parties a player plausibly brings at that point in the chapter. This measures difficulty for tuning; it doesn't
 * replace a human playing the battles.
 */

/** A party to send in: fresh recruits and heroes, the way a chapter army looks. */
export interface PartyPreset {
  id: string;
  label: string;
  troops: StartTroop[];
}

/** The parties a player plausibly brings to each kind of encounter in Act I. */
export const PARTIES: Record<string, PartyPreset> = {
  // The starting home army, ruler included: the risky choice of marching your lord to a monster.
  home: { id: 'home', label: 'Lord with the starting army', troops: [{ type: 'lord', name: 'Aldric' }, 'militia', 'militia', 'spearmen', 'archers'] },
  // Codex's expedition: a hired priest with three units, the lord left at home.
  expedition: { id: 'expedition', label: 'Priest with militia, spearmen and archers', troops: [{ type: 'priest', name: 'Osric' }, 'militia', 'spearmen', 'archers'] },
  // A small band without a hero.
  band: { id: 'band', label: 'Militia, spearmen and archers', troops: ['militia', 'spearmen', 'archers'] },
  champion: { id: 'champion', label: 'A champion alone', troops: [{ type: 'champion', name: 'Brannoc' }] },
  priest: { id: 'priest', label: 'A priest alone', troops: [{ type: 'priest', name: 'Osric' }] },
  mage: { id: 'mage', label: 'A mage alone', troops: [{ type: 'mage', name: 'Ysolde' }] },
  pair: { id: 'pair', label: 'A champion and a priest', troops: [{ type: 'champion', name: 'Brannoc' }, { type: 'priest', name: 'Osric' }] },
};

/** Which parties to try against each encounter: heroes-only trials get hero parties. */
export function partiesFor(enc: QuestEncounter): PartyPreset[] {
  return enc.heroesOnly
    ? [PARTIES.champion, PARTIES.priest, PARTIES.mage, PARTIES.pair]
    : [PARTIES.home, PARTIES.expedition, PARTIES.band];
}

export interface OddsRow {
  quest: string;
  choice: string;
  site: string;
  party: string;
  runs: number;
  /** Share of fights the party won. */
  winRate: number;
  /** Share of fights in which at least one of the party's heroes died (the lord's death ends the game). */
  heroDeathRate: number;
  /** Average share of the party's starting men (heroes' HP included) lost per fight. */
  losses: number;
  /** Average rounds a fight lasted. */
  rounds: number;
}

function build(state: GameState, id: number, owner: Army['owner'], at: string, troops: StartTroop[]): Army {
  return { id, owner, at, from: null, troops: troops.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) };
}

/** Fight one encounter `runs` times against one party, seeds 1..runs. */
export function encounterOdds(questId: string, choiceId: string, party: PartyPreset, runs: number): OddsRow {
  const choice = QUESTS[questId].stages.flatMap((s) => s.choices).find((c) => c.id === choiceId)!;
  if (!('encounter' in choice.then)) throw new Error(`${questId}/${choiceId} is not an encounter`);
  const enc = choice.then.encounter;
  const state = newGame(1, QUESTS[questId].campaignIds[0]);
  const at = startLocation(state, enc.site);
  const land = landAt(state, at);
  let wins = 0, heroDeaths = 0, lost = 0, rounds = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const mine = build(state, 900001, 'player', at, party.troops);
    if (enc.heroesOnly) mine.troops = mine.troops.filter((t) => isHero(t.type));
    if (!mine.troops.length) throw new Error('Leaders only: this party has no eligible leader.');
    const foe = build(state, 900002, enc.owner, at, enc.troops);
    const start = mine.troops.reduce((n, t) => n + t.men, 0);
    const b = createBattle(at, mine, foe, false, seed, land);
    autoResolve(b);
    if (b.outcome === 'attacker') wins++;
    const left = b.units.filter((u) => u.side === 'attacker').reduce((n, u) => n + Math.max(0, u.men), 0);
    lost += (start - left) / start;
    if (b.units.some((u) => u.side === 'attacker' && isHero(u.type) && u.men <= 0)) heroDeaths++;
    rounds += b.round;
  }
  return {
    quest: questId, choice: choiceId, site: enc.site, party: party.id, runs,
    winRate: wins / runs, heroDeathRate: heroDeaths / runs, losses: lost / runs, rounds: rounds / runs,
  };
}

/** Every encounter in the catalog against its plausible parties. */
export function encounterReport(runs = 200): OddsRow[] {
  const rows: OddsRow[] = [];
  for (const def of Object.values(QUESTS)) {
    for (const choice of def.stages.flatMap((s) => s.choices)) {
      if (!('encounter' in choice.then)) continue;
      for (const party of partiesFor(choice.then.encounter)) rows.push(encounterOdds(def.id, choice.id, party, runs));
    }
  }
  return rows;
}
