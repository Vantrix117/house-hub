// Skeptic #1 for "undo-keeps-read-today": Done -> Undo on the Today card; does f260.log[today] (and everything read from
// it: Today card, summary, Home, the 8 pm evening job) still count the day as read?  Also: does a reload re-derive it?
// Local rig only (typical household, demo clock Tue 22 Sep 2026 08:40 New York).
//   node "audits/tools/phase3/f260/verify-undo-keeps-read-today-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = n => path.join(EVID, 'verify-undo-keeps-read-today-1' + n);
const TODAY = '2026-09-22';

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const rows = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const state = async (f) => {
  const ui = await f.evaluate(() => { const g = id => { const e = document.getElementById(id); return e ? (e.hidden ? '(hidden) ' : '') + e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { todayKind: g('todayKind'), todayTitle: g('todayTitle'), todayStreak: g('todayStreak'), streak: g('streak'), undoHidden: document.getElementById('todayUndo').hidden, target: document.getElementById('todayDone').dataset.target }; });
  const r = await rows('eli');
  return { ui, server: { logToday: !!(r['f260.log'] || {})[TODAY], summary: r['f260.summary'], doneCount: Object.keys(r['f260.done'] || {}).filter(k => r['f260.done'][k]).length } };
};
const waitReady = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(400); };
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  let f = await d.openApp('f260'); await waitReady(f);
  out.before = await state(f);
  const target = out.before.ui.target;
  await f.locator('#todayDone').tap(); await sleep(2000);
  out.afterDone = await state(f);
  out.afterDone.tickTarget = (await rows('eli'))['f260.done'][target] || false;
  await f.locator('#todayUndo').tap(); await sleep(2000);
  out.afterUndo = await state(f);
  out.afterUndo.tickTarget = (await rows('eli'))['f260.done'][target] || false;
  await d.page.screenshot({ path: P('-after-undo-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // 8 pm evening job, forced (admin route), judged by f260.log[today]
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  const evOut = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
  out.eveningJob = { status: ev.status, eli: (evOut.checked || []).find(c => c.profile === 'eli') || null, notifiedEli: (evOut.notified || []).filter(x => JSON.stringify(x).includes('eli')), skippedEli: (evOut.skipped || []).filter(x => JSON.stringify(x).includes('eli')) };
  // Home
  await d.goto('#home'); await sleep(2500);
  out.home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /reading/i.test(e.textContent) && /streak|read today|Today/i.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
  await d.page.screenshot({ path: P('-home-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // reload F260: does anything re-derive log[today] from done?
  f = await d.openApp('f260'); await waitReady(f);
  out.afterReopen = await state(f);
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(P('.json'), JSON.stringify(out, null, 1));
const brief = s => ({ kind: s.ui.todayKind, title: s.ui.todayTitle, todayStreak: s.ui.todayStreak, logToday: s.server.logToday, readToday: s.server.summary && s.server.summary.readToday, streak: s.server.summary && s.server.summary.streak, total: s.server.summary && s.server.summary.total, done: s.server.doneCount, tick: s.tickTarget });
console.log('target', out.before.ui.target);
console.log('before   ', JSON.stringify(brief(out.before)));
console.log('afterDone', JSON.stringify(brief(out.afterDone)));
console.log('afterUndo', JSON.stringify(brief(out.afterUndo)));
console.log('reopen   ', JSON.stringify(brief(out.afterReopen)));
console.log('evening  ', JSON.stringify(out.eveningJob));
console.log('home     ', out.home);
