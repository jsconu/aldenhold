# Reproducible chapter playthroughs

Run `npm run simulate:chapter -- 1 42 2026` for a compact report. Pass any positive 32-bit integer seeds; without arguments it uses those three. `CHAPTER_TRACE=1 npm run simulate:chapter -- 42` also prints the commands and monthly checkpoints. A failed chapter, dead ruler, unpaid bill, player-town food shortage or treasury correction makes the command exit nonzero.

The same controller runs in the normal `npm test` CI suite. It starts a fresh Western Realm on the game's current default rules; there is no separate difficulty selector. It uses the recruitment, construction, movement, diplomacy, month and battle commands used by the UI. It never edits ownership, gold, food, XP or quest outcomes, and never calls fixture-only helpers. A rejected command is an error, rather than an excuse to grant resources.

## Policies

Both policies upgrade Aldenhold's farms, raise the two formations needed for M01, send an existing militia as a road envoy to Fenwick, and sign Q00. The ruler stays in the capital. Millbrook gradually receives three spearmen and two archer formations. Recruitment respects a cash reserve and population limits. Movement plans cheapest reachable routes to an adjacent diplomatic location and avoids starting battles or capturing towns with the envoy.

- **Charter:** send the envoy onward to Westmere; reserve 250 gold for M03 and buy its charter when affordable.
- **Ignore:** leave Westmere's dispute unanswered, allowing its real deadline or world events to settle it. Invest the unused charter funds in the garrison sooner.

Monthly taxes, payroll, construction, production, growth, random offers, raids, quest deadlines and incursion movement all run. Every battle is auto-resolved. Each monthly checkpoint and both pending and resolved battle checkpoints pass through the player's strict save importer before play continues.

## Initial baseline

Forty runs (20 seeds × two policies) completed the chapter with the ruler alive, no unpaid wages/maintenance, no player food shortage and no treasury corrections. Seeds: 1–10, 42, 99, 777, 1989, 2026, 12345, 65535, 999999, 2147483647 and 4294967295.

| Policy | Months elapsed | Ending gold | Lowest observed gold | Battles | Formation casualties |
| --- | --- | --- | --- | --- | --- |
| Charter | 7 | 400 | 27 | 3 | 9–39 |
| Ignore | 11–12 | 1083–1205 | 27 | 3–4 | 11–39 |

For the charter policy, M01 completes after month 1, M02 after month 2, M03 during month 3, and M04 after month 7. The ignored dispute sometimes ends earlier because the orcs take Westmere; the chapter correctly continues after either failure or supersession. `months` counts elapsed month closures; the game calendar starts at month 1.

CI checks three seeds under both policies, a deterministic replay, and an intentionally truncated run. The provisional 24-month ceiling catches a stuck chapter; it is a regression bound, not an accepted pacing target. Casualties count lost soldiers in nonhero formations, including formations destroyed in battle, without treating later recruitment as a loss reduction. Minimum gold samples after each purchase/action and monthly settlement.

## What this establishes

The current chapter has at least two viable economic and diplomatic policies under automated combat. Both produce meaningful attacks and losses and resume through valid saves. The fixture-free runs guard against impossible quest prerequisites, broken routes, timing regressions and hidden resource grants.

These results do not establish that all strategies work, that tactical battles or optional monsters are balanced, or that the chapter satisfies the much longer full-story target. The seven-month route is a short Act I baseline. Before accepting chapter balance, the owner still needs to play it, assess pacing and tactical difficulty, and agree to a target window. Optional quest balance, human battle tactics, the art pass and the final title remain separate work.
