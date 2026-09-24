// SYNC skeptic #2 for "quota-errors-swallowed" — does a full localStorage silently lose an F260 tick?
//   node "audits/tools/phase2/SYNC/verify-quota-errors-swallowed-2.mjs"
// Three independent runs, each on a fresh local instance (so today's tick is never toggled twice):
//   A online-full     — storage full, phone ONLINE, tick: does the server get it?
//   B offline-stay    — storage full, phone offline, tick, stay on the page (no reload), go online (storage still full)
//   C offline-reload  — storage full, phone offline, tick, reload while offline, free the space, go online;
//                       then does the device still show the tick, what does hub.sync say, and does the next tick heal it?
//   D offline-reload-slack — as C, but ~400 chars are left free after the fill, so the cache's small growth fits and
//                       only the queue write (whole values) fails: the divergence case the finding describes.
//   One scenario only:  node "audits/tools/phase2/SYNC/verify-quota-errors-swallowed-2.mjs" offline-reload-slack
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, writeEvidence } from './_util.mjs';

const FILL = () => {                                          // fill the origin's localStorage until setItem throws
  let n = 0; const chunk = 'x'.repeat(256 * 1024); let size = chunk.length;
  for (let i = 0; i < 400; i++) { try { localStorage.setItem('audit.fill2.' + i, chunk.slice(0, size)); n += size; } catch (e) { if (size <= 64) return { filledChars: n, error: String(e.name) }; size = Math.floor(size / 2); i--; } }
  return { filledChars: n, error: null };
};
const FREE = () => { for (const k of Object.keys(localStorage)) if (k.startsWith('audit.fill2.')) localStorage.removeItem(k); };

