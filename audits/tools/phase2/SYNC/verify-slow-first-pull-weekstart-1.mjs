// Skeptic #1 for SYNC finding "slow-first-pull-weekstart" — independent re-run, not using the investigator's helpers.
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-1.mjs"            (all scenarios, ≈2-3 min)
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-1.mjs" A          (one scenario)
// Scenarios (each on a fresh local instance, variant typical, real clock):
//   A  claim:   new phone (no cache) opens #f260; every GET /api/data/f260?… is held 8 s before it reaches the server.
//   B  control: same, held 4 s (under hub.ready's 6 s race, apps/hub.js:337). Expect no weekStart write.
//   C  normal path: new phone opens Home, GET f260 held 8 s; waits until the shell's f260 pull has landed in the cache,
//               then opens F260. Expect no overwrite (cache present → hub.ready does not race).
//   D  quick tap:  new phone opens Home (GET f260 held 8 s), opens F260 at ~3 s while the shell's pull is still in flight.
// For each: server f260.weekStart (key count, updated_at) before/after, every f260 batch POST the phone sent (ms after open),
// the phone's F260 UI, and (A) what a second, fresh iPad's F260 hero and pace say afterwards.
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

async function row(L, key) {
  const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(key)}`);
  return r.body && r.body.item;
}
const brief = it => it ? { keys: Object.keys(it.value || {}).length, first: Object.entries(it.value || {}).sort((a, b) => +a[0] - +b[0])[0], updated_at: it.updated_at } : null;
async function until(fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; }
async function heroOf(L) {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('f260', { wait: '#todayDone' });
  await until(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0));
  await sleep(1500);
  const out = { heroMeta: await f.textContent('#heroMeta'), pace: await f.textContent('#heroPace') };
  await d.close();
  return out;
}

async function scenario(name, { holdMs, path: via, openAfter }) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const res = { name, holdMs, via };
  try {
    res.before = { weekStart: brief(await row(L, 'f260.weekStart')), week: (await row(L, 'f260.week') || {}).value };
    if (name === 'A') res.ipadBefore = await heroOf(L);
    const ph = await L.newDevice({ name: 'Eli new phone ' + name, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let hold = true;
    const gets = [];
    await phone.ctx.route(/\/api\/data\/f260\?/, async route => {
      if (route.request().method() === 'GET' && hold) { const t = Date.now(); await sleep(holdMs); gets.push({ heldFrom: t - tOpen, frame: (route.request().frame() && route.request().frame().url().includes('/apps/f260.html')) ? 'f260 frame' : 'shell' }); }
      route.continue().catch(() => {});
    });
    const posts = [];
    phone.page.on('request', r => {
      if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) {
        try { const b = JSON.parse(r.postData()); posts.push({ ms: Date.now() - tOpen, frame: r.frame() && r.frame().url().includes('/apps/f260.html') ? 'f260 frame' : 'shell', items: b.items.map(i => ({ key: i.key, updated_at: i.updated_at, value: i.key === 'f260.weekStart' ? i.value : i.key === 'f260.summary' ? { week: i.value.week, total: i.value.total } : '…' })) }); } catch {}
      }
    });
    let tOpen = Date.now();
    let f;
    if (via === 'deeplink') {
      f = await phone.openApp('f260');
    } else {
      await phone.goto('#home');
      if (openAfter === 'shell-cached') {
        const cached = await until(() => phone.page.evaluate(() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli')); return c && c.since > 0 && c.items && c.items['f260.weekStart'] ? Object.keys(c.items['f260.weekStart'].v).length : 0; } catch { return 0; } }), 30000);
        res.shellCacheWeeksBeforeOpen = cached; res.openedAtMs = Date.now() - tOpen;
      } else { await sleep(openAfter); res.openedAtMs = Date.now() - tOpen; }
      await phone.page.evaluate(() => { location.hash = '#f260'; });
      f = await until(() => phone.frame('f260'), 10000);
    }
    await sleep(Math.max(0, 6800 - (Date.now() - tOpen - (res.openedAtMs || 0))));
    res.uiEarly = { atMs: Date.now() - tOpen, today: await f.textContent('#todayTitle').catch(() => null), week: await f.textContent('#curWeekLbl').catch(() => null) };
    if (name === 'A') await phone.page.screenshot({ path: path.join(EVID, 'verify-slow-first-pull-weekstart-1-A-phone-7s.png'), scale: 'css', animations: 'disabled' });
    await sleep(Math.max(holdMs, 8000) + 8000);   // let every held request finish and anything queued flush
    hold = false;
    await sleep(2000);
    res.phoneUiAfter = { today: await f.textContent('#todayTitle').catch(() => null), week: await f.textContent('#curWeekLbl').catch(() => null), heroMeta: await f.textContent('#heroMeta').catch(() => null), pace: await f.textContent('#heroPace').catch(() => null) };
    res.phoneLocalWeekStart = await f.evaluate(() => { const v = hub.get('f260.weekStart'); return v && Object.keys(v).length; });
    res.gets = gets; res.posts = posts;
    res.after = { weekStart: brief(await row(L, 'f260.weekStart')), week: (await row(L, 'f260.week') || {}).value, doneKeys: Object.keys((await row(L, 'f260.done') || {}).value || {}).length };
    if (name === 'A') { await phone.page.screenshot({ path: path.join(EVID, 'verify-slow-first-pull-weekstart-1-A-phone-after.png'), scale: 'css', animations: 'disabled' }); res.ipadAfter = await heroOf(L); res.afterIpad = { weekStart: (await row(L, 'f260.weekStart') || {}).value }; }
    res.phoneLogs = phone.logs.filter(l => /error/i.test(l)).slice(0, 5);
  } finally { await L.close(); }
  log(`── ${name} (hold ${holdMs} ms, ${via}${res.openedAtMs != null ? ', F260 opened at ' + res.openedAtMs + ' ms' : ''})`);
  log('  server weekStart before:', JSON.stringify(res.before.weekStart), '| f260.week', res.before.week);
  if (res.shellCacheWeeksBeforeOpen != null) log('  shell cache weekStart weeks when F260 opened:', res.shellCacheWeeksBeforeOpen);
  log('  phone F260 at', res.uiEarly.atMs, 'ms: today', JSON.stringify(res.uiEarly.today), 'week', res.uiEarly.week);
  log('  held GETs:', JSON.stringify(res.gets));
  log('  f260 batch POSTs:', JSON.stringify(res.posts));
  log('  server weekStart after:', JSON.stringify(res.after.weekStart), '| f260.week', res.after.week, '| done keys', res.after.doneKeys);
  log('  phone UI after:', JSON.stringify(res.phoneUiAfter), '| phone local weekStart keys', res.phoneLocalWeekStart);
  if (res.ipadBefore) log('  fresh iPad hero BEFORE:', JSON.stringify(res.ipadBefore));
  if (res.ipadAfter) log('  fresh iPad hero AFTER:', JSON.stringify(res.ipadAfter), '| server weekStart after the iPad opened:', JSON.stringify(res.afterIpad.weekStart));
  return res;
}

const all = {};
const plan = {
  A: { holdMs: 8000, path: 'deeplink' },
  B: { holdMs: 4000, path: 'deeplink' },
  C: { holdMs: 8000, path: 'home', openAfter: 'shell-cached' },
  D: { holdMs: 8000, path: 'home', openAfter: 3000 },
};
for (const [k, v] of Object.entries(plan)) { if (only && only !== k) continue; all[k] = await scenario(k, v); }
const file = path.join(EVID, 'verify-slow-first-pull-weekstart-1' + (only ? '-' + only : '') + '.json');
fs.writeFileSync(file, JSON.stringify(all, null, 2));
log('evidence', path.relative(ROOT, file).split(path.sep).join('/'));
