// SYNC skeptic #1, diagnostic for scenario D of verify-quota-errors-swallowed-1.mjs:
// storage full except ~300 chars, phone offline, tick in F260, NO reload, free storage, go online. Which window posts what?
//   node "audits/tools/phase2/SYNC/verify-quota-errors-swallowed-1-d.mjs"   (≈30 s)
// Logs every POST /api/data/f260/batch (which frame sent it, which keys, whether f260.done carries the tick) and the
// F260 frame's in-memory queue size just before and after going online. Runs twice: run 1 ticks a reading in the
// current week (tick in place); runs 2..RUNS (default 5) first finish the current week online on a helper phone, then a
// fresh phone ticks next week's first reading offline (Done then also writes f260.week/f260.weekStart via setCurrent,
// apps/f260.html:1592,1674-1676). Outcome is timing-dependent (shell and frame race to flush), hence several runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const waitFor = async (fn, timeout = 10000) => { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };
const out = { runs: [] };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const serverDone = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.done'); return (r.body && r.body.item) || null; };
  const RUNS = +(process.env.RUNS || 5);
  for (let run = 1; run <= RUNS; run++) {
    const open = async name => {
      const ph = await L.newDevice({ name, profiles: ['eli'] });
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
      const f = await d.openApp('f260', { wait: '#todayDone' });
      await waitFor(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0 && hub.sync.pending === 0), 20000); await sleep(1500);
      return { d, f };
    };
    if (run >= 2) {   // on a helper phone, finish the current week online so the Done button offers next week's first reading
      const p = await open('Eli prep ' + run);
      const wk = (await p.f.getAttribute('#todayDone', 'data-target')).split('-')[0];
      for (let k = 0; k < 5 && (await p.f.getAttribute('#todayDone', 'data-target')).split('-')[0] === wk; k++) { await p.f.click('#todayDone'); await sleep(1500); }
      await waitFor(() => p.f.evaluate(() => hub.sync.pending === 0), 10000); await sleep(1000);
      await p.d.close();
    }
    const { d, f } = await open('Eli phone D' + run);   // a fresh phone (fresh localStorage), as in scenario D
    const id = await f.getAttribute('#todayDone', 'data-target');
    const posts = [];
    d.page.on('request', rq => {
      if (rq.method() !== 'POST' || !/\/api\/data\/f260\/batch/.test(rq.url())) return;
      let body = null; try { body = JSON.parse(rq.postData()); } catch {}
      const items = (body && body.items) || [];
      const done = items.find(i => i.key === 'f260.done');
      posts.push({ t: Date.now() - T0, from: rq.frame() && rq.frame().url().includes('/apps/f260.html') ? 'f260 frame' : 'shell', keys: items.map(i => i.key), doneCarriesTick: done ? !!(done.value && done.value[id]) : null });
    });
    // fill all but ~300 chars
    await d.page.evaluate(() => { localStorage.setItem('audit.slack', 'x'.repeat(300)); let size = 262144, i = 0; while (size >= 1) { try { localStorage.setItem('audit.fill.' + i, 'x'.repeat(size)); i++; } catch { size = Math.floor(size / 2); } } localStorage.removeItem('audit.slack'); });
    await d.setOffline(true);
    await f.click('#todayDone'); await sleep(900);
    const memQ = () => f.evaluate(() => hub.sync.pending);
    const r = { run, target: id, pendingInMemoryAfterTick: await memQ(),
      persistedQueue: await d.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}'))),
      shellPending: await d.page.evaluate(() => hub.sync.pending) };
    await d.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('audit.')) localStorage.removeItem(k); });
    r.pendingInMemoryAfterFree = await memQ();
    await d.setOffline(false); await sleep(5000);
    const s = await serverDone();
    r.posts = posts; r.pendingAfterOnline = await memQ(); r.frameState = await f.evaluate(() => hub.sync.state);
    r.serverHasTick = !!(s && s.value && s.value[id]); r.tickShown = await f.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), id);
    log(JSON.stringify(r));
    out.runs.push(r);
    await d.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify-quota-errors-swallowed-1-d.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-quota-errors-swallowed-1-d.json');
} finally { await L.close(); }
