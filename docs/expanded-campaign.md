# Expanded authored campaign and endless continuation

Owner direction, October 20, 2026: make the fixed storyline and map much larger, with more set cities, side quests and surprise battles; continue into the infinite frontier after completing that story.

This revision supersedes the original 20-settlement / 18-side-quest / 6–10-hour targets. It is an implementation specification, not a claim that this content is built. Preserve the latest approved pixel art and the existing quick-play campaign.

> **Delivery path (owner decision, October 20, 2026):** these are the long-term targets. The first release is the Western chapter (Act I, R01–R02) on the walkable hex map, with fog, the deep economy and extra ruler classes deferred until after it. See [backlog.md](backlog.md) for the decisions and the work queue.

## Scope and pacing targets

| Deliverable | Revised target |
| --- | --- |
| Authored world | Eight distinct regions; initial design canvas 128 × 80 real traversable hexes |
| Settlements | 48 fixed, named cities and strongholds; all previous C01–C20 retained |
| Main story | Six acts, 24 major objectives; meaningful allied and conquest paths |
| Authored side quests | 72 unique quests including the previous Q01–Q18; multi-stage choices and persistent consequences |
| Sites | At least 60 authored non-city locations: ruins, shrines, caves, mines, camps, passes and crossings |
| Surprise battles | At least 30 authored scenarios, separately counted from routine patrols and random encounters |
| Encounter variety | At least 32 reusable tactical layouts/objectives; authored scenarios may share a layout but need distinct triggers and stakes |
| Main-story duration | 40–60 hours on normal difficulty, a playtest target rather than a guarantee |
| Broader exploration | 70–100 hours for extensive optional content, subject to actual playtests |
| Continuing game | Same save and empire enters a persistent procedural frontier after the story ending |

Travel distance and repeated fights do not count as content. Deliver about two or three meaningful decisions per ordinary campaign month: investments, diplomacy, exploration, battles or quest choices. Make journey estimates, multi-month orders, governors and notifications practical before the empire becomes large. Optional quick battle resolution and animation speeds must reduce repetition without changing rewards.

## Eight regions and fixed settlement roster

Names C01–C20 keep the previously defined IDs; C21–C48 below are new proposed original locations. Each city needs a unique economic role, political relationship, recruitment or service distinction, local story and recognizable visual silhouette. These are content specifications, not decorative markers.

| Region | Six fixed cities / strongholds | Strategic identity |
| --- | --- | --- |
| R01 Crown Valley | Aldenhold C01; Fenwick C02; Millbrook C03; Westmere C05; Oakcross C21; Bellwater C22 | Inheritance, grain, river trade, disputed local authority |
| R02 Western March | Harrowgate C04; Duskwater C06; Thornwatch C23; Redford C24; Saltwick C25; Ironbridge C26 | Border defenses, timber, customs, smuggling and crossing control |
| R03 Elderwood | Greenveil C07; Silverthorn C16; Mossgate C27; Starfall Grove C28; Wrenhaven C29; Elderwatch C30 | Woodland treaties, rare resources, scouts and sacred sites |
| R04 Reed Coast | Reedhaven C09; Willowford C14; Miretooth C20; Brineport C31; Reedspire C32; Gullmere C33 | Fisheries, mounted clans, river freight and troll extortion |
| R05 Ironspine | Stonejaw C10; Emberdelve C11; Gharzak Hold C12; Hammerdeep C34; Frostgate C35; Cinderpass C36 | Ore, foundries, giant and orc powers, defended mountain routes |
| R06 High Reaches | Highreach C17; Cloudrest C37; Stormhold C38; Whitefall C39; Sunspire C40; Griffon Gate C41 | Titan diplomacy, exposed supply routes and ancient fortresses |
| R07 Southern Principalities | Ashcrown C13; Southwatch C15; Duskport C42; Rosekeep C43; Crownford C44; Sablecourt C45 | Succession disputes, urban wealth and rival claimants |
| R08 Imperial Heartland | Blackfen Citadel C08; Eastridge C18; Veyrath C19; Argent Cross C46; Kingsmere C47; Lastwall C48 | Imperial logistics, competing alliances, capital siege and settlement |

Region placement is a design target. Preserve known historical names only as references in the original crosswalk; all new locations are original. Major roads, watersheds and resource dependencies must explain why the cities exist. Crossing routes need alternatives with real costs; mandatory content must never depend on a random spawn. One full map can be implemented as adjacent authored chunks with stable global hex coordinates.

