import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { ENCOUNTERS } from '../content/encounters';
import { validateContent } from '../content/validate';
import { renderBattle } from '../ui/battleView';
import { renderCampaign } from '../ui/campaignView';
import { advanceMonth, applyBattle, armyAt, makeTroop, newGame, startLocation } from './campaign';
import { attack, attackTargets, autoResolve, retreat } from './battle';
import { encounterQuote } from './encounters';
import { advanceQuests, chooseQuest, questQuote } from './quests';
import { parseSave, saveGame } from './saves';
import { isHero } from './units';
import type { GameState } from './types';
import type { UIState } from '../ui/shared';

const ui: UIState = { selected: null, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };
function atSite(id = 'quarry-one-eye') {
  const s = newGame(41, 'western-realm');
  // Isolate the optional expedition from unrelated roaming raids.
  s.armies = s.armies.filter((a) => a.owner !== 'orcs');
  advanceMonth(s);
  const army = armyAt(s, startLocation(s, 'aldenhold'), 'player')!;
  army.at = startLocation(s, ENCOUNTERS[id].at);
  army.troops.push(makeTroop(s, 'champion', 'Edith'), makeTroop(s, 'priest', 'Osric'));
  return { s, army, quest: ENCOUNTERS[id].quest };
}
function launch(id = 'quarry-one-eye') {
  const fixture = atSite(id);
  expect(chooseQuest(fixture.s, fixture.quest, 'fight')).toBeNull();
  expect(parseSave(JSON.stringify(fixture.s))).toEqual(fixture.s);
  return fixture;
}
function win(s: GameState) {
  const b = s.battle!;
  b.units.filter((u) => u.side === 'defender').forEach((u) => { u.men = 0; });
  b.outcome = 'attacker';
  applyBattle(s, b);
  return b;
}

