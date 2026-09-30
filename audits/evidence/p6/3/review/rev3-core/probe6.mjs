// Batch 3, Worker A: "Around the table" (IMP-PRAYER-I1) and the one feed line per Pray now run (UX-PRAYER-13), end to end
// against a local Worker. node table-check.mjs <pairing-code>  (HUB_API, default http://127.0.0.1:8900; SHOTS dir)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const CODE = process.argv[2];
const API = process.env.HUB_API || 'http://127.0.0.1:8900';
const SHOTS = process.env.SHOTS || '';
const PORT = 9178, SITE = 'http://localhost:' + PORT;
const PIN = '1357';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const h = {}; for (const k of ['content-type', 'x-device-token', 'x-profile-token']) if (req.headers[k]) h[k] = req.headers[k];
    const r = await fetch(API + req.url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' }); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(PORT);
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, t = 12000) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { const v = await fn(); if (v) return v; } catch {} await sleep(150); } return null; }
async function api(p, { method = 'GET', body, dt, pt } = {}) {
  const h = { 'Content-Type': 'application/json' }; if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt;
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j };
}
async function pairAs(id, pin, name) {
  const pair = (await api('/api/pair', { method: 'POST', body: { code: CODE, name, fp: 'rv3d-' + name } })).body;
  const dt = pair.device_token;
  let l = await api('/api/login', { method: 'POST', dt, body: { profile_id: id, ...(pin ? { pin } : {}) } });
  if (l.body && l.body.error === 'needs_pin_setup') l = await api(`/api/profiles/${id}/pin`, { method: 'POST', dt, body: { pin } });
  return { device: { id: pair.device_id, token: dt, name }, dt, pt: l.body && l.body.profile_token, profile: l.body && l.body.profile, raw: l };
}
const errors = [];
async function open(browser, auth, name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(a => { try { localStorage.setItem('hub.api', JSON.stringify(a.api)); localStorage.setItem('hub.device', JSON.stringify(a.device)); localStorage.setItem('hub.session', JSON.stringify({ token: a.pt, profile: a.profile })); } catch {} }, { api: SITE, device: auth.device, pt: auth.pt, profile: auth.profile });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await page.goto(SITE + '/apps/prayer.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && typeof D !== 'undefined' && D, null, { timeout: 15000 });
  await sleep(400); return { ctx, page };
}
(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const A = await pairAs('eli', PIN, 'rv3d-admin');
    ok(!!A.pt, 'Eli signed in on his phone', JSON.stringify(A.raw.body && A.raw.body.error));
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const tag = Date.now().toString(36);
    const mk = (id, title) => ({ id, title, for: '', phone: '', detail: '', category: 'Personal', cadence: 'daily', days: [], status: 'active', createdAt: day, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: new Date().toISOString() });
    const ids = ['p' + tag + 'a', 'p' + tag + 'b'];
    const mine = (await api('/api/data/prayer?scope=person', { dt: A.dt, pt: A.pt })).body;
    for (const r of ((mine && mine.items) || [])) if (/^prayer:|^prayerDays$/.test(r.key)) await api(`/api/data/prayer/${r.key}?scope=person`, { method: 'DELETE', dt: A.dt, pt: A.pt });
    // prayerDays is created BEFORE the requests (as for anyone who prayed before adding a request): its row id is lower
    await api(`/api/data/prayer/prayerDays?scope=person`, { method: 'PUT', dt: A.dt, pt: A.pt, body: { value: [] } });
    for (const i of ids) await api(`/api/data/prayer/prayer:${i}?scope=person`, { method: 'PUT', dt: A.dt, pt: A.pt, body: { value: mk(i, 'Request ' + i.slice(-1)) } });
    const P = await pairAs('eli', PIN, 'rv3d-phone');
    const { ctx: ic, page: ip } = await open(browser, A, 'ipad', { width: 820, height: 1180 });
    const { ctx: pc, page: pp } = await open(browser, P, 'phone', { width: 390, height: 844 });
    for (const pg of [ip, pp]) await pg.evaluate(() => { D.activeList = 'personal'; save(); go('today'); });
    const srvDays = async () => ((await api('/api/data/prayer?scope=person', { dt: A.dt, pt: A.pt })).body.items.find(i => i.key === 'prayerDays') || {}).value || [];
    await pp.evaluate(() => { window.__rep = []; const m = window.markDay; window.markDay = function () { window.__rep.push(new Error().stack.split('\n')[2].trim().slice(0, 50)); return m.apply(this, arguments); }; });
    console.log('order', JSON.stringify((await api('/api/data/prayer?scope=person', { dt: A.dt, pt: A.pt })).body.items.map(i => i.key)));
    // R1: the iPad ticks A, the phone sees it, the iPad unticks A; then the phone pulls
    await ip.click(`#todayList [data-pray="${ids[0]}"]`); await ip.evaluate(() => hub.flush()); await sleep(700);
    await pp.evaluate(() => hub.pull()); await sleep(1000); await pp.evaluate(() => { window.__rep.length = 0; return hub.flush(); }); await sleep(500);
    ok((await srvDays()).includes(day), 'after the tick the house has today');
    await ip.click(`#todayList [data-pray="${ids[0]}"]`); await ip.evaluate(() => hub.flush()); await sleep(700);
    const afterUntick = await srvDays();
    ok(!afterUntick.includes(day), 'after the untick (nothing else prayed) the house has no today', JSON.stringify(afterUntick));
    console.log('delta order', JSON.stringify((await api('/api/data/prayer?scope=person&since=' + (Date.now() - 3000), { dt: A.dt, pt: A.pt })).body.items.map(i => i.key)));
    await pp.evaluate(() => hub.pull()); await sleep(1200); await pp.evaluate(() => hub.flush()); await sleep(800);
    const d3 = await srvDays(), rep = await pp.evaluate(() => window.__rep.slice());
    ok(!d3.includes(day), 'the phone pulling the untick does not put today back (no one prayed today)', JSON.stringify({ d3, rep }));
    const ph = await pp.evaluate(() => ({ prayed: D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).length, rec: recordDays().has(TODAY), strip: el('todayStrip').textContent }));
    console.log('phone', JSON.stringify(ph));
    // R2: untick then reload on the same device
    await ip.click(`#todayList [data-pray="${ids[1]}"]`); await ip.evaluate(() => hub.flush()); await sleep(500);
    await ip.click(`#todayList [data-pray="${ids[1]}"]`); await sleep(200);
    await ip.reload(); await ip.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(800); await ip.evaluate(() => hub.flush()); await sleep(600);
    ok(!(await srvDays()).includes(day), 'untick then reload on the same device: today stays off', JSON.stringify(await srvDays()));
    // probe2's race, re-run: the phone prays B while the iPad (offline) unticks A
    await ip.click(`#todayList [data-pray="${ids[0]}"]`); await ip.evaluate(() => hub.flush()); await sleep(600);
    await pp.evaluate(() => hub.pull()); await sleep(800);
    await ic.setOffline(true); await sleep(300);
    await pp.click(`#todayList [data-pray="${ids[1]}"]`); await pp.evaluate(() => hub.flush()); await sleep(600);
    await ip.click(`#todayList [data-pray="${ids[0]}"]`); await sleep(300);
    await ic.setOffline(false); await sleep(500); await ip.evaluate(() => hub.flush()); await sleep(1000);
    await pp.evaluate(() => hub.pull()); await ip.evaluate(() => hub.pull()); await sleep(1500);
    await pp.evaluate(() => hub.flush()); await ip.evaluate(() => hub.flush()); await sleep(800);
    const d5 = await srvDays(), rec = await pp.evaluate(() => ({ rec: recordDays().has(TODAY), streak: currentStreak() }));
    ok(d5.includes(day) && rec.rec, 'probe2 race: B prayed today keeps today (house row and the phone record)', JSON.stringify({ d5, rec }));
    ok(!errors.length, 'no page errors', errors.join(' | '));
  } catch (e) { fail++; console.log('  ✗ threw', e.stack); }
  finally { await browser.close(); server.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
})();
