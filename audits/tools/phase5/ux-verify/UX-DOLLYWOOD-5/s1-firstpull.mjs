// UX-DOLLYWOOD-5 skeptic s1: first open on a device with no hub cache for the app. What does the guide show while the
// person-scope pull is in flight, is Mark done live, is there any loading cue, how long is the window with no hold, and
// what does a tick in that window do to the server row. Also a control: a second open on the same device (cache warm).
//   node audits/tools/phase5/ux-verify/UX-DOLLYWOOD-5/s1-firstpull.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-5/s1');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const PULL = /\/api\/data\/dollywood\?scope=person/;
const server = async (L) => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = it && it.value; return { ticks: v ? Object.values(v).filter(Boolean).length : 0, updated_at: it && it.updated_at }; };
const ui = f => f.evaluate(() => { const b = document.getElementById('b-done'); const t = document.body.innerText;
  return { count: document.getElementById('b-count').textContent, entranceChip: (document.querySelector('#chips [data-sec="entrance"] .cl') || {}).textContent, markDone: b ? { text: b.textContent, disabled: b.disabled } : null,
    loadingWords: (t.match(/loading|syncing|fetching|getting your|one moment/gi) || []), sync: window.hub && hub.sync.state, lastPull: window.hub && hub.sync.lastPull || null }; });
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  log('seed', await server(L));
  // A: unheld first open, poll the count every 25 ms from the moment the frame exists
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood');
    const t0 = Date.now(); const seen = []; let last = null;
    while (Date.now() - t0 < 6000) { const c = await f.evaluate(() => { const e = document.getElementById('b-count'); return e ? e.textContent : null; }).catch(() => null); if (c !== last) { seen.push({ ms: Date.now() - t0, count: c }); last = c; } await sleep(25); }
    log('A.unheldFirstOpen.countTimeline', seen);
    // B: second open on the same device (cache warm), held pull: does it show the right count at once?
    await d.ctx.route(PULL, async r => { await sleep(4000); r.continue().catch(() => {}); });
    await d.goto(''); await sleep(500);
    const f2 = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(800);
    log('B.warmCacheHeldPull', await ui(f2));
    await d.close();
  }
  // C: fresh device, pull held 5 s (as the report), iPhone
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.route(PULL, async r => { await sleep(5000); r.continue().catch(() => {}); });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(800);
    log('C.duringHeldPull', await ui(f));
    await d.page.screenshot({ path: path.join(EV, 'iphone-during-held-pull.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(6000);
    log('C.afterPull', await ui(f));
    await d.close();
  }
  // D: fresh device, pull held, tick during the window (JS click on Mark done), then let the pull land
  {
    const before = await server(L);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.route(PULL, async r => { await sleep(5000); r.continue().catch(() => {}); });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(800);
    const during = await ui(f);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(7000);
    log('D.tickDuringPull', { before, during, after: await ui(f), server: await server(L) });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'firstpull.json'), JSON.stringify(out, null, 1));
  await L.close();
}
