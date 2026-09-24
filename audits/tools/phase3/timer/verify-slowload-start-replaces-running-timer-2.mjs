// Skeptic 2 for Phase 3 finding "slowload-start-replaces-running-timer" (Kitchen timer).
// Independent of slowload.mjs. Local rig only (WebKit, typical seed, real clock). Three runs on fresh seeds:
//   A control : Elizabeth's brand-new phone opens Timer with no delay -> does it show her running timer?
//   B slow    : every data pull (GET /api/data/<app>?...) on the new phone is held 9 s (a slow link, not only the timer
//               channel). Taps before hub.ready are counted; after the Start handler is attached one tap on Start.
//               Her kitchen iPad (already showing the running timer) is then pulled: what does its pill show?
//   C failed  : the new phone's first GET /api/data/timer answers 503 once (a flaky first request), then normal.
// Run: node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-2.mjs"
// Output: audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-2.json (+ 2 PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
const PFX = 'verify-slowload-start-replaces-running-timer-2';
fs.mkdirSync(EVD, { recursive: true });
const shot = async (page, tag) => { const f = path.join(EVD, `${PFX}-${tag}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).split(path.sep).join('/'); };
const appState = f => f.evaluate(() => ({ time: document.getElementById('t').textContent, go: document.getElementById('go').textContent,
  primary: document.getElementById('go').classList.contains('btn-primary'), handler: typeof document.getElementById('go').onclick === 'function',
  on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent) }));
const pill = page => page.evaluate(() => { const a = document.getElementById('timer-pill'), b = document.getElementById('pill-timer');
  return { pill: a && !a.hidden ? document.getElementById('timer-pill-time').textContent : null, chip: b && !b.hidden ? document.getElementById('pill-timer-time').textContent : null }; });
async function server(L) { const r = await L.apiAs('mom', '/api/data/timer?scope=person'); const it = ((r.body && r.body.items) || []).find(i => i.key === 'timer.active'); return it ? { value: it.value, updated_at: it.updated_at } : null; }
async function waitFrame(d, id) { for (let i = 0; i < 150; i++) { const f = d.frame(id); if (f) return f; await sleep(100); } throw new Error('no frame ' + id); }

const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  // ── A control ──────────────────────────────────────────────────────────────
  {
    const nd = await L.newDevice({ name: 'Mom phone A', profiles: ['mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
    const before = await server(L);
    await d.goto('#timer'); const f = await waitFrame(d, 'timer'); await f.waitForSelector('#go');
    await sleep(2500);
    out.A_control = { serverBefore: before, app: await appState(f), secsLeftOnServer: before && Math.round((before.value.endAt - Date.now()) / 1000) };
    await d.close();
  }
  // ── B slow link ────────────────────────────────────────────────────────────
  {
    await L.reset('typical');
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
    await ipad.goto('#home'); await sleep(3000);
    const nd = await L.newDevice({ name: 'Mom phone B', profiles: ['mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
    const held = [];
    await d.ctx.route(u => /\/api\/data\/[^/]+\?/.test(u.pathname + u.search) && !/\/batch\?/.test(u.href), async r => { held.push(new URL(r.request().url()).pathname); await sleep(9000); await r.continue().catch(() => {}); });
    const before = await server(L);
    const ipadBefore = await pill(ipad.page);
    const t0 = Date.now();
    await d.goto('#timer'); const f = await waitFrame(d, 'timer'); await f.waitForSelector('#go');
    const frameAt = Date.now() - t0;
    await sleep(1500);
    const early = { atMs: Date.now() - t0, app: await appState(f), shell: await pill(d.page) };
    await f.click('#go'); await sleep(400);
    const earlyAfterTap = await appState(f);
    const s1 = await shot(d.page, 'B-early-iphone');
    let readyAt = null; for (let i = 0; i < 200; i++) { if ((await appState(f)).handler) { readyAt = Date.now() - t0; break; } await sleep(100); }
    const atReady = await appState(f);
    await f.click('#go'); const tapAt = Date.now() - t0; await sleep(700);
    const afterTap = await appState(f);
    await sleep(14000);                                           // held pulls land, queue flushes
    await d.page.evaluate(() => hub.pull()).catch(() => {}); await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(1500);
    const phoneLate = { app: await appState(f), queue: await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.timer')).map(k => localStorage.getItem(k))) };
    const after = await server(L);
    await ipad.page.evaluate(() => hub.pull()); await sleep(1500);
    const ipadAfter = await pill(ipad.page);
    const s2 = await shot(ipad.page, 'B-kitchen-ipad-after');
    out.B_slow = { serverBefore: before, ipadPillBefore: ipadBefore, frameLoadedMs: frameAt, early, earlyAfterTap, handlerAttachedMs: readyAt, atReady,
      startTapMs: tapAt, afterTap, phoneLate, serverAfter: after, ipadPillAfterPull: ipadAfter, heldRequests: held.length, heldPaths: [...new Set(held)], shots: [s1, s2],
      replaced: !!(before && after && after.value && after.value.endAt !== before.value.endAt), originalSecsLeftAtEnd: before && Math.round((before.value.endAt - Date.now()) / 1000) };
    await d.close(); await ipad.close();
  }
  // ── C failed first request ─────────────────────────────────────────────────
  {
    await L.reset('typical');
    const nd = await L.newDevice({ name: 'Mom phone C', profiles: ['mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
    let failed = 0;
    await d.ctx.route(/\/api\/data\/timer\?/, async r => { if (failed < 2) { failed++; return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); } return r.continue(); });
    const before = await server(L);
    const t0 = Date.now();
    await d.goto('#timer'); const f = await waitFrame(d, 'timer'); await f.waitForSelector('#go');
    let readyAt = null; for (let i = 0; i < 100; i++) { if ((await appState(f)).handler) { readyAt = Date.now() - t0; break; } await sleep(100); }
    const atReady = await appState(f);
    await f.click('#go'); await sleep(2500);
    const after = await server(L);
    out.C_failed = { serverBefore: before, failedResponses: failed, handlerAttachedMs: readyAt, atReady, afterTap: await appState(f), serverAfter: after,
      replaced: !!(before && after && after.value && after.value.endAt !== before.value.endAt) };
    await d.close();
  }
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(EVD, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/timer/' + PFX + '.json');
