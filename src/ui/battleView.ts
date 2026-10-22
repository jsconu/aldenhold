import { battleSpoils } from '../game/battleRewards';
import { battleFigure, richBattleGround, richRuin } from './richBattle';
import { EFFECTS } from '../content/spells';
import {
  attackOf, attackOrderQuote, alive, commandOf, maxRounds, COMMAND_RANGE, defenseOf, escapeQuote, groupReachable, isAI, powerOf, knownSpells, playerSide, RALLY_AT, rangeOf, reachable, ROUT_AT, spellTargets,
  terrainAt, unitLabel, reserves, FIELD_LIMIT, movementOf, previewSpell, spellAffected, spellCost, teleportDestinations,
} from '../game/battle';
import { nodeName } from '../game/campaign';
import { raidAftermath } from '../game/raids';
import { SPELLS, TERRAIN, UNIT_TYPES } from '../game/data';
import { heroLevel, kitBonus, level } from '../game/units';
import { hexKey, hexDistance } from '../game/hex';
import type { Battle, BattleUnit, GameState, Terrain } from '../game/types';
import { pixelSprite, pixelSpriteDefs } from './pixelSprites';
import { spriteDefs, terrainArt } from './sprites';
import { battleScenery } from './battleScenery';
import { esc, type UIState } from './shared';

const S = 30;
const H = Math.sqrt(3) * S;
const PAD = 6;

function center(col: number, row: number): [number, number] {
  return [PAD + S + col * 1.5 * S, PAD + H / 2 + H * (row + 0.5 * (col & 1))];
}

function hexPoints(cx: number, cy: number, r = S): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export function selectedUnit(b: Battle, ui: UIState): BattleUnit | undefined {
  return b.units.find((u) => u.id === ui.battleUnit && !u.reserve && !u.fled && u.men > 0 && u.side === b.active);
}

/** The lead is first so a clicked destination anchors the same group on every re-render. */
export function selectedGroup(b: Battle, ui: UIState): BattleUnit[] {
  const lead = selectedUnit(b, ui);
  if (!lead) return [];
  const ids = ui.battleUnits?.size ? ui.battleUnits : new Set([lead.id]);
  return [lead, ...alive(b, b.active).filter((u) => u.id !== lead.id && ids.has(u.id))];
}

