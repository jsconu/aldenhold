# Aragon: design notes

A remake of *Sword of Aragon* (SSI, 1989). We keep its rules and campaign structure and put a modern UI on top. "Aragon" is only the codename. The original names, story and art belong to the rights holder, so everything we ship uses our own names and art.

## What the original game does

- **Campaign.** You inherit a city after your father dies. Orcs and other enemies threaten the province, and the goal is to unite it. The game runs in monthly turns.
- **Economy.** Each city has population and a tax rate. Higher taxes bring in more gold now but slow growth. Gold pays for recruiting and monthly upkeep.
- **Armies.** Troops are recruited in cities, gain experience and level up between battles. Leaders and spellcasters (priests, mages) lead armies.
- **Tactical battles.** Fought on a hex grid. Movement, melee, missile fire, terrain, morale and spells.

## Milestones

### v0.1: a thin full loop

Each part is basic, but they all connect: **recruit → march → fight → capture → collect taxes → repeat.**

| Area | In v0.1 | Later |
|---|---|---|
| Province map | Graph of 9 locations (towns, waypoints, orc hold) | Tile/hex overland map, terrain, roads |
| Turns | One month per turn; each troop moves one step per month | Movement points, forced march, seasons |
| Economy | Population, tax rate (0–50%), growth, upkeep, desertion when broke | Loyalty and unrest, buildings, trade |
| Recruiting | Militia, Spearmen, Archers; Knights only at the capital | Equipment upgrades, mercenaries, hiring heroes |
| Troops | Men count, experience, up to 3 levels (+15% attack, +8 morale each) | Equipment |
| Battles | 12×9 hex grid, forest/hill, zone of control, melee with counterattack, missile fire, town walls (+1 defense), retreat, auto-resolve | Flanking, deployment phase |
| Enemies | The orc hold raises warbands and trolls and sends out raiding parties toward the nearest town | Several factions, diplomacy, events |
| Neutral towns | Held by local militia; you take them by force | Win them over with gold or a quest |
| Win/lose | Take Gharzak Hold to win; lose Aldenhold and you lose | Multi-stage campaign, score |
| Save | Autosaves to the browser after every action | Multiple save slots, export |

### v0.2: heroes, spells, morale

| Area | In v0.2 | Later |
|---|---|---|
| Your lord | Aldric leads from Aldenhold: 30 HP, leadership +15. **If he dies, the game is lost.** If his army is cut off, he escapes alone to the capital. | Heir/succession, a fuller story campaign |
| Hiring heroes | Each month there's a 30% chance a Champion, Priest or Mage offers to serve in one of your towns (at most 2 offers, each lasting 3 months). A priest is waiting in Aldenhold at the start. | Inns, quests, hero-specific events |
| Heroes | Single figures with hit points. They hit with a fixed power, so wounds don't weaken them. They never break. They level up from battles and deeds: +4 HP, +10% attack and +2 mana per level, up to level 10. They heal 25% of their HP and refill mana every month. Monthly pay is their upkeep. | Items, more classes (ranger, paladin), hero duels |
| Spells | Mage: Fireball (4 mana, range 5, 4+2×level damage), Terror (3 mana, morale −30−5×level). Priest: Heal (3 mana, range 3, restores 4+2×level men lost in this battle or HP), Rally (2 mana, range 4, +40 morale, can turn a running troop). | More spells, area effects, spell research |
| Morale | Starts at 60 + 8×troop level + the army's best leadership (+10 behind walls). Losses cost morale in proportion to the share of the troop lost. A friendly troop wiped out within 2 hexes costs 10. A fallen hero costs every friend 20. Recovers 3 a turn. | Flanking and charge shocks, fatigue |
| Routing | Below 25 morale a troop runs: it can't act, heads for its own edge and leaves the field when it gets there. It takes 1.5× damage and can't strike back. Running troops gain 8 morale a turn and rally at 45 if no enemy is next to them. A side with no troops still fighting loses. Survivors who fled rejoin their army afterwards. | |
| Retreats | Losers fall back to friendly towns or open country, never into someone else's town. Attackers go back where they came from. | Pursuit |
| Orcs | The Hold has a warchief (leadership +10) and a shaman (Fireball). Both stay home when war parties ride out. | Orc heroes leading raids |

## Code layout

- `src/game/`: pure rules with no DOM. Everything here is unit-tested.
  - `data.ts`: unit types, map and starting setup. Tune balance here.
  - `campaign.ts`: the strategic layer (turns, economy, movement, battle start/finish).
  - `ai.ts`: orc strategic AI.
  - `units.ts`: troop and hero levels, hit points, mana and attack.
  - `battle.ts`: the tactical layer (movement, combat, morale, spells), plus a battle AI that also powers auto-resolve and casts spells.
  - `hex.ts`, `rng.ts`: helpers. The RNG is seeded and stored in the save, so games can be replayed.
- `src/ui/`: rendering into DOM/SVG. No game rules live here.

## Battle math

`killed = power × attack × roll(0.7–1.3) × (1.5 if the target is running) ÷ (defense × 4)`, with at least 1 killed and never more than the target has. `power` is the troop's men, or a fixed value for a hero (Lord/Champion 12, Priest 8, Mage 6). A melee defender that survives strikes back at half strength. Missile units can't fire while an enemy is next to them. Forest and hills cost 2 movement and give +1 defense. If the attacker hasn't won after 20 rounds, the defender holds and the attacker falls back.
