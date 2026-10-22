import { questOutcome, heroGuide } from './gameplayFeedback';
import { dateLabel, nodeName, startLocation } from '../game/campaign';
import type { DeedKind, GameState, JournalEntry } from '../game/types';
import { esc } from './shared';
import { LAIRS, SPECIES } from '../content/lairs';
import { raidLine } from '../game/raids';
import { UNIT_TYPES } from '../game/data';
import { ITEMS } from '../content/items';
import { isResolved, campaignQuests, questSummary, trackedQuests } from '../game/quests';
import { townLocation } from '../game/world';
import { discardQuote, equipQuote, heldQty, sellQuote, useQuote } from '../game/items';
import { isHero } from '../game/units';
import { questSites } from './questNavigation';

const KIND_LABEL: Record<DeedKind, string> = {
  story: 'Story',
  battle: 'Battle',
  capture: 'Taken',
  loss: 'Loss',
  hero: 'Heroes',
  realm: 'Realm',
  ending: 'Ending',
  earlier: 'Earlier',
};

function entry(state: GameState, j: JournalEntry): string {
  const month = dateLabel(j.turn).split(',')[0];
  const place = j.place
    ? ` <button class="link" data-action="goto" data-node="${j.place}" title="Show on the map">${esc(nodeName(state, j.place))}</button>`
    : '';
  return `<li class="deed kind-${j.kind}"><span class="when">${month}</span><span class="tag">${KIND_LABEL[j.kind]}</span>
    <span class="what">${esc(j.text)}${place}</span></li>`;
}

/** Every raid that came due, newest first, with what it cost: the realm's raid history. */
function renderRaidLog(state: GameState): string {
  if (!state.raidLog.length) return '';
  const rows = [...state.raidLog].reverse().map((r) => `<li><b>${esc(nodeName(state, r.target))}</b>, ${esc(state.lairs[r.lair]?.discovered ? LAIRS[r.lair].name : `${SPECIES[LAIRS[r.lair].species].name.toLowerCase()} from an unknown lair`)}: ${esc(raidLine(r))}</li>`).join('');
  return `<section class="quest-ledger raid-log"><h2>Raids</h2><ul>${rows}</ul></section>`;
}

/** The permanent campaign journal (BASE-04): every deed of the game, newest year first. */
export function renderJournal(state: GameState): string {
  const count = (kind: DeedKind) => state.journal.filter((j) => j.kind === kind).length;
  const years = new Map<number, JournalEntry[]>();
  for (const j of state.journal) {
    const year = Math.floor((j.turn - 1) / 12) + 1;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(j);
  }
  const sections = [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => `<section class="year"><h2>Year ${year}</h2><ol>${[...list].reverse().map((j) => entry(state, j)).join('')}</ol></section>`)
    .join('');
  return `<main class="journal">
    <div class="journal-head">
      <h1>Journal</h1>
      <p class="sub">Everything that shaped your reign, kept for the whole campaign. The chronicle on the map only shows recent news.</p>
      <dl class="tally">
        <div><dt>Towns taken</dt><dd>${count('capture')}</dd></div>
        <div><dt>Battles</dt><dd>${count('battle')}</dd></div>
        <div><dt>Losses</dt><dd>${count('loss')}</dd></div>
        <div><dt>Hero deeds</dt><dd>${count('hero')}</dd></div>
      </dl>
    </div>
    ${renderQuestLedger(state)}<section><h2>Your heroes</h2>${state.armies.filter(a=>a.owner==='player').flatMap(a=>a.troops.filter(t=>isHero(t.type))).map(t=>'<details><summary>'+esc(t.name??UNIT_TYPES[t.type].name)+' · how to use this hero</summary>'+heroGuide(state,t.id)+'</details>').join('')}</section>
    ${renderRaidLog(state)}
    ${renderInventory(state)}
    ${sections || '<p class="hint">Nothing recorded yet.</p>'}
  </main>`;
}

