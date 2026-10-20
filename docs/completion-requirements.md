# Aragon Game Completion Requirements

Implementation and art production specification

Prepared for Justin Scoville • October 20 2026 • Version 1

## 1 Completion goal and scope

Finish Aragon as a single-player browser strategy RPG with a complete authored campaign: govern a starting realm, explore an overland map, negotiate with neighboring powers, develop an army, resolve local stories, recover three royal relics, and defeat the imperial capital. Preserve the current fast tactical loop while making the world worth exploring.

The recommended release contains 20 named settlements or strongholds, 12 main campaign objectives, 18 side quests, 30 unit archetypes, 19 unique spells including 14 for mage-type units, 24 inventory objects, 18 building families, ten economic goods, and 12 reusable battlefield templates. These are proposed production targets, not counts from the original game. Every required location and quest below must have a playable outcome; a map marker or text description alone is not completion.

The original Sword of Aragon provides a reference for the scale and relationships of the campaign. The repository's existing design policy is to ship original names, writing, and artwork. The city crosswalk therefore retains original names for comparison while specifying proposed names for implementation. Proposed effects, rewards, deadlines, geography, and balancing values are new design decisions unless expressly identified as original-game reference facts.

### Release priorities

| Priority | Meaning | Delivery rule |
| --- | --- | --- |
| P0 | Foundation and campaign correctness | Required before expanding the content set |
| P1 | Complete first release | Required for the finished game described here |
| P2 | Later phase | Planned or optional work outside the first release |

P0 includes campaign state, quest and item handling, factions, stable saves, battle capacity, economic ledgers and goods conservation. P1 includes all 20 settlements, 12 main objectives, 18 side quests, the expanded economy, final artwork, audio essentials, and release checks. The agreed P2 direction is an expandable procedural frontier. Other optional P2 features include multiplayer, succession, naval combat, full city interiors, voice acting, a public map editor and extensive unit animation.

### What finished means

A new player can learn the game, complete a campaign through either alliance-heavy or conquest-heavy play, see consequences from side quests, save and resume during any phase, and reach an ending that reflects their decisions. Optional quests can fail without making the main campaign unwinnable. Every visible gameplay object has a clear interaction or is visibly decorative.

Target a first campaign of roughly 6–10 hours on normal difficulty, to be confirmed through playtesting. This is a tuning goal, not a historical claim or a development estimate.

## 2 Repository baseline and immediate gaps

Baseline: jsconu/aragon, main, commit 4641846ec5caa8e80672e0a434e3e62eaccbec15, dated October 20 2026 UTC. The review covered the design notes, rules, state types, UI rendering, SVG art, and three rules test files. Evidence references R1–R8 appear at the end.

| Area | Present in source | Work required |
| --- | --- | --- |
| World | Nine graph nodes and 14 connections; six town or lair records | Explorable terrain map, regions, 20 settlements, points of interest |
| Starting realm | Aldenhold and Millbrook already owned | Retain a short tutorial scenario; author a separate full campaign |
| Economy | Gold, population, taxes, upkeep, growth, desertion | Production chains, labor, markets, construction, goods, trade, public budgets and forecasts |
| Forces | 13 types; four recruitable troop types; hireable Champion, Priest and Mage | Five selectable ruler classes, allies, specialist troops, monsters and equipment |
| Tactical rules | 12 by 9 hexes, morale, routing, retreat, auto-resolve, four spells | Deployment, reserves, terrain-aware scenarios, siege objectives and richer AI |
| Terrain and art | Nine terrain definitions; original SVG symbols for all 13 types | Consistent illustrated world, unit tokens, portraits, city views and object art |
| Campaign end | Capture Gharzak to win; lose capital or lord to lose | Chapters, relic requirements, main objectives, multiple endings |
| Persistence | One localStorage save; version 2 check | Validation, migration, save slots, export and visible save errors |

### P0 corrections before adding scale

**BASE-01 Battle capacity.** Current deployment has 27 slots per side and skips a troop when no slot remains. Replace silent omission with an explicit fielded force limit and reserve list. Acceptance: an army with 28 or more formations accounts for every formation before, during, and after combat; reserve casualties and eligibility are explicit.

**BASE-02 Ending precedence.** Current checkStatus checks the captured lair before capital loss or lord death. Define defeat precedence and persist a reason code. Acceptance: winning the last battle while the ruler dies cannot produce a contradictory victory; the loss banner reports ruler death when appropriate instead of always reporting a fallen capital.

**BASE-03 World data separation.** Move static campaign definitions out of the growing data.ts into content catalogs; keep pure rules separate from DOM rendering. Preserve the nine-node scenario as a quick-play regression fixture.

**BASE-04 History.** The current log is capped at 60 entries and the campaign view shows 14. Add a permanent structured deed and quest journal; routine combat text can remain bounded.

## 3 Campaign progression requirements

**CAM-01 P0.** Represent progression as prerequisites and recorded outcomes, not a single chapter number. Allow side branches and alternative diplomatic or military resolutions. The journal displays the current goal, known leads, and why a gate remains closed.

| ID | Act and objective | Required outcome and unlock |
| --- | --- | --- |
| M01 | I Defend Aldenhold | Complete opening defense; introduce recruitment, movement and battle; award class heirloom |
| M02 | I Secure the valley | Stabilize food and secure two neighboring settlements by treaty or force; unlock regional council |
| M03 | II Resolve the western succession | Resolve Fenwick's disputed rule and Millbrook's occupation crisis; record installed rulers |
| M04 | II Break the western warlord | Resolve Stone Bridge and Harrowgate; unlock royal history and eastern leads |
| M05 | II Establish a southern route | Secure Duskwater and one safe supply route; reveal shrine and goblin approaches |
| M06 | III Recover the royal crown | Resolve the dragon guardian and take the goblin citadel; award the Crown of Oaths |
| M07 | III Open Grey Pass | Defeat Gharzak or accept a scripted capitulation; unlock eastern travel instead of ending the game |
| M08 | III Recover proof of lineage | Follow journal clues to the royal barrow; award the Founder's Seal |
| M09 | IV Recover the royal scepter | Defeat the titan stronghold; award the Scepter of Accord |
| M10 | IV Settle the eastern coalition | Resolve the eastern border dispute and river crossing; choose alliances or occupation |
| M11 | V Defeat the imperial capital | Resolve the final treaty or betrayal branch; win the capital siege |
| M12 | V Unite the realm | Hold the capital, retain all three relics and a living ruler; trigger coronation and outcome summary |

**CAM-02 P1.** Offer five ruler classes: Warrior, Knight, Ranger, Priest and Mage. Each changes starting companions, an economic or command bonus, and available combat abilities. All classes must be able to finish the same main objectives. The original class set is a reference [S1]; exact bonuses are to be balanced for this game's rules.

**CAM-03 P1.** The final summary records settlements governed or allied, civilian prosperity, allies retained, relics, completed and failed quests, casualties, elapsed months and difficulty. Score rewards alternative resolutions without double-counting them. A full completion run must not depend on a rare random event.

**CAM-04 P1.** Before a timed main event expires, provide a visible warning. If missed, offer a replacement route, such as a harder battle or a negotiation cost. Only explicit capital loss or ruler death ends an active campaign before coronation.

## 4 Western cities and strongholds

These are proposed gameplay roles and new-name mappings. The original names are reference anchors [S1–S3], not a requirement to reproduce the original map coordinates, text, or statistics. Existing node IDs remain stable where names are reused.

