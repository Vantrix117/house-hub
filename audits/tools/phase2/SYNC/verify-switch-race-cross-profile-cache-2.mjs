// SYNC skeptic #2 — "a pull in flight during Switch saves the previous person's rows into the next person's cache".
//   node "audits/tools/phase2/SYNC/verify-switch-race-cross-profile-cache-2.mjs"
// Independent re-run (does not reuse e6). Two parts, each on a fresh local instance:
//  A. STRAGGLER: one person-scope GET issued with Eli's token (the iPad waking) is answered by the server at once but the
//     response reaches the iPad 4 s later; meanwhile Me → Switch → Ezra (kid, opens on tap). Measures what lands in Ezra's
//     cache, whether his `since` jumps past a row of his own written from another device, and whether a later pull recovers it.
//  B. CONTROL: the same flow with UNIFORM latency (every API call on the iPad 400 ms out + 400 ms back, no straggler),
//     Switch tapped at several offsets after the wake-up pull starts. Any key in a hub.cache.*.person.ezra that Ezra's
//     server scope does not hold is counted as contamination.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence, setHidden } from './_util.mjs';

const TIMER = { app: 'timer', scope: 'person' };
const readCache = (page, key) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, key);

async function switchToEzra(ipad) {
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 15000 });
  await ipad.page.click('.pcard[data-id="ezra"]');
  return waitFor(() => ipad.page.evaluate(() => !!(hub.profile && hub.profile.id === 'ezra')), { timeout: 15000, every: 50 });
}

// Keys Ezra's person caches on this iPad hold that his server scope does not — i.e. someone else's rows.
async function contamination(L, ipad, reader) {
  const caches = await ipad.page.evaluate(() => Object.keys(localStorage).filter(k => /^hub\.cache\.[^.]+\.person\.ezra$/.test(k))
    .map(k => { const c = JSON.parse(localStorage.getItem(k)); return { k, app: k.split('.')[2], keys: Object.entries(c.items).filter(([, v]) => v.v != null).map(([key]) => key) }; }));
  const out = {};
  for (const c of caches) {
    const srv = (await L.apiAs(null, `/api/data/${c.app}?scope=person`, { deviceToken: reader.device.token, profileToken: reader.sessions.ezra })).body.items.filter(i => i.value != null).map(i => i.key);
    const foreign = c.keys.filter(k => !srv.includes(k));
    if (foreign.length) out[c.app] = foreign;
  }
  return out;
}

