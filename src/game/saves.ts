import { cityTreasuryMoney } from './cityBattle';
import {formationCapacity} from './formationCapacity';
import { LAIRS as LAIRS_BY_ID, lairsOf, SPECIES } from '../content/lairs';
import { FACTIONS } from '../content/factions';
import { WESTERN_ADDED_ARMIES, WESTERN_ADDED_TOWNS } from '../content/campaigns/westernExpansion';
import { WESTERN_REVISION_1_TOWNS } from '../content/campaigns/westernRevision1';
import { EFFECTS } from '../content/spells';
import { BATTLE_SIZES, createBattle, FIELD_LIMIT, maxRounds, ZONE_ROWS } from './battle';
import { CATALOG, getCampaign } from '../content';
import { ITEMS } from '../content/items';
import { MERCHANTS } from '../content/merchants';
import { QUESTS } from '../content/quests';
import { DEADLINE, encounterMark, enteredStages, isOpen, isResolved, LOCATION_LOST, lockedProgress, resolutionOf, stageOf } from './quests';
import { newTreasury } from './economy';
import { BUILDING_IDS, BUILDINGS, GOODS, startingCities, initialCityEconomy } from './cities';
import { basicLoadout, EQUIPMENT, equipmentQuoteGold, usesBow } from './equipment';
import { endingReason, makeTroop, startLocation } from './campaign';
import { TERRAIN, UNIT_TYPES } from './data';
import { heroMaxHp, heroMaxMana, isHero, heroCanUse } from './units';
import { isLocation, townLocation } from './world';
import type { CampaignId, DeedKind, GameState, JournalEntry, LedgerCategory, Town, EquipmentId } from './types';

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
const factions = Object.keys(FACTIONS);
const deedKinds: DeedKind[] = ['story', 'battle', 'capture', 'loss', 'hero', 'realm', 'ending', 'earlier'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sides = ['attacker', 'defender'];
const ledgerCategories: LedgerCategory[] = ['tax', 'wages', 'recruitment', 'hero-hire', 'construction', 'maintenance', 'refit', 'quest', 'quest-reward', 'item-sale', 'item-purchase', 'lair-plunder', 'raid-loss', 'battle-spoils', 'balance-correction'];

/** Validate both shape and references before exposing a save to rules or rendering. */
function validate(value: unknown, allowMissingBattleTroops = false): asserts value is GameState {
  const s = object(value);
  requireValue(s.version === 18, 'unsupported schema version');
  if (s.intel !== undefined) for (const [town, entry] of Object.entries(object(s.intel))) {
    const e = object(entry);
    requireValue(Object.hasOwn(object(s.towns), town) && integer(e.turn, 1, Number(s.turn)) && array(e.lines).every(text), 'intelligence report');
  }
  if(s.questPacing !== undefined) requireValue(object(s.questPacing).highlights===2, 'quest pacing');
  const weather = object(s.weather);
  requireValue(oneOf(weather.kind, ['clear', 'rain', 'storm', 'snow', 'blizzard']) && integer(weather.turn, 1, Number(s.turn)) && integer(weather.seed, -2147483648, 2147483647), 'weather');
  if(s.rulerAppearance!==undefined){const look=object(s.rulerAppearance);requireValue(oneOf(look.gender,['male','female']) && oneOf(look.skin,['fair','olive','brown','deep']) && (look.rulerClass===undefined || oneOf(look.rulerClass,['knight','priest','mage'])),'ruler appearance');}
  requireValue(text(s.campaignId) && Object.hasOwn(CATALOG.campaigns, s.campaignId), 'unknown campaign');
  const def = getCampaign(s.campaignId as CampaignId);
  if(s.challenge!==undefined){const c=object(s.challenge);requireValue(oneOf(c.difficulty,['easy','normal','hard']) && typeof c.fog==='boolean' && Array.isArray(c.explored) && c.explored.length<=10000 && c.explored.every(at=>typeof at==='string' && isLocation(value as GameState,at)) && new Set(c.explored).size===c.explored.length,'campaign difficulty and exploration');}
  requireValue(s.campaignRevision === def.revision, 'unsupported campaign revision');
  requireValue(integer(s.turn, 1) && integer(s.gold) && integer(s.nextId, 1) && integer(s.seed, -2147483648, 2147483647), 'campaign numbers');
  requireValue(oneOf(s.status, ['playing', 'won', 'lost']), 'campaign status');
  requireValue(oneOf(s.endingReason, [null, 'lair-captured', 'chapter-complete', 'capital-lost', 'lord-dead']), 'ending reason');
  const nodes = new Set<string>();
  for (const entry of array(s.nodes)) {
    const n = object(entry);
    requireValue(text(n.id) && n.id.length > 0 && !nodes.has(n.id) && text(n.name) && Number.isFinite(n.x) && Number.isFinite(n.y), 'map node');
    nodes.add(n.id);
  }
  requireValue(nodes.size === def.nodes.length && def.nodes.every((n) => nodes.has(n.id)), 'campaign map locations');
  /** A location: a node id on the valley, an in-bounds hex key on a hex map. */
  const loc = (at: unknown): at is string => text(at) && (def.hex ? isLocation(value as GameState, at) : nodes.has(at));
  // Sieges: one per town, by one of your armies, with walls, supplies and morale in range.
  const besieged = new Set<string>();
  for (const raw of array(s.sieges)) {
    const g = object(raw);
    requireValue(text(g.town) && Object.hasOwn(object(s.towns), g.town) && !besieged.has(g.town) && integer(g.army, 1) && loc(g.camp) &&
      array(s.armies).some((x) => object(x).id === g.army && object(x).owner === 'player') &&
      integer(g.startedTurn, 1, Number(s.turn)) && integer(g.walls, 0, 100) && integer(g.morale, 0, 100) && bool(g.offer) &&
      typeof g.supplies === 'number' && Number.isFinite(g.supplies) && g.supplies >= 0 && g.supplies <= 8, 'siege');
    besieged.add(g.town as string);
  }
  let lastSiege = 1;
  for (const raw of array(s.siegeLog)) {
    const r = object(raw);
    requireValue(text(r.town) && Object.hasOwn(object(s.towns), r.town) && integer(r.turn, lastSiege, Number(s.turn)) &&
      oneOf(r.result, ['vassal', 'lifted', 'stormed', 'broken']), 'siege record');
    lastSiege = Number(r.turn);
  }
  /** Ledger cities are towns on a hex map; on the valley any named node can carry army wages. */
  const ledgerCity = (city: unknown) => text(city) && (def.hex ? def.towns.some((t) => t.id === city) : nodes.has(city));
  const maxMp = (type: string) => (def.hex ? UNIT_TYPES[type].march : 1);
  for (const edge of array(s.edges)) {
    const e = array(edge);
    requireValue(e.length === 2 && text(e[0]) && text(e[1]) && nodes.has(e[0]) && nodes.has(e[1]), 'road references');
  }
  const towns = object(s.towns);
  requireValue(Object.keys(towns).length === def.towns.length && def.towns.every((t) => Object.hasOwn(towns, t.id)), 'campaign towns');
  for (const [id, entry] of Object.entries(towns)) {
    const t = object(entry);
    requireValue(t.id === id && def.towns.some((d) => d.id === id) && oneOf(t.owner, factions) && integer(t.pop) && integer(t.tax, 0, 50) && oneOf(t.kind, ['capital', 'town', 'lair']), 'town');
    requireValue(t.unrest === undefined || integer(t.unrest, 0, 100), 'town unrest');
  }
  if(s.cityPolitics!==undefined){
    const p=object(s.cityPolitics);requireValue(integer(p.lastTurn,0,Number(s.turn)),'city politics turn');
    for(const [origin,raw] of Object.entries(object(p.rivals))){const r=object(raw);requireValue(Object.hasOwn(towns,origin)&&integer(r.nextRaidTurn,1),'rival city');if(r.warning!==undefined){const w=object(r.warning);requireValue(text(w.target)&&Object.hasOwn(towns,w.target)&&integer(w.launchTurn,1),'city muster warning');}}
  }
  const ids = new Set<number>();
  const useId = (id: unknown) => {
    requireValue(integer(id, 1) && !ids.has(id) && id < Number(s.nextId), 'duplicate or invalid campaign ID');
    ids.add(id);
  };
  for (const entry of array(s.armies)) {
    const a = object(entry);
    useId(a.id);
    requireValue(oneOf(a.owner, factions) && loc(a.at) && (a.from === null || loc(a.from)), 'army location or owner');
    if(a.cityRaid!==undefined){const r=object(a.cityRaid);requireValue(a.owner==='neutral' && text(r.origin) && Object.hasOwn(towns,r.origin) && text(r.target) && Object.hasOwn(towns,r.target) && integer(r.launched,1,Number(s.turn)) && (r.returning===undefined||bool(r.returning)),'city war party');}
    requireValue(a.target === undefined || (a.owner === 'orcs' && text(a.target) && Object.hasOwn(towns, a.target)), 'army target');
    if (a.tactics !== undefined) {
      const tactics = object(a.tactics);
      requireValue(oneOf(tactics.stance, ['offensive', 'defensive', 'skirmish', 'custom']), 'army stance');
      if (tactics.layout !== undefined) {
        const cells = new Set<string>();
        for (const [troopId, raw] of Object.entries(object(tactics.layout))) {
          const c = object(raw);
          requireValue(/^[1-9][0-9]*$/.test(troopId) && integer(c.depth, 0, 2) && integer(c.row, 0, ZONE_ROWS - 1) && !cells.has(`${c.depth},${c.row}`), 'custom layout');
          cells.add(`${c.depth},${c.row}`);
        }
      }
    }
    requireValue(array(a.troops).length > 0, 'empty army');
    for (const item of array(a.troops)) {
      const t = object(item);
      useId(t.id);
      requireValue(text(t.type) && Object.hasOwn(UNIT_TYPES, t.type) && integer(t.xp) && integer(t.men, 1) && integer(t.mp, 0, maxMp(t.type)), 'troop');
      requireValue(t.campaignMorale === undefined || integer(t.campaignMorale, 0, 100), 'campaign morale');
      requireValue(t.moraleMarchTurn === undefined || integer(t.moraleMarchTurn, 1, Number(s.turn)), 'morale march month');
      requireValue(t.name === undefined || text(t.name), 'troop name');
      requireValue(t.infiltrating === undefined || (t.type === 'spy' && a.owner === 'player' && text(t.infiltrating) && Object.hasOwn(object(s.towns), t.infiltrating)), 'infiltrating spy');
      requireValue(t.scoutPost === undefined || (t.type === 'scout' && oneOf(t.scoutPost, ['watch', 'city', 'road']) &&
        (a.owner === 'player' || (a.troops as unknown[]).every((x) => object(x).type === 'scout'))), 'scout post');
      requireValue(t.men <= (isHero(t.type) ? heroMaxHp(t.type, t.xp) : formationCapacity(t as unknown as GameState['armies'][number]['troops'][number])), 'troop strength');
      requireValue(isHero(t.type) ? integer(t.mana, 0, heroMaxMana(t.type, t.xp)) : t.mana === undefined || t.mana === 0, 'troop mana');
      const gear = object(t.gear);
      requireValue(Object.keys(gear).length === 2 && oneOf(gear.armor, ['leather', 'chain', 'plate']) &&
        oneOf(gear.bow, [null, 'short-bow', 'long-bow', 'compound-bow']), 'equipment loadout');
      requireValue(usesBow(t.type as string) ? gear.armor !== 'plate' && gear.bow !== null : gear.bow === null, 'equipment compatibility');
      if (t.kit !== undefined) {
        // Hero equipment: your heroes only, each item in its own slot and allowed for that hero.
        const kit = object(t.kit);
        requireValue(isHero(t.type as string) && a.owner === 'player' && Object.keys(kit).length > 0 &&
          Object.entries(kit).every(([slot, id]) => oneOf(slot, ['weapon', 'armor', 'accessory']) && text(id) &&
            ITEMS[id]?.equip?.slot === slot && heroCanUse(t.type as string,ITEMS[id].equip!.heroes)), 'hero equipment');
      }
      if (t.refit !== null) {
        const refit = object(t.refit);
        requireValue(text(refit.item) && Object.hasOwn(EQUIPMENT, refit.item), 'refit item');
        const defn = EQUIPMENT[refit.item as EquipmentId];
        requireValue(!isHero(t.type) && t.mp === 0 && refit.startedTurn === s.turn &&
          integer(refit.orderedMen, Number(t.men), formationCapacity(t as unknown as GameState['armies'][number]['troops'][number])) &&
          refit.paidGold === equipmentQuoteGold(defn.id, refit.orderedMen as number) &&
          (defn.slot === 'bow' ? usesBow(t.type as string) : !(usesBow(t.type as string) && defn.id === 'plate')),
          'refit order');
        const paid = object(refit.paidGoods);
        const quote = defn.goodsPerFormation(refit.orderedMen as number);
        requireValue(Object.keys(paid).length === Object.keys(quote).length &&
          Object.entries(quote).every(([good, amount]) => paid[good] === amount), 'refit materials');
      }

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
  requireValue(s.scoutReports === undefined || (array(s.scoutReports).every(text) && new Set(s.scoutReports as string[]).size === (s.scoutReports as string[]).length), 'scout reports');
  if (s.scoutContacts !== undefined) {
    const pairs = new Set<string>();
    for (const raw of array(s.scoutContacts)) {
      const c = object(raw), key = String(c.armyId) + ':' + String(c.scoutId);
      requireValue(integer(c.armyId, 1, Number(s.nextId)-1) && integer(c.scoutId, 1, Number(s.nextId)-1) && !pairs.has(key) &&
        loc(c.post) && loc(c.destination) && integer(c.seenTurn, 1, Number(s.turn)) && typeof c.active === 'boolean' &&
        (c.arrivalTurn === null || integer(c.arrivalTurn, Number(c.seenTurn), Number.MAX_SAFE_INTEGER)), 'scout contact');
      pairs.add(key);
    }
  }
  const treasury = object(s.treasury);
  requireValue(integer(treasury.opening), 'treasury opening balance');
  const checkEntries = (entries: unknown, month: number) => {
    const unique = new Set<string>();
    const list = array(entries);
    for (const element of list) {
      const e = object(element);
      requireValue(e.turn === month && (e.city === null || ledgerCity(e.city)) &&
        oneOf(e.category, ledgerCategories) && integer(e.amount, -Number.MAX_SAFE_INTEGER) &&
        text(e.counterparty) && text(e.actionId) && e.actionId.length > 0 &&
        !unique.has(e.actionId), 'treasury transaction');
      unique.add(e.actionId as string);
      requireValue(e.category === 'tax' || e.category === 'quest-reward' || e.category === 'item-sale' || e.category === 'lair-plunder' || e.category === 'battle-spoils' ? Number(e.amount) > 0 :
        e.category === 'balance-correction' ? Number(e.amount) !== 0 : Number(e.amount) < 0,
        'treasury transaction sign');
    }
    return list.map((e) => object(e));
  };
  checkEntries(treasury.pending, s.turn as number);
  let previous = 0;
  for (const element of array(treasury.history)) {
    const month = object(element);
    requireValue(integer(month.turn, 1, (s.turn as number) - 1) && Number(month.turn) > previous,
      'treasury month ordering');
    previous = month.turn as number;
    requireValue(integer(month.opening) && integer(month.closing) && integer(month.income) &&
      integer(month.expenses) && integer(month.unpaidUpkeep) && integer(month.unpaidMaintenance), 'treasury amounts');
    const transactions = checkEntries(month.entries, month.turn as number);
    requireValue(Number(month.opening) + transactions.reduce((sum, e) => sum + Number(e.amount), 0) === month.closing,
      'treasury does not reconcile');
    requireValue(transactions.filter((e) => e.category === 'tax').reduce((sum, e) => sum + Number(e.amount), 0) === month.income,
      'treasury income total');
    requireValue(-transactions.filter((e) => ['wages', 'recruitment', 'hero-hire', 'construction', 'maintenance', 'refit', 'quest', 'item-purchase', 'raid-loss'].includes(String(e.category)))
      .reduce((sum, e) => sum + Number(e.amount), 0) === month.expenses, 'treasury expense total');
  }
  const history = array(treasury.history);
  if (history.length) requireValue(object(history.at(-1)).closing === treasury.opening,
    'treasury opening does not match last close');
  const cities = object(s.cityEconomies);
  requireValue(Object.keys(cities).length === Object.keys(towns).length &&
    Object.keys(towns).every((id) => Object.hasOwn(cities, id)), 'city economy registry');
  for (const [id, value] of Object.entries(cities)) {
    const city = object(value);
    requireValue(city.lastTreasuryPillage === undefined || integer(city.lastTreasuryPillage, 1, Number(s.turn)), 'city treasury pillage');
    const buildings = object(city.buildings);
    const goods = object(city.goods);
    requireValue(Object.keys(buildings).length === BUILDING_IDS.length &&
      BUILDING_IDS.every((kind) => integer(buildings[kind])), 'city buildings');
    requireValue(Object.keys(goods).length === GOODS.length &&
      GOODS.every((good) => integer(goods[good], 0, 1000000)), 'city goods');
    if (object(towns[id]).kind === 'lair') requireValue(BUILDING_IDS.every((kind) => buildings[kind] === 0), 'lair industry');
    if (city.project !== null) {
      const p = object(city.project);
      requireValue(oneOf(p.kind, BUILDING_IDS) && integer(p.targetLevel, 1) &&
        p.targetLevel === Number(buildings[p.kind as string]) + 1 &&
        p.startedTurn === s.turn && p.finishTurn === s.turn, 'city project');
      const defn = BUILDINGS[p.kind as keyof typeof BUILDINGS];
      const multiplier = p.targetLevel === 1 ? 1 : 1.7;
      requireValue(p.paidGold === Math.ceil(defn.gold * multiplier), 'city project gold');
      const paid = object(p.paidGoods);
      requireValue(Object.keys(paid).length === Object.keys(defn.materials).length &&
        Object.entries(defn.materials).every(([good, amount]) => paid[good] === Math.ceil(amount * multiplier)),
        'city project materials');
    }
    if (city.lastMonth !== null) {
      const m = object(city.lastMonth);
      requireValue(integer(m.turn, 1, Number(s.turn)) && integer(m.consumedFood) &&
        integer(m.unmetFood) && integer(m.workforce) && integer(m.employed) &&
        Number(m.employed) <= Number(m.workforce), 'city workforce and demand');
      for (const fld of ['produced', 'inputs']) {
        const values = object(m[fld]);
        requireValue(Object.keys(values).length === GOODS.length &&
          GOODS.every((good) => integer(values[good], 0, 1000000)), 'city production');
      }
    }
  }
  const quests = object(s.quests);
  requireValue(Object.keys(quests).length === Object.keys(QUESTS).length &&
    Object.keys(QUESTS).every((id) => Object.hasOwn(quests, id)), 'quest registry');
  const turn = Number(s.turn);
  for (const [id, entry] of Object.entries(quests)) {
    const q = object(entry);
    const qdef = QUESTS[id];
    requireValue(oneOf(q.status, ['unavailable', 'available', 'active', 'succeeded', 'failed', 'superseded']), 'quest status');
    requireValue(qdef.campaignIds.includes(def.id) || q.status === 'unavailable', 'quest outside its campaign');
    const resolved = oneOf(q.status, ['succeeded', 'failed', 'superseded']);
    const open = q.status === 'available' || q.status === 'active';
    const stageIds = qdef.stages.map((st) => st.id);
    requireValue(q.status === 'unavailable' ? q.stage === 'locked' : resolved ? q.stage === 'resolved' : text(q.stage) && stageIds.includes(q.stage), 'quest stage');
    requireValue(open ? integer(q.stageTurn, 1, turn) : q.stageTurn === null, 'quest stage month');
    requireValue(resolved
      ? integer(q.resolvedTurn, 1, turn) && oneOf(q.resolvedBy, ['choice', 'encounter', 'objective', 'deadline', 'location-lost'])
      : q.resolvedTurn === null && q.resolvedBy === null, 'quest resolution');
    const history = array(q.history);
    for (const raw of history) {
      const h = object(raw);
      const stage = qdef.stages.find((st) => st.id === h.stage);
      requireValue(stage !== undefined && integer(h.turn, 1, turn) &&
        (h.choice === DEADLINE || h.choice === LOCATION_LOST || stage.choices.some((c) => c.id === h.choice) || (stage.objectives ?? []).some((o) => o.id === h.choice) ||
          stage.choices.some((c) => 'encounter' in c.then && (h.choice === encounterMark(c.id, true) || h.choice === encounterMark(c.id, false)))), 'quest history');
    }
    const choices = qdef.stages.flatMap((st) => st.choices.map((c) => c.id));
    requireValue(q.choice === null || (text(q.choice) && choices.includes(q.choice)), 'quest choice');
    requireValue(q.status !== 'unavailable' || (history.length === 0 && q.choice === null), 'quest progress');
    requireValue(q.status !== 'active' || history.length > 0, 'quest progress');
    if (resolved && q.resolvedBy !== 'location-lost') {
      requireValue(resolutionOf(qdef, q as unknown as GameState['quests'][string])?.status === q.status, 'quest outcome');
    }
  }
  const inventory = object(s.items);
  for (const [id, entry] of Object.entries(inventory)) {
    const h = object(entry);
    requireValue(Object.hasOwn(ITEMS, id) && integer(h.qty, 0) && integer(h.spent, 0) && bool(h.archived), 'inventory objects');
    // Only goods a merchant stocks can have been bought.
    requireValue(h.bought === undefined || (integer(h.bought, 1) &&
      Object.values(MERCHANTS).some((m) => m.stock.some((line) => line.item === id))), 'bought objects');
    // A holding can stand at zero held and zero spent while heroes carry every copy; conservation checks the total.
  }
  const treaties = object(s.treaties);
  for (const [id, entry] of Object.entries(treaties)) {
    const t = object(entry);
    requireValue(Object.hasOwn(towns, id) && oneOf(t.relation, ['hostile', 'neutral', 'truce', 'ally', 'vassal']) &&
      bool(t.passage) && integer(t.signedTurn, 1, Number(s.turn)), 'treaty');
    requireValue(!t.passage || t.relation === 'ally' || t.relation === 'vassal', 'treaty passage');
  }
  // Lairs: one record per lair of this campaign; an active lair still has its garrison, a cleared one is found.
  const lairs = object(s.lairs);
  const expected = lairsOf(def.id);
  const hexPlace = (id: string) => { const pl = def.hex?.places.find((x) => x.id === id); return pl ? `${pl.col},${pl.row}` : id; };
  requireValue(Object.keys(lairs).length === expected.length && expected.every((l) => Object.hasOwn(lairs, l.id)), 'lair registry');
  for (const l of expected) {
    const st = object(lairs[l.id]);
    requireValue(oneOf(st.status, ['active', 'cleared']) && bool(st.discovered) && (st.lastRaid === null || integer(st.lastRaid, 1, Number(s.turn))), 'lair state');
    if (st.status === 'cleared') requireValue(st.discovered === true && integer(st.clearedTurn, 1, Number(s.turn)), 'cleared lair');
    else requireValue(st.clearedTurn === null && (s.armies as GameState['armies']).some((a) => a.owner === l.species && a.at === hexPlace(l.place)), 'lair garrison');
  }
  // Pending raids: from a lair of this campaign, against a town, arriving within its species' warning.
  const pending = array(s.raids);
  const raidTargets = new Set<string>();
  for (const raw of pending) {
    const r = object(raw);
    requireValue(text(r.lair) && Object.hasOwn(lairs, r.lair) && text(r.target) && Object.hasOwn(towns, r.target) && !raidTargets.has(r.target), 'pending raid');
    const warning = SPECIES[LAIRS_BY_ID[r.lair as string].species].raids.warning;
    requireValue(integer(r.announced, 1, Number(s.turn)) && integer(r.arrives, Number(r.announced) + 1, Number(r.announced) + warning) && Number(r.arrives) >= Number(s.turn), 'pending raid');
    raidTargets.add(r.target as string);
  }
  // The raid log: what each raid that came due cost, in month order.
  let lastRaidTurn = 1;
  for (const raw of array(s.raidLog)) {
    const r = object(raw);
    requireValue(integer(r.turn, lastRaidTurn, Number(s.turn)) && text(r.lair) && Object.hasOwn(lairs, r.lair) && text(r.target) && Object.hasOwn(towns, r.target), 'raid record');
    requireValue(oneOf(r.result, ['never-came', 'turned-back', 'beaten-off', 'plundered', 'sacked', 'taken']) && bool(r.battle) &&
      [r.gold, r.people, r.garrisonLost, r.raidersLost].every((n) => integer(n, 0)) && (r.damaged === null || oneOf(r.damaged, BUILDING_IDS)), 'raid record');
    requireValue(r.battle || (r.garrisonLost === 0 && r.raidersLost === 0), 'raid record losses');
    lastRaidTurn = Number(r.turn);
  }
  for (const a of s.armies as GameState['armies']) {
    if (a.campTurn !== undefined) requireValue(a.owner === 'player' && integer(a.campTurn, 1, Number(s.turn)), 'army camp');
    if (a.raid !== undefined) requireValue(text(a.raid.lair) && LAIRS_BY_ID[a.raid.lair]?.species === a.owner && Object.hasOwn(lairs, a.raid.lair), 'raiding party');
  }
  const flags = array(s.flags);
  requireValue(flags.every(text) && new Set(flags).size === flags.length, 'campaign flags');
  // Everything a quest grants must come from a quest that actually ended that way: no forged rewards, no
  // missing ones. Treaties may have ended since (a town changing hands), so they only need a source.
  const granted = { items: new Map<string, number>(), archived: new Set<string>(), treaties: new Set<string>(), flags: new Set<string>() };
  for (const [id, entry] of Object.entries(quests)) {
    const progress = entry as GameState['quests'][string];
    const resolution = isResolved(progress) ? resolutionOf(QUESTS[id], progress) : null;
    // Items that came to light as a stage began count as granted by the quest.
    for (const stage of progress.status === 'unavailable' ? [] : enteredStages(QUESTS[id], progress)) {
      for (const event of stage.onStart ?? []) {
        if (event.kind === 'item') granted.items.set(event.item, (granted.items.get(event.item) ?? 0) + 1);
      }
    }
    for (const effect of resolution?.effects ?? []) {
      if (effect.kind === 'item') granted.items.set(effect.item, (granted.items.get(effect.item) ?? 0) + (effect.qty ?? 1));
      if (effect.kind === 'archive') granted.archived.add(effect.item);
      if (effect.kind === 'treaty') granted.treaties.add(effect.town);
      if (effect.kind === 'flag') {
        granted.flags.add(effect.flag);
        requireValue(flags.includes(effect.flag), 'missing quest flag');
      }
    }
  }
  // Objects are conserved: held plus carried by heroes plus spent equals what quests granted, and only a quest
  // can archive evidence.
  const carried = new Map<string, number>();
  for (const a of (s.armies as GameState['armies'])) for (const t of a.troops) {
    for (const id of Object.values(t.kit ?? {})) if (id) carried.set(id, (carried.get(id) ?? 0) + 1);
  }
  for (const item of granted.items.keys()) requireValue(Object.hasOwn(inventory, item), 'missing quest reward');
  requireValue(Object.entries(inventory).every(([item, h]) => granted.items.has(item) || ((h as { bought?: number }).bought ?? 0) > 0),
    'inventory object with no quest that granted it');
  for (const [item, entry] of Object.entries(inventory)) {
    const h = entry as { qty: number; spent: number; bought?: number };
    requireValue(h.qty + h.spent + (carried.get(item) ?? 0) === (granted.items.get(item) ?? 0) + (h.bought ?? 0),
      'inventory count does not match what quests granted and merchants sold');
  }
  requireValue([...carried.keys()].every((item) => granted.items.has(item)), 'carried equipment no quest granted');
  for (const [item, entry] of Object.entries(inventory)) {
    requireValue((entry as { archived: boolean }).archived === granted.archived.has(item), 'archived evidence');
    requireValue(ITEMS[item].policy.sell || ITEMS[item].policy.discard || ITEMS[item].use || (entry as { spent: number }).spent === 0, 'spent an object that cannot be spent');
  }
  // A vassal treaty can also come from a siege that ended in terms.
  for (const r of array(s.siegeLog)) if (object(r).result === 'vassal') granted.treaties.add(object(r).town as string);
  requireValue(Object.keys(treaties).every((town) => granted.treaties.has(town)), 'treaty with no quest that granted it');
  requireValue(flags.every((flag) => granted.flags.has(flag as string)), 'flag with no quest that set it');
  array(s.journal).forEach((entry, i) => {
    const j = object(entry);
    requireValue(j.id === i + 1 && integer(j.turn, 1, Number(s.turn)) && oneOf(j.kind, deedKinds) && text(j.text), 'journal entry');
    requireValue(j.place === null || loc(j.place), 'journal place');
  });
  if (s.battle !== null) {
    const b = object(s.battle);
    requireValue(b.settled === undefined || b.settled === false, 'already settled battle');
    requireValue(loc(b.at) && Object.values(BATTLE_SIZES).some((size) => size.width === b.width && size.height === b.height), 'battle map');
    const width = Number(b.width), height = Number(b.height);
    requireValue(integer(b.round, 1, maxRounds(b as { width: number }) + 1) && integer(b.seed, -2147483648, 2147483647) && bool(b.walls), 'battle numbers');
    requireValue(oneOf(b.active, sides) && oneOf(b.outcome, [null, ...sides]) && oneOf(b.retreated, [null, ...sides]), 'battle status');
    const owners = object(b.owners);
    requireValue(oneOf(owners.attacker, factions) && oneOf(owners.defender, factions), 'battle owners');
    if (b.city !== undefined) {
      const cityState = value as GameState;
      const city = object(b.city), town = cityState.towns[String(city.town)];
      requireValue(town && town.kind !== 'lair' && town.owner === owners.defender && townLocation(cityState, town.id) === b.at &&
        integer(city.money, 0, 500) && city.money === cityTreasuryMoney(cityState, town) &&
        bool(city.deploying) && (!city.deploying || (owners.defender === 'player' && b.round === 1 && b.active === 'attacker' && b.outcome === null)) &&
        width === BATTLE_SIZES.major.width && height === BATTLE_SIZES.major.height, 'city battlefield');
      const occupied = new Set<string>(), counts: Record<string, number> = {};
      for (const raw of array(city.buildings)) {
        const site = object(raw), kind = String(site.kind);
        requireValue(oneOf(kind, [...BUILDING_IDS, 'homes', 'treasury']) && integer(site.level, 1) &&
          integer(site.col, 18, 20) && integer(site.row, 5, 13) && bool(site.pillaged), 'city battle building');
        const key = `${site.col},${site.row}`;
        requireValue(!occupied.has(key), 'overlapping city buildings'); occupied.add(key);
        counts[kind] = (counts[kind] ?? 0) + 1;
        if (kind === 'homes' || kind === 'treasury') requireValue(site.level === 1 + Math.floor(town.pop / 2000) && (kind !== 'homes' || !site.pillaged), 'city homes');
        else requireValue(site.level === cityState.cityEconomies[town.id].buildings[kind as keyof typeof BUILDINGS] && counts[kind] <= Math.min(4, Math.ceil(Math.sqrt(Number(site.level)))), 'city development snapshot');
      }
      requireValue(counts.treasury === 1 && (counts.homes ?? 0) <= 12 && occupied.size <= 27, 'city building count');
    }
    const terrain = array(b.terrain);
    requireValue(terrain.length === width && terrain.every((col) => array(col).length === height && array(col).every((k) => text(k) && Object.hasOwn(TERRAIN, k))), 'battle terrain');
    requireValue(array(b.log).every(text), 'battle log');
    if (b.raid !== undefined) {
      const r = object(b.raid);
      requireValue(text(r.lair) && Object.hasOwn(lairs, r.lair) && text(r.town) && Object.hasOwn(towns, r.town) && hexPlace(r.town as string) === b.at, 'raid battle');
    }
    const state = value as GameState;
    const a = state.armies.find((a) => a.id === b.attackerId);
    const d = state.armies.find((a) => a.id === b.defenderId);
    requireValue(a && d && a !== d && a.at === b.at && d.at === b.at && a.owner === owners.attacker && d.owner === owners.defender, 'battle army references');
    const unitIds = new Set<number>(), troopIds = new Set<number>(), cells = new Set<string>();
    const deployed = { attacker: 0, defender: 0 };
    for (const item of array(b.units)) {
      const u = object(item);
      requireValue(integer(u.id, 1) && !unitIds.has(u.id) && integer(u.troopId, 1) && !troopIds.has(u.troopId), 'duplicate battle unit');
      unitIds.add(u.id); troopIds.add(u.troopId);
      requireValue(oneOf(u.side, sides), 'battle side');
      const army = u.side === 'attacker' ? a : d;
      const troop = army.troops.find((t) => t.id === u.troopId);
      requireValue(troop && u.armyId === army.id && u.type === troop.type && u.xp === troop.xp && u.startMen === troop.men, 'battle troop references');
      requireValue(JSON.stringify(u.gear) === JSON.stringify(troop.gear) && JSON.stringify(u.kit ?? null) === JSON.stringify(troop.kit ?? null), 'battle equipment snapshot');
      requireValue(integer(u.maxMen, 1) && u.maxMen === (isHero(troop.type) ? heroMaxHp(troop.type, troop.xp) : troop.men) && integer(u.men, 0, u.maxMen), 'battle strength');
      requireValue(integer(u.mana, 0, heroMaxMana(troop.type, troop.xp)) && integer(u.morale, 0, 100) && integer(u.deeds), 'battle resources');
      requireValue([u.reserve, u.routing, u.fled, u.moved, u.acted].every(bool) && (u.name === undefined || text(u.name)), 'battle flags');
      requireValue(u.aim === undefined || (UNIT_TYPES[troop.type].boulder !== undefined && integer(u.aim, 1)), 'boulder aim');
      const effects = array(u.effects);
      const seenEffects = new Set<string>();
      for (const rawEffect of effects) {
        const effect = object(rawEffect);
        requireValue(text(effect.id) && Object.hasOwn(EFFECTS, effect.id) && !seenEffects.has(effect.id), 'spell effect');
        requireValue(integer(effect.turns, 1, EFFECTS[effect.id as keyof typeof EFFECTS].turns), 'spell duration');
        seenEffects.add(effect.id);
      }
      requireValue(!(seenEffects.has('haste') && seenEffects.has('slow')), 'conflicting spell effects');
      requireValue(!u.reserve || effects.length === 0, 'reserve spell effects');
      if (u.reserve) {
        requireValue(u.col === -1 && u.row === -1 && u.men === u.startMen && u.deeds === 0 && !u.fled && !u.routing, 'reserve state');
      } else {
        requireValue(integer(u.col, 0, width - 1) && integer(u.row, 0, height - 1), 'battle position');
        deployed[u.side as 'attacker' | 'defender']++;
        if (Number(u.men) > 0 && !u.fled) {
          const key = `${u.col},${u.row}`;
          requireValue(!cells.has(key), 'overlapping units');
          cells.add(key);
        }
      }
    }
    requireValue(b.deploymentLimit === undefined || oneOf(b.deploymentLimit, [FIELD_LIMIT, 27]), 'battle deployment limit');
    const deploymentLimit = Number(b.deploymentLimit ?? 27);
    requireValue(deployed.attacker <= deploymentLimit && deployed.defender <= deploymentLimit, 'field capacity');
    if (b.stances !== undefined) {
      requireValue(Object.entries(object(b.stances)).every(([side, st]) => oneOf(side, sides) && oneOf(st, ['defensive', 'skirmish', 'custom'])), 'battle stances');
    }
    if (b.encounter !== undefined) {
      // A quest encounter: the guardians defend; your army (or its hero party) attacks; the quest is waiting on it.
      const e = object(b.encounter);
      const progress = (s.quests as GameState['quests'])[e.quest as string];
      const stage = progress && QUESTS[e.quest as string] ? stageOf(QUESTS[e.quest as string], progress.stage) : undefined;
      const choice = stage?.choices.find((c) => c.id === e.choice);
      requireValue(choice !== undefined && 'encounter' in choice.then && isOpen(progress) && progress.history.at(-1)?.choice === e.choice &&
        e.guardian === b.defenderId && (e.party === undefined ? e.army === b.attackerId : e.party === b.attackerId) &&
        state.armies.some((x) => x.id === e.army && x.owner === 'player'), 'quest encounter');
    }
    if (!allowMissingBattleTroops) requireValue([...a.troops, ...d.troops].every((t) => troopIds.has(t.id)), 'missing battle units');
  }
  const state = value as GameState;
  const reason = endingReason(state);
  requireValue(state.status === 'playing' ? state.endingReason === null && reason === null : state.endingReason === reason && (state.status === 'won' ? reason === 'lair-captured' || reason === 'chapter-complete' : reason === 'lord-dead' || reason === 'capital-lost'), 'inconsistent campaign ending');
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
  // The v5 quest record: only the Fenwick Charter existed. upgradeToV11 converts it to the current shape.
  value.quests = {
    Q00: fenwick.owner !== 'neutral'
      ? { status: 'superseded', stage: 'resolved', choice: null, resolvedTurn: integer(value.turn, 1) ? value.turn : 1 }
      : { status: 'available', stage: 'decision', choice: null, resolvedTurn: null },
  };
  value.items = [];
  value.treaties = {};
  value.version = 5;
}

/** Start a truthful ledger at the import point. Historic gold flows cannot be reconstructed from old saves. */
function upgradeToV6(value: Record<string, unknown>) {
  requireValue(integer(value.gold), 'treasury migration balance');
  value.treasury = newTreasury(value.gold as number);
  value.version = 6;
}

/** Existing saves know their owned towns, but not prior stocks or constructions. Seed honestly at migration. */
function upgradeToV7(value: Record<string, unknown>) {
  const towns = object(value.towns);
  value.cityEconomies = startingCities(towns as unknown as Record<string, Town>);
  for (const row of array(object(value.treasury).history)) object(row).unpaidMaintenance = 0;
  value.version = 7;
}

/** Add default real-world loadouts without awarding level-gated gear or charging historic gold. */
function upgradeToV8(value: Record<string, unknown>) {
  const armies = array(value.armies);
  const troopTypes = new Map<number, string>();
  for (const entry of armies) {
    const army = object(entry);
    for (const raw of array(army.troops)) {
      const t = object(raw);
      requireValue(text(t.type) && Object.hasOwn(UNIT_TYPES, t.type), 'legacy equipment troop');
      t.gear = basicLoadout(t.type);
      t.refit = null;
      if (integer(t.id, 1)) troopTypes.set(t.id, t.type);
    }
  }
  if (value.battle !== null) {
    for (const raw of array(object(value.battle).units)) {
      const u = object(raw);
      const type = troopTypes.get(u.troopId as number);
      requireValue(type !== undefined, 'legacy equipment battle');
      u.gear = basicLoadout(type);
    }
  }
  value.version = 8;
}

/** Old battles receive no retroactive magic effects or mana changes. */
function upgradeToV9(value: Record<string, unknown>) {
  if (value.battle !== null) {
    for (const raw of array(object(value.battle).units)) object(raw).effects = [];
  }
  value.version = 9;
}

/**
 * v9 → v10 replaces each troop's `moved` flag with movement points. Every v9 save is the nine-location valley,
 * where a march costs the whole month: a troop that hadn't moved has 1 point left, one that had (or is
 * refitting) has 0.
 */
function upgradeToV10(value: Record<string, unknown>) {
  for (const a of array(value.armies)) {
    for (const entry of array(object(a).troops)) {
      const t = object(entry);
      t.mp = t.moved === true ? 0 : 1;
      delete t.moved;
    }
  }
  value.version = 10;
}

/**
 * v10 → v11 brings in the data-driven quest engine. Old records (only the Fenwick Charter, with a single
 * 'decision' stage) gain how they were resolved, the month their stage began and their choice history.
 * Campaign flags start empty: no earlier quest set any.
 */
function upgradeToV11(value: Record<string, unknown>) {
  const old = object(value.quests);
  const turn = integer(value.turn, 1) ? value.turn : 1;
  const quests: Record<string, unknown> = {};
  for (const id of Object.keys(QUESTS)) {
    const q = old[id] === undefined ? null : object(old[id]);
    if (!q) {
      quests[id] = lockedProgress();
      continue;
    }
    const choice = text(q.choice) ? q.choice : null;
    const resolvedTurn = integer(q.resolvedTurn, 1) ? q.resolvedTurn : null;
    quests[id] = {
      status: q.status,
      stage: q.stage,
      choice,
      resolvedTurn,
      resolvedBy: q.status === 'superseded' ? 'location-lost' : q.status === 'succeeded' || q.status === 'failed' ? 'choice' : null,
      stageTurn: q.status === 'available' ? turn : null,
      history: choice && resolvedTurn ? [{ stage: 'decision', choice, turn: resolvedTurn }] : [],
    };
  }
  value.quests = quests;
  value.flags = [];
  value.version = 11;
}

/** v11 → v12: the inventory becomes counted holdings (one of each object held before), so consumables can stack. */
function upgradeToV12(value: Record<string, unknown>) {
  // An inventory already in the new shape is left as it is; validation checks it either way.
  if (Array.isArray(value.items)) {
    value.items = Object.fromEntries(value.items.map((id) => [id, { qty: 1, spent: 0, archived: false }]));
  }
  value.version = 12;
}

/**
 * v12 → v13: heroes can carry equipment. Quest rewards added to content since a save was made (the Oathlance
 * for M01, the Shield of the Old Watch for Q03) are granted to saves whose quest already ended that way, once,
 * so a finished quest's reward is never missing. Nothing else in the inventory changes.
 */
function upgradeToV13(value: Record<string, unknown>) {
  const items = object(value.items) as Record<string, { qty: number; spent: number; archived: boolean }>;
  const quests = object(value.quests) as GameState['quests'];
  for (const [id, progress] of Object.entries(quests)) {
    const def = QUESTS[id];
    if (!def || !progress || !isResolved(progress)) continue;
    const owed = new Map<string, number>();
    for (const e of resolutionOf(def, progress)?.effects ?? []) {
      if (e.kind === 'item') owed.set(e.item, (owed.get(e.item) ?? 0) + (e.qty ?? 1));
    }
    for (const [item, count] of owed) {
      const h = items[item] ?? (items[item] = { qty: 0, spent: 0, archived: false });
      if (integer(h.qty, 0) && integer(h.spent, 0) && h.qty + h.spent < count) h.qty = count - h.spent;
    }
  }
  value.version = 13;
}

/**
 * v13 → v14: monster lairs. Every lair of the campaign starts active and undiscovered, and its garrison is added.
 * A lair whose place is already held by someone else starts cleared (no plunder), so no armies are stacked.
 */
function upgradeToV14(value: Record<string, unknown>) {
  value.lairs = {};
  // Garrisons go in after any map upgrade (lairs can stand outside an older revision's map): addLairGarrisons.
  lairGarrisonsDue.add(value);
  value.version = 14;
}

const lairGarrisonsDue = new WeakSet<object>();

/** Second half of v13 → v14, once the map is current: place each lair and its garrison. */
function addLairGarrisons(value: Record<string, unknown>) {
  if (!lairGarrisonsDue.has(value)) return;
  lairGarrisonsDue.delete(value);
  const state = value as unknown as GameState;
  const def = getCampaign(state.campaignId);
  const lairs = value.lairs as Record<string, unknown>;
  for (const l of lairsOf(state.campaignId)) {
    const place = def.hex?.places.find((p) => p.id === l.place);
    const at = place ? `${place.col},${place.row}` : l.place;
    const occupied = state.armies.some((a) => a.at === at);
    lairs[l.id] = occupied
      ? { status: 'cleared', discovered: true, clearedTurn: integer(value.turn, 1) ? value.turn : 1, lastRaid: null }
      : { status: 'active', discovered: false, clearedTurn: null, lastRaid: null };
    if (!occupied) state.armies.push({ id: state.nextId++, owner: l.species, at, from: null, troops: l.garrison.map((t) => (typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name))) });
  }
}

/** v14 → v15: monster raids. No raid is pending, and no lair has raided yet. */
function upgradeToV15(value: Record<string, unknown>) {
  value.raids = [];
  for (const st of Object.values(object(value.lairs))) object(st).lastRaid = null;
  value.version = 15;
}

/** v15 → v16: raid outcomes. No raid has a record yet. */
/** v16 → v17: seasons and weather. The month a save was made in is clear. */
/** v17 → v18: sieges. None in progress, none ended. */
function upgradeToV18(value: Record<string, unknown>) {
  value.sieges = [];
  value.siegeLog = [];
  value.version = 18;
}

function upgradeToV17(value: Record<string, unknown>) {
  value.weather = { kind: 'clear', turn: value.turn, seed: (Number(value.seed) ^ 0x5eed5) | 0 };
  value.version = 17;
}

function upgradeToV16(value: Record<string, unknown>) {
  value.raidLog = [];
  value.version = 16;
}

/**
 * Quests added to the catalog after a save was made, and unlock at the next month if their
 * prerequisites hold. This is a content addition, not a schema change, so it needs no version bump. Unknown
 * quest ids in the save are still rejected by validation.
 */
function addNewQuests(value: Record<string, unknown>) {
  if (value.version !== 18 || typeof value.quests !== 'object' || value.quests === null) return;
  const quests = value.quests as Record<string, unknown>;
  for (const id of Object.keys(QUESTS)) if (!Object.hasOwn(quests, id)) quests[id] = lockedProgress();
}

/** Additive geography migration: every old cell and existing asset keeps its identity. */
function upgradeWesternMap(value: Record<string, unknown>) {
  if (value.campaignId !== 'western-realm' || value.campaignRevision !== 1) return;
  const towns = object(value.towns), economies = object(value.cityEconomies);
  const oldTownIds: readonly string[] = WESTERN_REVISION_1_TOWNS;
  requireValue(Object.keys(towns).length === oldTownIds.length && oldTownIds.every((id) => Object.hasOwn(towns, id)) &&
    Object.keys(economies).length === oldTownIds.length && oldTownIds.every((id) => Object.hasOwn(economies, id)), 'legacy Western town registry');
  requireValue(integer(value.nextId, 1), 'legacy Western identity counter');
  const armies = array(value.armies);
  const oldLocation = (at: unknown) => {
    if (typeof at !== 'string' || !/^\d+,\d+$/.test(at)) return false;
    const [col, row] = at.split(',').map(Number);
    return col >= 0 && col < 40 && row >= 0 && row < 28;
  };
  for (const raw of armies) {
    const army = object(raw);
    requireValue(oldLocation(army.at) && (army.from === null || oldLocation(army.from)), 'legacy Western army location');
    requireValue(integer(army.id, 1, Number(value.nextId) - 1), 'legacy Western army identity');
    for (const troop of array(army.troops)) requireValue(integer(object(troop).id, 1, Number(value.nextId) - 1), 'legacy Western troop identity');
  }
  for (const town of WESTERN_ADDED_TOWNS) {
    towns[town.id] = { ...town };
    economies[town.id] = initialCityEconomy(town);
  }
  const state = value as unknown as GameState;
  for (const garrison of WESTERN_ADDED_ARMIES) {
    const troops = garrison.troops.map((t) => {
      const troop = typeof t === 'string' ? makeTroop(state, t) : makeTroop(state, t.type, t.name);
      troop.mp = 0; // New neutral forces receive no mid-month movement on import.
      return troop;
    });
    state.armies.push({ id: state.nextId++, owner: garrison.owner, at: startLocation(state, garrison.at), from: null, troops });
  }
  value.campaignRevision = 2;
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
    upgradeToV6(value);
    upgradeToV7(value);
    upgradeToV8(value);
    upgradeToV9(value);
    upgradeToV10(value);
    upgradeToV11(value);
    upgradeToV12(value);
    upgradeToV13(value);
    upgradeToV14(value);
    upgradeToV15(value);
    upgradeToV16(value);
    upgradeToV17(value);
    upgradeToV18(value);
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
  if (value.version === 5) upgradeToV6(value);
  if (value.version === 6) upgradeToV7(value);
  if (value.version === 7) upgradeToV8(value);
  if (value.version === 8) upgradeToV9(value);
  if (value.version === 9) upgradeToV10(value);
  if (value.version === 10) upgradeToV11(value);
  if (value.version === 11) upgradeToV12(value);
  if (value.version === 12) upgradeToV13(value);
  if (value.version === 13) upgradeToV14(value);
  if (value.version === 14) upgradeToV15(value);
  if (value.version === 15) upgradeToV16(value);
  if (value.version === 16) upgradeToV17(value);
  if (value.version === 17) upgradeToV18(value);
  addNewQuests(value);
  upgradeWesternMap(value);
  addLairGarrisons(value);
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
