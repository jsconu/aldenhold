/**
 * Hand-composed native-pixel silhouettes for the Western Realm. Every settlement has
 * its own architecture, roofline and environment; faction flags use F to recolour.
 *
 * These images are generated from primitive pixel marks, not a shared town stamp.
 * They are deliberately much larger than a unit token to remain recognizable on the map.
 */
export type PixelRows = string[];
type Glyph = '.' | 'k' | 'w' | 'g' | 'G' | 's' | 'S' | 'b' | 'B' | 'y' | 'R' | 'r' | 'H' | 'c' | 'F' | 'L' | 'o' | 'v';
class Canvas {
  readonly pixels: Glyph[][];
  constructor(public width: number, public height: number) {
    this.pixels = Array.from({ length: height }, () => Array<Glyph>(width).fill('.'));
  }
  p(x: number, y: number, color: Glyph) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.pixels[y][x] = color;
  }
  box(x: number, y: number, w: number, h: number, fill: Glyph, edge: Glyph = 'k') {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++)
      this.p(px, py, px === x || px === x + w - 1 || py === y || py === y + h - 1 ? edge : fill);
  }
  line(x: number, y: number, x2: number, y2: number, color: Glyph) {
    let dx = Math.abs(x2 - x), sx = x < x2 ? 1 : -1;
    let dy = -Math.abs(y2 - y), sy = y < y2 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.p(x, y, color);
      if (x === x2 && y === y2) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }
  roof(x: number, tip: number, w: number, bottom: number, shade: Glyph = 'R') {
    const mid = x + Math.floor(w / 2);
    for (let py = tip; py <= bottom; py++) {
      const f = (py - tip + 1) / (bottom - tip + 1);
      const span = Math.max(1, Math.floor(w * f / 2));
      for (let px = mid - span; px <= mid + span; px++) this.p(px, py, px === mid - span || px === mid + span ? 'k' : shade);
    }
  }
  flag(x: number, y: number, left = false) {
    this.line(x, y, x, y + 7, 'k');
    this.box(left ? x - 6 : x + 1, y, 6, 4, 'F', 'k');
  }
  house(x: number, y: number, w = 9, h = 8, roof: Glyph = 'R') {
    this.box(x, y + 4, w, h - 4, 's');
    this.roof(x, y, w, y + 4, roof);
    this.box(x + Math.floor(w / 2) - 1, y + h - 4, 3, 4, 'b');
    this.p(x + 2, y + 6, 'y');
  }
  tower(x: number, y: number, w = 7, h = 13, stone: Glyph = 'g') {
    this.box(x, y + 3, w, h - 3, stone);
    for (let dx = 0; dx < w; dx += 3) this.box(x + dx, y, 2, 4, stone);
    this.box(x + Math.floor(w / 2) - 1, y + 6, 3, 4, 'B');
    this.p(x + 2, y + h - 3, 'G');
  }
  pine(x: number, y: number, tall = 11) {
    for (let iy = 0; iy < tall - 3; iy++) {
      const half = Math.min(5, Math.floor((iy + 2) / 2));
      for (let dx = -half; dx <= half; dx++) this.p(x + dx, y + iy, dx === -half || dx === half ? 'k' : (dx & 1 ? 'v' : 'H'));
    }
    this.box(x - 1, y + tall - 3, 3, 3, 'b');
  }
  pond(x: number, y: number, w: number) {
    this.box(x, y, w, 3, 'c', 'L');
    for (let i = 3; i < w - 2; i += 4) this.p(x + i, y + 1, 'w');
  }
  ground() {
    for (let x = 2; x < this.width - 2; x++) {
      if (x % 5 !== 0) this.p(x, this.height - 2, 'H');
      if (x % 3 === 0) this.p(x, this.height - 1, 'B');
    }
  }
  rows(): PixelRows { return this.pixels.map((line) => line.join('')); }
}
type Artist = (c: Canvas) => void;
const ARTISTS: Record<string, Artist> = {
  aldenhold: (c) => {
    c.ground(); c.tower(2, 9, 7, 14); c.tower(24, 8, 7, 15);
    c.box(8, 13, 18, 10, 'g');
    c.box(11, 6, 13, 14, 'w'); c.roof(10, 3, 15, 8, 'L');
    c.box(15, 17, 5, 7, 'B'); c.line(17, 18, 17, 22, 'b');
    for (const x of [10, 15, 20, 24]) c.p(x, 14, 'G');
    c.flag(17, 0); c.flag(5, 5, true);
  },
  fenwick: (c) => {
    c.pond(0, 21, 34); c.ground();
    c.house(3, 9, 11, 12); c.house(15, 7, 10, 14); c.house(25, 12, 7, 9);
    c.box(7, 15, 3, 2, 'y'); c.box(19, 13, 3, 2, 'y');
    c.line(1, 20, 32, 20, 'b'); c.flag(18, 2);
  },
  millbrook: (c) => {
    c.ground(); c.house(2, 13, 10, 10, 'o');
    c.box(12, 5, 10, 18, 's'); c.roof(12, 2, 10, 7, 'R');
    c.box(16, 15, 4, 8, 'b');
    // Working grain mill, eight radiating sails
    c.line(17, 9, 17, 1, 'w'); c.line(17, 9, 17, 17, 'w');
    c.line(9, 9, 25, 9, 'w'); c.line(12, 4, 22, 14, 'w');
    c.line(12, 14, 22, 4, 'w');
    c.pond(25, 21, 8); c.p(27, 18, 'y'); c.flag(28, 4, true);
  },
  greenveil: (c) => {
    c.ground(); c.pine(5, 3, 19); c.pine(28, 1, 19); c.pine(18, 3, 17);
    c.box(11, 12, 14, 10, 'b'); c.roof(10, 8, 16, 14, 'v');
    c.box(16, 16, 4, 6, 'B'); c.line(5, 19, 28, 19, 'H');
    c.flag(19, 4);
  },
  harrowgate: (c) => {
    c.ground(); c.box(4, 15, 27, 8, 'G');
    for (const x of [3, 11, 20, 28]) c.tower(x, 7, 6, 16, 'g');
    c.box(12, 6, 11, 14, 's');
    c.roof(12, 2, 11, 8, 'o'); c.box(16, 17, 5, 6, 'B');
    c.flag(16, 0); c.p(17, 13, 'y');
  },
  westmere: (c) => {
    c.pond(0, 20, 34); c.house(4, 7, 10, 14, 'o');
    c.house(16, 10, 11, 11, 'R');
    c.line(3, 19, 32, 19, 'b');
    for (const x of [7, 13, 21, 29]) c.line(x, 19, x, 23, 'B');
    // Trading barge with pale sail
    c.line(27, 16, 27, 23, 'b'); c.roof(22, 13, 7, 18, 'w');
    c.flag(8, 3);
  },
  duskwater: (c) => {
    c.pond(0, 20, 34);
    c.house(4, 10, 11, 10, 'b'); c.house(18, 7, 11, 12, 'S');
    for (const x of [5, 11, 19, 26]) c.line(x, 18, x, 23, 'b');
    c.line(2, 19, 32, 19, 'B'); c.line(29, 21, 29, 16, 'H');
    c.flag(23, 3);
  },
  reedhaven: (c) => {
    c.pond(0, 21, 34);
    c.house(4, 11, 10, 10, 'o'); c.house(18, 9, 9, 11, 'b');
    for (const x of [1, 3, 15, 29, 31]) {
      c.line(x, 16, x + (x & 1), 22, 'H');
      c.p(x + 1, 16, 'y');
    }
    c.line(12, 20, 32, 20, 'b'); c.flag(22, 4);
  },
  gharzak: (c) => {
    c.ground();
    c.box(3, 11, 29, 13, 'S');
    c.tower(3, 4, 9, 18, 'S'); c.tower(23, 5, 9, 17, 'S');
    c.box(11, 10, 13, 12, 'G');
    for (const x of [11, 17, 23]) { c.line(x, 7, x + 2, 2, 'k'); c.line(x + 2, 2, x + 4, 8, 'S'); }
    c.box(15, 17, 5, 7, 'B');
    c.p(17, 19, 'r'); c.p(8, 14, 'r'); c.p(27, 14, 'r');
    c.flag(17, 0);
  },
  bridge: (c) => {
    c.pond(0, 17, 34);
    c.line(2, 12, 32, 12, 'k');
    c.box(3, 12, 28, 5, 'g');
    c.box(9, 15, 7, 7, 'c'); c.box(20, 15, 7, 7, 'c');
    c.line(4, 12, 30, 12, 'w'); c.line(2, 14, 32, 14, 's');
    for (const x of [5, 16, 29]) c.line(x, 10, x, 15, 'G');
  },
};

/** All generated sprites are fixed 34×24 canvases with transparent space. */
export const WESTERN_PLACE_ART: Record<string, PixelRows> = Object.fromEntries(
  Object.entries(ARTISTS).map(([id, artist]) => {
    const canvas = new Canvas(34, 24);
    artist(canvas);
    return [id, canvas.rows()];
  }),
);
