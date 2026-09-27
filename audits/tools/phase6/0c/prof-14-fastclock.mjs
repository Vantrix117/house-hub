// Phase 6, batch 0c: phase2/PROF/verify4-p2-prof-14-2.mjs with one change of instrumentation only. Batch 0c keys every
// queue by its writer (hub.queue.<app>.family.<pid>), so the original, which reads hub.queue.<app>.family, saw an empty
// queue at once and read the server before the flush. Here every read of a family queue merges all keys under that
// prefix. Evidence goes to audits/evidence/p6/0c/. Nothing else differs.
// PROF skeptic #2 (round 4) for P2-PROF-14 — "future-stamped writes (a fast-clocked device, or a write made before the
// first pull sets hub.skew) make other people's edits silently revert for up to 5 minutes".
// The two halves (E2: a fast clock lands a row ~5 min ahead; D: a stale edit reverts) were never run as one chain.
// This runs the WHOLE chain through the shipped UI only (taps in the real apps; no hand-made API writes), on two devices,
// and runs the same chain with a correct clock as the control, so the future stamp's own effect can be separated from the
// stale-copy last-write-wins race that exists without it.
//
//   node "audits/tools/phase2/PROF/verify4-p2-prof-14-2.mjs"        (about 14 minutes: it waits out the 5-minute stamp and the fast clock)
//
// P-* Prayer, family list, one family request row (prayer:<id>) — an ACCUMULATING row (prayedBy[today] name list):
//     A = Dad's iPhone (clock AHEAD, or correct for the control). Opened online once (warm cache), then reopened OFFLINE
//         (fresh hub.js, hub.skew = 0) and Dad taps "Mark prayed" on the request.
//     B = the kitchen iPad signed in as a kid (Kiara; Ezra in the control), opened online AFTER Dad's offline tap, so it
//         holds the pre-Dad copy — the ordinary 30 s poll window.
//     Dad's phone reconnects (its queue flushes), then the kid taps her big "Prayed" card on the same request.
// K-* Kid Verse, the family memory-verse week (kidverse family 'week') — an OVERRIDE row (one setting):
//     A = Dad's iPhone (same clock handling) reopened offline, taps "−" on the week stepper.
//     B = Mom's iPhone, opened after that, taps "+" once Dad is back online; in K-F she then taps "+" again (a retry).
// Final: after the future stamp has passed (> 5 min), re-read the server, both devices' screens and queues, the feed,
// and Kiara's Kid Verse stars (a prayed day is credited from prayedBy[date], apps/kidverse.html:427-434).
// Then Kiara taps Prayed again; after Dad's own cached stamps (his unclamped fast-clock time) have passed, read Dad's
// screens (and after reopening the apps), and Dad adds an ordinary update note to the request from his Prayer list.
// Evidence: audits/evidence/p2/PROF/verify4-p2-prof-14-2.json + *-1x PNGs (CSS-pixel scale). About 14 minutes.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/0c');
const TAG = 'verify4-p2-prof-14-2';
fs.mkdirSync(OUT, { recursive: true });
const AHEAD = 10 * 60e3;                                     // Dad's phone clock: 10 min fast (the server clamps to +5 min)
const ev = { at: new Date().toISOString(), aheadMs: AHEAD, runs: {}, notes: [] };
const T0 = Date.now();
const rel = t => +((t - T0) / 1000).toFixed(1);
const say = (...a) => console.log(`[${rel(Date.now())}s]`, ...a);
const nyDay = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const L = await local({ variant: 'typical', clock: 'real' });