describe('authored encounter commands', () => {
  it('quotes the exact participants and refuses remote, occupied, repeated and battle-time launches without mutation', () => {
    const { s, army, quest } = atSite();
    army.at = startLocation(s, 'aldenhold');
    const remote = JSON.stringify(s);
    expect(questQuote(s, quest, 'fight').reason).toContain('Old Quarry');
    expect(chooseQuest(s, quest, 'fight')).toContain('Old Quarry');
    expect(JSON.stringify(s)).toBe(remote);
    army.at = startLocation(s, 'quarry');
    const blocker = { id: s.nextId++, at: army.at, owner: 'orcs' as const, from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(blocker);
    const occupied = JSON.stringify(s);
    expect(chooseQuest(s, quest, 'fight')).toContain('force already');
    expect(JSON.stringify(s)).toBe(occupied);
    s.armies = s.armies.filter((a) => a !== blocker);
    const q = encounterQuote(s, 'quarry-one-eye');
    expect(q.participantIds).toEqual(army.troops.map((t) => t.id));
    expect(q.waitingIds).toEqual([]);
    expect(chooseQuest(s, quest, 'fight')).toBeNull();
    const committed = JSON.stringify(s);
    expect(chooseQuest(s, quest, 'fight')).not.toBeNull();
    expect(encounterQuote(s, 'quarry-one-eye').reason).not.toBeNull();
    expect(JSON.stringify(s)).toBe(committed);
  });
  it.each(Object.keys(ENCOUNTERS))('%s commits a seed and exact force, with no invented walls or strategic movement left', (id) => {
    const { s } = launch(id), progress = s.encounters[id];
    expect(progress.status).toBe('active');
    expect(s.battle!.encounterId).toBe(id);
    expect(s.battle!.walls).toBe(false);
    expect(s.armies.find((a) => a.id === progress.armyId)!.troops.every((t) => t.mp === 0)).toBe(true);
    expect(s.battle!.units.filter((u) => u.side === 'defender').map((u) => u.type)).toEqual(ENCOUNTERS[id].enemies.map((t) => typeof t === 'string' ? t : t.type));
    expect(renderBattle(s, ui)).toContain(ENCOUNTERS[id].warning);
    const once = JSON.stringify(s);
    expect(advanceMonth(s)).toBeNull();
    expect(JSON.stringify(s)).toBe(once);
    expect(saveGame({ getItem: () => null, setItem: () => {} }, s)).toBeNull();
  });
  it('keeps ordinary troops outside a hero expedition, without losses, MP use or XP', () => {
    const { s, army, quest } = atSite('tower-keeper');
    const waiting = structuredClone(army.troops.filter((t) => !isHero(t.type)));
    const heroes = army.troops.filter((t) => isHero(t.type));
    expect(chooseQuest(s, quest, 'fight')).toBeNull();
    expect(s.battle!.units.filter((u) => u.side === 'attacker').map((u) => u.troopId)).toEqual(heroes.map((t) => t.id));
    expect(s.encounters['tower-keeper'].waitingIds).toEqual(waiting.map((t) => t.id));
    win(s);
    expect(s.quests.Q03.status).toBe('succeeded');
    const survivors = s.armies.filter((a) => a.owner === 'player').flatMap((a) => a.troops);
    expect(survivors.filter((t) => waiting.some((w) => w.id === t.id))).toEqual(waiting);
    expect(survivors.filter((t) => heroes.some((h) => h.id === t.id)).every((t) => t.xp >= 1)).toBe(true);
    expect(s.items['mana-draught'].qty).toBe(2);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('refuses a hero-only site without a hero and does not detach a refitting participant', () => {
    const { s, army, quest } = atSite('tower-keeper');
    army.troops = army.troops.filter((t) => !isHero(t.type));
    expect(chooseQuest(s, quest, 'fight')).toContain('at least one hero');
    expect(s.battle).toBeNull();
    const hero = makeTroop(s, 'priest'); army.troops.push(hero);
    hero.refit = { item: 'chain', startedTurn: s.turn, orderedMen: 1, paidGold: 1, paidGoods: {} };
    const before = JSON.stringify(s);
    expect(chooseQuest(s, quest, 'fight')).toContain('refits');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('encounter outcomes', () => {
  it('awards the quest once, reconciles its cash receipt and ignores repeated battle application', () => {
    const { s } = launch(); const gold = s.gold;
    const b = win(s);
    expect(s.encounters['quarry-one-eye']).toMatchObject({ status: 'won', resolvedTurn: s.turn });
    expect(s.quests.Q02.status).toBe('succeeded');
    expect(s.gold).toBe(gold + 120);
    expect(s.items['healing-draught'].qty).toBe(2);
    const once = JSON.stringify(s); applyBattle(s, b);
    expect(JSON.stringify(s)).toBe(once);
    expect(chooseQuest(s, 'Q02', 'fight')).not.toBeNull();
    expect(JSON.stringify(s)).toBe(once);
    advanceMonth(s);
    const ledger = s.treasury.history.at(-1)!;
    expect(ledger.entries.filter((e) => e.category === 'quest-reward')).toHaveLength(1);
    expect(ledger.entries.some((e) => e.category === 'balance-correction')).toBe(false);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('retreats to safe ground, records withdrawal, and never awards the bounty or lets enemies roam', () => {
    const { s } = launch(); const b = s.battle!, progress = s.encounters['quarry-one-eye'];
    const gold = s.gold, at = b.at;
    retreat(b, 'attacker'); applyBattle(s, b);
    expect(s.encounters['quarry-one-eye'].status).toBe('withdrawn');
    expect(s.quests.Q02.status).toBe('failed');
    expect(s.gold).toBe(gold); expect(s.items).toEqual({});
    expect(s.armies.some((a) => a.id === progress.enemyArmyId)).toBe(false);
    expect(s.armies.find((a) => a.id === progress.armyId)?.at).not.toBe(at);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('carries real hero deaths through defeat without touching waiting troops', () => {
    const { s } = launch('tower-keeper'), b = s.battle!;
    const waiting = structuredClone(s.armies.find((a) => a.id === s.encounters['tower-keeper'].sourceArmyId)!.troops);
    const priest = b.units.find((u) => u.side === 'attacker' && u.type === 'priest')!;
    priest.men = 0; b.outcome = 'defender'; applyBattle(s, b);
    expect(s.encounters['tower-keeper'].status).toBe('lost');
    expect(s.quests.Q03.status).toBe('failed');
    expect(s.armies.flatMap((a) => a.troops).some((t) => t.id === priest.troopId)).toBe(false);
    expect(s.armies.find((a) => a.id === s.encounters['tower-keeper'].sourceArmyId)!.troops).toEqual(waiting);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('keeps the existing ruler-death defeat rule in optional combat', () => {
    const { s } = launch('tower-keeper'), b = s.battle!;
    b.units.find((u) => u.type === 'lord')!.men = 0;
    b.outcome = 'defender'; applyBattle(s, b);
    expect(s.status).toBe('lost'); expect(s.endingReason).toBe('lord-dead');
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('resumes the identical committed battle and rewards after a mid-combat save', () => {
    const { s } = launch('caravan-rescue'), b = s.battle!;
    const u = b.units.find((u) => u.side === 'attacker')!;
    const target = attackTargets(b, u)[0]; if (target) attack(b, u.id, target.id);
    const restored = parseSave(JSON.stringify(s));
    autoResolve(b); autoResolve(restored.battle!);
    expect(restored.battle).toEqual(b);
    applyBattle(s, b); applyBattle(restored, restored.battle!);
    expect(restored).toEqual(s);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('offers a paid caravan alternative and records an unanswered deadline without spawning enemies', () => {
    const { s } = atSite('caravan-rescue'); const gold = s.gold;
    expect(chooseQuest(s, 'Q05', 'ransom')).toBeNull();
    expect(s.gold).toBe(gold - 100); expect(s.flags).toContain('caravan-ransomed');
    expect(s.encounters).toEqual({}); expect(s.battle).toBeNull();
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    const missed = atSite('caravan-rescue').s;
    missed.turn += 3; advanceQuests(missed);
    expect(missed.quests.Q05).toMatchObject({ status: 'failed', resolvedBy: 'deadline' });
    expect(missed.flags).toContain('caravan-lost');
    expect(missed.encounters).toEqual({});
    expect(parseSave(JSON.stringify(missed))).toEqual(missed);
  });
});

describe('encounter content, UI and saves', () => {
  it('shows the exact force, risk and site action on the map without requiring a return to the giver', () => {
    const { s, army } = atSite('tower-keeper');
    const html = renderCampaign(s, { ...ui, selected: army.at });
    expect(html).toContain('Only heroes');
    expect(html).toContain('Your ruler can die');
    expect(html).toContain('3 formations enter; 4 stay outside');
    expect(html).toContain('data-quest="Q03" data-choice="fight"');
  });
  it('rejects forged active participants, seed/record omissions and invented outcomes', () => {
    const { s } = launch('tower-keeper');
    for (const edit of [
      (x: GameState) => { x.encounters = {}; },
      (x: GameState) => { x.battle!.encounterId = undefined; },
      (x: GameState) => { x.encounters['tower-keeper'].seed = Infinity; },
      (x: GameState) => { x.encounters['tower-keeper'].participantIds.push(x.encounters['tower-keeper'].waitingIds[0]); },
      (x: GameState) => { x.encounters['tower-keeper'].waitingIds = []; },
      (x: GameState) => { x.encounters['tower-keeper'].status = 'won'; },
      (x: GameState) => { x.quests.Q03.history = []; },
    ]) { const copy = structuredClone(s); edit(copy); expect(() => parseSave(JSON.stringify(copy))).toThrow(); }
    win(s);
    const fake = structuredClone(s); fake.encounters['tower-keeper'].status = 'lost';
    expect(() => parseSave(JSON.stringify(fake))).toThrow(/encounter/);
    const missing = structuredClone(s); missing.encounters = {};
    expect(() => parseSave(JSON.stringify(missing))).toThrow(/encounter/);
  });
  it('migrates v12 with no retroactive attempts or changes to the old state', () => {
    const s = newGame(8), raw = JSON.parse(JSON.stringify(s));
    raw.version = 12; delete raw.encounters;
    expect(parseSave(JSON.stringify(raw))).toEqual(s);
  });
  it('validates references, mandatory battle outcomes, landmarks and enemy definitions', () => {
    expect(validateContent(CATALOG)).toEqual([]);
    for (const edit of [
      (c: typeof CATALOG) => { c.encounters['tower-keeper'].at = 'aldenhold'; },
      (c: typeof CATALOG) => { c.encounters['tower-keeper'].enemies = ['dragon']; },
      (c: typeof CATALOG) => { c.encounters['tower-keeper'].quest = 'Q99'; },
      (c: typeof CATALOG) => { c.quests.Q03.stages[1].objectives = []; },
      (c: typeof CATALOG) => { c.quests.Q03.stages[0].choices[0].encounter = 'missing'; },
      (c: typeof CATALOG) => { c.quests.Q03.stages[1].deadline = { months: 1, outcome: c.quests.Q03.onLocationLost }; },
    ]) { const copy = structuredClone(CATALOG); edit(copy); expect(validateContent(copy).length).toBeGreaterThan(0); }
  });
});