| ID and proposed name | Original reference | Required role and distinctive content |
| --- | --- | --- |
| C01 Aldenhold | Aladda | Starting capital; grain hinterland; ruler selection, tutorial defense, royal hall and heirloom award |
| C02 Fenwick | Marinia | Succession town; rival claimants; treaty, intervention or conquest route; later defense request |
| C03 Millbrook | Brocada | Agricultural ally; occupation and liberation story; local militia reinforcement |
| C04 Harrowgate | Paritan | Western rival capital; fortified market; warlord, river approach and political aftermath |
| C05 Westmere | Nuralia | Independent trading town; surrender negotiations; siege without mandatory assault |
| C06 Duskwater | Sur Nova | Southern frontier; forest and river economy; raider pressure and caravan staging |
| C07 Greenveil | Tranavan | Western woodland court; logging dispute; alliance unlocks woodland archers |
| C08 Blackfen Citadel | Gernok | Goblin fortress; dragon approach; crown objective and recurring resistance |
| C09 Reedhaven | Tentula | Lake settlement; blocked fisheries; prosperity changes after the giant threat ends |
| C10 Stonejaw | Char | Giant stronghold; lake-control objective; unlocks Reedhaven recovery and optional shrine reward |

### Shared city contract

**CITY-01 P1.** Each city record includes region, map cell, faction, ruler, disposition, population, food stock, loyalty, sector levels and limits, tax rate, fortification tier, recruit pool, market inventory, portrait asset, battle template, linked quests and capture policy.

**CITY-02 P1.** Every human or allied settlement offers at least one decision beyond recruitment and taxation. Strongholds instead offer a distinct encounter, raid-source consequence, or relic reward. Capturing every city must not be necessary to win.

**CITY-03 P1.** City screens show the ruler, ownership relationship, current problem, monthly income and costs, food and loyalty trend, available actions and recruitment limits. Show a before-and-after preview for investments and policy changes.

**CITY-04 P1.** Direct rule permits taxes and construction; vassalage provides agreed tribute and obligations; alliance provides access or military help without taxation. A treaty changes permissions as well as a label.

## 5 Eastern cities and supporting geography

| ID and proposed name | Original reference | Required role and distinctive content |
| --- | --- | --- |
| C11 Emberdelve | Xafanta | Dwarven hold; forge and mining; alliance opens heavy infantry and pass assistance |
| C12 Gharzak Hold | Zarnix | Orc fortress controlling Grey Pass; mid-campaign milestone, counterattack and assassination branch |
| C13 Ashcrown | Lucedia or Lucadia | Eastern court; apparent friend with opportunistic ambitions; post-titan ambush branch |
| C14 Willowford | Pudawala | River settlement; threatened independence; request for protection and trade access |
| C15 Southwatch | Sothold or Sothhold | Border fortress; displaced household and siege negotiations; control of river route |
| C16 Silverthorn | Medeval | Eastern woodland realm; guarded borders; optional difficult diplomacy or confrontation |
| C17 Highreach | Dersh | Titan citadel; high-risk siege; scepter and eastern threat resolution |
| C18 Eastridge | Estallah | Imperial border city; conditional truce and final-battle allegiance choice |
| C19 Veyrath | Tetrada | Imperial capital; staged final siege and coronation location |
| C20 Miretooth | Troll home or village | Troll stronghold; source of extortion and road raids; clearing it changes the region |

### Regional layout

**MAP-01 P1.** Build one authored overland hex map, initially targeting 64 by 40 cells. Treat dimensions as a content budget, not a reconstruction of the original. Use a western river boundary, fertile starting valley, southern wetlands, a central mountain spine, and an eastern imperial basin. Grey Pass is the primary connection through the mountains; an optional difficult trail offers strategic flexibility without bypassing relic requirements.

**MAP-02 P1.** Retain Stone Bridge, Grey Pass and Old Watchtower as named sites. Add a monastery, royal barrow, dragon approach, goblin camp, quarry, abandoned mine, shrine, caravan camp, bandit camp and eastern ford. Site classes may repeat; these 13 named sites do not count toward the 20 settlements.

**MAP-03 P1.** Terrain governs movement, access, visibility, encounters and battlefield selection. Roads reduce travel cost; rivers require a ford or bridge; mountains and deep water are impassable unless a defined route exists. An army uses its slowest member's movement budget. Show path cost, expected arrival month and known hazards before commitment.

**MAP-04 P1.** Implement unexplored, explored and currently visible states. Hide unknown armies and undiscovered sites from the map, tooltips, lists and minimap. Retain last-seen information with its observation month. Scouting must uncover useful routes and threats.

**MAP-05 P1.** Automated checks confirm that every required objective is reachable in at least one valid campaign state and that no decorative river, mountain or city painting contradicts its movement rules.

## 6 Quest engine and western side quests

**QUEST-01 P0.** Every quest has a stable ID, title, giver, trigger, prerequisites, eligibility, current stage, objective markers, deadline if any, choices, encounter definitions, rewards, failure outcome, follow-up flags and asset references. Track unavailable, available, active, succeeded, failed and superseded states.

**QUEST-02 P0.** Outcomes are applied once. Reloading, revisiting a site, accepting a dialogue twice, or moving between adjacent cells cannot duplicate rewards. A quest that loses its giver, target or city receives a defined fallback or failure state. Timers pause during combat and advance only with campaign months.

The following 18 side quests are new specifications. Their themes echo exploration, diplomacy and local crises in the original; their exact stages, rewards and deadlines are proposed for this game.

| ID and quest | Trigger and choices | Outcome and acceptance check |
| --- | --- | --- |
| Q01 The Empty Granary | Aldenhold food warning; buy grain, escort a shipment or temporarily reduce recruitment | Food recovery or visible hardship; each choice changes treasury or recruit access; no free repeat reward |
| Q02 One Eye at the Quarry | Hear a quarry rumor; fight a cyclops or divert workers with a temporary cost | Mining upgrade unlock or reduced output; boss uses a distinct boulder threat and telegraph |
| Q03 Beneath the Old Tower | Discover Old Watchtower; send heroes into a minotaur trial or withdraw | Unique shield and hero XP; ordinary formations cannot enter this encounter; retreat remains possible |
| Q04 The Woodland Accord | Logging expansion near Greenveil; cap logging, compensate, or reject the envoy | Archer access or damaged relations; the promised logging cap is enforced in city actions |
| Q05 The Missing Caravan | Merchant at Fenwick; track a goblin camp within three months or negotiate ransom | Rescue survivors, recover goods, or record loss; deadline is shown and resolution changes merchant support |
| Q06 The Miller on Trial | Millbrook joins the realm; investigate witnesses, fine the accused or dismiss the charge | Loyalty and legitimacy change; evidence appears before the final decision and cannot be gathered twice |

**QUEST-03 P1.** The journal groups main and optional quests, supports map focus, records the player's actual choice, and shows completed or failed outcomes. Show at most three tracked objectives on the main map. New events appear in an inbox so an end-month burst does not obscure urgent decisions.

**QUEST-04 P1.** Every quest ships with a start-state fixture and checks for success, refusal, failure, repeated interaction and save/reload. Where failure does not apply, explicitly record that in the content manifest.

## 7 Frontier and alliance side quests

| ID and quest | Trigger and choices | Outcome and acceptance check |
| --- | --- | --- |
| Q07 A Price on the Road | First caravan route through Duskwater; pay trolls, escort trade or seek Miretooth | Recurring cost or raid risk; clearing Miretooth permanently stops this extortion source |
| Q08 The Broken Shrine | Discover monastery route; donate supplies, defend pilgrims or leave | Sanctuary access and priest support; donation cannot be farmed for XP or score |
| Q09 Riders in the Reeds | Southern alliance lead; assist threatened horse archers or remain neutral | Mounted archer recruitment and clan relations; encounter is guaranteed after prerequisites, not a rare roll |
| Q10 The Silent Forge | Emberdelve embassy; recover a stolen forge tool or buy a substitute | Equipment upgrade tier and dwarf infantry; existing equipment is not silently replaced |
| Q11 The Lake Under Stone | Reedhaven requests help; defeat Stonejaw or negotiate seasonal access | Fishery recovery and shrine clue; investment benefit appears in the next monthly report |
| Q12 The Pass Remembers | Gharzak captured; investigate a warning, strengthen guards or ignore it | Prevented assassination, wounded companion or hero-only defense; consequence uses the selected preparation |

### Quest composition requirements

**QUEST-05 P1.** At least six of the 18 quests must have a noncombat resolution, at least four must change recruitment or city production, and at least three must affect a later quest or battle. These requirements prevent the content set from becoming 18 interchangeable fights.

