import { ENCOUNTERS } from '../content/encounters';
import { EFFECTS } from '../content/spells';
import {
  attackOf, attackTargets, alive, defenseOf, isAI, knownSpells, playerSide, RALLY_AT, rangeOf, reachable, ROUT_AT, spellTargets,
  terrainAt, unitLabel, reserves, FIELD_LIMIT, movementOf, previewSpell, spellAffected, spellCost, teleportDestinations,
} from '../game/battle';
import { nodeName } from '../game/campaign';
import { SPELLS, TERRAIN, UNIT_TYPES } from '../game/data';
import { heroLevel, level } from '../game/units';
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

export function renderBattle(state: GameState, ui: UIState): string {
  const b = state.battle!;
  const me = playerSide(b);
  const myTurn = !b.outcome && !isAI(b, b.active);
  const sel = myTurn ? selectedUnit(b, ui) : undefined;
  const reach = sel ? reachable(b, sel) : new Map<string, number>();
  const casting = sel && ui.battleSpell ? spellTargets(b, sel, ui.battleSpell) : null;
  const targets = new Set((casting ?? (sel ? attackTargets(b, sel) : [])).map((u) => u.id));
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
      groundArt += terrainArt(kind, cx, cy, col * 31 + row * 7);
      // A transparent hit area on top of the art carries the click, the tooltip and the move highlight.
      const reachable = (reach.has(hexKey({ col, row })) && !casting) || destinations.has(hexKey({ col, row }));
      const area = !!(chosen && ui.battleSpell && SPELLS[ui.battleSpell].radius && hexDistance(chosen, { col, row }) <= SPELLS[ui.battleSpell].radius);
      // Circular glows communicate move/spell ranges without drawing the underlying hex lattice.
      if (reachable || area) highlights += `<ellipse cx="${cx}" cy="${cy}" rx="21" ry="17"
        class="battle-spot${reachable ? ' battle-spot-reach' : ''}${area ? ' battle-spot-spell' : ''}" />`;
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
        'unit', mine ? 'mine' : 'foe', hero ? 'hero' : '', sel?.id === u.id ? 'sel' : '', u.routing ? 'routing' : '', spent ? 'spent' : '',
        targets.has(u.id) ? (u.side === sel?.side ? 'boon' : 'target') : '', affected.includes(u) ? 'spell-affected' : '',
      ].filter(Boolean).join(' ');
      const frac = Math.min(1, u.men / u.maxMen);
      const morale = hero ? 1 : u.morale / 100;
      return `<g class="${cls}" data-action="hex" data-col="${u.col}" data-row="${u.row}">
        <title>${esc(unitLabel(b, u))}: ${u.men} ${hero ? 'HP' : `men, morale ${u.morale}${u.routing ? ', running' : ''}`}</title>
        <ellipse cx="${cx}" cy="${cy + 4}" rx="21" ry="17" class="mark"/>
        <ellipse cx="${cx}" cy="${cy + 9}" rx="15" ry="5" class="base"/>
        ${pixelSprite(u.type, mine ? 'mine' : 'foe', cx, cy + 10, 2.5, u.side === 'defender')}
        ${hero ? `<path d="m${cx + 15} ${cy - 23} 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" class="star"/>` : ''}
        <text x="${cx}" y="${cy + 17}" class="men">${u.routing ? 'RUN' : u.men}</text>
        <rect x="${cx - 14}" y="${cy + 19}" width="28" height="3" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 19}" width="${(28 * frac).toFixed(1)}" height="3" class="hp"/>
        ${u.effects.length ? `<text x="${cx + 16}" y="${cy - 10}" class="effect-badge"><title>${esc(u.effects.map((e) => `${EFFECTS[e.id].name}: ${e.turns} turns`).join('; '))}</title>✦</text>` : ''}
        ${hero ? '' : `<rect x="${cx - 14}" y="${cy + 22}" width="28" height="2" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 22}" width="${(28 * morale).toFixed(1)}" height="2" class="morale${u.morale < 40 ? ' low' : ''}"/>`}
      </g>`;
    })
    .join('');

  const w = PAD * 2 + S * 2 + (b.width - 1) * 1.5 * S;
  const h = PAD * 2 + H * (b.height + 0.5);
  const turnText = b.outcome
    ? b.owners[b.outcome] === 'player' ? 'Victory!' : 'Defeat.'
    : myTurn ? 'Your move' : 'Enemy move';

  return `
  <header class="bar">
    <h1>${b.encounterId ? esc(ENCOUNTERS[b.encounterId].name) : `Battle at ${esc(nodeName(state, b.at))}`}</h1>
    <span class="date">Round ${Math.min(b.round, 20)} of 20</span>
    <span class="turn ${myTurn ? 'mine' : ''}">${turnText}</span>
    <span class="spacer"></span>
    ${b.outcome
      ? `<button data-action="battle-continue" class="primary">Back to the map</button>`
      : `${me === 'attacker' ? `<button data-action="battle-retreat" class="ghost">Retreat</button>` : ''}
         <button data-action="battle-auto" class="ghost">Auto-resolve</button>
         <button data-action="battle-end" class="primary">End turn</button>`}
  </header>
  <main class="battle">
    <section class="field-wrap"><svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" class="field">
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
      ${battleScenery(b)}
      <g class="battle-surface-details" pointer-events="none">${groundArt}</g>
      <g class="battle-move-highlights" pointer-events="none">${highlights}</g>
      ${overlay}${units}
    </svg></section>
    <aside class="side">
      ${b.encounterId ? `<p class="sub">One-attempt expedition. ${esc(ENCOUNTERS[b.encounterId].warning)}</p>` : ''}
      ${b.outcome ? renderOutcome(b) : sel ? renderUnit(b, sel, ui) : '<p class="hint">Click one of your units (blue), then a glowing location to move or a marked enemy to attack. Each unit may move, then attack, once a turn. Heroes (★) can cast spells instead of attacking.</p>'}
      <p class="sub">The thin bar under each troop is its morale. Below ${ROUT_AT} it breaks and runs for its own edge of the field; at ${RALLY_AT} it may rally.</p>
      ${b.walls ? `<p class="sub">${me === 'defender' ? 'You fight behind town walls: +1 defense.' : 'The enemy is behind walls: +1 defense.'}</p>` : ''}
      ${renderReserves(b)}
      ${renderLegend(b)}
      <details class="log" open><summary>Battle report</summary><ul>${b.log.slice(-14).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`;
}

function renderLegend(b: Battle): string {
  const present = new Set(b.terrain.flat());
  const kinds = (Object.keys(TERRAIN) as Terrain[]).filter((k) => k !== 'plain' && present.has(k));
  if (!kinds.length) return '';
  return `<details class="legend" open><summary>Ground on this field</summary><ul>${kinds
    .map((k) => `<li><svg viewBox="-31 -27 62 54" class="swatch"><polygon points="${hexPoints(0, 0)}" class="hex ${k}"/>${terrainArt(k, 0, 0, 3)}</svg>
      <span><b>${TERRAIN[k].name}.</b> ${TERRAIN[k].text}</span></li>`)
    .join('')}</ul></details>`;
}

function renderUnit(b: Battle, u: BattleUnit, ui: UIState): string {
  const t = UNIT_TYPES[u.type];
  const spells = UNIT_TYPES[u.type].hero?.spells ?? [];
  const known = knownSpells(u);
  const title = t.hero ? `★ ${esc(u.name ?? t.name)} <small>${t.name}, Lv ${heroLevel(u.xp)}</small>` : `${esc(t.name)}${level(u.xp) ? ` <small>Lv ${level(u.xp)}</small>` : ''}`;
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
      <dt>Attack</dt><dd>${attackOf(u).toFixed(1)}</dd>
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

function renderOutcome(b: Battle): string {
  const won = b.owners[b.outcome!] === 'player';
  const lost = (side: 'attacker' | 'defender') =>
    b.units.filter((u) => u.side === side && !UNIT_TYPES[u.type].hero).reduce((s, u) => s + (u.startMen - u.men), 0);
  const me = playerSide(b)!;
  return `<h2>${won ? 'Victory' : 'Defeat'}</h2>
    <p>You lost ${lost(me)} men. The enemy lost ${lost(me === 'attacker' ? 'defender' : 'attacker')}.</p>
    ${b.retreated === me ? '<p class="sub">Your troops fall back to where they came from.</p>' : ''}`;
}

function renderReserves(b: Battle): string {
  const held = reserves(b);
  if (!held.length) return '';
  return `<details class="log reserves" open><summary>Reserves (${held.length} formations)</summary>
    <p class="sub">Only the first ${FIELD_LIMIT} formations in each army deploy. Reserves stay off-field for the entire battle: no attacks, spells, combat losses or experience. They retreat with the army and share pursuit losses; if cut off, they scatter with it.</p>
    <ul>${held.map((u) => `<li>${esc(unitLabel(b, u))}: ${u.men} ${UNIT_TYPES[u.type].hero ? 'HP' : 'men'} — reserve (field full)</li>`).join('')}</ul></details>`;
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
