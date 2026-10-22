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

The game autosaves to your browser after every action. **Saved games** has three named manual slots and three rotating recovery positions made before months, quest choices, imports, restores and new campaigns. Use **Export save** for a JSON backup you can keep outside the browser or **Import save** to restore one. Older saves migrate to version 16, including battles already in progress. The original legacy storage slot is retained. Invalid saves pause autosaving until you import a valid save or choose New game; storage failures show a warning.

Battles field the first 27 formations per army. Additional formations appear in the reserve list and remain off-field for that battle. They earn no combat XP or combat losses, but share their army's retreat, pursuit losses and dispersal if cut off. Deployment selection and reinforcement waves are planned for a later increment.

In battle, tick multiple ready blue formations under **Move together**, or Shift-click them on the field. Click a glowing destination to move the group while keeping its shape; the slowest formation sets the movement budget. **Undo battle move** restores the position before the last move, including terrain harm. **Undo march** does the same for the last overland move, even if it just opened a battle. Undo is one step and available only in the current browser session until another consequential action or move.

The present battle model has one formation per hex and 27 deployed formations per side; it does not yet reproduce the original game's point-based tactical stacks. Multiple formations may travel together on an overland hex.

The Western Realm has grown to **52×38 hexes**, with 12 core regional settlements and three border towns/strongholds. Existing Western saves expand automatically while retaining their armies and development. See [map growth and save migration](docs/western-map-growth.md).

The chapter simulation uses normal player commands, monthly save/import checkpoints and auto-resolved battles. See [the reproducible balance baseline](docs/chapter-playthroughs.md) for policies, metrics and limits.

To march in the Western Realm, select the hex with your blue army banner. The ready troops are ticked in **Your troops**; click a glowing nearby hex to send them. Clicking an unlit hex only inspects it. Repeat the march from the new location, and use **End month** when the troops run out of movement. **March your troops** in the sidebar shows how many are ready and can locate an army after you inspect another place.

Use the Journal’s **Show** links to locate an active encounter on the map. Tracked quest shortcuts also open the current encounter site; movement and battles still require your commands.

At an encounter site, expand **Expedition** to inspect the troops that will deploy, remain in reserve or wait outside. Hero-only trials leave your ruler and formations outside.

Battles set up your army automatically: healthy, strong melee formations go in front, while archers, priests, mages and the ruler start behind the screen. There is no formation grid in the city panel. Older saves with custom army plans still load, but new battles use the automatic layout; a battle already in progress keeps its saved positions.

Marching into a defended hostile town opens an assault preview first. It shows the known defenders and the movement cost. Choose **Attack** to march and fight, or **Retreat** to stay at your current location without spending movement. **Besiege** is visible but unavailable until the siege rules are built. Empty towns and lairs use the current arrival rules.

In the Western Realm, recruit a **Scout** in your city. Its troop card offers **Watch city** while it is in an owned town, or **Watch road** on a road hex. Marching it to another place clears the assignment. A watch can report a nearby orc army's planned route in the journal and at the threatened city, about one to three months before arrival when there is enough distance; a surprise force nearby may give no useful lead time. Scouts cost upkeep and are very weak in battle. Monster raid notices currently use their separate warning rules.

The **Treasury** shows posted receipts and payments by category and location, the cash reconciliation, and unpaid bills. Quest rewards and item sales appear alongside taxes; current-month activity remains separate from closed months.
