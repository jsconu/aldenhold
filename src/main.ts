import { pillageCityBuilding, placeCityDefender } from './game/cityBattle';
import {explored} from './game/challenge';
import { bearingFrom } from './game/intel';
import { QUESTS } from './content/quests';
import { infiltrate, stationScout } from './game/intel';
import { build, type Build } from './game/battle';
import { acceptTerms, beginSiege, liftSiege, refuseTerms, siegeOf } from './game/sieges';
import { mapClickIntent } from './ui/mapClick';
import { makeCamp } from './game/weather';
import {recruitReplacements} from './game/replacements';
import { createRulerCampaign, SKIN_TONES } from './game/rulerCreation';
import { feedbackSnapshot, newFeedback, renderFeedback, type GameplayNotice } from './ui/gameplayFeedback';
import './style.css';
import { HEX_ZOOMS, hexZoom } from './ui/hexMapView';
import {
  attackOrder, attackOrderQuote, autoResolve, castSpell, escapeQuote, groupReachable, moveGroup, moveUnit, playerEndTurn, playerSide, reachable, spellTargets, teleportDestinations, tryEscape, unitAt,
} from './game/battle';
import { ARMY_CAP, applyBattle, armyAt, campaignOf, endTurn, hireHero, marchQuote, moveTroops, newGame, nodeName, recruit, setTax } from './game/campaign';
import { UNIT_TYPES } from './game/data';
import { townLocation, townAt } from './game/world';
import { hexKey } from './game/hex';
import type { CampaignId, GameState, SpellId } from './game/types';
import { renderBattle, selectedGroup, selectedUnit } from './ui/battleView';
import { moveTargets, plannedRoute, renderCampaign } from './ui/campaignView';
import { esc, type UIState } from './ui/shared';
import { loadGame, MAX_SAVE_BYTES, parseSave, saveGame } from './game/saves';
import { CATALOG } from './content';
import { chooseQuest } from './game/quests';
import { discardItem, equipItem, sellItem, unequipItem, useItem } from './game/items';
import { buyItem } from './game/merchants';
import type { HeroSlot } from './game/types';
import { questFocus } from './ui/questNavigation';
import { buildCity, dismantleCity, BUILDINGS } from './game/cities';
import { beginRefit, EQUIPMENT } from './game/equipment';
import { log } from './game/campaign';
import type { BuildingId, EquipmentId } from './game/types';
import { validateContent } from './content/validate';
import { captureRecovery, clearRecovery, readManualSlot, readRecovery, writeManualSlot } from './game/saveSlots';
import { enableQuestPacing, questQuote } from './game/quests';
import { renderSaveManager } from './ui/saveManagerView';
import { captureMove, restoreMove, undoBlocked, type MovementUndo } from './ui/movementUndo';
import { cityAssault } from './ui/cityAssault';
import { assignScout } from './game/scouts';

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
if(loaded.state) enableQuestPacing(state);
let hasGame = loaded.state !== null;
let savesOpen = false;
let recoveryWarning = '';
let feedback:GameplayNotice[]=[];
let undoMove: MovementUndo | null = null;
/** Why the move just made can't be undone; shown until the next action. */
let undoRefusal: string | null = null;

/** After a successful move: offer to take it back, unless it had consequences that stand (see undoBlocked). */
function offerUndo(before: MovementUndo) {
  undoRefusal = undoBlocked(before.state, state);
  undoMove = undoRefusal ? null : before;
}

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
  undoMove = null;ui.marchMode=false;ui.townChoice=null;
  feedback=[];
  state = next;
  enableQuestPacing(state);
  hasGame = true;
  autosaveBlocked = false;
  saveWarning = '';
  savesOpen = false;
  ui.choosing = false;
  ui.creatingFor=undefined;
  ui.rulerDraft=undefined;
  ui.assault = null;
  ui.battleUnit = null;
  ui.battleUnits = new Set();
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
  selected: null, checked: new Set(), battleUnit: null, battleUnits: new Set(), battleSpell: null, message: '', view: 'map',
  // With no saved game, open on the campaign chooser.
  choosing: !loaded.state && !loaded.blocked,
};
selectNode(capitalOf(state));

