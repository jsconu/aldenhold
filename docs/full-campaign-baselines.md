# Full Normal campaign diagnostic

October 22, 2026. Run `npm run simulate:campaign` (default seeds 1, 42, 2026). Use `-- --report-only` to inspect unsuccessful policies without a nonzero exit; this is not acceptance mode. `CHAPTER_TRACE=1` prints each action.

The controller starts through ruler creation on Normal with permanent fog. It uses the existing conservative chapter policy, quoted movement/construction/recruitment/refits/replacements/equipment/quest commands, and the ordinary battle and save validators. It never injects money, men, XP, materials, exploration or quest completion. Frontier travel follows known objective coordinates without inspecting hidden terrain.

| Seed | Result | Months | Gold | Ruler | Remaining objectives |
| --- | --- | --- | --- | --- | --- |
| 1 | Lost | 25 | 1902 | Dead | Forge, veteran upgrades, Hold |
| 42 | Lost | 26 | 2127 | Dead | Forge, veteran upgrades, Hold |
| 2026 | Lost | 27 | 2336 | Dead | Forge, veteran upgrades, Hold |

All three runs completed the chapter and obtained the three relics. None had unpaid upkeep, food shortages or ledger corrections. **These are failed full-campaign baselines, not evidence of accepted balance.** They demonstrate a weak preparation policy as well as a separate production dependency found in the rules.

## Capital production blocker

[Issue #76](https://github.com/jsconu/aragon/issues/76): the required capital forge needs local timber and ore. The capital starts with farms, 12 timber and no ore; farms level 2 spend 7 timber. Lumber and mining occupy the two remaining development sites. There is no demolition or material import command to make space for the forge. Four industries are needed across the preparation sequence, but only three can coexist.

Next: implement a legal redevelopment/material-supply path, teach the policy to use it, train/refit veteran formations, then rerun these seeds. Do not lower the fortress difficulty based solely on this controller's failed assaults. Class-specific campaigns, wider seed coverage and the owner's playthrough remain acceptance work.
