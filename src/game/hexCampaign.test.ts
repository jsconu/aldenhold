import { describe, expect, it } from 'vitest';
import { getCampaign } from '../content';
import { raidPath } from './ai';
import { autoResolve } from './battle';
import { applyBattle, armyAt, arrivalEstimates, endTurn, makeTroop, moveTroops, newGame } from './campaign';
import { parseSave } from './saves';
import type { GameState } from './types';
import { hasRoad, hexLand, landAt, locationName, marchOptions, stepCost, townAt, townLocation } from './world';

const realm = getCampaign('western-realm').hex!;
const keyOf = (id: string) => {
  const p = realm.places.find((x) => x.id === id)!;
  return `${p.col},${p.row}`;
};

function freshRealm(): GameState {
  return newGame(1, 'western-realm');
}

describe('Western Realm: setup', () => {
  it('places armies on hexes and gives troops their monthly movement', () => {
    const s = freshRealm();
    const home = armyAt(s, keyOf('aldenhold'), 'player')!;
    expect(home.troops.map((t) => [t.type, t.mp])).toEqual([['lord', 14], ['militia', 12], ['militia', 12], ['spearmen', 12], ['archers', 12]]);
    expect(armyAt(s, keyOf('pass'), 'orcs')).toBeDefined();
    expect(townAt(s, keyOf('harrowgate'))?.id).toBe('harrowgate');
    expect(townLocation(s, 'gharzak')).toBe(keyOf('gharzak'));
    expect(s.nodes).toEqual([]);
  });

  it('names any hex: places by name, open country by land and nearest place', () => {
    const s = freshRealm();
    expect(locationName(s, keyOf('bridge'))).toBe('Stone Bridge');
    expect(locationName(s, '20,25')).toMatch(/^the swamp near /);
  });
});

describe('Western Realm: movement', () => {
  it('roads cost 1, open land its own cost, and water or mountains block', () => {
    const s = freshRealm();
    expect(hasRoad(s, keyOf('bridge'))).toBe(true);
    expect(stepCost(s, keyOf('bridge'))).toBe(1); // a bridge over the river
    expect(hexLand(realm, '13,4').id).toBe('water');
    expect(stepCost(s, '13,4')).toBe(Infinity);
    expect(stepCost(s, '29,0')).toBe(Infinity); // mountains
    expect(stepCost(s, '1,21')).toBe(3); // forest, off-road
  });

  it('the river can only be crossed at a bridge', () => {
    const s = freshRealm();
    s.armies = s.armies.filter((a) => a.owner === 'player');
    const reach = marchOptions(s, keyOf('aldenhold'), 'player', 99);
    // Every route to a town across the Aldwater goes over a water hex that carries a road: a bridge.
    for (const town of ['harrowgate', 'westmere', 'duskwater', 'reedhaven']) {
      let at: string | null = keyOf(town);
      let bridges = 0;
      expect(reach.has(at), town).toBe(true);
      while (at) {
        if (hexLand(realm, at).id === 'water') {
          expect(hasRoad(s, at), `${town} via ${at}`).toBe(true);
          bridges++;
        }
        at = reach.get(at)?.prev ?? null;
      }
      expect(bridges, town).toBeGreaterThan(0);
    }
  });

  it('the capital can reach its nearest towns in a month by road', () => {
    const s = freshRealm();
    const reach = marchOptions(s, keyOf('aldenhold'), 'player', 12);
    expect(reach.has(keyOf('fenwick'))).toBe(true);
    expect(reach.has(keyOf('millbrook'))).toBe(true);
  });

  it('marching along the road spends the right movement; the slowest troop sets the pace', () => {
    const s = freshRealm();
    const from = keyOf('aldenhold');
    const home = armyAt(s, from, 'player')!;
    const militia = home.troops.find((t) => t.type === 'militia')!;
    const reach = marchOptions(s, from, 'player', militia.mp);
    const bridge = keyOf('bridge');
    expect(reach.has(bridge)).toBe(true);
    const cost = reach.get(bridge)!.cost;
    expect(moveTroops(s, from, [militia.id], bridge)).toBeNull();
    expect(armyAt(s, bridge, 'player')!.troops[0].mp).toBe(12 - cost);

    const troll = makeTroop(s, 'troll');
    troll.mp = 2;
    home.troops.push(troll);
    const lord = home.troops.find((t) => t.type === 'lord')!;
    expect(moveTroops(s, from, [lord.id, troll.id], bridge)).toMatch(/can’t reach/);
  });

  it('marching into a defended town stops there and fights on ground shaped like the land', () => {
    const s = freshRealm();
    const from = keyOf('aldenhold');
    const ids = armyAt(s, from, 'player')!.troops.map((t) => t.id);
    expect(moveTroops(s, from, ids, keyOf('fenwick'))).toBeNull();
    const b = s.battle!;
    expect(b.at).toBe(keyOf('fenwick'));
    expect(b.walls).toBe(true);
    expect(landAt(s, b.at)).toBe('farmland');
    autoResolve(b);
    applyBattle(s, b);
    expect(s.towns.fenwick.owner).toBe('player');
    expect(s.journal.at(-1)).toMatchObject({ kind: 'capture', place: keyOf('fenwick') });
  });
});

