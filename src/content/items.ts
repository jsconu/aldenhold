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
  /**
   * Equipment only: the hero slot it fills and what it adds while carried. `heroes` limits it to some hero types
   * (a class heirloom); otherwise any hero may carry it.
   */
  equip?: { slot: 'weapon' | 'armor' | 'accessory'; attack?: number; defense?: number; leadership?: number; heroes?: string[] };
  /** Consumables only: when it can be used, on whom, and what it restores. One is used per use. */
  use?: { phase: 'campaign'; target: 'hero'; hp?: number; mana?: number };
}

/** Definitions are data, not hard-coded UI behavior; campaign state owns the actual inventory. */
export const ITEMS: Record<string, ItemDefinition> = {
  'keepers-signet': {id:'keepers-signet',name:'Keeper’s Signet',kind:'equipment',description:'A silver oath-ring earned beneath the Royal Barrow.',rules:'Your ruler: +4 leadership while equipped in the accessory slot.',source:'H01 The Oath Beneath the Hill',value:0,transfer:'hero',questIds:['H01'],policy:{sell:false,discard:false},equip:{slot:'accessory',leadership:4,heroes:['lord']}},
  'hillcrest-medallion': {id:'hillcrest-medallion',name:'Hillcrest Medallion',kind:'equipment',description:'A bronze medallion earned by serving in Hillcrest’s infirmary.',rules:'Your ruler: +1 defense and +2 leadership while equipped in the accessory slot.',source:'H02 The Silent Infirmary',value:0,transfer:'hero',questIds:['H02'],policy:{sell:false,discard:false},equip:{slot:'accessory',defense:1,leadership:2,heroes:['lord']}},
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
  oathlance: {
    id: 'oathlance',
    name: 'Oathlance',
    kind: 'equipment',
    description: 'The lance your father carried when Aldenhold first swore to your house. The council returns it when they swear to you.',
    rules: 'Your lord only: +2 attack and +5 leadership. A family heirloom: it cannot be sold, thrown away or lost on the field.',
    source: 'M01 The Inheritance',
    value: 0,
    transfer: 'hero',
    questIds: ['M01'],
    policy: { sell: false, discard: false },
    equip: { slot: 'weapon', attack: 2, leadership: 5, heroes: ['lord'] },
  },
  'old-watch-shield': {
    id: 'old-watch-shield',
    name: 'Shield of the Old Watch',
    kind: 'equipment',
    description: 'A tall iron-rimmed shield from the vault beneath the Old Watchtower, still bearing the watch\'s eye.',
    rules: 'Any hero: +2 defense.',
    source: 'Q03 Beneath the Old Tower',
    value: 120,
    transfer: 'hero',
    questIds: ['Q03'],
    policy: { sell: true, discard: true },
    equip: { slot: 'armor', defense: 2 },
  },
  'hobbs-ledger': {
    id: 'hobbs-ledger',
    name: 'Hobb\'s Grain Ledger',
    kind: 'evidence',
    description: 'The Millbrook miller\'s own accounts, in a cramped and guilty hand.',
    rules: 'Evidence in the trial of Hobb the miller (Q06). Kept on record once the court has seen it.',
    source: 'Q06',
    value: 0,
    transfer: 'campaign',
    questIds: ['Q06'],
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
    questIds: ['Q03', 'Q05', 'H02'],
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
