# Active implementation backlog

The [expanded campaign specification](expanded-campaign.md) is the long-term goal. The **delivery path** below decides what is built first. This backlog distinguishes delivered foundations from remaining production targets; the existing nine-node quick-play campaign remains the regression fixture.

## Owner decisions, October 20, 2026 (delivery path)

These came out of a planning review with the owner. They govern order and release scope; the expanded specification's long-term targets are unchanged.

- **First release is the Western chapter.** Act I in regions R01–R02 (#9): 12 settlements, objectives M01–M04 as defined in the expanded specification, and that region's side quests. It is played on the walkable hex map (the Western Realm, PR #20), which grows region by region into the one 128 × 80 world. The quick-play valley stays a short mode and regression fixture.
- **Deferred until after the chapter:** fog of war and scouting (#15 step 3), pan and zoom polish, the deep economy beyond what exists (markets, caravans, governors; #6), and ruler classes other than the Knight. The chapter ships with one ruler class and a fully visible map.
- **Architecture first.** Before the quest framework, extend the quote pattern (`constructionQuote`, `refitQuote`) to every player command, then make the month an explicit, ordered pipeline (EVENT-01, ECO-23). Both came out of the architecture review and reduce the cost of every quest and objective after them.
- **Art** stays original, hand-authored pixel art kept as text grids in the code (units, map tiles, map sprites). Revisit commissioned portraits before any public release.
- **Balance is accepted** when seeded automated playthroughs on Normal finish the chapter's M01–M04 within a target window without the ruler dying, and the owner has played the chapter and signed it off.
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
| Owner priority | [Monster raids and expanded battles](monster-raids-and-expanded-battles.md) | In the spec's order: **1a** ownership banners and legend (delivered in #52); **1b** larger scrollable battlefields with seeded terrain variants (delivered in #53: 18×12 / 24×16 / 30×20 by fight size, camera and minimap); **2** persistent lair registry for goblins, trolls, giants and titans; **3** deterministic raid threat and garrison deterrence in the month pipeline; **4** defence battles, harassment vs siege, results and persistence |
| After the chapter | [#15](https://github.com/jsconu/aragon/issues/15) remainder | Fog, scouting, pan/zoom, minimap, saved multi-month orders, next regions |
| After the chapter | [#6 City economy](https://github.com/jsconu/aragon/issues/6) | Commerce, transport, markets, governors and realm forecasts |
| After the chapter | [#7 Veteran equipment](https://github.com/jsconu/aragon/issues/7) | Full equipment tree, services, salvage and reinforcement rules |
| After the chapter | [#16 Supporting casters and spell art](https://github.com/jsconu/aragon/issues/16) | Priest/ranger lists and 19 spell icons; Reveal depends on fog |
| After the chapter | [#18 Expanded authored campaign](https://github.com/jsconu/aragon/issues/18) | Remaining regions, 48 cities, 72 side quests, 24 main objectives, 60 sites and 30 surprise battles, in playable acts |
| P2 after the story | [#10 Persistent frontier](https://github.com/jsconu/aragon/issues/10) | Same-save story-to-frontier handoff, deterministic new regions, bounded levels and remote simulation |
| Ongoing | [#8 Mage magic](https://github.com/jsconu/aragon/issues/8) | Fourteen spells delivered; balance playtesting remains |

Completed foundations include versioned saves with three manual slots and rolling recovery positions, content validation, journal, the Q00 treaty/item fixture, a reconciled treasury ledger with category/location cash reports, local production/construction, paid veteran bow/armor refits, fourteen mage spells, original tactical pixel units and the visual overland atlas. These foundations do not yet implement the full economy, 48-city map or infinite world.

For each authored quest or surprise, require a stable content ID, eligibility, choices, success/failure consequences, one-time reward policy, save/reload tests and appropriate art. A title, map marker or random encounter alone does not meet completion criteria.