export function renderBattle(state: GameState, ui: UIState): string {
  const b = state.battle!;
  const me = playerSide(b);
  const myTurn = !b.outcome && !isAI(b, b.active);
  const sel = myTurn ? selectedUnit(b, ui) : undefined;
  const group = myTurn ? selectedGroup(b, ui) : [];
  const reach = group.length > 1 ? groupReachable(b, group.map((u) => u.id)) : sel ? reachable(b, sel) : new Map<string, number>();
  const casting = sel && ui.battleSpell ? spellTargets(b, sel, ui.battleSpell) : null;
  // A single formation can attack any enemy it can reach and strike this turn (one click moves it into range).
  const targets = new Set((group.length > 1 ? [] : casting ?? (sel ? b.units.filter((t) => !attackOrderQuote(b, sel.id, t.id).reason) : [])).map((u) => u.id));
  const chosen = sel && ui.battleSpell ? b.units.find((u) => u.id === ui.battleTarget && spellTargets(b, sel, ui.battleSpell!).includes(u)) : undefined;
  const affected = sel && chosen && ui.battleSpell ? spellAffected(b, sel, ui.battleSpell, chosen) : [];
  const destinations = sel && chosen && ui.battleSpell === 'teleport' ? new Set(teleportDestinations(b, sel, chosen).map(hexKey)) : new Set<string>();

  let ground = '';
  let groundArt = '';
  let highlights = '';
  let overlay = '';
  for (let col = 0; col < b.width; col++) {
    for (let row = 0; row < b.height; row++) {
      const [cx, cy] = center(col, row);
      const kind = b.terrain[col][row];
      const t = TERRAIN[kind];
      ground += `<polygon points="${hexPoints(cx, cy, S + 1)}" class="hex ${kind}"/>`;
      if (kind === 'ruins') groundArt += richRuin(cx,cy,col*31+row*7);
      else if (kind === 'spring' || kind === 'thorns') groundArt += terrainArt(kind,cx,cy,col*31+row*7);
      // A transparent hit area on top of the art carries the click, the tooltip and the move highlight.
      const reachable = (reach.has(hexKey({ col, row })) && !casting) || destinations.has(hexKey({ col, row }));
      const area = !!(chosen && ui.battleSpell && SPELLS[ui.battleSpell].radius && hexDistance(chosen, { col, row }) <= SPELLS[ui.battleSpell].radius);
      // Hex outlines communicate move/spell ranges without drawing the underlying hex lattice.
      if (reachable || area) highlights += `<polygon points="${hexPoints(cx,cy,S-2)}" class="move-border"/><polygon points="${hexPoints(cx,cy,S-2)}" class="battle-spot${reachable ? ' battle-spot-reach' : ''}${area ? ' battle-spot-spell' : ''}"/>`;
      overlay += `<polygon points="${hexPoints(cx, cy)}" class="hit" data-action="hex" data-col="${col}" data-row="${row}">
        <title>${t.name}: ${t.text}</title></polygon>`;
    }
  }
  const units = alive(b)
    .map((u) => {
      const [cx, cy] = center(u.col, u.row);
      const t = UNIT_TYPES[u.type];
      const mine = u.side === me;
      const spent = mine && myTurn && u.acted;
      const hero = !!t.hero;
      const cls = [
        'unit', mine ? 'mine' : 'foe', hero ? 'hero' : '', group.some((member) => member.id === u.id) ? 'sel' : '', u.routing ? 'routing' : '', spent ? 'spent' : '',
        targets.has(u.id) ? (u.side === sel?.side ? 'boon' : 'target') : '', affected.includes(u) ? 'spell-affected' : '',
      ].filter(Boolean).join(' ');
      const aimedBy = b.units.find((x) => x.aim === u.id && x.men > 0 && !x.fled);
      const frac = Math.min(1, u.men / u.maxMen);
      const morale = hero ? 1 : u.morale / 100;
      return `<g class="${cls}" data-action="hex" data-col="${u.col}" data-row="${u.row}">
        <title>${esc(unitLabel(b, u))}: ${u.men} ${hero ? 'HP' : `men, morale ${u.morale}${u.routing ? ', running' : ''}`}</title>
        <ellipse cx="${cx}" cy="${cy + 4}" rx="21" ry="17" class="mark"/>
        <ellipse cx="${cx}" cy="${cy + 9}" rx="15" ry="5" class="base"/>
        ${battleFigure(u.type, cx, cy, u.side === 'defender', u.men, mine ? state.rulerAppearance : undefined, u.name ? (/^(Mother|Sister|Edith|Tamsin|Ysolde)/.test(u.name)?'female':'male') : (u.troopId%2?'female':'male')) || pixelSprite(u.type, mine ? 'mine' : 'foe', cx, cy + 10, 2.5, u.side === 'defender')}
        ${hero ? `<path d="m${cx + 15} ${cy - 23} 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" class="star"/>` : ''}
        <rect x="${cx - 18}" y="${cy + 3}" width="36" height="16" rx="4" class="unit-status-back"/>
        <text x="${cx}" y="${cy + 12}" class="men${hero ? ' hero-hp' : ''}">${u.routing ? 'RUN' : hero ? u.men+' HP' : u.men}</text>
        <rect x="${cx - 14}" y="${cy + 14}" width="28" height="2" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 14}" width="${(28 * frac).toFixed(1)}" height="2" class="hp"/>
        ${aimedBy ? `<g class="aimed"><title>${esc(unitLabel(b, aimedBy))} will throw a boulder here next turn if this formation is still within ${UNIT_TYPES[aimedBy.type].boulder!.range} hexes.</title><circle cx="${cx}" cy="${cy - 2}" r="24" class="aim-ring"/><text x="${cx - 18}" y="${cy - 14}" class="aim-mark">!</text></g>` : ''}
        ${u.effects.length ? `<text x="${cx + 16}" y="${cy - 10}" class="effect-badge"><title>${esc(u.effects.map((e) => `${EFFECTS[e.id].name}: ${e.turns} turns`).join('; '))}</title>✦</text>` : ''}
        ${hero ? '' : `<rect x="${cx - 14}" y="${cy + 17}" width="28" height="1.5" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 17}" width="${(28 * morale).toFixed(1)}" height="1.5" class="morale${u.morale < 40 ? ' low' : ''}"/>`}
      </g>`;
    })
    .join('');

  const w = PAD * 2 + S * 2 + (b.width - 1) * 1.5 * S;
  const zoom = ui.battleZoom ?? 1;
  const h = PAD * 2 + H * (b.height + 0.5);
  const turnText = b.outcome
    ? b.owners[b.outcome] === 'player' ? 'Victory!' : 'Defeat.'
    : myTurn ? 'Your move' : 'Enemy move';

  return `
  <header class="bar">
    <h1>Battle at ${esc(nodeName(state, b.at))}</h1>
    <span class="date">Round ${Math.min(b.round, maxRounds(b))} of ${maxRounds(b)}</span>
    <span class="turn ${myTurn ? 'mine' : ''}">${turnText}</span>
    ${sel && group.length<2 ? renderCastBar(b, sel, ui) : ''}
    <span class="spacer"></span>
    ${b.outcome
      ? `<button data-action="battle-continue" class="primary">Back to the map</button>`
      : `${ui.undoMoveLabel ? `<button data-action="undo-move" class="ghost">${esc(ui.undoMoveLabel)}</button>` : ui.undoMoveBlocked ? `<button data-action="undo-move" class="ghost" disabled title="${esc(ui.undoMoveBlocked)}">Can’t undo</button>` : ''}
         ${me ? (() => {
          const q = escapeQuote(b, me);
          return `<button data-action="battle-retreat" class="ghost" ${q.reason ? `disabled title="${esc(q.reason)}"` : `title="Fails ${100 - Math.round(q.chance * 100)}% of the time and spends your turn; enemies next to your troops make it harder."`}>Run away${q.reason ? ` (after turn ${q.after})` : ` (${Math.round(q.chance * 100)}%)`}</button>`;
        })() : ''}
         <span class="camera" aria-label="Camera">
           <button data-action="battle-zoom" data-dir="-1" class="ghost" title="Zoom out">−</button>
           <button data-action="battle-zoom" data-dir="1" class="ghost" title="Zoom in">+</button>
           ${sel ? '<button data-action="battle-center" class="ghost" title="Scroll to the selected formation">Centre</button>' : ''}
         </span>
         <button data-action="battle-auto" class="ghost">Auto-resolve</button>
         <button data-action="battle-end" class="primary">End turn</button>`}
  </header>
  <main class="battle">
    <section class="field-wrap battle-scroll" tabindex="0" aria-label="Battlefield: drag or use the arrow keys to look around">
      <svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" class="field" width="${(w * zoom).toFixed(0)}" height="${(h * zoom).toFixed(0)}">
      ${spriteDefs()}
      <defs>${pixelSpriteDefs()}
        <filter id="battle-terrain-blend" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="8"/>
        </filter>
        <radialGradient id="battle-selection-glow">
          <stop offset="0%" stop-color="#e7e0aa" stop-opacity=".45"/>
          <stop offset="75%" stop-color="#e4d18f" stop-opacity=".2"/>
          <stop offset="100%" stop-color="#e4d18f" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="battle-spell-glow">
          <stop offset="0%" stop-color="#f7a254" stop-opacity=".5"/>
          <stop offset="100%" stop-color="#f7a254" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${h}" class="battle-earth"/>
      <g class="battle-terrain-wash" filter="url(#battle-terrain-blend)">${ground}</g>
      ${richBattleGround(b, (x,y)=>hexPoints(x,y,S+.3))}${battleScenery(b)}
      <g class="battle-surface-details" pointer-events="none">${groundArt}</g>
      <g class="battle-move-highlights" pointer-events="none">${highlights}</g>
      ${overlay}${units}
    </svg></section>
    <aside class="side">
      ${renderMinimap(b, w, h)}
      ${ui.message ? `<p class="msg" role="status">${esc(ui.message)}</p>` : ''}
      ${myTurn ? renderGroupSelector(b, group) : ''}
      ${b.outcome ? '' : group.length > 1 ? `<p class="hint">${group.length} formations selected. The slowest has ${Math.min(...group.map(movementOf))} movement. Click a glowing location to move together while keeping their spacing. Select one formation to attack or cast.</p>` : sel ? renderUnit(state, b, sel, ui) : '<p class="hint">Gold-bordered hexes show where you can move this turn. Click one of your units, then a marked enemy to move into range and attack in one click, or a glowing location to move. Each unit may move, then attack, once a turn. Heroes (★) can cast spells instead of attacking.</p>'}
      <p class="sub">Groups of soldiers are formations; single figures marked ★ are heroes. People share the same scale; groups represent formations. Formation numbers count soldiers; hero numbers show HP. The thin bar under each troop is its morale. Below ${ROUT_AT} it breaks and runs for its own edge of the field; at ${RALLY_AT} it may rally.</p>
      ${b.walls ? `<p class="sub">${me === 'defender' ? 'You fight behind town walls: +1 defense.' : 'The enemy is behind walls: +1 defense.'}</p>` : ''}
      ${renderReserves(b)}
      ${renderLegend(b)}
      <details class="log" open><summary>Battle report</summary><ul>${b.log.slice(-14).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>${b.outcome ? renderOutcome(state, b) : ''}`;
}

/** Ground colours for the minimap. */
const MINIMAP_GROUND: Partial<Record<Terrain, string>> = {
  forest: '#2f5a2a', hill: '#8a7a4a', stream: '#3d6fa8', marsh: '#4d6a55', thorns: '#5c6b2a', ruins: '#8c8378', rocks: '#5a5a5a', spring: '#7fc8e8',
};

/**
 * The whole field small: ground, both armies, and a frame for what the main view shows (kept in step by the
 * page's scroll handler). Click it to look there.
 */
function renderMinimap(b: Battle, w: number, h: number): string {
  let ground = '';
  for (let col = 0; col < b.width; col++) {
    for (let row = 0; row < b.height; row++) {
      const fill = MINIMAP_GROUND[b.terrain[col][row]];
      if (!fill) continue;
      const [cx, cy] = center(col, row);
      ground += `<rect x="${(cx - S).toFixed(0)}" y="${(cy - H / 2).toFixed(0)}" width="${(S * 2).toFixed(0)}" height="${H.toFixed(0)}" fill="${fill}"/>`;
    }
  }
  const me = playerSide(b);
  const dots = b.units.filter((u) => !u.reserve && !u.fled && u.men > 0).map((u) => {
    const [cx, cy] = center(u.col, u.row);
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${S * 0.8}" class="${u.side === me ? 'mine' : 'foe'}"/>`;
  }).join('');
  return `<figure class="minimap"><svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" data-action="minimap" data-width="${w.toFixed(0)}" data-height="${h.toFixed(0)}" role="img" aria-label="Minimap of the whole field">
    <rect x="0" y="0" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#55704a"/>${ground}${dots}
    <rect class="minimap-view" x="0" y="0" width="0" height="0"/></svg>
    <figcaption>${b.width}×${b.height} field · click to look there</figcaption></figure>`;
}