async function partA() {
  const r = {};
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const kit = await L.newDevice({ name: 'Kitchen iPad A', profiles: ['eli'] });
    const reader = await L.newDevice({ name: 'Ezra other device', profiles: ['ezra'] });
    const S0 = Date.now() - 120000;                 // Ezra used this iPad two minutes ago: his timer cache is current to S0
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: kit,
      localStorage: { 'hub.cache.timer.person.ezra': { items: {}, since: S0 } } });
    for (const d of [phone, ipad]) { await d.goto('#home'); await waitFor(() => d.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); }
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
    await setHidden(ipad.page, true);
    // Eli starts a 10-minute timer on his phone
    await phone.page.evaluate(() => { const now = Date.now(); hub.set('timer.active', { endAt: now + 600000, total: 600, startedAt: now }, { app: 'timer', scope: 'person' }); });
    await sleep(1500);
    r.eliServerTimer = (await L.apiAs(null, '/api/data/timer?scope=person', { deviceToken: ph.device.token, profileToken: ph.sessions.eli })).body.items.map(i => i.key);
    // Ezra's own row, written from his other device (synced_at after S0)
    const put = await L.apiAs(null, '/api/data/timer/audit.probe?scope=person', { method: 'PUT', deviceToken: reader.device.token, profileToken: reader.sessions.ezra, body: { value: { from: 'Ezra, other device' }, updated_at: Date.now() } });
    r.ezraProbePut = put.status;
    await sleep(300);
    const T = {};
    let slow = true;
    await ipad.ctx.route(u => u.href.startsWith(L.api + '/api/data/timer?'), async route => {
      if (!(slow && route.request().method() === 'GET')) return route.continue().catch(() => {});
      slow = false;
      T.requestHeaders = { profileToken: route.request().headers()['x-profile-token'] === kit.sessions.eli ? 'eli' : 'other' };
      T.fetched = Date.now();
      const res = await route.fetch();
      T.serverNow = (await res.json()).now;
      await sleep(4000);
      T.delivered = Date.now();
      return route.fulfill({ response: res }).catch(() => {});
    });
    await setHidden(ipad.page, false);                    // wake → visibilitychange → hub.pull()
    await sleep(300);
    const signedIn = await switchToEzra(ipad);
    T.ezraSignedIn = Date.now();
    await waitFor(() => T.delivered, { timeout: 10000, every: 50 });
    await sleep(1500);
    r.order = { ezraSignedInBeforeDelivery: !!signedIn && T.ezraSignedIn < T.delivered, msEzraBeforeDelivery: T.delivered - T.ezraSignedIn, requestWith: T.requestHeaders.profileToken };
    const c1 = await readCache(ipad.page, 'hub.cache.timer.person.ezra');
    r.afterRace = { profile: await ipad.page.evaluate(() => hub.profile && hub.profile.id), ezraTimerKeys: Object.keys(c1.items), timerActiveInEzraCache: c1.items['timer.active'] ? c1.items['timer.active'].v : null,
      since: c1.since, S0, eliResponseNow: T.serverNow, sinceEqualsEliResponseNow: c1.since === T.serverNow, probeInCache: !!c1.items['audit.probe'] };
    // another pull as Ezra: does his own row come back?
    await ipad.page.evaluate(() => hub.pull());
    const c2 = await readCache(ipad.page, 'hub.cache.timer.person.ezra');
    r.afterNextPull = { ezraTimerKeys: Object.keys(c2.items), probeInCache: !!c2.items['audit.probe'], since: c2.since };
    r.ezraServerTimerRows = (await L.apiAs(null, '/api/data/timer?scope=person', { deviceToken: reader.device.token, profileToken: reader.sessions.ezra })).body.items.map(i => i.key);
    r.contamination = await contamination(L, ipad, reader);
    await ipad.page.click('.tab[data-tab="home"]'); await sleep(800);
    r.pill = await ipad.page.evaluate(() => ({ visible: !document.getElementById('timer-pill').hidden, time: document.getElementById('timer-pill-time').textContent, who: hub.profile.id }));
    r.shot = await shot(ipad.page, 'verify-switch-race-2-A-ipad-ezra-home.png');
    log('[A straggler]', JSON.stringify(r));
  } finally { await L.close(); }
  return r;
}

async function partB() {
  const trials = [];
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const reader = await L.newDevice({ name: 'Ezra other device', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await phone.goto('#home'); await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    await phone.page.evaluate(() => { const now = Date.now(); hub.set('timer.active', { endAt: now + 600000, total: 600, startedAt: now }, { app: 'timer', scope: 'person' }); });
    await sleep(1500);
    for (const offset of [100, 400, 900, 1600, 2500]) {
      const kit = await L.newDevice({ name: 'Kitchen iPad B' + offset, profiles: ['eli'] });
      const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: kit });
      await ipad.goto('#home'); await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
      await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
      await setHidden(ipad.page, true);
      const reqs = [];
      await ipad.ctx.route(u => u.href.startsWith(L.api + '/'), async route => {
        const rq = route.request(); const row = { t: Date.now(), m: rq.method(), u: rq.url().slice(L.api.length, L.api.length + 48) }; reqs.push(row);
        await sleep(400);
        let res; try { res = await route.fetch(); } catch { return route.abort().catch(() => {}); }
        await sleep(400);
        return route.fulfill({ response: res }).catch(() => {});
      });
      const t0 = Date.now();
      await setHidden(ipad.page, false);
      await sleep(offset);
      const ok = await switchToEzra(ipad);
      await sleep(9000);                              // let the in-flight pull finish
      const c = await contamination(L, ipad, reader);
      const st = await ipad.page.evaluate(() => ({ profile: hub.profile && hub.profile.id, picker: !document.getElementById('gate').hidden }));
      const t = { offsetMs: offset, ezraSignedIn: !!ok, stateAfter: st, contamination: c, requests: reqs.map(x => `${x.t - t0}ms ${x.m} ${x.u}`) };
      trials.push(t);
      log(`[B uniform 800 ms RTT, Switch ${offset} ms after wake] signed in as Ezra ${!!ok}; after: ${JSON.stringify(st)}; foreign keys in Ezra's caches: ${JSON.stringify(c)}`);
      await ipad.close();
    }
  } finally { await L.close(); }
  return trials;
}

const out = { A: await partA(), B: await partB() };
log('evidence', writeEvidence('verify-switch-race-cross-profile-cache-2.json', out));
