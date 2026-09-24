// SYNC skeptic #2 — "Home's 'Around the house' feed loads once and never refreshes on its own".
//   node "audits/tools/phase2/SYNC/verify-home-feed-never-refreshes-2.mjs"      (≈ 3 minutes, real clock, WebKit)
// Independent of e5: one adult Home (the rig's Kitchen iPad, Eli) and every way the shell could plausibly re-read the feed
// without a manual refresh:
//   A. another person's feed line lands on the server (raw API as Mae), plus a family Larder row so the iPad's 30 s pull
//      fires hub.onChange → renderHome() (index.html:1242 → 1216 loadFeed()) — does a Home re-render on a pull re-read it?
//   B. switch tabs Home → Apps → Home (showTab('home') → renderHome, index.html:645) and hidden → visible.
//   C. the iPad's OWN action: add a reminder from Home's own form (hub.activity, index.html:1211) — does its own feed show it?
//   D. control: tap the feed's refresh button (refreshAll → loadFeed(true), index.html:674) — the lines appear.
// It counts GET /api/activity requests from the iPad in each window, so "never re-read" is a network fact, not a DOM guess.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const waitFor = async (fn, { timeout = 10000, every = 250 } = {}) => { const until = Date.now() + timeout; while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } return null; };

const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const reqs = [];
  ipad.page.on('request', r => { const u = r.url(); if (u.includes('/api/activity')) reqs.push({ t: Date.now(), m: r.method(), u: u.replace(/^https?:\/\/[^/]+/, '') }); });
  const gets = since => reqs.filter(r => r.m === 'GET' && r.t >= since).length;
  const feedText = () => ipad.page.evaluate(() => (document.querySelector('#feed') || {}).textContent || '');
  const has = t => feedText().then(s => s.includes(t));
  // Home re-renders on pulls (renderHome replaces the card), so shoot a viewport clip of the feed card instead of the element
  const feedShot = async name => { for (let i = 0; i < 5; i++) { try {
    await ipad.page.evaluate(() => document.querySelector('#feed').scrollIntoView({ block: 'start' })); await sleep(300);
    const vp = ipad.page.viewportSize();
    const b = await ipad.page.evaluate(() => { const r = document.querySelector('#feed').closest('.card').getBoundingClientRect(); return { x: r.x, y: Math.max(0, r.y), width: r.width, height: r.height }; });
    b.height = Math.min(b.height, vp.height - b.y);
    await ipad.page.screenshot({ path: path.join(EVID, name), clip: b, scale: 'css', animations: 'disabled' }); return;
  } catch (e) { await sleep(500); } } };
  // NB clock:'real' seeds "today" at New York daytime hours, so when run at night seeded lines can sort above new ones
  // (verify-home-feed-never-refreshes-2-probe.mjs saw a new line at index 11 of 37) — still inside the 30-line first page.

  await ipad.goto('#home');
  await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0 && document.querySelectorAll('#feed .fline').length > 0), { timeout: 20000 });
  await sleep(1500);
  out.initialActivityGets = gets(0);
  log(`boot: iPad Home painted ${await ipad.page.$$eval('#feed .fline', l => l.length)} feed lines; GET /api/activity so far: ${out.initialActivityGets}`);

  // A — another person's line + a family change that makes Home re-render on the next pull
  const lineA = 'VERIFY2 Mae line ' + Date.now();
  const tA = Date.now();
  const postA = await L.apiAs('christian', '/api/activity', { method: 'POST', body: { app_id: 'hub', text: lineA } });
  const lid = 'verify2-' + Date.now();
  const putA = await L.apiAs('christian', `/api/data/leftovers/item:${lid}?scope=family`, { method: 'PUT', body: { value: { id: lid, name: 'VERIFY2 soup', dateLogged: new Date().toISOString().slice(0, 10) }, updated_at: Date.now() } });
  const pull0 = (await ipad.hub()).sync.lastPull;
  const gotRow = await waitFor(() => ipad.page.evaluate(k => !!hub.get(k, { app: 'leftovers', scope: 'family' }), 'item:' + lid), { timeout: 45000, every: 500 });
  const pullMs = gotRow ? Date.now() - tA : null;
  await sleep(35000);                                                      // one more full poll cycle after the pull that delivered the row
  const pull1 = (await ipad.hub()).sync.lastPull;
  out.A = { postStatus: postA.status, putStatus: putA.status, rowPulledAfterMs: pullMs, pullsAdvanced: pull1 > pull0, feedShowsLine: await has(lineA), activityGets: gets(tA), elapsedMs: Date.now() - tA };
  log(`A: server took Mae's line (${postA.status}) + Larder row (${putA.status}); iPad pulled the row after ${pullMs} ms (Home re-rendered); after ${out.A.elapsedMs} ms feed shows the line: ${out.A.feedShowsLine}; GET /api/activity in that window: ${out.A.activityGets}`);

  // B — tab round trip + hidden/visible
  const tB = Date.now();
  await ipad.page.click('.tab[data-tab="apps"]'); await sleep(800);
  await ipad.page.click('.tab[data-tab="home"]'); await sleep(1500);
  for (const f of ipad.page.frames()) await f.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, true).catch(() => {});
  await sleep(500);
  for (const f of ipad.page.frames()) await f.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, false).catch(() => {});
  await sleep(3000);
  out.B = { feedShowsLine: await has(lineA), activityGets: gets(tB) };
  log(`B: after Home → Apps → Home and hidden → visible: feed shows Mae's line: ${out.B.feedShowsLine}; GET /api/activity: ${out.B.activityGets}`);

  // C — the iPad's own reminder from Home's own form
  const lineC = 'VERIFY2 iPad own reminder ' + Date.now();
  const tC = Date.now();
  await ipad.page.fill('#remtext', lineC); await ipad.page.press('#remtext', 'Enter');
  const posted = await waitFor(() => reqs.some(r => r.m === 'POST' && r.t >= tC), { timeout: 10000, every: 100 });
  const onServer = await waitFor(async () => { const r = await L.apiAs('eli', '/api/activity?limit=100'); return (r.body.activity || []).some(a => a.text.includes(lineC)); }, { timeout: 10000, every: 300 });
  const remCard = await ipad.page.evaluate(t => document.querySelector('#remlist').textContent.includes(t), lineC);
  await sleep(40000);
  out.C = { activityPosted: !!posted, lineOnServer: !!onServer, remindersCardShows: remCard, feedShowsOwnLineAfterMs: (await has('Added a reminder: ' + lineC)) ? Date.now() - tC : null, activityGets: gets(tC), waitedMs: Date.now() - tC };
  await feedShot('verify-home-feed-2-before-refresh.png');
  log(`C: iPad added its own reminder (POST /api/activity: ${out.C.activityPosted}, on server: ${out.C.lineOnServer}, Reminders card: ${out.C.remindersCardShows}); after ${out.C.waitedMs} ms its own feed shows it: ${out.C.feedShowsOwnLineAfterMs !== null}; GET /api/activity: ${out.C.activityGets}`);

  // D — control: the refresh button
  const tD = Date.now();
  await ipad.page.click('#feed-refresh');
  const both = await waitFor(async () => { const s = await feedText(); return s.includes(lineA) && s.includes(lineC); }, { timeout: 5000, every: 100 });
  out.D = { bothLinesAfterRefreshMs: both ? Date.now() - tD : null, activityGets: gets(tD) };
  await feedShot('verify-home-feed-2-after-refresh.png');
  log(`D: tapped refresh → both lines shown after ${out.D.bothLinesAfterRefreshMs} ms; GET /api/activity: ${out.D.activityGets}`);

  out.pageErrors = ipad.logs.filter(l => l.startsWith('pageerror'));
  fs.writeFileSync(path.join(EVID, 'verify-home-feed-never-refreshes-2.json'), JSON.stringify(out, null, 2));
  log('evidence: audits/evidence/p2/SYNC/verify-home-feed-never-refreshes-2.json, verify-home-feed-2-before-refresh.png, verify-home-feed-2-after-refresh.png');
} finally { await L.close(); }
