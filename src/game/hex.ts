/** Flat-topped hexes in "odd-q" offset coordinates (odd columns are shifted down). */
export interface Hex {
  col: number;
  row: number;
}

const DIRS: [number, number, number][] = [
  [1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1],
];

function toCube(h: Hex): [number, number, number] {
  const x = h.col;
  const z = h.row - (h.col - (h.col & 1)) / 2;
  return [x, -x - z, z];
}

function fromCube(x: number, z: number): Hex {
  return { col: x, row: z + (x - (x & 1)) / 2 };
}

export function hexDistance(a: Hex, b: Hex): number {
  const [ax, ay, az] = toCube(a);
  const [bx, by, bz] = toCube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

export function hexNeighbors(h: Hex): Hex[] {
  const [x, , z] = toCube(h);
  return DIRS.map(([dx, , dz]) => fromCube(x + dx, z + dz));
}

export function hexKey(h: Hex): string {
  return `${h.col},${h.row}`;
}

/** Deterministic straight hex line. A tiny nudge resolves exact edge ties consistently. */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const start = toCube(a), end = toCube(b), distance = hexDistance(a, b);
  if (!distance) return [{ ...a }];
  return Array.from({ length: distance + 1 }, (_, i) => {
    const t = i / distance;
    const cube = start.map((n, j) => n + (end[j] - n) * t + (j === 2 ? -2e-6 : 1e-6));
    const rounded = cube.map(Math.round);
    const delta = cube.map((n, j) => Math.abs(rounded[j] - n));
    const j = delta.indexOf(Math.max(...delta));
    rounded[j] = -rounded[(j + 1) % 3] - rounded[(j + 2) % 3];
    return fromCube(rounded[0], rounded[2]);
  });
}