function renderGroupSelector(b: Battle, group: BattleUnit[]): string {
  const selected = new Set(group.map((u) => u.id));
  return `<details class="battle-group" open><summary>Move together (${selected.size} selected)</summary>
    <p class="sub">Tick formations here, or Shift-click blue units. A glowing destination moves them together at the slowest pace, keeping their spacing. One formation occupies each battle hex.</p>
    <div class="battle-group-list">${alive(b, b.active).map((u) =>
      `<label><input type="checkbox" data-change="battle-check" data-troop="${u.id}" ${selected.has(u.id) ? 'checked' : ''} ${u.moved || u.acted || u.routing ? 'disabled' : ''}>
        ${esc(unitLabel(b, u))} · ${u.moved || u.acted ? 'moved' : `${movementOf(u)} move`}</label>`).join('')}</div>
  </details>`;
}

function renderLegend(b: Battle): string {
  const present = new Set(b.terrain.flat());
  const kinds = (Object.keys(TERRAIN) as Terrain[]).filter((k) => k !== 'plain' && present.has(k));
  if (!kinds.length) return '';
  return `<details class="legend" open><summary>Ground on this field</summary><ul>${kinds
    .map((k) => `<li><svg viewBox="-31 -27 62 54" class="swatch"><polygon points="${hexPoints(0, 0)}" class="hex ${k}"/>${k === 'ruins' ? richRuin(0,0,3) : terrainArt(k,0,0,3)}</svg>
      <span><b>${TERRAIN[k].name}.</b> ${TERRAIN[k].text}</span></li>`)
    .join('')}</ul></details>`;
}

