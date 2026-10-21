# Reproducible chapter playthroughs

Run `npm run simulate:chapter -- 1 42 2026` for a compact report. Pass any positive 32-bit integer seeds; without arguments it uses those three. `CHAPTER_TRACE=1 npm run simulate:chapter -- 42` also prints the commands and monthly checkpoints. A failed chapter, dead ruler, unpaid bill, player-town food shortage or treasury correction makes the command exit nonzero.

The same controller runs in the normal `npm test` CI suite. It starts a fresh Western Realm on the game's current default rules; there is no separate difficulty selector. It uses the recruitment, construction, movement, diplomacy, month and battle commands used by the UI. It never edits ownership, gold, food, XP or quest outcomes, and never calls fixture-only helpers. A rejected command is an error, rather than an excuse to grant resources.

## Policies

Both policies upgrade Aldenhold's farms, raise the two formations needed for M01, send an existing militia as a road envoy to Fenwick, and sign Q00. The ruler stays in the capital. Millbrook gradually receives three spearmen and two archer formations. Recruitment respects a cash reserve and population limits. Movement plans cheapest reachable routes to an adjacent diplomatic location and avoids starting battles or capturing towns with the envoy.

- **Charter:** send the envoy onward to Westmere; reserve 250 gold for M03 and buy its charter when affordable.
- **Ignore:** leave Westmere's dispute unanswered, allowing its real deadline or world events to settle it. Invest the unused charter funds in the garrison sooner.

Monthly taxes, payroll, construction, production, growth, random offers, raids, quest deadlines and incursion movement all run. Every battle is auto-resolved. Each monthly checkpoint and both pending and resolved battle checkpoints pass through the player's strict save importer before play continues.

## Initial baseline before the city quests

Forty runs (20 seeds × two policies) completed the chapter with the ruler alive, no unpaid wages/maintenance, no player food shortage and no treasury corrections. Seeds: 1–10, 42, 99, 777, 1989, 2026, 12345, 65535, 999999, 2147483647 and 4294967295.

| Policy | Months elapsed | Ending gold | Lowest observed gold | Battles | Formation casualties |
| --- | --- | --- | --- | --- | --- |
| Charter | 7 | 400 | 27 | 3 | 9–39 |
| Ignore | 11–12 | 1083–1205 | 27 | 3–4 | 11–39 |

These figures preceded Q01's granary rot. On that earlier build, the charter policy completed M01 after month 1, M02 after month 2, M03 during month 3, and M04 after month 7. The current numbers are below. The ignored dispute can end early because the orcs take Westmere; the chapter continues after either failure or supersession. `months` counts elapsed month closures; the game calendar starts at month 1.

CI checks three seeds under both policies, a deterministic replay, and an intentionally truncated run. The provisional 24-month ceiling catches a stuck chapter; it is a regression bound, not an accepted pacing target. Casualties count lost soldiers in nonhero formations, including formations destroyed in battle, without treating later recruitment as a loss reduction. Minimum gold samples after each purchase/action and monthly settlement.

## What this establishes

The current chapter has at least two viable economic and diplomatic policies under automated combat. Both produce meaningful attacks and losses and resume through valid saves. The fixture-free runs guard against impossible quest prerequisites, broken routes, timing regressions and hidden resource grants.

These results do not establish that all strategies work, that tactical battles or optional monsters are balanced, or that the chapter satisfies the much longer full-story target. The seven-month route is a short Act I baseline. Before accepting chapter balance, the owner still needs to play it, assess pacing and tactical difficulty, and agree to a target window. Optional quest balance, human battle tactics, the art pass and the final title remain separate work.


## Paid optional-quest expeditions

`npm run simulate:quests -- 1 42 2026` hires the starting priest for 300 gold, sends that priest with an existing militia, spearmen and archers on a real march, develops the capital and recruits a home garrison. It hears the caravan plea at Fenwick, rescues the caravan at the mine, clears the quarry, and enters the tower with the hired priest alone. The lord stays home. It deliberately withholds Fenwick's optional signature to keep M02 open while exploring; it never edits a quest or pauses the calendar.

