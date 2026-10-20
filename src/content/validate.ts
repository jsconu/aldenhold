import type { CampaignDefinition } from '../game/types';
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
  }
  for (const [key, spell] of Object.entries(catalog.spells)) if (spell.id !== key) err(`spell ${key}: id is "${spell.id}"`);
  for (const [key, terrain] of Object.entries(catalog.terrain)) if (terrain.id !== key) err(`terrain ${key}: id is "${terrain.id}"`);
  for (const [id, item] of Object.entries(catalog.items)) {
    if (item.id !== id) err(`item ${id}: mismatched id "${item.id}"`);
    if (item.value < 0 || !Number.isFinite(item.value)) err(`item ${id}: invalid value`);
    for (const questId of item.questIds) if (!Object.hasOwn(catalog.quests, questId)) err(`item ${id}: unknown quest "${questId}"`);
  }
  for (const [id, quest] of Object.entries(catalog.quests)) {
    if (quest.id !== id) err(`quest ${id}: mismatched id "${quest.id}"`);
    if (!Object.hasOwn(catalog.campaigns, quest.campaignId)) err(`quest ${id}: unknown campaign "${quest.campaignId}"`);
    if (!catalog.items[quest.rewardItem]) err(`quest ${id}: unknown reward item "${quest.rewardItem}"`);
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
  const nodes = new Set<string>();
  for (const n of c.nodes) {
    if (nodes.has(n.id)) err(`duplicate location "${n.id}"`);
    nodes.add(n.id);
    if (!(n.x >= 0 && n.x <= MAP_BOUNDS.width && n.y >= 0 && n.y <= MAP_BOUNDS.height)) err(`location "${n.id}" is off the map`);
  }
  const known = (id: string, what: string) => {
    if (!nodes.has(id)) err(`${what} refers to unknown location "${id}"`);
  };
  const seenEdges = new Set<string>();
  for (const [a, b] of c.edges) {
    known(a, 'road');
    known(b, 'road');
    if (a === b) err(`road from "${a}" to itself`);
    const key = [a, b].sort().join('|');
    if (seenEdges.has(key)) err(`duplicate road ${a}–${b}`);
    seenEdges.add(key);
  }

  const towns = new Map(c.towns.map((t) => [t.id, t]));
  if (towns.size !== c.towns.length) err('duplicate town');
  for (const t of c.towns) known(t.id, `town "${t.id}"`);
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

  // Every location must be reachable from the capital, so every town can be taken and the lair attacked.
  const reached = new Set([c.capital]);
  const queue = [c.capital];
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
  for (const id of nodes) if (!reached.has(id)) err(`location "${id}" cannot be reached from the capital`);
  for (const quest of Object.values(catalog.quests)) {
    if (quest.campaignId !== c.id) continue;
    known(quest.at, `quest "${quest.id}"`);
    if (!reached.has(quest.at)) err(`quest "${quest.id}" cannot be reached`);
  }
}
