// Skeptic #2 for critic-fake-zero-while-loading-5 (lens: intent and context).
// Does a first open of Tally (no tally cache on the device) paint the placeholder 0 as the person's count, with the name
// pill and live buttons, when the first pull fails or is slow — and is that limited to a cold cache?
//   abort : every GET /api/data/tally?... is aborted (network error) for the first 12 s, then passes. No taps.
//   hold  : the first GET /api/data/tally?... is held 8 s (past hub.ready's 6 s cap). No taps.
//   warm  : open Tally once normally (cache filled), back to Home, then reopen with every tally GET answering 503. No taps.
// Samples #n / #who / hub.sync every 250 ms; server count read before and after (must be unchanged).
// Run: node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-2.mjs"
//   -> audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-2.json (+ -abort-zero.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const TAG = 'verify-critic-fake-zero-while-loading-5-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const sample = f => f.evaluate(() => ({ n: document.getElementById('n').textContent, who: document.getElementById('who').textContent,
  plusDisabled: document.getElementById('plus').disabled, sync: window.hub && hub.sync ? hub.sync.state : null,
  cacheKeys: Object.keys(localStorage).filter(k => k.includes('tally')) })).catch(e => ({ err: String(e).slice(0, 80) }));
async function watch(mode, f, t0, until, phone) {
  const samples = []; let last = null; let firstReal = null; let shot = false;
  while (Date.now() - t0 < until) {
    const s = await sample(f); s.ms = Date.now() - t0;
    const sig = JSON.stringify([s.n, s.who, s.plusDisabled, s.sync]);
    if (sig !== last) { samples.push(s); last = sig; console.log(mode, JSON.stringify(s)); }
    if (mode === 'abort' && !shot && s.who && s.n === '0' && s.ms > 2000) { await phone.page.screenshot({ path: `${OUT}/${TAG}-abort-zero.png`, scale: 'css', animations: 'disabled', caret: 'hide' }); shot = true; }
    if (firstReal === null && s.n && s.n !== '0') { firstReal = s.ms; break; }
    await sleep(250);
  }
  return { samples, realCountShownAtMs: firstReal };
}
try {
  for (const mode of ['abort', 'hold', 'warm']) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'Skeptic2 phone ' + mode, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const before = await server();
    const gets = []; let t0 = Date.now();
    if (mode === 'warm') {
      await phone.goto('#home');
      const f1 = await phone.openApp('tally'); await sleep(2500);
      res.warmFirstOpen = await sample(f1);
      console.log('warm first open', JSON.stringify(res.warmFirstOpen));
      await phone.goto('#home'); await sleep(500);
      t0 = Date.now();
      await phone.ctx.route(u => u.href.includes('/api/data/tally?'), r => { gets.push({ t: Date.now() - t0, status: 503 }); r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); });
      const f = await phone.openApp('tally');
      const w = await watch(mode, f, t0, 8000, phone);
      res[mode] = { serverBefore: before, serverAfter: await server(), gets, ...w };
    } else {
      if (mode === 'abort') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), r => { const t = Date.now() - t0; const fail = t < 12000; gets.push({ t, abort: fail }); if (fail) r.abort('failed'); else r.continue().catch(() => {}); });
      if (mode === 'hold') { let first = true; await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { const t = Date.now() - t0; gets.push({ t, held: first }); if (first) { first = false; await sleep(8000); } r.continue().catch(() => {}); }); }
      await phone.goto('#home'); t0 = Date.now();
      const f = await phone.openApp('tally');
      const w = await watch(mode, f, t0, 45000, phone);
      res[mode] = { serverBefore: before, serverAfter: await server(), gets, ...w };
    }
    console.log(mode, 'server', before, '->', res[mode].serverAfter, 'real count at', res[mode].realCountShownAtMs, 'gets', JSON.stringify(gets));
    await phone.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1));
  await L.close();
}