## Six-act storyline

| Act | Four main objectives | Stakes and transition |
| --- | --- | --- |
| I Inheritance | M01 claim Aldenhold and choose a ruler; M02 secure food and civic legitimacy; M03 settle the western crossing dispute; M04 survive the first coordinated incursion | Establish a viable realm and a reason to venture beyond it |
| II The Divided March | M05 reach a woodland settlement; M06 resolve coastal extortion; M07 unite or subordinate the western trade corridor; M08 recover the first royal relic | Early decisions create allies, enemies and different recruitment paths |
| III The Mountain War | M09 reopen the forge road; M10 overcome the Gharzak coalition; M11 secure a giant/titan agreement or military alternative; M12 recover the second relic | Gharzak is a regional victory, not the ending of the full campaign |
| IV The Broken Crown | M13 investigate the southern succession; M14 expose an imperial proxy; M15 defend against a counter-invasion; M16 recover the final relic | Earlier allies and neglected grievances return as consequences |
| V The Imperial Campaign | M17 establish forward supply; M18 resolve Eastridge's offer; M19 breach the outer defenses; M20 take Veyrath | Multiple approaches to the final siege; choices affect enemy strength and aid |
| VI A Realm to Keep | M21 resolve the surrender and surviving claimants; M22 secure disputed provinces; M23 form the new realm's charter; M24 coronation and frontier expedition | Deliver a proper story ending and epilogue, then offer seamless continuation |

The original M01–M12 descriptions are retained as source material to remap into this larger sequence. The quick-play campaign keeps its existing Gharzak win condition. The expanded campaign must have its own victory rules and saved stage, without changing the meaning of a quick-play save.

At least two main objectives per act permit a noncombat or negotiated solution. Optional quest failures can make future objectives harder but cannot silently block all routes to the ending. Show act progress and unresolved regional leads without exposing undiscovered secrets.

## Side quests Q19–Q72

Retain Q01–Q18. The following 54 content seeds establish the expanded backlog; each needs a full authored manifest, choices, outcomes, tests and assets before it counts as complete. Grouping does not force a linear order.

| IDs | Regional story arc / nine quest seeds | Lasting consequences |
| --- | --- | --- |
| Q19–Q27 | Crown Valley: A Debt of Seed; The Broken Weir; Bellwater's Missing Heir; The False Tax Collector; Oakcross Winter Stores; The Unburied Standard; A Soldier's Petition; The Locked Ferry; The Harvest Oath | Food capacity, tax trust, local access and veterans joining later |
| Q28–Q36 | Western March: The Salt Road; The Tollkeeper's Books; Smoke over Thornwatch; The Redford Hostages; The Rival Captain; Ironbridge at Midnight; The Smuggler's Witness; The Abandoned Hospital; The Border Wedding | Trade terms, crossing rights, medical services, alliance or feud |
| Q37–Q45 | Elderwood / Reed Coast: Roots beneath the Forge; The Starfall Pact; The Lost Ranger; The Reed Census; The Flooded Tomb; Wrenhaven's Debt; The Brineport Blockade; The Swan Banner; The Lantern Keeper | Logging policy, scouting, fish supply, freight and sacred-site access |
| Q46–Q54 | Ironspine: Hammerdeep's Strike; The Cinder Survey; The Broken Lift; A Giant's Ransom; The Frozen Messenger; The False Ore Vein; The Buried Arsenal; The Tunnel Accord; The Last Forgekeeper | Skilled labor, dependable deposits, armory access, passes and siege tools |
| Q55–Q63 | High Reaches: Stormhold's Watch; The Titan's Oath; The Griffin Nest; Whitefall Refugees; The Skybridge; The Sunspire Archive; A Winter Truce; The Silent Signal; The Cloudrest Healer | Supply resilience, engineers, weather knowledge, alliance and healing |
| Q64–Q72 | Principalities / Heartland: The Widow's Claim; Sablecourt's Ball; Crownford's Debtors; The Duskport Papers; The Argent Mint; The Kingsmere Bargain; Lastwall's Deserters; The Prisoner Exchange; The Unfinished Coronation | Legitimacy, enemy intelligence, currency confidence and postwar settlement |

At least 24 quests have noncombat resolutions; 18 affect production, trade, services or recruitment; 12 produce consequences in another region or act. Unique authored quests cannot be counted twice as repeatable contracts. Include short local stories alongside longer linked quest chains. The journal should expose enough leads to prevent aimless travel while preserving genuine discoveries.

