import { armySupport, cityArmySupport } from '../game/armySupport';
import { nodeName, townGrowth } from '../game/campaign';
import { BUILDINGS, constructionQuote, endowment } from '../game/cities';
import { townUnrest, unrestOutlook } from '../game/readiness';
import type { BuildingId, GameState, Town } from '../game/types';
import { townLocation } from '../game/world';
import { esc } from './shared';

export function cityGrowthAdvice(state: GameState, town: Town) {
  const city = state.cityEconomies[town.id];
  const advice: { text: string; tab: 'overview' | 'development' | 'army' }[] = [];
  if (town.tax >= 25) advice.push({ text: 'Lower taxes below 25% to encourage population growth.', tab: 'overview' });
  const foodRisk = (city.lastMonth?.unmetFood ?? 0) > 0 || city.goods.food < 2 * Math.ceil(town.pop / 100);
  if (city.project) advice.push({ text: `${BUILDINGS[city.project.kind].name} level ${city.project.targetLevel} completes after this month’s production (+10 army support).`, tab: 'development' });
  else {
    const kind: BuildingId = foodRisk ? 'farm' : !city.buildings.lumber ? 'lumber' : !city.buildings.mine && endowment(town.id).ore > 0 ? 'mine' : 'farm';
    const q = constructionQuote(state, town.id, kind);
    const staffing = Math.floor(town.pop * .45) - Object.entries(city.buildings).reduce((n, [id, level]) => n + BUILDINGS[id as BuildingId].workers * level, 0);
    if (foodRisk || staffing >= BUILDINGS[kind].workers) advice.push({
      text: `${foodRisk ? 'Secure food for growth: expand' : 'Use spare workers: expand'} ${BUILDINGS[kind].name.toLowerCase()}. ${q.reason ?? 'Construction is available; each completed level adds 10 army support.'}`, tab: 'development',
    });
    else advice.push({ text: 'Industry is using most available workers. Grow the population before expanding production.', tab: 'overview' });
  }
  const unrest = unrestOutlook(state, town);
  if (unrest.reasons.includes('no garrison')) advice.push({ text: 'Station a fighting unit here to reduce unrest and protect growth.', tab: 'army' });
  else if (townUnrest(town) > 0) advice.push({ text: `Unrest is ${townUnrest(town)}/100. Keep food supplied and taxes low${unrest.change < 0 ? '; unrest is currently falling' : ''}.`, tab: 'overview' });
  return advice.slice(0, 3);
}

export function renderCitySummary(state: GameState): string {
  const towns = Object.values(state.towns).filter(t => t.owner === 'player' && t.kind !== 'lair')
    .sort((a, b) => nodeName(state, a.id).localeCompare(nodeName(state, b.id)));
  const support = armySupport(state);
  return `<main class="city-summary"><div class="summary-heading"><div><p class="eyebrow">Your realm</p><h2>Cities & growth</h2></div><button data-action="cities">Back to the map</button></div>
    <div class="realm-stats"><div><small>Cities</small><b>${towns.length}</b></div><div><small>Population</small><b>${towns.reduce((n, t) => n + t.pop, 0).toLocaleString()}</b></div><div><small>Army support used / capacity</small><b class="${support.remaining < 0 ? 'neg' : ''}">${support.used.toLocaleString()} / ${support.capacity.toLocaleString()}</b></div></div>
    <p class="sub">Every soldier uses one support place; each hero uses one, regardless of HP. Cities provide one place per 20 residents plus 10 per completed improvement level. Recruitment also reduces civilian population. Growth figures assume adequate food; shortages reduce growth. ${support.remaining < 0 ? 'Your army exceeds current support: existing units stay, but recruitment must wait for more capacity.' : `${support.remaining.toLocaleString()} places are available across your realm.`} Marching armies and battles are limited to 24 units per side.</p>
    <div class="city-summary-grid">${towns.map(t => {
      const c = state.cityEconomies[t.id], growth = townGrowth(t);
      const change = growth;
      return `<article class="city-summary-card"><header><h3>${esc(nodeName(state, t.id))}</h3><span>${t.kind === 'capital' ? 'Capital' : 'City'}</span></header>
        <dl class="city-summary-stats"><div><dt>Population</dt><dd>${t.pop.toLocaleString()}</dd></div><div><dt>Growth at current tax</dt><dd class="${change < 0 ? 'neg' : 'pos'}">${change >= 0 ? '+' : ''}${change}/month</dd></div><div><dt>Army support</dt><dd>${cityArmySupport(state, t)}</dd></div><div><dt>Food in store</dt><dd>${c.goods.food}</dd></div><div><dt>Tax</dt><dd>${t.tax}%</dd></div><div><dt>Unrest</dt><dd>${townUnrest(t)}/100</dd></div></dl>
        <h4>Recommended next steps</h4><ul class="city-advice">${cityGrowthAdvice(state, t).map(a => `<li><p>${esc(a.text)}</p><button data-action="summary-city" data-node="${esc(townLocation(state, t.id))}" data-tab="${a.tab}">${a.tab === 'development' ? 'Development' : a.tab === 'army' ? 'City army' : 'City overview'} →</button></li>`).join('')}</ul>
        <button data-action="summary-city" data-node="${esc(townLocation(state, t.id))}" data-tab="overview">Open ${esc(nodeName(state, t.id))}</button></article>`;
    }).join('')}</div></main>`;
}
