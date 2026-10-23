import type { QuestDefinition, QuestResolution } from '../game/types';

const dispersed: QuestResolution = { status: 'superseded', effects: [], journal: 'The coastal council dispersed after its town fell. The coast remains open to exploration and conquest.' };

export const REED_COMPACT: QuestDefinition = {
  id: 'R01', campaignIds: ['western-realm'], kind: 'side', scope: 'regional', name: 'The Reed Coast Compact',
  giver: 'Speaker Mara of Reedhaven', at: 'reedhaven', needsEnvoy: false, survivesConquest: true,
  summary: 'A regional journey: reopen Willowford’s crossing, settle the Miretooth tolls and bring a compact to Brineport. Diplomacy or a causeway battle can unite the coast without conquering its free towns.',
  prerequisites: [{ kind: 'quest', quest: 'M01', status: 'succeeded' }],
  stages: [
    { id: 'invitation', text: 'The road beyond Redford reaches the Reed Coast. Five towns need safe crossings and an end to the troll tolls. There is no deadline: prepare supplies and an escort before setting out.', choices: [
      { id: 'accept', label: 'Meet the speaker at Reedhaven and take the compact east', needs: [{ kind: 'army-near', place: 'reedhaven' }], then: { stage: 'crossing' } },
    ] },
    { id: 'crossing', text: 'Go east from Redford through the Reed Coast Approach to Willowford. Its ferrymaster asks for 120 gold to repair boats and store rope. You can speak from a neighboring hex; the free garrison need not be attacked.', choices: [
      { id: 'repair', label: 'At Willowford: fund the crossing repairs (120 gold)', gold: 120, needs: [{ kind: 'army-near', place: 'willowford' }], then: { stage: 'tolls' } },
    ] },
    { id: 'tolls', text: 'Miretooth’s marsh clan demands a final 160-gold settlement to abandon the toll posts. Negotiate beside Miretooth, or take your army to the Drowned Causeway and defeat the two troll enforcers. Ordinary soldiers may join this battle.', choices: [
      { id: 'settle', label: 'At Miretooth: buy out the toll claim (160 gold)', gold: 160, needs: [{ kind: 'army-near', place: 'miretooth' }], then: { stage: 'harbor' } },
      { id: 'fight', label: 'At the Drowned Causeway: challenge the toll enforcers', then: { encounter: { site: 'reedden', owner: 'trolls', troops: ['troll', 'troll'], win: { stage: 'harbor' }, lose: { stage: 'tolls' } } } },
    ] },
    { id: 'harbor', text: 'The crossings are funded and the toll claim is settled. Take the coast road to Brineport. Its council will supply the beacon and recognize a compact for all five free towns. The compact grants passage, while the towns keep their taxes and garrisons.', choices: [
      { id: 'sign', label: 'At Brineport: supply the beacon and sign the compact (100 gold)', gold: 100, needs: [{ kind: 'army-near', place: 'brineport' }], then: {
        status: 'succeeded', effects: [
          ...['willowford', 'miretooth', 'reedspire', 'brineport', 'gullmere'].map(town => ({ kind: 'treaty' as const, town, relation: 'ally' as const, passage: true })),
          { kind: 'flag', flag: 'reed-coast-compact' }, { kind: 'gold', amount: 200 },
        ], journal: 'Signed the Reed Coast Compact: Willowford, Miretooth, Reedspire, Brineport and Gullmere grant allied passage. The council contributes 200 gold; its towns retain self-rule.',
      } },
    ] },
  ], onLocationLost: dispersed,
};

export const REED_CENSUS: QuestDefinition = {
  id: 'Q40', campaignIds: ['western-realm'], kind: 'side', name: 'The Reed Census', giver: 'Reedspire’s census keeper', at: 'reedspire',
  summary: 'Flood-displaced families are missing from the grain rolls. Examine the records before deciding how to restore their places.',
  prerequisites: [{ kind: 'army-near', place: 'reedspire' }], needsEnvoy: true, survivesConquest: true,
  stages: [
    { id: 'records', text: 'The grain rolls list houses, while the ferry register lists families. Several families shelter in the old sail loft. Counting houses alone left them without a grain allowance.', choices: [
      { id: 'inspect', label: 'Compare the ferry register with the grain rolls', then: { stage: 'decision' } },
    ] },
    { id: 'decision', text: 'The registers confirm 180 displaced residents. An 80-gold grant will restore their homes and grain places. Recognizing them strengthens the town’s future workforce and army support if you later rule it.', choices: [
      { id: 'restore', label: 'Restore the families to the rolls (80 gold)', gold: 80, then: { status: 'succeeded', effects: [{ kind: 'population', town: 'reedspire', amount: 180 }, { kind: 'flag', flag: 'reed-census-restored' }], journal: 'Restored 180 displaced people to Reedspire’s census and funded their return. The town’s population and future workforce grow.' } },
      { id: 'decline', label: 'Leave the allocation unchanged', then: { status: 'failed', effects: [], journal: 'Left Reedspire’s grain rolls unchanged. The displaced families remain uncounted.' } },
    ] },
  ], onLocationLost: dispersed,
};

export const SWAN_BANNER: QuestDefinition = {
  id: 'Q44', campaignIds: ['western-realm'], kind: 'side', name: 'The Swan Banner', giver: 'Gullmere’s watch captain', at: 'gullmere',
  summary: 'Gullmere has lost the code used by the Brineport Beacon. Visit the beacon and bring back the correct signal so the watch can recognize friendly ships.',
  prerequisites: [{ kind: 'army-near', place: 'gullmere' }], needsEnvoy: false, survivesConquest: true,
  stages: [
    { id: 'request', text: 'The watch captain asks for the old signal code. A painted board at the Brineport Beacon still records it. The captain will wait while your army makes the journey.', choices: [
      { id: 'accept', label: 'At Gullmere: offer to recover the signal code', needs: [{ kind: 'army-near', place: 'gullmere' }], then: { stage: 'beacon' } },
    ] },
    { id: 'beacon', text: 'Travel south to the Brineport Beacon. Its board reads: “Blue below, white above; a white swan marks a friendly sail.” No battle is required.', choices: [
      { id: 'read', label: 'At the beacon: copy the signal board', needs: [{ kind: 'army-at', place: 'reedbeacon' }], then: { stage: 'return' } },
    ] },
    { id: 'return', text: 'Return to Gullmere with the signal: a white swan above a blue field. Correct signals let its captain open the road to your troops.', choices: [
      { id: 'report', label: 'At Gullmere: restore the white-swan signal', needs: [{ kind: 'army-near', place: 'gullmere' }], then: { status: 'succeeded', effects: [{ kind: 'treaty', town: 'gullmere', relation: 'ally', passage: true }, { kind: 'gold', amount: 120 }, { kind: 'flag', flag: 'swan-banner-restored' }], journal: 'Restored Gullmere’s swan signal. Its grateful watch grants allied passage and 120 gold.' } },
    ] },
  ], onLocationLost: dispersed,
};
