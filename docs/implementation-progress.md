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

## Art direction increment: pixel unit sprites

| Requirement | This increment | Remaining work |
| --- | --- | --- |
| ART-01 | Direction revised to pixel art at the owner's request. All 13 current unit types have original 16×16 pixel sprites (`src/ui/pixelSprites.ts`) in an EGA-inspired palette, with team-coloured pixels and bases. Defenders are mirrored. | Pixel terrain tiles, city art and portraits; sprites for the 30 release archetypes. |
| ART-08 (partial) | Unit sample shown in the actual battle UI: infantry (militia, spearmen, archers), cavalry (knights), monster (troll), heroes and orcs. **Awaiting owner approval.** | Forest tile, river junction and city panorama samples. |
| ART-03 (partial) | Selected, attack-target and spell-target outlines, hero rim and star, routing (faded figure, "RUN"), HP and morale bars kept outside the art. | Hovered, exhausted, wounded, debuffed, reserve and quest-target overlays. |

Sprite grids are validated by tests: 16×16, known palette characters only, team colour present, and one sprite for every unit type.

The hex overland map started earlier is parked on the local branch `overland-map-wip`, to be reused for the milestone-B western map slice. It replaces the nine-node graph, so it must land as a separate campaign that leaves quick-play saves valid (SAVE-01, BASE-03).

## Next increments

1. Extract the quick-play world into a content catalog; add content reference validation and a permanent campaign journal (BASE-03 / BASE-04).
2. Introduce faction/treaty and item state plus one complete quest whose reward and treaty change occur exactly once across reload (milestone A acceptance).
3. Implement the richer city economy with a reconciled monthly ledger before production chains, trade and governors.
4. Add level-based equipment/refits, then the 14-spell mage progression with tactical AI and save migrations.
5. Build out the authored campaign and art pipeline; prototype the agreed procedural frontier after the campaign foundations are stable.
