# Encounter odds

`npm run simulate:encounters -- 300` fights every quest encounter against the parties a player plausibly brings at that point in Act I (`src/game/testing/encounterOdds.ts`). Each fight is a fresh, automated battle on the encounter's own ground, seeds 1 to N. Both sides use the game's battle AI, which never retreats. In real play you can retreat from an encounter and try again, so hero death rates here are a ceiling.

This measures difficulty for tuning. It doesn't replace the owner playing the battles.

## Proposed targets (provisional, for the owner to confirm or change)

| Who | Target |
| --- | --- |
| The party an encounter is meant for | Wins 75–95%, with hero deaths under 10% |
| A thin party (no hero against a boss; a single hero in the tower) | A real gamble: wins 30–70% |
| Q05's goblins | An easier rescue: the expedition wins about 90% or more |

## Before tuning

With 300 fights each, every encounter was won almost every time, by almost any party: a militia band beat the cyclops 100% of the time, and a lone priest beat the minotaur 98%. There were two reasons:
- **Morale:** monsters could break and run like ordinary soldiers.
- **Strength:** a monster's men count is both its hit points and its fighting weight, and it was low (cyclops 10, minotaur 8).

## Changes in this pass

- **Fearless monsters:** the cyclops and the minotaur no longer lose morale or run, and Terror can't target them. They fight until they fall. Goblins and orcs are unchanged.
- **The cyclops** has 18 men (was 10).

| Encounter | Party | Wins | Hero died | Men lost | Rounds |
| --- | --- | --- | --- | --- | --- |
| Q02 cyclops | Lord with the starting army | 100% | 0% | 24% | 4.1 |
| Q02 cyclops | Priest with militia, spearmen and archers | 95% | 4% | 37% | 6.2 |
| Q02 cyclops | Militia, spearmen and archers (no hero) | 32% | 0% | 68% | 6.0 |
| Q03 minotaur | Champion alone | 98% | 2% | 32% | 3.6 |
| Q03 minotaur | Priest alone | 98% | 2% | 33% | 7.8 |
| Q03 minotaur | Mage alone | 98% | 2% | 34% | 3.7 |
| Q03 minotaur | Champion and priest | 100% | 1% | 4% | 3.6 |
| Q05 goblins | Lord with the starting army | 100% | 0% | 8% | 2.9 |
| Q05 goblins | Priest expedition | 100% | 0% | 8% | 3.5 |
| Q05 goblins | Militia, spearmen and archers | 99% | 0% | 19% | 3.3 |

The cyclops now meets the targets: it's a hero-led fight. Q05 is at the easy end, which suits a rescue. Its band rate is above the thin-party range, but the goblins aren't a boss.

## The minotaur (decided: tuned)

The owner chose to tune the minotaur and have the expedition bring a fighting hero. It now has 14 men (was 8):

| Party | Wins | Hero died | Men lost |
| --- | --- | --- | --- |
| Champion alone | 70% | 30% | 84% |
| Mage alone | 72% | 28% | 76% |
| Priest alone | 0% | 100% | 100% |
| Champion and priest | 98% | 5% | 12% |

A single fighting hero takes a real gamble. (The battle AI never retreats; in play you can retreat and try again, so a player risks far less.) A pair is the intended party, and a lone healer can't win.

Sweep of the minotaur's strength before the decision (300 fights each):

| Minotaur men | Champion alone | Priest alone | Mage alone | Champion + priest |
| --- | --- | --- | --- | --- |
| 8 (before) | 98% | 98% | 98% | 100% |
| 12 | 96% | 8% | 97% | 97% |
| 13 | 92% | 0% | 84% | 98% |
| 14 (chosen) | 70% | 0% | 72% | 98% |
| 15 | 46% | 0% | 49% | 98% |

### The seeded expedition controller
`src/game/testing/questExpedition.ts` used to send its priest into the vault alone. It now:
- **Hires a fighter:** the first champion or mage offered after the priest, once Q01's time-limited granary choice is settled so its gold isn't spent first. That hero marches to the Old Watchtower on its own and joins the party there.
- **Never sends the priest in alone:** the party waits at the tower until the fighter has joined.
- **Replaces fallen heroes:** a priest or fighter who dies leaves the party, a new one is hired when offered, and the tour reports `heroesLost`.
- **Rebuilds after a lost fight:** it doesn't take on the cyclops or the goblins with fewer than two formations, and raises spearmen at the capital to reinforce the party. This matters since the cyclops was tuned (#45): seed 3's tour once lost that fight, and its priest kept attacking alone.

Over the 20 documented seeds:
- **The expedition tour** finishes all three optional quests in 12–17 months for 19 seeds. Seed 8 is the rare case where the tower pair loses (both heroes die); its replacements don't arrive within the tour's 24 months.
- **The full buy/convict chapter tour** wins with all 20 seeds, in 17–33 months. Seed 3's 33 months include losing the cyclops fight once, rebuilding and winning.
