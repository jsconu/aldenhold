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
- Q00 **The Fenwick Charter** is a separate **foundation fixture**, not one of the planned 72 side quests. A council decision can sign a peaceful-passage treaty and award a sealed charter, or reject the accord. Neither choice can be repeated.
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
- Remaining for MAP-01–05: a separate authored ~128×80-cell campaign across eight regions, real terrain-cost pathfinding and river/bridge constraints, persistent fog of war and exploration, scouting, hazards/visibility, a larger atlas with 48 cities and at least 60 non-city sites, visual browser approval, and responsive pan/touch exploration.


## Magic increment: fourteen-spell mage progression

- Mage and shaman spellbooks now unlock exactly 14 spells through levels 1–9; level 10 reduces costs by one (minimum two). Priests retain Heal/Rally; their expanded list and ranger spells remain in issue #16.
- Ward, Frost, Haste, Slow and Entangle have bounded target-side turn durations, visible status descriptions, refresh without stacking, and Dispel/counter-spell rules. Effects change actual movement, defense and damage.
- Lightning/Chain Lightning trace line of sight through hexes; rocks block them. Spell damage uses explicit armor/resistance rules; Disintegrate is capped against heroes. Chain Lightning cannot hit one formation twice.
- Player targeting previews damage, affected formations, friendly fire, status changes and wall destruction before confirmation. Teleport requires selecting a friendly formation and a legal destination; it spends movement without restoring an attack.
- Tactical AI and auto-resolve score the same legal previews, penalize friendly fire and use support/cleanse spells as well as damage spells.
- Schema v9 stores in-battle effects. v2–v8 imports migrate without retroactive effects, mana, equipment or economic changes. Storage keys remain stable.
- Validation: 185 rules/regression tests and the production build pass. Compiled-app DOM checks cover spell selection, preview/confirmation, two-stage Teleport and active-effect reload. Visual browser verification and campaign-scale balance playtests remain outstanding.

## Expanded campaign scope revision

The owner requested a substantially longer authored story before infinite continuation. [Expanded campaign specification](expanded-campaign.md) now governs scope: 48 fixed cities, 72 side quests, 24 main objectives in six acts, 60 non-city sites, 30 authored surprise battles, eight regions and an initial 128×80 real-hex design canvas. Story completion must preserve the same empire/save when opening the procedural frontier. The proposed 40–60-hour main story and 70–100-hour broad exploration ranges require playtesting.

These are requirements and backlog entries, not implemented campaign content. The nine-node quick-play world and its ending are unchanged. [Backlog](backlog.md) links the staged quest framework, true hex movement, first western chapter and later frontier work. Earlier milestone tables and completed-increment counts above are historical records; the revised specification supersedes their campaign totals.

- Remaining for MAP-01–05: a separate authored ~64×40-cell campaign, real terrain-cost pathfinding and river/bridge constraints, persistent fog of war and exploration, scouting, hazards/visibility, a larger atlas with twenty cities and objective sites, visual browser approval, and responsive pan/touch exploration.

## Walkable hex map increment: the Western Realm (October 20, 2026)

Second catalog campaign alongside the quick-play valley, which stays a regression fixture with unchanged movement, orc behaviour, atlas and route planner.

| Requirement | This increment | Remaining work |
| --- | --- | --- |
| MAP-01 (partial) | `content/campaigns/westernRealm.ts`: an authored 40×28 hex map (ASCII rows, one land per hex) with the Aldwater river, Mirrormere lake, southern wetlands, a central mountain spine broken only at Grey Pass and the southern trail, and orc badlands. Eight towns (Aldenhold, Fenwick, Millbrook, Greenveil, Harrowgate, Westmere, Duskwater, Reedhaven), Gharzak Hold, and nine named landmarks. | Grow toward the planned ~64×40 map with twenty settlements. |
| MAP-03 | Hex-by-hex movement with movement points per troop and month (infantry 12, knights 18, trolls 9, lord 14); the slowest chosen troop sets the pace. Roads cost 1; plains/farmland 2; forest, hills, badlands 3; deep woods, swamp 4. Rivers are crossed only at bridges and mountains only at the two gaps. A march stops at the first enemy or unowned town. Hovering a hex shows its cost, whether it is reachable this month, and roughly how many months away it is. | Known hazards on the route preview; forced march. |
| MAP-05 (partial) | `validateContent` checks hex maps: row widths, known land, place positions and passability, that every road can be laid, and that every named place is reachable from the capital. Tests prove the river can only be crossed at a bridge. | Fog-aware reachability once fog exists. |
| Battles | Battlefields take after the land they're fought on (forest fields wooded, hills rocky, swamp marshy). Open plains keep the old stream odds, so valley battles generate exactly as before. | |
| ART-01 | Pixel-art overland tiles (`ui/pixelTiles.ts`): 24×20 interlocking hex tiles in an EGA-style palette, painted once into a bitmap and scaled up crisply, with roads and plank bridges. Pixel town, capital, orc fortress and landmark sprites with owner-coloured flags (`ui/hexMapView.ts`). | Pan and zoom on the hex map; art approval in the UI (ART-08). |
| SAVE-01 | Schema v10 (after the mage-magic v9): each troop's `moved` flag becomes movement points (`mp`). v9 saves migrate: unmoved troops keep their single valley march, moved or refitting troops have none. Validation understands hex locations; ledger cities on a hex map are towns. | |
| Quests | The Fenwick Charter runs in both campaigns (`campaignIds`); its envoy check and journal entries use the town's map location. | |