**QUEST-06 P1.** Side-quest rewards can improve a main objective but cannot be its only prerequisite. If the player rejects Greenveil, there must still be a viable army composition for Harrowgate and the final siege.

**QUEST-07 P1.** Rewards use named item or unit IDs and explain their effect before acceptance where the reward is known. Balance currency rewards against approximately one to three months of the local city's net income; final values belong in content data rather than dialogue text.

**QUEST-08 P1.** Important locations change after completion: cleared camps stop spawning enemies; rescued traders reappear in a city; repaired sites change their visual state. Revisited dialogue acknowledges the outcome.

## 8 Eastern side quests and consequence rules

| ID and quest | Trigger and choices | Outcome and acceptance check |
| --- | --- | --- |
| Q13 The Border Petition | Willowford contacts the ruler; mediate, guarantee protection or demand tribute | Treaty, vassalage or hostility; army access and income match the chosen relationship |
| Q14 The Displaced Heir | Approach Southwatch; support a claimant, gather evidence or install a governor | Siege assistance or legitimacy cost; claimant survives or dies according to the actual battle outcome |
| Q15 Beneath Silverthorn | Reach woodland border; return a stolen relic, negotiate passage or trespass | Safe passage and ranger support, or a hostile patrol; borders update immediately |
| Q16 The Titan Prisoners | Scout Highreach; rescue captives before assault or prioritize the siege | Freed engineer opens a breach option; a late arrival receives a different resolved outcome |
| Q17 The False Banner | Eastridge proposes a final-war pact; investigate, trust or reject it | Allied reinforcement, betrayal or neutral absence; final siege uses this recorded flag |
| Q18 The Last Beacon | All royal relics collected; restore a ruined beacon using gold and a garrison or leave it dark | One final-battle reinforcement option and an ending entry; no repeat activation reward |

### Consequences the campaign must support

**EVENT-01 P0.** Events are processed in a deterministic order at month end: resolve committed orders and costs, advance economic state, evaluate scheduled events, move AI forces, queue battles, then check victory or defeat. Each step has a documented rule for interruption by a battle or modal choice.

**EVENT-02 P1.** News includes both opportunities and changes in the world: succession disputes, invasions, treaties, food shortages and threats. News must reference real game state. Do not announce a leader's death while leaving that leader available for negotiation.

**EVENT-03 P1.** Resolve competing branches explicitly. A conquered quest-giver city may transfer authority to a governor; a slain claimant cannot later award a treaty. Rewards already earned remain earned if a region is later lost, unless the item is explicitly recoverable under an established rule.

**EVENT-04 P1.** Provide at least eight repeatable event templates: harvest shortage, merchant visit, refugee arrival, bandit raid, allied aid request, recruitment offer, border incident and storm damage. Give each cooldowns and prerequisites. Repeatable events never substitute for the authored side quests or mandatory relic leads.

## 9 Inventory objects and environmental objects

**ITEM-01 P0.** Separate campaign relics, hero equipment, consumables and quest evidence. Every object has an ID, icon, description, rules text, source, ownership, transfer policy, value and associated quest IDs. Store state changes in rules data; never derive an effect from the icon or display name.

| Group | Proposed release inventory | Required behavior |
| --- | --- | --- |
| Three royal relics | Crown of Oaths; Founder's Seal; Scepter of Accord | Campaign-owned; cannot sell, discard or lose through companion death; all three required for coronation |
| Five class heirlooms | Ancestral Blade; Oathlance; Wayfinder Bow; Dawn Reliquary; Ember Staff | Award the matching one after M01; class-compatible bonus; all five exist in content and art |
| Six equipment pieces | Quarry Shield; Warden Mail; Reedcloak; Commander's Standard; Runed Bridle; Scholar's Ring | Distinct defense, scouting, leadership, cavalry or mana benefits; show comparison before equip |
| Four consumables | Healing Draught; Mana Draught; Supply Crate; Signal Flare | Explicit target and use phase; subtract exactly once; no healing above legal capacity |
| Six quest objects | Caravan Ledger; Woodland Charter; Forge Tool; Lake Shrine Wand; Claimant's Signet; Beacon Lens | Quest-stage checks; completion removes or archives evidence; essential evidence cannot be sold |

The original campaign's crown, amulet and scepter are reference points [S2–S3]. The names and object behavior above are new. The Lake Shrine Wand is proposed content; it does not assert an exact original item name or effect.

**ITEM-02 P1.** Heroes have weapon, armor and accessory slots; a shared treasury holds unequipped items. Transfers require co-location at a friendly settlement. Equipment cannot be swapped during a battle. A fallen companion's ordinary items return with surviving allies or appear at a recoverable battlefield cache; the UI states which occurred.

**OBJ-01 P1.** Implement at least 12 interactive object families: chest, cache, shrine, spring, mine, quarry, bridge, ford, watchtower, monastery, camp and beacon. Actions include inspect, claim, repair, donate, defend or clear as appropriate. Each needs an unvisited, active and resolved visual state where meaningful.

**OBJ-02 P1.** Environmental props include trees, boulders, walls, gates, tents, wagons, fences, ruins, docks and farm plots. Distinguish decorative props from blocking or usable objects through a consistent outline and tooltip. A chest cannot imply loot when it has no interaction.

## 10 City development and economic depth

The economy is a major strategic system for the finished game. Cities must develop differently, depend on each other, and face real tradeoffs between military expansion, household prosperity and public finances. This expands beyond the original-style sector investment model into production, labor, markets, logistics and explicit budgets. All formulas and starting values in this section are proposed game rules to tune through playtesting.

**ECO-01 P0 Economic state.** Track households, workforce, employment, housing, health, loyalty, private wealth, local goods, public stockpiles, productive capacity and construction commitments separately. Gold in the realm treasury is public money; goods produced and sold by private workshops do not automatically become treasury income.

**ECO-02 P1 Specialization.** Cities have resource endowments and limited development sites. Use five district categories: agricultural, extraction, industrial, commercial and civic. A city begins with three available development sites and can unlock up to six through population and infrastructure milestones. Buildings use sites only where their definition says so; walls and roads are infrastructure, not arbitrary competition for a farm plot.

| City type | Advantage | Dependency and strategic tradeoff |
| --- | --- | --- |
| Aldenhold and Millbrook farming centers | Fertile land and surplus food | Need tools and safe export routes; over-recruitment removes harvest labor |
| Emberdelve mining and forge center | Ore, metal and equipment production | Imports food and timber; road disruption can idle expensive workshops |
| Harrowgate commercial center | Market capacity, warehouses and route access | Depends on producers elsewhere; excessive tariffs divert traffic |
| Duskwater river frontier | Timber, fisheries and low-cost freight | Security and flood-control expenses; logging policy affects woodland relations |
| Gharzak military frontier | Defensible depot and pass tolls | Small civilian base and high garrison expense; costly to hold without supply links |
| Veyrath metropolitan center | Skilled labor and high-value manufacturing | Large food demand, housing pressure and high service upkeep |

**ECO-03 P1 Buildings.** Deliver 18 building families with two upgrade tiers each: farms, fishery, lumber camp, quarry, mine, smelter, toolworks, weavery, armory, stables, market, warehouse, housing, clinic, granary, barracks, administration hall and walls. Each has prerequisites, goods and gold construction costs, build time, labor demand, maintenance, capacity, condition and demolition recovery. Building families may be unavailable where geography does not support them.

**ECO-04 P1 Construction.** Cities have one active project and a visible queue. Reserve the full quoted gold and material cost at start; do not reserve unpurchased materials twice. Cancellation returns only unused inputs. Damage and neglect reduce capacity; repairs consume resources. Conquest changes ownership and can damage buildings but never resets an advanced city to a generic template.

## 11 Workforce production and household demand

**ECO-05 P1 Labor.** Begin with a configurable workforce share of population, initially 45 percent, divided into general and skilled workers. Recruitment subtracts real residents and updates the eligible workforce. Allocation across buildings cannot exceed available workers. Education and migration alter the skilled share over months. Unemployment, wages, housing and food access affect migration and loyalty; all effects must appear in explanations.

