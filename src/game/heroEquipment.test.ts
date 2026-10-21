import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import { renderJournal } from '../ui/journalView';
import type { UIState } from '../ui/shared';
import { attackOf, createBattle, defenseOf, leadershipOf } from './battle';
import { advanceQuests } from './quests';
import { applyBattle, armyAt, checkStatus, makeTroop, neighborsOf, newGame } from './campaign';
import { settleTreasury } from './economy';
import { equipItem, equipQuote, grantItem, heldQty, recoverFallenKit, unequipItem, unequipQuote } from './items';
import { parseSave } from './saves';
import type { Army, GameState } from './types';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** A Western Realm game where M01 has just been won, so the council returned the Oathlance. */
function sworn(): { s: GameState; home: Army } {
  const s = newGame(1, 'western-realm');
  const home = armyAt(s, townLocation(s, 'aldenhold'), 'player')!;
  home.troops.push(makeTroop(s, 'militia'), makeTroop(s, 'militia'));
  settleTreasury(s, [], []);
  s.turn += 1;
  advanceQuests(s);
  checkStatus(s);
  expect(s.quests.M01.status).toBe('succeeded');
  return { s, home };
}

const lordOf = (army: Army) => army.troops.find((t) => t.type === 'lord')!;

describe('the Oathlance (M01 heirloom)', () => {
  it('is returned by the council when M01 is won, exactly once', () => {
    const { s } = sworn();
    expect(s.items.oathlance).toEqual({ qty: 1, spent: 0, archived: false });
    expect(reload(s).items.oathlance.qty).toBe(1);
  });

  it('only your lord can carry it, and only in a friendly town', () => {
    let { s, home } = sworn();
    const champion = makeTroop(s, 'champion', 'Brannoc');
    home.troops.push(champion);
    expect(equipQuote(s, 'oathlance', champion.id).reason).toBe('Only a Lord can carry the Oathlance.');
    expect(renderJournal(s)).not.toContain(`data-action="equip-item" data-item="oathlance" data-troop="${champion.id}"`);
    const lord = lordOf(home);
    home.at = neighborsOf(s, home.at).find((k) => !s.armies.some((a) => a.at === k))!;
    expect(equipQuote(s, 'oathlance', lord.id).reason).toBe('Equipment changes hands in a town you rule or one allied with you.');
    home.at = townLocation(s, 'aldenhold');
    expect(equipItem(s, 'oathlance', lord.id)).toBeNull();
    expect(lord.kit).toEqual({ weapon: 'oathlance' });
    expect(heldQty(s, 'oathlance')).toBe(0);
    s = reload(s);
    expect(lordOf(armyAt(s, townLocation(s, 'aldenhold'), 'player')!).kit).toEqual({ weapon: 'oathlance' });
    expect(renderCampaign(s, ui(townLocation(s, 'aldenhold')))).toMatch(/Oathlance\s*<button class="link" data-action="unequip-item"/);
  });

  it('adds +2 attack to the lord and +5 leadership to the army', () => {
    const { s, home } = sworn();
    const lord = lordOf(home);
    const foe: Army = { id: 999, owner: 'orcs', at: home.at, from: null, troops: [makeTroop(s, 'warband')] };
    const before = createBattle(home.at, home, foe, false, 3);
    const lead = leadershipOf(home);
    equipItem(s, 'oathlance', lord.id);
    const after = createBattle(home.at, home, foe, false, 3);
    const unit = (b: typeof before) => b.units.find((u) => u.troopId === lord.id)!;
    expect(attackOf(unit(after)) - attackOf(unit(before))).toBeCloseTo(2);
    expect(leadershipOf(home)).toBe(lead + 5);
    expect(unit(after).kit).toEqual({ weapon: 'oathlance' });
  });

  it('taking it off returns it to the inventory', () => {
    const { s, home } = sworn();
    const lord = lordOf(home);
    equipItem(s, 'oathlance', lord.id);
    expect(unequipQuote(s, lord.id, 'armor').reason).toBe('Nothing is carried there.');
    expect(unequipItem(s, lord.id, 'weapon')).toBeNull();
    expect(lord.kit).toBeUndefined();
    expect(heldQty(s, 'oathlance')).toBe(1);
    expect(() => reload(s)).not.toThrow();
  });
});

