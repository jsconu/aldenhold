import type { Catalog } from './index';
import type { QuestCondition } from '../game/types';

/** Bind every battle to one choice and to a stage that can handle all three outcomes. */
export function validateEncounters(catalog: Catalog): string[] {
  const errors: string[] = [];
  for (const [id, def] of Object.entries(catalog.encounters)) {
    const err = (text: string) => errors.push(`encounter ${id}: ${text}`);
    if (def.id !== id) err('mismatched id');
    if (!['army', 'heroes'].includes(def.mode) || !def.warning.trim()) err('missing participation mode or risk warning');
    const quest = catalog.quests[def.quest];
    if (!quest) { err('unknown sponsoring quest'); continue; }
    if (!def.campaignIds.length || !def.campaignIds.every((cid) => quest.campaignIds.includes(cid))) err('campaign mismatch');
    if (!def.enemies.length || def.enemies.length > 27) err('invalid enemy force size');
    for (const troop of def.enemies) {
      const type = typeof troop === 'string' ? troop : troop.type;
      if (!catalog.units[type]) err(`unknown enemy unit ${type}`);
      if (catalog.units[type]?.hero && typeof troop === 'string') err('enemy heroes need names');
    }
    const starts = Object.values(catalog.quests).flatMap((q) => q.stages.flatMap((stage) => stage.choices.filter((c) => c.encounter === id).map((choice) => ({ q, choice }))));
    if (starts.length !== 1 || starts[0].q.id !== def.quest) err('needs exactly one sponsoring start choice');
    for (const { choice } of starts) {
      const wait = 'stage' in choice.then ? quest.stages.find((s) => s.id === (choice.then as { stage: string }).stage) : undefined;
      if (!wait || wait.choices.length || wait.deadline || wait.onStart?.length) { err('start must lead to a battle-only objective stage'); continue; }
      const outcomes = new Set<string>();
      const check = (c: QuestCondition) => {
        if (c.kind === 'encounter' && c.encounter === id) outcomes.add(c.status);
        if (c.kind === 'any') c.of.forEach(check);
      };
      wait.objectives?.forEach((o) => o.when.forEach(check));
      if (!['won', 'lost', 'withdrawn'].every((s) => outcomes.has(s))) err('battle stage cannot handle every outcome');
    }
    for (const cid of def.campaignIds) {
      const campaign = catalog.campaigns[cid];
      const place = campaign?.hex?.places.find((p) => p.id === def.at);
      if (!campaign || (campaign.hex ? !place || place.kind !== 'landmark' : !campaign.nodes.some((p) => p.id === def.at) || campaign.towns.some((t) => t.id === def.at))) err(`site must be a landmark in ${cid}`);
    }
  }
  return errors;
}
