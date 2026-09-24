// Skeptic #2 for critic-rapid-taps-slow-link-exact-6: do rapid + taps stay exact on a slow link while flushes and pulls overlap?
// Independent of critic-rapid-slow.mjs: two delay modes —
//   'request'  : each /api/data/tally request is held 800 ms BEFORE it reaches the Worker (the investigator's shape);
//   'response' : the Worker answers at once but the reply is held 800 ms (server already applied the write while the
//                client still has it in flight — pulls in between then see the newer server value).
// 50 taps ~90 ms apart, hub.pull() forced after taps 5, 20, 35; a second device (Eli iPad, same profile) pulls at the end.
// Run: node "audits/tools/phase3/tally/verify-critic-rapid-taps-slow-link-exact-6-2.mjs"
//   -> audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-2.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const TAPS = 50, DELAY = 800;
const res = {};
for (const [engine, mode] of [['webkit', 'request'], ['webkit', 'response'], ['chromium', 'response']]) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    await sleep(1500);
    let posts = 0, gets = 0; const postItems = [];
    await d.ctx.route(u => u.href.includes('/api/data/tally'), async r => {
      const req = r.request();
      if (req.method() === 'POST') { posts++; try { postItems.push(JSON.parse(req.postData()).items.map(i => i.value)); } catch {} } else gets++;
      if (mode === 'request') { await sleep(DELAY); return r.continue().catch(() => {}); }
      try { const resp = await r.fetch(); const body = await resp.body(); await sleep(DELAY); await r.fulfill({ response: resp, body }); } catch { r.abort().catch(() => {}); }
    });
    const start = await server();
    const shownStart = await f.evaluate(() => document.getElementById('n').textContent);
    const mid = [];
    for (let i = 0; i < TAPS; i++) {
      await f.locator('#plus').click();
      if (i === 5 || i === 20 || i === 35) f.evaluate(() => hub.pull()).catch(() => {});
      if (i % 10 === 9) mid.push({ tap: i + 1, shown: Number(await f.evaluate(() => document.getElementById('n').textContent)) });
      await sleep(90);
    }
    const shownRightAfter = await f.evaluate(() => document.getElementById('n').textContent);
    await sleep(8000);
    await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(2500);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f2 = await ipad.openApp('tally');
    await f2.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    await sleep(2500);
    const monotonic = mid.every((m, k) => m.shown === start + m.tap && (k === 0 || m.shown > mid[k - 1].shown));
    res[`${engine}-${mode}`] = {
      start, shownStart, expected: start + TAPS, mid, monotonic, shownRightAfter,
      shownEnd: await f.evaluate(() => document.getElementById('n').textContent),
      server: await server(),
      secondDevice: await f2.evaluate(() => document.getElementById('n').textContent),
      queue: await f.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli')),
      sync: await f.evaluate(() => hub.sync.state),
      posts, gets, postItems,
    };
    console.log(`${engine}-${mode}`, JSON.stringify({ ...res[`${engine}-${mode}`], postItems: undefined, postValuesLast: postItems.map(p => p.at(-1)) }));
  } finally { await L.close(); }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/verify-critic-rapid-taps-slow-link-exact-6-2.json', JSON.stringify(res, null, 2));
