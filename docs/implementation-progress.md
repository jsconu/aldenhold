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
- Q04 **The Woodland Accord** is implemented on the Western Realm (see the Q04 section below). Q00 remains a framework fixture, not one of the planned quests.
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

## Q04 The Woodland Accord (#17, part 2)

The first planned side quest, built on the quest engine. It is Western Realm only.

- **Offer:** from month 3, while Greenveil is free, Greenveil's warden sends an envoy about Aldenhold's logging. Answering needs an army at Greenveil or next to it. The envoy waits four months; silence counts as a refusal.
- **Cap logging:** Greenveil becomes an ally (with passage) and grants the Woodland Charter. The `logging-cap` flag is enforced in `constructionQuote`: no lumber camp anywhere may be upgraded past its first tier, and the button gives the reason. New first-tier camps are still allowed.
- **Pay for the groves (200 g):** the same alliance and charter, with no cap. The payment goes through the treasury ledger.
- **Send the envoy away, or let it time out:** the quest fails and sets `greenveil-rejected` for later quests to use. No woodland archers.
- **Woodland Archers:** a new unit (attack 3, range 5, move 4, 150 g, starts with a long bow) with its own pixel sprite and icon. Units can now name a free town that raises them while allied (`recruit: { ally }`). They're drawn from that town's population and join your army there; the allied town's panel shows an "Allied troops" section. If Greenveil changes hands, the alliance ends and woodland archers can no longer be raised; ordinary archers can.
- **No dead end (QUEST-06):** ordinary archers are still raised in every town you own, so rejecting Greenveil never blocks the army needed for Harrowgate.
- **Bow rules generalized:** `usesBow(type)` (any non-hero missile formation) replaces the hard-coded `archers`/`orcArchers` checks in starting gear, refits, the refit panel and save validation.
- **Quest tracking:** the journal tracks at most three open quests (main objectives first, then the longest-waiting), marked "Tracked". The header shows each as a shortcut that focuses the map on the quest's town.
- **Saves:** quests added to the catalog after a save was made load as locked and unlock the next month if due. This needs no version bump; unknown quest ids are still rejected.
- Also fixed a load-sensitive test from #26 (`mapArtwork.test.ts` ran one `expect` per pixel and could exceed the 5 s timeout under the full parallel run); it now counts mismatches and asserts once.

Not yet: a giver portrait for the quest card. The faction registry and item policies (equipment, consumables, evidence) are part 3.

Validation: 247 tests pass, including 11 new Q04 and tracking tests. They cover the offer and envoy range, cap enforcement across reload, compensation through the ledger, rejection keeping ordinary archers, deadline failure, location loss and conquest, an older save without Q04, and header and panel rendering. Build passes. In the browser I signed the accord, raised Woodland Archers in Greenveil (long bow, joined your army there) and checked the journal's tracked marker.

## Faction registry and item policies (#17, part 3)

**Factions (DIP-01).**
- **Registry:** `content/factions.ts` lists every faction with its name, owner label, troop prefix, kind (player, raiders, free) and banner colour. The map colours, panel labels and battle troop names now read from it. Content validation checks ids, colours, exactly one player faction, and that every campaign town and army has a known owner.
- **Relations:** `relationWith(state, town)` gives one answer for how a town stands toward you: `self`, or its treaty relation, or its faction's default (orcs hostile, free towns neutral). Town panels show it ("Free town · Allied").
- **Passage:** `hasPassage` now also lets vassals with passage through, not only allies. Allied-town recruitment uses the same relation.

