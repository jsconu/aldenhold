# Aldenhold

**A free browser strategy game inspired by Sword of Aragon and Civilization.**

I was inspired by *Sword of Aragon* and *Civilization*, and wanted to build a successor to those games that anyone can play for free. Aldenhold combines developing cities, exploring an authored world, recruiting armies and heroes, diplomacy, layered quests and turn-based battles. It is an original game in active development.

## Play the prototype

```bash
npm install
npm run dev       # open the local address shown in the terminal
npm test          # rules, saves and seeded campaign playthroughs
npm run build     # type-check and create the production build
```

The playable prototype runs in a browser. A public hosted play link will be added when it is ready; the current version can be run locally from this repository.

## What is playable

- **An authored 76×52 world:** twenty cities and strongholds, the Western Realm and the new Reed Coast. Explore forests, marshes, passes and rivers with real crossing routes. Existing Western saves expand without moving their old geography or resetting armies and development.
- **Three layers of goals:** local side quests, larger regional campaigns such as the Reed Coast Compact, and realm-wide objectives. Two relevant local quests are highlighted; the others remain available. Coastal talks can happen beside guarded cities without attacking them.
- **Cities that support your armies:** improvement levels are uncapped, subject to money, local materials, workforce, deposits and upkeep. Each city provides one army-support place per 20 residents plus 10 per completed improvement level. Each soldier counts once, and each hero counts once regardless of HP. The Cities screen shows population, support and relevant growth tasks.
- **24-unit marches and battles:** large city garrisons can assemble armies, while each marching army and each side of a new battle fields at most 24 units. Scouts and spies stay outside combat. Existing older battles keep their saved limits and positions.
- **City defenses and pillage:** walls, gates, streets and actual developed buildings form settlement battlefields. Defenders can place units before an assault. Attackers can occupy an improvement to destroy a level or take bounded treasury money; collected loot and damage persist, including after retreat.
- **Heroes and scouting:** leaders have HP and recover wounds. The ruler can join leader-only adventures. Stationed scouts provide nearby army intelligence; a distant threat is not automatically known everywhere.
- **A saved campaign:** browser autosaves, named manual slots, rotating recovery positions and JSON import/export. Invalid imports stop autosaving until a valid game is restored or a new one is created. Existing storage keys are retained through the Aldenhold rename.

The nine-location Valley remains a short quick-play mode. The larger world grows through authored regions toward the planned 128×80 world; it is not a promise that every region and story act is already finished. Generated local events can add variety around fixed geography and regional stories.

## Controls

Select an army, tick ready units and click a glowing destination to march. **Select up to 24 to march** helps assemble a party from a large city garrison. Unlit places are inspected rather than marched to. End the month to restore movement.

In battle, select a unit and click a glowing position to move, or a marked enemy to move into range and attack. Use **Move together**, Shift-click or Select all for group movement. Units remain separate, with one unit per tactical hex. Camera zoom, drag-to-pan and the minimap help inspect the field. A city defender can reposition before choosing **Begin city assault**.

The Treasury records taxes, purchases, wages, upkeep, rewards and pillage. Review a construction button to see its exact requirements and any shortage. Export a save for a backup outside the browser.

## Development

See the [implementation progress](docs/implementation-progress.md), [active backlog](docs/backlog.md), [world plan](docs/expanded-campaign.md) and [Reed Coast expansion](docs/reed-coast.md). Historical design files may refer to the former working title Aragon. Those references and stable save identifiers remain to preserve history and compatibility.

Artwork is original project artwork with generation prompts and provenance recorded beside the assets. The new city buildings use restrained colors and detailed materials while leaving troops and movement clear.
