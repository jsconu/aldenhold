import {campaignObjectives,explored,DIFFICULTIES} from '../game/challenge';
import { detectChance, infiltrateQuote } from '../game/intel';
import { BREACH, siegeOf, siegeOutlook, siegeQuote, surrenderPolicy } from '../game/sieges';
import { campQuote, currentWeather, exposureLoss, SEASON_NAME } from '../game/weather';
import { onWatch, SCOUT_RANGE, scoutContactStatus } from '../game/scouts';
import {replacementQuote} from '../game/replacements';
import {formationCapacity} from '../game/formationCapacity';
import { renderRulerSelection } from './rulerSelection';
import { questOutcome } from './gameplayFeedback';
import { LAIRS, SPECIES, type LairDefinition } from '../content/lairs';
import { DETERRENCE, monthsAway, raidLine, raidOdds, raidsOn, raidStakes } from '../game/raids';
import { lairAt, lairGarrison } from '../game/lairs';
import { CATALOG } from '../content';
import {
  armyAt, arrivalEstimates, campaignOf, canRecruitAt, dateLabel, hireQuote, monthlyIncome, monthlyUpkeep, neighborsOf, nodeName, playerMarchOptions,
  recruitQuote, startLocation, townGrowth, townIncome,
} from '../game/campaign';
import { hasRoad, hexLand, marchRate, placeAt, townAt, townLocation, worldOf, type MarchStep } from '../game/world';
import { BANNER_LABEL, bannerSvg, HEX_ZOOMS, hexZoom, renderHexMap, type BannerKind } from './hexMapView';
import { SPELLS, UNIT_TYPES } from '../game/data';
import { heroLevel, heroMaxHp, heroMaxMana, level } from '../game/units';
import { EQUIPMENT, refitQuote, equipmentUpkeep, usesBow } from '../game/equipment';
import { RELATION_LABEL, relationWith } from '../game/diplomacy';
import { FACTIONS } from '../content/factions';
import type { Army, CampaignId, FactionId, GameState, QuestDefinition, Town, Troop } from '../game/types';
import { HERO_SLOTS, unequipQuote } from '../game/items';
import { buyQuote, merchantsAt, merchantStatus } from '../game/merchants';
import { ITEMS } from '../content/items';
import { renderJournal } from './journalView';
import { renderTreasury } from './treasuryView';
import { questFocus, questSites } from './questNavigation';
import { BUILDING_IDS, BUILDINGS, cityMaintenance, constructionQuote, dismantleQuote, developmentSites, endowment, totalCityMaintenance } from '../game/cities';
import { campaignQuests, conditionHolds, conditionText, isOpen, monthsLeft, questQuote, questsAt, questsAtSite, questSummary, stageOf, trackedQuests, type EncounterPreview } from '../game/quests';
import { esc, type UIState } from './shared';
import { placeScene } from './placeScene';
import { renderOverland } from './overlandMap';
import { previewRoute, type RoutePreview } from '../game/overlandRoutes';
import { renderCityAssault } from './cityAssault';

const OWNER_LABEL = (owner: FactionId) => FACTIONS[owner].ownerLabel;

/** Where the ticked troops at the selected location can march this month, with the cheapest route to each. */
export function moveTargets(state: GameState, ui: UIState): Map<string, MarchStep> {
  if (!ui.selected || !armyAt(state, ui.selected, 'player')) return new Map();
  return playerMarchOptions(state, ui.selected, [...ui.checked]);
}

const isHexCampaign = (state: GameState) => worldOf(state).kind === 'hex';

export function renderCampaign(state: GameState, ui: UIState): string {
  if(ui.creatingFor && ui.rulerDraft)return renderRulerSelection(ui);
  const income = monthlyIncome(state);
  const upkeep = monthlyUpkeep(state);
  const operating = totalCityMaintenance(state);
  const net = income - upkeep - operating;
  return `
  <header class="bar" ${ui.assault || ui.townChoice || ui.notice ? 'inert' : ''}>
    <h1>Aragon <small>${esc(campaignOf(state).name)}</small></h1>
    <span class="date">${dateLabel(state.turn)}</span>
    <span class="gold" title="Taxes ${income}, troop wages ${upkeep}, city maintenance ${operating}">Gold <b>${state.gold}</b>
      <em class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${net}/month</em></span>
    <span class="spacer"></span>
    ${trackedQuests(state).map((q) => `<button data-action="view-quest" data-quest="${q.id}" class="ghost" title="Show ${esc(nodeName(state, questFocus(state, q.id)!))}">${q.kind === 'main' ? 'Objective' : 'Quest'}: ${esc(q.name)}${dueBadge(state, q.id)}</button>`).join('')}
    <button data-action="quests" class="ghost">${ui.view === 'quests' ? 'Back to the map' : `Quests (${openQuests(state).length})`}</button>
    <button data-action="treasury" class="ghost">${ui.view === 'treasury' ? 'Back to the map' : 'Treasury'}</button>
    <button data-action="journal" class="ghost">${ui.view === 'journal' ? 'Back to the map' : `Journal (${state.journal.length})`}</button>
    <button data-action="new-game" class="ghost">New game</button>
    ${ui.view==='map' ? `<button data-action="march-mode" aria-pressed="${!!ui.marchMode}" class="${ui.marchMode?'primary':'ghost'}">${ui.marchMode?'Cancel movement':'Move selected army'}</button>` : ''}
    ${ui.undoMoveLabel ? `<button data-action="undo-move" class="ghost">${esc(ui.undoMoveLabel)}</button>` : ui.undoMoveBlocked ? `<button data-action="undo-move" class="ghost" disabled title="${esc(ui.undoMoveBlocked)}">Can’t undo</button>` : ''}
    <button data-action="end-turn" class="primary" title="End the month (Enter)" ${state.status !== 'playing' ? 'disabled' : ''}>End month</button>
  </header>
  ${renderWeatherTicker(state)}
  ${ui.choosing ? renderChooser(state) : ''}
  ${state.status !== 'playing' ? `<div class="banner ${state.status}">${state.status === 'won' && state.endingReason === 'chapter-complete' ? `${esc(campaignOf(state).chapter!.title)} is complete. ${esc(campaignOf(state).chapter!.ending)}` : state.status === 'won' ? `You have won. ${isHexCampaign(state) ? 'The realm' : 'The valley'} is united.` : state.endingReason === 'lord-dead' ? 'You have lost. Your lord is dead.' : `You have lost. ${esc(nodeName(state, campaignOf(state).capital))} has fallen.`} <button data-action="new-game">Play again</button></div>` : ''}
  ${ui.view === 'city' ? renderCityScreen(state,ui) : ui.view === 'quests' ? renderQuestScreen(state, ui) : ui.view === 'treasury' ? renderTreasury(state) : ui.view === 'journal' ? renderJournal(state) : `<main class="campaign" ${ui.assault || ui.townChoice || ui.notice ? 'inert' : ''}>
    ${isHexCampaign(state) ? renderHexSection(state, ui) : `<section class="map-wrap">
      ${renderActionBar(state, ui)}
      ${renderMapToolbar(state, ui)}
      ${renderOverland(state, ui, [...moveTargets(state, ui).keys()], plannedRoute(state, ui)?.stops.map((s) => s.id) ?? [])}
      <div class="atlas-legend" aria-label="Map legend">
        <span><i class="swatch swatch-forest"></i> Forest</span>
        <span><i class="swatch swatch-hills"></i> Hills</span>
        <span><i class="swatch swatch-water"></i> River</span>
        <span><i class="swatch swatch-marsh"></i> Wetland</span>
        <span><i class="swatch swatch-road"></i> Travel road</span>
      </div>
      <p class="atlas-caption">The illustrated hex terrain shows the province. In this quick-play valley, armies march only between named places linked by a road. For hex-by-hex travel, start the Western Realm.</p>
    </section>`}
    <aside class="side">
      ${ui.message ? `<p class="msg">${esc(ui.message)}</p>` : ''}
      ${renderCityWarWarnings(state)}
      ${renderScoutContacts(state)}
      ${renderCampaignObjectives(state)}
      ${renderOfferNotice(state, ui)}
      ${isHexCampaign(state) ? renderMarchGuide(state, ui) : ''}
      ${isHexCampaign(state) ? '' : renderRoutePlanner(state, ui)}
      ${ui.selected && !isHexCampaign(state) ? renderTravelGuide(state, ui) : ''}
      ${ui.selected ? renderNodePanel(state, ui, ui.selected) : '<p class="hint">Click a place on the map. Your troops show as blue shields.</p>'}
      <details class="log" open><summary>Chronicle</summary><ul>${state.log.slice(0, 14).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`}
  ${ui.assault ? renderCityAssault(state, ui.assault) : ''}
  ${ui.townChoice ? renderTownChoice(state, ui, ui.townChoice) : ''}
  ${ui.notice ? renderNotice(ui.notice) : ''}`;
}

/** Keep the immediate march action visible even when the troop list is farther down the sidebar. */
function renderMarchGuide(state: GameState, ui: UIState): string {
  const army = ui.selected ? armyAt(state, ui.selected, 'player') : undefined;
  const ready = army?.troops.filter((t) => t.mp > 0 && !t.refit) ?? [];
  const checked = ready.filter((t) => ui.checked.has(t.id)).length;
  const destinations = checked ? moveTargets(state, ui).size : 0;
  const otherArmy = state.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.mp > 0 && !t.refit));
  return `<section class="march-guide" aria-label="How to march troops"><h3>March your troops</h3>
    ${army ? `<p><b>1. Choose troops.</b> ${checked} of ${ready.length} ready troops ticked under “Your troops” below.</p>
      <p><b>2. Click a glowing hex</b> on the map to march there${destinations ? ` (${destinations} reachable now)` : ''}.</p>
      ${!checked && ready.length ? '<p class="march-tip">Tick a troop below to show where it can go.</p>' : ''}
      ${!ready.length ? '<p class="march-tip">This army has no movement left. End month to travel again.</p>' : ''}` :
      `<p>Select the hex with your blue army banner first. That opens its troop list and shows reachable hexes.</p>
      ${otherArmy ? `<button data-action="locate-army" data-node="${esc(otherArmy.at)}">Show a ready army</button>` : ''}`}
    <p class="march-tip">An unlit hex only lets you inspect it. For a longer trip, march in stages; End month restores movement.</p>
  </section>`;
}