/** Quests grouped into main objectives and side quests, with what actually happened and a link to the place. */
function renderQuestLedger(state: GameState): string {
  const quests = campaignQuests(state).filter((def) => state.quests[def.id].status !== 'unavailable');
  const tracked = new Set(trackedQuests(state).map((d) => d.id));
  const group = (kind: 'main' | 'side', title: string) => {
    const list = quests.filter((d) => d.kind === kind);
    if (!list.length) return '';
    return `<h3>${title}</h3><ul>${list.map((def) => `<li><b>${esc(def.name)}</b>${tracked.has(def.id) ? ' <small class="tag">Tracked</small>' : ''}: ${esc(questSummary(state, def.id))}.
      <button class="link" data-action="goto" data-node="${townLocation(state, def.at)}">View ${esc(nodeName(state, def.at))}</button>
      ${questSites(state, def.id).filter((site) => site !== def.at).map((site) => `<button class="link" data-action="goto" data-node="${startLocation(state, site)}">Show ${esc(nodeName(state, site))}</button>`).join(' ')}${isResolved(state.quests[def.id]) ? '<details><summary>Rewards and consequences</summary>'+questOutcome(state,def.id)+'</details>' : ''}</li>`).join('')}</ul>`;
  };
  return `<section class="quest-ledger"><h2>Quests</h2>
    ${quests.length ? group('main', 'Main objectives') + group('side', 'Side quests') : '<p class="sub">No quests offered yet.</p>'}
  </section>`;
}

const ITEM_KIND: Record<string, string> = { relic: 'Relic', equipment: 'Equipment', consumable: 'Consumable', evidence: 'Evidence' };

/** Held objects with what they do and the actions their policy allows; archived evidence below them. */
function renderInventory(state: GameState): string {
  const held = Object.keys(state.items).filter((id) => heldQty(state, id) > 0);
  const archived = Object.keys(state.items).filter((id) => state.items[id].archived);
  const heroes = state.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops.filter((t) => isHero(t.type)));
  const button = (action: string, id: string, label: string, reason: string | null, extra = '') =>
    `<button class="ghost" data-action="${action}" data-item="${id}"${extra} ${reason ? `disabled title="${esc(reason)}"` : ''}>${esc(label)}</button>`;
  const rows = held.map((id) => {
    const item = ITEMS[id];
    const qty = heldQty(state, id);
    const actions: string[] = [];
    if (item.equip) {
      for (const hero of heroes) {
        const q = equipQuote(state, id, hero.id);
        if (item.equip.heroes && !item.equip.heroes.includes(hero.type)) continue;
        const swap = q.replaces ? ` (swaps out the ${ITEMS[q.replaces].name})` : '';
        actions.push(button('equip-item', id, `Give to ${hero.name ?? 'hero'}${swap}`, q.reason, ` data-troop="${hero.id}"`));
      }
    }
    if (item.use) {
      for (const hero of heroes) {
        const q = useQuote(state, id, hero.id);
        const gain = [q.hp ? `+${q.hp} HP` : '', q.mana ? `+${q.mana} mana` : ''].filter(Boolean).join(', ');
        actions.push(button('use-item', id, `Give to ${hero.name ?? 'hero'}${gain ? ` (${gain})` : ''}`, q.reason, ` data-troop="${hero.id}"`));
      }
    }
    if (item.policy.sell) {
      const q = sellQuote(state, id);
      actions.push(button('sell-item', id, `Sell · ${q.gold}g`, q.reason));
    }
    if (item.policy.discard) actions.push(button('discard-item', id, 'Throw away', discardQuote(state, id).reason));
    return `<li><b>${esc(item.name)}</b>${qty > 1 ? ` ×${qty}` : ''} <small class="tag">${ITEM_KIND[item.kind]}</small> — ${esc(item.rules)}
      ${actions.length ? `<div class="quest-actions">${actions.join('')}</div>` : ''}</li>`;
  }).join('');
  const archive = archived.length ? `<h3>Archived evidence</h3><ul>${archived.map((id) =>
    `<li><b>${esc(ITEMS[id].name)}</b> <small class="sub">presented and kept on record</small></li>`).join('')}</ul>` : '';
  return `<section class="quest-ledger"><h2>Inventory</h2>
    ${rows ? `<ul>${rows}</ul>` : '<p class="sub">No campaign objects held.</p>'}${archive}
  </section>`;
}
