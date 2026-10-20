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
- **Agents take turns.** Only one agent (Claude or Codex) works on the repo at a time. Each piece of work starts on a fresh branch from the latest `main`, and the agent records what it did in [implementation-progress.md](implementation-progress.md).
- **Agents open PRs; the owner merges.** No agent merges its own PR. CI (tests and build) must pass first.

## Queue

| Order | GitHub issue | Next deliverable |
| --- | --- | --- |
| Delivered, awaiting merge | [#15 Real hex overland map](https://github.com/jsconu/aragon/issues/15) (PR #20) | Steps 1–2: the walkable Western Realm, terrain-cost movement, bridges, arrival estimates and pixel terrain tiles. Fog, pan/zoom, saved multi-month orders and growth to 128 × 80 remain on #15 |
| 1 | [#21 Architecture: action quotes](https://github.com/jsconu/aragon/issues/21) | Every player command (recruit, hire, march, quests) gets a quote with cost and refusal reason that both the UI and the command use; removes rules duplicated in the UI |
| 2 | [#22 Architecture: month pipeline](https://github.com/jsconu/aragon/issues/22) | `advanceMonth` as an ordered list of named phases returning a month report; journal and chronicle written from the report |
| 3 | [#17 Quest framework](https://github.com/jsconu/aragon/issues/17) | Staged objectives, prerequisites/deadlines, saved event triggers, choices and permanent consequences; reuse the Fenwick treaty fixture |
| 4 | [#9 Western chapter](https://github.com/jsconu/aragon/issues/9) | Act I in R01–R02 on the hex map: 12 settlements, M01–M04, regional quests and authored surprises; one ruler class; chapter balance and art pass |
| After the chapter | [#15](https://github.com/jsconu/aragon/issues/15) remainder | Fog, scouting, pan/zoom, minimap, saved multi-month orders, next regions |
| After the chapter | [#6 City economy](https://github.com/jsconu/aragon/issues/6) | Commerce, transport, markets, governors and realm forecasts |
| After the chapter | [#7 Veteran equipment](https://github.com/jsconu/aragon/issues/7) | Full equipment tree, services, salvage and reinforcement rules |
| After the chapter | [#16 Supporting casters and spell art](https://github.com/jsconu/aragon/issues/16) | Priest/ranger lists and 19 spell icons; Reveal depends on fog |
| After the chapter | [#18 Expanded authored campaign](https://github.com/jsconu/aragon/issues/18) | Remaining regions, 48 cities, 72 side quests, 24 main objectives, 60 sites and 30 surprise battles, in playable acts |
| P2 after the story | [#10 Persistent frontier](https://github.com/jsconu/aragon/issues/10) | Same-save story-to-frontier handoff, deterministic new regions, bounded levels and remote simulation |
| Ongoing | [#8 Mage magic](https://github.com/jsconu/aragon/issues/8) | Fourteen spells delivered; balance playtesting remains |

Completed foundations include versioned saves, content validation, journal, the Q00 treaty/item fixture, a reconciled treasury ledger, local production/construction, paid veteran bow/armor refits, fourteen mage spells, original tactical pixel units and the visual overland atlas. These foundations do not yet implement the full economy, 48-city map or infinite world.

For each authored quest or surprise, require a stable content ID, eligibility, choices, success/failure consequences, one-time reward policy, save/reload tests and appropriate art. A title, map marker or random encounter alone does not meet completion criteria.
