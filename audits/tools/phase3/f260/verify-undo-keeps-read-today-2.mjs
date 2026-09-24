// Skeptic #2 for "undo-keeps-read-today": after Today's Done then Undo (and, as a control, a tick + untick on the plan
// list itself), does f260.log[today] / summary.readToday / the streak / the 8 pm check still count the day as read?
// Local rig, typical household. Run: node "audits/tools/phase3/f260/verify-undo-keeps-read-today-2.mjs" [demo|real]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, rows, texts, ready, EVID, rel } from './_lib.mjs';
const clock = process.argv[2] || 'demo';
const L = await local({ variant: 'typical', clock, engine: 'webkit' });
const out = { clock };
const SEL = ['#todayKind', '#todayTitle', '#todayStreak', '#streak', '#heroRef'];
const snap = async (f, pid = 'eli') => { const r = await rows(L, pid); const s = r['f260.summary'] || {}; const today = await f.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  return { today, ui: await texts(f, SEL), logToday: !!(r['f260.log'] || {})[today], readToday: s.readToday, streak: s.streak, total: s.total, doneCount: Object.keys(r['f260.done'] || {}).length }; };
const evening = async pid => { const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  const o = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body; return { date: o.date, eli: (o.checked || []).find(c => c.profile === pid) }; };
try {
  // Case 1: Today card Done -> Undo
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: clock === 'demo' ? DEMO : Date.now() });
  const f = await d.openApp('f260'); await ready(f);
  out.c1 = { before: await snap(f), eveningBefore: await evening('eli') };
  out.c1.target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await f.locator('#todayDone').tap(); await sleep(1800);
  out.c1.afterDone = await snap(f);
  await f.locator('#todayUndo').tap(); await sleep(1800);
  out.c1.afterUndo = await snap(f);
  out.c1.tickAfterUndo = !!((await rows(L, 'eli'))['f260.done'] || {})[out.c1.target];
  out.c1.eveningAfterUndo = await evening('eli');
  const p1 = path.join(EVID, 'verify-undo-keeps-read-today-2-after-undo-iphone.png'); await d.page.screenshot({ path: p1, scale: 'css' }); out.c1.shot = rel(p1);
  // Reload the app: does a fresh paint still say read today?
  await d.goto('#home'); await sleep(2500);
  out.c1.home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /reading/i.test(e.textContent) && /F260|streak|Today/i.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
  const p2 = path.join(EVID, 'verify-undo-keeps-read-today-2-home-iphone.png'); await d.page.screenshot({ path: p2, scale: 'css' }); out.c1.homeShot = rel(p2);
  await d.close();
  // Case 2 (control, fresh DB): tick then untick the same day directly on the plan list (no Undo button)
  await L.reset('typical');
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: clock === 'demo' ? DEMO : Date.now() });
  const f2 = await d2.openApp('f260'); await ready(f2);
  const tgt = await f2.evaluate(() => document.getElementById('todayDone').dataset.target);
  out.c2 = { profile: 'mom', target: tgt, before: await snap(f2, 'mom') };
  const mark = async () => f2.evaluate(id => { document.querySelector('[data-day="' + id + '"] .mark').click(); }, tgt);
  await mark(); await sleep(1800); out.c2.afterTick = await snap(f2, 'mom');
  await mark(); await sleep(1800); out.c2.afterUntick = await snap(f2, 'mom');
  out.c2.evening = await evening('mom');
  await d2.close();
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
const j = path.join(EVID, 'verify-undo-keeps-read-today-2' + (clock === 'real' ? '-real' : '') + '.json'); fs.writeFileSync(j, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 6000)); console.log('saved', rel(j));
