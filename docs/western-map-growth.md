# Western Realm map growth (9b)

The fixed Western Realm is now **52×38 hexes**, up from 40×28: 1,976 cells versus 1,120, about 76% more area. The released 40×28 terrain remains unchanged inside the expanded map. Every existing city, landmark and encounter retains its coordinates.

The chapter contains the twelve Crown Valley/Western March settlements from R01–R02, plus Greenveil, Reedhaven and Gharzak Hold as three border locations: **15 settlements/strongholds** and **12 non-city landmarks**. This is the Western chapter increment toward the larger 48-city world, not the entire expanded storyline or procedural frontier.

| New town | Region | Economic role | Resource endowment: farms / timber / ore | Starting garrison |
| --- | --- | --- | --- | --- |
| Oakcross | Crown Valley | Granary and woodland | 1.4 / 1.1 / 0.1 | Militia |
| Bellwater | Crown Valley | River farms | 1.3 / 0.3 / 0 | Militia, Archers |
| Thornwatch | Western March | Forest frontier | 0.6 / 1.7 / 0.6 | Spearmen, Archers |
| Redford | Western March | Ore and pass defense | 0.7 / 0.5 / 1.5 | Militia, Spearmen |
| Saltwick | Western March | Coastal farms and the Salt Road | 1.1 / 0.5 / 0 | Militia |
| Ironbridge | Western March | Ore-rich fortified crossing | 0.6 / 0.7 / 1.6 | Two Spearmen, Archers |

All six begin independent and pay no tax to the player until conquered. Endowments feed the existing production rules; they are not decorative labels or automatic treasury bonuses. New populations and garrisons provide actual recruitment, conquest and development choices. The city panel describes each town's regional role.

The Salt Road Beacon, Southern Crossing and Redford Pass extend the route network. The Aldwater continues through the new southern terrain to the edge of the map. Its crossing requires a road bridge; removing all crossing routes isolates the eastern towns in validation. The existing terrain and settlement rendering is reused; bespoke new-city silhouettes and city storylines remain content/art work.

## Existing saves

This is Western campaign **revision 2**, with save schema still v12. A revision-1 save migrates as follows:

- Keep the original nine towns, ownership/population, buildings, paid projects/refits, goods, treasury and history, armies and IDs, movement, items, quests/treaties, journal, random state and active tactical battle exactly as saved.
- Add six new neutral towns with their declared opening stocks and garrisons. They all stand outside the old map bounds, so no new town or garrison is placed on an existing army's hex.
- Allocate only new IDs above the old counter. Imported garrisons receive no movement for the current month. No old income, building charges, battle XP, reward or journal history is invented.
- Do this once. A save already on revision 2 reloads unchanged. An incomplete/mixed revision-1 town registry or formerly out-of-bounds army is rejected rather than repaired silently. Unknown revisions remain unsupported.

Original terrain is archived in `westernRevision1.ts`; the fixed added terrain and new-town/garrison manifests are in `westernExpansion.ts`.

## Timing and encounter fixes found during expansion

Longer routes exposed an Act I timing bug: the hold-out deadline could award victory in the quest phase immediately before that same month's attackers captured Millbrook. Hold-out success now settles after the monthly AI and all queued battles. Pending attacks defer conquest/chapter victory; capital loss and ruler death still take precedence. Saving during the last-month battle is valid and retains the unresolved hold objective.

A repeated completion callback for an already-settled encounter no longer repeats troop losses or XP. A defeated expedition must regroup until the next campaign month before retrying, preventing repeated retreat/XP farming within one month.

## Verification and remaining work

298 automated tests and the production build pass. Tests cover preserved legacy terrain/coordinates and IDs, road reachability and bridge constraints, distinct production, conquest/tax revenue in the new area, investment/refit/treaty migration, saved cyclops targeting, hero-only party migration, malformed imports, duplicate settlement and a same-month assault on the hold-out deadline.

Browser visual review, distinct new-city artwork, city-specific side quests and measured chapter balance remain outstanding. The full story, further regions and infinite continuation remain in the expanded campaign backlog.
