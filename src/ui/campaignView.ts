import { SPECIES, type LairDefinition } from '../content/lairs';
import { lairAt, lairGarrison } from '../game/lairs';
import { CATALOG } from '../content';
import {
  armyAt, arrivalEstimates, campaignOf, canRecruitAt, dateLabel, hireQuote, monthlyIncome, monthlyUpkeep, neighborsOf, nodeName, playerMarchOptions,
  recruitQuote, startLocation, townGrowth, townIncome,
} from '../game/campaign';
import { hasRoad, hexLand, marchRate, placeAt, townAt, townLocation, worldOf, type MarchStep } from '../game/world';
import { BANNER_LABEL, bannerSvg, renderHexMap, type BannerKind } from './hexMapView';
import { SPELLS, UNIT_TYPES } from '../game/data';
import { heroLevel, heroMaxHp, heroMaxMana, level } from '../game/units';
import { EQUIPMENT, refitQuote, equipmentUpkeep, usesBow } from '../game/equipment';
import { RELATION_LABEL, relationWith } from '../game/diplomacy';
import { FACTIONS } from '../content/factions';
import type { Army, CampaignId, FactionId, GameState, QuestDefinition, Stance, Town, Troop } from '../game/types';
import { planDeployment } from '../game/battle';
import { STANCES } from '../game/tactics';
import { HERO_SLOTS, unequipQuote } from '../game/items';
import { buyQuote, merchantsAt, merchantStatus } from '../game/merchants';
import { ITEMS } from '../content/items';
import { renderJournal } from './journalView';
import { renderTreasury } from './treasuryView';
import { questFocus, questSites } from './questNavigation';
import { BUILDING_IDS, BUILDINGS, cityMaintenance, constructionQuote, developmentSites, endowment, totalCityMaintenance } from '../game/cities';
import { conditionHolds, conditionText, isOpen, questQuote, questsAt, questsAtSite, questSummary, stageOf, trackedQuests, type EncounterPreview } from '../game/quests';
import { esc, type UIState } from './shared';
import { renderOverland } from './overlandMap';
import { previewRoute, type RoutePreview } from '../game/overlandRoutes';

const OWNER_LABEL = (owner: FactionId) => FACTIONS[owner].ownerLabel;

/** Where the ticked troops at the selected location can march this month, with the cheapest route to each. */
export function moveTargets(state: GameState, ui: UIState): Map<string, MarchStep> {
  if (!ui.selected || !armyAt(state, ui.selected, 'player')) return new Map();
  return playerMarchOptions(state, ui.selected, [...ui.checked]);
}

const isHexCampaign = (state: GameState) => worldOf(state).kind === 'hex';

