import { dateLabel, nodeName } from '../game/campaign';
import type { DeedKind, GameState, JournalEntry } from '../game/types';
import { esc } from './shared';
import { FENWICK_CHARTER } from '../content/quests';
import { ITEMS } from '../content/items';
import { questSummary } from '../game/quests';

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
    <section class="quest-ledger"><h2>Quests</h2>
      <p><b>${esc(FENWICK_CHARTER.name)}</b> — ${esc(questSummary(state))}.
      <button class="link" data-action="goto" data-node="fenwick">View Fenwick</button></p>
    </section>
    <section class="quest-ledger"><h2>Inventory</h2>
      ${state.items.length ? `<ul>${state.items.map((id) => {
        const item = ITEMS[id];
        return `<li><b>${esc(item.name)}</b> — ${esc(item.rules)}</li>`;
      }).join('')}</ul>` : '<p class="sub">No campaign objects acquired yet.</p>'}
    </section>
    ${sections || '<p class="hint">Nothing recorded yet.</p>'}
  </main>`;
}
