// SYNC e4c — localStorage use and what happens when it is full. hub.js swallows every storage error (lsSet: apps/hub.js:33).
//   node "audits/tools/phase2/SYNC/e4c-quota.mjs"
// 1. Eli's phone opens every app once: how much localStorage does the hub use, and which keys are biggest?
// 2. How much does this WebKit allow per origin (fill until setItem throws)?
// 3. With storage full and the phone offline, tick in F260 and reload: is the tick kept?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home'); await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  for (const id of ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses', 'dollywood-live', 'dollywood']) {
    try { const fr = await phone.openApp(id); await waitFor(() => fr.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500); } catch (e) { log('open', id, 'failed', e.message); }
  }
  const usage = () => phone.page.evaluate(() => { const rows = Object.keys(localStorage).map(k => [k, k.length + (localStorage.getItem(k) || '').length]); rows.sort((a, b) => b[1] - a[1]); return { totalChars: rows.reduce((n, r) => n + r[1], 0), keys: rows.length, top: rows.slice(0, 8) }; });
  out.usage = await usage();
  log(`1: after opening every app, localStorage holds ${out.usage.keys} keys, ${(out.usage.totalChars / 1024).toFixed(0)} K chars; biggest: ${out.usage.top.map(r => r[0] + ' ' + (r[1] / 1024).toFixed(1) + 'K').join(', ')}`);

  // 2 fill
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  out.fill = await phone.page.evaluate(() => {
    let n = 0; const chunk = 'x'.repeat(256 * 1024); let size = chunk.length;
    for (let i = 0; i < 400; i++) { try { localStorage.setItem('audit.fill.' + i, chunk.slice(0, size)); n += size; } catch (e) { if (size <= 64) return { filledChars: n, error: String(e.name) }; size = Math.floor(size / 2); i--; } }
    return { filledChars: n, error: null };
  });
  out.capacityChars = out.usage.totalChars + out.fill.filledChars;
  log(`2: storage full after ${(out.fill.filledChars / 1024).toFixed(0)} K more chars (${out.fill.error}); per-origin capacity here ≈ ${(out.capacityChars / 1024 / 1024).toFixed(2)} M chars`);

  // 3 offline tick with storage full
  await phone.setOffline(true);
  const id = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  await sleep(500);
  out.inMemoryPending = (await f.evaluate(() => hub.sync.pending));
  out.persistedQueue = await phone.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')));
  out.pageErrors = phone.logs.filter(l => /pageerror|QuotaExceeded/i.test(l));
  out.messageOnScreen = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  await phone.page.reload({ waitUntil: 'load' }); await phone.setOffline(true);
  const f2 = await (async () => { const until = Date.now() + 10000; while (Date.now() < until) { const fr = phone.frame('f260'); if (fr) return fr; await sleep(100); } })();
  await f2.waitForSelector('#todayDone'); await sleep(1500);
  out.tickShownAfterReload = await f2.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), id);
  // free the junk, go online: does the tick ever reach the server?
  await phone.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('audit.fill.')) localStorage.removeItem(k); });
  await phone.setOffline(false); await sleep(4000);
  out.serverHasTick = !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id];
  log(`3: offline tick ${id} with storage full → pending in memory ${out.inMemoryPending}, queue persisted [${out.persistedQueue}], errors ${JSON.stringify(out.pageErrors)}, message on screen ${out.messageOnScreen}`);
  log(`3: after an offline reload the tick is shown: ${out.tickShownAfterReload}; after storage is freed and the phone is online, the server has it: ${out.serverHasTick}`);
  log('evidence', writeEvidence('e4c-quota.json', out));
} finally { await L.close(); }
