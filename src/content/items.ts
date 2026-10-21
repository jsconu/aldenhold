export interface ItemDefinition {
  id: string;
  name: string;
  kind: 'relic' | 'equipment' | 'consumable' | 'evidence';
  description: string;
  rules: string;
  source: string;
  value: number;
  transfer: 'campaign' | 'hero' | 'tradable';
  questIds: string[];
  /** What you may do with it. Relics and evidence can never be sold (content validation enforces it). */
  policy: { sell: boolean; discard: boolean };
  /** Consumables only: when it can be used, on whom, and what it restores. One is used per use. */
  use?: { phase: 'campaign'; target: 'hero'; hp?: number; mana?: number };
}

/** Definitions are data, not hard-coded UI behavior; campaign state owns the actual inventory. */
export const ITEMS: Record<string, ItemDefinition> = {
  'fenwick-charter': {
    id: 'fenwick-charter',
    name: 'Sealed Fenwick Charter',
    kind: 'evidence',
    description: 'The council\'s oath of peaceful passage under Aldenhold protection.',
    rules: 'While Fenwick remains neutral and allied, your army may traverse it without fighting its garrison. No tax revenue is received.',
    source: 'Q00',
    value: 0,
    transfer: 'campaign',
    questIds: ['Q00'],
    policy: { sell: false, discard: false },
  },
  'woodland-charter': {
    id: 'woodland-charter',
    name: 'Woodland Charter',
    kind: 'evidence',
    description: 'Greenveil\'s grant of friendship, sealed with a green wax oak leaf.',
    rules: 'While Greenveil remains free and allied, you may raise Woodland Archers there and your armies may pass through the town. No tax revenue is received.',
    source: 'Q04',
    value: 0,
    transfer: 'campaign',
    questIds: ['Q04'],
    policy: { sell: false, discard: false },
  },
  'healing-draught': {
    id: 'healing-draught',
    name: 'Healing Draught',
    kind: 'consumable',
    description: 'A stoppered flask of bitter green cordial from the Hillcrest brothers.',
    rules: 'Between battles, a hero who drinks it recovers up to 12 HP, never above their maximum. One flask per use.',
    source: 'Q03 Beneath the Old Tower; Q05 The Missing Caravan',
    value: 40,
    transfer: 'tradable',
    questIds: ['Q03', 'Q05'],
    policy: { sell: true, discard: true },
    use: { phase: 'campaign', target: 'hero', hp: 12 },
  },
  'mana-draught': {
    id: 'mana-draught',
    name: 'Mana Draught',
    kind: 'consumable',
    description: 'A faintly glowing blue tincture that tastes of cold iron.',
    rules: 'Between battles, a spellcaster who drinks it recovers up to 6 mana, never above their maximum. One flask per use.',
    source: 'Quest rewards (from the Western chapter quests)',
    value: 50,
    transfer: 'tradable',
    questIds: [],
    policy: { sell: true, discard: true },
    use: { phase: 'campaign', target: 'hero', mana: 6 },
  },
};
