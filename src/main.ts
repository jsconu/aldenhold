import './style.css';
import {
  attack, attackTargets, autoResolve, castSpell, moveUnit, playerEndTurn, playerSide, reachable, retreat, spellTargets, unitAt,
} from './game/battle';
import { applyBattle, armyAt, endTurn, hireHero, moveTroops, newGame, recruit, setTax } from './game/campaign';
import { hexKey } from './game/hex';
import type { SpellId } from './game/types';
import { renderBattle, selectedUnit } from './ui/battleView';
import { moveTargets, renderCampaign } from './ui/campaignView';
import { esc, type UIState } from './ui/shared';
import { loadGame, MAX_SAVE_BYTES, parseSave, saveGame } from './game/saves';
import { CATALOG } from './content';
import { decideFenwickCharter } from './game/quests';
import { validateContent } from './content/validate';

// Access localStorage inside the adapter: even reading the browser property can throw.
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
// Content mistakes should fail loudly while developing, not surface mid-campaign.
if (import.meta.env.DEV) {
  const problems = validateContent(CATALOG);
  if (problems.length) console.error(`Content problems:\n${problems.join('\n')}`);
}

const loaded = loadGame(storage);
let saveWarning = loaded.warning;
let autosaveBlocked = loaded.blocked;
let state = loaded.state ?? newGame();

function save() {
  if (autosaveBlocked) return;
  saveWarning = saveGame(storage, state) ?? '';
}

function exportSave() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `aragon-month-${state.turn}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ui: UIState = { selected: 'aldenhold', checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
selectNode(ui.selected!);

const app = document.getElementById('app')!;

function render() {
  app.innerHTML = `<nav class="save-bar" aria-label="Saved games">
    <button data-action="export-save">Export save</button>
    <button data-action="import-save">Import save</button>
    <input id="save-file" type="file" accept=".json,application/json" hidden>
    ${saveWarning ? `<p class="msg" role="alert">${esc(saveWarning)}</p>` : ''}
    </nav>` + (state.battle ? renderBattle(state, ui) : renderCampaign(state, ui));
}

function selectNode(id: string) {
  ui.selected = id;
  const army = armyAt(state, id, 'player');
  ui.checked = new Set(army?.troops.filter((t) => !t.moved).map((t) => t.id) ?? []);
}

function onAction(action: string, data: DOMStringMap) {
  ui.message = '';
  switch (action) {
    case 'new-game':
      if (state.status !== 'playing' || confirm('Start a new game? Your current game will be lost.')) {
        state = newGame();
        autosaveBlocked = false;
        saveWarning = '';
        ui.battleUnit = null;
        ui.battleSpell = null;
        ui.view = 'map';
        selectNode('aldenhold');
      }
      break;
    case 'fenwick-sign':
      ui.message = decideFenwickCharter(state, 'sign') ?? '';
      break;
    case 'fenwick-decline':
      ui.message = decideFenwickCharter(state, 'decline') ?? '';
      break;
    case 'end-turn':
      endTurn(state);
      if (ui.selected) selectNode(ui.selected);
      break;
    case 'hire': {
      const offer = state.offers[Number(data.offer)];
      ui.message = offer ? hireHero(state, offer) ?? '' : 'That offer is gone.';
      if (ui.selected) selectNode(ui.selected);
      break;
    }
    case 'journal':
      ui.view = ui.view === 'journal' ? 'map' : 'journal';
      break;
    case 'goto':
      ui.view = 'map';
      selectNode(data.node!);
      break;
    case 'spell':
      ui.battleSpell = ui.battleSpell === data.spell ? null : (data.spell as SpellId);
      break;
    case 'recruit':
      ui.message = recruit(state, data.node!, data.type!) ?? '';
      break;
    case 'node': {
      const id = data.node!;
      if (ui.selected && moveTargets(state, ui).includes(id)) {
        const err = moveTroops(state, ui.selected, [...ui.checked], id);
        ui.message = err ?? '';
        if (!err) selectNode(id);
      } else {
        selectNode(id);
      }
      break;
    }
    case 'hex':
      onHex(Number(data.col), Number(data.row));
      break;
    case 'battle-end':
      playerEndTurn(state.battle!);
      ui.battleUnit = null;
      ui.battleSpell = null;
      break;
    case 'battle-auto':
      autoResolve(state.battle!);
      break;
    case 'battle-retreat':
      retreat(state.battle!, playerSide(state.battle!)!);
      break;
    case 'battle-continue':
      applyBattle(state, state.battle!);
      ui.battleUnit = null;
      ui.battleSpell = null;
      if (ui.selected) selectNode(ui.selected);
      break;
  }
}

function onHex(col: number, row: number) {
  const b = state.battle!;
  if (b.outcome || b.active !== playerSide(b)) return;
  const clicked = unitAt(b, { col, row });
  const sel = selectedUnit(b, ui);
  if (sel && ui.battleSpell && clicked && spellTargets(b, sel, ui.battleSpell).includes(clicked)) {
    castSpell(b, sel.id, ui.battleSpell, clicked.id);
    ui.battleSpell = null;
    return;
  }
  if (clicked && clicked.side === b.active) {
    if (clicked.id !== ui.battleUnit) ui.battleSpell = null;
    ui.battleUnit = clicked.id;
    return;
  }
  ui.battleSpell = null;
  if (!sel) return;
  if (clicked && attackTargets(b, sel).includes(clicked)) attack(b, sel.id, clicked.id);
  else if (!clicked && reachable(b, sel).has(hexKey({ col, row }))) moveUnit(b, sel.id, { col, row });
}

app.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement | SVGElement>('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'export-save') { exportSave(); return; }
  if (el.dataset.action === 'import-save') { document.getElementById('save-file')!.click(); return; }
  onAction(el.dataset.action!, el.dataset);
  save();
  render();
});

app.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === 'save-file' && el instanceof HTMLInputElement) {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error('Save files must be 5 MB or smaller.');
      const imported = parseSave(await file.text());
      if (!confirm('Replace your current game with this imported save?')) return;
      state = imported;
      autosaveBlocked = false;
      ui.battleUnit = null;
      ui.battleSpell = null;
      ui.message = '';
      selectNode('aldenhold');
      save();
    } catch {
      saveWarning = 'Import failed: the file is invalid or uses an unsupported version. Your current game and saved progress have not been changed.';
    } finally {
      el.value = '';
    }
    render();
    return;
  }
  if (el.dataset.change === 'tax') setTax(state, el.dataset.node!, Number(el.value));
  if (el.dataset.change === 'check' && el instanceof HTMLInputElement) {
    const id = Number(el.dataset.troop);
    if (el.checked) ui.checked.add(id);
    else ui.checked.delete(id);
  }
  save();
  render();
});

render();
