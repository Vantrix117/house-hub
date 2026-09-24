// Skeptic #1 for "not-yet-toast-wrong-interval": does the "Not yet" toast say "again tomorrow" when the row is actually
// scheduled 2/4/7 days out (apps/verses.html:295-296 vs 302)? Independent of _lib.mjs. Local rig only.
// Setup: Eli's memorised verses all pushed to 2026-12-31 except five targets, due in a fixed order (oldest first):
//   A box 5 -> Not yet, B box 4 -> Not yet, C box 3 -> Not yet, D box 2 -> Not yet (control: box 1 = 1 day), E box 5 -> Got it.
// Rated through real taps (Show, then the rating button) on the iPhone PWA in the shell viewer, demo clock (22 Sep 2026).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-not-yet-toast-wrong-interval-1';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const f260 = (await L.apiAs('eli', '/api/data/f260?scope=person')).body;
  const get = k => (f260.items || []).find(i => i.key === k);
  const mem = get('f260.mem').value, rc0 = (get('f260.recall') || {}).value || {};
  const ids = Object.keys(mem).filter(id => mem[id] && /^\d{1,2}-[01]$/.test(id));
  if (ids.length < 5) throw new Error('need 5 memorised verses, have ' + ids.length);
  const plan = [['A', 5, 'not'], ['B', 4, 'not'], ['C', 3, 'not'], ['D', 2, 'not'], ['E', 5, 'got']];
  const rc = {}; for (const id of ids) rc[id] = { ...(rc0[id] || {}), s: 'got', t: 1, box: 3, due: '2026-12-31', last: '2026-09-01', streak: 2 };
  const targets = plan.map(([tag, box, kind], i) => ({ tag, id: ids[i], box, kind, due: '2026-09-0' + (i + 1) }));
  for (const t of targets) rc[t.id] = { s: 'got', t: 1, box: t.box, due: t.due, last: '2026-08-01', streak: 3 };
  await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.recall', value: rc, updated_at: f260.now + 1 }] } });

  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  await d.goto('#home');
  const f = await d.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden])', { timeout: 15000 });
  await sleep(400);
  const results = [];
  for (const t of targets) {
    const cur = await f.evaluate(() => window.verses.current());
    const ref = await f.evaluate(() => document.querySelector('#ref').textContent);
    await f.click('#show');
    await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
    await f.click(`#act-rate [data-rate="${t.kind}"]`);
    await sleep(200);
    const toast = await f.evaluate(() => { const e = document.getElementById('hub-toast'); return e ? e.textContent : null; });
    if (t.tag === 'A') await d.page.screenshot({ path: path.join(EVID, PFX + '-box5-not-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    const local = await f.evaluate(id => (hub.get('f260.recall', { app: 'f260', scope: 'person' }) || {})[id], t.id);
    results.push({ tag: t.tag, id: t.id, cardOnScreen: cur, ref, prevBox: t.box, rating: t.kind, toast, rowAfter: { box: local && local.box, due: local && local.due }, daysUntilDue: local && Math.round((Date.parse(local.due) - Date.parse('2026-09-22')) / 86400000) });
    await sleep(2800); // let the toast clear before the next rating
  }
  // server copy after flush
  let server = null;
  for (let i = 0; i < 40; i++) { const r = (await L.apiAs('eli', '/api/data/f260?scope=person')).body; const row = (r.items || []).find(x => x.key === 'f260.recall').value; if (targets.every(t => row[t.id].last === '2026-09-22')) { server = row; break; } await sleep(300); }
  for (const r of results) r.serverRow = server ? { box: server[r.id].box, due: server[r.id].due } : 'not flushed';
  const out = { demoToday: '2026-09-22', results };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
