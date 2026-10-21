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

## Open: the minotaur

Q03 is still far too easy: any single hero, even a healer, wins 98% of the time. A sweep of its strength gave these win rates (300 fights each):

| Minotaur men | Champion alone | Priest alone | Mage alone | Champion + priest |
| --- | --- | --- | --- | --- |
| 8 (now) | 98% | 98% | 98% | 100% |
| 12 | 96% | 8% | 97% | 97% |
| 13 | 92% | 0% | 84% | 98% |
| 14 | 70% | 0% | 72% | 98% |
| 15 | 46% | 0% | 49% | 98% |

At 14, a lone fighter or mage takes a real gamble (about 70%, with a 30% chance of losing the hero if they never retreat), and a pair is safe. But a lone priest can no longer win. Codex's seeded expedition tours (`questExpedition.ts`) send exactly that, a hired priest alone into the vault, and twelve of their CI checks assert that it wins. So tuning the minotaur means also changing that controller to bring a fighting hero (or a pair). That is a design decision, left for the owner.
