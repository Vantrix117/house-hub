// Skeptic #2 for "ahead-undo-keeps-week": Mae (christian) has week 37 complete; Today's Done ticks 38-0 (setCurrent(38)),
// then Undo. Does f260.week / weekStart[38] go back? Does pace change? What does the plan hero say?
//   node "audits/tools/phase3/f260/verify-ahead-undo-keeps-week-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260'); fs.mkdirSync(EVID, { recursive: true });
const SEL = ['#todayKind', '#todayTitle', '#todayMeta', '#heroKind', '#heroTitle', '#heroMeta', '#heroPace', '#curWeekLbl', '#doneCount'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = async () => { const r = await L.apiAs('christian', '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const txt = f => f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? (e.hidden ? '(hidden) ' : '') + e.textContent.replace(/\s+/g, ' ').trim() : null]; })), SEL);
const pick = (r, ui) => ({ week: r['f260.week'], ws38: (r['f260.weekStart'] || {})['38'] || null, ws37: (r['f260.weekStart'] || {})['37'] || null,
  earliestStart: Object.values(r['f260.weekStart'] || {}).filter(Boolean).sort()[0] || null, tick38_0: !!(r['f260.done'] || {})['38-0'],
  summaryWeek: r['f260.summary'] && r['f260.summary'].week, summaryWeekDone: r['f260.summary'] && r['f260.summary'].weekDone, ui });
const out = {};
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'christian', installClock: DEMO });
  const f = await d.openApp('f260');
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(800);
  const r0 = await rows(); out.before = pick(r0, await txt(f));
  out.before.week37count = [0,1,2,3,4].filter(i => (r0['f260.done'] || {})['37-' + i]).length;
  out.before.doneTarget = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await f.locator('#todayDone').tap(); await sleep(2000);
  out.afterDone = pick(await rows(), await txt(f));
  out.afterDone.undoVisible = await f.evaluate(() => !document.getElementById('todayUndo').hidden);
  await f.locator('#todayUndo').tap(); await sleep(2000);
  out.afterUndo = pick(await rows(), await txt(f));
  out.afterUndo.localWeek = await f.evaluate(() => { try { return localStorage.getItem('f260.week'); } catch { return 'n/a'; } });
  await d.page.screenshot({ path: path.join(EVID, 'verify-ahead-undo-keeps-week-2-after-undo-iphone.png'), scale: 'css', animations: 'disabled' });
  await d.close();
  fs.writeFileSync(path.join(EVID, 'verify-ahead-undo-keeps-week-2.json'), JSON.stringify(out, null, 1));
  for (const k of ['before', 'afterDone', 'afterUndo']) console.log(k, JSON.stringify(out[k]));
} finally { await L.close(); }
