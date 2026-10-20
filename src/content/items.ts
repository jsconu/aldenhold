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
  },
};
