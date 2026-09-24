// Skeptic #2 for "finished-flag-sticks": at 259/260 tick the last reading through the plan's own circle (not the Today
// button), then untick one reading, then run the evening job as the admin and read what it decided for Eli, then re-tick
// and check (a) whether the modal auto-shows and (b) whether "See your year" is still reachable (mitigation check).
//   node "audits/tools/phase3/f260/verify-finished-flag-sticks-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { behindFor } from '../../../../worker/src/reminders.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of r.body.items || []) o[it.key] = it.value; return o; };
const put = async (pid, key, value) => { const g = await L.apiAs(pid, '/api/data/f260?scope=person&key=__none__');
  return L.apiAs(pid, `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } }); };
const out = {};
try {
  await L.reset('typical');
  const done = {}; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) done[w + '-' + d] = true; delete done['52-3'];
  const weekDone = {}; for (let w = 1; w <= 51; w++) weekDone[w] = '2026-09-10';
  await put('eli', 'f260.done', done); await put('eli', 'f260.week', 52); await put('eli', 'f260.weekDone', weekDone);
  await put('eli', 'f260.weekStart', { 1: '2025-09-01', 52: '2026-09-15' });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f = await d.openApp('f260');
  await f.waitForFunction(() => (document.getElementById('todayTitle') || {}).textContent, null, { timeout: 15000 }); await sleep(800);
  const modalOn = () => f.evaluate(() => document.getElementById('complete').classList.contains('on'));
  // last tick via the plan circle, a real tap
  await f.locator('[data-day="52-3"] .mark').scrollIntoViewIfNeeded(); await f.locator('[data-day="52-3"] .mark').tap(); await sleep(2500);
  const r1 = await rows('eli');
  out.lastTick = { modal: await modalOn(), finished: r1['f260.finished'] ?? null, summary: r1['f260.summary'] };
  await d.page.screenshot({ path: path.join(EVID, 'verify-finished-flag-sticks-2-complete-iphone.png'), scale: 'css' });
  await f.evaluate(() => document.getElementById('completeClose').click()); await sleep(400);
  // untick 52-1 with a real tap
  await f.locator('[data-day="52-1"] .mark').tap(); await sleep(2000);
  const r2 = await rows('eli');
  out.untick = { finished: r2['f260.finished'] ?? null, summary: r2['f260.summary'], doneCount: Object.keys(r2['f260.done']).filter(k => r2['f260.done'][k]).length,
    ui: await f.evaluate(() => ({ pct: document.getElementById('pct')?.textContent, heroPace: document.getElementById('heroPace')?.textContent, heroTitle: document.getElementById('heroTitle')?.textContent })) };
  await d.page.screenshot({ path: path.join(EVID, 'verify-finished-flag-sticks-2-after-untick-iphone.png'), scale: 'css' });
  // the reminders' own view: evening job (admin-forced) and behind check
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  const evOut = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
  out.evening = { status: ev.status, eli: (evOut.checked || []).find(c => c.profile === 'eli') || null, notifiedEli: (evOut.notified || []).filter(n => JSON.stringify(n).includes('eli')), skippedEli: (evOut.skipped || []).filter(n => JSON.stringify(n).includes('eli')) };
  // control: another adult who has not read today (mom) for comparison
  out.evening.momChecked = (evOut.checked || []).find(c => c.profile === 'mom') || null;
  out.evening.momInNotifiedOrSkipped = [...(evOut.notified || []), ...(evOut.skipped || [])].filter(n => JSON.stringify(n).includes('mom'));
  // the Worker's own rules on the rows the app just wrote, judged on a later day with no reading logged:
  //   eveningJob (reminders.js:96) skips when readToday || sum.finished; behindFor (reminders.js:114) returns 'no_summary' when sum.finished.
  const sum = r2['f260.summary'], ws = r2['f260.weekStart'] || {};
  out.workerRules = {
    eveningSkipsOnLaterDayNoRead: !!(false || (sum && sum.finished)),
    behindSundayAsWritten: behindFor({ 'f260.summary': sum, 'f260.weekStart': ws }, '2026-09-27'),
    behindSundayIfFinishedCleared: behindFor({ 'f260.summary': { ...sum, finished: false }, 'f260.weekStart': ws }, '2026-09-27'),
  };
  // re-tick
  await f.locator('[data-day="52-1"] .mark').tap(); await sleep(2500);
  out.retick = { modalAutoShows: await modalOn(),
    seeYourYear: await f.evaluate(() => ({ nextUp: document.getElementById('nextUp')?.textContent, target: document.getElementById('nextUp')?.dataset.target, wkButton: !!document.querySelector('[data-complete]') })) };
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, 'verify-finished-flag-sticks-2.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
