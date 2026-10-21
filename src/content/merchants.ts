/**
 * Traders who set up shop because of how a quest ended (QUEST-08: rescued traders reappear in a city). A merchant
 * is open on the terms of the first outcome flag that is set; with none of them set, it shows `closed` if one of
 * the `closedBy` flags is set, and nothing at all otherwise.
 */
export interface MerchantDefinition {
  id: string;
  name: string;
  /** Town where the stall stands. It trades while the town is not in orc hands. */
  at: string;
  /** The quest whose outcome decides the stall. */
  quest: string;
  /** Outcome flags that open the stall, and the price multiplier each brings. */
  terms: { flag: string; markup: number; note: string }[];
  closedBy: { flag: string; note: string }[];
  /** What the stall can sell, and how many of each per month. */
  stock: { item: string; perMonth: number }[];
}

export const MERRA: MerchantDefinition = {
  id: 'merra',
  name: 'Merra’s stall',
  at: 'fenwick',
  quest: 'Q05',
  terms: [
    { flag: 'caravan-rescued', markup: 1, note: 'Merra trades with you at cost, in thanks for her drivers and wagons.' },
    { flag: 'caravan-ransomed', markup: 1.5, note: 'Merra is rebuilding what the goblins took, and charges half again for it.' },
  ],
  closedBy: [{ flag: 'caravan-lost', note: 'Merra’s stall stands empty. Her caravan never came home.' }],
  stock: [
    { item: 'healing-draught', perMonth: 2 },
    { item: 'mana-draught', perMonth: 1 },
  ],
};

export const MERCHANTS: Record<string, MerchantDefinition> = { [MERRA.id]: MERRA };
