# Aragon: design notes

A remake of *Sword of Aragon* (SSI, 1989). We keep its rules and campaign structure and put a modern UI on top. "Aragon" is only the codename. The original names, story and art belong to the rights holder, so everything we ship uses our own names and art.

## What the original game does

- **Campaign.** You inherit a city after your father dies. Orcs and other enemies threaten the province, and the goal is to unite it. The game runs in monthly turns.
- **Economy.** Each city has population and a tax rate. Higher taxes bring in more gold now but slow growth. Gold pays for recruiting and monthly upkeep.
- **Armies.** Troops are recruited in cities, gain experience and level up between battles. Leaders and spellcasters (priests, mages) lead armies.
- **Tactical battles.** Fought on a hex grid. Movement, melee, missile fire, terrain, morale and spells.

## First milestone: a thin full loop (v0.1)

Each part is basic, but they all connect: **recruit → march → fight → capture → collect taxes → repeat.**

| Area | In v0.1 | Later |
|---|---|---|
| Province map | Graph of 9 locations (towns, waypoints, orc hold) | Tile/hex overland map, terrain, roads |
| Turns | One month per turn; each troop moves one step per month | Movement points, forced march, seasons |
| Economy | Population, tax rate (0–50%), growth, upkeep, desertion when broke | Loyalty and unrest, buildings, trade |
| Recruiting | Militia, Spearmen, Archers; Knights only at the capital | Equipment upgrades, mercenaries, hiring heroes |
| Troops | Men count, experience, up to 3 levels (+15% attack each) | Named leaders, hero classes, items |
| Battles | 12×9 hex grid, forest/hill, zone of control, melee with counterattack, missile fire, town walls (+1 defense), retreat, auto-resolve | Morale and routing, spells, flanking, deployment phase |
| Enemies | The orc hold raises warbands and trolls and sends out raiding parties toward the nearest town | Several factions, diplomacy, events |
| Neutral towns | Held by local militia; you take them by force | Win them over with gold or a quest |
| Win/lose | Take Gharzak Hold to win; lose Aldenhold and you lose | Multi-stage campaign, score |
| Save | Autosaves to the browser after every action | Multiple save slots, export |

## Code layout

- `src/game/`: pure rules with no DOM. Everything here is unit-tested.
  - `data.ts`: unit types, map and starting setup. Tune balance here.
  - `campaign.ts`: the strategic layer (turns, economy, movement, battle start/finish).
  - `ai.ts`: orc strategic AI.
  - `battle.ts`: the tactical layer, plus a battle AI that also powers auto-resolve.
  - `hex.ts`, `rng.ts`: helpers. The RNG is seeded and stored in the save, so games can be replayed.
- `src/ui/`: rendering into DOM/SVG. No game rules live here.

## Battle math (v0.1)

`killed = men × attack × roll(0.7–1.3) ÷ (defense × 4)`, with at least 1 killed and never more than the target has. A melee defender that survives strikes back at half strength. Missile units can't fire while an enemy is next to them. Forest and hills cost 2 movement and give +1 defense. If the attacker hasn't won after 20 rounds, the defender holds and the attacker falls back.