/** Where the map opens: the campaign's capital. */
function capitalOf(s: GameState): string {
  return townLocation(s, campaignOf(s).capital);
}

const app = document.getElementById('app')!;

/** The battlefield's scrolling frame, if a battle is on screen. */
function battleScroll(): HTMLElement | null {
  return app.querySelector<HTMLElement>('.battle-scroll');
}

/** The Western Realm map's scrolling frame, if it is on screen. */
function hexScroll(): HTMLElement | null {
  return app.querySelector<HTMLElement>('.hex-scroll');
}

/** Scroll the map so the selected hex (or failing that, one of your armies) is in the middle. */
function centreHexMap(behavior: ScrollBehavior = 'auto') {
  const frame = hexScroll();
  const target = frame?.querySelector<SVGGraphicsElement>('.overland .selected') ?? frame?.querySelector<SVGGraphicsElement>('.overland .owner-player .army-halo');
  if (!frame || !target) return;
  const box = target.getBoundingClientRect(), view = frame.getBoundingClientRect();
  frame.scrollTo({ left: frame.scrollLeft + box.left + box.width / 2 - view.left - frame.clientWidth / 2, top: frame.scrollTop + box.top + box.height / 2 - view.top - frame.clientHeight / 2, behavior });
}

/** Keep the minimap's frame on what the battle view shows. */
function syncMinimap() {
  const frame = battleScroll();
  const mini = app.querySelector<SVGSVGElement>('.minimap svg');
  const view = mini?.querySelector<SVGRectElement>('.minimap-view');
  const field = frame?.querySelector<SVGSVGElement>('svg.field');
  if (!frame || !mini || !view || !field) return;
  const scale = Number(mini.dataset.width) / field.clientWidth;
  view.setAttribute('x', String(frame.scrollLeft * scale));
  view.setAttribute('y', String(frame.scrollTop * scale));
  view.setAttribute('width', String(Math.min(frame.clientWidth, field.clientWidth) * scale));
  view.setAttribute('height', String(Math.min(frame.clientHeight, field.clientHeight) * scale));
}

function render() {
  // The page is redrawn after every action: keep the battlefield and the map where the player was looking.
  const before = battleScroll();
  const scroll = before ? { left: before.scrollLeft, top: before.scrollTop, width: before.scrollWidth, height: before.scrollHeight } : null;
  const mapBefore = hexScroll();
  const mapScroll = mapBefore ? { x: (mapBefore.scrollLeft + mapBefore.clientWidth / 2) / Math.max(1, mapBefore.scrollWidth), y: (mapBefore.scrollTop + mapBefore.clientHeight / 2) / Math.max(1, mapBefore.scrollHeight) } : null;
  draw();
  const mapAfter = hexScroll();
  if (mapAfter && mapScroll) {
    // Keep the same point of the map in the middle, also across a zoom.
    mapAfter.scrollLeft = mapScroll.x * mapAfter.scrollWidth - mapAfter.clientWidth / 2;
    mapAfter.scrollTop = mapScroll.y * mapAfter.scrollHeight - mapAfter.clientHeight / 2;
  } else if (mapAfter) {
    centreHexMap();
  }
  const after = battleScroll();
  if (after && scroll) {
    // After a zoom, keep the same point of the field in view.
    after.scrollLeft = scroll.left * (after.scrollWidth / Math.max(1, scroll.width));
    after.scrollTop = scroll.top * (after.scrollHeight / Math.max(1, scroll.height));
  } else if (after && state.battle) {
    if (state.battle.city) {
      // Frame the approach and city together so the new layout is immediately visible.
      const field=after.querySelector<SVGSVGElement>('svg.field')!;
      after.scrollLeft=field.clientWidth * (state.battle.city.deploying ? .65 : .52) - after.clientWidth / 2;
      after.scrollTop=field.clientHeight * .52 - after.clientHeight / 2;
    } else app.querySelector('.unit.mine')?.scrollIntoView({ block: 'center', inline: 'center' });
  }
  syncMinimap();
  app.querySelector<HTMLElement>('#feedback-heading')?.focus({preventScroll:true});
  if (ui.assault) app.querySelector<HTMLElement>('[data-action="assault-attack"]:not(:disabled), [data-action="assault-retreat"]')?.focus();
}

