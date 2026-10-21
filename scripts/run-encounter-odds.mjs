import { createServer } from 'vite';

// Usage: npm run simulate:encounters -- [runs]   (default 200 fights per encounter and party)
const runs = Number(process.argv[2] ?? 200);
if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('Pass a positive number of runs, for example: npm run simulate:encounters -- 500');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { encounterReport } = await server.ssrLoadModule('/src/game/testing/encounterOdds.ts');
  const pct = (x) => `${Math.round(x * 100)}%`;
  console.table(encounterReport(runs).map((r) => ({
    encounter: `${r.quest} ${r.choice} @ ${r.site}`, party: r.party, runs: r.runs,
    win: pct(r.winRate), 'hero died': pct(r.heroDeathRate), losses: pct(r.losses), rounds: r.rounds.toFixed(1),
  })));
} finally {
  await server.close();
}
