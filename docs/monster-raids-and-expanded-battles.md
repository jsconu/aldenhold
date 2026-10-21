# Expanded battles, monster lairs and city defense — implementation specification

Status: **approved design request / not yet implemented**. Owner request, 2026-10-21. This supplements `docs/expanded-campaign.md` and `docs/backlog.md`; preserve the small nine-node quick-play fixture.

## Player experience

- Tactical battlefields must be significantly larger and more varied than current screens. Battle maps are scrollable and zoomable; avoid showing all hexes at once. Suggested sizes (tune after playtesting): skirmish 24×24, field 36×36, major 48×48, epic or siege 64×64. Include minimap, center-on-unit, keyboard pan and pointer drag; distinguish click-to-move from drag-to-pan. Deployment area and pathfinding must honor the full battlefield, not only visible tiles.
- Battlefield generation must inherit the **overland** land type (`Land` and `LandType.battleScatter/battleStream` already exist), with seeded layouts including river crossings, bridges, forests, marshes, mountain chokepoints, high ground, villages and walls. Keep traversable routes and at least two meaningful approach paths except explicitly scripted choke encounters. Validate reachable spawn zones and AI pathfinding.
- Every city on the overland map must clearly show ownership **without relying solely on color**: player banner with crest/crown and bold border; enemy crossed-swords banner; neutral plain banner; hostile monster lair unique skull/monster glyph. Supply map legend, selection tooltip and optionally player-city map filter. City names should remain legible at default closer zoom.
- Monster factions may attack **owned cities** as part of the monthly turn system. Show warnings when threats become credible, the source lair where known, raid arrival and outcome, garrison losses, civilian/economic effects and battle reports. Attacks must remain playable in tactical mode, with a defensible auto-resolve alternative.
- Build additional persistent monster home bases across authored regions, not just random roaming encounters. Goblins, trolls, giants and titans are required; differentiated ecology, threat radius, unit composition, encounter terrain, loot and destruction/capture consequences. Continue lairs into procedurally generated frontier regions after the authored campaign.

## Raids and deterrence

Threat is recalculated deterministically per player city per month from **active nearby lairs**, distance along passable terrain, monster type, lair tier/activity, geography, city visibility and defensive strength.

Suggested transparent preliminary model (balance numbers, do not treat as fixed):
- Each lair has `raidRadius`, `activity`, `tier`, `raidCooldown` and `strength`.
- City `garrisonDefense` is computed from stationed troop strength, quality, equipment, fortifications and hero leadership (not just headcount).
- `threatPower = sum(lair.strength × distanceFalloff × activity)` for lairs in reach; `defenseRatio = garrisonDefense / max(1, threatPower)`.
- A city outside every eligible lair's raid range has **zero raids** from those lairs. A strongly defended city at or above a configurable deterrence threshold (initial balancing target 1.5–2.0×) also has **zero routine raids**; faction-defining siege events or scripted objectives must explicitly disclose exceptions.
- Between weak and strong defenses, raid chance falls monotonically with greater effective garrison defense. Terrain modifies reach and activity (e.g., goblins operate from forests and hills; trolls from swamps and riverlands; giants from rocky highlands; titans only from rare remote ancient sites). Never increase chance simply because a player reinforces the same city.
- Losing a garrison can expose the city to future raids; clearing, pacifying, sealing, or capturing a nearby lair reduces local pressure, creating meaningful strategic counterplay. Add cooldowns, regional attack caps, tutorial grace period, and difficulty scaling to avoid surprise raid spam.
- Averted raids do not require tactical combat. Raid threats should be visible enough that garrisons are a deliberate economic tradeoff, not hidden dice rolls.
- If a city loses a raid, resolve casualties, damage and plunder by consistent rules; city ownership changes only when specified (siege/capture), never from a small harassment raid.
- No off-screen instant player-capital loss without clear advance warning or a chance to defend.

## Monster identity and lair placements

| Faction | Preferred lair / terrain | Tactics | Strategic counter |
| --- | --- | --- | --- |
| Goblins | Cave, abandoned mine, woodland camp | Frequent light raids, archers, ambush | Scout patrols, modest garrison, clear camps |
| Trolls | Swamp den, river cave | Regeneration, slow durable attackers, crossings | Focused fire, defended crossings |
| Giants | Mountain cavern, rocky hold | Low-frequency heavy raids, boulders and siege pressure | Fortifications, specialist units |
| Titans | Ancient sanctuary, peak or ruin | Very rare major world threats, multi-stage warning | High-level coalition and prepared defenses |

Authored map additions require named lair IDs, positions, discovery stories, fair travel routes, a finite suppression method, and save migration for older campaign revisions. Don't randomly spawn a titan adjacent to the starting city. Procedural frontier sites use the same schema and seeded regional budgets.

## Engineering touchpoints

- `src/game/types.ts`: consider distinct monster faction IDs or metadata rather than funneling every species through `orcs`; introduce persistent lair status and pending raid data using versioned save migration.
- `src/game/battle.ts`, `src/ui/battleView.ts`, `src/ui/battleScenery.ts`, `src/content/rules.ts`: scalable battlefield generation/rendering/camera and AI, seeded geography and obstacles.
- Campaign world data and map renderer: distinct city ownership markers and discoverable lair icons. Keep screen reader/text labels and contrast.
- Month pipeline: resolve raid planning **once** in a stable stage, record forecasts and pending attacks, then defense/combat and aftermath. Never double-trigger on save/reload. Integrate with army movement and existing quest-directed incursion `Army.target`.
- Battle result UI should include defending garrison casualties, hero XP/level progress, loot and infrastructure damage; the battle summary is shown **before** returning to overland.
- Preserve backward compatibility and rapid `valley-quickplay` tests; keep authored Western chapter pacing coherent.

## Required tests / acceptance

1. For identical seeds/state, raid origin, chance and target are repeatable; save/reload and month re-entry cannot duplicate raids or rewards.
2. A city outside all active raid radii has no routine attacks; a city over deterrence threshold has no routine attacks; increasing a garrison never increases routine attack odds.
3. Deployed garrison and walls reduce losses. If all raiders flee or lose, city owner does not change. A harassment raid cannot capture a city.
4. Removing a lair eliminates its own raid pressure, and placement of a new lair restores only the intended local region's pressure.
5. Goblins/trolls/giants/titans appear in authored content with distinct land preferences and achievable difficulty, and threats are warned in advance.
6. Overland ownership markers remain legible and distinguishable in default zoom, grayscale and high-contrast modes; selecting a city reveals its owner and garrison.
7. Each tactical size launches, pans and zooms, has reachable legal deployments and objectives; AI can traverse generated terrain; scroll/drag does not issue accidental moves.
8. Strategic battle and raid results survive saves and appear in the battle history.

## Proposed delivery order

1. Ownership banners/legend and larger scrollable battles, with seeded terrain variants.
2. Persistent lair registry and map content for goblins/trolls/giants/titans.
3. Raid threat preview and deterministic deterrence calculation; integrate into month pipeline.
4. Defense battles, siege/harassment distinction, results and persistence; automated seeded simulation and player balancing.

**Compatibility note:** Current `FactionId` is `player | orcs | neutral`, terrain battles already use `LandType.battleScatter/battleStream`, town kinds include `lair`, and existing quest incursions can target towns. Reuse these primitives where sensible rather than building a separate competing combat engine.
