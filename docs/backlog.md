# Active implementation backlog

The [expanded campaign specification](expanded-campaign.md) is the long-term goal. The **delivery path** below decides what is built first. This backlog distinguishes delivered foundations from remaining production targets; the existing nine-node quick-play campaign remains the regression fixture.

## Owner decisions, October 20, 2026 (delivery path)

These came out of a planning review with the owner. They govern order and release scope; the expanded specification's long-term targets are unchanged.

- **First release is the Western chapter.** Act I in regions R01–R02 (#9): 12 settlements, objectives M01–M04 as defined in the expanded specification, and that region's side quests. It is played on the walkable hex map (the Western Realm, PR #20), which grows region by region into the one 128 × 80 world. The quick-play valley stays a short mode and regression fixture.
- **Deferred until after the chapter:** advanced scouting and the deep economy beyond what exists (markets, caravans, governors; #6). Basic exploration fog is delivered for new Normal/Hard Western campaigns. The owner's October 21 requests promote closer map zoom and pan, ruler selection and visual representation, city views, and battle results into the chapter work queue; exact release order will follow playable slices. The owner’s later October 21 playtest request promotes difficulty, exploration fog, required relics, final-fortress preparation, replacement recruits and mixed gender formations into the current increment. New Normal/Hard games now use exploration; legacy saves retain their old rules.
- **Architecture first.** Before the quest framework, extend the quote pattern (`constructionQuote`, `refitQuote`) to every player command, then make the month an explicit, ordered pipeline (EVENT-01, ECO-23). Both came out of the architecture review and reduce the cost of every quest and objective after them.
- **Art** stays original and follows the owner-approved richer pixel-art direction. Generated raster panoramas and atlases now supply towns, terrain and units; hand-authored text grids remain fallback and small-symbol assets. Preserve source manifests and review new art in the actual game.
- **Balance is accepted** when seeded automated playthroughs on Normal finish the main objectives and prepared Gharzak assault within a target window without the ruler dying, and the owner has played the chapter and signed it off.
- **Title.** "Aragon" stays a working title; the final title and city names are chosen when the chapter is feature-complete and before any public link is shared.

## How the agents work

- **This table is the work queue.** Work is tracked as GitHub issues; the owner sets the order here.
- **Coordinate through the queue.** The owner subsequently authorized Codex to work on things Claude is not handling. Use distinct work areas, check current branches/PRs before starting, and consolidate overlapping implementations. Start from the latest `main` and record progress in [implementation-progress.md](implementation-progress.md).
- **Agents may merge after checks.** The owner subsequently authorized merges whenever ready. Open a reviewable PR, pass CI, check for conflicts/current changes, then merge.

## Queue

| Order | GitHub issue | Next deliverable |
| --- | --- | --- |
| Done | #21, #22, #17 | Action quotes (#24), month pipeline (#25), quest engine (#27), Q04 Woodland Accord (#29), faction registry and item policies (#30) |
| Done (#31) | [#9 Western chapter](https://github.com/jsconu/aragon/issues/9) — 9a chapter spine | Objective stages that advance on world state, stage-start events (the M04 incursion), M01–M04, and finishing Act I as the chapter's victory |
| Done (#34) | #9 — 9b map growth | Six new settlements, 52×38 geography, routes, resource roles and revision-1 save migration; distinct artwork and local stories remain. See [map growth](western-map-growth.md) |
| Done (#32); shield in hero-equipment PR | #9 — 9c encounters | Q02 cyclops/boulder and noncombat mining choice, Q03 hero-only trial (now with the Shield of the Old Watch), Q05 caravan tracking/ransom (outcome now opens, prices or empties Merra's stall in Fenwick). Remaining: balance |
| Delivered (#39) | #9 — 9d city quests | Q01 The Empty Granary (granary rot; buy, escort or ration with a recruit ban), Q06 The Miller on Trial (evidence-led verdict; people arrive or leave). A loyalty stat waits for CITY-01 |
| Partial | #9 — 9e balance and art | Encounter previews, navigation and real-command chapter/expedition controllers cover new city choices and Greenveil pacing; [current seeded baselines](chapter-playthroughs.md); [encounter odds](encounter-odds.md) harness, fearless monsters and a tuned cyclops. Remaining: owner playthrough, agreed pacing window, minotaur tuned (14 men; expedition brings a fighter), early-alliance end-of-chapter handling, chapter art and final title |
| Partial | Battle controls and classic stacking | Group movement at the slowest member's pace and one-step overland/battle movement undo are delivered in this increment. Remaining: true tactical stacks by the original 200-size-point hex capacity, including mixed foot/cavalry costs, selection, targeting, morale, AI, rendering and save rules. Group movement keeps formations separate. |
| Partial | [City assaults, sieges and deployment](city-assaults-and-sieges.md) | Automatic melee-front/support-rear deployment and a defender preview with Attack / Retreat before marching into a defended town are delivered. Besiege is visible but unavailable until persistent blockade and surrender rules are built. Remaining: month-scale supply/attrition and weaker-town vassal terms, settlement battlefields and once-only pillage, varied legal starts, ranged/caster melee and HP balance. |
| Partial | [Scouts and advance warning](scouts-and-warning.md) | Scouts can be recruited, marched and assigned to City watch or Road watch. A nearby planned orc route can yield one saved journal/city report, with a route-limited arrival estimate; scout upkeep applies and moving clears the post. Remaining: truly noncombat battlefield treatment, wider road coverage display, dedicated monster-raid intelligence, route-change/retirement updates and interception behavior. |
| Owner priority | Chapter victory and battle results | Show a results screen before returning to the map: victory/defeat, losses and deaths, experience and level advancements, points, rewards and captured locations. Keep the final campaign ending summary distinct. |
| Partial | Ruler selection and representation | Knight, Priest and Mage are playable with male/female characters, four skin tones, saved portraits and battlefield art. Remaining: Warrior and Ranger, and full-campaign balance for every class. |
| Partial, current increment | City views and map navigation | Separate tabbed city management, development artwork, close zoom, panning, recentering, readable banners and movement borders are delivered. Remaining: unique illustrations for each city and smoother terrain transitions. |
| Owner priority | [Monster raids and expanded battles](monster-raids-and-expanded-battles.md) | In the spec's order: **1a** ownership banners and legend (delivered in #52); **1b** larger scrollable battlefields with seeded terrain variants (delivered in #53: 18×12 / 24×16 / 30×20 by fight size, camera and minimap); **2** persistent lair registry for goblins, trolls, giants and titans (delivered in #54: five authored lairs, discovery, clearing and plunder, save v14); **3** deterministic raid threat and garrison deterrence in the month pipeline (delivered in #55: threat by reach, deterrence, raids announced ahead, garrison battles or plunder, save v15); **4** defence battles, harassment vs siege, results and persistence (delivered in #56: goblin and troll harassment, giant and titan sieges, plunder cut by the raiders a garrison kills, a persistent raid log in the town panel and journal, `npm run simulate:raids`, save v16) |
| After the chapter | [#15](https://github.com/jsconu/aragon/issues/15) remainder | Basic permanent exploration and zoom/pan are delivered. Remaining: advanced scouting/Reveal, saved multi-month orders and next regions. |
| Current increment | Rival city war parties | Independent free cities can muster warned, bounded expeditions from real garrisons in Western campaigns using the new difficulty rules. Parties roam through actual terrain, can attack/capture player cities, respect alliances/truces, retain home defenders, and save their orders. Owner balance playtest remains. |
| After the chapter | [#6 City economy](https://github.com/jsconu/aragon/issues/6) | Commerce, transport, markets, governors and realm forecasts |
| After the chapter | [#7 Veteran equipment](https://github.com/jsconu/aragon/issues/7) | Replacements are delivered; remaining: full equipment tree, services and salvage |
| After the chapter | [#16 Supporting casters and spell art](https://github.com/jsconu/aragon/issues/16) | Priest/ranger lists and 19 spell icons; Reveal depends on fog |
| After the chapter | [#18 Expanded authored campaign](https://github.com/jsconu/aragon/issues/18) | Remaining regions, 48 cities, 72 side quests, 24 main objectives, 60 sites and 30 surprise battles, in playable acts |
| P2 after the story | [#10 Persistent frontier](https://github.com/jsconu/aragon/issues/10) | Same-save story-to-frontier handoff, deterministic new regions, bounded levels and remote simulation |
| Ongoing | [#8 Mage magic](https://github.com/jsconu/aragon/issues/8) | Fourteen spells delivered; balance playtesting remains |

Completed foundations include versioned saves with three manual slots and rolling recovery positions, content validation, journal, the Q00 treaty/item fixture, a reconciled treasury ledger with category/location cash reports, local production/construction, paid veteran bow/armor refits, fourteen mage spells, original tactical pixel units and the visual overland atlas. These foundations do not yet implement the full economy, 48-city map or infinite world.

For each authored quest or surprise, require a stable content ID, eligibility, choices, success/failure consequences, one-time reward policy, save/reload tests and appropriate art. A title, map marker or random encounter alone does not meet completion criteria.

## Browser playtest additions, October 21, 2026

Implemented on `codex/reference-presentation`: rich town and lair panoramas, detailed overland and battle terrain, illustrated units, heraldic cloth banners, stone/timber bridges, battle results, victory gold, one-click movement/attack, and the first two ruler-only narrative landmark adventures (Royal Barrow and Hillcrest Monastery). Remaining: owner visual and balance review, smoother terrain edges, animated combat, and more authored landmark adventures using the same ruler-only framework. The adventures are staged narrative puzzles; free-roaming point-and-click rooms are not implemented.


Delivered in the current browser playtest: matching rich development/ruin artwork, high-contrast movement borders, side-quest outcome summaries, persistent hero instructions and the missing ruler appearance-selection step. Knight, Priest and Mage now have distinct rules and matching artwork; Warrior and Ranger remain.
