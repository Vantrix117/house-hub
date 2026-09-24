// Skeptic #2 for SYNC "done-during-stalled-pull": does tapping Done in F260 during a slow first pull on a new device
// replace the whole reading history on the server?
//   node "audits/tools/phase2/SYNC/verify2-done-during-stalled-pull-2.mjs"            (all scenarios, ~3 min)
//   node "audits/tools/phase2/SYNC/verify2-done-during-stalled-pull-2.mjs" A           (one scenario)
// A  claim, re-run independently: only GET /api/data/f260?… held 10 s on the new phone; Done tapped as soon as F260 paints.
//    A Kitchen iPad (Eli, fully synced before the tap) then pulls: does it adopt the loss?
// B  uniform slow network: EVERY request from the new phone to the API is delayed 8 s (GETs, the batch POST, /api/me …),
//    so the rig's GET-only hold cannot be what lets the POST win. Done tapped as soon as F260 paints.
// C  no tap at all, same hold as A: what the boot alone writes (to separate the Done tap from the known weekStart write).
// D  the first pull FAILS instead of stalling: every GET /api/data/f260?… answers 503 for the first 8 s (a Worker/D1
//    hiccup), then the API is healthy again. hub.ready does not wait 6 s here (the pull rejects at once); Done tapped on paint.
// Prints server f260.done (true keys), f260.log (days), f260.summary before/after and each f260 batch POST.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const only = process.argv[2];