function draw() {
  ui.undoMoveLabel = undoMove?.label;
  ui.undoMoveBlocked = undoRefusal ?? undefined;
  app.innerHTML = `<div ${feedback.length ? 'inert' : ''}><nav class="save-bar" aria-label="Saved games">
    <button data-action="saved-games" aria-expanded="${savesOpen}" aria-controls="save-content">${savesOpen ? 'Back to game' : 'Saved games'}</button>
    <button data-action="export-save" ${hasGame ? '' : 'disabled'}>Export save</button>
    <button data-action="import-save">Import save</button>
    <input id="save-file" type="file" accept=".json,application/json" hidden>
    ${saveWarning ? `<p class="msg" role="alert">${esc(saveWarning)}</p>` : ''}
    ${recoveryWarning ? `<p class="msg" role="alert">${esc(recoveryWarning)}</p>` : ''}
    </nav><div id="save-content">${savesOpen ? renderSaveManager(storage, hasGame) :
    state.battle ? renderBattle(state, ui) : renderCampaign(state, ui)}</div></div>${renderFeedback(state,feedback)}`;
}

function selectNode(id: string) {
  ui.selected = id;
  const army = armyAt(state, id, 'player');
  ui.checked = new Set(army?.troops.filter((t) => t.mp > 0 && !t.refit).map((t) => t.id) ?? []);
}

