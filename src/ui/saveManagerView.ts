import { getCampaign } from '../content';
import { dateLabel } from '../game/campaign';
import { MANUAL_SLOTS, readManualSlot, readRecovery, type SavedPosition } from '../game/saveSlots';
import type { SaveStorage } from '../game/saves';
import { esc } from './shared';

function description(save: SavedPosition): string {
  const name = getCampaign(save.state.campaignId).name;
  return `${esc(name)} · ${esc(dateLabel(save.state.turn))} · ${esc(new Date(save.savedAt).toLocaleString())}`;
}

export function renderSaveManager(storage: SaveStorage, hasGame: boolean): string {
  const slots = Array.from({ length: MANUAL_SLOTS }, (_, index) => {
    const number = index + 1;
    const result = readManualSlot(storage, number);
    const ready = result.status === 'ready' ? result.save : null;
    return `<li class="save-slot">
      <h2>Slot ${number}</h2>
      <p class="sub">${ready ? description(ready) : result.status === 'invalid' ? 'Unreadable save. It has not been changed.' : 'Empty'}</p>
      <label for="save-label-${number}">Name for slot ${number}</label>
      <input id="save-label-${number}" maxlength="60" value="${ready ? esc(ready.label) : ''}" placeholder="Slot ${number}" ${hasGame ? '' : 'disabled'}>
      <div class="save-actions">
        <button data-action="save-slot" data-slot="${number}" ${hasGame ? '' : 'disabled'}>${ready || result.status === 'invalid' ? 'Overwrite' : 'Save here'}</button>
        <button data-action="restore-slot" data-slot="${number}" ${ready ? '' : 'disabled'}>Load</button>
      </div>
    </li>`;
  }).join('');
  const recovery = readRecovery(storage);
  const history = recovery.slots.map((entry, index) => `<li class="save-recovery-row">
    <span><b>${esc(entry.reason)}</b> · ${description(entry)}</span>
    <button data-action="restore-recovery" data-slot="${index}">Load</button>
  </li>`).join('');
  return `<main class="save-manager" aria-labelledby="saves-title">
    <h1 id="saves-title" tabindex="-1">Saved games</h1>
    <p>Three manual slots keep the positions you choose. Recovery keeps the last three different positions before a month, quest choice or campaign replacement. The current game also autosaves after each action.</p>
    <p class="sub">Saves live in this browser. Use Export save above for a copy you can keep elsewhere.</p>
    <ul class="save-slots">${slots}</ul>
    <h2>Recovery positions</h2>
    ${recovery.invalid ? `<p role="alert">Recovery history is unreadable. It has been preserved. Export your current game before clearing it.</p>
      <button data-action="clear-recovery">Clear unreadable recovery history</button>` :
      history ? `<ul class="save-recovery">${history}</ul>` : '<p class="hint">No recovery positions yet.</p>'}
  </main>`;
}
