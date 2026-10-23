import { marchQuote, nodeName } from '../game/campaign';
import { siegeQuote } from '../game/sieges';
import { townAt } from '../game/world';
import type { GameState } from '../game/types';
import type { UIState } from './shared';
import { esc } from './shared';

/** A decision is only offered for a march that would meet a defending army inside a hostile settlement. */
export function cityAssault(state: GameState, from: string, to: string, troopIds: number[]): UIState['assault'] {
  const town = townAt(state, to);
  if (!town || town.owner === 'player' || town.kind === 'lair') return null;
  const quote = marchQuote(state, from, troopIds, to);
  if (quote.reason || quote.ends !== 'battle' || !state.armies.some((a) => a.at === to && a.owner === town.owner)) return null;
  return { from, to, troopIds: quote.troopIds };
}

export function renderCityAssault(state: GameState, decision: NonNullable<UIState['assault']>): string {
  const town = townAt(state, decision.to);
  const defenders = state.armies.filter((a) => a.at === decision.to && a.owner === town?.owner);
  const formations = defenders.flatMap((a) => a.troops).filter((t) => t.men > 0);
  const men = formations.reduce((n, t) => n + t.men, 0);
  const name = esc(nodeName(state, decision.to));
  const quote = marchQuote(state, decision.from, decision.troopIds, decision.to);
  const siege = siegeQuote(state, decision.from, decision.to);
  return `<div class="assault-shade"><section class="assault-prompt" role="dialog" aria-modal="true" aria-labelledby="assault-title">
    <h2 id="assault-title">${name} is defended</h2>
    <p>${name} has <b>${formations.length} defending formation${formations.length === 1 ? '' : 's'}</b> (${men} soldiers and hero HP combined). Its defenders fight behind town walls.</p>
    <p class="sub">Attack marches ${decision.troopIds.length} selected formation${decision.troopIds.length === 1 ? '' : 's'} from ${esc(nodeName(state, decision.from))}, spending ${quote.cost} movement, and starts a battle. Retreat keeps your army where it is without spending movement.</p>
    <div class="assault-actions">
      <button data-action="assault-attack" class="primary" ${quote.reason ? 'disabled' : ''}>Attack</button>
      <button data-action="assault-retreat">Retreat</button>
      <button data-action="assault-besiege" ${siege.reason ? `disabled title="${esc(siege.reason)}"` : ''}>Besiege</button>
    </div>
    <p class="sub">${siege.reason ? `Besiege: ${esc(siege.reason)}` : `Besiege: your whole army at ${esc(nodeName(state, decision.from))} camps beside the walls. Each month it wears down the walls, supplies and morale; you can storm, hold or lift the siege at any time.`}</p>
    ${quote.reason ? `<p class="msg">${esc(quote.reason)} Retreat and choose another approach.</p>` : ''}
  </section></div>`;
}
