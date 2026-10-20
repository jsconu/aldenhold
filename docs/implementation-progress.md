# Implementation progress

Source of scope: [Approved completion requirements](completion-requirements.md).

## Foundation increment 1

This is the first slice of milestone A, not completion of the full foundation or campaign.

| Requirement | This increment | Remaining work |
| --- | --- | --- |
| BASE-01 / BAT-01 | Every formation has a battle record; first 27 per side deploy, overflow is explicitly listed as reserve. Reserves cannot fight, cast, be targeted, or earn XP. They follow the army on retreat and share pursuit attrition or dispersal. | Player deployment selection and optional reinforcement waves. |
| BASE-02 | Persistent ending reason; capital loss, then lord death, take precedence over conquest. Correct defeat banner. | Full campaign victory objectives and epilogues. |
| SAVE-01 | Schema v3 identifies the nine-node quick-play campaign and revision. Validated v2 migration preserves original storage and reconstructs omitted overflow troops in active battles without rerolling combat. | Expanded content schemas and further versioned migrations. |
| SAVE-02 (partial) | JSON export/import; validation before state replacement; visible storage warnings; corrupt saves remain untouched until explicit replacement. | Three manual slots, rotating autosaves, pre-choice snapshots. |

The reserve policy is deliberately explicit for this first slice: there are no mid-battle reinforcements. A side loses when its fielded force is defeated even if it has reserves. Unfielded soldiers suffer no battle casualties, but lose the ordinary 10% pursuit attrition on retreat (minimum one survivor); cut-off armies scatter under the existing rule, with the lord's escape rule unchanged.

## Validation

- 77 rules/regression tests pass, including all 46 original tests.
- Production build includes TypeScript validation.
- Compiled-app DOM smoke check passes: autosave, export controls, valid/invalid imports, reload, corrupt-save protection, explicit reset, and quota warning.
- Real-browser visual/download verification remains outstanding: the Chromium download failed in this environment. The DOM smoke check is not a substitute for that browser check.
- Tests cover 27/28/60 formations per side, reserve combat exclusion and retreat, simultaneous final conquest and ruler death, legacy save reconstruction, deterministic battle resume, malformed imports, storage failure, and five seeded campaigns over up to 36 months.

## Foundation increment 2: content catalog and journal

| Requirement | This increment | Remaining work |
| --- | --- | --- |
| BASE-03 | Static content moved out of `data.ts` into `src/content`: `rules.ts` (units, spells, battlefield terrain, hero roster) and `campaigns/valleyQuickplay.ts` (the nine-node world as a `CampaignDefinition`). `CATALOG` and `getCampaign()` in `src/content/index.ts`. `newGame(seed, campaignId)` builds from the catalog; capital and lair come from `campaignOf(state)`. `data.ts` is now a thin compatibility re-export. | Catalogs for regions, factions, items, quests, events, encounters and assets (DATA-01) as those systems arrive. Remove the `data.ts` shim once callers read the catalog directly. |
| DATA-02 (partial) | `validateContent()` rejects duplicate IDs, unresolved references (roads, towns, armies, unit types, spells, hireable heroes, offers), off-map coordinates, locations unreachable from the capital, a missing or duplicate starting lord, and a broken capital or lair. Runs in tests and on dev startup. | Missing assets, prerequisite cycles, reward loops and quest-level satisfiability once quests and assets exist. |
| BASE-04 | Permanent, structured `journal` of deeds (id, month, kind, text, place) alongside the bounded 60-line chronicle. Records the campaign start, captures, town losses, player battles, heroes joining, levelling up or dying, scattered armies, desertion and the ending (once). Journal screen from the header: tallies and entries by year, with links to places on the map. | Quest entries, current goal and known leads (CAM-01, QUEST-03) once the quest engine exists. |
| SAVE-01 | Schema v4 adds the journal. v3 saves migrate by turning their surviving chronicle lines into "earlier" entries with their months; v2 saves migrate through v3. The storage key is unchanged. Validation now checks against the save's own campaign definition and checks every journal entry. | Further versioned migrations as content schemas grow. |

### Validation

- 94 tests pass: 77 existing, 8 content-catalog and validator tests, and 9 journal tests (recording, permanence beyond the chronicle cap, ending recorded once, save round trip, v3 migration, rejection of bad entries).
- Production build passes.
- Checked in the browser: a real v3 save from an earlier session loaded as v4 with its six chronicle lines kept as "earlier" entries. The journal screen and map toggle work, and the game keeps autosaving as v4.

## Next increments

1. ~~Extract the quick-play world into a content catalog; add content reference validation and a permanent campaign journal (BASE-03 / BASE-04).~~ Done in foundation increment 2.
2. Introduce faction/treaty and item state plus one complete quest whose reward and treaty change occur exactly once across reload (milestone A acceptance).
3. Implement the richer city economy with a reconciled monthly ledger before production chains, trade and governors.
4. Add level-based equipment/refits, then the 14-spell mage progression with tactical AI and save migrations.
5. Build out the authored campaign and art pipeline; prototype the agreed procedural frontier after the campaign foundations are stable.
6. Owner request (October 20 2026): bring back the parked hex overland map (`overland-map-wip`) as a second catalog campaign with more terrain variety and pixel-art tiles in the spirit of the original's overland view. Quick-play saves must stay valid.
