import './style.css';
import { attack, attackTargets, autoResolve, moveUnit, playerEndTurn, playerSide, reachable, retreat, unitAt } from './game/battle';
import { applyBattle, armyAt, endTurn, moveTroops, newGame, recruit, setTax } from './game/campaign';
import { hexKey } from './game/hex';
import type { GameState } from './game/types';
import { renderBattle, selectedUnit } from './ui/battleView';
import { moveTargets, renderCampaign } from './ui/campaignView';
import type { UIState } from './ui/shared';

const SAVE_KEY = 'aragon-save-v1';

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? (JSON.parse(raw) as GameState) : null;
    return s?.version === 1 ? s : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Saving is a convenience; the game still runs without it.
  }
}

let state: GameState = load() ?? newGame();
const ui: UIState = { selected: 'aldenhold', checked: new Set(), battleUnit: null, message: '' };
selectNode(ui.selected!);

const app = document.getElementById('app')!;

function render() {
  app.innerHTML = state.battle ? renderBattle(state, ui) : renderCampaign(state, ui);
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
        selectNode('aldenhold');
      }
      break;
    case 'end-turn':
      endTurn(state);
      if (ui.selected) selectNode(ui.selected);
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
      if (ui.selected) selectNode(ui.selected);
      break;
  }
}

function onHex(col: number, row: number) {
  const b = state.battle!;
  if (b.outcome || b.active !== playerSide(b)) return;
  const clicked = unitAt(b, { col, row });
  if (clicked && clicked.side === b.active) {
    ui.battleUnit = clicked.id;
    return;
  }
  const sel = selectedUnit(b, ui);
  if (!sel) return;
  if (clicked && attackTargets(b, sel).includes(clicked)) attack(b, sel.id, clicked.id);
  else if (!clicked && reachable(b, sel).has(hexKey({ col, row }))) moveUnit(b, sel.id, { col, row });
}

app.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement | SVGElement>('[data-action]');
  if (!el) return;
  onAction(el.dataset.action!, el.dataset);
  save();
  render();
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
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