**ECO-06 P1 Goods.** Track ten goods in consistent cargo units: food, timber, stone, ore, metal, tools, textiles, arms, horses and luxuries. Gold is a currency, not an eleventh cargo good. Per-good metadata defines weight, storage limit, spoilage, basic demand, base price and allowed uses. Units are game abstractions and must be named consistently in the UI.

| Chain | Inputs and requirements | Output or use |
| --- | --- | --- |
| Food and provisions | Farm or fishery labor, local terrain, seasonal yield | Household consumption, army supply and emergency relief |
| Extraction | Labor and a suitable forest, quarry or deposit | Timber, stone and ore; tools improve efficiency and incur wear |
| Smelting | Ore plus timber fuel and skilled labor | Metal for construction and manufacturing |
| Manufacturing | Metal plus timber at toolworks or armory | Tools or arms; industrial inputs compete with army equipment |
| Textiles and luxuries | Skilled labor and defined purchased local inputs | Household prosperity, export value and selective demand |
| Horse breeding | Food, grazing capacity and stable labor | Cavalry recruitment and replenishment; growth requires time |

**ECO-07 P0 Production formula.** Planned output equals installed capacity multiplied by staffing ratio, input availability ratio, building condition, productivity and season factors. Cap staffing and input ratios at 1; clamp other modifiers to documented ranges. A recipe consumes only the inputs for output actually produced. Evaluate production from a beginning-of-phase inventory snapshot so chains do not depend on building iteration order; new metal becomes an input to another production step next month.

**ECO-08 P1 Demand.** Households consume essential food first; textiles and luxuries depend on wealth and availability. Suggested starting demand is one food unit per 100 residents per month, with army demand specified separately per soldier and horse. Keep soldiers out of civilian demand totals after recruitment. Unmet food demand causes shortages, then health and migration effects if persistent; it does not cause an unexplained instant population collapse.

**ECO-09 P1 Depletion and recovery.** Logging above regrowth degrades forest yield; mines have surveyed reserves and expanding extraction costs. Implement visible reserve estimates and recovery rules. Resource exhaustion must not strand the main campaign: trade, alternative deposits or production substitution remain available.

**Acceptance.** A forge with no ore produces no metal and consumes no fuel; a half-staffed farm produces the documented reduced amount; idle workers are not counted as employed; food, workforce and materials never become negative through simultaneous orders.

## 12 Markets trade routes and price behavior

**ECO-10 P1 Local markets.** Prices respond to usable stock, forecast demand, route access and seasonal expectations. Display current price, recent trend and the main shortage or surplus driver. Seeded events can alter supply; they may not arbitrarily overwrite treasury balances.

**ECO-11 P0 Price model.** Use a bounded target price: base price multiplied by the ratio of next-month demand plus a safety buffer to available stock plus expected arrivals plus the same buffer. Clamp the ratio initially between 0.5 and 2.5. Smooth monthly prices using 75 percent previous price and 25 percent target price. These are initial tuning parameters. Buying has an ask price, selling has a lower bid price, and each transaction updates available liquidity and stock.

**ECO-12 P1 Routes.** Caravans have origin, destination, owner, cargo, capacity, route, departure month, arrival estimate, escort and transport cost. Travel occupies time and carries a loss risk based on actual hostile presence and security. A disrupted route delays or loses physical cargo; it does not merely subtract an unexplained percentage from income. Roads increase throughput, warehouses absorb disruption and allied passage changes route availability.

**ECO-13 P1 Trade policies.** Allow local reserve floors, import ceilings, export thresholds and maximum acceptable purchase prices. Automatic orders obey budgets and cargo availability. An emergency purchase can exceed a normal price ceiling only through a visible player choice. Governors cannot sell quest objects, required construction reservations or protected army supplies.

**ECO-14 P0 Accounting boundary.** Track private commerce separately from public procurement and state enterprise sales. A private merchant's sale contributes to the private tax base, not gross treasury revenue. State-owned goods generate treasury revenue only when actually sold; transfer between two player-owned public stores is not realm income or expense. Charge external purchases once, and use internal transfer prices only for city performance reporting.

**ECO-15 P1 External market.** Provide finite external demand and supply through designated border markets. External counterparties have monthly transaction limits and replenishment rules so exports have a buyer and imports have a source. Prevent unlimited buy-and-resell loops, immediate resale arbitrage and wealth creation through city-to-city bookkeeping.

**Acceptance.** Removing a bridge changes caravan paths and delivery dates; escorting a threatened route changes losses; selling one cargo unit removes it from exactly one source; buying and immediately reselling at an unchanged market creates a loss from the spread. Isolated cities cannot silently import goods.

## 13 Income expenses public budgets and forecasts

**ECO-16 P1 Revenue.** Separate household tax, business tax, external customs and tolls, vassal tribute, state enterprise sales, grants and one-time loot. Tax assessments depend on actual taxable income or wealth under a documented simplified model, collection efficiency and policy. Tax receipts cannot exceed available private funds; unpaid assessments become recorded arrears with bounded enforcement consequences.

**ECO-17 P1 Costs.** Separate troop wages, hero pay, army supplies, garrisons, civil administration, public services, building upkeep, infrastructure maintenance, transport and escorts, relief, construction and imports. Private workshop wages and inputs belong to private accounts unless the state owns or subsidizes that operation. Do not charge a full standing army twice through separate garrison and troop categories.

| Illustrative monthly ledger | Gold | Classification |
| --- | --- | --- |
| Household tax | +400 | Recurring revenue |
| Business tax | +180 | Recurring revenue |
| External tolls and customs | +90 | Recurring revenue |
| Vassal tribute | +100 | Recurring revenue |
| State enterprise sales | +80 | Gross public sales; operating costs below |
| Army wages and hero pay | -250 | Military operating expense |
| Army supply purchases | -80 | Military operating expense |
| Administration | -70 | Civil operating expense |
| Services and relief | -60 | Civil operating expense |
| Building and road maintenance | -35 | Operating expense |
| Public enterprise inputs and labor | -40 | Operating expense |
| Transport and escorts | -55 | Operating expense |
| Construction | -120 | Capital spending |
| Other public goods purchases | -90 | Stockpile investment |

Example: total income is 850; operating expenses are 590; operating surplus is 260. Construction and stockpile investment use 210, leaving a net cash increase of 50. Opening treasury 1,000 becomes 1,050. Purchased stock is an inventory change as well as a cash outflow; later consumption must not deduct the purchase price again. Internal city transfers are excluded from this consolidated example.

**ECO-18 P0 Ledger integrity.** Closing cash equals opening cash plus posted receipts minus posted payments. Every entry has month, city, category, amount, counterparty and originating action ID. Post transfers with paired entries, aggregate without double-counting and retain enough history for annual comparisons. Reserved gold is shown separately from spendable gold.

## 14 Economic controls balancing and acceptance

**ECO-19 P1 City controls.** Offer tax rates, development priorities, worker allocation, trade thresholds, maintenance level and army recruitment limits. Permit explicit manual orders and governor policies: Balanced, Growth, Military, Trade and Recovery. Policies must explain their intended actions, respect protected stock and spending limits, and yield to player overrides.

**ECO-20 P1 Forecasting.** The realm dashboard shows cash, reserved commitments, recurring net income, one-time costs, food coverage, trade bottlenecks and threatened cities. City views show production, consumption, employment and sector profitability. Provide 3-month and 12-month forecasts with assumptions and a base/adverse range. Show estimated investment payback or 'no cash payback' for civic projects whose value is health or loyalty.

**ECO-21 P1 Solvency.** Warn before committing spending that leaves less than one month's mandatory costs. In a shortfall, apply the player's payment priorities, suspend unstarted projects, accrue visible pay or service arrears, then apply escalating morale and service consequences. Allow emergency levies, asset sales and expenditure cuts. Debt, interest and merchant loans are P2 unless the economy is already stable and understandable.