**Items (ITEM-01).**
- **Policy data:** each definition carries a `policy` (may it be sold or thrown away) and, for consumables, a `use` (phase, target, HP and mana restored). Behaviour comes from this data, never from names. Content validation enforces it: relics and evidence can never be sold, relics never thrown away, consumables (and only consumables) have a use that restores something, and anything sellable has a value. Quest effects may grant several consumables, never several of anything else, and may only archive evidence.
- **Counted inventory (save v12):** `items` is a record of holdings, `{ qty, spent, archived }`. Saves check conservation: held plus spent must equal what resolved quests granted. They also reject objects spent against their policy (a used-up charter), and archived evidence that no quest archived. v11 inventories migrate one of each.
- **Consumables:** Healing Draught (up to 12 HP) and Mana Draught (up to 6 mana). Use them between battles on one of your heroes, never above the hero's maximum; exactly one is used. The quote refuses a use that would gain nothing, so no flask is wasted. They can be sold at their value through the ledger (new `item-sale` receipt category), or thrown away.
- **Evidence in quests:** a choice can `require` objects you hold, and the button shows "You need the …" until you do. A resolution can `archive` evidence: it stays on record under "Archived evidence" in the journal but can't be presented again.
- **Journal:** the inventory shows counts, kinds, and the actions each object's policy allows (give to a named hero with the exact gain, sell for its price, throw away), each from its quote.

