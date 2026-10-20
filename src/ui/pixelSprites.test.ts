import { describe, expect, it } from 'vitest';
import { UNIT_TYPES } from '../game/data';
import { PALETTE, SPRITE_SIZE, SPRITES } from './pixelSprites';

describe('pixel sprites', () => {
  it('every unit type has a sprite', () => {
    expect(Object.keys(SPRITES).sort()).toEqual(Object.keys(UNIT_TYPES).sort());
  });

  it('every sprite is a 16×16 grid using only known colours', () => {
    const allowed = new Set(['.', 'T', 't', ...Object.keys(PALETTE)]);
    for (const [type, rows] of Object.entries(SPRITES)) {
      expect(rows, type).toHaveLength(SPRITE_SIZE);
      rows.forEach((row, y) => {
        expect(row.length, `${type} row ${y}`).toBe(SPRITE_SIZE);
        for (const ch of row) expect(allowed.has(ch), `${type} row ${y}: '${ch}'`).toBe(true);
      });
    }
  });

  it('every sprite shows its team colour so sides can be told apart', () => {
    for (const [type, rows] of Object.entries(SPRITES)) expect(rows.join('').includes('T'), type).toBe(true);
  });
});