**ECO-22 P1 Policy tradeoffs.** High taxes reduce disposable wealth and investment; low maintenance increases later repairs; heavy recruitment reduces labor; protected forests constrain timber but help diplomacy; high tariffs raise receipts per shipment but reduce throughput. Balance these effects so no single maximum-tax or universal-industry build dominates all cities.

**ECO-23 P0 Monthly resolution.** Resolve the economic phase in this order: validate and reserve orders; arrive caravans already due; snapshot labor and inputs; produce goods; clear permitted local trade; allocate civilian and military essentials; post sales, taxes and operating payments; progress funded construction; apply spoilage and arrears; update health, migration and prices; prepare new departures and forecasts. New arrivals or outputs may be consumed this month, but not reused as upstream production inputs after the snapshot. Only then proceed to scheduled story events and AI campaign movement. Save every interrupted phase with its completed-step marker.

**ECO-24 P1 Economic art.** Add ten goods icons and 18 building-family icons beyond the baseline asset list. Use three shared construction states and three condition overlays instead of commissioning 36 independent building illustrations. City panoramas gain district overlays for growth, prosperity, construction and damage; these overlays are state-driven and keep the base city's identity.

**Release checks.** Run a 120-month peace economy, food embargo, severed mining route, rapid military mobilization, conquest recovery and bankruptcy recovery. Verify cash and goods reconciliation, bounded prices, no negative stock, visible causes, recoverable setbacks and no unlimited profit loop. Test at least three viable city specialization plans and ensure governor automation can run ten cities for six months without violating any player constraints.

**Delivery sequence.** Build ledgers, goods conservation and construction commitments in milestone A. Add labor and the farm–mine–forge–armory chain in B; add regional markets, trade, all building families and governors in C. Treat these economic requirements as release scope, not optional polish.

## 15 Diplomacy and army management

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| DIP-01 P0 | Faction registry and relationship states: hostile, neutral, truce, ally and vassal | Passing through allied territory does not trigger the current owner-mismatch battle rule |
| DIP-02 P1 | Treaty terms cover tribute, passage, aid and duration | Betrayal, expired truce and city capture update permissions and future events consistently |
| ARMY-01 P1 | Split, merge, rename, reinforce, train and dismiss formations | No lost IDs, duplicate heroes, movement reset exploit or XP creation when splitting or merging |
| ARMY-02 P1 | Recruitment depends on population pool, faction access and buildings | Costs and available quantity are visible; unavailable units explain the missing requirement |
| ARMY-03 P1 | Equipment tiers for formations; upgrades purchased at eligible cities | Price scales with formation size and cannot be recovered through a profitable upgrade loop |
| ARMY-04 P1 | Seasonal supply and optional forced march | Preview food and fatigue cost; winter warnings precede avoidable attrition; no hidden instant hero death |

**AI-01 P1.** Give factions budgets or explicit reinforcement schedules, recruitment constraints, target preferences and retreat thresholds. Differentiate raiders, territorial defenders, expansionist courts and allies. An eliminated raid source stops spawning its raids. An allied army must not attack its partner merely because owners differ.

**AI-02 P1.** Use only information available under that faction's visibility rules, except for clearly authored story events. Provide Easy, Normal and Hard settings through documented economy and decision parameters rather than undisclosed rule exceptions.

**DIP-03 P1 Economic agreements.** Treaties may include a fixed tribute, a bounded share of tax receipts, a goods quota, preferential tariffs or a supply corridor. Show affordability before acceptance. Defaults generate a visible dispute or renegotiation rather than automatically creating both treaty compliance and unpaid debt. Breaking a treaty affects trust and trade permissions immediately.

**ARMY-05 P1 Economic integration.** Reinforcement requires recruits, equipment and supply. A veteran formation's losses reduce its workforce claim and upkeep according to documented rules; restoring it requires real materials. Army stock travels with the army or a supply caravan. No city may feed two distant armies from the same food units.

**Acceptance.** A vassal provides the agreed tribute exactly once each month; an allied trade corridor permits passage without transfer of ownership; replacing 50 casualties removes the correct population, arms and treasury cost; a broken route affects army provisioning before the forecast promises a full supply month.


## 16 Tactical battles and force roster

Retain the existing morale, zone of control, counterattacks, routing, spells and seeded randomness. Extend these rules through data rather than replacing the working loop.

| ID | Required behavior | Acceptance criterion |
| --- | --- | --- |
| BAT-01 P0 | Deployment phase, explicit reserves and formation capacity | Every formation is fielded, held in reserve or explicitly excluded; player can see the reason |
| BAT-02 P1 | Twelve authored templates: plain, forest, hill pass, marsh, river ford, bridge, town, fortress, ruins, shrine, monster lair, imperial siege | Terrain and objective match the campaign location; every template has valid deployment and routes |
| BAT-03 P1 | Objectives: defeat, survive, escort, hold, escape and capture | UI shows objective progress; AI pursues the objective rather than always charging the nearest enemy |
| BAT-04 P1 | Walls and gates are positioned objects with breach rules | Defense applies where the wall exists; gate destruction changes pathfinding and sight lines |
| BAT-05 P1 | Charge, defend and terrain-based line of sight | Preview identifies blocked shots, charge eligibility and modifiers; AI uses the same checks |
| BAT-06 P1 | Reinforcements and betrayal from campaign flags | Arrival side, round and entry cells are deterministic and shown in the battle log |
| BAT-07 P1 | Auto-resolve uses the same battle rules and objectives | No separate reward path; report losses and hero deaths before returning to the campaign |

### Thirty archetypes for release

Keep the 13 current types: Militia, Spearmen, Archers, Knights, Orc Warband, Orc Archers, Troll, Lord, Champion, Priest, Mage, Orc Warchief and Orc Shaman.

Add 17: Swordsmen, Crossbowmen, Scouts, Mounted Archers, Dwarf Guard, Woodland Archers, Engineers, Ranger, Knight Commander, Goblin Skirmishers, Goblin Slingers, Giant, Cyclops, Minotaur, Dragon, Titan and Imperial Guard. Ruler classes use these hero visuals where appropriate; the Lord symbol remains a status marker, not a sixth ruler class.

## 17 Unit levels and equipment progression

**EQUIP-01 P1.** Equipment upgrades are a core progression system. Replace the present three-tier troop experience curve with levels 1–10 and a data-driven unlock table. Experience unlocks eligibility; equipping still requires materials, gold, facilities and time. Preserve the formation's name, ID, battle history and surviving soldiers during refits.

The original manual explicitly connects veteran levels with stronger bows and armor, including long bows at bow-unit level 3, compound bows at level 5, and plate armor for infantry and cavalry at level 3 [S1]. The following ladder uses those landmarks while extending the progression for this game.

| Equipment family | Level gates and release options | Distinct tactical tradeoff |
| --- | --- | --- |
| Bows | L1 short bow; L3 long bow; L5 compound bow; L8 masterwork compound bow | Longer range, greater missile power and armor penetration; increasingly costly ammunition and supply |
| Infantry weapons | L1 sword or spear; L2 halberd; L3 two-handed sword; L4 pike; L7 masterwork variant | Swords for general combat, halberds against armor, pikes against charges; two-handed weapons exclude shields |
| Armor | L1 padded or leather; L2 chain; L3 plate; L6 fitted plate; L9 masterwork plate | Separate melee and missile protection; weight and fatigue affect movement and campaign supply |
| Shields | L1 buckler; L2 kite shield; L4 tower shield | Missile protection and defense; heavier choices reduce mobility and exclude incompatible weapons |
| Mounts | L1 light horse; L2 warhorse; L4 heavy warhorse; L7 trained charger | Charge power, carrying capacity and movement differ; heavy mounts cost more food and gold |
| Barding | L2 leather; L3 chain; L5 plate | Better cavalry survival with additional weight, purchase cost and upkeep |

Levels listed are initial balancing requirements. Masterwork variants improve an existing role; they do not make every low-cost alternative useless. Crossbowmen retain a separate armor-piercing weapon path and do not automatically become longbow formations.

