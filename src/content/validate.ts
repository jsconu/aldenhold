import { hexDistance, hexKey, hexNeighbors } from '../game/hex';
import type { CampaignDefinition, HexWorld, QuestCondition, QuestDefinition, QuestNext } from '../game/types';
import { choiceOutcomes, isResolution } from '../game/quests';
import { hexLand, parseKey, placeKey, roadsOf } from '../game/world';
import type { Catalog } from './index';

/** Bounds of the quick-play map's drawing area; node coordinates must fall inside it. */
const MAP_BOUNDS = { width: 840, height: 500 };

/**
 * Check static content for mistakes that would otherwise surface mid-game (DATA-02): duplicate IDs, unresolved
 * references, coordinates off the map, locations the player can never reach, and campaigns that cannot be won.
 * Returns a list of problems; an empty list means the content is sound.
 */
export function validateContent(catalog: Catalog): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  for (const [key, unit] of Object.entries(catalog.units)) {
    if (unit.id !== key) err(`unit ${key}: id is "${unit.id}"`);
    for (const spell of unit.hero?.spells ?? []) if (!catalog.spells[spell]) err(`unit ${key}: unknown spell "${spell}"`);
    for (const [kind, percent] of Object.entries(unit.resistances ?? {})) {
      if (!['fire', 'cold', 'lightning', 'earth', 'arcane'].includes(kind) || !Number.isFinite(percent) || percent < 0 || percent > 100) err(`unit ${key}: invalid ${kind} resistance`);
    }
  }
  for (const [key, spell] of Object.entries(catalog.spells)) {
    if (spell.id !== key) err(`spell ${key}: id is "${spell.id}"`);
    if (!Number.isInteger(spell.level) || spell.level < 1 || spell.level > 9) err(`spell ${key}: invalid unlock level`);
    if (!Number.isInteger(spell.cost) || spell.cost < 2 || spell.cost > 12) err(`spell ${key}: invalid mana cost`);
    if (!Number.isInteger(spell.range) || spell.range < 0 || !Number.isInteger(spell.radius) || spell.radius < 0) err(`spell ${key}: invalid range or radius`);
    if (!['friend', 'enemy', 'either'].includes(spell.target) || typeof spell.lineOfSight !== 'boolean') err(`spell ${key}: invalid targeting rules`);
  }
  for (const [key, terrain] of Object.entries(catalog.terrain)) if (terrain.id !== key) err(`terrain ${key}: id is "${terrain.id}"`);
  for (const [id, f] of Object.entries(catalog.factions)) {
    if (f.id !== id) err(`faction ${id}: mismatched id "${f.id}"`);
    if (!/^#[0-9a-f]{6}$/i.test(f.colour)) err(`faction ${id}: invalid colour "${f.colour}"`);
  }
  if (Object.values(catalog.factions).filter((f) => f.kind === 'player').length !== 1) err('factions: there must be exactly one player faction');
  for (const [cid, c] of Object.entries(catalog.campaigns)) {
    for (const t of c.towns) if (!catalog.factions[t.owner]) err(`campaign ${cid}: town ${t.id} has unknown owner "${t.owner}"`);
    for (const a of c.armies) if (!catalog.factions[a.owner]) err(`campaign ${cid}: army at ${a.at} has unknown owner "${a.owner}"`);
  }
  for (const [id, item] of Object.entries(catalog.items)) {
    if (item.id !== id) err(`item ${id}: mismatched id "${item.id}"`);
    if (item.value < 0 || !Number.isFinite(item.value)) err(`item ${id}: invalid value`);
    for (const questId of item.questIds) if (!Object.hasOwn(catalog.quests, questId)) err(`item ${id}: unknown quest "${questId}"`);
    // Policies (ITEM-01): relics and evidence are never sold; only consumables are used up.
    if ((item.kind === 'relic' || item.kind === 'evidence') && item.policy.sell) err(`item ${id}: a ${item.kind} cannot be sellable`);
    if (item.kind === 'relic' && item.policy.discard) err(`item ${id}: a relic cannot be thrown away`);
    if (item.policy.sell && item.value <= 0) err(`item ${id}: sellable but has no value`);
    if ((item.kind === 'consumable') !== (item.use !== undefined)) err(`item ${id}: only consumables have a use, and every consumable needs one`);
    if (item.use && !(item.use.hp ?? 0) && !(item.use.mana ?? 0)) err(`item ${id}: its use restores nothing`);
    // Equipment (ITEM-02): only equipment fills a hero slot, adds something, and names real hero types.
    if ((item.kind === 'equipment') !== (item.equip !== undefined)) err(`item ${id}: only equipment has a hero slot, and all equipment needs one`);
    if (item.equip) {
      const bonuses = [item.equip.attack ?? 0, item.equip.defense ?? 0, item.equip.leadership ?? 0];
      if (!bonuses.every((n) => Number.isInteger(n) && n >= 0) || bonuses.every((n) => n === 0)) err(`item ${id}: equipment must add something`);
      for (const type of item.equip.heroes ?? []) if (!catalog.units[type]?.hero) err(`item ${id}: "${type}" is not a hero type`);
    }
  }
  validateQuests(catalog, err);
  for (const [id, m] of Object.entries(catalog.merchants)) {
    const quest = catalog.quests[m.quest];
    if (m.id !== id) err(`merchant ${id}: mismatched id "${m.id}"`);
    if (!quest) err(`merchant ${id}: unknown quest "${m.quest}"`);
    else if (!quest.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === m.at))) err(`merchant ${id}: town "${m.at}" is not in the quest's campaigns`);
    for (const line of m.stock) {
      const item = catalog.items[line.item];
      if (!item) err(`merchant ${id}: sells unknown item "${line.item}"`);
      else if (!item.policy.sell || item.value <= 0) err(`merchant ${id}: "${line.item}" is not a tradable good`);
      if (!Number.isInteger(line.perMonth) || line.perMonth < 1) err(`merchant ${id}: invalid monthly stock for "${line.item}"`);
    }
    if (!m.terms.length || m.terms.some((t) => !(t.markup >= 1))) err(`merchant ${id}: needs opening terms with a markup of at least 1`);
  }
  for (const type of catalog.hireableHeroes) {
    if (!catalog.units[type]?.hero) err(`hireable hero "${type}" is not a hero unit`);
    if (!catalog.heroNames[type]?.length) err(`hireable hero "${type}" has no names`);
  }
  for (const [id, campaign] of Object.entries(catalog.campaigns)) {
    if (campaign.id !== id) err(`campaign ${id}: id is "${campaign.id}"`);
    validateCampaign(catalog, campaign, (msg) => err(`campaign ${id}: ${msg}`));
  }
  return errors;
}

