import { createServer } from 'vite';

const seeds = process.argv.slice(2).map(Number);
if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)) {
  throw new Error('Pass positive 32-bit integer seeds, for example: npm run simulate:quests -- 1 42 2026');
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { playQuestExpedition } = await server.ssrLoadModule('/src/game/testing/questExpedition.ts');
  const results = (seeds.length ? seeds : [1, 42, 2026]).map((seed) => playQuestExpedition(seed, { finishChapter: process.env.CHAPTER_FINISH === '1' }));
  console.table(results.map(({ actions, completed, encounters, resolutions, ...result }) => ({ ...result, quests: JSON.stringify(completed) })));
  if (process.env.CHAPTER_TRACE === '1') for (const result of results) console.log(result.seed, result.actions.join('\n'));
  if (results.some((r) => (process.env.CHAPTER_FINISH === '1' && r.ending !== 'chapter-complete') || Object.keys(r.completed).length !== 3 || !r.rulerAlive || !r.priestAlive || r.unpaid || r.foodShortages || r.corrections)) process.exitCode = 1;
} finally {
  await server.close();
}
