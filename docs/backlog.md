# Active implementation backlog

The [expanded campaign specification](expanded-campaign.md) governs current scope. This backlog distinguishes delivered foundations from remaining production targets; the existing nine-node quick-play campaign remains the regression fixture.

| Priority / order | GitHub issue | Next deliverable |
| --- | --- | --- |
| Current rules increment | [#8 Mage magic](https://github.com/jsconu/aragon/issues/8) | Fourteen spells, progression, tactical effects, player previews, AI and v9 saves implemented in this change; balance playtesting remains |
| P0 next | [#17 Quest framework](https://github.com/jsconu/aragon/issues/17) | Staged objectives, prerequisites/deadlines, saved event triggers, choices and permanent consequences; reuse the Fenwick treaty fixture |
| P1 | [#15 Real hex overland map](https://github.com/jsconu/aragon/issues/15) | Terrain-cost movement, bridges, scouting/fog and persistent authored coordinates; preserve current pixel artwork |
| P1 | [#9 Western chapter](https://github.com/jsconu/aragon/issues/9) | Playable R01–R02 chapter: 12 settlements, Act I, regional quests and authored surprises |
| P1 ongoing | [#6 City economy](https://github.com/jsconu/aragon/issues/6) | Extend existing ledger/buildings/production with commerce, transport, markets, governors and realm forecasts |
| P1 ongoing | [#7 Veteran equipment](https://github.com/jsconu/aragon/issues/7) | Extend existing bow/armor refits to the full equipment tree, services, salvage and reinforcement rules |
| P1 content program | [#18 Expanded authored campaign](https://github.com/jsconu/aragon/issues/18) | Eight regions, 48 cities, 72 side quests, 24 main objectives, 60 sites and 30 surprise battles, delivered in playable acts |
| P1 supporting magic/art | [#16 Supporting casters and spell art](https://github.com/jsconu/aragon/issues/16) | Priest/ranger lists and 19 spell icons/readable effects; Reveal depends on real fog |
| P2 after story foundations | [#10 Persistent frontier](https://github.com/jsconu/aragon/issues/10) | Same-save story-to-frontier handoff, deterministic new regions, bounded levels and remote simulation |

Completed foundations include versioned saves, content validation, journal, Q00 treaty/item fixture, a reconciled treasury ledger, local production/construction, paid veteran bow/armor refits, original tactical pixel units and the visual overland atlas. These foundations do not yet implement the full economy, 48-city map or infinite world.

For each authored quest or surprise, require a stable content ID, eligibility, choices, success/failure consequences, one-time reward policy, save/reload tests and appropriate art. A title, map marker or random encounter alone does not meet completion criteria.
