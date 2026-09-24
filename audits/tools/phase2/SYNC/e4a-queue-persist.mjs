// SYNC e4a — is a tick safe if the app is reloaded while offline, or closed inside the 250 ms flush debounce?
//   node "audits/tools/phase2/SYNC/e4a-queue-persist.mjs"
// 1. Phone offline: tick in F260, reload the whole PWA at once (still offline). Queue still there? Tick still shown? Online → server?
// 2. Phone online: tick and navigate the PWA away 20 ms later (swipe-closed). Did the server get it? Reopen → does it flush?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, writeEvidence } from './_util.mjs';

const out = { offlineReload: {}, closeInsideDebounce: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  const qOf = () => phone.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')));
  const srvHas = async id => !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[id];

  // 1
  await phone.setOffline(true);
  const id1 = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  await phone.page.reload({ waitUntil: 'load' });
  await phone.setOffline(true);                       // re-assert the switch in the new page (navigator.onLine + event)
  f = await (async () => { const until = Date.now() + 10000; while (Date.now() < until) { const fr = phone.frame('f260'); if (fr) return fr; await sleep(100); } })();
  await f.waitForSelector('#todayDone', { timeout: 10000 }); await sleep(1500);
  out.offlineReload.queueAfterReload = await qOf();
  out.offlineReload.tickShownAfterReload = await f.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), id1);
  out.offlineReload.serverWhileOffline = await srvHas(id1);
  const tOn = Date.now(); await phone.setOffline(false);
  const ok1 = await waitFor(() => srvHas(id1), { timeout: 15000, every: 100 });
  out.offlineReload.serverAfterOnlineMs = ok1 ? Date.now() - tOn : null;
  log(`1: offline tick ${id1}, reload offline → queue in localStorage [${out.offlineReload.queueAfterReload}], tick still shown ${out.offlineReload.tickShownAfterReload}, server has it while offline ${out.offlineReload.serverWhileOffline}; back online → on the server after ${out.offlineReload.serverAfterOnlineMs} ms`);

  // 2
  await sleep(1500);
  const id2 = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  await sleep(20);
  await phone.page.goto('about:blank');
  await sleep(1500);
  out.closeInsideDebounce.serverAfterClose = await srvHas(id2);
  out.closeInsideDebounce.queueWhileClosed = await (async () => { await phone.page.goto(L.site + '/manifest.json'); return phone.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}'))); })();
  const tRe = Date.now(); await phone.goto('#home');
  const ok2 = await waitFor(() => srvHas(id2), { timeout: 15000, every: 100 });
  out.closeInsideDebounce.serverAfterReopenMs = ok2 ? Date.now() - tRe : null;
  log(`2: tick ${id2} then closed 20 ms later → server has it: ${out.closeInsideDebounce.serverAfterClose}; queue kept while closed [${out.closeInsideDebounce.queueWhileClosed}]; reopened Home → on the server after ${out.closeInsideDebounce.serverAfterReopenMs} ms`);
  log('evidence', writeEvidence('e4a-queue-persist.json', out));
} finally { await L.close(); }