/** UI-only map controls never mutate the campaign or its saves. */
function renderMapToolbar(state: GameState, ui: UIState): string {
  const layer = ui.mapLayer === 'political' ? 'political' : 'terrain';
  const zoom = Math.min(2, Math.max(1, ui.mapZoom ?? 1));
  return `<div class="map-toolbar" role="toolbar" aria-label="Overland map display">
    <div class="map-layer-group">
      <button data-action="map-layer" data-layer="terrain" aria-pressed="${layer === 'terrain'}"
        class="${layer === 'terrain' ? 'active' : ''}">Terrain</button>
      <button data-action="map-layer" data-layer="political" aria-pressed="${layer === 'political'}"
        class="${layer === 'political' ? 'active' : ''}">Realm borders</button>
    </div>
    <div class="map-zoom-group">
      <button data-action="map-zoom" data-zoom="out" title="Zoom out" aria-label="Zoom out" ${zoom <= 1 ? 'disabled' : ''}>−</button>
      <output aria-label="Map zoom">${Math.round(zoom * 100)}%</output>
      <button data-action="map-zoom" data-zoom="in" title="Zoom in on selected place" aria-label="Zoom in" ${zoom >= 2 ? 'disabled' : ''}>+</button>
    </div>
    <button data-action="plan-route" class="plan-route-button" ${!ui.selected ? 'disabled' : ''}>${ui.routeOrigin ? 'New route' : 'Plan route'}</button>
    <span class="atlas-current">Viewing: ${esc(state.nodes.find((n) => n.id === ui.selected)?.name ?? 'The valley')}</span>
  </div>`;
}

export function plannedRoute(state: GameState, ui: UIState): RoutePreview | null {
  if (!ui.routeOrigin || !ui.routeDestination) return null;
  return previewRoute(state, ui.routeOrigin, ui.routeDestination, ui.routePreference ?? 'shortest');
}

/** Plan a campaign journey without secretly issuing multiple-month movement commands. */
function renderRoutePlanner(state: GameState, ui: UIState): string {
  if (!ui.routeOrigin) return '';
  const from = nodeName(state, ui.routeOrigin);
  const to = ui.routeDestination ? nodeName(state, ui.routeDestination) : null;
  const route = plannedRoute(state, ui);
  const preferences = `<div class="route-preferences">
    <button data-action="route-preference" data-preference="shortest"
      aria-pressed="${ui.routePreference !== 'safer'}"
      class="${ui.routePreference !== 'safer' ? 'active' : ''}">Fewest roads</button>
    <button data-action="route-preference" data-preference="safer"
      aria-pressed="${ui.routePreference === 'safer'}"
      class="${ui.routePreference === 'safer' ? 'active' : ''}">Prefer fewer garrisons</button>
  </div>`;
  const stopList = route ? `<ol class="route-stops">${route.stops.map((s) =>
    `<li><strong>${esc(nodeName(state, s.id))}</strong>
       ${s.risk ? `<span class="route-warning">${esc(s.risk)}</span>` : ''}</li>`).join('')}</ol>` : '';
  const ready = route && route.stops.length > 1 && ui.selected === ui.routeOrigin &&
    moveTargets(state, ui).has(route.stops[1].id);
  return `<section class="route-planner"><h3>Journey planner</h3>
    <p class="sub">Departure: <b>${esc(from)}</b>
    ${to ? ` · Destination: <b>${esc(to)}</b>` : ''}</p>
    ${to ? preferences : '<p>Choose a destination on the map. This previews a route, not army movement.</p>'}
    ${route ? `<p class="route-estimate">${route.legs} road leg${route.legs === 1 ? '' : 's'} ·
      earliest ${esc(dateLabel(state.turn + Math.max(0, route.legs - 1)))}
      <small>Assumes an army can move each month and no battles delay it.</small></p>${stopList}
      ${route.legs > 0 ? `<button data-action="route-first-leg" ${ready ? '' : 'disabled'}
        title="${ready ? 'March checked units along the first road' : 'Select ready troops at the departure location'}">
        March first leg →</button>` : ''}` : to ? '<p class="hint">No connected route available.</p>' : ''}
    <button class="ghost route-clear" data-action="route-clear">Close planner</button>
  </section>`;
}

/** Road-only movement is explicit instead of looking like free hex navigation. */
function renderTravelGuide(state: GameState, ui: UIState): string {
  if (!ui.selected) return '';
  const adjacent = neighborsOf(state, ui.selected);
  if (!adjacent.length) return '';
  const ready = moveTargets(state, ui);
  const choices = adjacent.map((id) => {
    const owner = state.towns[id]?.owner;
    const garrison = state.armies.some((a) => a.at === id && a.owner !== 'player');
    const buttonText = ready.has(id) ? 'March' : 'Inspect';
    return `<button data-action="node" data-node="${esc(id)}" class="travel-destination">
      <span>${esc(nodeName(state, id))}</span>
      <small>${owner ? OWNER_LABEL(owner) : 'Landmark'}${garrison ? ' · Garrison' : ''}</small>
      <b>${buttonText} →</b></button>`;
  }).join('');
  return `<details class="travel-guide" open>
    <summary>Roads from ${esc(nodeName(state, ui.selected))}</summary>
    <p class="hint">${ready.size ? 'Checked troops will march when you select a connected destination.' :
      'Check ready troops below to march, or inspect a neighboring place.'}</p>
    <div class="travel-options">${choices}</div></details>`;
}

/** Recruit buttons for every troop type this town will raise for you, each from its quote. */
function renderRecruit(state: GameState, town: Town, title = 'Raise troops'): string {
  const types = Object.values(UNIT_TYPES).filter((t) => canRecruitAt(state, town, t.id));
  if (!types.length) return '';
  return `<h3>${title}</h3><div class="recruit">${types.map((t) => {
    const quote = recruitQuote(state, town.id, t.id);
    const stats = `${t.men} men · attack ${t.attack} · defense ${t.defense} · move ${t.move}${t.range > 1 ? ` · range ${t.range}` : ''} · upkeep ${t.upkeep}/month`;
    return `<button data-action="recruit" data-node="${town.id}" data-type="${t.id}" ${quote.reason ? 'disabled' : ''}
      title="${esc(quote.reason ? `${quote.reason} (${stats})` : stats)}">
      ${t.name} <span>${quote.gold}g</span></button>`;
  }).join('')}</div>`;
}

