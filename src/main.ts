import './style.css';
import {
  attack, attackTargets, autoResolve, castSpell, moveUnit, playerEndTurn, playerSide, reachable, retreat, spellTargets, teleportDestinations, unitAt,
} from './game/battle';
import { applyBattle, armyAt, campaignOf, endTurn, hireHero, moveTroops, newGame, recruit, setTax } from './game/campaign';
import { townLocation } from './game/world';
import { hexKey } from './game/hex';
import type { CampaignId, GameState, SpellId } from './game/types';
import { renderBattle, selectedUnit } from './ui/battleView';
import { moveTargets, plannedRoute, renderCampaign } from './ui/campaignView';
import { esc, type UIState } from './ui/shared';
import { loadGame, MAX_SAVE_BYTES, parseSave, saveGame } from './game/saves';
import { CATALOG } from './content';
import { chooseQuest } from './game/quests';
import { discardItem, equipItem, sellItem, unequipItem, useItem } from './game/items';
import { buyItem } from './game/merchants';
import type { HeroSlot } from './game/types';
import { questFocus } from './ui/questNavigation';
import { buildCity, BUILDINGS } from './game/cities';
import { beginRefit, EQUIPMENT } from './game/equipment';
import { log } from './game/campaign';
import type { BuildingId, EquipmentId } from './game/types';
import { validateContent } from './content/validate';
import { captureRecovery, clearRecovery, readManualSlot, readRecovery, writeManualSlot } from './game/saveSlots';
import { questQuote } from './game/quests';
import { renderSaveManager } from './ui/saveManagerView';

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
let hasGame = loaded.state !== null;
let savesOpen = false;
let recoveryWarning = '';

function save() {
  if (autosaveBlocked || !hasGame) return;
  saveWarning = saveGame(storage, state) ?? '';
}

function checkpoint(reason: Parameters<typeof captureRecovery>[2]): boolean {
  if (!hasGame) return true;
  recoveryWarning = captureRecovery(storage, state, reason) ?? '';
  return !recoveryWarning || confirm(`${recoveryWarning} Continue without a local recovery position?`);
}

function activate(next: GameState) {
  state = next;
  hasGame = true;
  autosaveBlocked = false;
  saveWarning = '';
  savesOpen = false;
  ui.choosing = false;
  ui.battleUnit = null;
  ui.battleSpell = null;
  ui.battleTarget = null;
  ui.battleDestination = null;
  ui.message = '';
  ui.view = 'map';
  ui.routeOrigin = null;
  ui.routeDestination = null;
  selectNode(capitalOf(state));
}

