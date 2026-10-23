# Scouts and advance warning

Owner request, October 22, 2026. Scouts are distinct from ordinary fighting formations. They give local intelligence about hostile movement and may be assigned to a friendly city or to a road approach. This feature should work with the existing monster raid warning pipeline and later AI army marches without granting global knowledge.

## Recruit and assign

- Recruit a small, inexpensive Scout unit in friendly settlements. A scout has upkeep and a travel allowance but negligible combat power; it should not consume one of the 27 tactical deployment slots or make a garrison appear strong. The player can recruit several and assign each one independently.
- A **City watch** assignment is tied to one owned settlement and covers its nearby approach roads. A **Road post** is tied to one traversable road hex or road segment and reports movements crossing that approach, including armies heading toward another city. Show the assignment, covered area and nearest friendly city in the unit panel and on the map.
- Moving or recalling a scout takes ordinary travel time; a remote reassignment cannot reveal a road instantly. A captured city or enemy occupied post dislodges the scout. A scout can be intercepted or lost, with a clear report.

## Detection and reports

- Detect an army only when its route crosses the scout's covered area. City watch has broader local coverage; road posts see farther down one approach. Do not show enemy destinations unless their orders or route make that inference credible. The report distinguishes an observed force from an estimated target.
- A city watch can give roughly **one to two months** of warning; a correctly placed road post can give up to **three months**, limited by actual route distance and the time between detection and arrival. A force spawned nearby may give no advance warning. Show the expected arrival month, origin/direction, approximate size and confidence, and update the report if the army turns away, is defeated or changes pace.
- Existing announced monster raids remain a baseline public warning. Scouts can reveal a raid earlier or improve its troop estimate and approach direction, but do not create duplicate raid events or stack extra months onto a fixed arrival date. Enemy field armies use the same observation rules rather than revealing every AI order.
- Reports are saved and appear in the chronicle/journal and at the threatened city. A new report fires once per observed movement or materially changed estimate, not on every redraw. A road post reports a crossing even if the army ultimately targets another city.

## Acceptance

1. Assign a scout to a city and a second to a road; each displays a distinct covered area and persists after save/reload.
2. A hostile army crossing the road post generates a warning before the city watch sees it, when distance permits. An army bypassing both posts remains unseen.
3. A monster raid's existing warning remains one event; a scout supplies earlier or better local detail when it can actually observe the route.
4. Recall, interception, city loss and a changed enemy route update or retire stale reports. Scout upkeep is charged once per month and scouts do not distort garrison deterrence or battle deployment.

## Implemented behavior, October 22, 2026

The current UI uses one Keep watch here assignment with a shaded three-hex radius. A scout reports only a currently visible orc or rival-city army, and identifies its destination as an estimate. Unseen future route crossings do not reveal an enemy. Reports are dated journal history and deduplicated through saves; automatic updates/retirement of changed estimates and monster-raid intelligence remain future work.

Scouts stay in noncombat reserve during battles without consuming a deployment slot. Scouts alone cannot order an attack or capture. When intercepted they lose their watch; an undefended post resolves immediately, with ordinary withdrawal/cut-off and town/raid consequences. Scouts accompanying soldiers follow the army’s battle result. Existing saved battles retain their saved deployment.

## Current intelligence lifecycle

Latest contacts are now saved separately from journal history. Observed destination and arrival changes generate a fresh report; unchanged observations do not. Zero movement gives arrival unknown. Losing sight, recalling/moving a watcher, interception or a missing force retires the estimate without revealing hidden enemy outcomes. Reacquisition creates a new estimate. The map sidebar and city overview label current versus withdrawn estimates. Legacy report-only saves load without migration or duplicate historical messages.
