import { createServer } from 'vite';

// Usage: npm run simulate:raids -- [runs] [tour seeds...]   (default 100 raids per lair and garrison; tour seeds 1–10)
const [runsArg, ...seedArgs] = process.argv.slice(2);
const runs = Number(runsArg ?? 100);
const seeds = seedArgs.length ? seedArgs.map(Number) : Array.from({ length: 10 }, (_, i) => i + 1);
if (!Number.isSafeInteger(runs) || runs < 1 || seeds.some((s) => !Number.isSafeInteger(s) || s < 1)) {
  throw new Error('Pass a positive number of runs, then optional tour seeds, for example: npm run simulate:raids -- 200 1 42');
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { frontierReport, garrisonReport, tourReport } = await server.ssrLoadModule('/src/game/testing/raidReport.ts');
  const pct = (x) => `${Math.round(x * 100)}%`;
  console.log('Raids on Westmere, one lair at a time, by garrison:');
  console.table(garrisonReport(runs).map((r) => ({
    lair: r.lair, garrison: r.garrison, defence: r.defence.toFixed(1), 'monthly chance': r.deterred ? 'deterred' : pct(r.chance),
    held: pct(r.held), 'men lost': r.garrisonLost.toFixed(1), gold: Math.round(r.gold), people: Math.round(r.people),
  })));
  console.log('Every frontier town held for two years with the same garrison (per campaign, averaged over the seeds):');
  console.table(frontierReport(seeds).map(({ results, ...r }) => ({
    ...r, raidsPerTownYear: r.raidsPerTownYear.toFixed(2), gold: Math.round(r.gold), people: Math.round(r.people),
    damaged: r.damaged.toFixed(1), garrisonLost: Math.round(r.garrisonLost), results: JSON.stringify(results),
  })));
  console.log('Raids over full chapter tours (the controller holds only Aldenhold and Millbrook, out of every lair’s reach):');
  console.table(tourReport(seeds).map(({ results, ...t }) => ({ ...t, results: JSON.stringify(results) })));
} finally {
  await server.close();
}
