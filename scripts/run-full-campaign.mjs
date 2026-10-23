import {createServer} from 'vite';
const args=process.argv.slice(2),reportOnly=args.includes('--report-only');
const seeds=args.filter(a=>a!=='--report-only').map(Number);
if(seeds.some(s=>!Number.isSafeInteger(s)||s<1||s>0xffffffff))throw new Error('Use positive 32-bit seeds.');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {playChapter}=await server.ssrLoadModule('/src/game/testing/chapterPlaythrough.ts');
 const results=(seeds.length?seeds:[1,42,2026]).map(seed=>playChapter(seed,'charter',60,true));
 console.table(results.map(r=>({seed:r.seed,status:r.status,months:r.months,gold:r.gold,rulerAlive:r.rulerAlive,unpaid:r.unpaid,foodShortages:r.foodShortages,corrections:r.corrections,remaining:r.remaining?.join(',')})));
 if(process.env.CHAPTER_TRACE==='1')for(const r of results)console.log(r.seed,r.actions.join('\n'));
 if(!reportOnly && results.some(r=>r.status!=='won'||!r.rulerAlive||r.unpaid||r.foodShortages||r.corrections))process.exitCode=1;
}finally{await server.close();}
