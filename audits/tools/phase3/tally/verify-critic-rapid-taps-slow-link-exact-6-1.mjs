// Skeptic #1 for critic-rapid-taps-slow-link-exact-6: do 60 rapid + taps stay exact on a slow link while flushes and
// pulls overlap the taps? Independent re-run on a fresh local instance, two link profiles per engine:
//   fixed  : every /api/data/tally request (POST batch and GET pull) held 700 ms (the investigator's condition)
//   jitter : each request held a pseudo-random 200-1400 ms (seeded), so pull responses can land after later POSTs
//   fixed-dom (WebKit only): as fixed, but each tap is an in-page el.click(): Playwright's WebKit locator.click() takes
//     ~500 ms per tap here, so this is the run where WebKit taps really are ~110 ms apart
// 60 + taps ~110 ms apart; hub.pull() forced after taps 10, 30, 50. Records every batch POST body value in order.
// Expected (the claim): display and server both end at start + 60, queue empty.
// Run: node "audits/tools/phase3/tally/verify-critic-rapid-taps-slow-link-exact-6-1.mjs"
//   -> audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const res = {};
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (const engine of ['webkit', 'chromium']) {
  for (const link of engine === 'webkit' ? ['fixed', 'jitter', 'fixed-dom'] : ['fixed', 'jitter']) {
    const L = await local({ variant: 'typical', clock: 'real', engine });
    try {
      const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      const f = await d.openApp('tally');
      await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
      await sleep(1500);
      const start = await server();
      const shownBefore = await f.evaluate(() => document.getElementById('n').textContent);
      const posted = []; let posts = 0, gets = 0, other = 0;
      await d.ctx.route(u => u.href.includes('/api/data/tally'), async r => {
        const m = r.request().method();
        if (m === 'POST') { posts++; try { const b = JSON.parse(r.request().postData() || '{}'); posted.push((b.items || []).filter(i => i.key === 'count').map(i => i.value)[0]); } catch {} }
        else if (m === 'GET') gets++; else other++;
        await sleep(link !== 'jitter' ? 700 : 200 + Math.floor(rnd() * 1200));
        r.continue().catch(() => {});
      });
      const t0 = Date.now();
      for (let i = 0; i < 60; i++) {
        if (link === 'fixed-dom') await f.evaluate(() => document.getElementById('plus').click()); else await f.locator('#plus').click();
        if (i === 10 || i === 30 || i === 50) f.evaluate(() => hub.pull()).catch(() => {});
        await sleep(110);
      }
      const burstMs = Date.now() - t0;
      const shownAtEndOfBurst = await f.evaluate(() => document.getElementById('n').textContent);
      await sleep(8000);
      const monotonic = posted.every((v, i) => i === 0 || v >= posted[i - 1]);
      const r = {
        start, shownBefore, shownAtEndOfBurst, shown: await f.evaluate(() => document.getElementById('n').textContent), server: await server(), expected: start + 60,
        posts, gets, other, burstMs, postedValues: posted, monotonic,
        queue: await f.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli')), syncState: await f.evaluate(() => hub.sync.state),
      };
      r.exact = Number(r.shown) === r.expected && r.server === r.expected;
      res[engine + '-' + link] = r;
      console.log(engine, link, JSON.stringify({ ...r, postedValues: posted.length + ' batches: ' + posted.join(',') }));
    } finally { await L.close(); }
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/verify-critic-rapid-taps-slow-link-exact-6-1.json', JSON.stringify(res, null, 2));