function validateCampaign(catalog: Catalog, c: CampaignDefinition, err: (msg: string) => void) {
  // Named locations: node ids on the valley, place ids on a hex map.
  const named = c.hex ? validateHex(catalog, c.hex, err) : validateGraph(c, err);
  if (c.hex && (c.nodes.length || c.edges.length)) err('a hex campaign must not also list graph nodes or roads');
  const known = (id: string, what: string) => {
    if (!named.ids.has(id)) err(`${what} refers to unknown location "${id}"`);
  };

  const towns = new Map(c.towns.map((t) => [t.id, t]));
  if (towns.size !== c.towns.length) err('duplicate town');
  for (const t of c.towns) {
    known(t.id, `town "${t.id}"`);
    if (c.hex && c.hex.places.find((p) => p.id === t.id)?.kind !== 'town') err(`town "${t.id}" is not a town place`);
  }
  if (c.hex) for (const p of c.hex.places) if (p.kind === 'town' && !towns.has(p.id)) err(`town place "${p.id}" has no town record`);
  for (const [id, profile] of Object.entries(c.settlementProfiles ?? {})) {
    if (!towns.has(id) || !profile.region.trim() || !profile.role.trim()) err(`invalid settlement profile "${id}"`);
  }
  const capital = towns.get(c.capital);
  if (capital?.kind !== 'capital' || capital.owner !== 'player') err(`capital "${c.capital}" must be a player-owned capital town`);
  const lair = towns.get(c.lair);
  if (lair?.kind !== 'lair' || lair.owner === 'player') err(`lair "${c.lair}" must be an enemy lair town`);

  let lords = 0;
  for (const a of c.armies) {
    known(a.at, `${a.owner} army`);
    if (!a.troops.length) err(`empty ${a.owner} army at "${a.at}"`);
    for (const t of a.troops) {
      const type = typeof t === 'string' ? t : t.type;
      const unit = catalog.units[type];
      if (!unit) err(`army at "${a.at}" has unknown unit "${type}"`);
      else if (unit.hero && typeof t === 'string') err(`hero "${type}" at "${a.at}" needs a name`);
      if (type === 'lord' && a.owner === 'player') lords++;
    }
  }
  if (lords !== 1) err(`player must start with exactly one lord (found ${lords})`);
  if (!c.armies.some((a) => a.owner === 'player' && a.at === c.capital)) err('no player army starts in the capital');

  for (const o of c.offers) {
    if (!towns.has(o.town)) err(`hero offer in unknown town "${o.town}"`);
    if (!catalog.hireableHeroes.includes(o.type)) err(`hero offer of non-hireable type "${o.type}"`);
  }

  // Monster lairs: each on a landmark of its species' ground, far enough from the capital, with a real garrison.
  for (const l of Object.values(catalog.lairs).filter((x) => x.campaignId === c.id)) {
    const place = c.hex?.places.find((p) => p.id === l.place);
    if (!place || place.kind !== 'landmark') { err(`lair "${l.id}" is not on a landmark place`); continue; }
    const land = hexLand(c.hex!, placeKey(place)).id;
    if (!catalog.species[l.species].lands.includes(land)) err(`lair "${l.id}" stands on ${land}, not ${l.species} ground`);
    const capital = c.hex!.places.find((p) => p.id === c.capital)!;
    if (hexDistance(place, capital) < catalog.species[l.species].minDistance) err(`lair "${l.id}" is too close to the capital`);
    if (!catalog.factions[l.species]) err(`lair "${l.id}" belongs to unknown faction "${l.species}"`);
    if (!l.garrison.length || l.garrison.some((t) => !catalog.units[typeof t === 'string' ? t : t.type])) err(`lair "${l.id}" has an empty or unknown garrison`);
    if (!c.armies.some((a) => a.owner === l.species && a.at === l.place)) err(`lair "${l.id}" has no garrison in the campaign`);
    if (!(l.loot.gold > 0)) err(`lair "${l.id}" has no plunder`);
  }

  // Every named location must be reachable from the capital, so every town can be taken and the lair attacked.
  const reached = named.reachableFrom(c.capital);
  for (const id of named.ids) if (!reached.has(id)) err(`location "${id}" cannot be reached from the capital`);
  for (const quest of Object.values(catalog.quests)) {
    if (!(quest.campaignIds as readonly string[]).includes(c.id)) continue;
    known(quest.at, `quest "${quest.id}"`);
    if (!reached.has(quest.at)) err(`quest "${quest.id}" cannot be reached`);
  }
}

