// Skeptic #1 for "home-feed-never-refreshes": does Home's "Around the house" feed stay frozen on a Home that stays open?
//   node "audits/tools/phase2/SYNC/verify-home-feed-never-refreshes-1.mjs"      (about 3 minutes)
// Independent of e5: own helpers, fresh local instance, real clock (so hub.js's 30 s pull timer runs).
// A. Eli's phone adds a family reminder from its Home form (hub.set + hub.activity). The Kitchen iPad (Eli, Home, visible)
//    is watched for 100 s: Reminders card, "Around the house", how many pulls ran, how many GET /api/activity it made.
// B. Same iPad: Apps tab -> Home tab (a re-render). Does the feed pick the line up?
// C. The iPad adds its own reminder from its own Home. Does its own feed line appear within 15 s?
// D. Tap the refresh button: does the feed show both lines?
// Also: the server really holds the line (GET /api/activity as Eli).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, { timeout = 10000, every = 250 } = {}) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  return null;
}
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone (verify)', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const actGets = [];
  ipad.page.on('request', r => { if (r.method() === 'GET' && /\/api\/activity\b/.test(r.url())) actGets.push({ t: Date.now(), url: r.url().replace(/^https?:\/\/[^/]+/, '') }); });
  for (const d of [phone, ipad]) { await d.goto('#home'); await waitFor(() => d.page.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 15000 }); }
  await waitFor(() => ipad.page.evaluate(() => document.querySelector('#feed') && !document.querySelector('#feed .skeleton')), { timeout: 10000 });
  await sleep(1500);
  out.initialActivityGets = actGets.length;
  log(`iPad Home loaded; GET /api/activity so far: ${actGets.length}`);

  // A
  const text = 'VERIFY feed line from the phone ' + Math.random().toString(36).slice(2, 7);
  const feedHas = (t) => ipad.page.evaluate(t => (document.querySelector('#feed') || {}).textContent.includes(t), t);
  const remHas = (t) => ipad.page.evaluate(t => (document.querySelector('#remlist') || {}).textContent.includes(t), t);
  const pullsBefore = await ipad.page.evaluate(() => hub.sync.lastPull);
  const getsBefore = actGets.length;
  const tA = Date.now();
  await phone.page.fill('#remtext', text); await phone.page.press('#remtext', 'Enter');
  const onServer = await waitFor(async () => { const r = await L.apiAs('eli', '/api/activity?limit=30'); return (r.body.activity || []).some(a => a.text.includes(text)); }, { timeout: 10000 });
  out.serverHasLineMs = onServer ? Date.now() - tA : null;
  log(`A: server /api/activity holds the phone's line: ${!!onServer} (${out.serverHasLineMs} ms)`);
  let remMs = null, feedMs = null, pulls = new Set();
  while (Date.now() - tA < 100000) {
    const s = await ipad.page.evaluate(() => hub.sync.lastPull); if (s !== pullsBefore) pulls.add(s);
    if (remMs === null && await remHas(text)) remMs = Date.now() - tA;
    if (feedMs === null && await feedHas(text)) { feedMs = Date.now() - tA; break; }
    await sleep(500);
  }
  out.A = { reminderCardMs: remMs, feedLineMs: feedMs, pullsDuringWatch: pulls.size, activityGetsDuringWatch: actGets.length - getsBefore, watchedMs: Date.now() - tA };
  await ipad.page.screenshot({ path: path.join(EVID, 'verify-feed-1-ipad-after-100s.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  log(`A: iPad Reminders card showed it after ${remMs} ms; feed line after ${feedMs === null ? 'never (100 s watch)' : feedMs + ' ms'}; iPad pulls during watch: ${pulls.size}; GET /api/activity during watch: ${out.A.activityGetsDuringWatch}`);

  // B
  const gB = actGets.length;
  await ipad.page.click('.tab[data-tab="apps"]'); await sleep(800);
  await ipad.page.click('.tab[data-tab="home"]'); await sleep(3000);
  out.B = { feedHasAfterTabSwitch: await feedHas(text), activityGets: actGets.length - gB };
  log(`B: after Apps -> Home tab switch: feed shows the line: ${out.B.feedHasAfterTabSwitch}; GET /api/activity: ${out.B.activityGets}`);

  // C
  const own = 'VERIFY own iPad reminder ' + Math.random().toString(36).slice(2, 7);
  const gC = actGets.length, tC = Date.now();
  await ipad.page.fill('#remtext', own); await ipad.page.press('#remtext', 'Enter');
  const ownOnServer = await waitFor(async () => { const r = await L.apiAs('eli', '/api/activity?limit=30'); return (r.body.activity || []).some(a => a.text.includes(own)); }, { timeout: 10000 });
  const ownRem = await waitFor(() => remHas(own), { timeout: 5000, every: 200 });
  const ownFeed = await waitFor(() => feedHas(own), { timeout: 15000, every: 250 });
  out.C = { serverHasOwnLine: !!ownOnServer, ownReminderShown: !!ownRem, ownFeedLineMs: ownFeed ? Date.now() - tC : null, activityGets: actGets.length - gC };
  log(`C: iPad's own reminder: on server ${out.C.serverHasOwnLine}, in its Reminders card ${out.C.ownReminderShown}, in its own feed within 15 s: ${ownFeed ? 'yes' : 'no'}; GET /api/activity: ${out.C.activityGets}`);

  // D
  const gD = actGets.length, tD = Date.now();
  await ipad.page.click('#feed-refresh');
  const both = await waitFor(async () => (await feedHas(text)) && (await feedHas(own)), { timeout: 8000, every: 100 });
  out.D = { bothShownMs: both ? Date.now() - tD : null, activityGets: actGets.length - gD };
  await ipad.page.screenshot({ path: path.join(EVID, 'verify-feed-1-ipad-after-refresh.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  log(`D: after tapping refresh both lines shown after ${out.D.bothShownMs} ms; GET /api/activity: ${out.D.activityGets}`);

  out.feedFreshFlag = await ipad.page.evaluate(() => typeof feedFresh === 'undefined' ? 'not global (closure)' : feedFresh);
  out.logsErrors = ipad.logs.filter(l => /error/i.test(l)).slice(0, 10);
  fs.writeFileSync(path.join(EVID, 'verify-home-feed-never-refreshes-1.json'), JSON.stringify(out, null, 2));
  log('wrote audits/evidence/p2/SYNC/verify-home-feed-never-refreshes-1.json');
} finally { await L.close(); }