**Not yet:**
- No quest grants the draughts yet; the Western chapter quests (#9) will. Until then they are reachable only in tests.
- Hero equipment slots, item transfer between heroes, and battle-phase consumables are ITEM-02 (P1) and later.
- Treaty terms (tribute, duration) are DIP-02.

Validation: 260 tests pass, including 13 new tests:
- relations and passage (ally, vassal, truce)
- registry labels and content checks
- consumable use (cap at maximum, exactly-once, between battles only, heroes only)
- sale through the ledger with no balance correction
- forged counts and policy-violating spends
- evidence that can't be sold, a choice that requires evidence, archiving on reload
- item content validation and the v11 → v12 migration

The build passes. In the browser I checked that the map banners use the registry colours, the quest shortcut appears, and the inventory renders its actions. The pane was hidden, so there are no screenshots.

## Western chapter, part 9a: the chapter spine (#9)

The Western Realm is now Act I, "The Inheritance". It has four main objectives, and finishing the last one completes the chapter. The remaining chapter work is split into 9b–9e in `docs/backlog.md`.

**Quest engine additions.**
- **Goal conditions:** towns ruled; standing (towns you rule plus allies and vassals); formations in the field; food stored in a city; `any` (one of several). The journal and quest cards show live progress ("Rule or ally with 3 towns (now 2)").
- **Objective rules:** a stage can list goals checked at each month's end, and also when the quest's town changes hands, so taking a town you were told to take completes the quest instead of counting as losing it. The first goal met moves the quest on before any deadline applies. Objectives are recorded in the history and saves validate them.
- **Stage events:** a stage can set events in motion on entry, exactly once. The first is a `spawn`: an orc force appears at a named place, optionally with a `target` town. Raiders with a target march on it while it isn't theirs.
- **Hold-out deadlines:** a deadline can end a stage in success ("Hold until …").
- **Same-month follow-ups:** a quest unlocked by one that just ended is offered in that month's report.
- **Chapter finale:** a campaign can name a finale quest. Finishing it ends the game as a win (`chapter-complete`) with the chapter's own closing entry and banner. On the Western Realm, capturing Gharzak Hold still wins too.

**The objectives.**

| ID | Name | Goal | Reward and notes |
| --- | --- | --- | --- |
| M01 | The Inheritance | Field 7 formations (raise two) | 100 gold |
| M02 | Bread and Law | 120 food in Aldenhold and standing with 3 towns (rule or alliance, so Q00/Q04 count but conquest works too) | 150 gold |
| M03 | The Crossing Dispute | At Westmere: buy the toll charter (250 g, Westmere becomes an ally with passage), or refuse and take the town within six months | Ignoring it fails after six months; failure or loss of Westmere doesn't block the chapter |
| M04 | The First Incursion | Two war bands spawn: Grey Pass → Millbrook (with a troll) and the goblin camp → Aldenhold. Hold for four months | If Millbrook falls, the goal becomes retaking it |

**Validation:** content checks cover objective links and ids, spawn places, units, factions and targets, empty `any`, and prerequisite outcomes and loops through nested conditions. Saves accept the `objective` resolution and validate army targets (orcs only, known towns) and the new ending.

**Not yet (later chapter PRs):** the six new settlements, encounters and Q01–Q03, Q05 and Q06, the heirloom reward after M01, and balance. In seeded runs with passive play, the incursion takes an undefended Millbrook (M04 then asks you to retake it); tuning that is for 9e.

Validation: 272 tests pass, including 12 new chapter tests:
- each objective's success path, and M03's refusal, conquest and timeout branches
- spawns happen exactly once across reload, and raiders route to their target
- holding out completes the chapter; losing Millbrook leads to retaking it
- one seeded run under the real month pipeline (AI and auto-resolved battles), with the save valid every month
- save and content rejections

The build passes. In the browser I raised two militia, ended the month and saw M01 complete and M02 offered the same month, with both goals' progress shown. No console errors.

## Western chapter, part 9c: encounters (#9)

Quest choices can now start authored battles at landmarks. Three side quests use them: Q02, Q03 and Q05.

**Encounters.**
- **Starting:** a choice's `then` can be `{ encounter }`: a site (a town or landmark), the guardian force, and where a win or a loss leads. Your army must stand at the site; the quote says so ("Bring an army to Old Quarry first"). The envoy rule doesn't apply to encounter choices.
- **The fight:** the guardians appear for the battle only and leave afterwards, so they never roam the map or join raids. Nobody falls back or takes the site after an encounter; the quest decides what follows. Losing or retreating takes the `lose` branch (all three quests let you try again).
- **Heroes only:** your hired heroes split off as a party (the council never risks your lord) and rejoin the army when the fight ends.
- **Saves:** a battle carries its encounter (quest, choice, guardian, army, party). Saves check it against the quest's last step and the battle's armies, and accept the result in quest history (`hunt:won`, `hunt:lost`) and the new `encounter` resolution.
- **Quest cards at the site:** cards for open encounters also appear on the landmark's panel, and the button names the battle ("Hunt the cyclops · battle at Old Quarry").
- **New condition:** `army-at` (one of your armies stands at a place) unlocks quests by discovery.
- **Conquest:** `survivesConquest` keeps a quest open when you take its giver's town yourself (a merchant, not a council).

**Monsters:**
- **Cyclops:** has a telegraphed boulder. With no enemy beside it, it takes aim at the biggest formation within 4 hexes, preferring formations to heroes so it can't quietly end your reign. It logs "takes aim at …", and the battle map shows a dashed red ring with a "!" on the target. Next turn it throws (2.5× damage, no strike back) if the target is still in reach; otherwise it gives up the aim.
- **Minotaur and Goblin Skirmishers:** two more monster units. All three have original pixel sprites and icons.

**The quests:**

| ID | Trigger | Choices | Outcome |
| --- | --- | --- | --- |
| Q02 One Eye at the Quarry | Month 4, at court | Hunt the cyclops at the Old Quarry, or divert the workers | Win: 100 g and your ore mines produce 25% more. Divert: they produce 25% less (`yieldFactor` in city production) |
| Q03 Beneath the Old Tower | An army reaches the Old Watchtower | Send hired heroes in against a minotaur (retreat allowed), or leave it | Win: 250 g and a Healing Draught, plus the heroes' battle XP |
| Q05 The Missing Caravan | Month 5, a Fenwick merchant (needs an envoy) | Track the goblins to the Abandoned Mine within 3 months, or pay a 200 g ransom | Rescue: 150 g, two Healing Draughts and `caravan-rescued`. Ransom: `caravan-ransomed`. Timeout: `caravan-lost`. The merchant stays if you take Fenwick |

The Healing Draughts from part 3 can now be earned in play.

**Not yet:**
- Q03's unique shield waits for hero equipment slots (ITEM-02).
- The caravan flags aren't read by a later quest yet.
- Encounter difficulty is for the balance pass (9e).

Validation: 287 tests pass, including 15 new encounter tests:
- each quest's win and its no-fight branches
- retreat and retry, with the guardian removed and the army staying put
- the heroes-only party split and rejoin
- the cyclops aims, throws, gives up when the target moves, and prefers formations
- deadline failure, and conquest by you versus by the orcs
- forged encounters and aims rejected by saves; content checks for sites, sides, units and stage links

The build passes. In the browser I chose "Hunt the cyclops", watched it take aim (marker shown) and throw, auto-resolved to victory, and continued: Q02 succeeded, the quarry flag was set, the guardian was gone, and a save made mid-fight loaded. No console errors.


## Codex: Western map growth (9b) and settlement timing

- Adopted and merged Claude's more complete encounter PR #32 after checks passed; closed the overlapping Codex prototype PR #33. The owner authorized subsequent merges after CI. Codex continued the map-growth area left open in the queue.
- Expanded fixed geography from 40×28 to 52×38 (about 76% more cells), keeping every original terrain cell and named coordinate. Added Oakcross, Bellwater, Thornwatch, Redford, Saltwick and Ironbridge, plus three route landmarks. The Western map now has 12 core regional settlements and three border towns/strongholds.
- New towns have real neutral garrisons, populations and resource endowments. Farms, timber and ore outputs use those endowments; all six have map-panel descriptions. Added roads and a southern river crossing; content validation checks every objective remains reachable.
- Western revision 1 migrates additively to revision 2 with all old assets, treasury/history, investments, equipment, quests, IDs, seed and active battles retained. The six towns/garrisons are outside old bounds. No duplicate additions or historical income are created; schema remains v12.
- Fixed a discovered same-month hold-out bug: M04 no longer declares the west safe immediately before that month's attackers take Millbrook. Hold-out success and campaign victory now wait for monthly AI and pending battles; defeat still has priority.
- Encounter settlement ignores stale completion callbacks, and failed expeditions cannot farm retries/XP repeatedly during the same campaign month.
- 298 tests and production build pass, including preserved terrain/coordinates, bridge connectivity, new-town conquest and tax, paid-refit/construction migration, active cyclops targeting/hero parties, idempotent imports, duplicate battle settlement and deadline-month battle save/resume.
- Remaining: distinct artwork for the new towns, local city quests, visual browser review and chapter balance. See [map growth](western-map-growth.md).


## Codex: seeded chapter playthroughs (9e foundation)

Added a controller using actual player commands and quotes: paid recruitment, farm construction, envoy routing, Fenwick diplomacy, Westmere charter or timeout, full monthly simulation and auto-resolved battles. No resources, ownership or quest outcomes are injected. Monthly and battle checkpoints reload through the strict save importer. Reports include elapsed months, objective completion, cash minimum, bills, food shortages, treasury corrections, battles and casualties.

Forty seeded runs across two policies finish Act I with a living ruler and solvent realm. Charter runs take seven months; ignoring the dispute takes 11–12. The minimum cash is 27 gold; final gold is 400 or 1083–1205. CI adds eight tests covering both policies, repeatability and an honest unfinished result. All 306 tests and the production build pass. See [commands, seed list, results and limits](chapter-playthroughs.md).

No game rules were changed to make the controller succeed. This delivers the automated baseline, not owner balance acceptance: human playthrough, pacing agreement, optional encounters and art remain.


## Codex: paid optional expeditions and fallen quest givers (9e)

The second real-command controller hires the starting priest, funds home defenses and a farm upgrade, and marches three existing formations plus the priest to Fenwick, the mine, quarry and tower. All three optional encounters can be completed without granting troops, XP, gold or ownership. The tower separates the priest from the formations and leaves the lord at home. Shared march/battle helpers keep both controllers on quoted commands and strict save checkpoints.

Twenty seeds complete the tour in 13–14 months. All return the three Healing Draughts and quarry yield bonus with a living priest/ruler and no economic shortfalls. Seed 9 needs a next-month tower retry. A longer mode returns to Fenwick and then finishes the chapter; three checks finish in 21–27 months.

This exposed and fixed an actual quest timing defect: Westmere could fall before M03 unlocked, then its dead guild would still offer a paid charter. Newly unlocked quests now respect prior conquest/loss, suppress stage-start events for a lost giver, prioritize already-met conquest goals, and preserve merchants that survive our conquest. An owned Westmere satisfies M03 without a toll payment. Stale imported offers refuse purchases immediately and settle next quest phase. No save schema change or retroactive removal of completed rewards.

Validation: 316 tests and the production build pass. New coverage includes real expeditions, hero-only participants, actual rewards/XP, next-month recovery, completing the chapter after a late offer, pre-offer enemy/player conquest, stale-save quotes and merchant survival. Human difficulty/pacing assessment remains open.


## Codex: current-stage quest destinations

The header's quest shortcut now opens an active encounter's map site, while ordinary diplomacy still opens the giver. Current encounter sites also have explicit “Show” links on quest cards and in the journal: a tracked caravan leads to the mine, the cyclops to the quarry, and the discovered tower to its vault. These are map selections, not automatic marches or battle commands. Locked quests, future stage branches and resolved encounters do not expose destination links. The quick-play graph keeps its original location IDs.

Validation: 320 tests and production build pass. Four navigation tests cover stage transitions, ordinary conversation, undiscovered/resolved quests, graph compatibility and rendering without campaign mutation. A smoke check of the compiled UI exercised the quarry shortcut, journal navigation, caravan tracking and mine card without moving troops, spending gold or starting a battle; no runtime errors. Canvas was stubbed for that DOM check, so visual browser review remains outstanding.


## Codex: encounter party previews

Quest quotes now describe the exact party at an encounter site: deployed troops, off-field reserves and anyone waiting outside. The encounter card shows names, current health and levels before the fight. Hero-only previews exclude the ruler and formations; normal encounters use the full local army. The field limit comes from the battle rules, and quotes do not consume RNG, split parties or change saves. Individual disabled choices now show their refusal beside the button, including the regroup delay after a failed attempt.

Validation: all 324 tests and the production build pass. Four new tests compare preview IDs with actual launched parties and reserves, including save/reload, no eligible hero, hidden/ordinary choices and escaped hero names. A compiled DOM check confirms the priest-only launch, retreat, waiting troops remaining unchanged and visible regroup refusal, with no runtime errors. Canvas was stubbed; visual review remains separate. No battle rule, encounter reward, artwork or save-schema change.
## Western chapter, part 9d: city quests (#9)

Two quests about decisions inside your own towns. With them, all six chapter side quests (Q01–Q06) and all four objectives (M01–M04) are implemented.

**Quest engine additions.**
- **Effects:** `goods` (add to or take from a city you rule) and `population` (people arrive or leave).
- **Stage-entry events:** `spoil` (a city you rule keeps only a fraction of one good) and `item` (evidence that comes to light as a stage begins). A stage is entered once, so the item appears once. Saves count it as granted by any stage the quest has entered, and still reject evidence held before that stage.
- **Choice requirements:** a choice can list `needs`, world conditions such as "your army in Millbrook". The first unmet one is the refusal ("First: Bring an army to Millbrook."). Each blocked choice's reason is now written under the buttons, not only in the tooltip.
- **Rationing:** a stage can carry a `recruitBan` for towns; recruiting there is refused with the quest named while the stage is open.
- **Location-lost marker:** losing a quest's town now records a `(location-lost)` marker in its history, so the stage it was in stays known.
- **Tracking order:** main objectives first, then quests whose deadline is soonest, then the longest-waiting. A quest about to run out is no longer hidden behind open-ended ones.

**The quests:**
- **Q01 The Empty Granary.** Offered after M01, from month 3. Rot destroys 60% of Aldenhold's grain as the quest begins, which also makes M02's granary goal harder.
  - Buy grain: 150 g for +80 food.
  - Escort grain from Millbrook: needs Millbrook, an army there and 60 food; moves 60 food.
  - Ration: no recruiting in Aldenhold for three months, then +60 food.
  - Two months without a choice: 200 people leave Aldenhold.
- **Q06 The Miller on Trial.** Month 6, while you rule Millbrook.
  - Question the witnesses (your army in Millbrook): Hobb's Grain Ledger comes to light as evidence. Then convict (fine of 150 g, 150 people return, ledger archived) or pardon (80 food returned).
  - Fine on hearsay: +100 g, 150 people leave.
  - Dismiss the charge: 100 people leave.
  - Each ending sets a flag for later quests.

**Not yet:** a loyalty or legitimacy stat (CITY-01 is P1, deferred with the deep economy). For now, trust shows as people arriving or leaving.

Validation: 300 tests pass, including 13 new city-quest tests:
- every branch of both quests
- the rot strikes exactly once, across reload
- the rationing ban starts and lifts
- the escort and questioning needs, with their reasons shown on the card
- deadline tracking order
- the evidence appears exactly once and is archived
- loss mid-trial, with the evidence still accounted for in the save
- a forged early ledger is rejected; content checks for spoilage, evidence events, goods towns, needs and bans

The build passes. In the browser: the granary rotted on schedule, rationing blocked Aldenhold's recruit buttons with the reason, and the trial brought the ledger into the inventory, then archived it on conviction. No console errors.

## Codex: treasury cash reports (#6)

The treasury's old “Revenue” summary counted taxes but omitted quest rewards and item sales. Reports now derive all receipts/payments directly from posted entries and show a complete opening-to-closing cash equation, with balance adjustments separate. Each period includes category and location breakdowns plus individual transactions with readable category labels. Mobile army costs stay under Field / realm; the location view does not invent separate city bank balances.

The current-month section is now activity rather than “purchases,” so a reward posted after month-end is correctly shown as a receipt. It distinguishes unsettled payroll/taxes from posted cash. Unpaid wages/maintenance remain reported shortfalls and are not counted as money paid. Tables scroll on narrow screens. Months without payments show 0g rather than negative zero.

Validation: all 328 tests and the production build pass. Four new tests cover mixed receipts/adjustments, per-location/category conservation, real M01 reward timing, actual field payroll, unpaid bills and a legacy import without invented history. A compiled DOM check opens the report after a real month closure, verifies its cash equation and category/location tables, returns to the map and confirms the ledger is unchanged, with no runtime errors. Canvas was stubbed; visual browser review remains outstanding. No economic rules, transactions, private-goods conversion, commerce system or save schema changed.


## Codex: manual positions and recovery (SAVE-02)

The existing autosave key and version-12 game payload are unchanged. The Saved games screen manages three named manual browser slots and the three most recent distinct pre-action recovery positions. Recovery is captured before month advancement, valid quest choices, starting another campaign, JSON import and restoring a position. Every restore passes through the same strict save parser and migration as JSON import. Unreadable recovery history is preserved until the player explicitly clears it; failed or invalid manual writes preserve the previous slot. Replacing the current game requires confirmation; checkpoint failures warn and ask before proceeding without one. The existing JSON export remains the off-browser backup path.

Validation: save-domain tests cover independent Western/quick-play slots, exact quest/treasury round-trip, ordered recovery rotation and deduplication, invalid saves, corrupt history and failed storage writes. A compiled DOM check covers naming a slot, ending a month, restoring that slot and restoring the prior position without runtime errors. Canvas was stubbed for this interaction check; visual browser review remains outstanding. The UI works with the normal autosave; there is no second campaign state or save-schema migration.

## Hero equipment and the chapter's item rewards (#9 follow-ups, ITEM-02 minimal)

Heroes can now carry campaign equipment. This makes two promised rewards real: the class heirloom after M01, and Q03's unique shield.

**Rules.**
- **Slots and bonuses:** heroes have weapon, armor and accessory slots. Equipment items say which slot they fill, what they add (attack, defense, leadership) and, optionally, which hero types may carry them. Content validation requires all of that, and that the bonuses add something.
- **Changing equipment:** only in a town you rule or one allied with you, never during a battle. An item put into a full slot sends the old one back to the inventory, and taking an item off returns it too. The journal's inventory offers "Give to <hero>" per eligible hero, and each hero's row in the army panel lists what they carry with a "take off" button.
- **In battle:** a hero's attack and defense include their equipment, and an army's leadership counts its best hero's leadership plus their equipment. Battles keep a snapshot, and saves check it against the hero.
- **Fallen heroes:** if any of the army survives (held the field or got away), the survivors carry the hero's equipment home. Otherwise ordinary items are lost on the field. An heirloom (which can't be thrown away) is always recovered. The journal says which happened.
- **Conservation:** held + carried + spent = what quests granted. Saves reject equipment on ordinary troops or the wrong hero, and carried items no quest granted.

