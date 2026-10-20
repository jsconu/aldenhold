import type { CampaignDefinition } from '../../game/types';

/**
 * The original nine-location valley. Kept as the quick-play scenario and as a regression fixture (BASE-03):
 * saves from it must keep loading, so change it only with a new `revision` and a save migration.
 */
export const VALLEY_QUICKPLAY: CampaignDefinition = {
  id: 'valley-quickplay',
  revision: 1,
  name: 'The Valley (quick play)',
  intro: 'Your father is dead and Aldenhold is yours. Orcs raid the valley from Gharzak Hold. Bring the free towns under your banner and break the Hold.',
  capital: 'aldenhold',
  lair: 'gharzak',
  startingGold: 300,
  lordName: 'Aldric',
  nodes: [
    { id: 'aldenhold', name: 'Aldenhold', x: 90, y: 270 },
    { id: 'fenwick', name: 'Fenwick', x: 220, y: 120 },
    { id: 'millbrook', name: 'Millbrook', x: 230, y: 410 },
    { id: 'bridge', name: 'Stone Bridge', x: 360, y: 270 },
    { id: 'harrowgate', name: 'Harrowgate', x: 480, y: 110 },
    { id: 'duskwater', name: 'Duskwater', x: 490, y: 420 },
    { id: 'pass', name: 'Grey Pass', x: 610, y: 240 },
    { id: 'watchtower', name: 'Old Watchtower', x: 650, y: 440 },
    { id: 'gharzak', name: 'Gharzak Hold', x: 760, y: 300 },
  ],
  edges: [
    ['aldenhold', 'fenwick'],
    ['aldenhold', 'millbrook'],
    ['aldenhold', 'bridge'],
    ['fenwick', 'bridge'],
    ['millbrook', 'bridge'],
    ['fenwick', 'harrowgate'],
    ['bridge', 'harrowgate'],
    ['bridge', 'duskwater'],
    ['millbrook', 'duskwater'],
    ['harrowgate', 'pass'],
    ['duskwater', 'pass'],
    ['duskwater', 'watchtower'],
    ['watchtower', 'gharzak'],
    ['pass', 'gharzak'],
  ],
  towns: [
    { id: 'aldenhold', owner: 'player', pop: 3000, tax: 20, kind: 'capital' },
    { id: 'millbrook', owner: 'player', pop: 1600, tax: 20, kind: 'town' },
    { id: 'fenwick', owner: 'neutral', pop: 1400, tax: 15, kind: 'town' },
    { id: 'harrowgate', owner: 'neutral', pop: 2200, tax: 15, kind: 'town' },
    { id: 'duskwater', owner: 'neutral', pop: 1800, tax: 15, kind: 'town' },
    { id: 'gharzak', owner: 'orcs', pop: 0, tax: 0, kind: 'lair' },
  ],
  armies: [
    { owner: 'player', at: 'aldenhold', troops: [{ type: 'lord', name: 'Aldric' }, 'militia', 'militia', 'spearmen', 'archers'] },
    { owner: 'player', at: 'millbrook', troops: ['militia'] },
    { owner: 'neutral', at: 'fenwick', troops: ['militia'] },
    { owner: 'neutral', at: 'harrowgate', troops: ['militia', 'militia'] },
    { owner: 'neutral', at: 'duskwater', troops: ['militia', 'archers'] },
    { owner: 'orcs', at: 'gharzak', troops: [{ type: 'warchief', name: 'Gorrash' }, { type: 'shaman', name: 'Murg' }, 'warband', 'warband', 'warband', 'orcArchers', 'troll'] },
    { owner: 'orcs', at: 'pass', troops: ['warband', 'warband'] },
  ],
  // A priest waits in the capital at the start, so new players meet hiring early.
  offers: [{ town: 'aldenhold', type: 'priest', name: 'Brother Osric', expires: 4 }],
};
