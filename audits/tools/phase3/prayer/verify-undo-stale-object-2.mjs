// Skeptic #2 for finding "undo-stale-object" (Prayer): does Undo after "Mark answered" silently fail when a pull
// lands inside the 6 s toast?  Unlike the investigator's script (explicit hub.pull()), this one waits for the app's
// OWN 30 s poll (apps/hub.js:342) to land inside the Undo window, and the remote change is a DIFFERENT person (Mom)
// editing a FAMILY-list request -- i.e. no dev-tools call on Eli's device at all. Eli answers a PERSONAL request.
//   control: the natural poll lands inside the window but nothing changed remotely -> Undo should work.
//   remote : Mom edits a family request ~5 s before the poll -> the poll brings it in -> does Undo still work?
// The frame's hub.pull is wrapped only to log WHEN the timer calls it (same function is still called).
// Run: node "audits/tools/phase3/prayer/verify-undo-stale-object-2.mjs"
//   -> audits/evidence/p3/prayer/verify-undo-stale-object-2.json (+ .png of the remote run after Undo)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const status = async (scope, id) => {
  const r = await L.apiAs('eli', `/api/data/prayer?scope=${scope}`);
  const it = r.body.items.find(i => i.key === 'prayer:' + id); return it && it.value.status;
};
async function run(label, remote) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0);
  await f.evaluate(() => { window.__pulls = []; const orig = hub.pull; hub.pull = function () { window.__pulls.push(Date.now()); return orig.apply(this, arguments); };
    window.__changes = 0; hub.onChange(() => { window.__changes++; }); });
  // Find the poll phase: wait for one natural timer pull.
  let t0 = null; const start = Date.now();
  while (!t0 && Date.now() - start < 40000) { await sleep(250); const p = await f.evaluate(() => window.__pulls.slice()); if (p.length) t0 = p[p.length - 1]; }
  if (!t0) throw new Error('no natural poll seen in 40 s');
  const id = 'p004';
  const famRows = (await L.apiAs('mom', '/api/data/prayer?scope=family')).body.items.filter(i => i.key.startsWith('prayer:') && i.value);
  const fam = famRows[0];
  // Stage the answer sheet with the note typed, then wait until ~27 s after the last poll.
  await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
  await f.click(`[data-answer="${id}"]`); await sleep(300);
  await f.fill('#askIn', 'The mornings were calmer.');
  const nodeNow = async () => f.evaluate(() => Date.now());
  while ((await nodeNow()) < t0 + 21500) await sleep(200);
  let momWrite = null;
  if (remote) {
    momWrite = await L.apiAs('mom', '/api/data/prayer/batch?scope=family', { method: 'POST',
      body: { items: [{ key: fam.key, value: { ...fam.value, detail: 'Mom added a note from her phone' }, updated_at: Date.now() }] } });
  }
  while ((await nodeNow()) < t0 + 27000) await sleep(100);
  const pullsBefore = (await f.evaluate(() => window.__pulls.length));
  const changesBefore = await f.evaluate(() => window.__changes);
  await f.click('#askSave'); const savedAt = await nodeNow();
  // Wait for the next natural poll, then give it a moment to apply.
  while ((await f.evaluate(() => window.__pulls.length)) === pullsBefore && (await nodeNow()) < savedAt + 5500) await sleep(100);
  const pollAt = (await f.evaluate(() => window.__pulls.slice(-1)[0]));
  await sleep(700);
  const beforeUndo = await f.evaluate(() => ({ toastOn: document.getElementById('toast').classList.contains('on'), act: document.getElementById('toastAct').textContent,
    changes: window.__changes, screen: document.querySelector('.screen.on').id }));
  const clickAt = await nodeNow();
  await f.click('#toastAct'); await sleep(2500);   // > flush debounce
  const r = {
    remoteWriteByMom: remote ? { key: fam.key, status: momWrite && momWrite.status } : null,
    pollLandedMsAfterSave: pollAt - savedAt, undoClickedMsAfterSave: clickAt - savedAt,
    onChangeEventsDuringWindow: beforeUndo.changes - changesBefore,
    toastOfferedUndo: beforeUndo.toastOn && beforeUndo.act,
    screenAfterUndo: await f.evaluate(() => document.querySelector('.screen.on').id),
    memStatus: await f.evaluate(i => D.lists.personal.prayers.find(p => p.id === i).status, id),
    onTodayList: await f.evaluate(i => !!document.querySelector(`#todayList [data-open="${i}"]`), id),
    serverStatus: await status('person', id),
    hubCacheStatus: await f.evaluate(i => (hub.get('prayer:' + i, { scope: 'person' }) || {}).status, id),
  };
  if (remote) await d.shot(`${OUT}/verify-undo-stale-object-2-remote-after-undo.png`);
  res[label] = r; console.log(label, JSON.stringify(r));
  await d.close();
}
try {
  await run('control-natural-poll-no-remote-change', false);
  await L.reset('typical');
  await run('mom-edits-family-request-natural-poll', true);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-undo-stale-object-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