function exportSave() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `aragon-month-${state.turn}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ui: UIState = {
  selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map',
  // With no saved game, open on the campaign chooser.
  choosing: !loaded.state && !loaded.blocked,
};
selectNode(capitalOf(state));

/** Where the map opens: the campaign's capital. */
function capitalOf(s: GameState): string {
  return townLocation(s, campaignOf(s).capital);
}

const app = document.getElementById('app')!;

function render() {
  app.innerHTML = `<nav class="save-bar" aria-label="Saved games">
    <button data-action="saved-games" aria-expanded="${savesOpen}" aria-controls="save-content">${savesOpen ? 'Back to game' : 'Saved games'}</button>
    <button data-action="export-save" ${hasGame ? '' : 'disabled'}>Export save</button>
    <button data-action="import-save">Import save</button>
    <input id="save-file" type="file" accept=".json,application/json" hidden>
    ${saveWarning ? `<p class="msg" role="alert">${esc(saveWarning)}</p>` : ''}
    ${recoveryWarning ? `<p class="msg" role="alert">${esc(recoveryWarning)}</p>` : ''}
    </nav><div id="save-content">${savesOpen ? renderSaveManager(storage, hasGame) :
    state.battle ? renderBattle(state, ui) : renderCampaign(state, ui)}</div>`;
}

function selectNode(id: string) {
  ui.selected = id;
  const army = armyAt(state, id, 'player');
  ui.checked = new Set(army?.troops.filter((t) => t.mp > 0 && !t.refit).map((t) => t.id) ?? []);
}

function onAction(action: string, data: DOMStringMap) {
  ui.message = '';
  switch (action) {
    case 'new-game':
      ui.choosing = true;
      break;
    case 'cancel-choose':
      ui.choosing = false;
      break;
    case 'start-campaign':
      if (!checkpoint('Before new campaign')) break;
      activate(newGame(undefined, data.campaign as CampaignId));
      break;
    case 'plan-route':
      ui.routeOrigin = ui.selected;
      ui.routeDestination = null;
      ui.routePreference = 'shortest';
      break;
    case 'locate-army':
      if (data.node && armyAt(state, data.node, 'player')) selectNode(data.node);
      break;
    case 'route-clear':
      ui.routeOrigin = null;
      ui.routeDestination = null;
      break;
    case 'route-preference':
      if (data.preference === 'shortest' || data.preference === 'safer') ui.routePreference = data.preference;
      break;
    case 'route-first-leg': {
      const route = plannedRoute(state, ui);
      if (!route || route.stops.length < 2 || !ui.routeOrigin || ui.selected !== ui.routeOrigin ||
        !moveTargets(state, ui).has(route.stops[1].id)) {
        ui.message = 'Select ready troops at the departure city before marching.';
        break;
      }
      const firstLeg = route.stops[1].id;
      ui.message = moveTroops(state, ui.routeOrigin, [...ui.checked], firstLeg) ?? '';
      if (!ui.message) {
        ui.routeOrigin = null;
        ui.routeDestination = null;
        selectNode(firstLeg);
      }
      break;
    }
    case 'map-layer':
      if (data.layer === 'terrain' || data.layer === 'political') ui.mapLayer = data.layer;
      break;
    case 'map-zoom':
      ui.mapZoom = Math.max(1, Math.min(2, (ui.mapZoom ?? 1) + (data.zoom === 'in' ? 0.5 : -0.5)));
      break;
    case 'view-quest': {
      const destination = questFocus(state, data.quest ?? '');
      if (destination) {
        ui.view = 'map';
        selectNode(destination);
      }
      break;
    }
    case 'quest-choice':
      if (!questQuote(state, data.quest ?? '', data.choice ?? '').reason && !checkpoint('Before quest choice')) break;
      ui.message = chooseQuest(state, data.quest ?? '', data.choice ?? '') ?? '';
      break;
    case 'buy-item':
      ui.message = buyItem(state, data.merchant ?? '', data.item ?? '') ?? '';
      break;
    case 'use-item':
      ui.message = useItem(state, data.item ?? '', Number(data.troop)) ?? '';
      break;
    case 'equip-item':
      ui.message = equipItem(state, data.item ?? '', Number(data.troop)) ?? '';
      break;
    case 'unequip-item':
      ui.message = unequipItem(state, Number(data.troop), (data.slot ?? '') as HeroSlot) ?? '';
      break;
    case 'sell-item':
      ui.message = sellItem(state, data.item ?? '') ?? '';
      break;
    case 'discard-item':
      ui.message = discardItem(state, data.item ?? '') ?? '';
      break;
    case 'refit': {
      const item = data.item as EquipmentId;
      if (!Object.hasOwn(EQUIPMENT, item)) { ui.message = 'Unknown equipment.'; break; }
      const err = beginRefit(state, data.node!, Number(data.troop), item);
      ui.message = err ?? 'Refit purchased. The new gear becomes available next month.';
      if (!err) log(state, `A formation begins refitting with ${EQUIPMENT[item].name}.`);
      break;
    }
    case 'construct': {
      const kind = data.kind as BuildingId;
      if (!Object.hasOwn(BUILDINGS, kind)) { ui.message = 'Unknown building.'; break; }
      const error = buildCity(state, data.node!, kind);
      ui.message = error ?? 'Construction started and paid for. It will finish at month-end.';
      if (!error) log(state, `Construction begins in ${data.node}: ${BUILDINGS[kind].name}.`);
      break;
    }
    case 'end-turn':
      if (state.status === 'playing' && !state.battle && !checkpoint('Before month')) break;
      endTurn(state);
      if (ui.selected) selectNode(ui.selected);
      break;
    case 'hire': {
      const offer = state.offers[Number(data.offer)];
      ui.message = offer ? hireHero(state, offer) ?? '' : 'That offer is gone.';
      if (ui.selected) selectNode(ui.selected);
      break;
    }
    case 'treasury':
      ui.view = ui.view === 'treasury' ? 'map' : 'treasury';
      break;
    case 'journal':
      ui.view = ui.view === 'journal' ? 'map' : 'journal';
      break;
    case 'goto':
      ui.view = 'map';
      selectNode(data.node!);
      break;
    case 'spell':
      ui.battleSpell = ui.battleSpell === data.spell ? null : (data.spell as SpellId);
      ui.battleTarget = null;
      ui.battleDestination = null;
      break;
    case 'spell-confirm': {
      const b = state.battle;
      const selected = b ? selectedUnit(b, ui) : undefined;
      if (b && selected && ui.battleSpell && ui.battleTarget != null) {
        if (castSpell(b, selected.id, ui.battleSpell, ui.battleTarget, ui.battleDestination ?? undefined)) {
          ui.battleSpell = null; ui.battleTarget = null; ui.battleDestination = null;
        }
      }
      break;
    }
    case 'recruit':
      ui.message = recruit(state, data.node!, data.type!) ?? '';
      break;
    case 'node': {
      const id = data.node!;
      if (ui.routeOrigin && !ui.routeDestination) {
        if (id !== ui.routeOrigin) ui.routeDestination = id;
        break;
      }
      if (ui.selected && moveTargets(state, ui).has(id)) {
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
  if (sel && ui.battleSpell) {
    if (clicked && clicked.id === ui.battleTarget && ui.battleSpell !== 'teleport') {
      // Clicking the chosen target a second time casts, the same as the Cast button.
      if (castSpell(b, sel.id, ui.battleSpell, clicked.id)) {
        ui.battleSpell = null; ui.battleTarget = null; ui.battleDestination = null;
      }
    } else if (clicked && spellTargets(b, sel, ui.battleSpell).includes(clicked)) {
      ui.battleTarget = clicked.id; ui.battleDestination = null;
    } else if (ui.battleSpell === 'teleport' && ui.battleTarget != null) {
      const target = b.units.find((u) => u.id === ui.battleTarget);
      if (target && teleportDestinations(b, sel, target).some((h) => h.col === col && h.row === row)) ui.battleDestination = { col, row };
    }
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
  if (el.dataset.action === 'saved-games') {
    savesOpen = !savesOpen;
    render();
    (savesOpen ? app.querySelector<HTMLElement>('#saves-title') : app.querySelector<HTMLElement>('[data-action="saved-games"]'))?.focus();
    return;
  }
  if (el.dataset.action === 'export-save') { exportSave(); return; }
  if (el.dataset.action === 'import-save') { document.getElementById('save-file')!.click(); return; }
  if (el.dataset.action === 'save-slot') {
    const slot = Number(el.dataset.slot);
    const existing = readManualSlot(storage, slot);
    if (hasGame && (existing.status === 'empty' || confirm(`Overwrite Slot ${slot}?`))) {
      const label = (app.querySelector<HTMLInputElement>(`#save-label-${slot}`)?.value ?? '').trim();
      saveWarning = writeManualSlot(storage, slot, state, label) ?? '';
    }
    render();
    app.querySelector<HTMLElement>(`[data-action="save-slot"][data-slot="${slot}"]`)?.focus();
    return;
  }
  if (el.dataset.action === 'restore-slot' || el.dataset.action === 'restore-recovery') {
    const slot = Number(el.dataset.slot);
    const saved = el.dataset.action === 'restore-slot' ? readManualSlot(storage, slot) :
      (() => { const history = readRecovery(storage); const entry = history.slots[slot];
        return !history.invalid && entry ? { status: 'ready' as const, save: entry } : { status: 'invalid' as const }; })();
    if (saved.status !== 'ready') saveWarning = 'That position could not be loaded. Your current game was not changed.';
    else if ((!hasGame || confirm(`Replace your current game with ${saved.save.label || 'this position'}?`)) && checkpoint('Before restore')) {
      activate(saved.save.state);
      save();
    }
    render();
    return;
  }
  if (el.dataset.action === 'clear-recovery') {
    if (confirm('Permanently clear the unreadable recovery history? Your manual slots and current game will remain.')) {
      saveWarning = clearRecovery(storage) ?? '';
      if (!saveWarning) recoveryWarning = '';
    }
    render();
    return;
  }
  onAction(el.dataset.action!, el.dataset);
  save();
  render();
});

// SVG location groups are keyboard-operable, not mouse-only.
app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const site = target.closest<SVGElement>('.atlas-site[data-action="node"]');
  if (!site) return;
  e.preventDefault();
  onAction('node', site.dataset);
  save();
  render();
  // Keep keyboard focus on the selected location after replacing the SVG.
  const id = site.dataset.node;
  const replacement = [...app.querySelectorAll<SVGElement>('.atlas-site[data-node]')]
    .find((candidate) => candidate.dataset.node === id);
  replacement?.focus();
});

app.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id.startsWith('save-label-')) return;
  if (el.id === 'save-file' && el instanceof HTMLInputElement) {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error('Save files must be 5 MB or smaller.');
      const imported = parseSave(await file.text());
      if (!confirm('Replace your current game with this imported save?')) return;
      if (!checkpoint('Before import')) {
        saveWarning = recoveryWarning;
        render();
        return;
      }
      activate(imported);
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