describe('the Shield of the Old Watch (Q03) and fallen heroes', () => {
  /** The sworn game with a hired champion in Aldenhold and the shield in the inventory (as Q03's win grants it). */
  function shielded() {
    const { s, home } = sworn();
    const champion = makeTroop(s, 'champion', 'Brannoc');
    home.troops.push(champion);
    grantItem(s, 'old-watch-shield');
    return { s, home, champion };
  }

  it('any hero can carry it for +2 defense', () => {
    const { s, home, champion } = shielded();
    const foe: Army = { id: 999, owner: 'orcs', at: home.at, from: null, troops: [makeTroop(s, 'warband')] };
    const before = createBattle(home.at, home, foe, false, 3);
    expect(equipItem(s, 'old-watch-shield', champion.id)).toBeNull();
    const after = createBattle(home.at, home, foe, false, 3);
    const unit = (b: typeof before) => b.units.find((u) => u.troopId === champion.id)!;
    expect(defenseOf(after, unit(after)) - defenseOf(before, unit(before))).toBe(2);
  });

  it('a fallen hero’s gear comes home if anyone survives; otherwise ordinary gear is lost but an heirloom never is', () => {
    const { s, champion } = shielded();
    equipItem(s, 'old-watch-shield', champion.id);
    expect(recoverFallenKit(s, champion, true)).toBe('Survivors carried Shield of the Old Watch home.');
    expect(heldQty(s, 'old-watch-shield')).toBe(1);
    equipItem(s, 'old-watch-shield', champion.id);
    expect(recoverFallenKit(s, champion, false)).toBe('Shield of the Old Watch was lost on the field.');
    expect(s.items['old-watch-shield']).toEqual({ qty: 0, spent: 1, archived: false });
    const lord = { ...makeTroop(s, 'lord', 'Aldric'), kit: { weapon: 'oathlance' } };
    s.items.oathlance.qty = 0;
    expect(recoverFallenKit(s, lord, false)).toBe('Survivors carried Oathlance home.');
    expect(heldQty(s, 'oathlance')).toBe(1);
  });

  it('a hero who dies in battle drops their gear back to the survivors, noted in the journal', () => {
    const { s, home, champion } = shielded();
    equipItem(s, 'old-watch-shield', champion.id);
    const foe: Army = { id: s.nextId++, owner: 'orcs', at: home.at, from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(foe);
    const b = createBattle(home.at, foe, home, false, 3);
    b.units.find((u) => u.troopId === champion.id)!.men = 0;
    b.outcome = 'defender';
    applyBattle(s, b);
    expect(s.journal.some((j) => j.text === `Brannoc died at Aldenhold. Survivors carried Shield of the Old Watch home.`)).toBe(true);
    expect(heldQty(s, 'old-watch-shield')).toBe(1);
  });
});

describe('hero equipment in saves and content', () => {
  it('rejects gear on ordinary troops, on the wrong hero, or that no quest granted', () => {
    const { s, home } = sworn();
    const militia = home.troops.find((t) => t.type === 'militia')!;
    const onTroop = structuredClone(s);
    onTroop.armies.flatMap((a) => a.troops).find((t) => t.id === militia.id)!.kit = { weapon: 'oathlance' };
    onTroop.items.oathlance.qty = 0;
    expect(() => reload(onTroop)).toThrow(/hero equipment/);
    const conjured = structuredClone(s);
    lordOf(conjured.armies.find((a) => a.id === home.id)!).kit = { armor: 'old-watch-shield' };
    expect(() => reload(conjured)).toThrow(/carried equipment no quest granted|inventory/);
    const doubled = structuredClone(s);
    lordOf(doubled.armies.find((a) => a.id === home.id)!).kit = { weapon: 'oathlance' };
    expect(() => reload(doubled)).toThrow(/inventory count/);
  });

  it('v12 saves get the rewards their finished quests now give', () => {
    const { s } = sworn();
    const v12 = JSON.parse(JSON.stringify(s));
    v12.version = 12;
    delete v12.items.oathlance;
    const restored = parseSave(JSON.stringify(v12));
    expect(restored.version).toBe(14);
    expect(restored.items.oathlance).toEqual({ qty: 1, spent: 0, archived: false });
    // A quest that hasn't ended owes nothing.
    const fresh = JSON.parse(JSON.stringify(newGame(1, 'western-realm')));
    fresh.version = 12;
    expect(parseSave(JSON.stringify(fresh)).items).toEqual({});
  });

  it('content validation keeps equipment honest', () => {
    const check = (edit: (c: typeof CATALOG) => void) => {
      const copy = structuredClone(CATALOG);
      edit(copy);
      return validateContent(copy).join('\n');
    };
    expect(validateContent(CATALOG)).toEqual([]);
    expect(check((c) => delete c.items.oathlance.equip)).toMatch(/all equipment needs one/);
    expect(check((c) => (c.items.oathlance.equip = { slot: 'weapon' }))).toMatch(/equipment must add something/);
    expect(check((c) => (c.items.oathlance.equip!.heroes = ['militia']))).toMatch(/"militia" is not a hero type/);
  });

  it('the Q03 victory now includes the shield', () => {
    const win = CATALOG.quests.Q03.stages[0].choices[0].then;
    if (!('encounter' in win) || !('effects' in win.encounter.win)) throw new Error('fixture');
    expect(win.encounter.win.effects).toContainEqual({ kind: 'item', item: 'old-watch-shield' });
  });
});