describe('Western Realm: orcs and time', () => {
  it('raiders head for the nearest town they do not hold', () => {
    const s = freshRealm();
    const raiders = armyAt(s, keyOf('pass'), 'orcs')!;
    const path = raidPath(s, raiders);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((at) => stepCost(s, at) < Infinity)).toBe(true);
    // The route ends at a town the orcs don't hold.
    expect(townAt(s, path.at(-1)!)?.owner).not.toBe('orcs');
  });

  it('36 idle months play out without errors and the orcs come over the mountains', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed, 'western-realm');
      for (let i = 0; i < 36 && s.status === 'playing'; i++) {
        endTurn(s);
        while (s.battle) {
          autoResolve(s.battle);
          applyBattle(s, s.battle);
        }
      }
      expect(s.armies.every((a) => a.troops.length > 0 && townAt(s, a.at) !== undefined || stepCost(s, a.at) < Infinity)).toBe(true);
      const westOfMountains = Object.values(s.towns).filter((t) => t.kind === 'town' && t.owner === 'orcs');
      expect(westOfMountains.length + s.journal.filter((j) => j.kind === 'battle').length).toBeGreaterThan(0);
      expect(() => parseSave(JSON.stringify(s))).not.toThrow();
    }
  }, 20_000); // a deliberately long soak: three seeds × 36 months
});

describe('Western Realm: saves', () => {
  it('round-trips through save validation', () => {
    const s = freshRealm();
    endTurn(s);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });

  it('rejects armies on hexes off the map or in the water', () => {
    const s = freshRealm();
    s.armies[0].at = '99,99';
    expect(() => parseSave(JSON.stringify(s))).toThrow(/army location/);
  });
});

describe('save migration v9 → v10', () => {
  it('turns the valley’s moved flags into movement points: unmoved troops keep their one march', () => {
    const s = newGame(1);
    const home = armyAt(s, 'aldenhold', 'player')!;
    const v9 = JSON.parse(JSON.stringify(s));
    v9.version = 9;
    v9.armies.forEach((a: { troops: { mp?: number; moved?: boolean }[] }) =>
      a.troops.forEach((t, i) => { delete t.mp; t.moved = a === v9.armies[0] && i === 0; }));
    const restored = parseSave(JSON.stringify(v9));
    expect(restored.version).toBe(10);
    expect(restored.armies[0].troops.map((t) => t.mp)).toEqual([0, ...home.troops.slice(1).map(() => 1)]);
    expect(restored.armies.flatMap((a) => a.troops).every((t) => !('moved' in t))).toBe(true);
  });
});

describe('Western Realm: arrival estimates', () => {
  it('counts this month’s remaining movement, then full months at the slowest troop’s pace', () => {
    const s = newGame(1, 'western-realm');
    const from = keyOf('aldenhold');
    const ids = armyAt(s, from, 'player')!.troops.map((t) => t.id);
    const months = arrivalEstimates(s, from, ids);
    expect(months.get(keyOf('fenwick'))).toBe(1);
    // Gharzak lies beyond the mountains: several months even by road.
    expect(months.get(keyOf('gharzak'))!).toBeGreaterThanOrEqual(3);
    expect(months.has('13,4')).toBe(false); // water is never reached
  });
});
