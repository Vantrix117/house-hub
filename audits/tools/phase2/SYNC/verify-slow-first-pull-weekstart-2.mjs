// Skeptic #2 for SYNC finding "slow-first-pull-weekstart" — independent reproduction with controls.
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-2.mjs"            (all variants, ~2-3 min)
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-2.mjs" uniform    (one variant)
// Each variant runs on a FRESH local instance (clock 'real', typical household), Eli, a newly paired phone with an empty cache.
//   control-fast  : no delay at all                                  → expect weekStart untouched
//   f260-get-8s   : only GET /api/data/f260?… held 8 s (the investigator's setup)
//   uniform       : EVERY /api/ request (GET and POST, shell and app) held 7 s — a uniformly slow link, not a GET-only artefact
//   home-first    : uniform 7 s, but Eli waits on Home until the shell's own f260 pull lands, then opens F260 → expect no damage
//   offline-first : phone offline when F260 is first opened, back online 5 s later (no slow pull at all)
// For each: server f260.weekStart / f260.done / f260.log / f260.week before and after, what the phone POSTed, the phone's pace.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);

async function row(L, key) { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(key)}`); return r.body && r.body.item; }
async function snapshot(L) {
  const ws = await row(L, 'f260.weekStart'), dn = await row(L, 'f260.done'), lg = await row(L, 'f260.log'), wk = await row(L, 'f260.week'), sm = await row(L, 'f260.summary');
  const w = ws && ws.value || {};
  return { weekStartWeeks: Object.keys(w).length, weekStartEarliest: Object.values(w).sort()[0] || null, weekStartCur: wk && w[String(wk.value)] || null,
    weekStartRaw: Object.keys(w).length <= 3 ? w : '(' + Object.keys(w).length + ' weeks)', weekStartUpdatedAt: ws && ws.updated_at,
    doneKeys: dn ? Object.keys(dn.value || {}).length : null, logDays: lg ? Object.keys(lg.value || {}).length : null, week: wk && wk.value, summaryWeek: sm && sm.value && sm.value.week, summaryTotal: sm && sm.value && sm.value.total };
}

async function run(variant) {
  const out = { variant };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    out.before = await snapshot(L);
    log(`[${variant}] server before:`, JSON.stringify(out.before));
    const ph = await L.newDevice({ name: 'Eli new phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let slowUntil = Date.now() + 120000;
    if (variant === 'f260-get-8s') await phone.ctx.route(/\/api\/data\/f260\?/, async r => { if (r.request().method() === 'GET' && Date.now() < slowUntil) await sleep(8000); r.continue().catch(() => {}); });
    if (variant === 'uniform' || variant === 'home-first') await phone.ctx.route(u => u.pathname.startsWith('/api/'), async r => { if (Date.now() < slowUntil) await sleep(7000); r.continue().catch(() => {}); });
    const posts = [];
    phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) { try { posts.push({ dt: Date.now() - tOpen, keys: JSON.parse(r.postData()).items.map(i => i.key === 'f260.weekStart' ? { weekStart: i.value } : i.key) }); } catch {} } });
    let tOpen = Date.now();
    let f;
    if (variant === 'home-first') {
      await phone.goto('#home');
      // wait until the shell's own f260 person-scope pull has landed in the shared cache (since > 0)
      const tH = Date.now(); let ok = false;
      while (Date.now() - tH < 60000) { ok = await phone.page.evaluate(() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || 'null'); return !!(c && c.since > 0); } catch { return false; } }); if (ok) break; await sleep(250); }
      out.shellCachedF260After = ((Date.now() - tH) / 1000).toFixed(1) + ' s (cached=' + ok + ')';
      log(`[${variant}] shell's f260 cache landed after ${out.shellCachedF260After}; now opening F260`);
      tOpen = Date.now();
      await phone.page.evaluate(() => { location.hash = '#f260'; });
      const until = Date.now() + 15000; while (Date.now() < until && !(f = phone.frame('f260'))) await sleep(100);
    } else if (variant === 'offline-first') {
      await phone.goto('');               // load the shell so the offline switch has a page to act on
      await phone.setOffline(true);
      tOpen = Date.now();
      f = await phone.openApp('f260');
      await phone.setOffline(true);        // re-assert in the new frames
    } else {
      f = await phone.openApp('f260');
    }
    await sleep(variant === 'offline-first' ? 5000 : 7000);
    out.atEarly = { tSec: ((Date.now() - tOpen) / 1000).toFixed(1), today: await f.textContent('#todayTitle').catch(() => null), weekLbl: await f.textContent('#curWeekLbl').catch(() => null),
      queued: Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {}) };
    log(`[${variant}] ${out.atEarly.tSec} s after opening F260: Today "${out.atEarly.today}", week ${out.atEarly.weekLbl}, queued: ${out.atEarly.queued.join(', ') || '(nothing)'}`);
    if (variant === 'offline-first') { await phone.setOffline(false); log(`[${variant}] back online`); }
    slowUntil = 0;                         // from here on the link is fast again
    await sleep(15000);
    out.posts = posts;
    out.after = await snapshot(L);
    out.phoneUi = { heroMeta: await f.textContent('#heroMeta').catch(() => null), pace: await f.textContent('#heroPace').catch(() => null), weekLbl: await f.textContent('#curWeekLbl').catch(() => null) };
    if (variant !== 'control-fast') await phone.page.screenshot({ path: path.join(EVID, `verify2-${variant}-phone-after.png`), scale: 'css', animations: 'disabled', caret: 'hide' }).catch(() => {});
    log(`[${variant}] phone POSTs:`, JSON.stringify(posts));
    log(`[${variant}] server after:`, JSON.stringify(out.after));
    log(`[${variant}] phone UI after data arrived:`, JSON.stringify(out.phoneUi));
    // A second, established device afterwards (fresh context, fast link) — what does it show?
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    const u2 = Date.now() + 15000; while (Date.now() < u2 && !(await fi.evaluate(() => hub.sync.lastPull > 0).catch(() => false))) await sleep(250);
    await sleep(1500);
    out.ipad = { heroMeta: await fi.textContent('#heroMeta'), pace: await fi.textContent('#heroPace') };
    log(`[${variant}] iPad afterwards: ${out.ipad.heroMeta} | pace: ${out.ipad.pace}`);
    out.damaged = out.after.weekStartWeeks < out.before.weekStartWeeks;
    log(`[${variant}] RESULT: weekStart ${out.before.weekStartWeeks} weeks → ${out.after.weekStartWeeks} (earliest ${out.before.weekStartEarliest} → ${out.after.weekStartEarliest}); done ${out.before.doneKeys} → ${out.after.doneKeys}; log ${out.before.logDays} → ${out.after.logDays}; DAMAGED=${out.damaged}`);
  } finally { await L.close(); }
  return out;
}

const want = process.argv[2];
const variants = want ? [want] : ['control-fast', 'f260-get-8s', 'uniform', 'home-first', 'offline-first'];
const results = [];
for (const v of variants) { try { results.push(await run(v)); } catch (e) { log(`[${v}] ERROR`, e.message); results.push({ variant: v, error: e.message }); } }
const file = path.join(EVID, want ? `verify2-slow-first-pull-${want}.json` : 'verify2-slow-first-pull.json');
fs.writeFileSync(file, JSON.stringify(results, null, 2));
log('summary:', results.map(r => `${r.variant}: ${r.error ? 'ERROR' : (r.damaged ? 'DAMAGED' : 'intact')}`).join(' | '));
log('evidence', path.relative(ROOT, file));
