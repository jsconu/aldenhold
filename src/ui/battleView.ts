import {
  attackOf, attackTargets, alive, defenseOf, isAI, knownSpells, playerSide, RALLY_AT, reachable, ROUT_AT, spellTargets, unitLabel,
} from '../game/battle';
import { nodeName } from '../game/campaign';
import { SPELLS, UNIT_TYPES } from '../game/data';
import { heroLevel, level } from '../game/units';
import { hexKey } from '../game/hex';
import type { Battle, BattleUnit, GameState } from '../game/types';
import { esc, type UIState } from './shared';

const S = 30;
const H = Math.sqrt(3) * S;
const PAD = 6;

function center(col: number, row: number): [number, number] {
  return [PAD + S + col * 1.5 * S, PAD + H / 2 + H * (row + 0.5 * (col & 1))];
}

function hexPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + S * Math.cos(a)).toFixed(1)},${(cy + S * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export function selectedUnit(b: Battle, ui: UIState): BattleUnit | undefined {
  return b.units.find((u) => u.id === ui.battleUnit && u.men > 0 && u.side === b.active);
}

export function renderBattle(state: GameState, ui: UIState): string {
  const b = state.battle!;
  const me = playerSide(b);
  const myTurn = !b.outcome && !isAI(b, b.active);
  const sel = myTurn ? selectedUnit(b, ui) : undefined;
  const reach = sel ? reachable(b, sel) : new Map<string, number>();
  const casting = sel && ui.battleSpell ? spellTargets(b, sel, ui.battleSpell) : null;
  const targets = new Set((casting ?? (sel ? attackTargets(b, sel) : [])).map((u) => u.id));
  const friendlySpell = !!ui.battleSpell && SPELLS[ui.battleSpell].target === 'friend';

  let hexes = '';
  for (let col = 0; col < b.width; col++) {
    for (let row = 0; row < b.height; row++) {
      const [cx, cy] = center(col, row);
      const k = hexKey({ col, row });
      const cls = ['hex', b.terrain[col][row], reach.has(k) && !casting ? 'reach' : ''].filter(Boolean).join(' ');
      hexes += `<polygon points="${hexPoints(cx, cy)}" class="${cls}" data-action="hex" data-col="${col}" data-row="${row}"/>`;
      if (b.terrain[col][row] !== 'plain') {
        hexes += `<text x="${cx}" y="${cy + 18}" class="terrain-glyph">${b.terrain[col][row] === 'forest' ? '♣' : '▲'}</text>`;
      }
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
        targets.has(u.id) ? (friendlySpell ? 'boon' : 'target') : '',
      ].filter(Boolean).join(' ');
      const frac = Math.min(1, u.men / u.maxMen);
      const morale = hero ? 1 : u.morale / 100;
      return `<g class="${cls}" data-action="hex" data-col="${u.col}" data-row="${u.row}">
        <title>${esc(unitLabel(b, u))}: ${u.men} ${hero ? 'HP' : `men, morale ${u.morale}${u.routing ? ', running' : ''}`}</title>
        <circle cx="${cx}" cy="${cy}" r="${S * 0.72}" class="body"/>
        <text x="${cx}" y="${cy - 2}" class="code">${hero ? '★' : ''}${t.short}</text>
        <text x="${cx}" y="${cy + 11}" class="men">${u.routing ? 'RUN' : u.men}</text>
        <rect x="${cx - 14}" y="${cy + 15}" width="28" height="3" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 15}" width="${(28 * frac).toFixed(1)}" height="3" class="hp"/>
        ${hero ? '' : `<rect x="${cx - 14}" y="${cy + 19}" width="28" height="2" class="hp-bg"/>
        <rect x="${cx - 14}" y="${cy + 19}" width="${(28 * morale).toFixed(1)}" height="2" class="morale${u.morale < 40 ? ' low' : ''}"/>`}
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
    <h1>Battle at ${esc(nodeName(state, b.at))}</h1>
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
    <section class="field-wrap"><svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" class="field">${hexes}${units}</svg></section>
    <aside class="side">
      ${b.outcome ? renderOutcome(b) : sel ? renderUnit(b, sel, ui) : '<p class="hint">Click one of your units (blue), then a highlighted hex to move or a red-ringed enemy to attack. Each unit may move, then attack, once a turn. Heroes (★) can cast spells instead of attacking.</p>'}
      <p class="sub">The thin bar under each troop is its morale. Below ${ROUT_AT} it breaks and runs for its own edge of the field; at ${RALLY_AT} it may rally.</p>
      <p class="sub">${me === 'defender' && b.walls ? 'You fight behind town walls: +1 defense. ' : me === 'attacker' && b.walls ? 'The enemy is behind walls: +1 defense. ' : ''}Forest ♣ and hills ▲ cost 2 to enter and give +1 defense.</p>
      <details class="log" open><summary>Battle report</summary><ul>${b.log.slice(-14).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>
    </aside>
  </main>`;
}

function renderUnit(b: Battle, u: BattleUnit, ui: UIState): string {
  const t = UNIT_TYPES[u.type];
  const spells = knownSpells(u);
  const title = t.hero ? `★ ${esc(u.name ?? t.name)} <small>${t.name}, Lv ${heroLevel(u.xp)}</small>` : `${esc(t.name)}${level(u.xp) ? ` <small>Lv ${level(u.xp)}</small>` : ''}`;
  const spellButtons = spells
    .map((id) => {
      const sp = SPELLS[id];
      const usable = spellTargets(b, u, id).length > 0;
      return `<button data-action="spell" data-spell="${id}" class="${ui.battleSpell === id ? 'primary' : ''}" ${usable ? '' : 'disabled'}
        title="${esc(sp.text)} Range ${sp.range}.">${sp.name} <span>${sp.cost} mana</span></button>`;
    })
    .join('');
  return `<h2>${title}</h2>
    <dl class="stats">
      <dt>${t.hero ? 'Health' : 'Men'}</dt><dd>${u.men} / ${u.maxMen}</dd>
      ${t.hero ? `<dt>Leadership</dt><dd>+${t.hero.leadership} morale to the army</dd>` : `<dt>Morale</dt><dd>${u.morale}${u.routing ? ' (running)' : ''}</dd>`}
      <dt>Attack</dt><dd>${attackOf(u).toFixed(1)}</dd>
      <dt>Defense</dt><dd>${defenseOf(b, u)}</dd>
      <dt>Move</dt><dd>${u.moved ? 'done' : t.move}</dd>
      ${t.range > 1 ? `<dt>Range</dt><dd>${t.range} (not when an enemy is next to it)</dd>` : ''}
      ${spells.length ? `<dt>Mana</dt><dd>${u.mana}</dd>` : ''}
    </dl>
    ${spells.length ? `<div class="spells">${spellButtons}</div>
      <p class="sub">${ui.battleSpell ? `Click a ${SPELLS[ui.battleSpell].target === 'friend' ? 'green-ringed friend' : 'red-ringed enemy'} to cast ${SPELLS[ui.battleSpell].name}.` : 'Pick a spell, then a target.'}</p>` : ''}`;
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
