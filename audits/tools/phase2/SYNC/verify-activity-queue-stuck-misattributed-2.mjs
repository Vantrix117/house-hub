// Skeptic #2 for SYNC finding "activity-queue-stuck-misattributed".
//   node "audits/tools/phase2/SYNC/verify-activity-queue-stuck-misattributed-2.mjs"
// Independent re-run (no _util.mjs): Eli ticks F260 Done offline on the Kitchen iPad; Wi-Fi returns; we wait past the 30 s
// poll, fire visibilitychange, and even reload the shell + reopen F260 — does anything drain hub.activityQueue? Then Ezra
// signs in on the same iPad and earns a ★ in Kid Verse: whose name does Eli's line land under, and with what created_at?
// Finally a kiosk (TV) device paints its board: is Eli in "Reading today"?
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
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(250); } return null; };
const out = {};

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Skeptic reader', profiles: ['mom'] });
  const feed = async () => (await L.apiAs(null, '/api/activity?limit=100', { deviceToken: reader.device.token, profileToken: reader.sessions.mom })).body.activity;
  const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const today = dayKey(Date.now());
  const readWeek = rows => rows.filter(a => /^Read week/.test(a.text || '')).map(a => ({ who: a.profile_id, text: a.text, created_at: a.created_at, today: dayKey(a.created_at) === today }));
  out.readWeekTodayBefore = readWeek(await feed()).filter(r => r.today);
  log('Read-week lines dated today before the test:', JSON.stringify(out.readWeekTodayBefore));

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const qOf = () => ipad.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'));
  const f = await ipad.openApp('f260', { wait: '#todayDone' });
  await until(() => f.evaluate(() => hub.sync.lastPull > 0)); await sleep(800);
  out.doneTarget = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await ipad.setOffline(true);
  await f.click('#todayDone');
  await sleep(600);
  out.queuedOffline = await qOf();
  log('offline tick (target ' + out.doneTarget + ') → hub.activityQueue =', JSON.stringify(out.queuedOffline));

  await ipad.setOffline(false);
  const dataSynced = await until(async () => { const h = await ipad.hub(f); return h.sync && h.sync.state === 'synced' && !Object.values(h.queue).some(q => Object.keys(q).length); }, 20000);
  const serverF260 = await L.apiAs('eli', '/api/data/f260?scope=person');
  out.dataSyncedAfterOnline = !!dataSynced;
  log('online: data queue flushed & synced =', !!dataSynced, '; server f260 rows (eli) =', (serverF260.body.items || []).length);
  await sleep(35000);   // past the 30 s poll
  for (const fr of ipad.page.frames()) await fr.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {});
  await sleep(3000);
  out.after38s = { queue: (await qOf()).map(a => a.text), feedLine: readWeek(await feed()).filter(r => r.today) };
  log('38 s online + visibilitychange: queue =', JSON.stringify(out.after38s.queue), '; Read-week lines today on server =', JSON.stringify(out.after38s.feedLine));

  // reopen: reload the shell and reopen F260 (hub.ready runs again in both copies)
  await ipad.page.reload({ waitUntil: 'load' });
  const f2 = await ipad.openApp('f260', { wait: '#todayDone' });
  await until(() => f2.evaluate(() => hub.sync.lastPull > 0)); await sleep(3000);
  out.afterReload = { queue: (await qOf()).map(a => a.text), feedLine: readWeek(await feed()).filter(r => r.today) };
  log('after shell reload + F260 reopen: queue =', JSON.stringify(out.afterReload.queue), '; Read-week lines today on server =', JSON.stringify(out.afterReload.feedLine));

  // TV board before Ezra
  const tvState = async () => {
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.goto('#home');
    await until(() => tv.page.evaluate(() => document.querySelectorAll('#tv-read .tv-face').length > 0), 15000); await sleep(2500);
    const faces = await tv.page.evaluate(() => [...document.querySelectorAll('#tv-read .tv-face')].map(e => e.textContent.trim() + (e.classList.contains('off') ? ' (off)' : '')));
    return { tv, faces };
  };
  let tv = await tvState();
  out.tvReadBeforeEzra = tv.faces;
  log('TV "Reading today" before Ezra:', JSON.stringify(tv.faces));
  await tv.tv.close();

  // Switch to Ezra on the same iPad, earn the verse ★
  await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 }); await ipad.page.click('.pcard[data-id="ezra"]');
  await until(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra'));
  const kv = await ipad.openApp('kidverse', { wait: '#done' });
  await until(() => kv.evaluate(() => hub.sync.lastPull > 0)); await sleep(1500);
  out.kidDoneVisible = await kv.evaluate(() => !document.getElementById('done').hidden);
  await kv.evaluate(() => document.getElementById('done').click());
  await sleep(3000);
  const rows = await feed();
  const q0 = out.queuedOffline[0] || {};
  const posted = rows.find(a => a.text === q0.text);
  out.posted = posted ? { profile_id: posted.profile_id, name: posted.name, text: posted.text, created_at: posted.created_at, queuedAt: q0.at, lagSeconds: Math.round((posted.created_at - q0.at) / 1000) } : null;
  out.ezraLines = rows.filter(a => a.profile_id === 'ezra').slice(0, 3).map(a => a.name + ': ' + a.text);
  out.queueAfterEzra = (await qOf()).map(a => a.text);
  log('after Ezra\'s ★: Eli\'s queued line posted as', JSON.stringify(out.posted), '; ezra feed lines', JSON.stringify(out.ezraLines), '; queue now', JSON.stringify(out.queueAfterEzra));
  await ipad.page.screenshot({ path: path.join(EVID, 'verify-activity-queue-2-ipad-ezra.png'), scale: 'css', animations: 'disabled' });

  tv = await tvState();
  out.tvReadAfterEzra = tv.faces;
  log('TV "Reading today" after Ezra:', JSON.stringify(tv.faces));
  await tv.tv.page.screenshot({ path: path.join(EVID, 'verify-activity-queue-2-tv.png'), scale: 'css', animations: 'disabled' });
  await tv.tv.close();

  fs.writeFileSync(path.join(EVID, 'verify-activity-queue-stuck-misattributed-2.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-activity-queue-stuck-misattributed-2.json');
} finally { await L.close(); }
