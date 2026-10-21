# Aragon (working title)

A browser remake of *Sword of Aragon* (SSI, 1989): run your towns, raise troops, march across the province and fight turn-based hex battles against the orcs of Gharzak Hold.

```bash
npm install
npm run dev     # play at http://localhost:5173
npm test        # rules tests
npm run build   # type-check and build to dist/
```

See [docs/design.md](docs/design.md) for the original prototype design and code layout. The approved expansion plan is in [completion requirements](docs/completion-requirements.md) and [expanded campaign](docs/expanded-campaign.md) ([archived v1 Word document](docs/Aragon_Game_Completion_Requirements.docx)); track implementation in [progress](docs/implementation-progress.md) and the [backlog](docs/backlog.md).

The game autosaves to your browser after every action. Use **Export save** for a JSON backup, **Import save** to restore one, or **New game** to start over. Version 2–12 saves migrate to version 13, including battles already in progress. The original legacy storage slot is retained. Invalid saves pause autosaving until you import a valid save or choose New game; storage failures show a warning.

Battles field the first 27 formations per army. Additional formations appear in the reserve list and remain off-field for that battle. They earn no combat XP or combat losses, but share their army's retreat, pursuit losses and dispersal if cut off. Deployment selection and reinforcement waves are planned for a later increment.

The Western Realm now includes optional site expeditions for the Quarry, Old Tower and Missing Caravan. Review the risks and force before entering; only heroes enter the Old Tower. See [encounter behavior and remaining content](docs/encounters.md).
