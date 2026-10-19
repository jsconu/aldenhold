import {
  armyAt, canRecruitAt, dateLabel, monthlyIncome, monthlyUpkeep, neighborsOf, nodeName, townGrowth, townIncome,
} from '../game/campaign';
import { level } from '../game/battle';
import { UNIT_TYPES } from '../game/data';
import type { Army, FactionId, GameState } from '../game/types';
import { esc, type UIState } from './shared';

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
  const net = income - upkeep;
  return `
  <header class="bar">
    <h1>Aragon <small>working title</small></h1>
    <span class="date">${dateLabel(state.turn)}</span>
    <span class="gold" title="Income ${income}, upkeep ${upkeep}">Gold <b>${state.gold}</b>
      <em class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${net}/month</em></span>
    <span class="spacer"></span>
    <button data-action="new-game" class="ghost">New game</button>
    <button data-action="end-turn" class="primary" ${state.status !== 'playing' ? 'disabled' : ''}>End month</button>
  </header>
  ${state.status !== 'playing' ? `<div class="banner ${state.status}">${state.status === 'won' ? 'You have won. The valley is united.' : 'You have lost. Aldenhold has fallen.'} <button data-action="new-game">Play again</button></div>` : ''}
  <main class="campaign">
    <section class="map-wrap">${renderMap(state, ui)}</section>
    <aside class="side">
      ${ui.message ? `<p class="msg">${esc(ui.message)}</p>` : ''}
      ${ui.selected ? renderNodePanel(state, ui, ui.selected) : '<p class="hint">Click a place on the map. Your troops show as blue shields.</p>'}
      <details class="log" open><summary>Chronicle</summary><ul>${state.log.slice(0, 14).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`;
}

function renderMap(state: GameState, ui: UIState): string {
  const targets = moveTargets(state, ui);
  const pos = (id: string) => state.nodes.find((n) => n.id === id)!;
  const edges = state.edges
    .map(([a, b]) => {
      const p = pos(a), q = pos(b);
      const hot = (ui.selected === a && targets.includes(b)) || (ui.selected === b && targets.includes(a));
      return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="road${hot ? ' hot' : ''}"/>`;
    })
    .join('');
  const nodes = state.nodes
    .map((n) => {
      const town = state.towns[n.id];
      const r = town ? (town.kind === 'town' ? 18 : 24) : 9;
      const cls = ['node', town ? `own-${town.owner}` : 'waypoint', town?.kind ?? '', ui.selected === n.id ? 'selected' : '', targets.includes(n.id) ? 'target' : '']
        .filter(Boolean)
        .join(' ');
      const armies = state.armies.filter((a) => a.at === n.id);
      return `<g class="${cls}" data-action="node" data-node="${n.id}">
        <circle cx="${n.x}" cy="${n.y}" r="${r + 10}" class="hit"/>
        ${targets.includes(n.id) ? `<circle cx="${n.x}" cy="${n.y}" r="${r + 7}" class="ring"/>` : ''}
        <circle cx="${n.x}" cy="${n.y}" r="${r}" class="dot"/>
        ${town?.kind === 'lair' ? `<text x="${n.x}" y="${n.y + 6}" class="glyph">☠</text>` : town?.kind === 'capital' ? `<text x="${n.x}" y="${n.y + 6}" class="glyph">♜</text>` : ''}
        <text x="${n.x}" y="${n.y + r + 18}" class="label">${esc(n.name)}</text>
        ${armies.map((a, i) => shield(a, n.x + r - 2 + i * 26, n.y - r - 14)).join('')}
      </g>`;
    })
    .join('');
  return `<svg viewBox="0 0 840 500" class="map" role="img" aria-label="Province map">
    <rect x="0" y="0" width="840" height="500" class="land"/>
    ${edges}${nodes}</svg>`;
}

function shield(a: Army, x: number, y: number): string {
  const men = a.troops.reduce((s, t) => s + t.men, 0);
  return `<g class="army own-${a.owner}"><title>${a.troops.length} troops, ${men} men</title>
    <path d="M${x - 11},${y - 10} h22 v10 q0,12 -11,16 q-11,-4 -11,-16 z" class="shield"/>
    <text x="${x}" y="${y + 5}" class="count">${a.troops.length}</text></g>`;
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
    }
  } else {
    html += `<p class="sub">Open country</p>`;
  }
  for (const a of armies) html += renderArmy(ui, a);
  if (!armies.length) html += `<p class="sub">No troops here.</p>`;
  return html;
}

function renderArmy(ui: UIState, a: Army): string {
  const mine = a.owner === 'player';
  const rows = a.troops
    .map((t) => {
      const type = UNIT_TYPES[t.type];
      const lv = level(t.xp);
      const box = mine
        ? `<input type="checkbox" data-change="check" data-troop="${t.id}" ${ui.checked.has(t.id) ? 'checked' : ''} ${t.moved ? 'disabled' : ''}/>`
        : '';
      return `<li class="${t.moved && mine ? 'done' : ''}"><label>${box}<span class="tname">${type.name}</span>
        <span class="men">${t.men} men</span>${lv ? `<span class="lv">Lv ${lv}</span>` : ''}${t.moved && mine ? '<span class="tag">marched</span>' : ''}</label></li>`;
    })
    .join('');
  const ready = mine && a.troops.some((t) => !t.moved);
  return `<div class="army-card own-${a.owner}"><h3>${mine ? 'Your troops' : a.owner === 'orcs' ? 'Orc host' : 'Town militia'}</h3>
    <ul class="troops">${rows}</ul>
    ${ready ? `<p class="hint">Tick the troops to send, then click a glowing place on the map.</p>` : ''}</div>`;
}