`game/world.ts` is the single place that knows how a campaign's world is laid out (graph or hex): which town stands at a location, where a town is, neighbours, step costs, roads and pathfinding (binary-heap Dijkstra). Rules call it rather than assuming a location id is a town id.

Validation: all 206 tests pass after rebasing onto the mage-magic increment (including a 36-month Western Realm soak over three seeds, river and bridge constraints, arrival estimates and the v9 → v10 migration); production build passes. Played in the browser: chooser, a march to Fenwick, a battle on farmland, capture, journal, five month-ends with orc raids over the mountains, and the valley still working on the atlas.

## Architecture increment: action quotes (#21)

Every player command now has a quote that returns its cost and a refusal reason (`reason: null` means allowed), following the existing `constructionQuote` / `refitQuote` shape. The command calls its own quote first and refuses with exactly that reason; the UI renders buttons and tooltips from the same quote.

| Command | Quote |
| --- | --- |
| Recruit | `recruitQuote(state, townId, typeId)` → gold, men, reason |
| Hire a hero | `hireQuote(state, offer)` → gold, reason |
| March | `marchQuote(state, from, troopIds, to)` → movement cost, path, marching troops, what the march ends in (battle, capture or nothing), reason |
| Fenwick charter | `charterQuote(state)` → reason (shared by sign and decline) |
| Construction, refits | unchanged (`constructionQuote`, `refitQuote`) |

`arrivalOutcome(state, at)` is now the single rule for "what does a player army run into here"; the march quote and the hex map's red highlight both use it.

Bugs removed by this:
- The recruit button checked only gold, so it stayed enabled when the town had no men to spare and then failed on click.
- The hex map's "march ends in a fight" highlight ignored the Fenwick passage treaty, marking an allied Fenwick red.
- The Fenwick envoy-range rule was written twice (quest and panel); it now lives only in `charterQuote`.

Validation: 213 tests pass (7 new quote tests at the quote seam, including both bug cases); build passes; checked in the browser that disabled buttons show the quote's reason.

## Architecture increment: month pipeline (#22)

`advanceMonth(state)` runs the month as one ordered table of named phases (`MONTH_PHASES` in `campaign.ts`) and returns a `MonthReport`; `endTurn` is now a thin wrapper.

| Order | Phase | What it does |
| --- | --- | --- |
| 1 | snapshot | Fix this month's city maintenance on the sites operating before construction finishes |
| 2 | cities | Production, consumption and construction (`advanceCities`) |
| 3 | population | Growth minus food-shortage penalties |
| 4 | heroes | Heroes mend a quarter of their wounds and refill mana |
| 5 | treasury | Taxes, wages and maintenance settle in the ledger |
| 6 | construction | Report finished projects |
| 7 | refits | Finish paid refits |
| 8 | shortages | Report food shortages |
| 9 | desertion | Unpaid soldiers leave (a journal deed) |
| 10 | calendar | The month turns; movement points refill |
| 11 | offers | Hero offers expire or appear |
| 12 | ai | The orcs spawn, raid and march |
| 13 | ending | Victory and defeat check |

Each phase returns its notes (chronicle news, or deeds that also go to the journal); they are written as soon as that phase finishes, so the chronicle stays in time order. The orcs' own battles and captures are still recorded by the rules they trigger.

**Interruption rule:** only the `ai` phase can start a battle, and every economic phase has already run by then, so a month never has to resume halfway and no save change is needed. Battles the AI queues are fought after the month closes; the ending check runs again after each battle, and the month is never re-run.

