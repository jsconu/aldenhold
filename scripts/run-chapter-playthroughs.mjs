import { createServer } from 'vite';

const seeds = process.argv.slice(2).map(Number);
if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)) {
  throw new Error('Pass positive 32-bit integer seeds, for example: npm run simulate:chapter -- 1 42 2026');
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { playChapter } = await server.ssrLoadModule('/src/game/testing/chapterPlaythrough.ts');
  const results = (seeds.length ? seeds : [1, 42, 2026]).flatMap((seed) => ['charter', 'ignore'].map((crossing) => playChapter(seed, crossing)));
  console.table(results.map(({ actions, completed, resolutions, raids, ...result }) => ({ ...result, objectives: JSON.stringify(completed), raids: raids.length })));
  if (process.env.CHAPTER_TRACE === '1') for (const result of results) console.log(result.seed, result.actions.join('\n'));
  if (results.some((r) => r.ending !== 'chapter-complete' || !r.rulerAlive || r.unpaid || r.foodShortages || r.corrections)) process.exitCode = 1;
} finally {
  await server.close();
}
