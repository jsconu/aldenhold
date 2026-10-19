export interface Seeded {
  seed: number;
}

/** mulberry32; advances the seed stored on the object so saves replay the same rolls. */
export function random(s: Seeded): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
