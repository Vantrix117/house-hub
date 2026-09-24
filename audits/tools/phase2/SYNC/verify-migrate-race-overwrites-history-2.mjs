// Skeptic #2 for SYNC finding "migrate-race-overwrites-history". Independent of e2h: own helpers, four scenarios on one
// local instance (re-seeded between scenarios). Each scenario uses a fresh paired phone for Eli whose localStorage holds
// the pre-hub standalone F260 keys (f260.done/week/log/mem) and no hub.migrated mark — the state of a device that ran the
// old F260 and has just been paired (or re-paired after "Forget this device", which clears only hub.* keys).
//   A control      — deep link #f260, network normal                      → expect the server rows untouched
//   B race         — deep link #f260, every GET /api/data/f260 held 8 s    → the claim: legacy copy overwrites the server
//   C warm cache   — the shell pulled once first, then F260 opened with the GET held 8 s → expect untouched (mitigation)
//   D offline open — deep link #f260 with the API unreachable, then back online → variant: does the queue push the old copy?
//   node "audits/tools/phase2/SYNC/verify-migrate-race-overwrites-history-2.mjs"
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

const legacyDone = {}; for (let w = 1; w <= 3; w++) for (let d = 0; d < 5; d++) legacyDone[w + '-' + d] = true;
const LEGACY = { 'f260.done': legacyDone, 'f260.week': 4, 'f260.log': { '2026-01-20': true, '2026-01-21': true }, 'f260.mem': { '1-0': true } };
const KEYS = Object.keys(LEGACY);

async function server(L) {
  const r = await L.apiAs('eli', '/api/data/f260?scope=person');
  const rows = Object.fromEntries((r.body.items || []).filter(i => KEYS.includes(i.key)).map(i => [i.key, i]));
  const n = v => v == null ? null : (typeof v === 'object' ? Object.keys(v).length : v);
  return Object.fromEntries(KEYS.map(k => [k, rows[k] ? { size: n(rows[k].value), t: rows[k].updated_at } : null]));
}
const brief = s => JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k.replace('f260.', ''), v && v.size])));

async function phoneFor(L, name) {
  const ph = await L.newDevice({ name, profiles: ['eli'] });
  return L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph, localStorage: LEGACY });
}
function holdF260Gets(d, ms) {
  const st = { until: Date.now() + 60000, held: [] };
  d.ctx.route(/\/api\/data\/f260\?/, async route => {
    const req = route.request();
    if (req.method() === 'GET' && Date.now() < st.until) { st.held.push({ at: Date.now() - t0, frame: (req.frame() && req.frame().url().replace(/^https?:\/\/[^/]+/, '')) || '?' }); await sleep(ms); }
    route.continue().catch(() => {});
  });
  return st;
}
const lsState = d => d.page.evaluate(() => ({
  migrated: localStorage.getItem('hub.migrated'),
  cacheSince: (JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || 'null') || {}).since || 0,
  legacyStill: ['f260.done', 'f260.week'].every(k => localStorage.getItem(k) != null),
}));

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // ── A control
  {
    const before = await server(L); log('A before', brief(before));
    const phone = await phoneFor(L, 'A phone');
    const f = await phone.openApp('f260'); await f.waitForSelector('#doneCount', { timeout: 15000 }).catch(() => {});
    await sleep(6000);
    const after = await server(L); log('A after ', brief(after), '| rows rewritten:', KEYS.filter(k => after[k].t !== before[k].t).length);
    out.A = { before, after, ls: await lsState(phone), ui: await f.textContent('#doneCount').catch(() => null) };
    await phone.close();
  }
  // ── B race (the claim)
  await L.reset('typical');
  {
    const before = await server(L); log('B before', brief(before));
    const phone = await phoneFor(L, 'B phone');
    const st = holdF260Gets(phone, 8000);
    const f = await phone.openApp('f260');
    await sleep(7500); st.until = 0; await sleep(12000);
    const after = await server(L);
    log('B after ', brief(after), '| rows rewritten:', KEYS.filter(k => after[k].t !== before[k].t).length, '| held GETs:', JSON.stringify(st.held));
    const ui = { today: await f.textContent('#todayTitle').catch(() => null), count: await f.textContent('#doneCount').catch(() => null) };
    log('B phone F260 UI', JSON.stringify(ui));
    // a second device that was already in sync (the rig's Kitchen iPad) — does the loss reach it?
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('f260'); await sleep(5000);
    const ipadUi = { today: await fi.textContent('#todayTitle').catch(() => null), count: await fi.textContent('#doneCount').catch(() => null) };
    log('B iPad F260 UI after the phone opened', JSON.stringify(ipadUi));
    await phone.page.screenshot({ path: path.join(EVID, 'verify2-migrate-race-phone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    out.B = { before, after, held: st.held, ls: await lsState(phone), phoneUi: ui, ipadUi };
    await phone.close(); await ipad.close();
  }
  // ── C warm cache: the shell pulled f260 once before F260 opens
  await L.reset('typical');
  {
    const before = await server(L); log('C before', brief(before));
    const phone = await phoneFor(L, 'C phone');
    await phone.goto('#home');
    for (let i = 0; i < 40 && !(await lsState(phone)).cacheSince; i++) await sleep(250);
    const warm = await lsState(phone); log('C shell cache since =', warm.cacheSince, '(>0 = pulled)');
    const st = holdF260Gets(phone, 8000);
    const f = await phone.openApp('f260');
    await sleep(7500); st.until = 0; await sleep(10000);
    const after = await server(L); log('C after ', brief(after), '| rows rewritten:', KEYS.filter(k => after[k].t !== before[k].t).length);
    out.C = { before, after, warm, ls: await lsState(phone), ui: await f.textContent('#doneCount').catch(() => null) };
    await phone.close();
  }
  // ── D offline first open, then back online
  await L.reset('typical');
  {
    const before = await server(L); log('D before', brief(before));
    const phone = await phoneFor(L, 'D phone');
    await phone.setOffline(true);
    await phone.goto('#f260'); await sleep(1500); await phone.setOffline(true);   // re-arm navigator.onLine in the new frames
    await sleep(3000);
    const q = await phone.page.evaluate(() => JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}'));
    log('D queued while offline:', JSON.stringify(Object.keys(q)));
    const mid = await server(L); log('D server while offline', brief(mid));
    await phone.setOffline(false); await sleep(8000);
    const after = await server(L); log('D after online', brief(after), '| rows rewritten:', KEYS.filter(k => after[k].t !== before[k].t).length);
    out.D = { before, queuedKeys: Object.keys(q), after, ls: await lsState(phone) };
    await phone.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify2-migrate-race.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify2-migrate-race.json');
} finally { await L.close(); }
