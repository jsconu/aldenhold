import {
  armyAt, canRecruitAt, dateLabel, monthlyIncome, monthlyUpkeep, neighborsOf, nodeName, townGrowth, townIncome,
} from '../game/campaign';
import { SPELLS, UNIT_TYPES } from '../game/data';
import { heroLevel, heroMaxHp, heroMaxMana, level } from '../game/units';
import { EQUIPMENT, refitQuote, equipmentUpkeep } from '../game/equipment';
import type { Army, FactionId, GameState } from '../game/types';
import { renderJournal } from './journalView';
import { renderTreasury } from './treasuryView';
import { BUILDING_IDS, BUILDINGS, cityMaintenance, constructionQuote, developmentSites, endowment, totalCityMaintenance } from '../game/cities';
import { FENWICK_CHARTER } from '../content/quests';
import { questSummary } from '../game/quests';
import { esc, type UIState } from './shared';
import { renderOverland } from './overlandMap';
import { previewRoute, type RoutePreview } from '../game/overlandRoutes';

const OWNER_LABEL: Record<FactionId, string> = { player: 'Yours', orcs: 'Orcs', neutral: 'Free town' };

export function moveTargets(state: GameState, ui: UIState): string[] {
  if (!ui.selected) return [];
  const army = armyAt(state, ui.selected, 'player');
  const ready = army?.troops.some((t) => ui.checked.has(t.id) && !t.moved);
  return ready ? neighborsOf(state, ui.selected) : [];
}

export function renderCampaign(state: GameState, ui: UIState): string {
  const income = monthlyIncome(state);
  const upkeep = monthlyUpkeep(state);
  const operating = totalCityMaintenance(state);
  const net = income - upkeep - operating;
  return `
  <header class="bar">
    <h1>Aragon <small>working title</small></h1>
    <span class="date">${dateLabel(state.turn)}</span>
    <span class="gold" title="Taxes ${income}, troop wages ${upkeep}, city maintenance ${operating}">Gold <b>${state.gold}</b>
      <em class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${net}/month</em></span>
    <span class="spacer"></span>
    ${state.quests.Q00?.status === 'available' ? '<button data-action="view-fenwick" class="ghost">Fenwick envoy</button>' : ''}
    <button data-action="treasury" class="ghost">${ui.view === 'treasury' ? 'Back to the map' : 'Treasury'}</button>
    <button data-action="journal" class="ghost">${ui.view === 'journal' ? 'Back to the map' : `Journal (${state.journal.length})`}</button>
    <button data-action="new-game" class="ghost">New game</button>
    <button data-action="end-turn" class="primary" ${state.status !== 'playing' ? 'disabled' : ''}>End month</button>
  </header>
  ${state.status !== 'playing' ? `<div class="banner ${state.status}">${state.status === 'won' ? 'You have won. The valley is united.' : state.endingReason === 'lord-dead' ? 'You have lost. Your lord is dead.' : 'You have lost. Aldenhold has fallen.'} <button data-action="new-game">Play again</button></div>` : ''}
  ${ui.view === 'treasury' ? renderTreasury(state) : ui.view === 'journal' ? renderJournal(state) : `<main class="campaign">
    <section class="map-wrap">
      ${renderMapToolbar(state, ui)}
      ${renderOverland(state, ui, moveTargets(state, ui), plannedRoute(state, ui)?.stops.map((s) => s.id) ?? [])}
      <div class="atlas-legend" aria-label="Map legend">
        <span><i class="swatch swatch-forest"></i> Forest</span>
        <span><i class="swatch swatch-hills"></i> Hills</span>
        <span><i class="swatch swatch-water"></i> River</span>
        <span><i class="swatch swatch-marsh"></i> Wetland</span>
        <span><i class="swatch swatch-road"></i> Travel road</span>
      </div>
      <p class="atlas-caption">The illustrated hex terrain shows the province. For now, armies march only between named places linked by a road. Hex-by-hex travel is planned for the larger campaign.</p>
    </section>
    <aside class="side">
      ${ui.message ? `<p class="msg">${esc(ui.message)}</p>` : ''}
      ${renderOfferNotice(state, ui)}
      ${renderRoutePlanner(state, ui)}
      ${ui.selected ? renderTravelGuide(state, ui) : ''}
      ${ui.selected ? renderNodePanel(state, ui, ui.selected) : '<p class="hint">Click a place on the map. Your troops show as blue shields.</p>'}
      <details class="log" open><summary>Chronicle</summary><ul>${state.log.slice(0, 14).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`}`;
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
    moveTargets(state, ui).includes(route.stops[1].id);
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
    const buttonText = ready.includes(id) ? 'March' : 'Inspect';
    return `<button data-action="node" data-node="${esc(id)}" class="travel-destination">
      <span>${esc(nodeName(state, id))}</span>
      <small>${owner ? OWNER_LABEL[owner] : 'Landmark'}${garrison ? ' · Garrison' : ''}</small>
      <b>${buttonText} →</b></button>`;
  }).join('');
  return `<details class="travel-guide" open>
    <summary>Roads from ${esc(nodeName(state, ui.selected))}</summary>
    <p class="hint">${ready.length ? 'Checked troops will march when you select a connected destination.' :
      'Check ready troops below to march, or inspect a neighboring place.'}</p>
    <div class="travel-options">${choices}</div></details>`;
}