async function srv(app, key) {
  const r = await L.apiAs('eli', `/api/data/${app}?scope=family&key=${encodeURIComponent(key)}`);
  const it = r.body.item;
  return { value: it ? it.value : null, updated_at: it ? it.updated_at : null, aheadOfServerNow_s: it ? +((it.updated_at - r.body.now) / 1000).toFixed(1) : null };
}
function watch(d, name) {
  d.net = []; d.name = name;
  d.page.on('response', async res => {
    const u = res.url(); if (!u.startsWith(L.api) || !u.includes('/api/data/')) return;
    const req = res.request(); const e = { t: rel(Date.now()), m: req.method(), p: u.slice(L.api.length, L.api.length + 90), s: res.status() };
    if (req.method() === 'POST') {
      try { const sent = JSON.parse(req.postData() || '{}').items || []; e.sent = sent.map(i => ({ key: i.key, stampMinusRealNow_s: +((i.updated_at - Date.now()) / 1000).toFixed(1) })); } catch {}
      try { const j = await res.json(); e.results = (j.results || []).map(r => ({ key: r.key, applied: r.applied })); } catch {}
    }
    d.net.push(e);
  });
  d.page.on('requestfailed', r => { if (r.url().startsWith(L.api)) d.net.push({ t: rel(Date.now()), m: r.method(), p: r.url().slice(L.api.length, L.api.length + 90), failed: (r.failure() || {}).errorText }); });
}
// Record every toast (hub.toast in the shell and the app, the app's own toast) and every sync-state change.
async function instrument(d) {
  for (const f of d.page.frames()) {
    await f.evaluate(() => {
      if (window.__inst) return; window.__inst = true; window.__msgs = [];
      const wrap = (o, k, tag) => { if (o && typeof o[k] === 'function') { const orig = o[k]; o[k] = function (...a) { window.__msgs.push({ tag, msg: String(a[0]).slice(0, 160), at: Date.now() }); return orig.apply(this, a); }; } };
      wrap(window.hub, 'toast', 'hub.toast');
      if (typeof window.toast === 'function') wrap(window, 'toast', 'app.toast');
      if (window.hub && hub.onSync) hub.onSync(s => { const last = window.__msgs.filter(m => m.tag === 'sync').pop(); if (!last || last.msg !== s.state) window.__msgs.push({ tag: 'sync', msg: s.state, at: Date.now() }); });
    }).catch(() => {});
  }
}
async function msgs(d, since = 0) {
  const out = [];
  for (const f of d.page.frames()) { const m = await f.evaluate(() => window.__msgs || []).catch(() => []); for (const x of m) if (x.at >= since) out.push({ frame: f === d.page.mainFrame() ? 'shell' : 'app', tag: x.tag, msg: x.msg, t: rel(x.at) }); }
  return out;
}
const pulls = (d, from, to) => d.net.filter(e => e.m === 'GET' && e.t >= rel(from) && e.t <= rel(to)).map(e => `${e.t}s ${e.p}`);
const shot = async (d, name) => { const f = path.join(OUT, `${TAG}-${name}-1x.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
async function reopenOffline(d, app, ready) {
  await d.setOffline(true);
  const f = await d.openApp(app);
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 });
  await d.setOffline(true);                                  // the new frames: navigator.onLine false too
  await f.waitForSelector(ready, { state: 'attached', timeout: 15000 });
  await sleep(800);
  return f;
}
// The stamp a device's cache holds for a row, in seconds relative to REAL time (a fast device's Date.now() is not used).
async function localStamp(f, app, key) {
  const t = await f.evaluate(([k, key]) => { const c = JSON.parse(localStorage.getItem(k) || '{}'); const it = c.items && c.items[key]; return it ? it.t : null; }, [`hub.cache.${app}.family`, key]);
  return t == null ? null : { t, minusRealNow_s: +((t - Date.now()) / 1000).toFixed(1) };
}
async function waitQueueEmpty(f, qkey, ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { const q = await f.evaluate(k => JSON.parse(((k) => JSON.stringify(Object.assign({}, ...Object.keys(localStorage).filter(x => x === k || x.startsWith(k + ".")).map(x => JSON.parse(localStorage.getItem(x) || "{}")))))(k) || '{}'), qkey); if (!Object.keys(q).length) return true; await sleep(100); }
  return false;
}

// ── Prayer: A (Dad, adult list) and B (a kid's big cards) both mark the same family request prayed ─────────────────
async function prayerChain({ label, aheadMs, pid, kid, kidName, shots }) {
  const run = ev.runs[label] = { app: 'prayer', row: 'prayer:' + pid, dadClockAhead_s: aheadMs / 1000, kid };
  const today = nyDay(Date.now());
  run.today = today; run.todayOnDadsFastClock = nyDay(Date.now() + aheadMs);
  run.serverBefore = await srv('prayer', 'prayer:' + pid);
  run.title = run.serverBefore.value.title;
  say(label, 'row', run.title, 'prayedBy[today] =', JSON.stringify((run.serverBefore.value.prayedBy || {})[today] || []));

  const dadDev = await L.newDevice({ name: `Dad iPhone ${label}`, profiles: ['dad'] });
  const A = await L.device({ device: 'iphone-pwa', profile: 'dad', installClock: Date.now() + aheadMs, as: dadDev }); watch(A, 'A');
  let fa = await A.openApp('prayer');
  await fa.evaluate(() => hub.ready()); await sleep(2000);
  await fa.click('[data-list="shared"]'); await sleep(1500);             // Dad looks at the Family list (online, warm cache)
  run.A_clockAheadOfReal_s = +(((await fa.evaluate(() => Date.now())) - Date.now()) / 1000).toFixed(1);
  run.A_onlineSession_skew_s = await fa.evaluate(() => Math.round(hub.skew / 1000));

  fa = await reopenOffline(A, 'prayer', `[data-pray="${pid}"]`);          // later: he opens it again with no signal
  await instrument(A);
  run.A_reopenedOffline = await fa.evaluate(() => ({ skew: hub.skew, sync: hub.sync.state, familyList: document.querySelector('[data-list="shared"]').getAttribute('aria-pressed') }));
  const tA = Date.now();
  await fa.locator(`[data-pray="${pid}"]:visible`).first().click();       // Dad: Mark prayed
  await sleep(600);
  run.A_tapOffline = await fa.evaluate(([pid, day]) => {
    const q = JSON.parse(((k) => JSON.stringify(Object.assign({}, ...Object.keys(localStorage).filter(x => x === k || x.startsWith(k + ".")).map(x => JSON.parse(localStorage.getItem(x) || "{}")))))('hub.queue.prayer.family') || '{}')['prayer:' + pid];
    const b = document.querySelector(`[data-pray="${pid}"]`);
    return { queuedStampMinusDeviceNow_s: q ? +((q.updated_at - Date.now()) / 1000).toFixed(1) : null, queuedPrayedBy: q && q.value && (q.value.prayedBy || {})[day], markPressed: b && b.getAttribute('aria-pressed') };
  }, [pid, today]);
  say(label, 'A tapped offline', JSON.stringify(run.A_tapOffline));

  // B: the kitchen iPad as the kid, opened now (after Dad's tap, before his phone reconnects)
  const kDev = await L.newDevice({ name: `Kitchen iPad ${label}`, profiles: [kid] });
  const B = await L.device({ device: 'ipad-portrait', profile: kid, fixedTime: false, as: kDev }); watch(B, 'B');
  const tBopen = Date.now();
  const fb = await B.openApp('prayer', { wait: `[data-kpray="${pid}"]` });
  await fb.evaluate(() => hub.ready()); await sleep(1200);
  await instrument(B);
  const card = () => fb.evaluate(([pid, day]) => {
    const b = document.querySelector(`[data-kpray="${pid}"]`); const v = hub.get('prayer:' + pid, { scope: 'family' });
    return { cardPressed: b && b.getAttribute('aria-pressed'), cardLabel: b && b.getAttribute('aria-label'), storePrayedBy: v && (v.prayedBy || {})[day] || [], queue: Object.keys(JSON.parse(((k) => JSON.stringify(Object.assign({}, ...Object.keys(localStorage).filter(x => x === k || x.startsWith(k + ".")).map(x => JSON.parse(localStorage.getItem(x) || "{}")))))('hub.queue.prayer.family') || '{}')), sync: hub.sync.state };
  }, [pid, today]);
  run.B_opened = await card();

  // Dad's phone gets signal back → its queue flushes
  const tOnline = Date.now();
  await A.setOffline(false);
  run.A_flushed = await waitQueueEmpty(fa, 'hub.queue.prayer.family');
  run.A_flushPosts = A.net.filter(e => e.m === 'POST' && e.t >= rel(tOnline));
  run.serverAfterA = await srv('prayer', 'prayer:' + pid);
  run.A_cachedStampAfterFlush = await localStamp(fa, 'prayer', 'prayer:' + pid);
  say(label, 'A flushed; server row prayedBy =', JSON.stringify((run.serverAfterA.value.prayedBy || {})[today]), 'ahead', run.serverAfterA.aheadOfServerNow_s, 's');

  // the kid taps "Prayed" on the same request
  await sleep(700);
  const tB = Date.now();
  run.B_pullsBetweenOpenAndTap = pulls(B, tBopen + 2500, tB);
  run.B_pullsBetweenDadsFlushAndTap = pulls(B, tOnline, tB);
  await fb.click(`[data-kpray="${pid}"]`);
  await sleep(150);
  run.B_rightAfterTap = await card();
  await sleep(1600);
  run.B_afterFlush_1_8s = await card();
  run.B_posts = B.net.filter(e => e.m === 'POST' && e.t >= rel(tB));
  run.serverAfterB = await srv('prayer', 'prayer:' + pid);
  run.B_messagesAfterTap = await msgs(B, tB);
  if (shots) run.shot_B_afterTap = await shot(B, `${label}-kid-ipad-after-tap`);
  say(label, 'B tapped; B card', JSON.stringify(run.B_afterFlush_1_8s), '| server prayedBy', JSON.stringify((run.serverAfterB.value.prayedBy || {})[today]));

  // one poll later (hub.js polls every 30 s) — both devices
  const waitTo = Math.max(tBopen, tOnline) + 34000; while (Date.now() < waitTo) await sleep(500);
  run.B_after_poll = { ...(await card()), pullsSinceTap: pulls(B, tB, Date.now()) };
  run.A_after_poll = await fa.evaluate(([pid, day]) => {
    const b = document.querySelector(`[data-pray="${pid}"]`); const v = hub.get('prayer:' + pid, { scope: 'family' });
    const who = b && b.closest('li').querySelector('.who');
    return { markPressed: b && b.getAttribute('aria-pressed'), facesLabel: who && who.getAttribute('aria-label'), storePrayedBy: v && (v.prayedBy || {})[day] || [], sync: hub.sync.state };
  }, [pid, today]);
  run.A_messages = await msgs(A, tA);
  run.A_cachedStampAfterPoll = await localStamp(fa, 'prayer', 'prayer:' + pid);
  run.serverAfterPoll = await srv('prayer', 'prayer:' + pid);
  if (shots) { run.shot_A_afterPoll = await shot(A, `${label}-dad-iphone-after-poll`); run.shot_B_afterPoll = await shot(B, `${label}-kid-ipad-after-poll`); }
  say(label, 'after poll: A', JSON.stringify(run.A_after_poll), '| B', JSON.stringify(run.B_after_poll.storePrayedBy));
  return { A, B, fa, fb, run, card, today, tB };
}

// ── Kid Verse: the family week stepper ───────────────────────────────────────────────────────────────────────────
async function weekChain({ label, aheadMs, retry, shots }) {
  const run = ev.runs[label] = { app: 'kidverse', row: 'week', dadClockAhead_s: aheadMs / 1000 };
  run.serverBefore = await srv('kidverse', 'week');
  const dadDev = await L.newDevice({ name: `Dad iPhone ${label}`, profiles: ['dad'] });
  const A = await L.device({ device: 'iphone-pwa', profile: 'dad', installClock: Date.now() + aheadMs, as: dadDev }); watch(A, 'A');
  let fa = await A.openApp('kidverse', { wait: '#week-now' });
  await fa.evaluate(() => hub.ready()); await sleep(2000);
  fa = await reopenOffline(A, 'kidverse', '#week-now');
  await instrument(A);
  const wk = f => f.evaluate(() => { const n = document.getElementById('week-now'); const v = hub.get('week', { scope: 'family' }); return { screen: n && n.firstChild && n.firstChild.textContent, store: v && v.week, queue: Object.keys(JSON.parse(((k) => JSON.stringify(Object.assign({}, ...Object.keys(localStorage).filter(x => x === k || x.startsWith(k + ".")).map(x => JSON.parse(localStorage.getItem(x) || "{}")))))('hub.queue.kidverse.family') || '{}')), sync: hub.sync.state, skew: hub.skew }; });
  run.A_reopenedOffline = await wk(fa);
  await fa.click('#week-down'); await sleep(500);                          // Dad: "−"
  run.A_tapOffline = await wk(fa);
  say(label, 'A tapped − offline', JSON.stringify(run.A_tapOffline));

  const momDev = await L.newDevice({ name: `Mom iPhone ${label}`, profiles: ['mom'] });
  const B = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: momDev }); watch(B, 'B');
  const tBopen = Date.now();
  const fb = await B.openApp('kidverse', { wait: '#week-now' });
  await fb.evaluate(() => hub.ready()); await sleep(1200);
  await instrument(B);
  run.B_opened = await wk(fb);

  const tOnline = Date.now();
  await A.setOffline(false);
  run.A_flushed = await waitQueueEmpty(fa, 'hub.queue.kidverse.family');
  run.A_flushPosts = A.net.filter(e => e.m === 'POST' && e.t >= rel(tOnline));
  run.serverAfterA = await srv('kidverse', 'week');
  run.A_cachedStampAfterFlush = await localStamp(fa, 'kidverse', 'week');
  say(label, 'A flushed; server week', JSON.stringify(run.serverAfterA.value), 'ahead', run.serverAfterA.aheadOfServerNow_s, 's');

  await sleep(700);
  const tB = Date.now();
  run.B_pullsBetweenDadsFlushAndTap = pulls(B, tOnline, tB);
  await fb.click('#week-up');                                              // Mom: "+"
  await sleep(150);
  run.B_rightAfterTap = await wk(fb);
  await sleep(1600);
  run.B_afterFlush_1_8s = await wk(fb);
  run.B_posts = B.net.filter(e => e.m === 'POST' && e.t >= rel(tB));
  run.serverAfterB = await srv('kidverse', 'week');
  run.B_messagesAfterTap = await msgs(B, tB);
  if (shots) run.shot_B_afterTap = await shot(B, `${label}-mom-iphone-after-tap`);
  say(label, 'B tapped +; B', JSON.stringify(run.B_afterFlush_1_8s), '| server', JSON.stringify(run.serverAfterB.value));

  if (retry) {                                                             // she sees it jump back and taps + again
    await sleep(1500);
    const tR = Date.now();
    await fb.click('#week-up'); await sleep(1800);
    run.B_retry = { ...(await wk(fb)), posts: B.net.filter(e => e.m === 'POST' && e.t >= rel(tR)), secondsAfterDadsFlush: +((tR - tOnline) / 1000).toFixed(1) };
    run.serverAfterRetry = await srv('kidverse', 'week');
    say(label, 'B retry; server', JSON.stringify(run.serverAfterRetry.value), 'ahead', run.serverAfterRetry.aheadOfServerNow_s);
  }
  const waitTo = Math.max(tBopen, tOnline) + 34000; while (Date.now() < waitTo) await sleep(500);
  run.A_after_poll = await wk(fa);
  run.B_after_poll = { ...(await wk(fb)), pullsSinceTap: pulls(B, tB, Date.now()) };
  run.serverAfterPoll = await srv('kidverse', 'week');
  run.A_messages = await msgs(A, 0);
  run.A_cachedStampAfterPoll = await localStamp(fa, 'kidverse', 'week');
  if (shots) { run.shot_A_afterPoll = await shot(A, `${label}-dad-iphone-after-poll`); run.shot_B_afterPoll = await shot(B, `${label}-mom-iphone-after-poll`); }
  say(label, 'after poll: A', JSON.stringify(run.A_after_poll), '| B', JSON.stringify(run.B_after_poll));
  return { A, B, fa, fb, run, wk };
}

const feedFor = async (re) => ((await L.apiAs('eli', '/api/activity?limit=100')).body.activity || []).filter(a => re.test(a.text)).map(a => ({ by: a.profile_id, text: a.text, agoS: Math.round((Date.now() - a.created_at) / 1000) }));

try {
  // ── controls first (correct clock on Dad's phone) ──
  const pc = await prayerChain({ label: 'P-control', aheadMs: 0, pid: 's007', kid: 'ezra', shots: true });
  pc.run.feed = await feedFor(new RegExp(pc.run.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await pc.A.close(); await pc.B.close();
  const kc = await weekChain({ label: 'K-control', aheadMs: 0, retry: false, shots: false });
  await kc.A.close(); await kc.B.close();

  // ── the chain with Dad's phone clock 10 min fast ──
  const pf = await prayerChain({ label: 'P-fast', aheadMs: AHEAD, pid: 's004', kid: 'kiara', shots: true });
  const kf = await weekChain({ label: 'K-fast', aheadMs: AHEAD, retry: true, shots: true });

  // ── wait until both future stamps have passed, then look again ──
  const stampP = pf.run.serverAfterA.updated_at, stampK = kf.run.serverAfterA.updated_at;
  const until = Math.max(stampP, stampK) + 15000;
  say('waiting', Math.round((until - Date.now()) / 1000), 's for the stamps to pass');
  while (Date.now() < until) await sleep(5000);
  const fin = ev.final = { atRealVsStampP_s: +((Date.now() - stampP) / 1000).toFixed(1), atRealVsStampK_s: +((Date.now() - stampK) / 1000).toFixed(1) };
  fin.P_server = await srv('prayer', 'prayer:s004');
  fin.P_kidIpad = await pf.card();
  fin.P_kidIpadMessagesSinceTap = await msgs(pf.B, pf.tB);
  fin.P_dadIphone = await pf.fa.evaluate(([pid, day]) => { const v = hub.get('prayer:' + pid, { scope: 'family' }); return { storePrayedBy: v && (v.prayedBy || {})[day] || [], queue: Object.keys(JSON.parse(((k) => JSON.stringify(Object.assign({}, ...Object.keys(localStorage).filter(x => x === k || x.startsWith(k + ".")).map(x => JSON.parse(localStorage.getItem(x) || "{}")))))('hub.queue.prayer.family') || '{}')) }; }, ['s004', pf.today]);
  fin.P_feed = await feedFor(/Kiara's first weeks at preschool/);
  fin.P_shot_kidIpad = await shot(pf.B, 'P-fast-kid-ipad-after-5min');
  // Kiara's stars: Kid Verse credits a prayed day from the family rows' prayedBy[date] (apps/kidverse.html:427-434)
  const kv = await pf.B.openApp('kidverse'); await kv.evaluate(() => hub.ready()); await sleep(4000);
  fin.P_kiaraStars = await kv.evaluate(day => { const s = hub.get('stars', { scope: 'person' }) || {}; return { creditedPrayedToday: ((s.credited || {}).prayed || {})[day] || null, count: s.count, total: s.total }; }, pf.today);
  fin.P_kiaraPrayedOnAnyFamilyRowToday = Object.values((await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items.reduce((m, r) => { if (r.key.startsWith('prayer:') && r.value && ((r.value.prayedBy || {})[pf.today] || []).includes('Kiara')) m[r.key] = r.value.title; return m; }, {}));
  fin.K_server = await srv('kidverse', 'week');
  fin.K_momIphone = await kf.wk(kf.fb);
  fin.K_dadIphone = await kf.wk(kf.fa);
  fin.K_dadCachedStamp = await localStamp(kf.fa, 'kidverse', 'week');
  say('final', JSON.stringify(fin, null, 1));

  // ── Kiara sees her card is not ticked and taps Prayed again (after the 5-minute server stamp has passed) ──
  const fb2 = await pf.B.openApp('prayer', { wait: '[data-kpray="s004"]' }); await fb2.evaluate(() => hub.ready()); await sleep(1500);
  const tR = Date.now();
  await fb2.click('[data-kpray="s004"]'); await sleep(1800);
  const r2 = ev.kiaraRetry = { secondsPastDadsServerStamp: +((tR - stampP) / 1000).toFixed(1) };
  r2.kidIpad = await fb2.evaluate(day => { const b = document.querySelector('[data-kpray="s004"]'); const v = hub.get('prayer:s004', { scope: 'family' }); return { cardPressed: b && b.getAttribute('aria-pressed'), storePrayedBy: (v.prayedBy || {})[day] || [] }; }, pf.today);
  r2.posts = pf.B.net.filter(e => e.m === 'POST' && e.t >= rel(tR));
  r2.server = await srv('prayer', 'prayer:s004');
  r2.serverPrayedBy = (r2.server.value.prayedBy || {})[pf.today];
  say('Kiara retry', JSON.stringify({ kid: r2.kidIpad, server: r2.serverPrayedBy, ahead: r2.server.aheadOfServerNow_s }));

  // ── wait until Dad's own cached stamps (his raw fast-clock time, not the server's clamped one) have passed, plus a poll ──
  const dadP = await localStamp(pf.fa, 'prayer', 'prayer:s004');
  ev.dadCachedStampP = dadP;
  const until2 = Math.max(dadP.t, fin.K_dadCachedStamp.t) + 36000;
  say('waiting', Math.round((until2 - Date.now()) / 1000), "s for Dad's cached stamps to pass");
  while (Date.now() < until2) await sleep(5000);
  const f2 = ev.final2 = { secondsPastDadsCachedStampP: +((Date.now() - dadP.t) / 1000).toFixed(1), secondsPastDadsCachedStampK: +((Date.now() - fin.K_dadCachedStamp.t) / 1000).toFixed(1) };
  const dadPrayerView = f => f.evaluate(day => { const b = document.querySelector('[data-pray="s004"]'); const who = b && b.closest('li').querySelector('.who'); const v = hub.get('prayer:s004', { scope: 'family' }); return { facesLabel: who && who.getAttribute('aria-label'), storePrayedBy: (v.prayedBy || {})[day] || [], sync: hub.sync.state }; }, pf.today);
  f2.P_server = (await srv('prayer', 'prayer:s004')).value.prayedBy[pf.today];
  f2.P_dadIphone = await dadPrayerView(pf.fa);
  f2.P_dadFamilyPullsInLast40s = pulls(pf.A, Date.now() - 40000, Date.now()).filter(x => /prayer\?scope=family/.test(x));
  f2.K_server = (await srv('kidverse', 'week')).value;
  f2.K_dadIphone = await kf.wk(kf.fa);
  f2.K_momIphone = await kf.wk(kf.fb);
  // Dad reopens both apps (a fresh hub.js on the same cache)
  const pa2 = await pf.A.openApp('prayer', { wait: '[data-pray="s004"]' }); await pa2.evaluate(() => hub.ready()); await sleep(2500);
  f2.P_dadIphoneAfterReopen = await dadPrayerView(pa2);
  f2.P_shot_dad = await shot(pf.A, 'P-fast-dad-iphone-after-10min');
  const ka2 = await kf.A.openApp('kidverse', { wait: '#week-now' }); await ka2.evaluate(() => hub.ready()); await sleep(2500);
  f2.K_dadIphoneAfterReopen = await kf.wk(ka2);
  f2.K_shot_dad = await shot(kf.A, 'K-fast-dad-iphone-after-10min');
  f2.K_shot_mom = await shot(kf.B, 'K-fast-mom-iphone-after-10min');
  say('final2', JSON.stringify(f2));

  // ── Dad, whose list still does not show Kiara, adds an ordinary update note to the request ──
  const tU = Date.now();
  await pa2.locator('[data-open="s004"]:visible').first().click(); await sleep(700);
  await pa2.locator('[data-update="s004"]:visible').first().click(); await sleep(400);
  await pa2.fill('#askIn', 'She loved her first week'); await pa2.click('#askSave'); await sleep(2200);
  const u = ev.dadUpdate = { posts: pf.A.net.filter(e => e.m === 'POST' && e.t >= rel(tU)) };
  const row = (await srv('prayer', 'prayer:s004')).value;
  u.serverPrayedBy = row.prayedBy[pf.today]; u.serverLastUpdate = row.updates.slice(-1)[0];
  const fb3 = await pf.B.openApp('prayer', { wait: '[data-kpray="s004"]' }); await fb3.evaluate(() => hub.ready()); await sleep(1500);
  u.kidIpad = await fb3.evaluate(day => { const b = document.querySelector('[data-kpray="s004"]'); const v = hub.get('prayer:s004', { scope: 'family' }); return { cardPressed: b && b.getAttribute('aria-pressed'), storePrayedBy: (v.prayedBy || {})[day] || [] }; }, pf.today);
  u.kidShot = await shot(pf.B, 'P-fast-kid-ipad-after-dad-update');
  say('Dad update', JSON.stringify(u));
} catch (e) { ev.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(ev, null, 1));
  console.log('wrote', path.join('audits/evidence/p2/PROF', TAG + '.json'));
  await L.close();
}