**EQUIP-02 P1 Compatibility.** Equipment slots are melee weapon, polearm, missile weapon, armor, shield, mount and barding, with permitted combinations by archetype. Long and compound bows exclude shields and plate armor in the default ruleset. Two-handed swords, halberds and pikes exclude shields. Barding requires a compatible mount. Locked options explain the level, facility, resource or compatibility requirement.

**EQUIP-03 P1 Meaningful advantage.** At equal level and headcount, a compound-bow formation should deliver at least 30 percent more expected missile damage against a standard armored target than its short-bow equivalent in a controlled fixture. Plate should reduce expected incoming non-piercing melee casualties by at least 25 percent against the leather baseline. Tune final values around counters, cost and terrain; always expose the actual modifiers.

**EQUIP-04 P1 Visual identity.** Show loadout icons, a veteran badge and a comparison of attack, range, melee defense, missile defense, movement and upkeep. Add eight shared equipment overlays: long bow, compound bow, plate armor, tower shield, pike, halberd, heavy mount and barding. Preserve a readable base silhouette.

## 18 Refitting training and reinforcement rules

**EQUIP-05 P1 Facilities and costs.** Refits occur at a friendly town with the required armory, workshop or stable tier. Quote the total gold, arms, metal, timber, textiles, horses and time before confirmation. A formation commits the cost for its actual headcount and spends a full campaign month refitting; it cannot march, but can defend with its previous completed loadout. Siege pauses the refit without duplicating payment.

**EQUIP-06 P0 Equipment accounting.** Treat arms goods as generic manufactured kits; specific loadouts are recipes consuming kits plus any additional named goods. Consumed kits become assigned equipment, not a second warehouse stockpile. Refitting returns a documented salvage fraction of replaced gear once. Casualties remove assigned equipment or generate explicit recoverable salvage; reinforcement pays for the new soldiers' matching equipment.

**EQUIP-07 P1 Experience dilution.** Track aggregate training experience and headcount so new recruits dilute average experience according to a visible preview. Splits distribute experience and equipment proportionally; merges use weighted experience and compatible loadouts. Retain separately equipped formations instead of inventing a hidden average weapon. A level decrease does not remove already equipped gear; it prevents new advanced refits until training restores qualification.

**EQUIP-08 P1 Training.** Town training consumes gold, food and a month, requires a barracks or relevant specialist, and has a stated training cap below the highest combat-earned levels. Battlefield participation and objectives award XP once. Repeated harmless movement, self-damage or healing cannot create unlimited advancement. Refit and training are mutually exclusive monthly orders.

**EQUIP-09 P1 Upgrade interface.** A unit screen shows its current equipment, the next two meaningful unlocks and a full upgrade tree. An eligible-upgrade notification opens the comparison, including one-time expense, monthly upkeep change, construction prerequisites and expected military benefit. Batch refits respect city capacity and treasury reservations.

**EQUIP-10 P0 Save migration.** Convert existing troop XP to the new curve through an explicit mapping, preserving relative veteran rank. Keep hero and troop progression distinct. Loadout IDs, reserved inputs, refit progress and training orders survive saving mid-month and during a defending battle.

**Acceptance.** A level-4 archer cannot buy a compound bow; reaching level 5 exposes it without giving it free. Plate equipment changes both battle damage and maintenance. A refit interrupted by battle or reload charges once. Reinforcing a veteran unit previews and applies the same XP dilution. Splitting, merging, salvaging and selling cannot create gear, gold or experience.

**Production additions.** Add 22 distinct equipment icons: short bow, long bow, compound bow, crossbow, sword, spear, halberd, two-handed sword, pike, padded armor, leather armor, chain armor, plate armor, buckler, kite shield, tower shield, light horse, warhorse, heavy warhorse, leather barding, chain barding and plate barding. Advanced quality grades use shared quality badges. These icons are separate from the 24 hero-inventory and quest-object icons.

## 19 Mage spell progression and supporting magic

**MAG-01 P1.** Every mage-type progression must support a full 14-spell catalog. Mage heroes, enemy mages and shaman-type casters use level-appropriate access to this catalog; lower-level enemies do not receive the whole list immediately. Spell unlocks are permanent abilities earned by level, not consumable items. Priests and rangers use the supporting lists below.

| Mage spell | Unlock | Tactical purpose and required counterplay |
| --- | --- | --- |
| Fireball | L1 | Ranged fire damage to one formation; armor and fire resistance matter |
| Ward | L1 | Temporary protection on an ally; expires and can be dispelled |
| Terror | L2 | Morale attack; resistant and fearless targets are identified |
| Frost | L2 | Cold damage and short movement reduction; no permanent immobilization |
| Haste | L3 | Temporary movement increase; never restores an already spent attack |
| Slow | L3 | Reduced movement and charge capability; duration and cleansing visible |
| Lightning | L4 | Strong single-target strike; defined magical resistance and line of sight |
| Dispel | L4 | Removes eligible effects; preview shows what can be removed |
| Entangle | L5 | Area movement restriction; escape or duration limit prevents indefinite trapping |
| Teleport | L5 | Reposition one friendly formation to a valid visible empty hex; cannot bypass a sealed story gate |
| Quake | L6 | Damages walls or destabilizes a small area; previews affected structures and allies |
| Chain Lightning | L7 | Jumps across up to three eligible targets; cannot hit the same unit twice |
| Firestorm | L8 | Expensive area damage; area preview and friendly-fire warning required |
| Disintegrate | L9 | High-cost concentrated damage; capped against bosses and cannot remove a full healthy boss instantly |

**MAG-02 P1 Supporting lists.** Priests have six spells: Heal, Rally, Ward, Dispel, Bless and Restoration. Rangers have four: Reveal, Entangle, Haste and Ward. The resulting release catalog has 19 unique spells, including 14 available to mage-type units. Level 10 improves mastery or efficiency within capped rules rather than adding a fifteenth mage spell.

**MAG-03 P0 Spell contract.** Define mana cost, action cost, targeting phase, range, line of sight, area, duration, stacking, damage or buff formula, resistances, legal targets, AI value and effect asset. Initially keep per-spell mana costs within 2–12 and scale hero mana with level; tune so high-tier spells force choices rather than unlimited casting. Current Fireball, Terror, Heal and Rally remain available, with revised balance where needed.

**MAG-04 P1 Resolution.** Casting normally consumes the attack action. Temporary effects tick once at a specified side-turn boundary. Refreshing an existing effect does not stack its magnitude unless explicitly allowed. Reveal operates on the campaign map; spell effects cannot grant free campaign movement through a battle transition. Restoration repairs wounds and eligible conditions within a stated cap; it does not resurrect a dead ruler.

**Acceptance.** Validate unlocks for all 14 mage spells, cost and range checks, AI use, status expiration, immunity, reload continuity, illegal Teleport destinations and exact-once effects. Auto-resolve uses the same spell catalog. Deliver 19 spell icons and 19 distinct readable effects or map cues.


## 20 Image requirements for units and characters

**ART-01 P1 Art direction.** Use illustrated tabletop fantasy: readable silhouettes, restrained earth colors, painted landscape detail and clear faction emblems. Preserve the existing SVG icon language for tiny UI symbols. Render tactical forces as illustrated tokens; do not require full directional animation to finish version 1.

| Asset family | Minimum quantity | Source and runtime specification |
| --- | --- | --- |
| Tactical unit illustrations | 30 archetypes listed in section 16 | Transparent 512 by 512 PNG masters; 128 and 64 pixel WebP or PNG exports; consistent three-quarter view and baseline |
| Small unit symbols | 30 total | Existing 13 SVG symbols retained or refined; 17 matching new SVGs; readable at 24 pixels |
| Named character portraits | 20 | 768 by 768 masters; 256 pixel portraits; rulers, claimants, envoys, merchant, monk, dwarf smith, nomad chief and rival commanders |
| Faction emblems | 10 | Editable SVG; 64 and 128 pixel raster fallback; distinct silhouette as well as color |
| Spell icons | 19 | SVG or 256 pixel transparent masters; display at 32–48 pixels |
| Spell effect sets | 19 | Lightweight CSS or SVG effect per spell; 0.3–0.8 second default; instant mode supported |

