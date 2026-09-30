// Batch 2c copy of audits/tools/phase2/SYNC/e10-tv-reading-cache.mjs: Eli's reading is also ticked in F260 (his log row for
// today), as the F260 app does with the "Read week…" line, because since batch 2c the TV reads who read from the F260 logs
// (GET /api/f260/readers) and no longer from feed lines. Otherwise unchanged.
//   node "audits/tools/phase6/2c/e10-tv-reading-cache-2c.mjs"
// SYNC e10 — the TV's "Reading today" comes from "Read week…" feed lines (index.html:1063). Online it reads 100 lines
// (index.html:1108), but it caches only the first 30 (same line) and paints from that cache after a reload or offline reopen.
// Lead (01-leads.md, TV): "Readers can lose their ✓ after an offline reopen or a reload."
//   node "audits/tools/phase2/SYNC/e10-tv-reading-cache.mjs"
import { local, sleep } from '../../lib/local.mjs';
const nyDay = () => { const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value; return p.year + '-' + p.month + '-' + p.day; };

import { log, waitFor, shot, writeEvidence } from '../../phase2/SYNC/_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const dev = await L.newDevice({ name: 'Audit poster', profiles: ['eli', 'christian'] });
  const post = (pid, text) => L.apiAs(null, '/api/activity', { method: 'POST', deviceToken: dev.device.token, profileToken: dev.sessions[pid], body: { app_id: pid === 'eli' ? 'f260' : 'leftovers', text } });
  const tickF260 = pid => L.apiAs(pid, '/api/data/f260/' + encodeURIComponent('log:' + nyDay()) + '?scope=person', { method: 'PUT', body: { value: true, updated_at: Date.now() } });   // what F260 writes with the tick (batch 2c: the TV reads the logs)
  await post('eli', 'Read week 38 day 3 — Acts 6'); await tickF260('eli');
  for (let i = 1; i <= 35; i++) await post('christian', 'Logged dish ' + i + ' in the fridge');   // a busy kitchen day
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await tv.goto('#home');
  const eliRead = () => tv.page.evaluate(() => [...document.querySelectorAll('#tv-read > *')].some(e => /\bEli\b/.test(e.textContent) && /✓/.test(e.textContent)));
  out.online = !!(await waitFor(eliRead, { timeout: 10000, every: 250 }));
  out.cachedRows = await tv.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.feed') || '[]'); return { rows: c.length, hasEliRead: c.some(a => a.profile_id === 'eli' && /^Read week/.test(a.text)) }; });
  await tv.setOffline(true);
  await tv.page.reload({ waitUntil: 'load' }); await tv.setOffline(true); await sleep(3000);
  out.offlineReopen = await eliRead();
  out.shot = await shot(tv.page, 'e10-tv-offline-reopen-2c.png');
  log(`TV online: Eli ✓ ${out.online}; cached feed ${out.cachedRows.rows} rows, includes Eli's reading line: ${out.cachedRows.hasEliRead}; after an offline reopen: Eli ✓ ${out.offlineReopen}`);
  log('evidence', writeEvidence('e10-tv-reading-cache-2c.json', out));
} finally { await L.close(); }