function renderNodePanel(state: GameState, ui: UIState, id: string): string {
  const town = state.towns[id];
  const armies = state.armies.filter((a) => a.at === id);
  let html = `<h2>${esc(nodeName(state, id))}</h2>`;
  if (town) {
    html += `<p class="sub">${town.kind === 'lair' ? 'Orc stronghold' : town.kind === 'capital' ? 'Your capital' : 'Town'} · ${OWNER_LABEL[town.owner]}</p>`;
    if (town.kind !== 'lair') html += `<p>Population <b>${town.pop.toLocaleString()}</b></p>`;
    if (town.owner === 'player' && town.kind !== 'lair') {
      const growth = townGrowth(town);
      html += `<label class="tax">Tax rate
        <select data-change="tax" data-node="${id}">
          ${Array.from({ length: 11 }, (_, i) => i * 5).map((v) => `<option value="${v}" ${v === town.tax ? 'selected' : ''}>${v}%</option>`).join('')}
        </select></label>
        <p class="sub">Brings in ${townIncome(town)} gold a month. Population ${growth >= 0 ? 'grows' : 'shrinks'} by about ${Math.abs(growth)}.</p>
        <h3>Raise troops</h3><div class="recruit">${Object.values(UNIT_TYPES)
          .filter((t) => canRecruitAt(town, t.id))
          .map((t) => `<button data-action="recruit" data-node="${id}" data-type="${t.id}" ${state.gold < t.cost ? 'disabled' : ''}
              title="${t.men} men · attack ${t.attack} · defense ${t.defense} · move ${t.move}${t.range > 1 ? ` · range ${t.range}` : ''} · upkeep ${t.upkeep}/month">
              ${t.name} <span>${t.cost}g</span></button>`)
          .join('')}</div>`;
      if (town.kind !== 'capital') html += `<p class="sub">Knights can only be raised in Aldenhold.</p>`;
      html += renderCityDevelopment(state, id);
      html += renderOffers(state, id);
    }
  } else {
    html += `<p class="sub">Open country</p>`;
  }
  if (id === 'fenwick') html += renderFenwickQuest(state);
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

function renderFenwickQuest(state: GameState): string {
  const q = state.quests.Q00;
  if (!q) return '';
  if (q.status !== 'available') return `<div class="quest-card"><h3>${esc(FENWICK_CHARTER.name)}</h3><p>${esc(questSummary(state))}</p>
    ${q.status === 'succeeded' && state.treaties.fenwick?.passage ? '<p class="sub">Your armies may share this town with its neutral garrison. Fenwick remains independent and pays no tax.</p>' : ''}</div>`;
  const near = state.armies.some((a) => a.owner === 'player' &&
    (a.at === 'fenwick' || neighborsOf(state, 'fenwick').includes(a.at)));
  return `<div class="quest-card"><h3>${esc(FENWICK_CHARTER.name)}</h3>
    <p>${esc(FENWICK_CHARTER.text)}</p>
    <p class="sub">Reward: Sealed Fenwick Charter. Sign to gain peaceful passage, or decline and keep the military option.</p>
    ${!near ? '<p class="hint">Bring an army to Fenwick or an adjacent road to send an envoy.</p>' : ''}
    <div class="quest-actions">
      <button data-action="fenwick-sign" ${!near ? 'disabled' : ''}>Sign the charter</button>
      <button data-action="fenwick-decline" ${!near ? 'disabled' : ''}>Decline</button>
    </div></div>`;
}

function renderArmy(state: GameState, ui: UIState, a: Army): string {
  const mine = a.owner === 'player';
  const rows = a.troops
    .map((t) => {
      const type = UNIT_TYPES[t.type];
      const box = mine
        ? `<input type="checkbox" data-change="check" data-troop="${t.id}" ${ui.checked.has(t.id) ? 'checked' : ''} ${t.moved ? 'disabled' : ''}/>`
        : '';
      const marched = t.moved && mine ? '<span class="tag">marched</span>' : '';
      if (type.hero) {
        const mana = type.hero.mana ? ` · ${t.mana ?? 0}/${heroMaxMana(t.type, t.xp)} mana` : '';
        return `<li class="hero ${t.moved && mine ? 'done' : ''}"><label>${box}<span class="tname">★ ${esc(t.name ?? type.name)}
          <small>${type.name}</small></span><span class="men">${t.men}/${heroMaxHp(t.type, t.xp)} HP${mana}</span>
          <span class="lv">Lv ${heroLevel(t.xp)}</span>${marched}</label></li>`;
      }
      const lv = level(t.xp);
      return `<li class="${t.moved && mine ? 'done' : ''}"><label>${box}<span class="tname">${type.name}</span>
        <span class="men">${t.men} men</span><span class="lv">Lv ${lv}</span>
        <small class="gear-label">${t.gear.bow ? EQUIPMENT[t.gear.bow].name + ' · ' : ''}${EQUIPMENT[t.gear.armor].name}</small>
        ${t.refit ? '<span class="tag">refitting</span>' : ''}${marched}</label></li>`;
    })
    .join('');
  const ready = mine && a.troops.some((t) => !t.moved);
  return `<div class="army-card own-${a.owner}"><h3>${mine ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : 'Town militia'}</h3>
    <ul class="troops">${rows}</ul>
    ${mine && state.towns[a.at]?.owner === 'player' ? renderRefitChoices(state, a) : ''}
    ${ready ? `<p class="hint">Tick the troops to send, then click a glowing place on the map.</p>` : ''}</div>`;
}

function renderRefitChoices(state: GameState, army: Army): string {
  const choices = army.troops.filter((t) => !UNIT_TYPES[t.type].hero && ['archers', 'militia', 'spearmen', 'knights'].includes(t.type));
  if (!choices.length) return '';
  return `<details class="refit-panel"><summary>Equip veteran formations</summary>
    <p class="sub">Upgrades require experience, a friendly city, enough gold and local materials. Refitting takes the rest of this month; the previous equipment remains in use until completion.</p>
    ${choices.map((troop) => {
      const options = troop.type === 'archers' ? ['long-bow', 'compound-bow', 'chain'] as const : ['chain', 'plate'] as const;
      return `<div class="refit-row"><b>${UNIT_TYPES[troop.type].name} #${troop.id}</b>
        <small>Lv ${level(troop.xp)} · upkeep +${equipmentUpkeep(troop)}g/month for gear</small>
        ${options.map((id) => {
          const quote = refitQuote(state, army.at, troop.id, id);
          const gear = EQUIPMENT[id];
          const inputs = Object.entries(quote.materials).map(([g, qty]) => `${qty} ${g}`).join(' + ');
          return `<div class="refit-option"><button data-action="refit" data-node="${army.at}"
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
        <button data-action="hire" data-offer="${i}" ${state.gold < t.cost ? 'disabled' : ''}>Hire for ${t.cost}g</button></div>`;
    })
    .join('')}`;
}

function renderOfferNotice(state: GameState, ui: UIState): string {
  const elsewhere = state.offers.filter((o) => o.town !== ui.selected);
  if (!elsewhere.length) return '';
  return `<p class="notice">${elsewhere
    .map((o) => `<button class="link" data-action="goto" data-node="${o.town}">${esc(o.name)} waits in ${esc(nodeName(state, o.town))}</button>`)
    .join(' · ')}</p>`;
}
