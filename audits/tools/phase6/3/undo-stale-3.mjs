// Batch 3 copy of audits/tools/phase3/prayer/undo-stale.mjs (P3-PRAYER-09).
// What changed on purpose: Prayer's toast is now the shared hub.toast (Worker B, P4-SHAPE-02), so the Undo is
// `#hub-toast .toast-act` and the toast is `#hub-toast` (shown when not hidden), not the page's old #toast / #toastAct.
// Evidence goes to audits/evidence/p6/3 instead of p3. The flow and what it measures are unchanged.
// "Mark answered" offers Undo for 6 s (apps/prayer.html:1331). The Undo closure holds the row object `p` from before.
// If a remote change lands in those 6 s, absorbRemote() rebuilds D from hub (699-705: load()), so `p` is no longer in D:
// Undo edits a detached object, save() finds nothing changed (put() compares SNAP, 652-656), and the request stays
// answered while the screen jumps to Today as if it worked. absorbRemote's busy test (701-702) does not count the toast.
// Control: the same Undo with no remote change.
// The remote change is Eli's own other device editing another request (an API write), then hub.pull() standing in for
// the 30 s poll / a visibility pull landing inside the 6 s window.
// Run: node "audits/tools/phase3/prayer/undo-stale.mjs" -> audits/evidence/p6/3/undo-stale.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const srv = async id => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); const it = r.body.items.find(i => i.key === 'prayer:' + id); return it && it.value.status; };
async function run(label, remote) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  const id = 'p004';
  await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
  await f.click(`[data-answer="${id}"]`); await sleep(200);
  await f.fill('#askIn', 'Calmer mornings all week.'); await f.click('#askSave'); await sleep(1200);
  if (remote) {
    const other = await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p005'));
    await L.apiAs('eli', '/api/data/prayer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'prayer:p005', value: { ...other, detail: 'edited on the iPad' }, updated_at: Date.now() }] } });
    await f.evaluate(() => hub.pull()); await sleep(800);
  }
  const toastOn = await f.evaluate(() => (document.getElementById('hub-toast') ? !document.getElementById('hub-toast').hidden : false) && ((document.querySelector('#hub-toast .toast-act') || {}).textContent || ''));
  await f.click('#hub-toast .toast-act'); await sleep(1500);
  const r = { toastStillOfferedUndo: toastOn, memStatus: await f.evaluate(i => D.lists.personal.prayers.find(p => p.id === i).status, id), serverStatus: await srv(id),
    screen: await f.evaluate(() => document.querySelector('.screen.on').id) };
  res[label] = r; console.log(label, JSON.stringify(r));
  await d.close();
}
try { await run('control-no-remote-change', false); await L.reset('typical'); await run('remote-change-inside-6s', true); }
catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/undo-stale.json`, JSON.stringify(res, null, 1)); await L.close(); }
