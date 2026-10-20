import { BATTLE_H, BATTLE_W, createBattle, FIELD_LIMIT } from './battle';
import { CATALOG, getCampaign } from '../content';
import { ITEMS } from '../content/items';
import { QUESTS } from '../content/quests';
import { newQuestState } from './quests';
import { endingReason } from './campaign';
import { TERRAIN, UNIT_TYPES } from './data';
import { heroMaxHp, heroMaxMana, isHero } from './units';
import type { CampaignId, DeedKind, GameState, JournalEntry } from './types';

/** Storage slot names are stable; the schema version lives inside the save itself. */
export const SAVE_KEY = 'aragon-save-v3';
export const LEGACY_SAVE_KEY = 'aragon-save-v2';
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid save: ${message}.`);
}
function object(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  requireValue(Array.isArray(value), 'expected a list');
  return value;
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}
function text(value: unknown): value is string { return typeof value === 'string'; }
function bool(value: unknown): value is boolean { return typeof value === 'boolean'; }
function oneOf(value: unknown, values: readonly unknown[]): boolean { return values.includes(value); }
const factions = ['player', 'orcs', 'neutral'];
const deedKinds: DeedKind[] = ['story', 'battle', 'capture', 'loss', 'hero', 'realm', 'ending', 'earlier'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sides = ['attacker', 'defender'];

/** Validate both shape and references before exposing a save to rules or rendering. */
function validate(value: unknown, allowMissingBattleTroops = false): asserts value is GameState {
  const s = object(value);
  requireValue(s.version === 5, 'unsupported schema version');
  requireValue(text(s.campaignId) && Object.hasOwn(CATALOG.campaigns, s.campaignId), 'unknown campaign');
  const def = getCampaign(s.campaignId as CampaignId);
  requireValue(s.campaignRevision === def.revision, 'unsupported campaign revision');
  requireValue(integer(s.turn, 1) && integer(s.gold) && integer(s.nextId, 1) && integer(s.seed, -2147483648, 2147483647), 'campaign numbers');
  requireValue(oneOf(s.status, ['playing', 'won', 'lost']), 'campaign status');
  requireValue(oneOf(s.endingReason, [null, 'lair-captured', 'capital-lost', 'lord-dead']), 'ending reason');
  const nodes = new Set<string>();
  for (const entry of array(s.nodes)) {
    const n = object(entry);
    requireValue(text(n.id) && n.id.length > 0 && !nodes.has(n.id) && text(n.name) && Number.isFinite(n.x) && Number.isFinite(n.y), 'map node');
    nodes.add(n.id);
  }
  requireValue(nodes.size === def.nodes.length && def.nodes.every((n) => nodes.has(n.id)), 'campaign map locations');
  for (const edge of array(s.edges)) {
    const e = array(edge);
    requireValue(e.length === 2 && text(e[0]) && text(e[1]) && nodes.has(e[0]) && nodes.has(e[1]), 'road references');
  }
  const towns = object(s.towns);
  requireValue(Object.keys(towns).length === def.towns.length && def.towns.every((t) => Object.hasOwn(towns, t.id)), 'campaign towns');
  for (const [id, entry] of Object.entries(towns)) {
    const t = object(entry);
    requireValue(t.id === id && nodes.has(id) && oneOf(t.owner, factions) && integer(t.pop) && integer(t.tax, 0, 50) && oneOf(t.kind, ['capital', 'town', 'lair']), 'town');
  }
  const ids = new Set<number>();
  const useId = (id: unknown) => {
    requireValue(integer(id, 1) && !ids.has(id) && id < Number(s.nextId), 'duplicate or invalid campaign ID');
    ids.add(id);
  };
  for (const entry of array(s.armies)) {
    const a = object(entry);
    useId(a.id);
    requireValue(oneOf(a.owner, factions) && text(a.at) && nodes.has(a.at) && (a.from === null || (text(a.from) && nodes.has(a.from))), 'army location or owner');
    requireValue(array(a.troops).length > 0, 'empty army');
    for (const item of array(a.troops)) {
      const t = object(item);
      useId(t.id);
      requireValue(text(t.type) && Object.hasOwn(UNIT_TYPES, t.type) && integer(t.xp) && integer(t.men, 1) && bool(t.moved), 'troop');
      requireValue(t.name === undefined || text(t.name), 'troop name');
      requireValue(t.men <= (isHero(t.type) ? heroMaxHp(t.type, t.xp) : UNIT_TYPES[t.type].men), 'troop strength');
      requireValue(isHero(t.type) ? integer(t.mana, 0, heroMaxMana(t.type, t.xp)) : t.mana === undefined || t.mana === 0, 'troop mana');
    }
  }
  for (const entry of array(s.pending)) {
    const p = object(entry);
    // Pending armies may already have been removed by an earlier resolved battle.
    requireValue(integer(p.attackerId, 1) && integer(p.defenderId, 1) && p.attackerId !== p.defenderId, 'pending battle');
  }
  for (const entry of array(s.offers)) {
    const o = object(entry);
    requireValue(text(o.town) && Object.hasOwn(towns, o.town) && text(o.type) && Object.hasOwn(UNIT_TYPES, o.type) && isHero(o.type) && text(o.name) && integer(o.expires, 1), 'hero offer');
  }
  requireValue(array(s.log).every(text), 'chronicle');
  const quests = object(s.quests);
  requireValue(Object.keys(quests).length === Object.keys(QUESTS).length &&
    Object.keys(QUESTS).every((id) => Object.hasOwn(quests, id)), 'quest registry');
  for (const entry of Object.values(quests)) {
    const q = object(entry);
    requireValue(oneOf(q.status, ['available', 'succeeded', 'failed', 'superseded']), 'quest status');
    requireValue(oneOf(q.stage, ['decision', 'resolved']), 'quest stage');
    requireValue(oneOf(q.choice, [null, 'sign', 'decline']), 'quest choice');
    requireValue(q.resolvedTurn === null || integer(q.resolvedTurn, 1, Number(s.turn)), 'quest resolution month');
    requireValue(q.status === 'available'
      ? q.stage === 'decision' && q.choice === null && q.resolvedTurn === null
      : q.stage === 'resolved' && q.resolvedTurn !== null, 'quest progress');
    requireValue(q.status === 'succeeded' ? q.choice === 'sign' : q.status === 'failed'
      ? q.choice === 'decline' : q.choice === null, 'quest outcome');
  }
  const inventory = array(s.items);
  requireValue(inventory.every((id) => text(id) && Object.hasOwn(ITEMS, id)) &&
    new Set(inventory).size === inventory.length, 'inventory objects');
  const treaties = object(s.treaties);
  for (const [id, entry] of Object.entries(treaties)) {
    const t = object(entry);
    requireValue(Object.hasOwn(towns, id) && oneOf(t.relation, ['hostile', 'neutral', 'truce', 'ally', 'vassal']) &&
      bool(t.passage) && integer(t.signedTurn, 1, Number(s.turn)), 'treaty');
    requireValue(!t.passage || t.relation === 'ally' || t.relation === 'vassal', 'treaty passage');
  }
  if (object(quests.Q00).status === 'succeeded') {
    requireValue(inventory.includes('fenwick-charter'), 'missing charter reward');
  }
  if (Object.hasOwn(treaties, 'fenwick') && object(treaties.fenwick).passage) {
    requireValue(object(quests.Q00).status === 'succeeded', 'treaty has no signed quest');
  }
  array(s.journal).forEach((entry, i) => {
    const j = object(entry);
    requireValue(j.id === i + 1 && integer(j.turn, 1, Number(s.turn)) && oneOf(j.kind, deedKinds) && text(j.text), 'journal entry');
    requireValue(j.place === null || (text(j.place) && nodes.has(j.place)), 'journal place');
  });
  if (s.battle !== null) {
    const b = object(s.battle);
    requireValue(text(b.at) && nodes.has(b.at) && b.width === BATTLE_W && b.height === BATTLE_H, 'battle map');
    requireValue(integer(b.round, 1, 21) && integer(b.seed, -2147483648, 2147483647) && bool(b.walls), 'battle numbers');
    requireValue(oneOf(b.active, sides) && oneOf(b.outcome, [null, ...sides]) && oneOf(b.retreated, [null, ...sides]), 'battle status');
    const owners = object(b.owners);
    requireValue(oneOf(owners.attacker, factions) && oneOf(owners.defender, factions), 'battle owners');
    const terrain = array(b.terrain);
    requireValue(terrain.length === BATTLE_W && terrain.every((col) => array(col).length === BATTLE_H && array(col).every((k) => text(k) && Object.hasOwn(TERRAIN, k))), 'battle terrain');
    requireValue(array(b.log).every(text), 'battle log');
    const state = value as GameState;
    const a = state.armies.find((a) => a.id === b.attackerId);
    const d = state.armies.find((a) => a.id === b.defenderId);
    requireValue(a && d && a !== d && a.at === b.at && d.at === b.at && a.owner === owners.attacker && d.owner === owners.defender, 'battle army references');
    const unitIds = new Set<number>(), troopIds = new Set<number>(), cells = new Set<string>();
    const deployed = { attacker: 0, defender: 0 };
    for (const item of array(b.units)) {
      const u = object(item);
      requireValue(integer(u.id, 1) && !unitIds.has(u.id) && integer(u.troopId, 1) && !troopIds.has(u.troopId), 'duplicate battle formation');
      unitIds.add(u.id); troopIds.add(u.troopId);
      requireValue(oneOf(u.side, sides), 'battle side');
      const army = u.side === 'attacker' ? a : d;
      const troop = army.troops.find((t) => t.id === u.troopId);
      requireValue(troop && u.armyId === army.id && u.type === troop.type && u.xp === troop.xp && u.startMen === troop.men, 'battle troop references');
      requireValue(integer(u.maxMen, 1) && u.maxMen === (isHero(troop.type) ? heroMaxHp(troop.type, troop.xp) : troop.men) && integer(u.men, 0, u.maxMen), 'battle strength');
      requireValue(integer(u.mana, 0, heroMaxMana(troop.type, troop.xp)) && integer(u.morale, 0, 100) && integer(u.deeds), 'battle resources');
      requireValue([u.reserve, u.routing, u.fled, u.moved, u.acted].every(bool) && (u.name === undefined || text(u.name)), 'battle flags');
      if (u.reserve) {
        requireValue(u.col === -1 && u.row === -1 && u.men === u.startMen && u.deeds === 0 && !u.fled && !u.routing, 'reserve state');
      } else {
        requireValue(integer(u.col, 0, BATTLE_W - 1) && integer(u.row, 0, BATTLE_H - 1), 'battle position');
        deployed[u.side as 'attacker' | 'defender']++;
        if (Number(u.men) > 0 && !u.fled) {
          const key = `${u.col},${u.row}`;
          requireValue(!cells.has(key), 'overlapping formations');
          cells.add(key);
        }
      }
    }
    requireValue(deployed.attacker <= FIELD_LIMIT && deployed.defender <= FIELD_LIMIT, 'field capacity');
    if (!allowMissingBattleTroops) requireValue([...a.troops, ...d.troops].every((t) => troopIds.has(t.id)), 'missing battle formations');
  }
  const state = value as GameState;
  const reason = endingReason(state);
  requireValue(state.status === 'playing' ? state.endingReason === null && reason === null : state.endingReason === reason && (state.status === 'won' ? reason === 'lair-captured' : reason === 'lord-dead' || reason === 'capital-lost'), 'inconsistent campaign ending');
}

/** Turn a chronicle line ("March, year 2: text") back into a month number and its text. */
function parseChronicleLine(line: string): { turn: number; text: string } {
  const m = /^([A-Z][a-z]+), year (\d+): (.*)$/s.exec(line);
  const month = m ? MONTHS.indexOf(m[1]) : -1;
  if (!m || month < 0) return { turn: 1, text: line };
  return { turn: (Number(m[2]) - 1) * 12 + month + 1, text: m[3] };
}

/**
 * v3 → v4 adds the permanent journal. Older games only kept the rolling chronicle, so its surviving lines
 * become 'earlier' entries, oldest first. Nothing else changes.
 */
function upgradeToV4(value: Record<string, unknown>) {
  const turn = integer(value.turn, 1) ? value.turn : 1;
  const lines = array(value.log).filter(text).slice().reverse();
  value.journal = lines.map((line, i): JournalEntry => {
    const parsed = parseChronicleLine(line);
    return { id: i + 1, turn: Math.min(Math.max(1, parsed.turn), turn), kind: 'earlier', text: parsed.text, place: null };
  });
  value.version = 4;
}

/** Preserve old saves without inventing a completed quest or giving retroactive rewards. */
function upgradeToV5(value: Record<string, unknown>) {
  const towns = object(value.towns);
  const fenwick = object(towns.fenwick);
  const quest = newQuestState();
  if (fenwick.owner !== 'neutral') {
    quest.Q00 = { status: 'superseded', stage: 'resolved', choice: null,
      resolvedTurn: integer(value.turn, 1) ? value.turn : 1 };
  }
  value.quests = quest;
  value.items = [];
  value.treaties = {};
  value.version = 5;
}

/** Migration runs on parsed JSON only; it never edits the legacy storage entry. */
export function parseSave(raw: string): GameState {
  requireValue(new TextEncoder().encode(raw).length <= MAX_SAVE_BYTES, 'file exceeds 5 MB');
  const value = object(JSON.parse(raw));
  if (value.version === 3) upgradeToV4(value);
  if (value.version === 2) {
    value.version = 3;
    value.campaignId = 'valley-quickplay';
    value.campaignRevision = 1;
    value.endingReason = null;
    if (value.battle !== null) for (const u of array(object(value.battle).units)) object(u).reserve = false;
    // Infer legacy terminal reasons only after validating the shape needed by the resolver.
    const towns = object(value.towns);
    const legacyWorld = getCampaign('valley-quickplay');
    object(towns[legacyWorld.capital]); object(towns[legacyWorld.lair]);
    for (const a of array(value.armies)) for (const t of array(object(a).troops)) object(t);
    if (value.status !== 'playing') {
      value.endingReason = endingReason(value as unknown as GameState);
      value.status = value.endingReason === 'lair-captured' ? 'won' : 'lost';
    }
    upgradeToV4(value);
    upgradeToV5(value);
    validate(value, true);
    if (value.battle) {
      const b = value.battle;
      const a = value.armies.find((a) => a.id === b.attackerId)!;
      const d = value.armies.find((a) => a.id === b.defenderId)!;
      const complete = createBattle(b.at, a, d, b.walls, b.seed);
      let nextId = Math.max(0, ...b.units.map((u) => u.id)) + 1;
      for (const unit of complete.units) {
        if (b.units.some((u) => u.troopId === unit.troopId)) continue;
        b.units.push({ ...unit, id: nextId++, reserve: true, col: -1, row: -1 });
      }
    }
  }
  if (value.version === 4) upgradeToV5(value);
  validate(value);
  return value;
}

export function loadGame(storage: SaveStorage): { state: GameState | null; warning: string; blocked: boolean } {
  try {
    const current = storage.getItem(SAVE_KEY);
    const raw = current ?? storage.getItem(LEGACY_SAVE_KEY);
    return { state: raw === null ? null : parseSave(raw), warning: '', blocked: false };
  } catch {
    return { state: null, warning: 'Your saved game could not be loaded. The original save has been kept. Autosave is paused: import a valid save or choose New game to replace it.', blocked: true };
  }
}

export function saveGame(storage: SaveStorage, state: GameState): string | null {
  try {
    validate(state);
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return 'Autosave failed. Your game is still running; export it now to keep your progress.';
  }
}
