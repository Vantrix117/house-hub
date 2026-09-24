// Skeptic #1 for critic-fake-zero-while-loading-5: on a first open (no tally cache on the device) with a slow or failing
// first pull, does Tally paint 0 as the count, with live buttons, until a later pull lands?
//   fail    : every GET /api/data/tally?... answers 503 for the first 20 s, then passes through. No taps.
//   hold    : the first GET /api/data/tally?... is held 9 s. No taps.
//   control : no interference.
// #n, the who pill, hub.sync.state and the button disabled/aria-busy state are sampled every 500 ms for up to 45 s.
// Server count for eli is read before and after (must be unchanged: no taps).
// Run: node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-1.mjs"
//   -> audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-1.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const TAG = 'verify-critic-fake-zero-while-loading-5-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
try {
  for (const mode of ['control', 'hold', 'fail']) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'Skeptic phone ' + mode, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const t0 = Date.now(); const gets = [];
    if (mode === 'hold') { let first = true; await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { const t = Date.now() - t0; gets.push({ t, held: first }); if (first) { first = false; await sleep(9000); } r.continue().catch(() => {}); }); }
    if (mode === 'fail') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { const t = Date.now() - t0; const fail = t < 20000; gets.push({ t, status: fail ? 503 : 'pass' }); if (fail) r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); else r.continue().catch(() => {}); });
    const before = await server();
    const f = await phone.openApp('tally');
    const samples = []; let last = null; let shot = false; let firstReal = null;
    const until = mode === 'control' ? 3000 : 45000;
    while (Date.now() - t0 < until) {
      const s = await f.evaluate(() => ({ n: document.getElementById('n').textContent, who: document.getElementById('who').textContent,
        plusDisabled: document.getElementById('plus').disabled, busy: document.querySelector('[aria-busy]') ? document.querySelector('[aria-busy]').getAttribute('aria-busy') : null,
        sync: window.hub && hub.sync ? hub.sync.state : null, lastPull: window.hub && hub.sync ? hub.sync.lastPull : null })).catch(e => ({ err: String(e).slice(0, 100) }));
      s.ms = Date.now() - t0;
      const sig = JSON.stringify([s.n, s.who, s.plusDisabled, s.busy, s.sync, !!s.lastPull]);
      if (sig !== last) { samples.push(s); last = sig; console.log(mode, JSON.stringify(s)); }
      if (!shot && s.who && s.n === '0' && mode !== 'control' && s.ms > 1500) { await phone.page.screenshot({ path: `${OUT}/${TAG}-${mode}-zero.png`, scale: 'css', animations: 'disabled', caret: 'hide' }); shot = true; }
      if (firstReal === null && s.n && s.n !== '0') firstReal = s.ms;
      if (firstReal !== null && Date.now() - t0 > firstReal + 1500) break;
      await sleep(500);
    }
    const after = await server();
    res[mode] = { serverBefore: before, serverAfter: after, gets, realCountShownAtMs: firstReal, samples };
    console.log(mode, 'server', before, '->', after, 'real count shown at', firstReal, 'gets', JSON.stringify(gets));
    await phone.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1));
  await L.close();
}