function onAction(action: string, data: DOMStringMap, additive = false) {
  undoRefusal = null;
  const before=feedbackSnapshot(state),previousState=state;
  const nameInput=app.querySelector<HTMLInputElement>('#ruler-name');
  if(ui.rulerDraft && nameInput)ui.rulerDraft.name=nameInput.value;
  ui.message = '';
  if (ui.assault && !['assault-attack', 'assault-retreat', 'assault-besiege'].includes(action)) return;
  if (ui.notice && action !== 'notice-close') return;
  if (ui.townChoice && !['town-choice-move', 'town-choice-city', 'town-choice-close', 'town-choice-cancel', 'troops-all', 'troops-none', 'troops-max'].includes(action)) return;
  // A later consequential command closes the one-step undo window. Browsing the map does not.
  if (!['node', 'hex', 'undo-move', 'assault-retreat', 'route-first-leg', 'locate-army', 'plan-route', 'route-clear',
    'route-preference', 'map-layer', 'map-zoom', 'hex-zoom', 'battle-zoom', 'view-quest', 'goto', 'journal', 'treasury', 'cities', 'summary-city', 'spell'].includes(action)) undoMove = null;
  switch (action) {
    case 'troops-pick':
      if (ui.selected) ui.townChoice = { at: ui.selected, step: 'troops' };
      break;
    case 'siege-begin':
      ui.message = beginSiege(state, data.from ?? '', data.to ?? '') ?? 'The siege has begun. Each month the town weakens; storm, hold or lift it from the town panel.';
      break;
    case 'town-choice-move':
      if (ui.townChoice) ui.townChoice = { ...ui.townChoice, step: 'troops' };
      break;
    case 'town-choice-city':
      if (ui.townChoice) { selectNode(ui.townChoice.at); ui.view = 'city'; ui.cityTab = 'overview'; }
      ui.townChoice = null;
      break;
    case 'town-choice-close':
      // Troops stay ticked: the lit hexes on the map show where they can go.
      ui.townChoice = null;
      break;
    case 'town-choice-cancel':
      ui.townChoice = null;
      ui.checked = new Set();
      break;
    case 'troops-all': {
      const army = ui.selected ? armyAt(state, ui.selected, 'player') : undefined;
      ui.checked = new Set(army?.troops.filter((t) => t.mp > 0 && !t.refit).map((t) => t.id) ?? []);
      break;
    }
    case 'troops-max': {
      const army = ui.selected ? armyAt(state, ui.selected, 'player') : undefined;
      ui.checked = new Set(army?.troops.filter(t=>t.mp>0&&!t.refit).slice(0,ARMY_CAP).map(t=>t.id) ?? []);
      break;
    }
    case 'troops-none':
      ui.checked = new Set();
      break;
    case 'infiltrate':
      ui.message = infiltrate(state, Number(data.army)) ?? 'Your spy is inside. Its report is on the town panel and comes again each month.';
      break;
    case 'station-scout':
      ui.message = stationScout(state, Number(data.troop)) ?? 'The scout stays here on watch; the rest of the army can march on.';
      if (ui.selected) { const army = armyAt(state, ui.selected, 'player'); ui.checked = new Set([...ui.checked].filter((id) => army?.troops.some((t) => t.id === id))); }
      break;
    case 'make-camp':
      ui.message = makeCamp(state, Number(data.army)) ?? 'Camp is set: the army stays put this month, and the weather costs it half as many men.';
      break;
    case 'scout-post':
      ui.message = assignScout(state, Number(data.troop), data.post === 'recall' ? 'recall' : 'watch') ?? '';
      break;
    case 'assault-besiege': {
      const decision = ui.assault;
      ui.assault = null;
      if (!decision) break;
      ui.message = beginSiege(state, decision.from, decision.to) ?? 'The siege has begun. Each month the town weakens; storm, hold or lift it from the town panel.';
      break;
    }
    case 'siege-storm': {
      const siege = siegeOf(state, data.town ?? '');
      const army = siege && state.armies.find((a) => a.id === siege.army);
      if (!siege || !army) break;
      const ids = army.troops.filter((t) => t.mp > 0 && !t.refit).map((t) => t.id);
      ui.message = moveTroops(state, siege.camp, ids, townLocation(state, siege.town)) ?? '';
      break;
    }
    case 'siege-lift':
      ui.message = liftSiege(state, data.town ?? '') ?? 'The siege is lifted.';
      break;
    case 'siege-accept':
      ui.message = acceptTerms(state, data.town ?? '') ?? 'Terms accepted: the town is your vassal.';
      break;
    case 'siege-refuse':
      ui.message = refuseTerms(state, data.town ?? '') ?? 'Terms refused. The siege goes on.';
      break;
    case 'assault-retreat':
      ui.assault = null;
      break;
    case 'assault-attack': {
      const decision = ui.assault;
      if (!decision) break;
      const quote = marchQuote(state, decision.from, decision.troopIds, decision.to);
      if (quote.reason || !cityAssault(state, decision.from, decision.to, decision.troopIds)) {
        ui.message = quote.reason ?? 'The defenders have moved. Inspect the city again.';
        ui.assault = null;
        break;
      }
      const before = captureMove(state, ui, 'Undo march');
      const err = moveTroops(state, decision.from, decision.troopIds, decision.to);
      ui.message = err ?? '';
      ui.assault = null;
      if (!err) {
        offerUndo(before);
        ui.routeOrigin = null; ui.routeDestination = null;
        selectNode(decision.to);
      }
      break;
    }
    case 'undo-move':
      if (undoMove) {
        const before = undoMove;
        state = restoreMove(before, ui);
        ui.message = 'Last move undone.';
        undoMove = null;
      }
      break;
    case 'summary-city':
      if(data.node && townAt(state,data.node)?.owner==='player') { selectNode(data.node); ui.view='city'; ui.cityTab=['development','army'].includes(data.tab??'') ? data.tab as 'development'|'army' : 'overview'; ui.marchMode=false; }
      break;
    case 'cities':
      ui.view=ui.view==='cities'?'map':'cities';ui.marchMode=false;break;
    case 'open-city':
      if(data.node && explored(state,data.node) && townAt(state,data.node)){selectNode(data.node);ui.view='city';ui.cityTab='overview';ui.marchMode=false;}
      break;
    case 'close-city':ui.view='map';break;
    case 'city-tab':
      if(['overview','development','recruitment','army','quests'].includes(data.tab??''))ui.cityTab=data.tab as UIState['cityTab'];
      break;
    case 'march-mode':ui.marchMode=!ui.marchMode;break;
    case 'feedback-dismiss': feedback.shift(); break;
    case 'feedback-journal': feedback=[]; ui.view='journal'; break;
    case 'new-game':
      ui.choosing = true;
      break;
    case 'cancel-choose':
      ui.choosing = false;
      break;
    case 'start-campaign':
      ui.creatingFor=data.campaign as CampaignId;ui.choosing=false;
      ui.rulerDraft={name:'Aldric',gender:'male',skin:'fair'};
      break;
    case 'ruler-gender':
      if(ui.rulerDraft && (data.value==='male'||data.value==='female')){
        if(['Aldric','Elara'].includes(ui.rulerDraft.name))ui.rulerDraft.name=data.value==='female'?'Elara':'Aldric';
        ui.rulerDraft.gender=data.value;
      }
      break;
    case 'ruler-difficulty':
      if(ui.rulerDraft && ['easy','normal','hard'].includes(data.value??''))ui.rulerDraft.difficulty=data.value as 'easy'|'normal'|'hard';
      break;
    case 'ruler-class':
      if(ui.rulerDraft && ['knight','priest','mage'].includes(data.value??''))ui.rulerDraft.rulerClass=data.value as 'knight'|'priest'|'mage';
      break;
    case 'ruler-skin':
      if(ui.rulerDraft && SKIN_TONES.some(s=>s===data.value))ui.rulerDraft.skin=data.value as typeof ui.rulerDraft.skin;
      break;
    case 'ruler-back':ui.creatingFor=undefined;ui.choosing=true;break;
    case 'confirm-ruler':
      if(ui.creatingFor && ui.rulerDraft && checkpoint('Before new campaign'))activate(createRulerCampaign(ui.creatingFor,ui.rulerDraft));
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
      const decision = cityAssault(state, ui.routeOrigin, firstLeg, [...ui.checked]);
      if (decision) { ui.assault = decision; break; }
      const before = captureMove(state, ui, 'Undo march');
      ui.message = moveTroops(state, ui.routeOrigin, [...ui.checked], firstLeg) ?? '';
      if (!ui.message) {
        offerUndo(before);
        ui.routeOrigin = null;
        ui.routeDestination = null;
        selectNode(firstLeg);
      }
      break;
    }
    case 'map-layer':
      if (data.layer === 'terrain' || data.layer === 'political') ui.mapLayer = data.layer;
      break;
    case 'hex-zoom': {
      const step = HEX_ZOOMS.indexOf(hexZoom(ui) as (typeof HEX_ZOOMS)[number]) + (data.zoom === 'in' ? 1 : -1);
      ui.hexZoom = HEX_ZOOMS[Math.max(0, Math.min(HEX_ZOOMS.length - 1, step))];
      break;
    }
    case 'map-zoom':
      ui.mapZoom = Math.max(1, Math.min(2, (ui.mapZoom ?? 1) + (data.zoom === 'in' ? 0.5 : -0.5)));
      break;
    case 'view-quest': {
      const destination = questFocus(state, data.quest ?? '');
      // An unexplored quest site is never revealed by the shortcut: say which way it lies instead.
      if (destination && !explored(state, destination)) {
        const capital = townLocation(state, campaignOf(state).capital);
        ui.view = 'quests';
        ui.message = `${QUESTS[data.quest ?? '']?.name ?? 'This quest'}: its place is still unexplored, ${bearingFrom(capital, destination)} of ${nodeName(state, capital)}. Explore that way to find it.`;
      } else if (destination) {
        ui.view = townAt(state,destination)?'city':'map';ui.cityTab='quests';
        selectNode(destination);
      }
      break;
    }
    case 'quests':
      ui.view = ui.view === 'quests' && !data.quest ? 'map' : 'quests';
      break;
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
    case 'replacements':
      ui.message=recruitReplacements(state,Number(data.troop),data.count?Number(data.count):undefined)??'Recruits added. This unit will be ready next month.';
      break;
    case 'inspect-refit':
      if(Object.hasOwn(EQUIPMENT,data.item??''))ui.refitChoice={troop:Number(data.troop),item:data.item as EquipmentId};
      break;
    case 'refit': {
      const item = data.item as EquipmentId;
      if (!Object.hasOwn(EQUIPMENT, item)) { ui.message = 'Unknown equipment.'; break; }
      const err = beginRefit(state, data.node!, Number(data.troop), item);
      ui.message = err ?? 'Refit purchased. The new gear becomes available next month.';
      if (!err) log(state, `A unit begins refitting with ${EQUIPMENT[item].name}.`);
      break;
    }
    case 'dismantle': {
      ui.message=dismantleCity(state,data.node!,data.kind as BuildingId)??'Industry removed. The site is available; stored materials were kept.';
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
      ui.battleUnits = new Set();ui.battleUnit=null;ui.battleSpell=null;
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
      feedback=[];
      ui.view = 'map';
      selectNode(data.node!);
      break;
    case 'build':
      ui.battleBuild = ui.battleBuild === data.build ? null : (data.build as Build);
      ui.battleSpell = null;
      break;
    case 'build-tower': {
      const b = state.battle;
      const u = b ? selectedUnit(b, ui) : undefined;
      if (b && u && build(b, u.id, 'tower')) undoMove = null;
      ui.battleBuild = null;
      break;
    }
    case 'spell':
      ui.battleBuild = null;
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
    case 'recruit': {
      const err = recruit(state, data.node!, data.type!);
      ui.message = err ?? '';
      if (!err) {
        const type = UNIT_TYPES[data.type!];
        ui.notice = { title: 'New unit created', lines: [`${type.name}: ${type.men} ${type.hero ? 'HP' : 'men'}, level 1, raised in ${nodeName(state, data.node!)}.`, 'It has joined your troops there and is listed under your army.'] };
      }
      break;
    }
    case 'notice-close':
      ui.notice = null;
      break;
    case 'node': {
      const id = data.node!;
      // A lit location (or any, in march mode) is a march or an attack; a known town otherwise opens its city screen.
      const intent = mapClickIntent(state, ui, id);
      if (intent === 'route') {
        if (id !== ui.routeOrigin) ui.routeDestination = id;
        break;
      }
      if (intent === 'city') { selectNode(id); ui.view = 'city'; ui.cityTab = 'overview'; break; }
      if (intent === 'choose') { selectNode(id); ui.townChoice = { at: id, step: 'choose' }; break; }
      if (intent === 'march' && ui.selected) {
        const decision = cityAssault(state, ui.selected, id, [...ui.checked]);
        if (decision) { ui.assault = decision; ui.marchMode = false; break; }
        const before = captureMove(state, ui, 'Undo march');
        const err = moveTroops(state, ui.selected, [...ui.checked], id);
        ui.message = err ?? '';
        if (!err) { offerUndo(before); selectNode(id); ui.marchMode = false; }
      } else {
        selectNode(id);
      }
      break;
    }
    case 'hex':
      onHex(Number(data.col), Number(data.row), additive);
      break;
    case 'battle-pillage':
      if(state.battle && ui.battleUnit != null && pillageCityBuilding(state.battle, ui.battleUnit)) undoMove=null;
      break;
    case 'battle-end':
      playerEndTurn(state.battle!);
      ui.battleUnit = null;
      ui.battleUnits = new Set();
      ui.battleSpell = null;
      break;
    case 'battle-select-all':
    case 'battle-select-none': {
      const b=state.battle;
      if(!b || b.outcome || b.owners[b.active]!=='player') break;
      const units=action==='battle-select-all' ? b.units.filter(u=>u.side===b.active && !u.reserve && !u.fled && !u.routing && !u.moved && !u.acted && u.men>0) : [];
      ui.battleUnits=new Set(units.map(u=>u.id));
      ui.battleUnit=units[0]?.id??null;
      ui.battleSpell=null;ui.battleTarget=null;
      break;
    }
    case 'battle-zoom':
      ui.battleZoom = Math.min(5, Math.max(0.5, Math.round(((ui.battleZoom ?? 1.8) + 0.4 * Number(data.dir)) * 10) / 10));
      break;
    case 'battle-auto':
      ui.battleUnits = new Set();
      autoResolve(state.battle!);
      break;
    case 'battle-retreat': {
      ui.battleUnits = new Set();
      const b = state.battle!;
      const got = tryEscape(b, playerSide(b)!);
      ui.message = got === null ? escapeQuote(b, playerSide(b)!).reason ?? '' : got ? '' : 'The enemy held you; your turn is spent.';
      if (got === false) { ui.battleUnit = null; ui.battleSpell = null; }
      break;
    }
    case 'battle-continue':
      ui.selected=state.battle!.at;ui.view='map';
      applyBattle(state, state.battle!);
      ui.battleUnit = null;
      ui.battleUnits = new Set();
      ui.battleSpell = null;
      if (ui.selected) selectNode(ui.selected);
      break;
  }
  if(state===previousState) feedback.push(...newFeedback(state,before));
}

