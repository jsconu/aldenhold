import { describe, expect, it } from 'vitest';
import { getCampaign } from '../content';
import { HEX_INSET, HALF_H, inHex, mapPixelSize, paintTerrain, STEP_X, TILE_H, TILE_W, tileOrigin } from './pixelTiles';

const realm = getCampaign('western-realm').hex!;

describe('pixel hex tiles', () => {
  it('neighbouring columns interlock: insets of mirrored rows always add up to the column overlap', () => {
    for (let y = 0; y < HALF_H; y++) expect(HEX_INSET[y] + HEX_INSET[HALF_H - 1 - y]).toBe(TILE_W - STEP_X);
  });

  it('tiles cover the map interior exactly once: no gaps, no overlaps', () => {
    const { width, height } = mapPixelSize(realm);
    const hits = new Uint8Array(width * height);
    realm.rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        const [ox, oy] = tileOrigin(col, row);
        for (let y = 0; y < TILE_H; y++) for (let x = 0; x < TILE_W; x++) if (inHex(x, y)) hits[(oy + y) * width + ox + x]++;
      }
    });
    expect(hits.every((h) => h <= 1)).toBe(true);
    // Away from the ragged outer edge, every pixel belongs to some tile.
    let gaps = 0;
    for (let y = TILE_H; y < height - TILE_H; y++) for (let x = TILE_W; x < width - TILE_W; x++) if (hits[y * width + x] !== 1) gaps++;
    expect(gaps).toBe(0);
  });

  it('paints the whole Western Realm at native resolution', () => {
    const c = paintTerrain(realm);
    expect([c.width, c.height]).toEqual([STEP_X * 39 + TILE_W, TILE_H * 28 + HALF_H]);
    const alpha = (x: number, y: number) => c.data[(y * c.width + x) * 4 + 3];
    expect(alpha(c.width >> 1, c.height >> 1)).toBe(255);
    expect(alpha(0, 0)).toBe(0); // outside the first tile's corner
  });

  it('paints the same map identically every time', () => {
    const a = paintTerrain(realm).data;
    const b = paintTerrain(realm).data;
    expect(a.length).toBe(b.length);
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});
