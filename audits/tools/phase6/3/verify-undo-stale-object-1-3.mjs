// Batch 3 copy of audits/tools/phase3/prayer/verify-undo-stale-object-1.mjs (P3-PRAYER-09).
// What changed on purpose: Prayer's toast is now the shared hub.toast (Worker B, P4-SHAPE-02), so the Undo is
// `#hub-toast .toast-act` and the toast is `#hub-toast` (shown when not hidden), not the page's old #toast / #toastAct.
// Evidence goes to audits/evidence/p6/3 instead of p3. The flow and what it measures are unchanged.
// Skeptic #1 for finding "undo-stale-object" (Prayer): Undo after "Mark answered" is lost if a pull lands inside the 6 s toast.
// Independent reproduction. Unlike undo-stale.mjs this does NOT call hub.pull() by hand: it learns the phase of the app's own
// 30 s pull timers (the shell's and the iframe's hub.js, apps/hub.js:342) from the network, then schedules the tap on
// "Mark answered" so the NEXT natural poll lands ~2 s later, and taps Undo ~5 s after the save (inside the 6 s toast,
// apps/prayer.html:1149). The remote change is made by a second browser device (Eli's other phone) through the Prayer app's
// own save() path, then flushed.
// Runs:
//   control      : Mark answered + Undo, no poll inside the window                 -> expect status 'active'
//   pollNoRemote : a natural poll inside the window, but nothing changed remotely  -> does the echo alone break Undo?
//   pollRemote   : a natural poll inside the window after another device's change -> the claim
// Run: node "audits/tools/phase3/prayer/verify-undo-stale-object-1.mjs"
//   -> audits/evidence/p6/3/verify-undo-stale-object-1.json (+ one 1x PNG of the pollRemote end state)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3';
const PFX = `${OUT}/verify-undo-stale-object-1`;
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = { started: new Date().toISOString(), runs: {} };
const srvStatus = async id => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); const it = r.body.items.find(i => i.key === 'prayer:' + id); return it && it.value.status; };

async function run(label, { poll, remote, id }) {
  await L.reset('typical');
  const other = await L.newDevice({ name: 'Eli second phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const pulls = [];
  d.page.on('request', r => { if (r.method() === 'GET' && /\/api\/data\/prayer\?scope=person/.test(r.url())) pulls.push({ t: Date.now(), frame: r.frame() && r.frame().url().includes('/apps/') ? 'app' : 'shell' }); });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0);
  const before = { memStatus: await f.evaluate(i => D.lists.personal.prayers.find(p => p.id === i).status, id), serverStatus: await srvStatus(id) };
  // learn the poll phases: watch ~32 s of the app's own timers
  await sleep(32000);
  const now = Date.now();
  const phases = [...new Map(pulls.filter(p => p.t > now - 31000).map(p => [p.frame, p.t])).entries()];
  // next natural poll T at least 9 s away (from any timer), or, for the control, a moment with no poll in the next 9 s
  const nexts = phases.map(([fr, t]) => { let n = t; while (n < now + 9000) n += 30000; return { fr, n }; }).sort((a, b) => a.n - b.n);
  let T, target;
  if (poll) { target = nexts[0]; T = target.n; }
  else {
    // pick a save time with no poll in [save, save+7s]
    let s = now + 3000; const bad = s => nexts.some(({ n }) => [n, n - 30000, n + 30000].some(x => x >= s - 500 && x <= s + 7500));
    while (bad(s)) s += 500; T = s + 2000; target = null;
  }
  // open the Mark answered sheet and type the note ahead of time
  await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
  await f.click(`[data-answer="${id}"]`); await sleep(300);
  await f.fill('#askIn', 'Calmer mornings all week.');
  let remoteAt = null;
  if (remote) {
    while (Date.now() < T - 4500) await sleep(50);
    const o = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: other });
    const g = await o.openApp('prayer', { wait: '#todayLine' });
    await g.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0);
    await g.evaluate(() => { const p = D.lists.personal.prayers.find(x => x.id === 'p005'); p.detail = 'edited on the other phone'; stamp(p); save(); return hub.flush(); });
    remoteAt = Date.now(); await o.close();
  }
  while (Date.now() < T - 2000) await sleep(50);
  await f.click('#askSave'); const savedAt = Date.now();
  await f.evaluate(i => { window.__v = D.lists.personal.prayers.find(p => p.id === i); }, id);
  const afterSave = await f.evaluate(() => ({ status: window.__v.status, screen: document.querySelector('.screen.on').id }));
  while (Date.now() < savedAt + 5000) await sleep(50);
  const pre = await f.evaluate(() => ({ toast: (document.getElementById('hub-toast') ? !document.getElementById('hub-toast').hidden : false) && ((document.querySelector('#hub-toast .toast-act') || {}).textContent || ''),
    heldRowStillInD: D.lists.personal.prayers.includes(window.__v) }));
  await f.click('#hub-toast .toast-act'); const undoAt = Date.now();
  await sleep(600); await f.evaluate(() => hub.flush()); await sleep(1200);
  const pullsInWindow = pulls.filter(p => p.t >= savedAt && p.t <= undoAt).map(p => ({ frame: p.frame, msAfterSave: p.t - savedAt }));
  const r = {
    id, before, remoteChangeMsBeforeSave: remoteAt ? savedAt - remoteAt : null, afterSave, beforeUndoTap: pre, undoMsAfterSave: undoAt - savedAt, pullsInWindow,
    after: { memStatus: await f.evaluate(i => D.lists.personal.prayers.find(p => p.id === i).status, id), heldObjectStatus: await f.evaluate(() => window.__v.status),
      serverStatus: await srvStatus(id), screen: await f.evaluate(() => document.querySelector('.screen.on').id),
      shownOnToday: await f.evaluate(i => !!document.querySelector(`#todayList [data-open="${i}"]`), id),
      queue: (await d.hub(f)).queue },
  };
  if (label === 'pollRemote') { await d.page.screenshot({ path: `${PFX}-pollRemote-after-undo.png`, scale: 'css' }); r.shot = `${PFX}-pollRemote-after-undo.png`; }
  res.runs[label] = r; console.log(label, JSON.stringify(r));
  await d.close();
}
try {
  await run('control', { poll: false, remote: false, id: 'p004' });
  await run('pollNoRemote', { poll: true, remote: false, id: 'p004' });
  await run('pollRemote', { poll: true, remote: true, id: 'p004' });
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${PFX}.json`, JSON.stringify(res, null, 1)); await L.close(); }
