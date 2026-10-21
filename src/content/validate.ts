import { hexKey, hexNeighbors } from '../game/hex';
import type { CampaignDefinition, HexWorld } from '../game/types';
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
  for (const [id, item] of Object.entries(catalog.items)) {
    if (item.id !== id) err(`item ${id}: mismatched id "${item.id}"`);
    if (item.value < 0 || !Number.isFinite(item.value)) err(`item ${id}: invalid value`);
    for (const questId of item.questIds) if (!Object.hasOwn(catalog.quests, questId)) err(`item ${id}: unknown quest "${questId}"`);
  }
  validateQuests(catalog, err);
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
function validateQuests(catalog: Catalog, err: (msg: string) => void) {
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
    if (!q.stages.length) err(`${where}: has no stages`);
    const stageIds = new Set<string>();
    for (const stage of q.stages) {
      if (stageIds.has(stage.id)) err(`${where}: duplicate stage "${stage.id}"`);
      stageIds.add(stage.id);
      if (stage.id === 'locked' || stage.id === 'resolved') err(`${where}: stage id "${stage.id}" is reserved`);
      if (!stage.choices.length && !stage.deadline) err(`${where}: stage "${stage.id}" has no way to end`);
      if (stage.deadline && (!Number.isInteger(stage.deadline.months) || stage.deadline.months < 1)) err(`${where}: stage "${stage.id}" has an invalid deadline`);
      const choiceIds = new Set<string>();
      for (const c of stage.choices) {
        if (choiceIds.has(c.id)) err(`${where}: duplicate choice "${c.id}" in stage "${stage.id}"`);
        choiceIds.add(c.id);
        if (c.gold !== undefined && (!Number.isInteger(c.gold) || c.gold < 0)) err(`${where}: choice "${c.id}" has an invalid cost`);
      }
    }
    const resolutions = [
      ...q.stages.flatMap((st) => st.choices.flatMap((c) => ('stage' in c.then ? [] : [c.then]))),
      ...q.stages.flatMap((st) => (st.deadline ? [st.deadline.outcome] : [])),
      q.onLocationLost,
    ];
    for (const st of q.stages) {
      for (const c of st.choices) if ('stage' in c.then && !stageIds.has(c.then.stage)) err(`${where}: choice "${c.id}" leads to unknown stage "${c.then.stage}"`);
    }
    for (const r of resolutions) {
      for (const e of r.effects) {
        if (e.kind === 'item' && !catalog.items[e.item]) err(`${where}: rewards unknown item "${e.item}"`);
        if (e.kind === 'treaty' && !q.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === e.town))) err(`${where}: treaty with unknown town "${e.town}"`);
      }
    }
    for (const c of q.prerequisites) {
      if (c.kind === 'quest' && !quests[c.quest]) err(`${where}: requires unknown quest "${c.quest}"`);
      if (c.kind === 'town-owner' && !q.campaignIds.every((cid) => catalog.campaigns[cid]?.towns.some((t) => t.id === c.town))) err(`${where}: requires unknown town "${c.town}"`);
    }
  }
  // A prerequisite on another quest's outcome must be an outcome that quest can produce.
  const outcomes = (q: (typeof quests)[string]) => new Set([
    ...q.stages.flatMap((st) => st.choices.flatMap((c) => ('stage' in c.then ? [] : [c.then.status]))),
    ...q.stages.flatMap((st) => (st.deadline ? [st.deadline.outcome.status] : [])),
    q.onLocationLost.status,
  ]);
  for (const [id, q] of Object.entries(quests)) {
    for (const c of q.prerequisites) {
      if (c.kind === 'quest' && quests[c.quest] && !outcomes(quests[c.quest]).has(c.status)) {
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
    for (const c of quests[id]?.prerequisites ?? []) if (c.kind === 'quest') visit(c.quest, [...path, id]);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of Object.keys(quests)) visit(id, []);
}
