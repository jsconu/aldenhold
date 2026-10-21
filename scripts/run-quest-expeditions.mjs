import { createServer } from 'vite';

const seeds = process.argv.slice(2).map(Number);
if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)) {
  throw new Error('Pass positive 32-bit integer seeds, for example: npm run simulate:quests -- 1 42 2026');
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { playQuestExpedition } = await server.ssrLoadModule('/src/game/testing/questExpedition.ts');
  const cityChoices = process.env.CITY_CHOICES;
  const woodlandAccord = process.env.WOODLAND_ACCORD === '1';
  if (cityChoices && !['buy-convict', 'escort-convict', 'ration-pardon'].includes(cityChoices)) {
    throw new Error('CITY_CHOICES must be buy-convict, escort-convict or ration-pardon.');
  }
  const results = (seeds.length ? seeds : [1, 42, 2026]).map((seed) => playQuestExpedition(seed, {
    finishChapter: process.env.CHAPTER_FINISH === '1',
    cityChoices: cityChoices || undefined,
    woodlandAccord,
  }));
  console.table(results.map(({ actions, completed, encounters, resolutions, raids, ...result }) => ({ ...result, quests: JSON.stringify(completed), raids: raids.length })));
  if (process.env.CHAPTER_TRACE === '1') for (const result of results) console.log(result.seed, result.actions.join('\n'));
  if (results.some((r) => (process.env.CHAPTER_FINISH === '1' && r.ending !== 'chapter-complete') ||
    (woodlandAccord ? !['Q02', 'Q05'].every((id) => r.resolutions[id] === 'succeeded') : Object.keys(r.completed).length !== 3) ||
    (cityChoices && Object.keys(r.cityCompleted).length !== 2) ||
    (woodlandAccord && r.woodlandResolution !== 'succeeded') ||
    !r.rulerAlive || !r.priestAlive || r.unpaid || r.foodShortages || r.corrections)) process.exitCode = 1;
} finally {
  await server.close();
}
