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