interface Named {
  ids: Set<string>;
  reachableFrom(id: string): Set<string>;
}

function validateGraph(c: CampaignDefinition, err: (msg: string) => void): Named {
  const ids = new Set<string>();
  for (const n of c.nodes) {
    if (ids.has(n.id)) err(`duplicate location "${n.id}"`);
    ids.add(n.id);
    if (!(n.x >= 0 && n.x <= MAP_BOUNDS.width && n.y >= 0 && n.y <= MAP_BOUNDS.height)) err(`location "${n.id}" is off the map`);
  }
  const seenEdges = new Set<string>();
  for (const [a, b] of c.edges) {
    for (const end of [a, b]) if (!ids.has(end)) err(`road refers to unknown location "${end}"`);
    if (a === b) err(`road from "${a}" to itself`);
    const key = [a, b].sort().join('|');
    if (seenEdges.has(key)) err(`duplicate road ${a}–${b}`);
    seenEdges.add(key);
  }
  return {
    ids,
    reachableFrom(start) {
      const reached = new Set([start]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const [a, b] of c.edges) {
          const next = a === cur ? b : b === cur ? a : null;
          if (next && !reached.has(next)) {
            reached.add(next);
            queue.push(next);
          }
        }
      }
      return reached;
    },
  };
}

function validateHex(catalog: Catalog, world: HexWorld, err: (msg: string) => void): Named {
  const width = world.rows[0]?.length ?? 0;
  const chars = new Set(Object.values(catalog.land).map((l) => l.char));
  world.rows.forEach((row, r) => {
    if (row.length !== width) err(`map row ${r} is ${row.length} wide, expected ${width}`);
    for (const ch of row) if (!chars.has(ch)) err(`map row ${r} has unknown land "${ch}"`);
  });
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const p of world.places) {
    if (ids.has(p.id)) err(`duplicate place "${p.id}"`);
    ids.add(p.id);
    const key = placeKey(p);
    if (cells.has(key)) err(`two places share hex ${key}`);
    cells.add(key);
    if (p.col < 0 || p.row < 0 || p.col >= width || p.row >= world.rows.length) err(`place "${p.id}" is off the map`);
  }
  for (const route of world.routes) for (const id of route) if (!ids.has(id)) err(`road refers to unknown place "${id}"`);
  const malformed = world.rows.some((r) => r.length !== width) || world.routes.some((route) => route.some((id) => !ids.has(id)));
  if (malformed) return { ids, reachableFrom: () => new Set() };

  const roads = roadsOf(world);
  world.routes.forEach((route, i) => {
    const ends = [route[0], route.at(-1)!].map((id) => placeKey(world.places.find((p) => p.id === id)!));
    if (roads[i][0] !== ends[0] || roads[i].at(-1) !== ends[1]) err(`road ${route.join('–')} cannot be laid (blocked by mountains?)`);
  });
  const onRoad = new Set(roads.flat());
  const passable = (key: string) => onRoad.has(key) || hexLand(world, key).move < Infinity;
  for (const p of world.places) if (!passable(placeKey(p))) err(`place "${p.id}" stands on impassable ${hexLand(world, placeKey(p)).name.toLowerCase()}`);

  return {
    ids,
    reachableFrom(startId) {
      const start = world.places.find((p) => p.id === startId);
      if (!start) return new Set();
      const seen = new Set([placeKey(start)]);
      const queue = [placeKey(start)];
      while (queue.length) {
        const { col, row } = parseKey(queue.shift()!);
        for (const n of hexNeighbors({ col, row })) {
          const key = hexKey(n);
          if (n.col < 0 || n.row < 0 || n.col >= width || n.row >= world.rows.length || seen.has(key) || !passable(key)) continue;
          seen.add(key);
          queue.push(key);
        }
      }
      return new Set(world.places.filter((p) => seen.has(placeKey(p))).map((p) => p.id));
    },
  };
}

