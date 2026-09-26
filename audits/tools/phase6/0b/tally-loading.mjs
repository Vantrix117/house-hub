// Batch 0b check for P3-TALLY-02 / -07 / UX-TALLY-2 with human taps. The phase 3 scripts tap with Playwright's
// auto-waiting click, which now waits until + / − enable (after the count arrived). Here the taps are forced (no
// auto-wait): what a finger does on the loading screen. Arms (WebKit iphone-pwa, typical seed, a brand-new phone as Eli,
// server count 37): hold = first tally GET held 9 s; fail = tally GETs answer 503 for 8 s. Taps +, −, Reset at ~2 s.
// Light and dark screenshots of the loading state. Expect: skeleton, disabled + aria-busy, server stays 37, then 37 shown.
// Run: node "audits/tools/phase6/0b/tally-loading.mjs" -> audits/evidence/p6/0b/tally-loading.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0b'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const state = f => f.evaluate(() => ({ n: document.getElementById('n').textContent, skeleton: document.getElementById('n').classList.contains('skeleton'),
  busy: document.querySelector('main').getAttribute('aria-busy'), disabled: ['plus', 'minus', 'reset'].map(id => document.getElementById(id).disabled) }));
const out = {};
try {
  for (const [arm, mode] of [['hold', 'light'], ['fail', 'dark']]) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'Tally 0b ' + arm, profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode, fixedTime: false, as: dev });
    const t0 = Date.now(); let n = 0;
    await d.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { n++;
      if (arm === 'fail') { if (Date.now() - t0 < 8000) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); return r.continue().catch(() => {}); }
      if (n === 1) await sleep(9000); r.continue().catch(() => {}); });
    const o = out[arm] = { serverBefore: await server() };
    const f = await d.openApp('tally');
    await sleep(Math.max(0, 2000 - (Date.now() - t0)));
    o.loading = await state(f);
    await d.page.screenshot({ path: `${OUT}/tally-loading-${arm}-${mode}.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    for (const sel of ['#plus', '#minus', '#reset']) await f.locator(sel).click({ force: true, timeout: 2000 }).catch(() => {});
    o.afterTaps = await state(f);
    await f.waitForFunction(() => !document.getElementById('plus').disabled, null, { timeout: 40000 });
    o.liveAtMs = Date.now() - t0; o.loaded = await state(f);
    await d.page.screenshot({ path: `${OUT}/tally-loading-${arm}-${mode}-loaded.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(1500); o.serverAfter = await server(); o.gets = n;
    console.log(arm, JSON.stringify(o));
    await d.close();
  }
} finally { fs.writeFileSync(`${OUT}/tally-loading.json`, JSON.stringify(out, null, 1)); await L.close(); }
