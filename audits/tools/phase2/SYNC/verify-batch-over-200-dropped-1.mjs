// Skeptic #1 for SYNC finding "batch-over-200-dropped".
//   node "audits/tools/phase2/SYNC/verify-batch-over-200-dropped-1.mjs"
// Independent of e4b. Three runs on the local instance, each on a fresh paired phone (Eli):
//   A. 201 family reminders written offline, then back online  (the claim)
//   B. 200 written offline, then back online                   (control: the boundary must pass)
//   C. 201 written in one tick while ONLINE                      (is it only an offline problem?)
// For each: every /reminders/batch response, the sync-state transitions (hub.onSync), what the server holds (read by a
// second paired device as Mom), what the phone's queue and hub.list still hold, and — for A — the same after a reload.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const log = (...a) => console.log(...a);
const waitFor = async (fn, timeout = 15000) => { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Verify reader', profiles: ['mom'] });
  const serverCount = async tag => (await L.apiAs(null, '/api/data/reminders?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.mom }))
    .body.items.filter(i => i.value && typeof i.value.text === 'string' && i.value.text.startsWith(tag)).length;

  async function run(label, n, offline) {
    const tag = `V${label}-`;
    const ph = await L.newDevice({ name: 'Eli phone ' + label, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await phone.goto('#home');
    await waitFor(() => phone.page.evaluate(() => window.hub && hub.sync.lastPull > 0));
    await phone.page.evaluate(() => { window.__states = []; hub.onSync(s => window.__states.push(s.state + (s.lastError ? ':' + s.lastError : '') + ' p' + s.pending)); });
    const res = [];
    phone.page.on('response', async r => { if (/\/api\/data\/reminders\/batch/.test(r.url())) res.push({ status: r.status(), body: (await r.text().catch(() => '')).slice(0, 120) }); });
    if (offline) await phone.setOffline(true);
    await phone.page.evaluate(({ n, tag }) => {
      for (let i = 0; i < n; i++) { const id = tag + i; hub.set('item:' + id, { id, text: tag + 'reminder ' + i, by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); }
    }, { n, tag });
    const queuedBefore = Object.keys((await phone.hub()).queue['hub.queue.reminders.family'] || {}).length;
    if (offline) { await sleep(500); await phone.setOffline(false); }
    await waitFor(() => res.length, 15000);
    await sleep(1500);
    const stateRightAfter = (await phone.hub()).sync;
    await sleep(33000);                                   // let the 30 s pull run once
    const h = await phone.hub();
    const r = {
      n, offline, queuedBefore,
      batchResponses: res,
      syncTransitions: await phone.page.evaluate(() => window.__states.slice(-12)),
      syncRightAfterResponse: stateRightAfter,
      syncAfter33s: h.sync,
      queueLeft: Object.keys(h.queue['hub.queue.reminders.family'] || {}).length,
      onServer: await serverCount(tag),
      listedOnPhone: await phone.page.evaluate(tag => hub.list('item:', { app: 'reminders', scope: 'family' }).filter(x => x.value && String(x.value.text).startsWith(tag)).length, tag),
    };
    if (label === 'A') {
      await phone.page.reload({ waitUntil: 'load' });
      await waitFor(() => phone.page.evaluate(() => window.hub && hub.sync.lastPull > 0));
      await sleep(1500);
      r.listedOnPhoneAfterReload = await phone.page.evaluate(tag => hub.list('item:', { app: 'reminders', scope: 'family' }).filter(x => x.value && String(x.value.text).startsWith(tag)).length, tag);
      r.visibleInHomeDom = await phone.page.evaluate(tag => (document.body.innerText.match(new RegExp(tag + 'reminder', 'g')) || []).length, tag);
      r.syncAfterReload = (await phone.hub()).sync;
      await phone.page.screenshot({ path: path.join(EVID, 'v-batch200-A-phone-home-after-reload.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
      r.onServerAfterReload = await serverCount(tag);
    }
    await phone.close();
    log(`${label}: ${n} rows ${offline ? 'offline→online' : 'online, one tick'}; queued ${r.queuedBefore}; batch responses ${JSON.stringify(res.map(x => x.status + ' ' + x.body))}`);
    log(`   sync transitions ${JSON.stringify(r.syncTransitions)}; right after response ${r.syncRightAfterResponse.state}/${r.syncRightAfterResponse.lastError}; after 33 s ${r.syncAfter33s.state} pending ${r.syncAfter33s.pending}`);
    log(`   queue left ${r.queueLeft}; on server ${r.onServer}/${n}; listed on phone ${r.listedOnPhone}` + (label === 'A' ? `; after reload listed ${r.listedOnPhoneAfterReload}, in Home DOM ${r.visibleInHomeDom}, sync ${r.syncAfterReload.state}, on server ${r.onServerAfterReload}` : ''));
    return r;
  }

  out.A = await run('A', 201, true);
  out.B = await run('B', 200, true);
  out.C = await run('C', 201, false);
  fs.writeFileSync(path.join(EVID, 'verify-batch-over-200-dropped-1.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-batch-over-200-dropped-1.json');
} finally { await L.close(); }