/**
 * Quest content: references resolve, stages link up, prerequisites don't loop, and every prerequisite asks for an
 * outcome its quest can actually produce, so no quest is left that can never unlock.
 */
/** Every next step a quest's choices (both encounter results included) and objectives can lead to. */
function nextSteps(q: QuestDefinition): QuestNext[] {
  return q.stages.flatMap((st) => [...st.choices.flatMap(choiceOutcomes), ...(st.objectives ?? []).map((o) => o.then)]);
}

function validateQuests(catalog: Catalog, err: (msg: string) => void) {
  const placesOf = (cid: string) => {
    const c = catalog.campaigns[cid as keyof typeof catalog.campaigns];
    return c?.hex ? c.hex.places.map((pl) => pl.id) : c?.nodes.map((n) => n.id) ?? [];
  };
  for (const [id, t] of Object.entries(catalog.units)) {
    const r = t.recruit;
    if (r !== null && typeof r === 'object' && !Object.values(catalog.campaigns).some((c) => c.towns.some((town) => town.id === r.ally))) {
      err(`unit ${id}: recruited at unknown town "${r.ally}"`);
    }
  }
  const quests = catalog.quests;
  for (const [id, q] of Object.entries(quests)) {
    const where = `quest ${id}`;
    if (q.id !== id) err(`${where}: mismatched id "${q.id}"`);
    if (!q.campaignIds.length) err(`${where}: belongs to no campaign`);
    for (const cid of q.campaignIds) {
      const campaign = catalog.campaigns[cid];
      if (!campaign) err(`${where}: unknown campaign "${cid}"`);
      else if (!campaign.towns.some((t) => t.id === q.at)) err(`${where}: town "${q.at}" is not in campaign "${cid}"`);
    }
    if(q.adventureSite) for(const cid of q.campaignIds) if(!placesOf(cid).includes(q.adventureSite)) err(where+': unknown adventure site '+q.adventureSite);
    if (!q.stages.length) err(`${where}: has no stages`);
    const townInCampaigns = (town: string) => q.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === town));
    const stageIds = new Set<string>();
    for (const stage of q.stages) {
      if (stageIds.has(stage.id)) err(`${where}: duplicate stage "${stage.id}"`);
      stageIds.add(stage.id);
      if (stage.id === 'locked' || stage.id === 'resolved') err(`${where}: stage id "${stage.id}" is reserved`);
      if (!stage.choices.length && !stage.deadline && !stage.objectives?.length) err(`${where}: stage "${stage.id}" has no way to end`);
      if (stage.deadline && (!Number.isInteger(stage.deadline.months) || stage.deadline.months < 1)) err(`${where}: stage "${stage.id}" has an invalid deadline`);
      if (stage.deadline?.afterBattles && stage.deadline.outcome.status !== 'succeeded') err(`${where}: deferred hold-out deadline must succeed`);
      const choiceIds = new Set<string>();
      for (const c of stage.choices) {
        if (choiceIds.has(c.id)) err(`${where}: duplicate choice "${c.id}" in stage "${stage.id}"`);
        choiceIds.add(c.id);
        if (c.gold !== undefined && (!Number.isInteger(c.gold) || c.gold < 0)) err(`${where}: choice "${c.id}" has an invalid cost`);
        for (const item of c.requires ?? []) if (!catalog.items[item]) err(`${where}: choice "${c.id}" requires unknown item "${item}"`);
        for (const cond of c.needs ?? []) checkCondition(cond, `${where}: choice "${c.id}"`);
        if ('encounter' in c.then) {
          const enc = c.then.encounter;
          if (!catalog.factions[enc.owner] || enc.owner === 'player') err(`${where}: choice "${c.id}" fights an invalid faction "${enc.owner}"`);
          if (!enc.troops.length) err(`${where}: choice "${c.id}" has an empty encounter`);
          for (const t of enc.troops) if (!catalog.units[typeof t === 'string' ? t : t.type]) err(`${where}: choice "${c.id}" fights an unknown unit`);
          for (const cid of q.campaignIds) if (!placesOf(cid).includes(enc.site)) err(`${where}: choice "${c.id}" has its encounter at unknown place "${enc.site}" in "${cid}"`);
        }
      }
      for (const o of stage.objectives ?? []) {
        if (choiceIds.has(o.id)) err(`${where}: objective "${o.id}" in stage "${stage.id}" reuses a choice or objective id`);
        choiceIds.add(o.id);
        if (!o.when.length) err(`${where}: objective "${o.id}" has no conditions`);
        for (const c of o.when) checkCondition(c, `${where}: objective "${o.id}"`);
      }
      for (const town of stage.recruitBan ?? []) if (!townInCampaigns(town)) err(`${where}: stage "${stage.id}" bans recruiting in unknown town "${town}"`);
      for (const e of stage.onStart ?? []) {
        if (e.kind === 'item') {
          if (catalog.items[e.item]?.kind !== 'evidence') err(`${where}: stage "${stage.id}" can only bring evidence to light, not "${e.item}"`);
          continue;
        }
        if (e.kind === 'spoil') {
          if (!townInCampaigns(e.town)) err(`${where}: stage "${stage.id}" spoils goods in unknown town "${e.town}"`);
          if (!(e.keep >= 0 && e.keep < 1)) err(`${where}: stage "${stage.id}" has an invalid spoilage fraction`);
          continue;
        }
        if (!catalog.factions[e.owner]) err(`${where}: stage "${stage.id}" spawns for unknown faction "${e.owner}"`);
        for (const t of e.troops) if (!catalog.units[typeof t === 'string' ? t : t.type]) err(`${where}: stage "${stage.id}" spawns unknown unit`);
        if (!e.troops.length) err(`${where}: stage "${stage.id}" spawns an empty army`);
        for (const cid of q.campaignIds) {
          const c = catalog.campaigns[cid];
          if (!placesOf(cid).includes(e.at)) err(`${where}: stage "${stage.id}" spawns at unknown place "${e.at}" in "${cid}"`);
          if (e.target && !c?.towns.some((t) => t.id === e.target)) err(`${where}: stage "${stage.id}" targets unknown town "${e.target}"`);
        }
      }
    }
    const resolutions = [
      ...nextSteps(q).filter(isResolution),
      ...q.stages.flatMap((st) => (st.deadline ? [st.deadline.outcome] : [])),
      q.onLocationLost,
    ];
    for (const st of q.stages) {
      const steps = [...st.choices.flatMap((c) => choiceOutcomes(c).map((next) => ({ id: c.id, next }))), ...(st.objectives ?? []).map((o) => ({ id: o.id, next: o.then }))];
      for (const { id: stepId, next } of steps) if (!isResolution(next) && !stageIds.has(next.stage)) err(`${where}: "${stepId}" leads to unknown stage "${next.stage}"`);
    }
    for (const r of resolutions) {
      for (const e of r.effects) {
        if (e.kind === 'item' && !catalog.items[e.item]) err(`${where}: rewards unknown item "${e.item}"`);
        if (e.kind === 'item' && catalog.items[e.item] && (e.qty ?? 1) !== 1 && catalog.items[e.item].kind !== 'consumable') err(`${where}: only consumables can be granted more than one at a time`);
        if (e.kind === 'item' && e.qty !== undefined && (!Number.isInteger(e.qty) || e.qty < 1)) err(`${where}: invalid item quantity`);
        if (e.kind === 'archive' && catalog.items[e.item]?.kind !== 'evidence') err(`${where}: can only archive evidence, not "${e.item}"`);
        if ((e.kind === 'goods' || e.kind === 'population') && !townInCampaigns(e.town)) err(`${where}: changes unknown town "${e.town}"`);
        if ((e.kind === 'goods' || e.kind === 'population') && (!Number.isInteger(e.amount) || e.amount === 0)) err(`${where}: invalid amount for "${e.town}"`);
        if (e.kind === 'treaty' && !q.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === e.town))) err(`${where}: treaty with unknown town "${e.town}"`);
      }
    }
    function checkCondition(c: QuestCondition, at: string) {
      if (c.kind === 'quest' && !quests[c.quest]) err(`${at}: requires unknown quest "${c.quest}"`);
      if ((c.kind === 'town-owner' || c.kind === 'food') && !q.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === c.town))) err(`${at}: requires unknown town "${c.town}"`);
      if ('atLeast' in c && (!Number.isInteger(c.atLeast) || c.atLeast < 0)) err(`${at}: invalid count`);
      if (c.kind === 'army-at') for (const cid of q.campaignIds) if (!placesOf(cid).includes(c.place)) err(`${at}: requires unknown place "${c.place}" in "${cid}"`);
      if (c.kind === 'any') {
        if (!c.of.length) err(`${at}: "any" with no conditions`);
        c.of.forEach((x) => checkCondition(x, at));
      }
    }
    for (const c of q.prerequisites) checkCondition(c, where);
  }
  // A prerequisite on another quest's outcome must be an outcome that quest can produce.
  const outcomes = (q: (typeof quests)[string]) => new Set([
    ...nextSteps(q).filter(isResolution).map((r) => r.status),
    ...q.stages.flatMap((st) => (st.deadline ? [st.deadline.outcome.status] : [])),
    q.onLocationLost.status,
  ]);
  /** Quest conditions anywhere in a list, including inside "any". */
  const questRefs = (list: QuestCondition[]): Extract<QuestCondition, { kind: 'quest' }>[] =>
    list.flatMap((c) => (c.kind === 'quest' ? [c] : c.kind === 'any' ? questRefs(c.of) : []));
  for (const [id, q] of Object.entries(quests)) {
    for (const c of questRefs(q.prerequisites)) {
      if (quests[c.quest] && !outcomes(quests[c.quest]).has(c.status)) {
        err(`quest ${id}: requires "${c.quest}" to end ${c.status}, which it never can`);
      }
    }
  }
  // Prerequisite cycles: a quest that (indirectly) waits on itself can never unlock.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string, path: string[]) => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      err(`quest prerequisites loop: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`);
      return;
    }
    visiting.add(id);
    for (const c of questRefs(quests[id]?.prerequisites ?? [])) visit(c.quest, [...path, id]);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of Object.keys(quests)) visit(id, []);
}
