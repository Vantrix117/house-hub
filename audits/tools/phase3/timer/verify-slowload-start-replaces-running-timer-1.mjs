// Skeptic #1 for "slowload-start-replaces-running-timer" (Kitchen timer). Independent reproduction, local rig only.
// Elizabeth (mom) has a 15-minute timer running on the server (seed). A brand-new paired device for her opens #timer.
// Scenarios (each on a freshly reset 'typical' seed, WebKit, real clock, iphone-pwa):
//   hold9  - every GET /api/data/timer held 9 s (hub.ready's race is 6 s, apps/hub.js:337); tap Start once the handler is live
//   lat8   - EVERY /api/* request (GET and POST, all apps) delayed 8 s: a uniformly slow network, not a GET-only artefact
//   fail   - the first two GET /api/data/timer answer 503 (a failed first pull), then normal
//   ctrl   - no interference (control): the app should resume the 15-minute countdown
// Run: node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-1.mjs"
// Output: audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-1.json (+ one PNG for hold9)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer'); fs.mkdirSync(EVD, { recursive: true });
const NAME = 'verify-slowload-start-replaces-running-timer-1';
const srv = async (L) => { const r = await L.apiAs('mom', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = { value: it.value, updated_at: it.updated_at }; return o; };
const ui = f => f.evaluate(() => ({ t: document.getElementById('t').textContent, go: document.getElementById('go').textContent,
  primary: document.getElementById('go').classList.contains('btn-primary'), handler: typeof document.getElementById('go').onclick === 'function',
  cached: (() => { try { return window.hub && hub.get('timer.active'); } catch (e) { return 'err ' + e.message; } })() }));
const shell = p => p.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent,
  chip: document.getElementById('pill-timer').hidden ? null : document.getElementById('pill-timer-time').textContent }));

const out = { started: new Date().toISOString() };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const sc of ['hold9', 'lat8', 'fail', 'ctrl']) {
    await L.reset('typical');
    const r = { serverBefore: await srv(L), timeline: [] };
    const nd = await L.newDevice({ name: 'Mom new phone ' + sc, profiles: ['mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
    let n = 0;
    if (sc === 'hold9') await d.ctx.route(/\/api\/data\/timer\?/, async q => { n++; await sleep(9000); await q.continue().catch(() => {}); });
    if (sc === 'lat8') await d.ctx.route(u => u.href.startsWith(L.api + '/api/'), async q => { n++; await sleep(8000); await q.continue().catch(() => {}); });
    if (sc === 'fail') await d.ctx.route(/\/api\/data\/timer\?/, async q => { n++; if (n <= 2) return q.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); await q.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.goto('#timer');
    let f; for (let i = 0; i < 150 && !(f = d.frame('timer')); i++) await sleep(100);
    await f.waitForSelector('#go');
    // sample the UI every 500 ms until the Start handler is attached (hub.ready resolved), max 12 s
    let s;
    for (let i = 0; i < 24; i++) { s = await ui(f); r.timeline.push({ ms: Date.now() - t0, ...s, shell: await shell(d.page) }); if (s.handler) break; await sleep(500); }
    r.readyAtMs = Date.now() - t0;
    r.atReady = { ...s, shell: await shell(d.page) };
    if (sc === 'hold9') r.shot = path.relative(ROOT, path.join(EVD, NAME + '-hold9-before-tap.png')).split(path.sep).join('/'), await d.page.screenshot({ path: path.join(EVD, NAME + '-hold9-before-tap.png'), scale: 'css', animations: 'disabled' });
    // she taps the primary button once, exactly as it is offered
    if (s.handler && s.go === 'Start') { await f.click('#go'); r.tappedAtMs = Date.now() - t0; await sleep(600); r.afterTap = await ui(f); }
    else r.tapped = 'not tapped: button reads ' + s.go;
    await sleep(sc === 'lat8' ? 20000 : 11000);          // let held pulls land and the queue flush
    await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(sc === 'lat8' ? 9000 : 1500);
    r.afterSettle = { app: await ui(f), shell: await shell(d.page) };
    r.intercepted = n;
    r.serverAfter = await srv(L);
    const b = r.serverBefore['timer.active'], a = r.serverAfter['timer.active'];
    r.verdict = { beforeTotal: b && b.value && b.value.total, beforeEndAt: b && b.value && b.value.endAt, afterTotal: a && a.value && a.value.total, afterEndAt: a && a.value && a.value.endAt,
      replaced: !!(b && a && a.value && b.value && a.value.endAt !== b.value.endAt) };
    out[sc] = r;
    console.log(sc, JSON.stringify({ readyAtMs: r.readyAtMs, atReady: { t: s.t, go: s.go, primary: s.primary, cached: s.cached, shell: r.atReady.shell }, firstSample: r.timeline[0] && { ms: r.timeline[0].ms, t: r.timeline[0].t, go: r.timeline[0].go, handler: r.timeline[0].handler }, afterTap: r.afterTap && { t: r.afterTap.t, go: r.afterTap.go }, afterSettle: r.afterSettle, intercepted: n, verdict: r.verdict }));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EVD, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/timer/' + NAME + '.json');
