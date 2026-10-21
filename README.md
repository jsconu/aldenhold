# Aragon (working title)

A browser remake of *Sword of Aragon* (SSI, 1989): run your towns, raise troops, march across the province and fight turn-based hex battles against the orcs of Gharzak Hold.

```bash
npm install
npm run dev     # play at http://localhost:5173
npm test        # rules tests, including seeded chapter playthroughs
npm run simulate:chapter -- 1 42 2026 # chapter economy/combat report
npm run simulate:quests -- 1 42 2026  # paid optional-quest expedition
npm run build   # type-check and build to dist/
```

See [docs/design.md](docs/design.md) for the original prototype design and code layout. The approved expansion plan is in [completion requirements](docs/completion-requirements.md) and [expanded campaign](docs/expanded-campaign.md) ([archived v1 Word document](docs/Aragon_Game_Completion_Requirements.docx)); track implementation in [progress](docs/implementation-progress.md) and the [backlog](docs/backlog.md).

The game autosaves to your browser after every action. **Saved games** has three named manual slots and three rotating recovery positions made before months, quest choices, imports, restores and new campaigns. Use **Export save** for a JSON backup you can keep outside the browser or **Import save** to restore one. Version 2–11 saves migrate to version 12, including battles already in progress. The original legacy storage slot is retained. Invalid saves pause autosaving until you import a valid save or choose New game; storage failures show a warning.

Battles field the first 27 formations per army. Additional formations appear in the reserve list and remain off-field for that battle. They earn no combat XP or combat losses, but share their army's retreat, pursuit losses and dispersal if cut off. Deployment selection and reinforcement waves are planned for a later increment.

The Western Realm has grown to **52×38 hexes**, with 12 core regional settlements and three border towns/strongholds. Existing Western saves expand automatically while retaining their armies and development. See [map growth and save migration](docs/western-map-growth.md).

The chapter simulation uses normal player commands, monthly save/import checkpoints and auto-resolved battles. See [the reproducible balance baseline](docs/chapter-playthroughs.md) for policies, metrics and limits.

Use the Journal’s **Show** links to locate an active encounter on the map. Tracked quest shortcuts also open the current encounter site; movement and battles still require your commands.

At an encounter site, expand **Expedition** to inspect the troops that will deploy, remain in reserve or wait outside. Hero-only trials leave your ruler and formations outside.

The **Treasury** shows posted receipts and payments by category and location, the cash reconciliation, and unpaid bills. Quest rewards and item sales appear alongside taxes; current-month activity remains separate from closed months.