async function run(scenario) {
  const out = { scenario };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
    const id = await f.getAttribute('#todayDone', 'data-target');
    out.day = id;
    out.serverBefore = !!((await serverRow(L, 'eli', 'f260', 'f260.done')) || { value: {} }).value[id];
    out.valueSizes = await f.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}').items || {}; return Object.fromEntries(['f260.done', 'f260.log', 'f260.summary'].map(k => [k, JSON.stringify(c[k] ? c[k].v : null).length])); });
    const slack = scenario.endsWith('-slack') ? 400 : 0;       // D: leave room for the cache's few-byte growth but not the queue's whole values
    if (slack) await phone.page.evaluate(n => localStorage.setItem('audit.fill2.pad', 'p'.repeat(n)), slack);
    out.fill = await phone.page.evaluate(FILL);
    if (slack) await phone.page.evaluate(() => localStorage.removeItem('audit.fill2.pad'));
    out.slack = slack;
    // prove the queue key cannot take one more write (what saveQueue would need)
    out.probeQueueWrite = await phone.page.evaluate(() => { try { localStorage.setItem('hub.queue.f260.person.eli', JSON.stringify({ probe: { value: 'x'.repeat(2000), updated_at: 1 } })); localStorage.setItem('hub.queue.f260.person.eli', '{}'); return 'fits'; } catch (e) { return e.name; } });
    if (scenario !== 'online-full') await phone.setOffline(true);
    await f.click('#todayDone');
    await sleep(800);
    out.afterTick = await f.evaluate(() => ({ pendingInMemory: hub.sync.pending, state: hub.sync.state, lastError: hub.sync.lastError,
      persistedQueue: Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')),
      cacheHasTick: null, toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden && t.textContent ? t.textContent : null; })() }));
    out.afterTick.cacheHasTick = await f.evaluate(id => { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'); return !!(c.items && c.items['f260.done'] && c.items['f260.done'].v && c.items['f260.done'].v[id]); }, id);
    out.errorsLogged = phone.logs.filter(l => /pageerror|Quota|error:/i.test(l));
    log(`${scenario}: tick ${id} → in-memory pending ${out.afterTick.pendingInMemory}, sync '${out.afterTick.state}', persisted queue [${out.afterTick.persistedQueue}], cache has tick ${out.afterTick.cacheHasTick}, toast ${JSON.stringify(out.afterTick.toast)}, console errors ${out.errorsLogged.length}`);

    if (scenario === 'online-full') {
      await sleep(3000);
      out.serverHasTick = !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id];
      log(`${scenario}: storage full but online → server has the tick: ${out.serverHasTick}`);
    }
    if (scenario === 'offline-stay') {
      await sleep(3000);
      await phone.setOffline(false);                           // storage is STILL full
      await waitFor(async () => !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id], { timeout: 12000 });
      out.serverHasTick = !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id];
      out.after = await f.evaluate(() => ({ pending: hub.sync.pending, state: hub.sync.state }));
      log(`${scenario}: no reload, back online with storage still full → server has the tick: ${out.serverHasTick}; frame sync ${JSON.stringify(out.after)}`);
    }
    if (scenario.startsWith('offline-reload')) {
      await phone.page.reload({ waitUntil: 'load' });
      const f2 = await waitFor(() => phone.frame('f260'), { timeout: 10000, every: 100 });
      await f2.waitForSelector('#todayDone'); await sleep(1500);
      out.tickShownAfterOfflineReload = await f2.evaluate(id => { const el = document.querySelector('[data-day="' + id + '"]'); return !!(el && el.classList.contains('done')); }, id);
      out.afterReload = await f2.evaluate(() => ({ pending: hub.sync.pending, state: hub.sync.state }));
      await phone.page.evaluate(FREE);
      await phone.setOffline(false);
      await sleep(6000);
      await f2.evaluate(() => hub.pull());
      await sleep(1000);
      out.serverHasTick = !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id];
      out.deviceStillShowsTick = await f2.evaluate(id => { const el = document.querySelector('[data-day="' + id + '"]'); return !!(el && el.classList.contains('done')); }, id);
      out.afterOnline = await f2.evaluate(() => ({ pending: hub.sync.pending, state: hub.sync.state, lastError: hub.sync.lastError }));
      log(`${scenario}: after offline reload the tick is shown ${out.tickShownAfterOfflineReload} (sync ${JSON.stringify(out.afterReload)}); space freed + online → server has tick ${out.serverHasTick}; device still shows tick ${out.deviceStillShowsTick}; sync ${JSON.stringify(out.afterOnline)}`);
      // a second device (the Kitchen iPad as Eli) — what does the house see?
      const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      const fi = await ipad.openApp('f260', { wait: '#todayDone' });
      await waitFor(() => fi.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
      out.ipadShowsTick = await fi.evaluate(id => { const el = document.querySelector('[data-day="' + id + '"]'); return !!(el && el.classList.contains('done')); }, id);
      // does the next tick on the phone heal it? (F260 saves the whole f260.done map on every tick)
      const other = await f2.evaluate(id => { const el = [...document.querySelectorAll('[data-day]')].find(e => e.dataset.day !== id && !e.classList.contains('done') && e.offsetParent); return el ? el.dataset.day : null; }, id);
      out.nextTickDay = other;
      if (other) {
        await f2.click(`[data-day="${other}"]`);
        await waitFor(async () => !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[other], { timeout: 10000 });
        const v = (await serverRow(L, 'eli', 'f260', 'f260.done')).value;
        out.afterNextTick = { [id]: !!v[id], [other]: !!v[other] };
      }
      log(`${scenario}: iPad (same person) shows the tick: ${out.ipadShowsTick}; next tick on the phone (${other}) → server ${JSON.stringify(out.afterNextTick)}`);
    }
  } finally { await L.close(); }
  return out;
}

const res = {};
const only = process.argv[2] ? process.argv[2].split(',') : ['online-full', 'offline-stay', 'offline-reload', 'offline-reload-slack'];
for (const s of only) {
  try { res[s] = await run(s); } catch (e) { res[s] = { error: String(e && e.stack || e) }; log(s, 'FAILED', e.message); }
}
log('evidence', writeEvidence('verify-quota-errors-swallowed-2.json', res));
