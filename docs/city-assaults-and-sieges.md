# City assaults, sieges and automatic deployment

Owner request, October 22, 2026. This is a production target, not a description of current behavior. It applies to attacks on settlements in the authored campaign and later frontier, and complements the existing monster raid rules. Ship it in playable slices while preserving the valley quick-play fixture and existing saves.

## Before the battle

- Entering a hostile city with an army pauses at an assault decision. Name the settlement and owner; show visible defending formations, approximate strength, walls, local terrain, and known reinforcements. Unknown defenders should be described as estimates, never falsely presented as exact.
- Offer **Attack**, **Retreat** and **Besiege** with the immediate cost and consequence of each choice. Retreat returns to the approach location with a stated movement cost. Choosing the assault starts a city battlefield. Do not silently start combat merely because the player inspected a city or clicked an unlit map cell.
- Keep the decision and the eventual tactical battle recoverable after save/reload. A canceled decision cannot consume movement, duplicate a battle, or award capture. Quest and scripted encounters may override options explicitly.

## Siege and surrender

- A siege encircles a hostile settlement across campaign months. The besieging army stays committed, spends upkeep and supplies, and is exposed to relief armies and defender sorties. Show both sides' strength, fortification condition, food, projected attrition, and the next monthly decision before ending a month. A siege can be lifted, fought as an assault, reinforced, or held; no automatic irrevocable end-month assault.
- Blockade effectiveness depends on army size and access routes. Resupply and open roads matter; a small force cannot starve a city it cannot surround. Starvation, damaged defenses, morale, and relief change the siege without being determined by a single fixed countdown. Capture, losses, destruction and gold must post once to the ledger and journal.
- Some weaker independent towns can offer **vassalage** after a credible siege or show of force. The player may accept terms or demand an assault. Terms grant passage/tribute/obligations through the existing relationship system, not direct ownership or free control of the garrison. A stronger or politically committed city may be weakened by a siege yet refuse to surrender; show why. No capital or main-objective stronghold capitulates solely because a generic strength threshold was crossed. Define city-specific surrender policy and test it through save/reload.
- The AI must obey the same city-defense and supply constraints where it can besiege a player town. Warn the player, allow a relief attempt, and report the outcome before returning to ordinary campaign play.

## City battlefield and pillage

- Assaults use seeded settlement layouts rather than a generic land field: village lanes, houses, fields, workshops, walls or palisades and an approach fitting the surrounding terrain and development. Render owned buildings and productive hexes in the location where they can be fought over. Keep both deployment areas reachable, line of sight and pathfinding valid, and enough approach routes to avoid an accidental impassable siege.
- The attacker can enter and **pillage** eligible developed hexes during battle. Show the expected value and permanent damage before confirmation. Each site pays a bounded amount based on its stored goods and development; money is credited once through the ledger, the site is marked spent for that battle, and the matching city stock/building level changes after battle. A retreating attacker keeps only explicitly collected loot. Friendly troops do not pillage their own city. No repeated rewards after save/reload or through re-entry.
- Victory, retreat and defeat explain remaining defenses, casualties, experience, captured territory, pillage and infrastructure changes before going back to the map. Auto-resolve applies a comparable bounded outcome without pretending the player selected individual pillage hexes.

## Deployment and unit roles

- Remove the editable formation grid and stance buttons from the city/army panel. At battle start, place the strongest durable melee formations toward the front, less durable melee behind them, archers behind the melee screen, and priests, mages and the ruler at the rear. Use current survivors, experience, equipment, defense and melee ability to rank within a role. The player can still command and move troops once battle starts.
- Encounter seed, terrain, walls and scenario define variable legal deployment zones and enemy approaches. In the same map two armies need not always appear in the same rows. An automatic layout must never put a unit in an impassable or occupied cell. Show a short deployment summary at battle start and allow an explicit tactical reposition phase later if playtesting calls for it; do not bring the city grid back.
- Archers, priests and mages should generally lose a fair melee exchange against comparable front-line troops. They can still gain experience and maximum HP, improving survival against ranged attacks; healing, spell, equipment and formation defenses must remain legible. A ruler belongs at the rear by default even if their melee stat is high. Balance offense, HP growth and defensive equipment independently so extra HP does not turn a caster into the best melee attacker.
- Existing saved custom stances/layouts must load safely. Decide and document whether they are honored for a battle already underway; new battles should use the automatic deployment rule. Reserve accounting stays explicit.

## Battlefield variety and acceptance

Seeded battle templates must vary deployment side, starting rows, defender placement, terrain features and objective positions across ordinary fights, ambushes, city assaults, sieges and raids. A particular scripted battle may fix a purposeful arrangement. Variety must remain deterministic after save/reload, have clear approach directions and preserve playable pathfinding and camera focus.

1. A city with known defenders opens the decision with the correct forces and three choices; Retreat does not start a battle, and repeated clicks cannot create a duplicate assault.
2. A weak eligible town can offer vassal terms after a siege; a strong ineligible city can lose food and walls without auto-surrendering. Both paths survive a reload and post their economic/diplomatic effects once.
3. The city battlefield visibly reflects terrain and buildings. Pillaging one developed hex changes the right city resource and ledger entry once; a second attempt pays nothing. An unvisited hex cannot pay loot on retreat.
4. Automatic setup gives the ruler, priest, mage and archers safer rear positions, with durable melee ahead; crowded armies have explicit reserves. Different seeds/scenarios produce legal variable layouts without overlapping units or unreachable enemies.
5. Ranged and caster troops improve maximum HP with levels while their melee damage remains below a comparable melee troop, including after equipment and XP. Test this against representative troop levels.
6. Saved sieges, mid-battle pillage and older custom tactics load safely. The battle result screen reflects the same single ledger entries and casualties after reload.