**Items.**
- **Oathlance** (M01 reward): weapon, lord only, +2 attack and +5 leadership. It can't be sold, thrown away or lost.
- **Shield of the Old Watch** (Q03 victory): armor, any hero, +2 defense. It can be sold for 120 g.

**Save v13.** v12 saves are upgraded, and finished quests are granted rewards added to their content since, once (an M01 already won gets its Oathlance). Nothing else in the inventory changes.

Validation: 352 tests pass, including 11 new ones:
- the heirloom granted exactly once and limited to the lord
- equipping only in friendly towns, and taking items off
- the battle bonuses
- fallen-hero recovery, including the journal line from a real battle
- save rejections, the v12 → v13 backfill, and content checks

The build passes. In the browser: winning M01 put the Oathlance in the inventory, "Give to Aldric" moved it onto the lord's row, and "take off" returned it. No console errors.

## Q05 follow-up: Merra's stall (#9, QUEST-08)

How the caravan quest ended now changes what Fenwick offers. A rescued trader reappears in her town (QUEST-08), and merchant support differs by outcome.

- **Rescued:** Merra trades at cost (Healing Draught 40 g, Mana Draught 50 g).
- **Ransomed:** she charges half again (60 g, 75 g) while she rebuilds.
- **Lost:** Fenwick's panel shows her stall standing empty.
- **Before Q05 ends:** nothing shows. If Fenwick falls to the orcs, the stall is boarded up.
- **Buying:** you need an army at Fenwick or next to it. She stocks two Healing Draughts and one Mana Draught a month; the count comes from this month's ledger entries, so it needs no new state. Purchases go through the treasury as a new `item-purchase` expense, shown as "Merchant purchases".
- **Content:** merchants are content (`content/merchants.ts`), with the opening outcome flags and their markups, the closing flags, and monthly stock. Content validation checks the quest, the town, tradable goods only, stock counts and markups of at least 1.
- **Saves:** holdings record how many were `bought` (absent means none). Conservation is now held + carried + spent = granted + bought, and only goods some merchant stocks can have been bought. This is an optional field, so there's no schema bump.

Also: building the Western Realm's roads now ends each search once the next stop is reached, instead of exploring the whole map for every segment. The roads come out byte-identical; building them went from about 507 ms to 53 ms. That speeds up content validation at startup and fixes two quest-validation tests that timed out under the full parallel run.

Validation: 362 tests pass, including 7 new merchant tests:
- hidden before the outcome
- ransom pricing, monthly stock and restock
- ledger reconciliation with no balance correction
- rescue pricing and the panel
- the empty stall
- envoy range and orc capture
- bought draughts sold on, with forged counts and unstocked purchases rejected
- content checks

The build passes. In the browser, after a ransom, Fenwick showed the stall at 60 g and 75 g, and buying one left one in stock, with the gold shortfall stated. No console errors.