/** Side panel for a location: its town (if any), the land on a hex map, and the armies there. */
function renderNodePanel(state: GameState, ui: UIState, at: string): string {
  if(!explored(state,at))return '<h2>Unexplored frontier</h2><p>March into an adjacent gold-bordered frontier hex to scout it. Terrain and nearby sites are revealed by your army; monsters can interrupt travel.</p>';
  const town = townAt(state, at);
  if(town && ui.view==='map'){
    const troops=state.armies.filter(a=>a.at===at && a.owner==='player');
    return '<h2>'+esc(nodeName(state,at))+'</h2><p>'+(town.kind==='capital'?'Your capital':'Town')+' · '+OWNER_LABEL(town.owner)+(relationWith(state,town.id)&&relationWith(state,town.id)!=='self'?' · '+RELATION_LABEL[relationWith(state,town.id) as keyof typeof RELATION_LABEL]:'')+' · '+town.pop.toLocaleString()+' people</p><button data-action="open-city" data-node="'+esc(at)+'" class="primary">Open city</button><p class="sub">Development, recruitment, equipment and city quests are in the city screen. To march on it or attack it, select your army, tick its troops and click the town when it is lit (or use Move selected army).</p>'+questPointer(state,town.id)+renderSiege(state,town.id)+renderIntel(state,town.id)+(town.owner==='player'?renderRaidThreat(state,town.id):'')+troops.map(a=>renderArmy(state,ui,a)).join('');
  }
  const id = town?.id ?? at;
  const armies = state.armies.filter((a) => a.at === at);
  let html = `<h2>${esc(nodeName(state, at))}</h2>`;
  const world = worldOf(state);
  if (town) {
    html += placeScene(state, town.id);
    const profile = campaignOf(state).settlementProfiles?.[id];
    if (profile) html += `<p class="sub"><b>${esc(profile.region)}</b> · ${esc(profile.role)}</p>`;
    html += `<p class="sub">${town.kind === 'lair' ? 'Orc stronghold' : town.kind === 'capital' ? 'Your capital' : 'Town'} · ${OWNER_LABEL(town.owner)}${(() => {
      const relation = relationWith(state, id);
      return relation && relation !== 'self' && town.kind !== 'lair' ? ` · ${RELATION_LABEL[relation]}` : '';
    })()}</p>`;
    if (town.kind !== 'lair') html += `<p>Population <b>${town.pop.toLocaleString()}</b></p>`;
    if (town.owner === 'player' && town.kind !== 'lair') {
      const reports = state.journal.filter((entry) => entry.place === at && entry.kind === 'realm' && entry.text.startsWith('Scout at ')).slice(-3).reverse();
      if (reports.length) html += `<section class="scout-intel"><h3>Scout reports</h3><ul>${reports.map((report) => `<li><b>Month ${report.turn}:</b> ${esc(report.text)}</li>`).join('')}</ul></section>`;
      const growth = townGrowth(town);
      html += `<label class="tax">Tax rate
        <select data-change="tax" data-node="${id}">
          ${Array.from({ length: 11 }, (_, i) => i * 5).map((v) => `<option value="${v}" ${v === town.tax ? 'selected' : ''}>${v}%</option>`).join('')}
        </select></label>
        <p class="sub">Brings in ${townIncome(town)} gold a month. Population ${growth >= 0 ? 'grows' : 'shrinks'} by about ${Math.abs(growth)}.</p>
        ${renderRecruit(state, town)}${renderRaidThreat(state, town.id)}`;
      if (town.kind !== 'capital') html += `<p class="sub">Knights can only be raised in ${esc(nodeName(state, campaignOf(state).capital))}.</p>`;
      html += renderCityDevelopment(state, id);
      html += renderOffers(state, id);
    } else if (relationWith(state, id) === 'ally' || relationWith(state, id) === 'vassal') {
      html += `<p class="sub">Allied free town: it keeps its own rule and taxes.</p>${renderRecruit(state, town, 'Allied troops')}`;
    }
  } else if (world.kind === 'hex') {
    const land = hexLand(world, at);
    const landmark = placeAt(state, at);
    const lair = lairAt(state, at);
    const shown = !lair || state.lairs[lair.id]?.discovered;
    html += `<p class="sub">${landmark && shown ? `${land.name} · ${lair ? 'monster lair' : 'landmark'}` : land.name}${hasRoad(state, at) ? ' · on the road' : ''}</p><p class="sub">${esc(land.text)}</p>`;
    if (lair && shown) html += renderLair(state, lair);
  } else {
    html += `<p class="sub">Open country</p>`;
  }
  const site = town?.id ?? placeAt(state, at)?.id;
  if (town) html += renderMerchants(state, town.id);
  // Quests offered in a town are named in one line (they are in full on the Quests screen and the city screen);
  // a quest site's encounter keeps its full card, so an army standing there can act from where it is.
  const offered = (town ? questsAt(state, town.id) : []).filter((d) => isOpen(state.quests[d.id]));
  if (town) html += questPointer(state, town.id);
  if (site) html += renderQuests(state, questsAtSite(state, site).filter((d) => !offered.includes(d)));
  for (const a of armies) html += renderArmy(state, ui, a);
  if (!armies.length) html += `<p class="sub">No troops here.</p>`;
  return html;
}

