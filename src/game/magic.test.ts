import { describe, expect, it } from 'vitest';
import { MAGE_SPELLS, SPELLS } from '../content/spells';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { armyAt, makeTroop, newGame } from './campaign';
import { alive, attackTargets, autoResolve, castSpell, createBattle, defenseOf, endSideTurn, hasEffect, knownSpells, movementOf, previewSpell, reachable, spellAffected, spellCost, spellLineOfSight, spellTargets, teleportDestinations } from './battle';
import { heroMaxHp, heroMaxMana } from './units';
import { hexDistance, hexLine } from './hex';
import { parseSave } from './saves';
import { renderBattle } from '../ui/battleView';
import type { Army, BattleUnit, SpellId } from './types';
import type { UIState } from '../ui/shared';

function scenario(level = 9) {
  const s = newGame(11);
  const a: Army = { id: s.nextId++, owner: 'player', at: 'fenwick', from: 'aldenhold', troops: ['mage', 'spearmen', 'archers'].map((type) => makeTroop(s, type)) };
  const mage = a.troops[0];
  mage.xp = (level - 1) * 3;
  mage.men = heroMaxHp(mage.type, mage.xp); mage.mana = heroMaxMana(mage.type, mage.xp);
  s.armies.push(a);
  const d = armyAt(s, 'fenwick', 'neutral')!;
  d.troops = ['warband', 'warband', 'shaman', 'warchief'].map((type) => makeTroop(s, type));
  const b = createBattle('fenwick', a, d, true, 7);
  b.terrain = Array.from({ length: b.width }, () => Array(b.height).fill('plain'));
  const friends = alive(b, 'attacker'), enemies = alive(b, 'defender');
  const positions = [[3, 4], [3, 3], [2, 5], [6, 4], [7, 4], [7, 5], [9, 7]];
  b.units.forEach((u, i) => { [u.col, u.row] = positions[i]; });
  s.battle = b;
  return { s, b, caster: friends[0], ally: friends[1], friends, enemies, target: enemies[0] };
}
const ui: UIState = { selected: 'fenwick', checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' };

function targetFor(id: SpellId, caster: BattleUnit, ally: BattleUnit, enemy: BattleUnit) {
  if (id === 'dispel') enemy.effects.push({ id: 'ward', turns: 2 });
  return SPELLS[id].target === 'friend' ? (id === 'ward' ? caster : ally) : enemy;
}

describe('mage progression', () => {
  it('has exactly fourteen distinct spells for mage and shaman, unlocked at the specified levels', () => {
    expect(new Set(MAGE_SPELLS).size).toBe(14);
    const counts = [2, 4, 6, 8, 10, 11, 12, 13, 14, 14];
    for (const type of ['mage', 'shaman']) for (let level = 1; level <= 10; level++) {
      const known = knownSpells({ type, xp: (level - 1) * 3 });
      expect(known).toHaveLength(counts[level - 1]);
      expect(known).toEqual(MAGE_SPELLS.filter((id) => SPELLS[id].level <= level));
    }
    expect(knownSpells({ type: 'priest', xp: 27 })).toEqual(['heal', 'rally']);
    expect(knownSpells({ type: 'militia', xp: 27 })).toEqual([]);
  });
  it.each(MAGE_SPELLS)('%s resolves once and pays its cost once', (id) => {
    const { s, b, caster, ally, target } = scenario();
    const t = targetFor(id, caster, ally, target), destination = id === 'teleport' ? { col: 4, row: 2 } : undefined;
    const before = caster.mana;
    const preview = previewSpell(b, caster, id, t, destination);
    expect(preview).not.toBeNull();
    expect(castSpell(b, caster.id, id, t.id, destination)).toBe(true);
    expect(caster.mana).toBe(before - spellCost(caster, id));
    expect(caster.acted && caster.moved).toBe(true);
    expect(caster.deeds).toBe(1);
    const once = JSON.stringify(s);
    expect(castSpell(b, caster.id, id, t.id, destination)).toBe(false);
    expect(JSON.stringify(s)).toBe(once);
    expect(parseSave(once)).toEqual(s);
  });
  it('refuses locked, invalid, unaffordable and wrong-side casts without state changes', () => {
    const { b, caster, target } = scenario(1);
    for (const id of ['terror', 'disintegrate', 'constructor', 'not-a-spell']) {
      const before = JSON.stringify(b);
      expect(castSpell(b, caster.id, id as SpellId, target.id)).toBe(false);
      expect(JSON.stringify(b)).toBe(before);
    }
    caster.mana = 0;
    expect(castSpell(b, caster.id, 'fireball', target.id)).toBe(false);
    caster.mana = 12; b.active = 'defender';
    expect(castSpell(b, caster.id, 'fireball', target.id)).toBe(false);
    b.active = 'attacker'; caster.reserve = true;
    expect(castSpell(b, caster.id, 'fireball', target.id)).toBe(false);
  });
  it('grants level-ten efficiency without a fifteenth spell', () => {
    const { caster } = scenario(10);
    expect(knownSpells(caster)).toHaveLength(14);
    expect(spellCost(caster, 'disintegrate')).toBe(11);
    expect(spellCost(caster, 'ward')).toBe(2);
  });
});

describe('status effects and counters', () => {
  it('Ward changes defense and spell damage, then expires exactly on the target side boundary', () => {
    const { b, caster, ally } = scenario();
    const defense = defenseOf(b, ally);
    castSpell(b, caster.id, 'ward', ally.id);
    expect(defenseOf(b, ally)).toBe(defense + 2);
    endSideTurn(b);
    expect(ally.effects).toEqual([{ id: 'ward', turns: 1 }]);
    endSideTurn(b);
    expect(ally.effects).toHaveLength(1);
    endSideTurn(b);
    expect(ally.effects).toEqual([]);
    expect(defenseOf(b, ally)).toBe(defense);
  });
  it('Haste/Slow counter each other, refresh without magnitude stacking, and retain spent actions', () => {
    const { b, caster, ally, target } = scenario();
    ally.effects = [{ id: 'slow', turns: 1 }]; ally.moved = true; ally.acted = true;
    castSpell(b, caster.id, 'haste', ally.id);
    expect(ally.effects).toEqual([{ id: 'haste', turns: 2 }]);
    expect(movementOf(ally)).toBe(5);
    expect(reachable(b, ally).size).toBe(0);
    expect(attackTargets(b, ally)).toEqual([]);
    target.effects = [{ id: 'haste', turns: 2 }]; caster.acted = false;
    castSpell(b, caster.id, 'slow', target.id);
    expect(target.effects).toEqual([{ id: 'slow', turns: 2 }]);
    expect(movementOf(target)).toBe(1);
    endSideTurn(b); endSideTurn(b);
    expect(target.effects[0].turns).toBe(1);
    castSpell(b, caster.id, 'slow', target.id);
    expect(target.effects).toEqual([{ id: 'slow', turns: 2 }]);
  });
  it('Frost damages and slows; Entangle catches only nearby enemies and allows attacks', () => {
    const first = scenario(2);
    const men = first.target.men;
    castSpell(first.b, first.caster.id, 'frost', first.target.id);
    expect(first.target.men).toBeLessThan(men);
    expect(movementOf(first.target)).toBe(2);
    endSideTurn(first.b); endSideTurn(first.b);
    expect(first.target.effects).toEqual([]);
    const { b, caster, ally, target, enemies } = scenario();
    ally.col = 6; ally.row = 3;
    castSpell(b, caster.id, 'entangle', target.id);
    expect(hasEffect(target, 'entangle')).toBe(true);
    expect(ally.effects).toEqual([]);
    expect(enemies[3].effects).toEqual([]);
    expect(movementOf(target)).toBe(1);
    b.active = 'defender';
    expect(attackTargets(b, target)).toContain(ally);
  });
  it('Dispel cleanses harmful friendly effects or strips enemy protection without removing the rest', () => {
    const { b, caster, ally, target } = scenario();
    ally.effects = [{ id: 'ward', turns: 2 }, { id: 'frost', turns: 1 }];
    target.effects = [{ id: 'ward', turns: 2 }, { id: 'slow', turns: 2 }];
    expect(previewSpell(b, caster, 'dispel', ally)!.impacts[0].remove).toEqual(['frost']);
    castSpell(b, caster.id, 'dispel', ally.id);
    expect(ally.effects).toEqual([{ id: 'ward', turns: 2 }]);
    caster.acted = false;
    castSpell(b, caster.id, 'dispel', target.id);
    expect(target.effects).toEqual([{ id: 'slow', turns: 2 }]);
  });
  it('heroes are immune to Terror and cannot be erased from full health by Disintegrate', () => {
    const { b, caster, enemies } = scenario();
    const boss = enemies[3]; boss.col = 6; boss.row = 5;
    expect(spellTargets(b, caster, 'terror')).not.toContain(boss);
    const damage = previewSpell(b, caster, 'disintegrate', boss)!.impacts[0].damage;
    expect(damage).toBeLessThanOrEqual(Math.floor(boss.maxMen * 0.4));
    castSpell(b, caster.id, 'disintegrate', boss.id);
    expect(boss.men).toBeGreaterThan(0);
  });
});

describe('targeting and area spells', () => {
  it('Lightning requires straight line of sight and chains respect blockers and unique targets', () => {
    const { b, caster, target } = scenario();
    const line = hexLine(caster, target);
    expect(line).toHaveLength(hexDistance(caster, target) + 1);
    expect(line[0]).toEqual({ col: caster.col, row: caster.row });
    b.terrain[line[1].col][line[1].row] = 'rocks';
    expect(spellLineOfSight(b, caster, target)).toBe(false);
    expect(spellTargets(b, caster, 'lightning')).not.toContain(target);
    b.terrain[line[1].col][line[1].row] = 'plain';
    expect(spellTargets(b, caster, 'lightning')).toContain(target);
    const chain = spellAffected(b, caster, 'chain-lightning', target);
    expect(chain).toHaveLength(3);
    expect(new Set(chain.map((u) => u.id)).size).toBe(3);
    const damage = previewSpell(b, caster, 'chain-lightning', target)!.impacts.map((h) => h.damage);
    expect(damage[0]).toBeGreaterThan(damage[1]);
    expect(damage[1]).toBeGreaterThan(damage[2]);
  });
  it('fire armor and Ward reduce the preview and actual damage consistently', () => {
    const { b, caster, target } = scenario(4);
    const base = previewSpell(b, caster, 'fireball', target)!.impacts[0].damage;
    target.gear.armor = 'plate';
    expect(previewSpell(b, caster, 'fireball', target)!.impacts[0].damage).toBeLessThan(base);
    target.effects = [{ id: 'ward', turns: 2 }];
    const reduced = previewSpell(b, caster, 'fireball', target)!.impacts[0].damage;
    expect(reduced).toBeLessThan(base / 2);
    const men = target.men;
    castSpell(b, caster.id, 'fireball', target.id);
    expect(target.men).toBe(men - reduced);
  });
  it.each(['quake', 'firestorm'] as const)('%s previews and resolves friendly fire; Quake removes wall defense', (id) => {
    const { s, b, caster, ally, target } = scenario();
    ally.col = 6; ally.row = 3;
    const preview = previewSpell(b, caster, id, target)!;
    expect(preview.impacts.some((hit) => hit.unit === ally && hit.damage > 0)).toBe(true);
    const rendered = renderBattle(s, { ...ui, battleUnit: caster.id, battleSpell: id, battleTarget: target.id });
    expect(rendered).toContain('Friendly fire');
    expect(rendered).toContain('spell-confirm');
    const snapshot = preview.impacts.map((h) => ({ unit: h.unit, remaining: h.unit.men - h.damage }));
    castSpell(b, caster.id, id, target.id);
    for (const h of snapshot) expect(h.unit.men).toBe(h.remaining);
    expect(b.walls).toBe(id !== 'quake');
  });
  it('Teleport rejects occupied, off-map, fractional, impassable and distant hexes without paying', () => {
    const { b, caster, ally } = scenario();
    b.terrain[4][2] = 'rocks';
    const invalid = [{ col: caster.col, row: caster.row }, { col: -1, row: 1 }, { col: 2.5, row: 1 }, { col: 4, row: 2 }, { col: 11, row: 8 }];
    for (const hex of invalid) {
      const snapshot = JSON.stringify(b);
      expect(castSpell(b, caster.id, 'teleport', ally.id, hex)).toBe(false);
      expect(JSON.stringify(b)).toBe(snapshot);
    }
    expect(teleportDestinations(b, caster, ally).length).toBeGreaterThan(0);
    ally.acted = true;
    expect(castSpell(b, caster.id, 'teleport', ally.id, { col: 4, row: 3 })).toBe(true);
    expect(ally).toMatchObject({ col: 4, row: 3, moved: true, acted: true });
  });
});

describe('saved magic and auto-resolve', () => {
  it('upgrades v8 mid-battle saves without adding effects or changing RNG, gear, resources or quests', () => {
    const { s } = scenario();
    const legacy = JSON.parse(JSON.stringify(s)); legacy.version = 8;
    for (const u of legacy.battle.units) delete u.effects;
    expect(parseSave(JSON.stringify(legacy))).toEqual(s);
  });
  it('rejects unknown, duplicate, conflicting and unbounded effects', () => {
    const { s } = scenario();
    for (const effects of [[{ id: 'unknown', turns: 1 }], [{ id: 'ward', turns: 0 }], [{ id: 'ward', turns: 99 }], [{ id: 'ward', turns: 1 }, { id: 'ward', turns: 2 }], [{ id: 'haste', turns: 1 }, { id: 'slow', turns: 1 }]]) {
      const raw = JSON.parse(JSON.stringify(s)); raw.battle.units[0].effects = effects;
      expect(() => parseSave(JSON.stringify(raw))).toThrow();
    }
  });
  it('continues the same high-level battle after saving active effects', () => {
    const { s, b, caster, target } = scenario();
    castSpell(b, caster.id, 'slow', target.id);
    const restored = parseSave(JSON.stringify(s));
    autoResolve(b); autoResolve(restored.battle!);
    expect(restored.battle).toEqual(b);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(b.log.some((l) => l.includes('Lightning') || l.includes('Disintegrate') || l.includes('Firestorm'))).toBe(true);
  });
  it('keeps the catalog valid and exposes locked spells and remaining durations in battle UI', () => {
    expect(validateContent(CATALOG)).toEqual([]);
    const { s, caster } = scenario(1);
    caster.effects = [{ id: 'ward', turns: 1 }];
    const html = renderBattle(s, { ...ui, battleUnit: caster.id });
    expect(html).toContain('Disintegrate'); expect(html).toContain('Lv 9');
    expect(html).toContain('Ward (1 turns)');
  });
});