function onHex(col: number, row: number, additive = false) {
  const b = state.battle!;
  if (b.city?.deploying && !b.outcome) {
    const clicked=unitAt(b,{col,row});
    if(clicked?.side==='defender') { ui.battleUnit=clicked.id; ui.battleUnits=new Set([clicked.id]); }
    else if(ui.battleUnit != null) placeCityDefender(b,ui.battleUnit,{col,row});
    return;
  }
  if (b.outcome || b.active !== playerSide(b)) return;
  const clicked = unitAt(b, { col, row });
  const sel = selectedUnit(b, ui);
  const group = selectedGroup(b, ui);
  if (sel && ui.battleBuild) {
    // Engineers build on the clicked hex; clicking anywhere else cancels.
    if (build(b, sel.id, ui.battleBuild, { col, row })) undoMove = null;
    ui.battleBuild = null;
    return;
  }
  if (sel && ui.battleSpell) {
    if (clicked && clicked.id === ui.battleTarget && ui.battleSpell !== 'teleport') {
      // Clicking the chosen target a second time casts, the same as the Cast button.
      if (castSpell(b, sel.id, ui.battleSpell, clicked.id)) {
        undoMove = null;
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
    if (additive) {
      if (clicked.moved || clicked.acted || clicked.routing || (sel && (sel.moved || sel.acted || sel.routing))) {
        ui.message = 'Only ready units can move together. Select a ready blue unit first.';
        return;
      }
      const ids = new Set(group.map((u) => u.id));
      if (ids.has(clicked.id)) ids.delete(clicked.id);
      else ids.add(clicked.id);
      ui.battleUnits = ids;
      ui.battleUnit = ids.has(ui.battleUnit ?? -1) ? ui.battleUnit : (ids.values().next().value ?? null);
    } else {
      ui.battleUnit = clicked.id;
      ui.battleUnits = new Set([clicked.id]);
    }
    ui.battleSpell = null;
    ui.battleTarget = null;
    return;
  }
  ui.battleSpell = null;
  if (!sel) return;
  if (group.length > 1) {
    if (clicked) { ui.message = 'Select one unit to attack. The group moves together to glowing empty hexes.'; return; }
    if (groupReachable(b, group.map((u) => u.id)).has(hexKey({ col, row }))) {
      const before = captureMove(state, ui, 'Undo battle move');
      if (moveGroup(b, group.map((u) => u.id), { col, row })) {
        offerUndo(before);
        ui.battleUnit = null;
        ui.battleUnits = new Set();
      }
    }
  } else if (clicked) {
    // One click on an enemy moves into range if needed, then attacks. An attack can't be undone.
    const q = attackOrderQuote(b, sel.id, clicked.id);
    if (q.reason) ui.message = q.reason;
    else { attackOrder(b, sel.id, clicked.id); ui.message = ''; undoMove = null; }
  } else if (reachable(b, sel).has(hexKey({ col, row }))) {
    const before = captureMove(state, ui, 'Undo battle move');
    if (moveUnit(b, sel.id, { col, row })) offerUndo(before);
  }
}

// Drag to pan the battlefield. A drag that moved never counts as a click (no accidental moves or attacks).
let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
let swallowClick = false;
let dragFrame: HTMLElement | null = null;
app.addEventListener('pointerdown', (e) => {
  const frame = (e.target as Element).closest<HTMLElement>('.battle-scroll, .hex-scroll');
  if (!frame || e.button !== 0) return;
  dragFrame = frame;
  drag = { x: e.clientX, y: e.clientY, left: frame.scrollLeft, top: frame.scrollTop, moved: false };
});
app.addEventListener('pointermove', (e) => {
  const frame = dragFrame;
  if (!drag || !frame || !(e.buttons & 1)) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  frame.scrollLeft = drag.left - dx;
  frame.scrollTop = drag.top - dy;
});
window.addEventListener('pointerup', () => {
  if (drag?.moved) swallowClick = true;
  drag = null;
});
app.addEventListener('click', (e) => {
  if (swallowClick) {
    swallowClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);
app.addEventListener('scroll', (e) => { if ((e.target as Element).classList?.contains('battle-scroll')) syncMinimap(); }, true);
// Enter ends your turn in battle, or the month on the overland map (unless typing, on a focused button, or a
// dialog is open). It clicks the same button, so it is never available when the button isn't.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const target = e.target as Element;
  if (target.closest('input, textarea, select, button, a, [contenteditable]')) return;
  if (savesOpen || feedback.length || ui.assault) return;
  const button = state.battle
    ? app.querySelector<HTMLButtonElement>('[data-action="battle-end"]:not(:disabled)')
    : ui.view === 'map' ? app.querySelector<HTMLButtonElement>('[data-action="end-turn"]:not(:disabled)') : null;
  if (!button) return;
  e.preventDefault();
  button.click();
});
// Arrow keys look around the battlefield (unless typing in a field).
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.assault) { e.preventDefault(); ui.assault = null; render(); return; }
  const frame = battleScroll();
  if (!frame || !state.battle || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  const step = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[e.key];
  if (!step) return;
  e.preventDefault();
  frame.scrollBy({ left: step[0], top: step[1] });
});

