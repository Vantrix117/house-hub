// Skeptic #1 for SYNC finding "ready-seen-global-resets-family-prayer".
// Claim: hub.ready() (apps/hub.js:334-337) skips the first-pull wait when ANY declared channel has since > 0. The shell pulls
// prayer|person but not prayer|family (index.html:458-459), so Prayer's first open on a device reads an empty family cache
// and save() posts the six family list-settings keys with defaults, resetting the family plan for everyone.
//
//   node "audits/tools/phase2/SYNC/verify-ready-seen-global-resets-family-prayer-1.mjs" [real|demo] [ezra|mom] [shared]   (shared: set the adult's activeList to the family list first)
//
// Independent of the investigator's e8 script: records every family GET/POST of the Prayer frame with timestamps and the
// POSTed values + updated_at, the server rows (value + updated_at) before and after, and a control (second open on the
// same device, family cache now populated → must post nothing).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const clock = process.argv[2] === 'demo' ? 'demo' : 'real';
const who = process.argv[3] || 'ezra';
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const LIST_KEYS = ['label', 'categories', 'prayerDays', 'plans', 'activePlan', 'rotationFor'];
const summ = (k, v) => k === 'plans' ? (v || []).map(p => `${p.id}:${p.name}`) : k === 'categories' ? `${(v || []).length} categories`
  : k === 'prayerDays' ? `${(v || []).length} days` : k === 'rotationFor' ? (v && { date: v.date, key: v.key }) : v;

const out = { clock, who, realNow: new Date().toString() };
const L = await local({ variant: 'typical', clock });
try {
  const reader = await L.newDevice({ name: 'Verifier reader', profiles: ['mom'] });
  const rows = async () => {
    const r = await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
    const pr = r.body.items.filter(i => i.key.startsWith('prayer:'));
    return { now: r.body.now, prayerRowsLive: pr.filter(i => i.value != null).length, rows: Object.fromEntries(r.body.items.filter(i => LIST_KEYS.includes(i.key)).map(i => [i.key, { v: summ(i.key, i.value), t: new Date(i.updated_at).toISOString() }])) };
  };
  out.before = await rows();
  log('server clock', new Date(out.before.now).toISOString(), '| family list rows before:', JSON.stringify(out.before.rows));

  if (process.argv[4] === 'shared') {        // optional: an adult whose last-used Prayer list is the family list
    const r = await L.apiAs(who, '/api/data/prayer/activeList?scope=person', { method: 'PUT', body: { value: 'shared', updated_at: out.before.now } });
    log(`set ${who}'s person activeList = 'shared' →`, r.status);
  }
  const kd = await L.newDevice({ name: 'Fresh device', profiles: [who] });
  const dev = await L.device({ device: 'ipad-portrait', profile: who, fixedTime: clock === 'real' ? false : undefined, as: kd });
  const net = [];
  const inPrayer = r => r.frame() && r.frame().url().includes('/apps/prayer.html');
  dev.page.on('request', r => {
    const u = r.url();
    if (!/\/api\/data\/prayer/.test(u)) return;
    const e = { t: Date.now() - t0, ev: 'req', method: r.method(), url: u.replace(/^https?:\/\/[^/]+/, ''), frame: inPrayer(r) ? 'prayer' : 'shell' };
    if (r.method() === 'POST') { try { e.items = JSON.parse(r.postData()).items.map(i => ({ key: i.key, v: summ(i.key, i.value), t: new Date(i.updated_at).toISOString() })); } catch {} }
    net.push(e);
  });
  dev.page.on('response', async r => {
    const u = r.url(); if (!/\/api\/data\/prayer/.test(u)) return;
    const e = { t: Date.now() - t0, ev: 'res', method: r.request().method(), url: u.replace(/^https?:\/\/[^/]+/, ''), frame: inPrayer(r.request()) ? 'prayer' : 'shell', status: r.status() };
    try { const b = await r.json(); if (b.results) e.applied = b.results.map(x => `${x.key}:${x.applied}`); if (b.items) e.nItems = b.items.length; } catch {}
    net.push(e);
  });

  await dev.goto('#home');
  const until = Date.now() + 15000;
  while (Date.now() < until && !(await dev.page.evaluate(() => window.hub && hub.sync.lastPull > 0).catch(() => false))) await sleep(200);
  out.cacheBefore = await dev.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.cache.prayer'))
    .map(k => [k, { since: JSON.parse(localStorage.getItem(k)).since, n: Object.keys(JSON.parse(localStorage.getItem(k)).items).length }])));
  log('shell pulled; prayer caches on the device before Prayer opens:', JSON.stringify(out.cacheBefore));

  const mark = net.length;
  const f = await dev.openApp('prayer');
  await sleep(5000);
  out.firstOpenNet = net.slice(mark);
  for (const e of out.firstOpenNet) log(JSON.stringify(e));
  out.after = await rows();
  log('family list rows after first open:', JSON.stringify(out.after.rows));
  out.changed = Object.fromEntries(LIST_KEYS.filter(k => JSON.stringify(out.before.rows[k] && out.before.rows[k].v) !== JSON.stringify(out.after.rows[k] && out.after.rows[k].v))
    .map(k => [k, { before: out.before.rows[k] && out.before.rows[k].v, after: out.after.rows[k] && out.after.rows[k].v }]));
  log('prayer:* rows (live) before/after:', out.before.prayerRowsLive, '/', out.after.prayerRowsLive);
  log('CHANGED on the server by one first open:', JSON.stringify(out.changed));
  out.appShows = await f.evaluate(() => ({ activeList: D.activeList, plan: (D.lists.shared.plans.find(p => p.id === D.lists.shared.activePlan) || {}).name })).catch(e => String(e));
  log('Prayer frame now shows family plan:', JSON.stringify(out.appShows));
  const shotFile = path.join(EVID, `verify-ready-seen-${who}-${clock}${process.argv[4] ? "-" + process.argv[4] : ""}.png`);
  await dev.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = path.relative(ROOT, shotFile).split(path.sep).join('/');

  // Control: reopen Prayer on the same device (family cache now populated, since > 0) → no family POST expected.
  const mark2 = net.length;
  await dev.goto('#home'); await sleep(1500);
  await dev.openApp('prayer'); await sleep(4000);
  out.secondOpenFamilyPosts = net.slice(mark2).filter(e => e.ev === 'req' && e.method === 'POST' && /scope=family/.test(e.url));
  log('control, second open on the same device — family POSTs:', JSON.stringify(out.secondOpenFamilyPosts));
  const file = path.join(EVID, `verify-ready-seen-${who}-${clock}${process.argv[4] ? "-" + process.argv[4] : ""}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  log('evidence', path.relative(ROOT, file).split(path.sep).join('/'), out.shot);
} finally { await L.close(); }