export function renderCampaign(state: GameState, ui: UIState): string {
  const income = monthlyIncome(state);
  const upkeep = monthlyUpkeep(state);
  const operating = totalCityMaintenance(state);
  const net = income - upkeep - operating;
  return `
  <header class="bar">
    <h1>Aragon <small>${esc(campaignOf(state).name)}</small></h1>
    <span class="date">${dateLabel(state.turn)}</span>
    <span class="gold" title="Taxes ${income}, troop wages ${upkeep}, city maintenance ${operating}">Gold <b>${state.gold}</b>
      <em class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${net}/month</em></span>
    <span class="spacer"></span>
    ${trackedQuests(state).map((q) => `<button data-action="view-quest" data-quest="${q.id}" class="ghost" title="Show ${esc(nodeName(state, questFocus(state, q.id)!))} on the map">${q.kind === 'main' ? 'Objective' : 'Quest'}: ${esc(q.name)}</button>`).join('')}
    <button data-action="treasury" class="ghost">${ui.view === 'treasury' ? 'Back to the map' : 'Treasury'}</button>
    <button data-action="journal" class="ghost">${ui.view === 'journal' ? 'Back to the map' : `Journal (${state.journal.length})`}</button>
    <button data-action="new-game" class="ghost">New game</button>
    <button data-action="end-turn" class="primary" ${state.status !== 'playing' ? 'disabled' : ''}>End month</button>
  </header>
  ${ui.choosing ? renderChooser(state) : ''}
  ${state.status !== 'playing' ? `<div class="banner ${state.status}">${state.status === 'won' && state.endingReason === 'chapter-complete' ? `${esc(campaignOf(state).chapter!.title)} is complete. ${esc(campaignOf(state).chapter!.ending)}` : state.status === 'won' ? `You have won. ${isHexCampaign(state) ? 'The realm' : 'The valley'} is united.` : state.endingReason === 'lord-dead' ? 'You have lost. Your lord is dead.' : `You have lost. ${esc(nodeName(state, campaignOf(state).capital))} has fallen.`} <button data-action="new-game">Play again</button></div>` : ''}
  ${ui.view === 'treasury' ? renderTreasury(state) : ui.view === 'journal' ? renderJournal(state) : `<main class="campaign">
    ${isHexCampaign(state) ? renderHexSection(state, ui) : `<section class="map-wrap">
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
      ${renderOfferNotice(state, ui)}
      ${isHexCampaign(state) ? renderMarchGuide(state, ui) : ''}
      ${isHexCampaign(state) ? '' : renderRoutePlanner(state, ui)}
      ${ui.selected && !isHexCampaign(state) ? renderTravelGuide(state, ui) : ''}
      ${ui.selected ? renderNodePanel(state, ui, ui.selected) : '<p class="hint">Click a place on the map. Your troops show as blue shields.</p>'}
      <details class="log" open><summary>Chronicle</summary><ul>${state.log.slice(0, 14).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`}`;
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
        title="${ready ? 'March checked formations along the first road' : 'Select ready troops at the departure location'}">
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
  const town = townAt(state, at);
  const id = town?.id ?? at;
  const armies = state.armies.filter((a) => a.at === at);
  let html = `<h2>${esc(nodeName(state, at))}</h2>`;
  const world = worldOf(state);
  if (town) {
    const profile = campaignOf(state).settlementProfiles?.[id];
    if (profile) html += `<p class="sub"><b>${esc(profile.region)}</b> · ${esc(profile.role)}</p>`;
    html += `<p class="sub">${town.kind === 'lair' ? 'Orc stronghold' : town.kind === 'capital' ? 'Your capital' : 'Town'} · ${OWNER_LABEL(town.owner)}${(() => {
      const relation = relationWith(state, id);
      return relation && relation !== 'self' && town.kind !== 'lair' ? ` · ${RELATION_LABEL[relation]}` : '';
    })()}</p>`;
    if (town.kind !== 'lair') html += `<p>Population <b>${town.pop.toLocaleString()}</b></p>`;
    if (town.owner === 'player' && town.kind !== 'lair') {
      const growth = townGrowth(town);
      html += `<label class="tax">Tax rate
        <select data-change="tax" data-node="${id}">
          ${Array.from({ length: 11 }, (_, i) => i * 5).map((v) => `<option value="${v}" ${v === town.tax ? 'selected' : ''}>${v}%</option>`).join('')}
        </select></label>
        <p class="sub">Brings in ${townIncome(town)} gold a month. Population ${growth >= 0 ? 'grows' : 'shrinks'} by about ${Math.abs(growth)}.</p>
        ${renderRecruit(state, town)}`;
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
  if (town) html += renderQuests(state, questsAt(state, town.id));
  if (site) html += renderQuests(state, questsAtSite(state, site));
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
    const head = `<div class="quest-card"><h3>${esc(def.name)} <small>${def.kind === 'main' ? 'Main objective' : 'Side quest'} · ${esc(def.giver)}</small></h3>`;
    if (!isOpen(q)) {
      const passage = q.status === 'succeeded' && state.treaties[def.at]?.passage
        ? `<p class="sub">Your armies may share this town with its neutral garrison. ${esc(nodeName(state, def.at))} remains independent and pays no tax.</p>` : '';
      return `${head}<p>${esc(questSummary(state, def.id))}.</p>${passage}</div>`;
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
    const siteLinks = destinations.length ? `<p class="quest-sites">Encounter site${destinations.length > 1 ? 's' : ''}: ${destinations.map((site) => `<button class="link" data-action="goto" data-node="${startLocation(state, site)}">Show ${esc(nodeName(state, site))}</button>`).join(' · ')}</p>` : '';
    const goals = stage.objectives?.length ? `<ul class="objectives">${stage.objectives.map((o) => {
      const met = o.when.every((c) => conditionHolds(state, c));
      return `<li class="${met ? 'met' : ''}">${met ? '✓' : '○'} ${o.when.map((c) => esc(conditionText(state, c))).join('; ')}</li>`;
    }).join('')}</ul><p class="sub">Goals are checked at the end of each month.</p>` : '';
    return `${head}<p>${esc(def.summary)}</p><p class="sub">${esc(stage.text)}</p>${siteLinks}${goals}${deadline}
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
    <p>${preview.heroesOnly ? 'Only hired heroes enter; your lord and formations stay outside.' : 'The whole army at this site joins the expedition.'}</p>
    <p><b>Deployed:</b> ${preview.deployed.length ? names(preview.deployed) : 'No eligible troops at this site.'}</p>
    ${preview.reserves.length ? `<p><b>Off-field reserves:</b> ${names(preview.reserves)}. They stay off the field and earn no combat experience.</p>` : ''}
    ${preview.waiting.length ? `<p><b>Waiting outside:</b> ${names(preview.waiting)}</p>` : ''}
  </details>`;
}

/** A found lair: its people, how they fight and how to counter them, its garrison and plunder, or that it's cleared. */
function renderLair(state: GameState, lair: LairDefinition): string {
  const st = state.lairs[lair.id];
  const sp = SPECIES[lair.species];
  const garrison = lairGarrison(state, lair);
  return `<div class="quest-card lair"><h3>${esc(lair.name)} <small>${sp.name} · tier ${lair.tier}</small></h3>
    ${st.status === 'cleared'
      ? `<p>Cleared${st.clearedTurn ? ` in ${esc(dateLabel(st.clearedTurn))}` : ''}. Nothing stirs here now.</p>`
      : `<p class="sub">${esc(sp.tactics)}</p><p class="sub">Counter: ${esc(sp.counter)}</p>
        <p>${garrison ? `Garrison: ${garrison.troops.length} formations (${esc(garrison.troops.map((t) => UNIT_TYPES[t.type].name).join(', '))}).` : ''}
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

/**
 * The army's battle plan: stance buttons, and the 3x9 deployment zone showing where each formation will start
 * (front column toward the enemy). Click a formation, then a cell, to move it there (the plan becomes Custom).
 */
function renderTactics(ui: UIState, a: Army): string {
  const stance = a.tactics?.stance ?? 'offensive';
  const plan = planDeployment(a);
  const at = new Map([...plan].map(([id, c]) => [`${c.depth},${c.row}`, a.troops.find((t) => t.id === id)!]));
  const picked = a.troops.some((t) => t.id === ui.tacticsTroop) ? ui.tacticsTroop : null;
  const label = (t: Troop) => esc(t.name ?? UNIT_TYPES[t.type].short);
  const rows = Array.from({ length: 9 }, (_, row) => `<tr>${[2, 1, 0].map((depth) => {
    const t = at.get(`${depth},${row}`);
    const cls = [t ? 'filled' : '', t && t.id === picked ? 'picked' : '', t && UNIT_TYPES[t.type].hero ? 'hero' : ''].filter(Boolean).join(' ');
    return `<td><button class="cell ${cls}" data-action="tactics-cell" data-army="${a.id}" data-depth="${depth}" data-row="${row}"
      title="${t ? esc(`${t.name ?? UNIT_TYPES[t.type].name}: click, then click another cell to move it`) : picked ? 'Move the picked formation here' : 'Empty'}">${t ? label(t) : ''}</button></td>`;
  }).join('')}</tr>`).join('');
  const reserves = a.troops.filter((t) => !plan.has(t.id));
  return `<details class="tactics" ${ui.tacticsTroop && picked ? 'open' : ''}><summary>Battle plan: ${STANCES[stance].name}</summary>
    <div class="stances">${(Object.keys(STANCES) as Stance[]).map((s) => `<button data-action="set-stance" data-army="${a.id}" data-stance="${s}"
      class="${s === stance ? 'primary' : 'ghost'}" title="${esc(STANCES[s].text)}">${STANCES[s].name}</button>`).join('')}</div>
    <p class="sub">${esc(STANCES[stance].text)}</p>
    <table class="deploy-grid"><thead><tr><th>Back</th><th>Middle</th><th>Front</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="sub">${picked ? 'Now click the cell to move it to.' : 'Click a formation, then a cell, to place it yourself (the plan becomes Custom).'} The front column faces the enemy.</p>
    ${reserves.length ? `<p class="sub">Won’t fit on the field: ${reserves.map((t) => label(t)).join(', ')}.</p>` : ''}
  </details>`;
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
          <small>${type.name}</small></span><span class="men">${t.men}/${heroMaxHp(t.type, t.xp)} HP${mana}</span>
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
  return `<div class="army-card own-${a.owner}"><h3>${mine ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : 'Town militia'}</h3>
    <ul class="troops">${rows}</ul>
    ${mine && townAt(state, a.at)?.owner === 'player' ? renderRefitChoices(state, a) : ''}
    ${mine ? renderTactics(ui, a) : ''}
    ${ready ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

function renderRefitChoices(state: GameState, army: Army): string {
  // Formations the player can raise (orc troops captured in some future rule would not qualify).
  const choices = army.troops.filter((t) => !UNIT_TYPES[t.type].hero && UNIT_TYPES[t.type].recruit !== null);
  if (!choices.length) return '';
  return `<details class="refit-panel"><summary>Equip veteran formations</summary>
    <p class="sub">Upgrades require experience, a friendly city, enough gold and local materials. Refitting takes the rest of this month; the previous equipment remains in use until completion.</p>
    ${choices.map((troop) => {
      const options = usesBow(troop.type) ? ['long-bow', 'compound-bow', 'chain'] as const : ['chain', 'plate'] as const;
      return `<div class="refit-row"><b>${UNIT_TYPES[troop.type].name} #${troop.id}</b>
        <small>Lv ${level(troop.xp)} · upkeep +${equipmentUpkeep(troop)}g/month for gear</small>
        ${options.map((id) => {
          const townId = townAt(state, army.at)!.id;
          const quote = refitQuote(state, townId, troop.id, id);
          const gear = EQUIPMENT[id];
          const inputs = Object.entries(quote.materials).map(([g, qty]) => `${qty} ${g}`).join(' + ');
          return `<div class="refit-option"><button data-action="refit" data-node="${townId}"
            data-troop="${troop.id}" data-item="${id}" ${quote.reason ? 'disabled' : ''}
            title="${esc(quote.reason ?? 'Pay now; equipment arrives at month end')}">
            ${gear.name} · ${quote.gold}g${inputs ? ' + ' + inputs : ''}</button>
            <small>Lv ${gear.level}+ · ${gear.slot === 'bow' ? `Damage ×${gear.attackFactor}, range +${gear.rangeBonus}` :
              `Defense +${gear.defenseBonus}`} · upkeep ${gear.upkeep}g/mo
              ${quote.reason ? ' · ' + esc(quote.reason) : ''}</small></div>`;
        }).join('')}</div>`;
    }).join('')}
  </details>`;
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
  return `<section class="map-wrap">
    ${renderHexMap(state, ui, world, moveTargets(state, ui), ui.selected ? arrivalEstimates(state, ui.selected, [...ui.checked]) : new Map())}
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
