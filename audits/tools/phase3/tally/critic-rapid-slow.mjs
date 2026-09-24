// Completeness critic: rapid taps while flushes and pulls are in flight on a slow link (rapid.mjs ran on a fast link,
// where each burst fit in one 250 ms debounce and one POST). Here every POST /batch and GET is delayed 700 ms, + is tapped
// 60 times at ~110 ms intervals (so several flushes overlap the taps), and hub.pull() is forced 3 times mid-burst.
// Expected: display and server both end at start + 60.
// Run: node "audits/tools/phase3/tally/critic-rapid-slow.mjs"  -> audits/evidence/p3/tally/critic-rapid-slow.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const res = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('tally'); await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 }); await sleep(1500);
    let posts = 0, gets = 0;
    await d.ctx.route(u => u.href.includes('/api/data/tally'), async r => { if (r.request().method() === 'POST') posts++; else gets++; await sleep(700); r.continue().catch(() => {}); });
    const start = await server();
    for (let i = 0; i < 60; i++) {
      await f.locator('#plus').click();
      if (i === 10 || i === 30 || i === 50) f.evaluate(() => hub.pull()).catch(() => {});
      await sleep(110);
    }
    await sleep(6000);
    res[engine] = { start, shown: await f.evaluate(() => document.getElementById('n').textContent), server: await server(), expected: start + 60, posts, gets, queue: await f.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli')) };
    console.log(engine, JSON.stringify(res[engine]));
  } finally { await L.close(); }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/critic-rapid-slow.json', JSON.stringify(res, null, 2));
