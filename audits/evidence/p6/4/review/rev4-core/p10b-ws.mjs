import { local, sleep, DEMO, rows, put, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' }); let d, f, r;
const ok = (c, n, x) => console.log(c ? 'OK' : 'FAIL', n, JSON.stringify(x));
try {
  await L.reset('typical');
  d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); f = await d.openApp('f260'); await ready(f);
  await f.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('[data-day="39-' + i + '"] .mark').click(); }); await sleep(5000);
  r = await rows(L, 'eli');
  const ws = r['f260.weekStart'] || {}, wd = r['f260.weekDone'] || {};
  // two days later (the server's rows as another day would find them): Start week 39 keeps the start the first tick dated
  await put(L, 'eli', 'f260.weekStart', Object.assign({}, ws));
  await f.evaluate(() => { document.querySelectorAll('[data-day^="38-"]').forEach(x => { if (!x.classList.contains('done')) x.querySelector('.mark').click(); }); }); await sleep(800);
  await f.evaluate(() => document.querySelector('[data-next="39"]') && document.querySelector('[data-next="39"]').click()); await sleep(1200);
  r = await rows(L, 'eli');
  const sumt = await f.evaluate(() => (document.querySelector('#week-39 .sumt') || {}).textContent);
  ok(ws['39'] && ws['39'] === wd['39'] && r['f260.weekStart']['39'] === ws['39'] && /done in 1 day/.test(sumt || ''), 'the first tick dates the week; Start week keeps it; "done in 1 day"', { ws: JSON.stringify(ws), wd: JSON.stringify(wd), afterAll: JSON.stringify(r['f260.weekStart']), ws39: ws['39'], wd39: wd['39'], after: r['f260.weekStart']['39'], sumt });
  await d.close();
} catch (e) { console.log(e); } finally { await L.close(); }
