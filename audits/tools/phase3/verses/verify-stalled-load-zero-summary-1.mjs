// Skeptic #1 for "stalled-load-zero-summary": a brand-new phone (no cache) for Eli where every GET /api/data/* is delayed 9 s.
// Observes, on a timeline, what Verses shows and what the server's verses.summary row holds, before and after the pulls land.
//   node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-1.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = 'audits/evidence/p3/verses';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const summary = async () => { const r = await L.apiAs('eli', '/api/data/verses?scope=person'); const rows = (r.body && (r.body.rows || r.body.items || r.body)) || []; const row = Array.isArray(rows) ? rows.find(x => x.key === 'summary') : null; return row ? { value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value, updated_at: row.updated_at } : { raw: r.status }; };
try {
  out.serverSummaryBefore = await summary();
  const ph = await L.newDevice({ name: 'Verify phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  let delayed = 0;
  await phone.ctx.route(u => /\/api\/data\/[^/?]+$/.test(u.pathname), async r => { if (r.request().method() !== 'GET') return r.continue(); delayed++; await sleep(9000); await r.continue().catch(() => {}); });
  const t0 = Date.now();
  const f = await phone.openApp('verses');
  const timeline = []; let lastKey = '';
  const snap = async () => f.evaluate(() => { const v = s => { const e = document.querySelector(s); return e ? !e.hidden : null; }; const t = s => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; };
    return { who: t('#who'), trainer: v('#trainer'), done: v('#done'), empty: v('#empty'), emptyH: document.querySelector('#empty h2') && document.querySelector('#empty h2').textContent, ref: v('#trainer') ? t('#ref') : null, trained: window.verses ? window.verses.trained().length : null }; }).catch(e => ({ err: e.message }));
  let stallShot = false, zeroSeen = null;
  while (Date.now() - t0 < 30000) {
    const s = await snap(); const ms = Date.now() - t0; const k = JSON.stringify(s);
    if (k !== lastKey) { timeline.push({ ms, ...s }); lastKey = k; }
    if (s.empty && !stallShot) { stallShot = true; await phone.page.screenshot({ path: `${EV}/verify-stalled-load-zero-summary-1-stall-iphone.png`, scale: 'css', animations: 'disabled', caret: 'hide' }); const sv = await summary(); out.serverSummaryWhileEmpty = { ms: Date.now() - t0, ...sv }; }
    if (stallShot && !zeroSeen) { const sv = await summary(); if (sv.value && sv.value.total === 0) zeroSeen = { ms: Date.now() - t0, ...sv }; }
    if (s.trainer && stallShot) break;
    await sleep(250);
  }
  out.delayedGets = delayed;
  out.timeline = timeline;
  out.serverZeroSummarySeen = zeroSeen;
  await sleep(4000);
  out.serverSummaryAfter = { ms: Date.now() - t0, ...(await summary()) };
  await phone.page.screenshot({ path: `${EV}/verify-stalled-load-zero-summary-1-after-iphone.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.logs = phone.logs.filter(l => /error/i.test(l)).slice(0, 10);
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(`${EV}/verify-stalled-load-zero-summary-1.json`, JSON.stringify(out, null, 1));
} finally { await L.close(); }
