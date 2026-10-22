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
    // Seed 11 is one where the alliance ends Act I before the party reaches the tower.
    const result = playQuestExpedition(11, { finishChapter: true, cityChoices: 'buy-convict', woodlandAccord: true });
    expect(result).toMatchObject({
      status: 'won', ending: 'chapter-complete', woodlandResolution: 'succeeded',
      cityResolutions: { Q01: 'succeeded', Q06: 'succeeded' },
      resolutions: { Q02: 'succeeded', Q05: 'succeeded' },
      unpaid: 0, foodShortages: 0, corrections: 0,
    });
    expect(result.woodlandCompleted).toBeLessThan(result.cityCompleted.Q06);
    expect(result.completed.Q03).toBeUndefined();
    expect(result.months).toBeLessThan(playQuestExpedition(11, { finishChapter: true, cityChoices: 'buy-convict' }).months);
  }, 30_000);

  it('can return from the expedition and finish the chapter after Westmere fell before M03 unlocked', () => {
    // Seed 13 is one where the orcs take Westmere before M03 unlocks.
    const result = playQuestExpedition(13, { finishChapter: true });
    expect(result).toMatchObject({
      status: 'won', ending: 'chapter-complete', crossing: 'superseded', westmereOwner: 'orcs',
      rulerAlive: true, priestAlive: true, unpaid: 0, foodShortages: 0, corrections: 0,
      resolutions: { Q02: 'succeeded', Q03: 'succeeded', Q05: 'succeeded' },
    });
    expect(result.actions.some((a) => a.includes('Q00: sign after expedition'))).toBe(true);
  }, 15_000);

  it('never sends the priest into the vault alone: it waits for a hired fighter (tower retries are covered in encounters.test)', () => {
    const result = playQuestExpedition(9);
    const attempts = result.encounters.filter((e) => e.quest === 'Q03');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].won).toBe(true);
    expect(attempts[0].participants).toContain('priest');
    expect(attempts[0].participants.some((p) => p === 'champion' || p === 'mage')).toBe(true);
    expect(result).toMatchObject({ priestAlive: true, rulerAlive: true, resolutions: { Q03: 'succeeded' }, draughts: 3 });
    const month = (pattern: RegExp) => Number(result.actions.find((a) => pattern.test(a))!.split(':')[0]);
    expect(month(/Q03: enter/)).toBeGreaterThan(month(/hire (champion|mage)/));
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
      // Each encounter is won in the end (a lost first attempt is followed by another, once the party has rebuilt).
      for (const quest of ['Q05', 'Q02', 'Q03']) expect(result.encounters.filter((e) => e.quest === quest).at(-1)!.won).toBe(true);
      expect(result.encounters.map((e) => e.quest).filter((q, i, all) => all.indexOf(q) === i)).toEqual(['Q05', 'Q02', 'Q03']);
      // The minotaur is beyond a lone priest (docs/encounter-odds.md): a hired champion or mage goes in with them.
      const tower = result.encounters.find((e) => e.quest === 'Q03')!.participants;
      expect(tower).toHaveLength(2);
      expect(tower).toContain('priest');
      expect(tower.some((p) => p === 'champion' || p === 'mage')).toBe(true);
      expect(result.encounters.every((e) => !e.participants.includes('lord'))).toBe(true);
      expect(result.actions.some((a) => a.includes('hire priest'))).toBe(true);
    }, 15_000);
  }
});
