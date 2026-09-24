// Skeptic #1 for critic-warm-cache-stale-start-replaces-timer-1: with a WARM timer cache (no timer.active in it), does the
// Timer open on a stale idle screen with a live Start, and does one Start replace a timer Eli started on another device?
// Independent of the investigator's script: the 15-minute timer is started through the UI on the rig's Kitchen iPad
// (not via the API), the phone's timer-channel GETs are held (mode 'hold') or not ('ctrl'), and the Kitchen iPad's own
// view is checked afterwards. Only GET /api/data/timer?... is held; the flush POST /api/data/timer/batch is not.
// Run: node "audits/tools/phase3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-1.mjs"
//   -> audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-1.json (+ before-tap PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
const P = 'verify-critic-warm-cache-stale-start-replaces-timer-1-1';
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const st = f => f.evaluate(() => ({ t: document.getElementById('t').textContent, go: document.getElementById('go').textContent,
  primary: document.getElementById('go').classList.contains('btn-primary'), live: typeof document.getElementById('go').onclick === 'function' }));
async function server(L) { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) if (it.key === 'timer.active') o.active = { value: it.value, updated_at: it.updated_at }; return o; }
const out = {};
for (const mode of ['hold', 'ctrl']) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    // 1. Eli's phone (new paired device) warms its cache on Home.
    const nd = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
    const gets = [];
    phone.page.on('request', r => { if (/\/api\/data\/timer/.test(r.url())) gets.push({ m: r.method(), u: r.url().replace(/^.*\/api/, '/api'), at: Date.now() }); });
    await phone.goto('#home'); await sleep(3000);
    // 2. Eli starts a 15-minute timer on the Kitchen iPad through the app UI.
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('timer', { wait: '#go' });
    for (let i = 0; i < 60 && !(await st(fi)).live; i++) await sleep(50);
    await fi.click('[data-s="900"]'); await fi.click('#go');
    o.ipadAfterStart = await st(fi);
    for (let i = 0; i < 40; i++) { o.serverBefore = await server(L); if (o.serverBefore.active && o.serverBefore.active.value && o.serverBefore.active.value.total === 900) break; await sleep(250); }
    // 3. Phone cache just before opening: warm (since > 0) and without the new timer?
    o.phoneCacheBeforeOpen = await phone.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || 'null'); return c && { since: c.since, keys: Object.keys(c.items), active: c.items['timer.active'] ? c.items['timer.active'].v : undefined }; });
    let held = 0;
    if (mode === 'hold') await phone.ctx.route(u => /\/api\/data\/timer\?/.test(u.href), async r => { held++; await sleep(9000); await r.continue().catch(() => {}); });
    const t0 = Date.now(); gets.length = 0;
    await phone.page.evaluate(() => { location.hash = '#timer'; });
    let f; for (let i = 0; i < 200 && !(f = phone.frame('timer')); i++) await sleep(25);
    await f.waitForSelector('#go');
    for (let i = 0; i < 200; i++) { if ((await st(f).catch(() => ({}))).live) { o.liveAtMs = Date.now() - t0; break; } await sleep(25); }
    o.beforeTap = await st(f); o.beforeTapAtMs = Date.now() - t0;
    const png = path.join(EVD, `${P}-${mode}-before-tap.png`);
    await phone.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' }); o.beforeTapShot = rel(png);
    if (mode === 'hold') {
      await sleep(300);
      await f.click('#go'); o.tapAtMs = Date.now() - t0;
      await sleep(500); o.afterTap = await st(f);
    }
    await sleep(mode === 'hold' ? 12000 : 2000);
    o.held = held;
    o.phoneFinal = await st(f);
    o.serverAfter = await server(L);
    await fi.evaluate(() => hub.pull()).catch(() => {}); await sleep(1500);
    o.ipadFinal = await st(fi);
    o.timerRequests = gets.map(g => ({ m: g.m, u: g.u.slice(0, 80), atMs: g.at - t0 }));
    o.replaced = !!(o.serverAfter.active && o.serverBefore.active && o.serverAfter.active.value && o.serverAfter.active.value.total !== o.serverBefore.active.value.total);
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVD, P + '.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log('saved', rel(path.join(EVD, P + '.json')));