These counts are production minima, not a count of standalone files. Add the equipment overlays and 22 equipment icons in sections 17–18, plus the economic assets in section 14. A named enemy can share an archetype token but must have a distinct portrait or emblem where identification matters. Faction tint and status rings are drawn in code; do not commission a separate image for every ownership or selected state.

**ART-02 P1.** Heroes, infantry, mounted units and monsters must be distinguishable at 48 pixels. Keep weapons and heads inside the token's safe area. Large creatures can have larger artwork, but version 1 retains a single-hex footprint unless multi-hex movement and targeting are implemented first.

**ART-03 P1.** Required status overlays: selected, hovered, ally, enemy, exhausted, routing, wounded, poisoned or debuffed, reserve and quest target. Pair color with border shape, symbol or text. HP, mana and troop count are UI elements, never baked into images.

**ART-04 P2.** Optional animation expansion: idle, attack, hit, cast and defeat states with an agreed frame count. Do not commission eight-direction sheets before the renderer supports them.

**Unit brief example.** Dwarf Guard: compact armored infantry, broad rectangular shield, visible axe, muted iron and ochre, three-quarter view, transparent background, no words, no frame, readable at 48 pixels. Deliver editable master, 512 PNG and runtime exports under a stable asset ID.

## 21 Terrain overland map and city image requirements

| Asset family | Minimum quantity | Technical and visual contract |
| --- | --- | --- |
| Terrain base families | 12 families with 3 variants each | Plain, forest, hill, stream, marsh, thorns, ruins, rocks, spring, mountain, deep water and snow; 256 pixel transparent tile masters |
| Connection overlays | Generated from connectivity masks | Roads, rivers, banks, bridges and walls; six-direction joins must connect without seams; exhaustive masks may use procedural SVG |
| Overland map | One authored world in 5 regional chunks | Logical grid data is authoritative; painted terrain follows it; separate roads, settlements, labels, fog and markers |
| Regional reference paintings | 5 | 2048 by 2048 editable masters; western valley, southern wetlands, central range, woodland frontier and imperial basin |
| Settlement markers | 20 distinct landmark silhouettes | 256 pixel transparent masters; 64–96 pixel display; common state overlays for damaged, besieged and occupied |
| City panoramas | 20 | 1920 by 1080 masters; 960 by 540 runtime WebP; composition supports a cropped city panel |
| Battlefield layouts | 12 | Authored data layouts from BAT-02, using shared terrain art; no mandatory full painting per battlefield |
| Interactive site markers | 12 families | 256 pixel masters; visited, active and resolved changes via overlay or variant |
| Environmental props | 20 | 256–512 pixel transparent masters; trees, rocks, walls, gates, tents, wagons, fences, ruins, docks and farm details |

**ART-05 P1.** Use one consistent light direction and terrain scale. Adjacent tiles must join at every orientation. Forest and hills must leave the center readable beneath a unit token. A single shared texture may serve tactical and overland views only if scale remains convincing.

**ART-06 P1.** Do not make the world a single flattened illustration with embedded labels. The renderer must be able to pan, zoom, hide unexplored areas, recolor ownership, show routes and select cells independently. Render names as text; map IDs and coordinates must match the gameplay data exactly.

**ART-07 P1.** Each city needs an identifiable landmark and environment. Aldenhold uses a hill keep and grain fields; Duskwater uses river docks and mist; Emberdelve uses a mountain gate and forge glow; Gharzak uses a narrow pass fortress; Veyrath uses a broad imperial terrace. These are original art briefs.

**ART-08 P1.** Approve a small art sample before volume production: one infantry token, one cavalry token, one monster, one forest tile, one river junction and one city panorama, all shown in the actual UI at target sizes.

## 22 Object story and interface asset requirements

| Asset family | Minimum quantity | Requirements |
| --- | --- | --- |
| Inventory icons | 24 | Match the section 9 inventory exactly; 512 pixel masters and 64/128 pixel exports; transparent background |
| Main-story illustrations | 6 | Inheritance, first defense, western council, relic discovery, imperial siege and coronation; 1920 by 1080 masters |
| Side-quest scene illustrations | 6 reusable scenes | Trial hall, forest envoy, caravan ambush, shrine, forge and border camp; contextual text and portraits identify the quest |
| Outcome illustrations | 3 | Coronation, capital fallen, ruler fallen; title and explanation rendered separately |
| Economy and UI icons | 24 | Gold, food, population, loyalty, health, housing, five sectors, fortifications, recruits, upkeep, trade, supply, movement, fatigue, XP, diplomacy, quest, save, settings and journal |
| Sound effects | 12 | UI confirm, error, march, melee, arrow, hit, spell, heal, rout, capture, victory and defeat |
| Music loops | 3 | Campaign, battle and ending; independent volume controls and mute |

**ART-09 P1.** Use stable names such as unit_dwarf_guard_token_v01.webp and city_aldenhold_panorama_v01.webp. Maintain an asset manifest containing ID, category, dimensions, file path, transparency, display size, author or generation source, permitted use, revision and review status. Loading screens and errors must identify a missing asset gracefully.

**ART-10 P1.** Store editable masters separately from runtime assets. Suggested runtime locations: public/assets/units, terrain, cities, portraits, items, events, ui and audio. Add source or licensing records alongside the manifest. Follow the repository's original-art policy; historical screenshots serve as references rather than shipped assets.

**ART-11 P1.** Initial-load target: no more than 8 MB compressed for the shell and starting region. Load panoramas, portraits and later regions on demand. Limit individual runtime panoramas to approximately 250 KB unless a measured visual need justifies more. Keep a cache budget rather than loading every master into memory.

**ART-12 P1.** Asset acceptance requires correct dimensions and alpha, no unintended text or watermarks, consistent scale and lighting, legibility at minimum size, and visual agreement with gameplay. For AI-assisted assets, review repeated equipment, hands, faces and borders before approval. A file existing in a folder is not evidence that it works in the game.

**UI-01 P1.** Support keyboard selection and focus, visible action explanations, scalable text, a color-independent ownership scheme, reduced motion and mute. Target desktop browsers first at 1366 by 768 and larger; provide a usable stacked layout at 1024 by 768. Mobile-first redesign is P2.

## 23 Architecture save integrity and validation

