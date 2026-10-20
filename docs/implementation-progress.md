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


## Art increment: original pixel unit sprites

- ART-01 revised to EGA-inspired pixel art. All 13 prototype unit types now render with original 16×16 figures, team-coloured details and bases, mirrored defenders and a gold hero rim.
- ART-03 (partial): retain hero marker, morale, HP, running status, selection, spell and attack outlines.
- ART-08 (partial): infantry, knights, monsters, heroes and orcs share the same tactical rendering pipeline.
- `src/ui/pixelSprites.test.ts` validates coverage, sprite dimensions, palette symbols and team differentiation.
- Remaining: terrain tile atlas, overland hex art, city views, portraits, animations and new archetypes.
- The hex overland map must remain a separate catalog campaign; do not change the existing quick-play topology or invalidate older saves.

## Foundation increment 3: diplomatic quest and saved campaign items (branch work/fenwick-charter-v1)

- New v5 schema stores quest resolution state, unique campaign inventory objects and location-scoped treaties; v2, v3 and v4 saves migrate safely to v5. Save storage keys are unchanged.
- Q00 **The Fenwick Charter** is a separate **foundation fixture**, not one of the planned eighteen side quests. A council decision can sign a peaceful-passage treaty and award a sealed charter, or reject the accord. Neither choice can be repeated.
- Signing allows player armies to coexist with the neutral garrison in Fenwick without a battle or annexation. Other neutral settlements remain unaffected. The treaty ends if the settlement changes hands.
- The journal displays quest outcome and campaign-held inventory. Rewards are state-based and are not created again on reload.
- Q04 **The Woodland Accord** remains unfinished: it requires Greenveil, city logging actions and enforced logging caps in the western campaign. Do not represent Q00 as completion of Q04.
- Still remaining for full milestone A: general quest prereqs/deadlines/event scheduling, broader faction registry, item ownership/equipment/consumption, validated content cross-references, and real-browser verification.


## Economy increment 1: reconciled monthly treasury

- Schema v6 adds a per-month cash ledger and preserves the original save storage key. Earlier save versions migrate with **no invented financial history**, starting the new ledger at the imported balance.
- Town taxes, army payroll, troop recruitment and hero-hiring payments receive signed entries with originating action IDs, location and counterparty.
- The monthly treasury view shows cash on hand, in-month purchases, cash receipts, cash payments, unpaid army payroll, and expandable history (12 most recent months shown).
- When the realm cannot pay its troops, unpaid wages appear as a non-cash shortfall. Desertion and clamping the treasury to zero retain earlier gameplay behavior.
- Each recorded month must satisfy opening cash + signed entries = closing cash. Save validation rejects inconsistent balances, invalid totals and duplicated transaction identifiers.
- Future scope remains: city building costs, farm/mine upgrades, commodities, market prices, transfers, seasonal production, trade and governors. This increment is **not** the full ECO-01–ECO-18 economy.


## Economy increment 2: invest in towns and produce local goods

- Schema v7 adds per-town levels for Farms, Lumber Camps, Ore Mines, Tool Forges; food, timber, ore and tools stockpiles; one construction project per city; a latest-month production report.
- Towns initially operate a free inherited farm; the first 3 development sites are available for distinct facilities. Each family has two tiers, local endowment requirements, construction gold/material quotes, recurring maintenance and workforce needs. Starting economic capacity preserves the old quick-play tax/upkeep balance.
- Construction costs are paid/reserved as a real treasury debit plus actual local goods consumed exactly once at start. Work completes at the end of the month **after** production, so no same-month output or repeated charge. No cancellation/recovery yet.
- Monthly production uses a fixed 45% workforce from actual population, deterministic staffing allocation and *beginning-of-phase materials* for input recipes. Farms produce food, lumber camps timber, mines ore, and tool forges consume existing timber+ore to make tools. Newly mined ore cannot feed a forge until the following month.
- Towns consume food proportional to population. Food shortfalls are visible in city reports and reduce growth gradually, not through sudden city destruction. Buildings and stockpiles survive conquest.
- Recurring city maintenance is a cash operating expense with a separate unpaid-maintenance line. Army desertion still triggers only on unpaid military wages; public resource production is **not** automatically treasury revenue.
- Save v2–v6 migration retains the old cash ledger (with historical maintenance defaulted to zero) and seeds new stockpiles at the migration date without fabricating old city history.
- Deferred: all 10 planned goods; specialized worker classes; 18 building families; sites unlocked to 6; construction queue/cancellation; durable degradation; commerce/trade; market prices; governors; private balances; external suppliers; fully distributed inputs and goods.


## Veterans increment: real equipment refits

- Schema v8 adds per-formation loadouts and in-progress, paid refit orders; earlier saves and battles migrate to default gear with no retroactive purchase or XP rewrite. Troop levels now display 1–10 using the existing XP progression (zero XP is level 1; XP 8 is level 5). Existing attack bonuses are conserved.
- Arches: Short Bow (default), Long Bow (requires level 3), Compound Bow (requires level 5 and Tool Forge). Compound bow grants 50% missile attack multiplier and +2 range, at a substantial gold/material/maintenance cost.
- Armor: Leather (default), Chain (level 2), Plate (level 3). Plate adds +3 defense and higher upkeep, cannot be equipped by archers, and requires a local Tool Forge, tools and ore.
- Refits charge once for the formation's **surviving headcount**, consume real town materials, stop its movement this month, and only update equipment after the monthly phase. Defending battles while the order is pending use the old gear; save/reload neither repeats purchases nor accelerates refits.
- UI shows level requirements, before/after equipment modifiers, material prices, and reasons unavailable options are disabled. Battlefield attack/range/defense and army payroll use actual equipped gear.
- Remaining EQUIP scope: complete 22-piece equipment tree, icon overlays, city armories/stables, squad reinforcements, equipment salvage and condition, training, explicit refit queues, and independent battle effects for piercing damage. This is an incremental implementation, not the complete 1–10 equipment release.


## Overland atlas increment (October 20, 2026)

- Replaced the empty nine-node route diagram with an original SVG overland atlas: 43×22 small rendered hex tiles, visible farmland/forests/hills/mountains/rivers/wetlands, miniature castles, cities, watchtowers, passes and Stone Bridge; painted regional labels, compass, location plates, army counts and highlighted routes.
- Geography uses deterministic, reproducible authored zones plus fixed coordinate noise; it is deliberately **not** rerolled with a campaign seed and is NOT persisted in saves. Road corridors are carved visually through river and mountain art to keep every existing graph connection legible.
- Players can switch between Terrain and Realm Borders (political influence) views, zoom 100–200% centered on the currently selected named location and interact with SVG markers by mouse or keyboard. Sidebar road destinations expose adjacent town ownership, known garrisons and whether an immediate march is available.
- Optional journey planner computes the shortest graph itinerary or a danger-averse alternative, marks numbered stops on the atlas, estimates minimum travel months and warns of known garrisons. It does **not** auto-execute later legs or alter actual move rules; first-leg movement uses the existing movement validator.
- This increment deliberately keeps the original nine-node quick-play map, towns, edges, combat and schema v8 untouched. The hex tiles underneath are **visual geography only**, not selectable movement cells.
- Remaining for MAP-01–05: a separate authored ~64×40-cell campaign, real terrain-cost pathfinding and river/bridge constraints, persistent fog of war and exploration, scouting, hazards/visibility, a larger atlas with twenty cities and objective sites, visual browser approval, and responsive pan/touch exploration.
