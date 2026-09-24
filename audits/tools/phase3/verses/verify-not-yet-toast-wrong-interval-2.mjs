// Skeptic #2 for "not-yet-toast-wrong-interval": rate "Not yet" through the real buttons (Show -> Not yet) on verses
// seeded in boxes 1..5, and record the toast text next to the row the server ends up holding.
// Code under test: apps/verses.html:295 (Not yet = box - 1, min 1), 296 (due = today + INTERVALS[box-1]), 302 (toast text).
// Usage: node "audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p3/verses');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const results = [];
try {
  const get = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.recall'); const mem = (r.body.items || []).find(i => i.key === 'f260.mem'); return { now: r.body.now, rc: it ? it.value : {}, mem: mem ? mem.value : {} }; };
  const s0 = await get();
  const memIds = Object.keys(s0.mem).filter(k => s0.mem[k]);
  // pick five memorised verses; make them the only ones due (overdue so they sort first), in boxes 1..5; push the rest out
  const pick = memIds.slice(0, 5);
  const rc = {};
  for (const id of memIds) rc[id] = { s: 'got', t: 1, box: 3, due: '2026-12-01', last: '2026-09-20', streak: 1 };
  pick.forEach((id, i) => { rc[id] = { s: 'got', t: 1, box: i + 1, due: '2026-09-0' + (i + 1), last: '2026-08-25', streak: 2 }; });
  await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.recall', value: rc, updated_at: s0.now + 1 }] } });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f = await d.openApp('verses', { wait: '#trainer:not([hidden])' });
  await f.waitForFunction(() => window.verses && window.verses.current(), null, { timeout: 15000 });
  // capture every toast text in the app frame
  await f.evaluate(() => { window.__toasts = []; const orig = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(m); return orig(m, ms); }; });
  const today = await f.evaluate(() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); });
  for (let k = 0; k < pick.length; k++) {
    const id = await f.evaluate(() => window.verses.current());
    if (!id) break;
    const prevBox = rc[id].box;
    await f.click('#show'); await sleep(150);
    await f.click('#act-rate [data-rate="not"]'); await sleep(300);
    const toast = await f.evaluate(() => window.__toasts[window.__toasts.length - 1]);
    const domToast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : null; });
    if (prevBox === 5 || prevBox === 3) await d.page.screenshot({ path: path.join(OUT, `verify-not-yet-toast-wrong-interval-2-box${prevBox}-iphone.png`), scale: "css", animations: "disabled", caret: "hide" });
    results.push({ id, prevBox, toast, domToast });
  }
  // let the queue flush, then read the server
  for (let i = 0; i < 40; i++) { const h = await d.hub(f); if (h.sync && h.sync.state === 'synced' && h.sync.pending === 0) break; await sleep(250); }
  await sleep(500);
  const s1 = await get();
  const dayDiff = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000); };
  for (const r of results) { const row = s1.rc[r.id]; r.serverRow = { box: row.box, due: row.due, last: row.last, s: row.s }; r.daysUntilNext = dayDiff(today, row.due); r.toastSaysTomorrow = /again tomorrow/.test(r.toast); r.mismatch = r.toastSaysTomorrow && r.daysUntilNext !== 1; }
  // cross-check: the Coming up list label the app itself shows for those verses
  const later = await f.evaluate(() => [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()));
  const out = { script: 'audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-2.mjs', today, results, comingUp: later.slice(0, 12), logs: d.logs.filter(l => /error/i.test(l)).slice(0, 10) };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-not-yet-toast-wrong-interval-2.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
