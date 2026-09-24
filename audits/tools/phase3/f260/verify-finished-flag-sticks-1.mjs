// Skeptic #1 for "finished-flag-sticks": after the 260th tick, does unticking a reading leave f260.finished and
// summary.finished set (total 259), do the 8 pm evening and Sunday "behind" rules then skip the person, and does
// re-ticking the reading bring the automatic "Plan complete" modal back?
// Local rig only (typical household, demo clock Tue 22 Sep 2026 08:40 New York). Independent of logic.mjs.
//   node "audits/tools/phase3/f260/verify-finished-flag-sticks-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = n => path.join(EVID, 'verify-finished-flag-sticks-1' + n);
// The Worker's own rules, imported read-only and run against the rows the app wrote (no push service involved).
const R = await import(pathToFileURL(path.join(ROOT, 'worker', 'src', 'reminders.js')).href);

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const rows = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const put = async (pid, key, value) => { const g = await L.apiAs(pid, `/api/data/f260?scope=person&key=__none__`);
  return L.apiAs(pid, `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } }); };
const modalOn = f => f.evaluate(() => document.getElementById('complete').classList.contains('on'));
const ui = f => f.evaluate(() => { const g = id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { pct: g('pct'), doneCount: g('doneCount'), heroPace: g('heroPace'), todayTitle: g('todayTitle'), nextUp: g('nextUp') }; });
const tapMark = async (f, id) => { const m = f.locator(`[data-day="${id}"] .mark`); await m.scrollIntoViewIfNeeded(); await m.tap(); };

// Evening rule run against the app's rows: a stub D1 that serves the f260 rows and records whether notify() was reached.
async function evening(r, nowMs) {
  const reached = [];
  const env = { DB: { prepare(sql) { let args = []; const st = {
    bind(...a) { args = a; return st; },
    async all() { if (/app_id = 'f260'/.test(sql)) return { results: Object.entries(r).filter(([k]) => ['f260.log', 'f260.summary', 'f260.weekStart'].includes(k)).map(([key, v]) => ({ profile_id: 'eli', key, value: JSON.stringify(v) })) };
      if (/push_subscriptions/.test(sql)) reached.push('pushTo'); return { results: [] }; },
    async first() { if (/push_log/.test(sql)) reached.push('alreadySentToday'); return null; },
    async run() { return {}; } }; return st; } } };
  const o = await R.eveningJob(env, nowMs);
  return { checked: o.checked, notifyReached: reached.length > 0 };
}

try {
  await L.reset('typical');
  // 259 of 260 ticked (52-4 open), week 52 current and started 10 days ago, weeks 1-51 complete.
  const done = {}; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) done[w + '-' + d] = true; delete done['52-4'];
  const weekDone = {}; for (let w = 1; w <= 51; w++) weekDone[w] = '2026-09-01';
  await put('eli', 'f260.done', done); await put('eli', 'f260.week', 52); await put('eli', 'f260.weekDone', weekDone);
  await put('eli', 'f260.weekStart', { 52: '2026-09-12' }); await put('eli', 'f260.log', { '2026-09-21': true });
  out.seed = { finishedBefore: (await rows('eli'))['f260.finished'] ?? null };

  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const f = await d.openApp('f260');
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(600);
  out.at259 = await ui(f);
  // make sure week 52 is open so its circles are tappable
  await f.evaluate(() => { const s = document.getElementById('week-52'); if (s && !s.classList.contains('open')) s.querySelector('[data-toggle]').click(); }); await sleep(300);

  // 1) the 260th tick, on the plan's own circle
  await tapMark(f, '52-4'); await sleep(2500);
  out.lastTick = { modal: await modalOn(f), ui: await ui(f) };
  await d.page.screenshot({ path: P('-modal-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  let r = await rows('eli');
  out.lastTick.server = { finished: r['f260.finished'] ?? null, summaryFinished: r['f260.summary']?.finished, total: r['f260.summary']?.total };
  await f.locator('#completeClose').tap(); await sleep(400);

  // 2) untick two readings of week 52 (52-1, 52-2)
  await tapMark(f, '52-1'); await sleep(800); await tapMark(f, '52-2'); await sleep(2500);
  r = await rows('eli');
  out.afterUntick = { ui: await ui(f), server: { finished: r['f260.finished'] ?? null, summary: r['f260.summary'], doneCount: Object.keys(r['f260.done'] || {}).filter(k => r['f260.done'][k]).length } };
  await d.page.screenshot({ path: P('-after-untick-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // 3) the Worker's rules against these rows, and against the same rows with finished cleared (control)
  const ctrl = JSON.parse(JSON.stringify(r)); ctrl['f260.summary'].finished = false;
  const eveningAt = Date.parse('2026-09-27T00:00:00Z');   // Sat 26 Sep 2026 20:00 New York (no reading logged that day)
  out.rules = {
    evening: { app: await evening(r, eveningAt), control: await evening(ctrl, eveningAt) },
    behind: { app: R.behindFor(r, '2026-09-27'), control: R.behindFor(ctrl, '2026-09-27') },
  };

  // 4) re-tick both: does the automatic "Plan complete" moment come back?
  await tapMark(f, '52-1'); await sleep(800); await tapMark(f, '52-2'); await sleep(2500);
  out.retick = { modal: await modalOn(f), ui: await ui(f) };
  r = await rows('eli'); out.retick.server = { finished: r['f260.finished'] ?? null, total: r['f260.summary']?.total };
  // the manual way back: the hero's "See your year" button
  out.retick.nextUpTarget = await f.evaluate(() => document.getElementById('nextUp').dataset.target);
  await f.evaluate(() => document.getElementById('nextUp').click()); await sleep(600);
  out.retick.manualModal = await modalOn(f);
  await d.close();
} finally { await L.close(); }

fs.writeFileSync(P('.json'), JSON.stringify(out, null, 1));
console.log('seed      ', JSON.stringify(out.seed), 'at259', JSON.stringify(out.at259));
console.log('lastTick  ', JSON.stringify({ modal: out.lastTick.modal, ...out.lastTick.server, pct: out.lastTick.ui.pct }));
console.log('untick x2 ', JSON.stringify({ finished: out.afterUntick.server.finished, summaryFinished: out.afterUntick.server.summary?.finished, total: out.afterUntick.server.summary?.total, weekDone: out.afterUntick.server.summary?.weekDone, doneRows: out.afterUntick.server.doneCount, pct: out.afterUntick.ui.pct, heroPace: out.afterUntick.ui.heroPace, today: out.afterUntick.ui.todayTitle }));
console.log('evening   ', JSON.stringify(out.rules.evening));
console.log('behind    ', JSON.stringify(out.rules.behind));
console.log('retick    ', JSON.stringify(out.retick));