Twenty diagnostic seeds (the list above) complete all three optional quests in 13–14 months. The caravan is rescued in month 7, the quarry in month 10, and the tower in month 13 or 14. All rulers and priests survive, with three earned Healing Draughts, +25% mine yield, 4–6 priest XP, no unpaid bills, no food shortages and no treasury corrections. The paid hire legitimately empties the initial treasury; later settlement remains solvent. Formation casualties range from 0 to 30. Seed 9 needs a second tower attempt in the following campaign month, after the priest recovers.

Set `CHAPTER_FINISH=1 npm run simulate:quests -- 1 42 2026` to return the party to Fenwick, sign the charter and finish Act I too. These three longer runs finish in 21–27 months with all optional encounters complete, a living ruler/priest and no economic shortfalls. The 24-month bound for the shorter main-story policies does not apply to this optional tour; its guard is 36 months. CI covers three expeditions, the seed-9 retry, and the full seed-1 chapter return.

The longer tour exposed a quest-ownership defect: Westmere may fall to the orcs before M03 unlocks. New offers now check their giver's current ownership against the authored starting ruler. A fallen guild resolves through its loss branch, with no stage-start spawns or treaty purchase; a previously player-conquered Westmere completes its conquest objective without charging a charter fee. Quotes block a stale open offer immediately, and the next quest phase settles such an offer imported from an older save. Merchant quests explicitly marked to survive player conquest remain available. Existing completed rewards and save schema v12 remain intact.

These are feasibility and persistence checks using automated tactics; optional encounter difficulty still needs a human assessment.

## Current Western chapter pass after Q01 and Q06

Replayed the same 20 seeds under both main-story policies after the city quests were added. All 40 completed with a living ruler, no unpaid bills, player-town food shortage or treasury correction. The policies deliberately leave Q01 unanswered, so the rot delays M02; the population consequence also occurs. This is a measured policy choice, not a claim that buying or escorting grain is unaffordable.

| Policy | Months elapsed | Ending gold | M01 → M02 → M03 → M04 |
| --- | --- | --- | --- |
| Charter | 9 in all 20 | 617 | 1 → 4 → 5 → 9 |
| Ignore | 11–14 | 1,051–1,394 | M03 may fail or be superseded; M04 follows |

For a longer real-command tour, run `CITY_CHOICES=buy-convict CHAPTER_FINISH=1 npm run simulate:quests -- 1 42 2026`, or use `escort-convict` or `ration-pardon`. The controller pays for the priest, raises and marches real troops, fights and resumes the three encounter battles through save import, resolves Q01 and Q06 through their quoted choices, then returns to Fenwick and finishes Act I. It spends on the time-limited granary before optional garrison recruitment; doing the reverse caused the buy path to miss its deadline. No game rules or resources were changed to make that route work.

Across the 20 listed seeds, both buy/convict and ration/pardon tours won in 21–28 months with Q01, Q02, Q03, Q05 and Q06 succeeded, a living ruler and priest, no unpaid bills, shortages or corrections. The paid priest temporarily brought cash to zero. An escort/convict tour was also checked on seeds 1, 42 and 2026: Q01 transfers actual Millbrook food while the army is there and ends successfully; it completes Act I in 21–27 months. CI covers those three seeds under each city policy, including exact choice actions and saved outcomes.

Q04 is a distinct, time-limited route. `WOODLAND_ACCORD=1 CITY_CHOICES=buy-convict CHAPTER_FINISH=1 npm run simulate:quests -- 1` sends a paid-for militia envoy to Greenveil and signs the logging cap. Its alliance counts toward M02's stated standing goal, bringing the incursion forward. Seed 1 finishes Act I in 11 months with Q01, Q02, Q04, Q05 and Q06 resolved but before the party reaches Q03's tower; the game ends and cannot finish that optional trial in the same save. This is an unresolved campaign-continuation design question for the next act, not a broken quest or a reason to discount allied standing. The owner still needs a hands-on tactical and pacing playthrough.

## After encounter tuning (cyclops 18 men, fearless monsters, minotaur 14 men)

The expedition now hires a champion or mage for the tower, never sends the priest in alone, replaces fallen heroes, and rebuilds with reinforcements after a lost fight; see [encounter odds](encounter-odds.md). Over the 20 seeds above:
- **Full buy/convict chapter tours** win with all 20 seeds, in 17–33 months.
- **The plain expedition** finishes all three optional quests in 12–17 months for 19 seeds. Seed 8 loses the tower fight and doesn't recover within 24 months.

The figures in earlier sections predate this tuning.
