// Skeptic #1 for "ahead-undo-keeps-week": Mae (christian) has week 37 complete and has not started 38. Today's Done
// ticks 38-0, which calls setCurrent(38) (apps/f260.html:1592 -> 1684-1686). Does Undo give week 37 back, or does
// f260.week stay 38 and weekStart[38] stay today? And what does that change on screen (hero "started", pace, summary)?
// Local rig only (typical household, demo clock Tue 22 Sep 2026 08:40 New York).
//   node "audits/tools/phase3/f260/verify-ahead-undo-keeps-week-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = n => path.join(EVID, 'verify-ahead-undo-keeps-week-1' + n);
const PID = 'christian';
const SEL = ['todayKind', 'todayTitle', 'todayMeta', 'todayRingN', 'heroKind', 'heroTitle', 'heroMeta', 'heroPace', 'curWeekLbl', 'doneCount'];

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const rows = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const waitReady = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(400); };
const state = async f => {
  const ui = await f.evaluate(ss => Object.fromEntries(ss.map(id => { const e = document.getElementById(id); return [id, e ? (e.hidden ? '(hidden) ' : '') + e.textContent.replace(/\s+/g, ' ').trim() : null]; }).concat([['doneTarget', document.getElementById('todayDone').dataset.target || null], ['undoHidden', document.getElementById('todayUndo').hidden]])), SEL);
  const r = await rows(PID);
  const ws = r['f260.weekStart'] || {}; const done = r['f260.done'] || {};
  return { ui, server: { week: r['f260.week'], ws37: ws['37'] || null, ws38: ws['38'] || null, weekStartKeys: Object.keys(ws).sort((a, b) => a - b), tick38_0: !!done['38-0'], w37count: [0, 1, 2, 3, 4].filter(i => done['37-' + i]).length, weekDone37: (r['f260.weekDone'] || {})['37'] || null, summary: r['f260.summary'] } };
};
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: PID, installClock: DEMO });
  let f = await d.openApp('f260'); await waitReady(f);
  out.before = await state(f);
  await d.page.screenshot({ path: P('-before-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.locator('#todayDone').tap(); await sleep(2000);
  out.afterDone = await state(f);
  await f.locator('#todayUndo').tap(); await sleep(2000);
  out.afterUndo = await state(f);
  await d.page.screenshot({ path: P('-after-undo-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // reopen: does anything re-derive the week from done?
  await d.goto('#home'); await sleep(1500);
  f = await d.openApp('f260'); await waitReady(f);
  out.afterReopen = await state(f);
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(P('.json'), JSON.stringify(out, null, 1));
const brief = s => ({ week: s.server.week, ws38: s.server.ws38, tick38_0: s.server.tick38_0, w37: s.server.w37count, sumWeek: s.server.summary && s.server.summary.week, sumWeekDone: s.server.summary && s.server.summary.weekDone, heroKind: s.ui.heroKind, heroTitle: s.ui.heroTitle, heroMeta: s.ui.heroMeta, heroPace: s.ui.heroPace, todayMeta: s.ui.todayMeta, ring: s.ui.todayRingN, target: s.ui.doneTarget });
for (const k of ['before', 'afterDone', 'afterUndo', 'afterReopen']) console.log(k.padEnd(11), JSON.stringify(brief(out[k])));
console.log('weekStart keys before/afterUndo', JSON.stringify(out.before.server.weekStartKeys.slice(-4)), JSON.stringify(out.afterUndo.server.weekStartKeys.slice(-4)));