app.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement | SVGElement>('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'minimap') {
    // Look at the clicked point: centre the battle view on it.
    const frame = battleScroll();
    const field = frame?.querySelector<SVGSVGElement>('svg.field');
    const box = (el as SVGSVGElement).getBoundingClientRect();
    if (frame && field) {
      const fx = (e.clientX - box.left) / box.width, fy = (e.clientY - box.top) / box.height;
      frame.scrollTo({ left: fx * field.clientWidth - frame.clientWidth / 2, top: fy * field.clientHeight - frame.clientHeight / 2 });
    }
    return;
  }
  if (el.dataset.action === 'hex-center') {
    centreHexMap('smooth');
    return;
  }
  if (el.dataset.action === 'battle-center') {
    app.querySelector('.unit.sel')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    return;
  }
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
  onAction(el.dataset.action!, el.dataset, e.shiftKey);
  save();
  render();
});

// Keep keyboard focus inside an outcome dialog until it is acknowledged.
app.addEventListener('keydown',e=>{
 const dialog=app.querySelector<HTMLElement>('.feedback-sheet');if(!dialog)return;
 if(e.key==='Escape'){e.preventDefault();feedback.shift();render();return;}
 if(e.key==='Tab'){
  const buttons=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')];
  const first=buttons[0],last=buttons.at(-1);if(!first||!last)return;
  if(e.shiftKey && (document.activeElement===first||document.activeElement?.id==='feedback-heading')){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
 }
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
  if (el.dataset.change === 'tax') { undoMove = null; setTax(state, el.dataset.node!, Number(el.value)); }
  if (el.dataset.change === 'check' && el instanceof HTMLInputElement) {
    const id = Number(el.dataset.troop);
    if (el.checked) ui.checked.add(id);
    else ui.checked.delete(id);
  }
  if (el.dataset.change === 'battle-check' && el instanceof HTMLInputElement && state.battle) {
    const id = Number(el.dataset.troop);
    const unit = state.battle.units.find((u) => u.id === id);
    if (unit && unit.side === state.battle.active && !unit.reserve && !unit.fled && unit.men > 0 && !unit.moved && !unit.acted && !unit.routing) {
      const ids = new Set(selectedGroup(state.battle, ui).map((u) => u.id));
      if (el.checked) ids.add(id);
      else ids.delete(id);
      ui.battleUnits = ids;
      ui.battleUnit = ids.has(ui.battleUnit ?? -1) ? ui.battleUnit : (ids.values().next().value ?? null);
      ui.battleSpell = null;
      ui.battleTarget = null;
    }
  }
  save();
  render();
});

render();
