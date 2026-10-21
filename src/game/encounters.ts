import { ENCOUNTERS } from '../content/encounters';
import { QUESTS } from '../content/quests';
import { armyAt, deed, makeTroop, nodeName, startLocation } from './campaign';
import { createBattle } from './battle';
import { landAt, townAt } from './world';
import { random } from './rng';
import { isHero } from './units';
import type { Army, Battle, GameState } from './types';

export interface EncounterQuote {
  armyId: number | null;
  participantIds: number[];
  waitingIds: number[];
  reason: string | null;
}
export function encounterQuote(state: GameState, id: string): EncounterQuote {
  const refuse = (reason: string): EncounterQuote => ({ armyId: null, participantIds: [], waitingIds: [], reason });
  const def = Object.hasOwn(ENCOUNTERS, id) ? ENCOUNTERS[id] : undefined;
  if (!def || !def.campaignIds.includes(state.campaignId)) return refuse('No such encounter in this campaign.');
  if (state.status !== 'playing' || state.battle || state.pending.length) return refuse('Resolve the current battles first.');
  if (Object.hasOwn(state.encounters, id)) return refuse('This expedition has already been attempted.');
  const quest = state.quests[def.quest];
  if (!quest || !['available', 'active'].includes(quest.status) || !QUESTS[def.quest].stages.find((s) => s.id === quest.stage)?.choices.some((c) => c.encounter === id)) return refuse('This expedition is not open yet.');
  const at = startLocation(state, def.at);
  // Optional sites never displace, annex or bypass an existing strategic garrison.
  if (townAt(state, at)) return refuse('Expeditions require an unoccupied landmark, not a town.');
  if (state.armies.some((a) => a.at === at && a.owner !== 'player')) return refuse('Defeat the force already at this site before entering.');
  const army = armyAt(state, at, 'player');
  if (!army) return refuse(`Bring an army to ${nodeName(state, at)} first.`);
  const participants = army.troops.filter((t) => t.men > 0 && (def.mode === 'army' || isHero(t.type)));
  if (!participants.length) return refuse('Bring at least one hero to this site.');
  if (participants.some((t) => t.refit)) return refuse('Finish the participants’ refits before an expedition.');
  return { armyId: army.id, participantIds: participants.map((t) => t.id), waitingIds: army.troops.filter((t) => !participants.includes(t)).map((t) => t.id), reason: null };
}

/** Called only after the choice quote passed; history/stage transition and battle launch form one command. */
export function launchEncounter(state: GameState, id: string, quote: EncounterQuote) {
  const def = ENCOUNTERS[id], source = state.armies.find((a) => a.id === quote.armyId)!;
  const troops = source.troops.filter((t) => quote.participantIds.includes(t.id));
  // Make a real separate army so battle/save rules cannot touch troops waiting outside a hero-only site.
  source.troops = source.troops.filter((t) => !quote.participantIds.includes(t.id));
  if (!source.troops.length) state.armies = state.armies.filter((a) => a !== source);
  for (const t of troops) t.mp = 0;
  const expedition: Army = { id: state.nextId++, owner: 'player', at: source.at, from: null, troops };
  const enemy: Army = { id: state.nextId++, owner: 'orcs', at: source.at, from: null,
    troops: def.enemies.map((t) => typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name)) };
  state.armies.push(expedition, enemy);
  const seed = Math.floor(random(state) * 2 ** 31);
  const battle = createBattle(source.at, expedition, enemy, false, seed, landAt(state, source.at));
  battle.encounterId = id;
  battle.log.push(`${def.name}. ${def.mode === 'heroes' ? `${quote.waitingIds.length} formations wait outside; they cannot take losses or earn combat XP.` : 'The whole expedition fights.'}`);
  state.encounters[id] = { status: 'active', startedTurn: state.turn, resolvedTurn: null, seed,
    sourceArmyId: source.id, armyId: expedition.id, enemyArmyId: enemy.id, participantIds: [...quote.participantIds], waitingIds: [...quote.waitingIds] };
  state.battle = battle;
  deed(state, 'story', `Entered ${def.name}. ${def.warning}`, source.at);
}

/** Snapshot the outcome before quest objectives award anything. Site enemies never join the roaming AI. */
export function recordEncounterOutcome(state: GameState, battle: Battle) {
  const id = battle.encounterId!, progress = state.encounters[id];
  progress.status = battle.outcome === 'attacker' ? 'won' : battle.retreated === 'attacker' ? 'withdrawn' : 'lost';
  progress.resolvedTurn = state.turn;
  state.armies = state.armies.filter((a) => a.id !== progress.enemyArmyId);
  deed(state, 'story', `${ENCOUNTERS[id].name}: ${progress.status === 'won' ? 'expedition victorious' : progress.status === 'withdrawn' ? 'expedition withdrew; the attempt is over' : 'expedition defeated; the attempt is over'}.`, battle.at);
}