async function counts(L) {
  const get = async k => { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(k)}`); return r.body && r.body.item; };
  const done = await get('f260.done'), lg = await get('f260.log'), sum = await get('f260.summary'), ws = await get('f260.weekStart'), wk = await get('f260.week');
  return {
    doneTrue: done && done.value ? Object.values(done.value).filter(v => v === true).length : null,
    logDays: lg && lg.value ? Object.keys(lg.value).length : null,
    weekStartKeys: ws && ws.value ? Object.keys(ws.value).length : null,
    week: wk ? wk.value : null,
    summary: sum && sum.value ? { week: sum.value.week, total: sum.value.total, streak: sum.value.streak, next: sum.value.next && sum.value.next.ref } : null,
  };
}
const f260Frame = page => page.frames().find(f => f.url().includes('/apps/f260.html'));
async function uiState(f) {
  if (!f) return null;
  return f.evaluate(() => ({
    title: (document.getElementById('todayTitle') || {}).textContent || '',
    meta: (document.getElementById('todayMeta') || {}).textContent || '',
    week: (document.getElementById('curWeekLbl') || {}).textContent || '',
    streak: ((document.getElementById('todayStreak') || {}).textContent || '').trim(),
    hubReady: !!(window.hub && hub.profile),
    lastPull: window.hub ? hub.sync.lastPull || 0 : null,
    syncState: window.hub ? hub.sync.state : null,
  })).catch(e => ({ err: String(e).slice(0, 120) }));
}

async function run(name, { holdGetMs = 0, allLatencyMs = 0, failGetMs = 0, tap = true, ipadCheck = false }) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name, holdGetMs, allLatencyMs, failGetMs, tap };
  try {
    out.before = await counts(L);
    let ipad = null;
    if (ipadCheck) {   // the family's existing device: fully synced before the phone does anything
      ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      const fi = await ipad.openApp('f260', { wait: '#todayDone' });
      for (let i = 0; i < 40; i++) { const s = await uiState(fi); if (s && s.lastPull > 0 && /Week 38/.test(s.meta)) break; await sleep(250); }
      await sleep(800);
      out.ipadBefore = await uiState(fi);
      out.ipadCacheBefore = await ipad.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.f260.person')); if (!k) return null; const c = JSON.parse(localStorage.getItem(k)); const d = c.items['f260.done']; return { key: k, doneTrue: d && d.v ? Object.values(d.v).filter(v => v === true).length : null }; });
    }
    const ph = await L.newDevice({ name: 'Eli new phone ' + name, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let holding = true;
    let t0 = Date.now();
    if (failGetMs) await phone.ctx.route(/\/api\/data\/f260\?/, async route => { if (route.request().method() === 'GET' && Date.now() - t0 < failGetMs) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': L.site }, body: '{"error":"unavailable"}' }).catch(() => {}); route.continue().catch(() => {}); });
    if (holdGetMs) await phone.ctx.route(/\/api\/data\/f260\?/, async route => { if (route.request().method() === 'GET' && holding) await sleep(holdGetMs); route.continue().catch(() => {}); });
    if (allLatencyMs) await phone.ctx.route(u => u.href.startsWith(L.api), async route => { await sleep(allLatencyMs); route.continue().catch(() => {}); });
    t0 = Date.now();
    const net = [];
    phone.page.on('request', r => {
      const u = r.url(); if (!u.startsWith(L.api)) return;
      if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(u)) {
        try { const b = JSON.parse(r.postData()); net.push({ ms: Date.now() - t0, ev: 'POST sent', keys: b.items.map(i => i.key + (i.key === 'f260.done' && i.value ? ` (${Object.values(i.value).filter(v => v === true).length} true)` : i.key === 'f260.log' && i.value ? ` (${Object.keys(i.value).length} days)` : i.key === 'f260.weekStart' && i.value ? ` (${Object.keys(i.value).length} weeks)` : '')) }); } catch {}
      } else if (/\/api\/data\/f260\?/.test(u)) net.push({ ms: Date.now() - t0, ev: r.method() + ' sent', url: u.replace(L.api, '').slice(0, 60) });
    });
    phone.page.on('response', r => { const u = r.url(); if (u.startsWith(L.api) && /\/api\/data\/f260(\?|\/batch)/.test(u)) net.push({ ms: Date.now() - t0, ev: r.request().method() + ' response ' + r.status(), url: u.replace(L.api, '').slice(0, 60) }); });

    await phone.page.goto(L.site + '/index.html#f260', { waitUntil: 'load' });
    // wait until F260's own script has painted Today (i.e. hub.ready resolved in the frame), then tap at once
    let f = null, st = null;
    for (let i = 0; i < 160; i++) { f = f260Frame(phone.page); st = await uiState(f); if (st && st.hubReady && st.title) break; await sleep(250); }
    out.atPaint = { ms: Date.now() - t0, ...st };
    await phone.page.screenshot({ path: path.join(EVID, `verify2-done-during-stalled-pull-2-${name}-phone-before-tap.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    if (tap) {
      await f.click('#todayDone');
      out.tapMs = Date.now() - t0;
      await sleep(400);
      out.afterTapUi = await uiState(f);
      await phone.page.screenshot({ path: path.join(EVID, `verify2-done-during-stalled-pull-2-${name}-phone-after-tap.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    // let every held/delayed request land, then a settle
    await sleep(Math.max(holdGetMs, allLatencyMs * 2, failGetMs) + 8000);
    holding = false;
    await sleep(4000);
    out.phoneAfter = await uiState(f260Frame(phone.page));
    out.phoneCacheAfter = await phone.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.f260.person')); if (!k) return null; const c = JSON.parse(localStorage.getItem(k)); const d = c.items['f260.done'], l = c.items['f260.log']; return { doneTrue: d && d.v ? Object.values(d.v).filter(v => v === true).length : null, logDays: l && l.v ? Object.keys(l.v).length : null }; });
    out.phoneQueueAfter = await phone.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.f260')).map(k => [k, Object.keys(JSON.parse(localStorage.getItem(k)))])));
    out.net = net;
    out.after = await counts(L);
    await phone.page.screenshot({ path: path.join(EVID, `verify2-done-during-stalled-pull-2-${name}-phone-after.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    if (ipad) {   // the iPad pulls (as its 30 s poll / visibility change would) and repaints
      await ipad.page.evaluate(() => hub.pull());
      const fi = f260Frame(ipad.page); await fi.evaluate(() => hub.pull());
      await sleep(2500);
      out.ipadAfter = await uiState(fi);
      out.ipadCacheAfter = await ipad.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.f260.person')); if (!k) return null; const c = JSON.parse(localStorage.getItem(k)); const d = c.items['f260.done']; return { doneTrue: d && d.v ? Object.values(d.v).filter(v => v === true).length : null }; });
      await ipad.page.screenshot({ path: path.join(EVID, `verify2-done-during-stalled-pull-2-${name}-ipad-after.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    out.phoneLogs = phone.logs.filter(l => /error|pageerror/i.test(l)).slice(0, 10);
  } finally { await L.close(); }
  log(`[${name}] before ${JSON.stringify(out.before)}`);
  log(`[${name}] F260 painted at ${out.atPaint.ms} ms: ${JSON.stringify(out.atPaint)}${out.tap ? ' | tap at ' + out.tapMs + ' ms' : ' | no tap'}`);
  for (const n of out.net) log(`[${name}]   ${String(n.ms).padStart(6)} ms ${n.ev} ${n.keys ? JSON.stringify(n.keys) : n.url}`);
  log(`[${name}] server after ${JSON.stringify(out.after)}`);
  log(`[${name}] phone after ${JSON.stringify(out.phoneAfter)} cache ${JSON.stringify(out.phoneCacheAfter)} queue ${JSON.stringify(out.phoneQueueAfter)}`);
  if (out.ipadBefore) log(`[${name}] iPad before ${JSON.stringify(out.ipadCacheBefore)} ${out.ipadBefore.meta} | after ${JSON.stringify(out.ipadCacheAfter)} ${out.ipadAfter && out.ipadAfter.meta} / ${out.ipadAfter && out.ipadAfter.streak}`);
  return out;
}

const res = {};
if (!only || only === 'A') res.A = await run('A', { holdGetMs: 10000, tap: true, ipadCheck: true });
if (!only || only === 'B') res.B = await run('B', { allLatencyMs: 8000, tap: true });
if (!only || only === 'C') res.C = await run('C', { holdGetMs: 10000, tap: false });
if (!only || only === 'D') res.D = await run('D', { failGetMs: 8000, tap: true });
const file = path.join(EVID, `verify2-done-during-stalled-pull-2${only ? '-' + only : ''}.json`);
fs.writeFileSync(file, JSON.stringify(res, null, 1));
log('wrote ' + path.relative(ROOT, file));
