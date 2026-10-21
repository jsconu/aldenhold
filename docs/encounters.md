# Authored site encounters: first playable increment

This increment builds on the merged quest engine (#27), item policies (#30) and chapter spine (#31). It does not replace those systems or change map/sprite artwork.

## Playable content

Three optional requests unlock from month two in the Western Realm. Open the quest at its giver, use **View location**, march to the site, and select **Enter the encounter**. The site panel also shows its quest, risk and participation count.

| Quest | Giver / site | Current encounter | Current reward / alternatives |
| --- | --- | --- | --- |
| Q02 One Eye at the Quarry | Harrowgate / Old Quarry | Entire army versus a troll and two orc war bands | Victory: 120 gold and two Healing Draughts; decline or withdraw without reward |
| Q03 Beneath the Old Tower | Duskwater / Old Watchtower | Heroes only versus an orc shaman and war band | Victory: two Healing Draughts and two Mana Draughts; decline or withdraw without reward |
| Q05 The Missing Caravan | Fenwick / Stone Bridge | Entire army versus two war bands and orc archers | Rescue within three months: 150 gold, a Healing Draught and a recorded rescue flag; pay 100 gold ransom instead, or record the loss |

These are **first playable versions**, not completion of every original quest brief. Q02 still needs its cyclops, telegraphed boulder attack, noncombat worker-diversion path and mining consequence. Q03 still needs the minotaur trial and unique equippable shield. Q05 still needs tracking clues, its final goblin-camp location and meaningful later merchant consequences. Current enemies use existing units/art; future monster artwork belongs to the art/content pass.

## Committing a force

`encounterQuote` refuses an unknown/closed/repeated encounter, ongoing or queued battles, an absent army, a hostile force at the site, refitting participants, or a hero-only expedition with no heroes. Sites must be landmarks; expeditions cannot bypass a strategic garrison or annex a town.

A successful quest command records its choice and battle-waiting stage, detaches exactly the eligible troops into a real expedition army and creates a temporary enemy army. Heroes-only encounters leave ordinary formations in their original army outside. Waiting troops are absent from the tactical battle, so they cannot suffer damage, spend movement, cast, earn combat XP or share the expedition's pursuit losses. All participating troops spend their remaining campaign movement.

The battle uses the ordinary tactical/auto-resolve rules. Battlefield reserve limits still apply to large whole-army expeditions. The warning explicitly states ruler-death risk and that withdrawal/defeat end the attempt. Optional quests do not block the chapter.

## Outcomes and persistence

- The saved attempt includes its start month, fixed initial seed, source/expedition/enemy army IDs, exact participant and waiting troop IDs, active/won/lost/withdrawn status and resolution month.
- Tactical losses, hero deaths, mana and XP use the ordinary battle settlement. Victory returns survivors to camp and merges them with waiting companions. Defeat/withdrawal uses the existing retreat, pursuit and cut-off rules; waiting troops remain outside and untouched.
- Temporary site enemies are removed at settlement and never enter the roaming campaign AI. A loss closes the one-attempt expedition; revisiting does not reroll or retry it.
- Settlement records the outcome before evaluating its sponsoring quest's objectives. A victory awards its ordinary quest effects once. Gold goes through the existing treasury receipt; consumables use counted inventory and existing use/sale policies.
- Duplicate `applyBattle`, repeated quest choices and save/reload cannot repeat XP or loot. Tactical rounds never advance the campaign month or the caravan deadline.
- Save schema **v13** adds encounter records; v2–v12 imports gain no invented encounters, loot or history. Storage keys remain unchanged. New quest definitions follow the existing locked-on-import policy.

Save validation binds the committed choice, quest waiting/result state, expedition army, enemy roster, tactical battle and participant snapshot. It rejects missing/unknown attempts, mismatched outcomes, mixed hero-only participation, missing waiting troops, invalid seed/month data, and leftover roaming site enemies. These integrity checks are not a cryptographic anti-cheat system.

## Content contract

Definitions live in `src/content/encounters.ts`; quest variants in `src/content/encounterQuests.ts`. A definition names one sponsoring quest, campaign, landmark, warning, army/heroes mode and fixed enemy roster. Exactly one quest choice starts it. That choice leads to an objective-only stage handling victory, defeat and withdrawal, without a deadline or stage-start spawns.

Content validation checks references, named enemy heroes, force size, landmark classification, campaign compatibility, every outcome and map reachability. Current encounters start by a deliberate quest choice. Automatic surprise triggers, waves, journey interruption/resumption and battle objective families remain later work in #9/#18; this increment must not be counted as all 30 surprise battles.

## Verification

- 288 automated tests pass; TypeScript/Vite production build and whitespace checks pass.
- Regression coverage includes hero-only exclusion, actual deaths and ruler defeat, retreat, one-time XP/rewards, reconciled reward cash, ransom/deadline alternatives, malformed saves, v12 migration and deterministic resumed auto-resolve.
- Compiled-app DOM smoke covers journal-to-site navigation, risk and participation preview, launch, mid-battle reload, withdrawal, permanent outcome and unchanged waiting troops. Canvas image output is stubbed in this nonvisual check; actual browser visual verification remains outstanding.
