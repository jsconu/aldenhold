import { describe, expect, it } from 'vitest';
import { attackOf, createBattle, defenseOf, rangeOf } from './battle';
import { armyAt, endTurn, monthlyUpkeep, newGame } from './campaign';
import { beginRefit, EQUIPMENT, equipmentQuoteGold, refitQuote } from './equipment';
import { parseSave } from './saves';
import { level } from './units';

function archer() {
  const s = newGame(1);
  const t = armyAt(s, 'aldenhold', 'player')!.troops.find((t) => t.type === 'archers')!;
  return { s, t };
}

describe('experience-gated equipment', () => {
  it('extends troops to ten levels without changing attack bonuses for existing XP', () => {
    expect(level(0)).toBe(1);
    expect(level(4)).toBe(3);
    expect(level(6)).toBe(4);
    expect(level(8)).toBe(5);
    expect(level(50)).toBe(10);
  });

  it('does not award a long or compound bow automatically when level rises', () => {
    const { s, t } = archer();
    t.xp = 8;
    expect(t.gear.bow).toBe('short-bow');
    expect(refitQuote(s, 'aldenhold', t.id, 'long-bow').reason).toBeNull();
  });

  it('locks compound bows below level five and requires a local tool forge', () => {
    const { s, t } = archer();
    t.xp = 6; // level four
    expect(refitQuote(s, 'aldenhold', t.id, 'compound-bow').reason).toMatch(/level 5/);
    t.xp = 8;
    expect(refitQuote(s, 'aldenhold', t.id, 'compound-bow').reason).toMatch(/Tool Forge/);
    s.cityEconomies.aldenhold.buildings.forge = 1;
    expect(refitQuote(s, 'aldenhold', t.id, 'compound-bow').reason).toMatch(/materials/);
    s.cityEconomies.aldenhold.goods.tools = 12;
    expect(refitQuote(s, 'aldenhold', t.id, 'compound-bow').reason).toBeNull();
  });

  it('charges exactly once for actual surviving headcount and materials, never for original strength', () => {
    const { s, t } = archer();
    t.xp = 8;
    t.men = 8;
    s.cityEconomies.aldenhold.buildings.forge = 1;
    s.cityEconomies.aldenhold.goods.tools = 12;
    const beforeGold = s.gold;
    const beforeTools = s.cityEconomies.aldenhold.goods.tools;
    const q = refitQuote(s, 'aldenhold', t.id, 'compound-bow');
    expect(q.gold).toBe(equipmentQuoteGold('compound-bow', 8));
    expect(beginRefit(s, 'aldenhold', t.id, 'compound-bow')).toBeNull();
    expect(t.gear.bow).toBe('short-bow');
    expect(t.refit?.orderedMen).toBe(8);
    expect(s.gold).toBe(beforeGold - q.gold);
    expect(s.cityEconomies.aldenhold.goods.tools).toBe(beforeTools - q.materials.tools!);
    expect(beginRefit(s, 'aldenhold', t.id, 'compound-bow')).toMatch(/already refitting/);
    expect(s.treasury.pending.filter((e) => e.category === 'refit')).toHaveLength(1);
    endTurn(s);
    expect(t.gear.bow).toBe('compound-bow');
    expect(t.refit).toBeNull();
    expect(s.treasury.history[0].entries.filter((e) => e.category === 'refit')).toHaveLength(1);
  });

  it('a compound bow does at least 30% more raw attack and adds two range', () => {
    const { s, t } = archer();
    t.xp = 8;
    const enemy = armyAt(s, 'gharzak', 'orcs')!;
    const player = armyAt(s, 'aldenhold', 'player')!;
    player.troops = [t];
    const short = createBattle('aldenhold', player, enemy, false, 5);
    const shortUnit = short.units.find((u) => u.troopId === t.id)!;
    const beforeAttack = attackOf(shortUnit);
    const beforeRange = rangeOf(short, shortUnit);
    t.gear.bow = 'compound-bow';
    const compounded = createBattle('aldenhold', player, enemy, false, 5);
    const unit = compounded.units.find((u) => u.troopId === t.id)!;
    expect(attackOf(unit)).toBeGreaterThanOrEqual(beforeAttack * 1.3);
    expect(rangeOf(compounded, unit)).toBe(beforeRange + 2);
  });

  it('plate decreases expected incoming losses and increases wage upkeep', () => {
    const s = newGame(1);
    const t = armyAt(s, 'aldenhold', 'player')!.troops.find((u) => u.type === 'spearmen')!;
    t.xp = 4; // level three
    const beforeUpkeep = monthlyUpkeep(s);
    const foe = armyAt(s, 'gharzak', 'orcs')!;
    const army = armyAt(s, 'aldenhold', 'player')!;
    const unarmored = createBattle('aldenhold', army, foe, false, 42);
    const baseDef = defenseOf(unarmored, unarmored.units.find((u) => u.troopId === t.id)!);
    s.cityEconomies.aldenhold.buildings.forge = 1;
    s.cityEconomies.aldenhold.goods.tools = 12;
    s.cityEconomies.aldenhold.goods.ore = 12;
    expect(beginRefit(s, 'aldenhold', t.id, 'plate')).toBeNull();
    endTurn(s);
    const armored = createBattle('aldenhold', army, foe, false, 42);
    const armorDef = defenseOf(armored, armored.units.find((u) => u.troopId === t.id)!);
    expect(armorDef).toBe(baseDef + EQUIPMENT.plate.defenseBonus);
    expect(baseDef / armorDef).toBeLessThan(0.75);
    expect(monthlyUpkeep(s)).toBe(beforeUpkeep + EQUIPMENT.plate.upkeep);
  });

  it('rejects archers in plate, nonarchers with bows, a hostile town, and moved units', () => {
    const { s, t } = archer();
    t.xp = 8;
    expect(refitQuote(s, 'aldenhold', t.id, 'plate').reason).toMatch(/Archers cannot/);
    const spears = armyAt(s, 'aldenhold', 'player')!.troops.find((u) => u.type === 'spearmen')!;
    spears.xp = 8;
    expect(refitQuote(s, 'aldenhold', spears.id, 'long-bow').reason).toMatch(/Only archer/);
    s.towns.aldenhold.owner = 'orcs';
    expect(refitQuote(s, 'aldenhold', t.id, 'long-bow').reason).toMatch(/owned town/);
    s.towns.aldenhold.owner = 'player';
    t.mp = 0;
    expect(refitQuote(s, 'aldenhold', t.id, 'long-bow').reason).toMatch(/already acted/);
  });

  it('preserves refit commitments across reload and pauses completion during a battle', () => {
    const { s, t } = archer();
    t.xp = 4;
    expect(beginRefit(s, 'aldenhold', t.id, 'long-bow')).toBeNull();
    const foe = armyAt(s, 'gharzak', 'orcs')!;
    foe.at = 'aldenhold';
    const player = armyAt(s, 'aldenhold', 'player')!;
    s.battle = createBattle('aldenhold', player, foe, false, 8);
    const money = s.gold;
    endTurn(s);
    expect(s.gold).toBe(money);
    expect(t.gear.bow).toBe('short-bow');
    const restored = parseSave(JSON.stringify(s));
    expect(restored.gold).toBe(money);
    const copy = armyAt(restored, 'aldenhold', 'player')!.troops.find((u) => u.id === t.id)!;
    expect(copy.refit?.item).toBe('long-bow');
    expect(restored.battle!.units.find((u) => u.troopId === t.id)!.gear.bow).toBe('short-bow');
    restored.battle = null;
    endTurn(restored);
    expect(copy.gear.bow).toBe('long-bow');
    expect(copy.refit).toBeNull();
  });

  it('migrates v7 saves with no free advanced equipment or fabricated refit spending', () => {
    const { s, t } = archer();
    t.xp = 12;
    const beforeGold = s.gold;
    const legacy = structuredClone(s);
    for (const a of legacy.armies) for (const troop of a.troops) {
      delete (troop as { gear?: unknown }).gear;
      delete (troop as { refit?: unknown }).refit;
    }
    (legacy as { version: number }).version = 7;
    const restored = parseSave(JSON.stringify(legacy));
    expect(restored.version).toBe(15);
    expect(restored.gold).toBe(beforeGold);
    expect(restored.treasury.pending).toEqual([]);
    expect(restored.armies.find((a) => a.owner === 'player')!.troops.find((u) => u.id === t.id)!.gear.bow).toBe('short-bow');
  });

  it('rejects invalid equipment combinations, forged refit prices, or inconsistent battle snapshots', () => {
    const { s, t } = archer();
    t.xp = 8;
    s.cityEconomies.aldenhold.buildings.forge = 1;
    s.cityEconomies.aldenhold.goods.tools = 12;
    expect(beginRefit(s, 'aldenhold', t.id, 'compound-bow')).toBeNull();
    const hacked = structuredClone(s);
    const troop = hacked.armies.find((a) => a.owner === 'player')!.troops.find((u) => u.id === t.id)!;
    troop.refit!.paidGold = 1;
    expect(() => parseSave(JSON.stringify(hacked))).toThrow(/refit order/);
    troop.refit!.paidGold = equipmentQuoteGold('compound-bow', t.men);
    troop.gear.armor = 'plate';
    expect(() => parseSave(JSON.stringify(hacked))).toThrow(/equipment compatibility/);
  });
});