Validation: 218 tests pass, including 5 new month tests (documented order, notes written in phase order, deeds in the journal, no work during a battle or after the ending, an orc attack fought after the month closes without re-running it, and deterministic reports for a seed). All earlier seeded campaign tests pass unchanged, so month results are identical. Checked in the browser: four month-ends on the Western Realm.

## Quest engine increment (#17, part 1)

Quests are now data (`content/quests.ts`), run by one engine (`game/quests.ts`). The Fenwick Charter is the first quest written this way; the Western chapter's quests will use the same engine.

- **Definitions:** each quest has a giver town, prerequisites (another quest's outcome, a town's owner, a campaign flag, or a month), an envoy rule, staged choices with optional gold costs, and an optional deadline on any stage. It also has a fallback outcome for when its town changes hands.
- **Lifecycle:** unavailable → available → active → succeeded, failed or superseded. A new `quests` month phase (between `offers` and `ai`) unlocks quests whose prerequisites now hold and ends stages whose deadline has passed. Each unlocked quest is announced in the month report.
- **Exactly-once rewards:** effects (treaty, item, gold, campaign flag) apply only in the single transition that resolves a quest, so a reload, a repeated command or a revisit can't award them twice. Quest costs and gold rewards go through the treasury ledger (`quest` and `quest-reward` categories), so months reconcile without balance corrections.
- **Quotes:** `questQuote` and `chooseQuest` follow the quote pattern (#21). Buttons show the quote's reason when a choice is disabled.
- **Save v11:** each quest keeps its stage, the month that stage began, how it ended, and its choice history; the game keeps campaign `flags`. Validation rejects impossible progress and any item, treaty or flag that no resolved quest granted. It also rejects a granted reward that is missing. v10 saves migrate with the charter's outcome and history intact.
- **Content validation:** checks for unknown stages, items, towns outside the quest's campaign, stages with no way to end, prerequisites that require an outcome the quest can never produce, and prerequisite loops.
- **UI:** the town panel shows a card for each quest offered there, the header button jumps to the next open quest, and the journal lists main objectives and side quests with their outcome and a link to the town.

Validation: 228 tests pass, including 10 new engine tests on two-stage fixture quests (unlock, full success across reloads, refusal, deadline failure, location loss, forged and missing rewards, content validation and v10 → v11 migration). Build passes. In the browser I checked the charter card, signing it, the header shortcut and the journal ledger.


## Seamless overland and battle artwork

- Both playable map types hide permanent hex borders. The short valley atlas now blends the underlying land-colour polygons, while terrain motifs remain crisp; its watercourse is drawn as a continuous meandering river beneath roads and site art.
- The Western Realm's real 40×28 hex map still uses its unchanged integer coordinates, map contents, movement costs, fog/hazard rules and click geometry. Its pixel-art painter now diffuses only a narrow band at neighboring terrain seams before overlaying sharp roads and bridges. Tactical reach and selection show soft circular highlights rather than hex-shaped outlines.
- Battlefield painting is separated into soft-edged ground colours, deterministic connected forests/creeks/hill shading, crisp SVG vegetation/ruins and pixel-art formation tokens. Click hitboxes retain exact hex geometry invisibly; reachable and spell-affected cells use round glows. Unit selection/ring indicators are ellipses rather than permanent hex borders.
- Artwork is generated deterministically from the existing world and battle state. No schema migration, world data changes, movement rebalancing, or added copyrighted assets.
- Next art pass still needed: review actual screenshots in a browser; larger hand-authored settlement sprites, forests and mountain slope layering, more organic river/road junctions and tile transition quality at the Western Realm's current native pixel resolution.


## Place art: distinctive Western Realm silhouettes

- Original 34×24 native-pixel miniature illustrations now replace the generic town stamp at Aldenhold, Fenwick, Millbrook, Greenveil, Harrowgate, Westmere, Duskwater, Reedhaven and Gharzak Hold. Stone Bridge has an original arched crossing sprite.
- Site silhouettes use composable hand-authored pixel primitives: keep walls and banners, village rooflines, a working mill's sails, woodland pines, merchant harbor, stilt houses, marsh reeds and the orc citadel's spikes and ember-lit windows.
- Every existing town keeps its ID, ownership and campaign rules. Ownership flags recolor without duplicating entire art assets. Other landmarks and future towns still use the existing generic artwork.
- Added pixel palette/uniqueness/ownership/renderer tests. Remaining: richer multi-tile city panoramas, transition-art blending, 20-city completed campaign art, sprite previews at phone scale and in-browser art direction approval.