function renderUnit(state: GameState, b: Battle, u: BattleUnit, ui: UIState): string {
  const t = UNIT_TYPES[u.type];
  const spells = UNIT_TYPES[u.type].hero?.spells ?? [];
  const known = knownSpells(u);
  const title = t.hero ? `★ ${esc(u.name ?? t.name)} <small>${u.type==='lord' && state.rulerAppearance ? 'Knight' : t.name}, Lv ${heroLevel(u.xp)}</small>` : `${esc(t.name)}${level(u.xp) ? ` <small>Lv ${level(u.xp)}</small>` : ''}`;
  const spellButtons = spells
    .map((id) => {
      const sp = SPELLS[id];
      const unlocked = known.includes(id);
      const usable = unlocked && spellTargets(b, u, id).length > 0;
      return `<button data-action="spell" data-spell="${id}" class="${ui.battleSpell === id ? 'primary' : ''}" ${usable ? '' : 'disabled'}
        title="${esc(sp.text)} Range ${sp.range}.">${sp.name} <span>${unlocked ? `${spellCost(u, id)} mana` : `Lv ${sp.level}`}</span></button>`;
    })
    .join('');
  return `<h2>${title}</h2>
    <dl class="stats">
      <dt>${t.hero ? 'Health' : 'Men'}</dt><dd>${u.men} / ${u.maxMen}</dd>
      ${t.hero ? `<dt>Leadership</dt><dd>+${t.hero.leadership} morale to the army</dd>` : `<dt>Morale</dt><dd>${u.morale}${u.routing ? ' (running)' : ''}</dd>`}
      <dt>Attack</dt><dd>${attackOf(u, b).toFixed(1)}${commandOf(b, u) ? ` <small>(+${Math.round(commandOf(b, u) * 100)}% from a hero's command)</small>` : ''}</dd>
      ${t.hero ? `<dt>Hitting power</dt><dd>${powerOf(u).toFixed(1)} <small>(grows ${Math.round(t.hero.growth * 100)}% a level)</small></dd>
      <dt>Command</dt><dd>+${t.hero.leadership + kitBonus(u.kit).leadership + 2 * heroLevel(u.xp)}% attack to formations within ${COMMAND_RANGE} hexes</dd>` : ''}
      <dt>Defense</dt><dd>${defenseOf(b, u)}</dd>
      <dt>Move</dt><dd>${u.moved ? 'done' : movementOf(u)}</dd>
      ${t.range > 1 ? `<dt>Range</dt><dd>${rangeOf(b, u)} (not when an enemy is next to it)</dd>` : ''}
      <dt>Effects</dt><dd>${u.effects.length ? u.effects.map((e) => `${EFFECTS[e.id].name} (${e.turns} turns): ${EFFECTS[e.id].text}`).join('<br>') : 'None'}</dd>
      <dt>Spell resistance</dt><dd>${Object.entries(t.resistances ?? {}).map(([kind, value]) => `${kind} ${value}%`).join(', ') || 'None'}${t.hero ? '; fearless (Terror immune)' : ''}</dd>
      <dt>Ground</dt><dd>${terrainAt(b, u).name}</dd>
      ${spells.length ? `<dt>Mana</dt><dd>${u.mana}</dd>` : ''}
    </dl>
    ${spells.length ? `<div class="spells">${spellButtons}</div>
      <p class="sub">${ui.battleSpell ? `${esc(SPELLS[ui.battleSpell].text)} Select a highlighted formation${ui.battleSpell === 'teleport' ? ', then a highlighted empty location' : ''}, review the effect and confirm.` : 'Choose a spell, then select a target. Locked spells show their required level. Level 10 reduces mana cost by one (minimum two).'}</p>
      ${renderSpellPreview(b, u, ui)}` : ''}`;
}

function renderOutcome(state: GameState, b: Battle): string {
  const won = b.owners[b.outcome!] === 'player';
  const lost = (side: 'attacker' | 'defender') =>
    b.units.filter((u) => u.side === side && !UNIT_TYPES[u.type].hero).reduce((s, u) => s + (u.startMen - u.men), 0);
  const me = playerSide(b)!;
  const rows = (side: 'attacker' | 'defender') => b.units.filter(u=>u.side===side).map(u=> {
    const hero = !!UNIT_TYPES[u.type].hero;
    const gain = u.men > 0 && !u.reserve ? (hero ? 1 + Math.floor(u.deeds / 2) : 1) : 0;
    const before = hero ? heroLevel(u.xp) : level(u.xp);
    const after = hero ? heroLevel(u.xp + gain) : level(u.xp + gain);
    return '<tr><th scope="row">'+esc(u.name ?? UNIT_TYPES[u.type].name)+'</th><td>'+Math.max(0,u.startMen-u.men)+(hero ? ' HP' : '')+'</td><td>'+(u.men<=0 ? (hero ? 'Fallen' : 'Destroyed') : u.reserve ? 'Reserve' : u.fled ? 'Withdrew' : 'Survived')+'</td><td>'+ (gain ? '+'+gain+' XP'+(after>before ? ' · Level '+after : '') : '—')+'</td></tr>';
  }).join('');
  const army = (side: 'attacker' | 'defender') => '<section><h3>'+ (side===me ? 'Your army' : 'Enemy army')+'</h3><div class="report-table"><table><thead><tr><th>Formation</th><th>Losses</th><th>Fate</th><th>Advancement</th></tr></thead><tbody>'+rows(side)+'</tbody></table></div></section>';
  return `<section class="battle-report" aria-labelledby="battle-result-title"><div class="battle-report-sheet"><p class="report-eyebrow">Chronicle of battle · Round ${b.round}</p><h2 id="battle-result-title">${won ? 'Victory' : 'Defeat'} at ${esc(nodeName(state,b.at))}</h2>
    <p class="battle-spoils">Gold spoils: <b>${battleSpoils(b)}g</b>${won ? ' · collected when you continue' : ' · victory is required'}.</p><p>You lost ${lost(me)} men. The enemy lost ${lost(me === 'attacker' ? 'defender' : 'attacker')}.</p>
    ${army(me)}${army(me === 'attacker' ? 'defender' : 'attacker')}
    ${b.retreated === me && !b.raid ? '<p class="sub">Your troops fall back to where they came from.</p>' : ''}
    ${b.raid ? `<p class="raid-outcome">${esc(won ? `The raid is beaten off. ${nodeName(state, b.raid.town)} is safe.` : `The raiders break into ${nodeName(state, b.raid.town)}. ${raidAftermath(state, b.raid.lair, b.raid.town)}`)}</p>` : ''}<p class="sub">Experience and campaign consequences are applied when you continue.</p><button data-action="battle-continue" class="primary">Continue to the realm</button></div></section>`;
}

function renderReserves(b: Battle): string {
  const held = reserves(b);
  if (!held.length) return '';
  return `<details class="log reserves" open><summary>Reserves (${held.length} formations)</summary>
    <p class="sub">Only the first ${FIELD_LIMIT} formations in each army deploy. Reserves stay off-field for the entire battle: no attacks, spells, combat losses or experience. They retreat with the army and share pursuit losses; if cut off, they scatter with it.</p>
    <ul>${held.map((u) => `<li>${esc(unitLabel(b, u))}: ${u.men} ${UNIT_TYPES[u.type].hero ? 'HP' : 'men'} — reserve (field full)</li>`).join('')}</ul></details>`;
}

/**
 * The spell being aimed, in the always-visible top bar: what to click, then what the cast will do and a Cast
 * button. The full preview also sits in the side panel, which on smaller screens is below the field.
 */
function renderCastBar(b: Battle, caster: BattleUnit, ui: UIState): string {
  const id = ui.battleSpell;
  if (!id) return '';
  const target = b.units.find((u) => u.id === ui.battleTarget);
  const preview = target ? previewSpell(b, caster, id, target, ui.battleDestination ?? undefined) : null;
  if (!preview) {
    const step = id === 'teleport' && target ? 'click an empty highlighted hex to send them to' : 'click a highlighted target';
    return `<span class="cast-bar">${SPELLS[id].name}: ${step}.</span>`;
  }
  const damage = preview.impacts.reduce((n, hit) => n + hit.damage, 0);
  const effect = damage ? `${damage} damage` : preview.impacts.some((hit) => hit.healing) ? 'healing' : 'effect shown below';
  return `<span class="cast-bar">${SPELLS[id].name} on ${esc(unitLabel(b, target!))}: ${effect}.
    <button data-action="spell-confirm" class="primary">Cast ${SPELLS[id].name}</button> <small>or click the target again</small></span>`;
}

function renderSpellPreview(b: Battle, caster: BattleUnit, ui: UIState): string {
  const id = ui.battleSpell;
  const target = b.units.find((u) => u.id === ui.battleTarget);
  if (!id || !target) return '';
  const preview = previewSpell(b, caster, id, target, ui.battleDestination ?? undefined);
  if (!preview) return id === 'teleport' && spellTargets(b, caster, id).includes(target) ? '<p class="sub">Choose an empty highlighted destination for Teleport.</p>' : '';
  const friendlyFire = preview.impacts.some((hit) => hit.unit.side === caster.side && hit.damage > 0);
  return `<section class="spell-preview" aria-label="Spell preview"><h3>${SPELLS[id].name} preview</h3>
    ${friendlyFire ? '<p class="msg">Friendly fire: this spell will hurt your formations.</p>' : ''}
    <ul>${preview.impacts.map((hit) => `<li>${esc(unitLabel(b, hit.unit))}: ${[
      hit.damage ? `${hit.damage} damage (${hit.unit.men - hit.damage} remaining)` : '', hit.healing ? `restore ${hit.healing}` : '',
      hit.add ? `${EFFECTS[hit.add].name} for ${EFFECTS[hit.add].turns} turns` : '',
      hit.remove.length ? `remove ${hit.remove.map((effect) => EFFECTS[effect].name).join(', ')}` : '',
      id === 'terror' ? `lose up to ${30 + 5 * heroLevel(caster.xp)} morale` : '', id === 'rally' ? 'restore up to 40 morale' : '',
      preview.destination ? `teleport to ${preview.destination.col + 1}, ${preview.destination.row + 1}; move spent` : '',
    ].filter(Boolean).join('; ') || 'No damage'}</li>`).join('')}</ul>
    ${preview.breaksWalls ? '<p>Battlefield walls break: defenders lose their +1 wall defense.</p>' : ''}
    <button data-action="spell-confirm" class="primary">Cast ${SPELLS[id].name} — ${spellCost(caster, id)} mana</button>
    <p class="sub">Consumes the caster’s attack and remaining move. Effects expire at the end of the affected side’s turn.</p>
    </section>`;
}
