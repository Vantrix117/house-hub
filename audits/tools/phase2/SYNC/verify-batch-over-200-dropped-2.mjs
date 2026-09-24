// SYNC verify (skeptic #2) — finding "batch-over-200-dropped".
//   node "audits/tools/phase2/SYNC/verify-batch-over-200-dropped-2.mjs"
// Independent of e4b. Fresh local instance, real clock, WebKit, a separate paired phone (Eli) and a reader device (Mom).
//   A  control: 200 distinct family reminders written in one synchronous burst while ONLINE → all should land.
//   B  201 distinct reminders written in one burst while ONLINE (no offline at all — any bulk action).
//   C  201 reminders queued OFFLINE, then back online (the investigator's scenario).
//   D  a real UI path: Prayer → Import backup (a v2 single-list backup of 250 prayers) on the phone.
// For each: the /batch responses, the server's rows, the queue left, hub.sync over time, what the phone lists (also after a
// reload), and what a second device (the Kitchen iPad, Eli) lists after a pull.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, { timeout = 10000, every = 200 } = {}) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  return null;
}

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Verify reader', profiles: ['mom'] });
  const ph = await L.newDevice({ name: 'Verify Eli phone', profiles: ['eli'] });
  const asMom = p => L.apiAs(null, p, { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
  const asEliPhone = p => L.apiAs(null, p, { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  const serverCount = async (prefix, app = 'reminders', scope = 'family', as = asMom) => {
    const r = await as(`/api/data/${app}?scope=${scope}`);
    return r.body.items.filter(i => i.value != null && i.key.startsWith(prefix)).length;
  };

  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });   // second device, same person
  const batches = [];
  phone.page.on('response', async r => {
    if (/\/api\/data\/[^/?]+\/batch/.test(r.url())) {
      let n = null; try { n = JSON.parse(r.request().postData() || '{}').items.length; } catch {}
      batches.push({ t: Date.now(), url: r.url().replace(/^https?:\/\/[^/]+/, ''), status: r.status(), items: n, body: (await r.text().catch(() => '')).slice(0, 90) });
    }
  });
  await phone.goto('#home'); await ipad.goto('#home');
  await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });

  const burst = (prefix, n) => phone.page.evaluate(({ prefix, n }) => {
    for (let i = 0; i < n; i++) { const id = prefix + i; hub.set('item:' + id, { id, text: prefix + ' reminder ' + i, by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); }
    return hub.sync.pending;
  }, { prefix, n });
  const localCount = (d, prefix) => d.page.evaluate(p => hub.list('item:' + p, { app: 'reminders', scope: 'family' }).length, prefix);
  const queueLen = async () => Object.keys((await phone.hub()).queue['hub.queue.reminders.family'] || {}).length;
  const syncTrace = async ms => { const tr = []; const until = Date.now() + ms; let last = ''; while (Date.now() < until) { const s = await phone.page.evaluate(() => hub.sync.state + '/' + hub.sync.pending + '/' + hub.sync.lastError); if (s !== last) { tr.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + s); last = s; } await sleep(150); } return tr; };

  async function part(label, prefix, n, offline) {
    const o = { n, offline };
    o.serverBefore = await serverCount('item:' + prefix);
    const mark = batches.length;
    if (offline) await phone.setOffline(true);
    o.pendingAfterBurst = await burst(prefix, n);
    if (offline) { await sleep(500); o.queuedWhileOffline = await queueLen(); await phone.setOffline(false); }
    await waitFor(() => batches.length > mark, { timeout: 10000 });
    o.syncTrace = await syncTrace(4000);
    o.batches = batches.slice(mark).map(b => ({ status: b.status, items: b.items, body: b.body }));
    o.serverAfter = await serverCount('item:' + prefix);
    o.queueAfter = await queueLen();
    o.phoneLists = await localCount(phone, prefix);
    await phone.page.evaluate(() => hub.pull()); await phone.page.evaluate(() => hub.flush());
    o.syncAfterPullAndFlush = await phone.page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending, lastError: hub.sync.lastError }));
    o.batchesAfterRetry = batches.length - mark;
    await ipad.page.evaluate(() => hub.pull());
    o.ipadLists = await localCount(ipad, prefix);
    await phone.page.reload({ waitUntil: 'load' }); await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    o.phoneListsAfterReload = await localCount(phone, prefix);
    o.serverAfterReload = await serverCount('item:' + prefix);
    log(`${label}: ${n} rows ${offline ? 'queued offline' : 'in one online burst'} → batches ${JSON.stringify(o.batches)}; server ${o.serverBefore} → ${o.serverAfter} (after reload ${o.serverAfterReload}); queue left ${o.queueAfter}; phone lists ${o.phoneLists} (after reload ${o.phoneListsAfterReload}); iPad (Eli) lists ${o.ipadLists}; sync trace ${JSON.stringify(o.syncTrace)}; after pull+flush ${JSON.stringify(o.syncAfterPullAndFlush)}; batch requests in total ${o.batchesAfterRetry}`);
    return o;
  }

  out.A_online_200 = await part('A', 'vA', 200, false);
  out.B_online_201 = await part('B', 'vB', 201, false);
  out.C_offline_201 = await part('C', 'vC', 201, true);
  await phone.page.screenshot({ path: path.join(EVID, 'verify-batch-200-2-phone-home-after-C.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // ── D ── Prayer → More → Import backup, a v2 single-list backup of 250 prayers (person scope)
  {
    const o = {};
    const prayersOnServer = async () => (await asEliPhone('/api/data/prayer?scope=person')).body.items.filter(i => i.value != null && i.key.startsWith('prayer:')).length;
    o.serverBefore = await prayersOnServer();
    const f = await phone.openApp('prayer', { wait: '#f-import' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    o.localBefore = await f.evaluate(() => hub.list('prayer:', { scope: 'person' }).length);
    const backup = { prayers: Array.from({ length: 250 }, (_, i) => ({ id: 'imp' + String(i).padStart(3, '0'), title: 'Imported request ' + i, category: 'Family', cadence: 'daily', createdAt: '2025-01-01' })) };
    const mark = batches.length;
    await f.evaluate(txt => {
      document.getElementById('f-import').click();
      const inp = document.getElementById('askIn'); inp.value = txt; inp.dispatchEvent(new Event('input'));
      document.getElementById('askSave').click();
    }, JSON.stringify(backup));
    await waitFor(() => batches.slice(mark).some(b => /\/prayer\/batch\?scope=person/.test(b.url)), { timeout: 10000 }); await sleep(2500);
    o.batches = batches.slice(mark).map(b => ({ url: b.url.replace(/\?.*/, '') + '?' + (b.url.split('?')[1] || ''), status: b.status, items: b.items, body: b.body }));
    o.localAfter = await f.evaluate(() => hub.list('prayer:', { scope: 'person' }).length);
    o.shownRows = await f.evaluate(() => document.body.innerText.match(/Imported request/g)?.length || 0);
    o.serverAfter = await prayersOnServer();
    o.queueAfter = Object.keys((await phone.hub()).queue['hub.queue.prayer.person'] || {}).length;
    o.sync = await f.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending, lastError: hub.sync.lastError }));
    await phone.page.screenshot({ path: path.join(EVID, 'verify-batch-200-2-phone-prayer-after-import.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    log(`D: Prayer import of 250 prayers → batches ${JSON.stringify(o.batches)}; server person prayers ${o.serverBefore} → ${o.serverAfter}; phone hub.list ${o.localBefore} → ${o.localAfter}; "Imported request" texts on screen ${o.shownRows}; queue left ${o.queueAfter}; sync ${JSON.stringify(o.sync)}`);
    out.D_prayer_import_250 = o;
  }
  fs.writeFileSync(path.join(EVID, 'verify-batch-over-200-dropped-2.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-batch-over-200-dropped-2.json');
} finally { await L.close(); }
