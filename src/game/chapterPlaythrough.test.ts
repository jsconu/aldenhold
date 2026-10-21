import { describe, expect, it } from 'vitest';
import { playChapter } from './testing/chapterPlaythrough';

describe('Western chapter with real player commands', () => {
  for (const seed of [1, 42, 2026]) {
    for (const crossing of ['charter', 'ignore'] as const) {
      it(`seed ${seed}, ${crossing}: survives the chapter with a solvent realm and valid monthly saves`, () => {
        const result = playChapter(seed, crossing);
        expect(result).toMatchObject({
          status: 'won', ending: 'chapter-complete', rulerAlive: true,
          unpaid: 0, foodShortages: 0, corrections: 0,
          resolutions: { M01: 'succeeded', M02: 'succeeded', M03: crossing === 'charter' ? 'succeeded' : 'failed', M04: 'succeeded' },
        });
        expect(result.months).toBeLessThanOrEqual(24);
        expect(result.minimumGold).toBeGreaterThanOrEqual(0);
        expect(result.battles).toBeGreaterThanOrEqual(3);
        expect(result.casualties).toBeGreaterThan(0);
        expect(result.completed.M02).toBeGreaterThan(result.completed.M01);
        expect(result.completed.M04).toBeGreaterThan(result.completed.M02);
        expect(result.actions.some((action) => action.includes('upgrade capital farms'))).toBe(true);
        expect(result.actions.some((action) => action.includes('Q00: sign'))).toBe(true);
        expect(result.actions.some((action) => action.includes('M03: charter'))).toBe(crossing === 'charter');
      }, 15_000);
    }
  }

  it('replays exactly, including actions, combat losses and economy, after monthly imports', () => {
    expect(playChapter(42)).toEqual(playChapter(42));
  }, 15_000);

  it('reports an unfinished run honestly when its month budget expires', () => {
    const result = playChapter(1, 'charter', 1);
    expect(result.status).toBe('playing');
    expect(result.ending).toBeNull();
    expect(result.completed.M04).toBeUndefined();
  });
});