**DATA-01 P0.** Add content catalogs for regions, locations, factions, units, items, quests, events, encounters and assets. Distinguish immutable definitions from runtime state. Suggested modules: src/content/*, src/game/quests.ts, items.ts, diplomacy.ts, economy.ts and save.ts. These are proposed additions, not existing files.

**DATA-02 P0.** A content validator rejects duplicate IDs, unresolved references, prerequisite cycles without an intentional exit, missing assets, invalid map coordinates, unreachable required locations, reward loops and victory conditions with no satisfiable path.

**SAVE-01 P0.** Save schema includes campaign ID and revision, RNG seed, month, active choices, quest stages, event queue, inventory, ownership, treaties, armies, visibility and full battle state. Use versioned migrations. Retain the original version 2 save or offer it as the tutorial scenario; never silently reinterpret its nine nodes as the full world.

**SAVE-02 P1.** Provide three manual slots, rotating autosaves and JSON export/import. Save before irreversible choices and month advancement. Validate imported saves before replacing active state. Quota failure or unavailable localStorage produces a visible warning and export option rather than a silent failure.

**SAVE-03 P0.** Persist encounter resolution and rewards atomically. Reopening a save immediately before or after a reward must produce one award, the correct quest stage and the same pending event sequence.

**PERF-01 P1.** On a documented midrange desktop reference machine, target selection feedback under 100 ms, map pan and zoom near 60 FPS, and normal month processing under 2 seconds. If AI work exceeds a frame budget, yield between actions and show progress. Benchmark a late-game save with all cities and at least 100 formations.

### Required release scenarios

| Check | Pass condition |
| --- | --- |
| Five ruler classes | Each completes opening, relic acquisition and final victory on Normal through at least one tested route |
| Two political routes | Alliance-heavy and conquest-heavy runs both reach coronation without debug commands |
| Quest matrix | All 18 quests pass their applicable success, refusal, failure, revisit and reload cases |
| Large battle | Overflow formations, reserves, reinforcements and retreats preserve troop identities and totals |
| Save continuity | Resume during dialogue, queued battles, deployment, routing and reward resolution without duplication |
| Ending consistency | Ruler death, capital loss, last-battle victory and relic checks produce one correct terminal state |

## 24 Implementation sequence and release gates

| Milestone | Scope | Exit gate |
| --- | --- | --- |
| A Foundation | BASE, quest/event framework, faction registry, item state, content validator, save schema | One quest changes a treaty and awards an item exactly once across reload; a 28-formation battle preserves all units |
| B Western playable chapter | Aldenhold, Fenwick, Millbrook, Harrowgate and Greenveil; M01–M04; Q01–Q06 | A new player completes a 45–90 minute chapter with a diplomatic and military path |
| C World and economy | Full overland map, production chains, markets, city systems, supply, equipment progression, fog and faction AI | All required locations reachable; no geography/rule mismatch; late-game performance target met |
| D Full campaign | M05–M12, Q07–Q18, relics, 14-spell mage progression, eastern politics, siege objectives and endings | One uninterrupted Normal campaign reaches coronation; failed side quests do not block it |
| E Art and presentation | Final tokens, cities, terrain, portraits, object art, story images, audio and onboarding | Manifest complete; assets approved in UI; loading and accessibility targets met |
| F Release candidate | Balance, save compatibility, campaign regression, browser checks and credits | All section 23 checks pass and no known progression-blocking or save-loss defect remains |

Art exploration may proceed alongside milestone B. Produce the full city and unit asset batches only after camera scale, token sizing and map presentation are stable.

### First implementation batch

1. Add campaignMode and defeatReason; keep the current scenario playable.
2. Fix battle capacity and define reserve handling before adding larger factions.
3. Add persistent quest, item and faction state with validation and save migration.
4. Implement Q04 as a complete vertical slice: logging choice, Greenveil relationship, archer recruitment, portrait, journal and reload checks.
5. Implement M01 and the class heirloom to exercise a main objective and item award.
6. Build the western map slice and approve the art sample in the actual game.

### Decisions to lock before content production

Recommended defaults are the new-name city crosswalk, an authored hex overland map, static illustrated tactical tokens, original dialogue, and a campaign centered on three relics. Lock the final public game title, final city names, map coordinates, exact difficulty parameters and approved art sample at milestone B. Exact original-game scoring and original coordinates are not a release requirement.

“Complete” means required content, game rules, UI, assets and acceptance checks are all finished. More spell names or additional city markers should not substitute for a playable chapter.

## 25 Expandable world direction

The agreed direction is a handcrafted starting kingdom connected to a procedural frontier. The first release delivers the authored campaign; the expandable frontier follows as a planned second phase. Region identity and persistence foundations belong in the initial architecture so expansion does not require replacing the world model. Content variety and empire management are larger challenges than terrain generation.

**WORLD-01 P2 Region model.** Give every region a stable ID, coordinate, seed and generator version. Keep the starting 20 settlements and authored stories intact. Generate frontier regions on approach from deterministic rules for terrain, resources, routes, settlements and faction presence. Regeneration from the same seed and version must reproduce untouched terrain.

**WORLD-02 P2 Persistence.** Store changes to generated regions, discovered information and active commitments. Bound generation and cache size; evict unmodified terrain from memory while retaining player changes. An expandable world is practically limited by storage and performance, not literally infinite. Estimate save size and export capacity before enabling unlimited exploration.

**WORLD-03 P2 Regional simulation.** Run nearby armies, caravans and battles in detail. Simulate distant regions through monthly summaries, retaining ownership, goods, treasury, route commitments and major conflicts. Switching detail levels must not duplicate cargo, generate profit or erase an invading army. A remote region cannot remain frozen while still paying full income.

**WORLD-04 P2 Meaningful exploration.** New regions introduce economic opportunities and tradeoffs: an ore deposit, a grain exporter, a blocked pass, rival trade leagues or a resource-poor fortress. Combine authored encounter templates with local conditions and faction objectives. Avoid endless fetch quests or stronger copies of the same enemy. Real-time AI-generated dialogue is not required for this model.

**WORLD-05 P2 Delegated government.** Group settlements into provinces with governors, budgets, supply policies and exception alerts. Require successful management of 50 cities through the province view before calling the mode viable. Do not force the player to visit each city every month.

**WORLD-06 P2 Sustainable progression.** Retain bounded unit levels and equipment tiers. Late challenges come from distances, coalitions, multiple fronts and constrained supplies. Preserve the campaign's coronation ending, then offer frontier continuation or a separate sandbox mode. Players can stop with a completed story.

**Feasibility gate.** First prove one generated region adjoining the authored map, a trade route across the boundary, a persistent regional quest and a save/reload round trip. Then test 100 discovered regions with at most nine running in detailed mode. Proceed only if generation, remote simulation and saving meet explicit measured budgets and the new regions offer distinct decisions.

The map, content and save foundations in milestones A–C should avoid hard-coded world boundaries where practical. Full procedural generation, province management and frontier content remain later work.


## 26 Evidence and reference register

### Repository evidence

All repository references use commit 4641846ec5caa8e80672e0a434e3e62eaccbec15. The baseline findings are a source review; they do not certify a browser playthrough or test execution.

- R1 docs/design.md — design direction, original-name and artwork policy, milestone intentions. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/docs/design.md
- R2 src/game/data.ts — nine nodes, town setup, 13 types, four spells and nine terrains. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/src/game/data.ts
- R3 src/game/types.ts — current state model and faction restrictions. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/src/game/types.ts
- R4 src/game/campaign.ts — economy, movement, encounters, victory checks, logs and monthly processing. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/src/game/campaign.ts
- R5 src/game/battle.ts — 12 by 9 battlefield, deployment, morale, AI and spells. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/src/game/battle.ts
- R6 src/game/ai.ts — single-lair reinforcements and raiding behavior. https://github.com/jsconu/aragon/blob/4641846ec5caa8e80672e0a434e3e62eaccbec15/src/game/ai.ts
- R7 src/main.ts and src/ui/campaignView.ts — save handling, graph renderer and ending banner. https://github.com/jsconu/aragon/tree/4641846ec5caa8e80672e0a434e3e62eaccbec15/src
- R8 src/ui/sprites.ts; src/game/game.test.ts, heroes.test.ts and terrain.test.ts — existing artwork and rules tests. https://github.com/jsconu/aragon/tree/4641846ec5caa8e80672e0a434e3e62eaccbec15/src

### Original game reference sources

- S1 Strategic Simulations, Sword of Aragon manual, 1989, text reproduction. Primary reference for ruler classes, city administration and setting terminology. https://www.scribd.com/doc/132098816/Sword-of-Aragon-Manual-PC
- S2 GamemaniaX, Full Points Guide, April 23 2022. Secondary reference for city names and the broad campaign path, including relic collection and eastern politics. https://gamefaqs.gamespot.com/pc/582138-sword-of-aragon/faqs/79906
- S3 Cheatbook, Sword of Aragon Walkthrough and Hints, including the attributed Louie points list. Secondary reference for monster strongholds, original crown and scepter associations, and optional encounters. https://www.cheatbook.de/wfiles/swordofaragon.htm

Original-game reference summary: Aladda is the starting city and Tetrada the imperial destination. The western campaign includes Marinia, Brocada, Paritan, Nuralia and Sur Nova. Tranavan and Medeval are elven settlements; Xafanta is dwarven. Gernok is associated with goblins, Zarnix with orcs, Char with giants, and Dersh with titans. The crown, amulet and scepter underpin the unification objective. The walkthroughs use inconsistent spellings for several places; the crosswalk preserves representative variants rather than treating them as separate cities. [S1–S3]

The implementation requirements, new place names, quest designs, acceptance criteria and asset budgets in this document are proposed design work. They should be maintained as the completion baseline as milestones are delivered.
