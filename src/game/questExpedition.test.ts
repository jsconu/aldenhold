import { describe, expect, it } from 'vitest';
import { playQuestExpedition } from './testing/questExpedition';

describe('optional quests through a paid campaign expedition', () => {
  for (const cityChoices of ['buy-convict', 'escort-convict', 'ration-pardon'] as const) {
    for (const seed of [1, 42, 2026]) {
      it(`seed ${seed}, ${cityChoices}: resolves every chapter side quest and finishes Act I`, () => {
        const result = playQuestExpedition(seed, { finishChapter: true, cityChoices });
        expect(result).toMatchObject({
          status: 'won', ending: 'chapter-complete', rulerAlive: true, priestAlive: true,
          unpaid: 0, foodShortages: 0, corrections: 0,
          cityResolutions: { Q01: 'succeeded', Q06: 'succeeded' },
          resolutions: { Q02: 'succeeded', Q03: 'succeeded', Q05: 'succeeded' },
          draughts: 3, quarryYield: 1.25,
        });
        expect(result.cityFlags).toEqual([cityChoices === 'ration-pardon' ? 'miller-pardoned' : 'miller-convicted']);
        expect(result.cityCompleted.Q01).toBeLessThan(result.cityCompleted.Q06);
        expect(result.cityCompleted.Q06).toBeLessThan(result.completed.Q05);
        expect(result.actions).toContainEqual(expect.stringContaining(`Q01: ${cityChoices === 'ration-pardon' ? 'ration' : cityChoices === 'escort-convict' ? 'escort' : 'buy'}`));
        expect(result.actions).toContainEqual(expect.stringContaining('Q06: investigate'));
        expect(result.actions).toContainEqual(expect.stringContaining(`Q06: ${cityChoices === 'ration-pardon' ? 'pardon' : 'convict'}`));
      }, 15_000);
    }
  }

  it('an early Greenveil alliance accelerates the chapter and can leave the tower unvisited', () => {
    const result = playQuestExpedition(1, { finishChapter: true, cityChoices: 'buy-convict', woodlandAccord: true });
    expect(result).toMatchObject({
      status: 'won', ending: 'chapter-complete', woodlandResolution: 'succeeded',
      cityResolutions: { Q01: 'succeeded', Q06: 'succeeded' },
      resolutions: { Q02: 'succeeded', Q05: 'succeeded' },
      unpaid: 0, foodShortages: 0, corrections: 0,
    });
    expect(result.woodlandCompleted).toBeLessThan(result.cityCompleted.Q06);
    expect(result.completed.Q03).toBeUndefined();
    expect(result.months).toBeLessThan(playQuestExpedition(1, { finishChapter: true, cityChoices: 'buy-convict' }).months);
  }, 15_000);

  it('can return from the expedition and finish the chapter after Westmere fell before M03 unlocked', () => {
    const result = playQuestExpedition(1, { finishChapter: true });
    expect(result).toMatchObject({
      status: 'won', ending: 'chapter-complete', crossing: 'superseded', westmereOwner: 'orcs',
      rulerAlive: true, priestAlive: true, unpaid: 0, foodShortages: 0, corrections: 0,
      resolutions: { Q02: 'succeeded', Q03: 'succeeded', Q05: 'succeeded' },
    });
    expect(result.actions.some((a) => a.includes('Q00: sign after expedition'))).toBe(true);
  }, 15_000);

  it('can recover from an unsuccessful tower attempt on the next campaign month', () => {
    const result = playQuestExpedition(9);
    const attempts = result.encounters.filter((e) => e.quest === 'Q03');
    expect(attempts.map((e) => e.won)).toEqual([false, true]);
    expect(result).toMatchObject({ priestAlive: true, rulerAlive: true, resolutions: { Q03: 'succeeded' }, draughts: 3 });
    const entries = result.actions.filter((a) => a.includes('Q03: enter'));
    expect(entries).toHaveLength(2);
    expect(Number(entries[1].split(':')[0])).toBeGreaterThan(Number(entries[0].split(':')[0]));
  }, 15_000);

  for (const seed of [1, 42, 2026]) {
    it(`seed ${seed}: rescues the caravan, clears the quarry and completes the heroes-only trial`, () => {
      const result = playQuestExpedition(seed);
      expect(result).toMatchObject({
        status: 'playing', rulerAlive: true, priestAlive: true, unpaid: 0, foodShortages: 0, corrections: 0,
        draughts: 3, quarryYield: 1.25, chapter: 'available',
        resolutions: { Q02: 'succeeded', Q03: 'succeeded', Q05: 'succeeded' },
      });
      expect(result.minimumGold).toBeGreaterThanOrEqual(0);
      expect(result.months).toBeLessThanOrEqual(20);
      expect(result.completed.Q05).toBeLessThan(result.completed.Q02);
      expect(result.completed.Q02).toBeLessThan(result.completed.Q03);
      expect(result.priestXp).toBeGreaterThan(0);
      expect(result.casualties).toBeGreaterThan(0);
      expect(result.encounters.map((e) => [e.quest, e.won])).toEqual([['Q05', true], ['Q02', true], ['Q03', true]]);
      expect(result.encounters.find((e) => e.quest === 'Q03')!.participants).toEqual(['priest']);
      expect(result.encounters.every((e) => !e.participants.includes('lord'))).toBe(true);
      expect(result.actions.some((a) => a.includes('hire priest'))).toBe(true);
    }, 15_000);
  }
});