## Surprise battles and dynamic threats

Create 30 authored scenarios spread through all six acts: six ambush/interception scenarios, six relief or defensive battles, six betrayal or infiltration encounters, six roaming-threat or monster encounters, and six multi-wave siege/counteroffensive scenarios. All need stable IDs, eligibility, a tactical objective, location, participating factions, retreat/defeat behavior and a one-time or explicit repeat policy.

Examples: a bridge gate closes behind a marching column; an apparently surrendered garrison opens a second gate; mercenaries arrive during a relief attempt; a convoy is attacked while the main army is away; an excavation wakes a buried creature; a disgruntled ally supports a rival claimant; an imperial force attacks a supply depot during a siege.

**SURPRISE-01 Fair information.** Scouts, rumors, intercepted messages, terrain, visible supply strain or political warnings must offer ways to assess and reduce danger. A surprise may hide exact timing or composition; it must not routinely produce unavoidable ruler death or an undefendable lost capital.

**SURPRISE-02 Bound triggers.** Evaluate eligibility and select the encounter once in deterministic campaign event processing. Save the selected encounter, seed, participants and result. Repeated clicking, reloading or revisiting must not reroll or repeat rewards.

**SURPRISE-03 Counterplay.** Provide at least one sensible response: scout, escort, negotiate, take a longer route, reinforce, withdraw or accept a visible risk. Some surprises can still occur after precautions, with smaller losses or improved starting positions.

**SURPRISE-04 Campaign continuity.** Interrupt journeys and monthly orders safely. Combat completion resumes the remaining committed work exactly once. A captured site, dead actor or previous encounter may invalidate a queued scenario; resolve its fallback before spawning units.

**SURPRISE-05 Escalation budget.** Do not stack major invasions while the player is resolving another unavoidable scripted crisis. Scale encounter composition by region, act and intelligence, not by arbitrarily matching every player upgrade. Veteran equipment and careful economic preparation must remain valuable.

## Same-world continuation

**CONTINUE-01** Save `campaignCompleted` separately from whether play is active, and a mode/phase distinguishing authored story, epilogue and frontier. Coronation records the ending once and offers Continue into the frontier or Finish here. Choosing to finish keeps a resumable campaign save.

**CONTINUE-02** Preserve all authored city ownership and development, treasury, stocks, armies, levels, equipment, living heroes, relics, completed quests, treaties, journal, fog, borders and unresolved optional quests. No reset or second realm is required. Existing pending orders must settle or transfer exactly once during the handoff.

**CONTINUE-03** Open pre-authored frontier approaches only after the story milestone. Generate new connected regions beyond the fixed map; never overwrite authored geography, reset conquered strongholds or repeat the main story's unique rewards. Side quests with living actors can remain available after the ending, with defined postwar variations.

**CONTINUE-04** Keep unit levels bounded. Frontier challenges arise from distance, supply, unfamiliar factions, competing powers and multi-front defense. Governors and provincial budgets make 48+ cities manageable; the same treasury/stock conservation rules apply to remote simulation.

**CONTINUE-05** Validate a full handoff fixture with a developed empire, ongoing caravan/refit/construction orders and a partly completed optional quest. Saving before and after the handoff must produce identical carried state, one coronation record and no duplicate assets or rewards.

## Delivery sequence and exit criteria

1. Finish the common rules and staged quest/event foundation; keep quick-play as a regression scenario.
2. Deliver a complete western chapter (R01–R02, 12 settlements) with the first act and a mix of local quests and surprise encounters.
3. Add the next regions in playable act-sized increments, integrating economy, diplomacy and quests as each arrives.
4. Complete all eight regions and six acts, with browser checks, playthroughs and measured pacing. Increase variety or adjust travel when playtests show filler; map dimensions alone do not demonstrate longer meaningful gameplay.
5. Deliver the post-story continuation gate, first connected procedural region and carryover tests, then expand the frontier's variety and performance budget.

Revised art budget: 48 settlement markers and 48 city views, eight regional visual identities, 60 site placements with reusable state-aware families, 30 surprise-scenario presentations, and 32 tactical layout families. Reuse appropriate terrain and prop atlases; no requirement for a bespoke illustration for every quest. This increases the original city and battle budgets while retaining the approved pixel-art direction.