function renderCityDevelopment(state: GameState, id: string): string {
  const city = state.cityEconomies[id];
  if (!city) return '';
  const stock = city.goods;
  const latest = city.lastMonth;
  const project = city.project;
  const stockLine = `Food ${stock.food} · Timber ${stock.timber} · Ore ${stock.ore} · Tools ${stock.tools}`;
  const results = latest
    ? `Last month: produced ${latest.produced.food} food, ${latest.produced.timber} timber, ${latest.produced.ore} ore,
      ${latest.produced.tools} tools; consumed ${latest.consumedFood} food.
      ${latest.unmetFood > 0 ? `Food shortage: ${latest.unmetFood} units.` : ''}
      Workers ${latest.employed}/${latest.workforce} employed in industry.`
    : 'Production starts at the end of the first month. Food consumption is 1 unit per 100 residents.';
  const cards = BUILDING_IDS.map((kind) => {
    const def = BUILDINGS[kind];
    const q = constructionQuote(state, id, kind);
    const level = city.buildings[kind];
    const demolition = dismantleQuote(state,id,kind);
    const req = Object.entries(q.materials).map(([name, n]) => `${n} ${name}`).join(' + ');
    const yieldFactor = def.resource ? endowment(id)[def.resource] : 1;
    const maxOutput = Math.floor(q.targetLevel * def.capacity * yieldFactor);
    return `<div class="building-card"><div><b>${def.name}</b> <small>Level ${level}/2</small></div>
      <p class="sub">${def.output}: up to ${maxOutput}/month at next tier (subject to labor and inputs).
        Upkeep +${def.upkeep}g/month per new tier.</p>
      <button data-action="construct" data-node="${id}" data-kind="${kind}" ${q.reason ? 'disabled' : ''}
        title="${q.reason ? esc(q.reason) : 'Begin construction (completes after this month)'}">
        ${level ? 'Upgrade' : 'Build'} · ${q.gold}g + ${req}</button>
      ${q.reason && q.reason !== 'One construction project at a time.' ? `<small class="hint">${esc(q.reason)}</small>` : ''}
      ${level && kind !== 'farm' ? `<details><summary>Redevelop this site</summary><p>Remove every level of ${def.name} and stop its production. Stored goods remain. No gold or materials are refunded.</p><button data-action="dismantle" data-node="${id}" data-kind="${kind}" ${demolition.reason?'disabled':''}>Confirm removal of ${def.name}</button>${demolition.reason?`<small>${esc(demolition.reason)}</small>`:''}</details>` : ''}
    </div>`;
  }).join('');
  return `<section class="city-development"><h3>City development</h3>
    <p class="sub">Public stocks: ${stockLine}. Sites used: ${developmentSites(city)}/3.
      Maintenance ${cityMaintenance(state, id)}g/month.</p>
    <p class="sub">${results}</p>
    ${project ? `<p class="notice">Under construction: ${BUILDINGS[project.kind].name} level ${project.targetLevel}.
      Already paid; completes after this month's production.</p>` : ''}
    <div class="building-grid">${cards}</div></section>`;
}

/** Cards for every quest offered at this town: the current stage and one button per choice, from its quote. */
function renderQuests(state: GameState, defs: QuestDefinition[]): string {
  return defs.map((def) => {
    const q = state.quests[def.id];
    if (q.status === 'unavailable') return '';
    const head = `<div class="quest-card" id="quest-${def.id}"><h3>${esc(def.name)}${dueBadge(state, def.id)} <small>${def.kind === 'main' ? 'Main objective' : 'Side quest'} · ${esc(def.giver)} · ${esc(nodeName(state, def.at))}</small></h3>`;
    if (!isOpen(q)) {
      const passage = q.status === 'succeeded' && state.treaties[def.at]?.passage
        ? `<p class="sub">Your armies may share this town with its neutral garrison. ${esc(nodeName(state, def.at))} remains independent and pays no tax.</p>` : '';
      return `${head}<p>${esc(questSummary(state, def.id))}.</p>${questOutcome(state,def.id)}${passage}</div>`;
    }
    const stage = stageOf(def, q.stage)!;
    const quotes = stage.choices.map((c) => ({ c, quote: questQuote(state, def.id, c.id) }));
    // Reasons shared by every choice (no envoy, battle) are shown once above the buttons.
    const shared = quotes.length && quotes.every((x) => x.quote.reason && x.quote.reason === quotes[0].quote.reason) ? quotes[0].quote.reason : null;
    const due = stage.deadline && q.stageTurn !== null ? dateLabel(q.stageTurn + stage.deadline.months) : null;
    const deadline = !due ? '' : stage.deadline!.outcome.status === 'succeeded'
      ? `<p class="sub">Hold until ${esc(due)}.</p>`
      : `<p class="sub">${stage.choices.length ? 'Decide' : 'Finish'} by ${esc(due)}, or this ends on its own.</p>`;
    const destinations = questSites(state, def.id).filter((site) => site !== def.at);
    const siteLinks = destinations.length ? `<p class="quest-sites">${def.adventureSite ? 'Adventure site' : 'Encounter site'}${destinations.length > 1 ? 's' : ''}: ${destinations.map((site) => `<button class="link" data-action="goto" data-node="${startLocation(state, site)}">Show ${esc(nodeName(state, site))}</button>`).join(' · ')}</p>` : '';
    const goals = stage.objectives?.length ? `<ul class="objectives">${stage.objectives.map((o) => {
      const met = o.when.every((c) => conditionHolds(state, c));
      return `<li class="${met ? 'met' : ''}">${met ? '✓' : '○'} ${o.when.map((c) => esc(conditionText(state, c))).join('; ')}</li>`;
    }).join('')}</ul><p class="sub">Goals are checked at the end of each month.</p>` : '';
    return `${head}${def.adventureSite ? '<p class="adventure-label">Ruler adventure · your army waits outside. Progress is saved after each choice.</p>' : ''}<p>${esc(def.summary)}</p><p class="sub">${esc(stage.text)}</p>${siteLinks}${goals}${deadline}
      ${shared ? `<p class="hint">${esc(shared)}</p>` : ''}
      ${quotes.length ? `<div class="quest-actions">${quotes.map(({ c, quote }) => `<div class="quest-option"><button data-action="quest-choice" data-quest="${def.id}" data-choice="${c.id}"
        ${quote.reason ? `disabled title="${esc(quote.reason)}"` : ''}>${esc(c.label)}${quote.gold ? ` · ${quote.gold}g` : ''}${'encounter' in c.then ? ` · battle at ${esc(nodeName(state, startLocation(state, c.then.encounter.site)))}` : ''}</button>${quote.reason && !shared ? `<small class="hint">${esc(quote.reason)}</small>` : ''}${quote.encounter ? renderEncounterParty(state, quote.encounter) : ''}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');
}

/** Show the real quote's participants, without predicting combat odds or selecting troops for the player. */
function renderEncounterParty(state: GameState, preview: EncounterPreview): string {
  if (preview.armyId === null) return '';
  const troops = state.armies.find((army) => army.id === preview.armyId)!.troops;
  const names = (ids: number[]) => ids.map((id) => {
    const troop = troops.find((t) => t.id === id)!;
    const type = UNIT_TYPES[troop.type];
    return esc(`${troop.name ?? type.name} (Lv ${type.hero ? heroLevel(troop.xp) : level(troop.xp)}, ${troop.men} ${type.hero ? 'HP' : 'men'})`);
  }).join(', ');
  return `<details class="encounter-party"><summary>Expedition: ${preview.deployed.length} deployed${preview.reserves.length ? ` · ${preview.reserves.length} in reserve` : ''}${preview.waiting.length ? ` · ${preview.waiting.length} stay outside` : ''}</summary>
    <p>${preview.heroesOnly ? 'Only hired heroes enter; your lord and units stay outside.' : 'The whole army at this site joins the expedition.'}</p>
    <p><b>Deployed:</b> ${preview.deployed.length ? names(preview.deployed) : 'No eligible troops at this site.'}</p>
    ${preview.reserves.length ? `<p><b>Off-field reserves:</b> ${names(preview.reserves)}. They stay off the field and earn no combat experience.</p>` : ''}
    ${preview.waiting.length ? `<p><b>Waiting outside:</b> ${names(preview.waiting)}</p>` : ''}
  </details>`;
}

/**
 * The town's raid threat (monster raids spec, steps 3 and 4): a raid already on its way and what losing it would
 * cost, this month's odds with the lairs behind them, the garrison's strength against the threat, what it would
 * take to deter raids, and how the town's last raids ended.
 */
function renderRaidThreat(state: GameState, townId: string): string {
  const due = state.raids.find((r) => r.target === townId);
  const odds = raidOdds(state, townId);
  const past = raidsOn(state, townId).slice(0, 3);
  if (!due && !odds.sources.length && !past.length) return '';
  const name = (id: string) => (state.lairs[id]?.discovered ? LAIRS[id].name : 'an unknown lair');
  const from = odds.sources.map((s) => `${SPECIES[s.lair.species].name.toLowerCase()} from ${name(s.lair.id)}`).join(', ');
  const warning = due ? `<p class="msg raid-warning">${esc(`Raid expected ${monthsAway(due.arrives - state.turn)}: ${SPECIES[LAIRS[due.lair].species].name.toLowerCase()} from ${name(due.lair)}. ${raidStakes(state, due.lair, townId)}`)} Reinforce to ${odds.needed.toFixed(1)} defence to turn them back.</p>` : '';
  const history = past.length ? `<p class="sub">Last raids:</p><ul class="raid-history">${past.map((r) => `<li>${esc(raidLine(r))}</li>`).join('')}</ul>` : '';
  const line = !odds.sources.length ? '' : odds.deterred
    ? `Deterred: the garrison (${odds.defense.toFixed(1)}) is at least ${DETERRENCE}× the threat (${odds.threat.toFixed(1)}). No routine raids.`
    : `${Math.round(odds.chance * 100)}% chance of a raid each month. Garrison ${odds.defense.toFixed(1)} against a threat of ${odds.threat.toFixed(1)}; ${odds.needed.toFixed(1)} would deter raids.`;
  return `<section class="raid-threat"><h3>Raid threat</h3>${warning}${line ? `<p class="sub">${esc(line)}</p>` : ''}${from ? `<p class="sub">${esc(`In reach: ${from}.`)}</p>` : ''}${history}</section>`;
}


/** A found lair: its people, how they fight and how to counter them, its garrison and plunder, or that it's cleared. */
function renderLair(state: GameState, lair: LairDefinition): string {
  const st = state.lairs[lair.id];
  const sp = SPECIES[lair.species];
  const garrison = lairGarrison(state, lair);
  return `${placeScene(state, lair.place, lair.species, st.status === 'cleared')}<div class="quest-card lair"><h3>${esc(lair.name)} <small>${sp.name} · tier ${lair.tier}</small></h3>
    ${st.status === 'cleared'
      ? `<p>Cleared${st.clearedTurn ? ` in ${esc(dateLabel(st.clearedTurn))}` : ''}. Nothing stirs here now.</p>`
      : `<p class="sub">${esc(sp.tactics)}</p><p class="sub">Counter: ${esc(sp.counter)}</p>
        <p>${garrison ? `Garrison: ${garrison.troops.length} units (${esc(garrison.troops.map((t) => UNIT_TYPES[t.type].name).join(', '))}).` : ''}
        Defeat it to clear the lair for good: ${lair.loot.gold} gold in plunder.</p>`}
  </div>`;
}

/** Stalls in this town opened (or closed) by a quest's outcome, with a buy button per stocked item. */
function renderMerchants(state: GameState, townId: string): string {
  return merchantsAt(state, townId).map((m) => {
    const status = merchantStatus(state, m)!;
    const rows = status.open ? `<div class="quest-actions">${m.stock.map((line) => {
      const q = buyQuote(state, m.id, line.item);
      return `<div class="quest-option"><button data-action="buy-item" data-merchant="${m.id}" data-item="${line.item}" ${q.reason ? `disabled title="${esc(q.reason)}"` : ''}>
        Buy ${esc(ITEMS[line.item].name)} · ${q.gold}g</button><small class="hint">${q.left} left this month${q.reason && q.left > 0 ? ` · ${esc(q.reason)}` : ''}</small></div>`;
    }).join('')}</div>` : '';
    return `<div class="quest-card merchant"><h3>${esc(m.name)}</h3><p class="sub">${esc(status.note)}</p>${rows}</div>`;
  }).join('');
}

/** What a hero carries, each with a button to take it off (into the inventory) where that's allowed. */
function renderKit(state: GameState, hero: Troop): string {
  const slots = HERO_SLOTS.filter((slot) => hero.kit?.[slot]);
  if (!slots.length) return '';
  return `<div class="kit">${slots.map((slot) => {
    const item = ITEMS[hero.kit![slot]!];
    const quote = unequipQuote(state, hero.id, slot);
    return `<span class="kit-item" title="${esc(item.rules)}">${esc(item.name)}
      <button class="link" data-action="unequip-item" data-troop="${hero.id}" data-slot="${slot}" ${quote.reason ? `disabled title="${esc(quote.reason)}"` : ''}>take off</button></span>`;
  }).join('')}</div>`;
}

/** The weather ticker: this month's season and weather, what it does, and how many of your armies are exposed to it. */
function renderWeatherTicker(state: GameState): string {
  const { season, kind, rule } = currentWeather(state);
  const icon = { clear: '☀', rain: '☂', storm: '⚡', snow: '❄', blizzard: '❄' }[kind];
  const exposed = state.armies.filter((a) => a.owner === 'player' && exposureLoss(state, a) > 0);
  const camped = exposed.filter((a) => a.campTurn === state.turn).length;
  const warn = exposed.length
    ? `<span class="exposed">${exposed.length} of your armies ${exposed.length === 1 ? 'is' : 'are'} in the open${camped ? ` (${camped} camped)` : ''}: reach a town, or set up camp to halve the losses.</span>` : '';
  return `<div class="weather-ticker${rule.exposure ? ' harsh' : ''}" role="status" aria-live="polite">${icon} <b>${SEASON_NAME[season]} · ${rule.name}</b> <span>${esc(rule.text)}</span>${warn}</div>`;
}

function renderArmy(state: GameState, ui: UIState, a: Army): string {
  const mine = a.owner === 'player';
  const hexWorld = isHexCampaign(state);
  const rows = a.troops
    .map((t) => {
      const type = UNIT_TYPES[t.type];
      const spent = t.mp <= 0;
      const box = mine
        ? `<input type="checkbox" data-change="check" data-troop="${t.id}" ${ui.checked.has(t.id) ? 'checked' : ''} ${spent || t.refit ? 'disabled' : ''}/>`
        : '';
      // On a hex map show movement left this month; on the valley a march takes the whole month.
      const marched = !mine ? '' : hexWorld ? `<span class="tag" title="Movement left this month">${t.mp}/${marchRate(state, t)}</span>` : spent ? '<span class="tag">marched</span>' : '';
      if (type.hero) {
        const mana = type.hero.mana ? ` · ${t.mana ?? 0}/${heroMaxMana(t.type, t.xp)} mana` : '';
        return `<li class="hero ${spent && mine ? 'done' : ''}"><label>${box}<span class="tname">★ ${esc(t.name ?? type.name)}
          <small>${t.type==='lord' && state.rulerAppearance ? 'Knight' : type.name}</small></span><span class="men">${t.men}/${heroMaxHp(t.type, t.xp)} HP${mana}</span>
          <span class="lv">Lv ${heroLevel(t.xp)}</span>${marched}</label>${mine ? renderKit(state, t) : ''}</li>`;
      }
      const lv = level(t.xp);
      return `<li class="${spent && mine ? 'done' : ''}"><label>${box}<span class="tname">${type.name}</span>
        <span class="men">${t.men} men</span><span class="lv">Lv ${lv}</span>
        <small class="gear-label">${t.gear.bow ? EQUIPMENT[t.gear.bow].name + ' · ' : ''}${EQUIPMENT[t.gear.armor].name}</small>
        ${t.refit ? '<span class="tag">refitting</span>' : ''}${marched}</label></li>`;
    })
    .join('');
  const ready = mine && a.troops.some((t) => t.mp > 0);
  const hint = hexWorld
    ? 'Tick the troops to send, then click a lit hex. The slowest troop sets the pace. Roads cost 1; plains and farmland 2; forest, hills and badlands 3; deep woods and swamp 4.'
    : 'Tick the troops to send, then click a glowing place on the map.';
  const weather = currentWeather(state);
  const loss = mine ? exposureLoss(state, a) : 0;
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const cold = !loss ? '' : a.campTurn === state.turn
    ? `<p class="msg exposure-warning">${esc(`In camp: this ${weather.rule.name.toLowerCase()} will cost the army ${pct(loss)} of its men at month end instead of ${pct(weather.rule.exposure)}.`)}</p>`
    : `<p class="msg exposure-warning">${esc(`In the open: this ${weather.rule.name.toLowerCase()} will cost the army ${pct(loss)} of its men at month end unless it reaches one of your towns or an allied one.`)}
      <br><button data-action="make-camp" data-army="${a.id}" title="Ends this army's marching for the month">Set up camp</button> <small>Halves the loss to ${pct(loss / 2)}, but the army can't march again this month.</small></p>`;
  return `<div class="army-card own-${a.owner}"><h3>${mine ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : 'Town militia'}</h3>
    ${mine ? renderBesieging(state, a) : ''}${mine ? a.troops.filter((t) => t.type === 'spy').map((t) => `<p class="sub spy-note"><b>${esc(t.name ?? 'Spy')} #${t.id}</b> · Lv ${level(t.xp)}: each month may unmask hidden enemy scouts within ${SCOUT_RANGE} hexes (${Math.round(detectChance(level(t.xp), 1) * 100)}% against a new scout). It gains experience with every scout it finds. Travelling alone, it slips past armies unseen and spots signs of hidden scouts as it goes.${renderInfiltrate(state, a, t)}</p>`).join('') : ''}${mine && a.troops.some((t) => t.type === 'engineer') ? '<p class="sub">Engineers march with the army but never fight. In battle they build field forts, bridges and siege towers; in a siege they batter down the walls.</p>' : ''}${cold}${mine && a.troops.length > 1 && a.at === ui.selected ? `<div class="troop-quick"><button data-action="troops-all" class="ghost">Select all</button><button data-action="troops-none" class="ghost">Deselect all</button></div>` : ''}<ul class="troops">${rows}</ul>
    ${mine ? a.troops.filter((t) => t.type === 'scout').map((t) => `<div class="scout-post"><b>Scout #${t.id}</b> · ${onWatch(t) ? `On watch over ${esc(nodeName(state, a.at))}` : 'Not on watch'}
      <div class="save-actions">
        ${onWatch(t) ? `<button data-action="scout-post" data-troop="${t.id}" data-post="recall">Stop watching</button>` : `<button data-action="scout-post" data-troop="${t.id}" data-post="watch">Keep watch here</button>`}
        ${a.troops.length > 1 ? `<button data-action="station-scout" data-troop="${t.id}" title="The scout leaves this army and keeps watch here alone; the army can march on">Station scout here</button>` : ''}
      </div><small class="sub">Lv ${level(t.xp)}: gains experience each month on watch, and the higher its level the harder it is for enemy spies to find. A scout on watch sees ${SCOUT_RANGE} hexes all around (shaded on the map) and reports visible orc and rival-city forces with an estimated destination. Scouts stay out of battle and cannot capture towns; an enemy reaching their post ends their watch. Isolated scouts cannot hold a position. Marching the scout ends its watch.</small></div>`).join('') : ''}
    ${mine && ui.view==='city' && townAt(state, a.at)?.owner === 'player' ? renderRefitChoices(state, a, ui) : ''}
    ${mine ? '<p class="sub">In battle, your toughest melee units set up in front; archers, casters and the leader start behind them.</p>' : ''}
    ${ready ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

function renderRefitChoices(state: GameState, army: Army, ui:UIState): string {
  // Units the player can raise (orc troops captured in some future rule would not qualify).
  const choices = army.troops.filter((t) => !UNIT_TYPES[t.type].hero && UNIT_TYPES[t.type].recruit !== null);
  if (!choices.length) return '';
  return `<section class="refit-panel" aria-label="Troop equipment"><h3>Troop equipment upgrades</h3>
    <p class="sub">Select an upgrade to inspect it. Chain armor needs level 2 troops and a Tool Forge; better bows and plate need more experience. Heroes use Journal → Inventory instead. Upgrades require experience, an owned city, enough gold and local materials. Refitting takes the rest of this month; the previous equipment remains in use until completion.</p>
    ${choices.map((troop) => {
      const options = usesBow(troop.type) ? ['long-bow', 'compound-bow', 'chain'] as const : ['chain', 'plate'] as const;
      return `<div class="refit-row"><b>${UNIT_TYPES[troop.type].name} #${troop.id}</b>
        <small>Lv ${level(troop.xp)} · upkeep +${equipmentUpkeep(troop)}g/month for gear</small>
        ${options.map((id) => {
          const townId = townAt(state, army.at)!.id;
          const quote = refitQuote(state, townId, troop.id, id);
          const gear = EQUIPMENT[id];
          const inputs = Object.entries(quote.materials).map(([g, qty]) => `${qty} ${g}`).join(' + ');
          return `<div class="refit-option"><button data-action="inspect-refit" data-node="${townId}"
            data-troop="${troop.id}" data-item="${id}" aria-pressed="${ui.refitChoice?.troop===troop.id && ui.refitChoice.item===id}"
            title="${esc(quote.reason ?? 'Inspect this upgrade and its cost')}">
            ${gear.name} · ${quote.gold}g${inputs ? ' + ' + inputs : ''}</button>
            <small>Lv ${gear.level}+ · ${gear.slot === 'bow' ? `Damage ×${gear.attackFactor}, range +${gear.rangeBonus}` :
              `Defense +${gear.defenseBonus}`} · upkeep ${gear.upkeep}g/mo
              ${quote.reason ? ' · ' + esc(quote.reason) : ''}</small>${ui.refitChoice?.troop===troop.id && ui.refitChoice.item===id ? `<div class="refit-preview"><p>${quote.reason ? esc(quote.reason)+' Earn experience in battle, build the required forge and keep this unit in town to refit.' : 'Ready to order. Pay now; equipment arrives at month end.'}</p><button data-action="refit" data-node="${townId}" data-troop="${troop.id}" data-item="${id}" ${quote.reason?'disabled':''}>Confirm refit · ${quote.gold}g</button></div>` : ''}</div>`;
        }).join('')}</div>`;
    }).join('')}
  </section>`;
}

function heroSummary(typeId: string): string {
  const t = UNIT_TYPES[typeId];
  const spells = t.hero!.spells.map((sp) => SPELLS[sp].name).join(', ');
  const lead = t.hero!.leadership ? `leadership +${t.hero!.leadership}` : '';
  return [`${t.men} HP`, `attack ${t.attack}`, `defense ${t.defense}`, lead, spells && `spells: ${spells}`].filter(Boolean).join(' · ');
}

function renderOffers(state: GameState, townId: string): string {
  const offers = state.offers.filter((o) => o.town === townId);
  if (!offers.length) return '';
  return `<h3>Heroes for hire</h3>${offers
    .map((o) => {
      const t = UNIT_TYPES[o.type];
      const i = state.offers.indexOf(o);
      return `<div class="offer"><p><b>${esc(o.name)}</b>, ${t.name.toLowerCase()}. ${heroSummary(o.type)}.
        <span class="sub">Pay ${t.upkeep} gold a month. Leaves after ${state.turn >= o.expires ? 'this month' : `${o.expires - state.turn + 1} months`}.</span></p>
        ${(() => {
          const quote = hireQuote(state, o);
          return `<button data-action="hire" data-offer="${i}" ${quote.reason ? `disabled title="${esc(quote.reason)}"` : ''}>Hire for ${quote.gold}g</button>`;
        })()}</div>`;
    })
    .join('')}`;
}

function renderOfferNotice(state: GameState, ui: UIState): string {
  const elsewhere = state.offers.filter((o) => townLocation(state, o.town) !== ui.selected);
  if (!elsewhere.length) return '';
  return `<p class="notice">${elsewhere
    .map((o) => `<button class="link" data-action="goto" data-node="${townLocation(state, o.town)}">${esc(o.name)} waits in ${esc(nodeName(state, o.town))}</button>`)
    .join(' · ')}</p>`;
}

/** The Western Realm's walkable pixel map, with a short key to movement costs. */
function renderHexSection(state: GameState, ui: UIState): string {
  const world = worldOf(state);
  if (world.kind !== 'hex') return '';
  const zoom = hexZoom(ui);
  const step = HEX_ZOOMS.indexOf(zoom as (typeof HEX_ZOOMS)[number]);
  return `<section class="map-wrap">
    ${renderActionBar(state, ui)}
    <div class="map-toolbar" role="toolbar" aria-label="Map display">
      <div class="map-zoom-group">
        <button data-action="hex-zoom" data-zoom="out" title="Zoom out" aria-label="Zoom out" ${step <= 0 ? 'disabled' : ''}>−</button>
        <output aria-label="Map zoom">${Math.round(zoom * 100)}%</output>
        <button data-action="hex-zoom" data-zoom="in" title="Zoom in" aria-label="Zoom in" ${step >= HEX_ZOOMS.length - 1 ? 'disabled' : ''}>+</button>
        <button data-action="hex-center" class="ghost" title="Scroll to the selected hex" ${ui.selected ? '' : 'disabled'}>Centre</button>
      </div>
      <span class="sub">Drag or scroll to look around.</span>
    </div>
    <div class="hex-scroll">${renderHexMap(state, ui, world, moveTargets(state, ui), ui.selected ? arrivalEstimates(state, ui.selected, [...ui.checked]) : new Map())}</div>
    <div class="map-legend" aria-label="Map legend">${(['player', 'enemy', 'free', 'lair', 'cleared'] as BannerKind[]).map((k) =>
      `<span><svg viewBox="0 0 12 13" width="14" height="15" aria-hidden="true">${bannerSvg(k, 0, 0)}</svg>${BANNER_LABEL[k]}</span>`).join('')}</div>
    <p class="atlas-caption">Every hex can be walked. Roads cost 1 movement; plains and farmland 2; forest, hills and badlands 3; deep woods and swamp 4. Rivers are crossed only at bridges and mountains only at Grey Pass or the southern trail. Hover a hex for its cost and how many months it takes to reach.</p>
  </section>`;
}

/** Pick a campaign. Starting one replaces the current game, so the panel says so and offers Cancel. */
function renderChooser(state: GameState): string {
  const cards = (Object.keys(CATALOG.campaigns) as CampaignId[])
    .map((id) => {
      const c = CATALOG.campaigns[id];
      return `<div class="campaign-card"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>
        <button class="primary" data-action="start-campaign" data-campaign="${id}">Start</button></div>`;
    })
    .join('');
  const warning = state.status === 'playing' && state.turn > 1 ? '<p class="sub">Starting a new campaign replaces the game you are playing.</p>' : '';
  return `<div class="chooser" role="dialog" aria-label="Choose a campaign"><div class="chooser-box">
    <h2>Choose a campaign</h2>${warning}<div class="campaign-cards">${cards}</div>
    <button class="ghost" data-action="cancel-choose">Cancel</button></div></div>`;
}

/**
 * Reinforce units stationed in this town, in its Recruitment tab: recruit 10 or fill to capacity. Recruits
 * arrive untrained, so the unit's experience is shared out and its level drops; the buttons show by how much.
 */
function renderReinforce(state:GameState,townId:string):string{
 const at=townLocation(state,townId),army=armyAt(state,at,'player');
 const units=army?.troops.filter(t=>!UNIT_TYPES[t.type].hero && UNIT_TYPES[t.type].recruit!==null && t.type!=='scout')??[];
 if(!units.length)return '';
 const after=(t:Troop,men:number)=>level(Math.floor(t.xp*t.men/(t.men+men)));
 const lv=(t:Troop,men:number)=>men&&after(t,men)<level(t.xp)?' · Lv '+level(t.xp)+' → '+after(t,men):' · Lv '+level(t.xp);
 return '<section class="refit-panel"><h3>Reinforce an existing unit</h3><p class="sub">Adds soldiers to a unit stationed here. Infantry hold up to 100; mounted 50 in leather, 33 in chain, 25 in plate. Recruits arrive untrained: the unit’s experience is shared across everyone, so its level drops, and filling a small veteran unit to full strength erases most of what it learned. Equipment is kept and outfitting is included; bigger units cost more upkeep.</p>'+units.map(t=>{
 const q=replacementQuote(state,t.id,10),full=replacementQuote(state,t.id);
 return '<p><b>'+esc(UNIT_TYPES[t.type].name)+' #'+t.id+'</b> · '+t.men+'/'+formationCapacity(t)+' men · Lv '+level(t.xp)+'<br><button data-action="replacements" data-troop="'+t.id+'" data-count="10" '+(q.reason?'disabled':'')+'>Recruit '+q.men+' · '+q.gold+'g'+lv(t,q.men)+'</button> <button data-action="replacements" data-troop="'+t.id+'" '+(full.reason?'disabled':'')+' title="'+esc(full.reason??'Recruit to this unit’s capacity')+'">Fill to '+full.capacity+' · '+full.gold+'g'+lv(t,full.men)+'</button>'+(q.reason?'<small>'+esc(q.reason)+'</small>':'')+'</p>';
 }).join('')+'</section>';
}
function renderCampaignObjectives(state:GameState):string{
 const objectives=campaignObjectives(state);if(!objectives.length)return '';
 return '<section class="campaign-objectives"><h2>Unite the Western Realm</h2><p>'+DIFFICULTIES[state.challenge!.difficulty].name+' · '+(state.challenge!.fog?'Explore to reveal the map. ':'')+'Complete these in any order. You can storm Gharzak Hold whenever you dare (its garrison is elite); the realm is won once every objective is done.</p><ol>'+objectives.map(o=>'<li class="'+(o.done?'objective-done':'')+'">'+(o.done?'✓ ':'○ ')+esc(o.label)+(o.at?'<button class="link" data-action="goto" data-node="'+esc(startLocation(state,o.at))+'">Show objective</button>':'')+'</li>').join('')+'</ol></section>';
}

function renderCityScreen(state:GameState,ui:UIState):string{
 const town=ui.selected?townAt(state,ui.selected):undefined;
 if(!town || !ui.selected || !explored(state,ui.selected))return '<main class="city-screen"><button data-action="close-city">Back to overland map</button><p>Select a discovered settlement.</p></main>';
 const owned=town.owner==='player' && town.kind!=='lair',ally=['ally','vassal'].includes(relationWith(state,town.id)??'');
 const tabs:{id:NonNullable<UIState['cityTab']>;label:string}[]=[{id:'overview',label:'Overview'},...(owned?[{id:'development' as const,label:'Development'}]:[]),...(owned||ally?[{id:'recruitment' as const,label:'Recruitment'}]:[]),{id:'army',label:'Army & equipment'},{id:'quests',label:'Quests & diplomacy'}];
 const tab=tabs.some(t=>t.id===ui.cityTab)?ui.cityTab!:'overview';
 let content='';
 if(tab==='overview'){
  content=renderScoutContacts(state,ui.selected!)+renderSiege(state,town.id)+placeScene(state,town.id)+'<p>'+OWNER_LABEL(town.owner)+' · '+(RELATION_LABEL[relationWith(state,town.id) as keyof typeof RELATION_LABEL]??'Your city')+' · Population '+town.pop.toLocaleString()+'</p>';
  if(owned)content+='<label class="tax">Tax rate<select data-change="tax" data-node="'+town.id+'">'+Array.from({length:11},(_,i)=>i*5).map(v=>'<option value="'+v+'" '+(town.tax===v?'selected':'')+'>'+v+'%</option>').join('')+'</select></label><p>Income: '+townIncome(town)+' gold/month. Population change: '+townGrowth(town)+'/month.</p>'+renderRaidThreat(state,town.id);
  const profile=campaignOf(state).settlementProfiles?.[town.id];if(profile)content+='<p>'+esc(profile.role)+'</p>';
  content+=renderMerchants(state,town.id);
 }
 if(tab==='development')content=renderCityDevelopment(state,town.id);
 if(tab==='recruitment')content=renderRecruit(state,town,owned?'Raise a new unit':'Allied troops')+(owned?'<p class="sub">A new unit starts at full strength and level 1.</p>'+renderReinforce(state,town.id):'')+renderOffers(state,town.id);
 if(tab==='army'){
  const armies=state.armies.filter(a=>a.at===ui.selected);content=armies.map(a=>renderArmy(state,ui,a)).join('')||'<p>No units are stationed here.</p>';
 }
 if(tab==='quests')content=renderQuests(state,questsAt(state,town.id))||'<p>No quests are currently offered here.</p>';
 return '<main class="city-screen"><header class="city-heading"><div><p class="report-eyebrow">City management</p><h1>'+esc(nodeName(state,ui.selected))+'</h1></div><button class="primary" data-action="close-city">Back to overland map</button></header><nav class="city-tabs" aria-label="City management">'+tabs.map(t=>'<button data-action="city-tab" data-tab="'+t.id+'" aria-pressed="'+(t.id===tab)+'" class="'+(t.id===tab?'primary':'ghost')+'">'+t.label+'</button>').join('')+'</nav>'+(ui.message?'<p class="msg" role="status">'+esc(ui.message)+'</p>':'')+'<section class="city-content" aria-label="'+tabs.find(t=>t.id===tab)!.label+'">'+content+'</section><button data-action="close-city">Back to overland map</button></main>';
}

function renderCityWarWarnings(state:GameState):string{
 const warnings=Object.entries(state.cityPolitics?.rivals??{}).filter(([,r])=>r.warning).map(([origin,r])=>'<li>'+esc(nodeName(state,origin))+' is mustering against '+esc(nodeName(state,r.warning!.target))+'. Marches '+(r.warning!.launchTurn<=state.turn?'now':'next month')+'.</li>');
 const parties=state.armies.filter(a=>a.cityRaid && !a.cityRaid.returning).map(a=>'<li>'+esc(nodeName(state,a.cityRaid!.origin))+' has a war party marching on '+esc(nodeName(state,a.cityRaid!.target))+'.</li>');
 return warnings.length+parties.length?'<section class="city-war-warning" role="status"><h3>Rival city threats</h3><ul>'+warnings.join('')+parties.join('')+'</ul><p>Reinforce the threatened city. Allies, vassals and truces do not send war parties.</p></section>':'';
}

function renderScoutContacts(state:GameState, destination?:string):string {
 const contacts=(state.scoutContacts??[]).filter(c=>!destination || c.destination===destination).slice(-5).reverse();
 if(!contacts.length)return '';
 return '<section class="scout-intel"><h3>Scout intelligence</h3><ul>'+contacts.map(c=>{
   const status=scoutContactStatus(state,c);
   const detail=status==='watch-ended'?'Watch ended — previous estimate withdrawn':status==='lost'?'Contact lost — previous estimate withdrawn':c.arrivalTurn===null?'Movement halted — arrival unknown':'Estimated arrival: month '+c.arrivalTurn;
   return '<li><b>'+esc(nodeName(state,c.destination))+'</b>: '+detail+'<small class="sub">Scout #'+c.scoutId+' · last observed month '+c.seenTurn+'</small></li>';
 }).join('')+'</ul></section>';
}

/** Clicking a town where your troops stand: move troops (and choose which), or open the city screen. */
function renderTownChoice(state: GameState, ui: UIState, choice: NonNullable<UIState['townChoice']>): string {
  const name = esc(nodeName(state, choice.at));
  const army = armyAt(state, choice.at, 'player');
  if (choice.step === 'choose' || !army) {
    return `<div class="assault-shade"><section class="assault-prompt town-choice" role="dialog" aria-modal="true" aria-labelledby="town-choice-title">
      <h2 id="town-choice-title">${name}</h2>
      <p>Your troops are here. What would you like to do?</p>
      <div class="assault-actions stacked">
        <button data-action="town-choice-move" class="primary">Select and move troops</button>
        <button data-action="town-choice-city">Open city screen</button>
        <button data-action="town-choice-close" class="ghost">Cancel</button>
      </div></section></div>`;
  }
  const ready = army.troops.filter((t) => t.mp > 0 && !t.refit);
  const rows = army.troops.map((t) => {
    const type = UNIT_TYPES[t.type];
    const can = t.mp > 0 && !t.refit;
    const why = t.refit ? 'refitting' : t.mp <= 0 ? 'no movement left this month' : `${t.mp} movement`;
    return `<li><label><input type="checkbox" data-change="check" data-troop="${t.id}" ${ui.checked.has(t.id) ? 'checked' : ''} ${can ? '' : 'disabled'}/>
      ${esc(t.name ?? type.name)} <small>${type.hero ? `${t.men} HP` : `${t.men} men`} · ${why}</small></label></li>`;
  }).join('');
  return `<div class="assault-shade"><section class="assault-prompt town-choice" role="dialog" aria-modal="true" aria-labelledby="town-choice-title">
    <h2 id="town-choice-title">Move troops from ${name}</h2>
    <p class="sub">Tick the troops to send. The slowest sets the pace. Then click a lit hex on the map.</p>
    <div class="assault-actions">
      <button data-action="troops-all" ${ready.length ? '' : 'disabled'}>Select all</button>
      <button data-action="troops-none">Deselect all</button>
    </div>
    <ul class="troop-toggles">${rows}</ul>
    <div class="assault-actions">
      <button data-action="town-choice-close" class="primary" ${ui.checked.size ? '' : 'disabled'}>Choose destination</button>
      <button data-action="town-choice-cancel" class="ghost">Cancel</button>
    </div></section></div>`;
}

/** A siege you are laying: walls, supplies, morale and blockade, next month's toll, and what you can do now. */
function renderSiege(state: GameState, townId: string): string {
  const siege = siegeOf(state, townId);
  if (!siege) return '';
  const name = esc(nodeName(state, townId));
  const army = state.armies.find((a) => a.id === siege.army);
  const ready = army?.troops.filter((t) => t.mp > 0 && !t.refit) ?? [];
  const next = siegeOutlook(state, siege);
  const policy = surrenderPolicy(state, townId);
  const terms = siege.offer
    ? `<p class="msg">${name} offers to become your vassal: it would grant your armies passage and keep its own garrison.</p>
      <div class="save-actions"><button data-action="siege-accept" data-town="${townId}" class="primary">Accept vassal terms</button>
      <button data-action="siege-refuse" data-town="${townId}">Refuse and keep the siege</button></div>` : '';
  return `<section class="siege-panel"><h3>Under your siege since ${esc(dateLabel(siege.startedTurn))}</h3>
    <dl class="siege-stats">
      <div><dt>Walls</dt><dd>${siege.walls}%${siege.walls < BREACH ? ' · breached' : ''}</dd></div>
      <div><dt>Supplies</dt><dd>${siege.supplies ? `${siege.supplies} months` : 'none · starving'}</dd></div>
      <div><dt>Morale</dt><dd>${siege.morale}</dd></div>
      <div><dt>Blockade</dt><dd>${Math.round(next.blockade * 100)}%</dd></div>
    </dl>
    <p class="sub">Next month: walls −${next.walls}, supplies −${next.supplies}${next.starving ? ', and the garrison starts to starve' : ''}. ${next.engineers ? '' : 'Without engineers the walls barely fall: bring engineers to batter them down.'} ${siege.walls < BREACH ? 'The walls are breached: an assault no longer faces them.' : `Below ${BREACH}% walls, an assault no longer faces them.`} ${esc(policy.why)}</p>
    ${terms}
    <div class="save-actions">
      <button data-action="siege-storm" data-town="${townId}" ${ready.length ? '' : 'disabled'} title="${ready.length ? 'Attack the town with the besieging army' : 'Your army can storm once it has movement again (next month)'}">Storm ${name}</button>
      <button data-action="siege-lift" data-town="${townId}" class="ghost">Lift the siege</button>
    </div></section>`;
}

/** On the besieging army's panel: what it is doing, and that marching away ends the siege. */
function renderBesieging(state: GameState, army: Army): string {
  const siege = state.sieges.find((s) => s.army === army.id);
  if (!siege) return '';
  return `<p class="msg siege-note">Besieging ${esc(nodeName(state, siege.town))}. Marching this army away lifts the siege. Open the town to storm, hold or lift it.</p>`;
}

/** A spy's Infiltrate button, or what it is doing inside a town. */
function renderInfiltrate(state: GameState, army: Army, spy: Troop): string {
  if (spy.infiltrating) return `<br><b>Inside ${esc(nodeName(state, spy.infiltrating))}</b>, reporting each month. Each month there is a small chance it is caught (less as it gains levels); march it out to leave.`;
  const q = infiltrateQuote(state, army.id);
  if (!q.town) return '';
  return `<br><button data-action="infiltrate" data-army="${army.id}" ${q.reason ? `disabled title="${esc(q.reason)}"` : ''}>Infiltrate ${esc(nodeName(state, q.town))}</button>${q.reason ? ` <small>${esc(q.reason)}</small>` : ''}`;
}

/** What your spies last learned inside this town. */
function renderIntel(state: GameState, townId: string): string {
  const intel = state.intel?.[townId];
  if (!intel) return '';
  return `<section class="intel-report"><h3>Spy report · ${esc(dateLabel(intel.turn))}</h3><ul>${intel.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`;
}

/**
 * The action bar above the map: what you can do with the selected place, in one row at the top (the side panel
 * keeps the detail). Each button is the same action as its counterpart in the panels.
 */
function renderActionBar(state: GameState, ui: UIState): string {
  const at = ui.selected;
  if (!at || state.status !== 'playing') return '';
  const army = armyAt(state, at, 'player');
  const town = townAt(state, at);
  const name = esc(nodeName(state, at));
  const actions: string[] = [];
  if (army) {
    const ready = army.troops.filter((t) => t.mp > 0 && !t.refit).length;
    actions.push(`<button data-action="troops-pick" class="primary" ${ready ? '' : 'disabled title="No troops here can march again this month"'}>Move troops…</button>`);
    if (army.troops.length > 1 && ui.checked.size < ready) actions.push('<button data-action="troops-all">Select all</button>');
    if (ui.checked.size) actions.push('<button data-action="troops-none">Deselect all</button>');
    if (!campQuote(state, army.id).reason) actions.push(`<button data-action="make-camp" data-army="${army.id}">Set up camp</button>`);
    const scout = army.troops.find((t) => t.type === 'scout' && !t.scoutPost);
    if (scout) actions.push(`<button data-action="${army.troops.length > 1 ? 'station-scout' : 'scout-post'}" data-troop="${scout.id}" data-post="watch">${army.troops.length > 1 ? 'Station scout here' : 'Keep watch here'}</button>`);
    const spy = infiltrateQuote(state, army.id);
    if (spy.town && !spy.reason) actions.push(`<button data-action="infiltrate" data-army="${army.id}">Infiltrate ${esc(nodeName(state, spy.town))}</button>`);
    const besiege = Object.values(state.towns).find((t) => !siegeQuote(state, at, townLocation(state, t.id)).reason);
    if (besiege) actions.push(`<button data-action="siege-begin" data-from="${esc(at)}" data-to="${esc(townLocation(state, besiege.id))}">Besiege ${esc(nodeName(state, besiege.id))}</button>`);
    const siege = state.sieges.find((g) => g.army === army.id);
    if (siege) actions.push(`<button data-action="siege-lift" data-town="${siege.town}">Lift the siege of ${esc(nodeName(state, siege.town))}</button>`);
  }
  if (town && explored(state, at)) actions.push(`<button data-action="open-city" data-node="${esc(at)}">Open ${name}</button>`);
  if (!actions.length) return '';
  return `<div class="action-bar" role="toolbar" aria-label="Actions for ${name}"><b>${name}</b>${actions.join('')}</div>`;
}

/** A small acknowledgement popup, closed with OK. */
function renderNotice(notice: NonNullable<UIState['notice']>): string {
  return `<div class="assault-shade"><section class="assault-prompt notice-popup" role="dialog" aria-modal="true" aria-labelledby="notice-title">
    <h2 id="notice-title">${esc(notice.title)}</h2>${notice.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    <div class="assault-actions"><button data-action="notice-close" class="primary">OK</button></div></section></div>`;
}

/** Open quests, main objectives first, then the ones running out soonest. */
function openQuests(state: GameState): QuestDefinition[] {
  const left = (id: string) => monthsLeft(state, id) ?? Infinity;
  return campaignQuests(state).filter((d) => isOpen(state.quests[d.id]))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1) || left(a.id) - left(b.id));
}

/** How long a quest has before it ends on its own, as a small badge. */
function dueBadge(state: GameState, questId: string): string {
  const left = monthsLeft(state, questId);
  if (left === null) return '';
  const text = left <= 0 ? 'ends this month' : left === 1 ? 'ends next month' : `ends in ${left} months`;
  return ` <span class="due-badge${left <= 1 ? ' urgent' : ''}" title="If nothing is done, this quest ends on its own ${text.replace('ends ', '')}.">${text}</span>`;
}

/** The quests screen: every open quest in full, with where it is and how long it has. */
function renderQuestScreen(state: GameState, ui: UIState): string {
  const quests = openQuests(state);
  return `<main class="quest-screen"><header class="city-heading"><div><p class="report-eyebrow">Quests</p><h1>Open quests</h1></div><button class="primary" data-action="quests">Back to the map</button></header>
    ${ui.message ? `<p class="msg" role="status">${esc(ui.message)}</p>` : ''}
    <p class="sub">Main objectives first, then whatever runs out soonest. "Show on map" takes you to a quest's place once you have explored it.</p>
    ${quests.map((d) => `${renderQuests(state, [d])}<p class="quest-goto">${explored(state, questFocus(state, d.id) ?? '') ? `<button class="link" data-action="view-quest" data-quest="${d.id}">Show on map</button>` : `<small>Its place is still unexplored.</small>`}</p>`).join('') || '<p>No open quests right now.</p>'}
  </main>`;
}

/** A town's quests in one line, with how long they have, and a button to the Quests screen. */
function questPointer(state: GameState, townId: string): string {
  const offered = questsAt(state, townId).filter((d) => isOpen(state.quests[d.id]));
  if (!offered.length) return '';
  return `<p class="quest-pointer">${offered.length} quest${offered.length === 1 ? '' : 's'} offered here: ${offered.map((d) => `${esc(d.name)}${dueBadge(state, d.id)}`).join(', ')}. <button data-action="quests" data-quest="${offered[0].id}">Open quests</button></p>`;
}
