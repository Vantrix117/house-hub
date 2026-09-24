// SYNC skeptic #1 — "quota-errors-swallowed": when localStorage is full, hub.js's queue write fails silently
// (lsSet swallows the QuotaExceededError, apps/hub.js:33, used by saveStore/saveQueue :196-197, called from hub.set :238-239).
//   node "audits/tools/phase2/SYNC/verify-quota-errors-swallowed-1.mjs"   (≈2-3 min, WebKit, local instance only)
// Independent of e4c: storage is filled to the exact byte and then a controlled amount of room (SLACK chars) is freed,
// so each scenario is deterministic. Each scenario runs on a fresh paired phone (fresh localStorage), Eli signed in, F260 open.
//   A  slack 0,   offline, tick, reload offline, free storage, online   → is the tick kept on screen / on the server?
//   B  slack 300, offline, tick, reload offline, free storage, online   → the claimed divergence (cache fits, queue does not)
//      then B2: tick the next reading online with room → does the lost tick ride along (f260.done is one whole-map row)?
//   C  slack 0,   online,  tick (no reload)                             → does the in-memory queue still reach the server?
//   D  slack 300, offline, tick, NO reload, free storage, online        → is the in-memory queue retried?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const waitFor = async (fn, timeout = 10000) => { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };
const QKEY = 'hub.queue.f260.person.eli', CKEY = 'hub.cache.f260.person.eli';
const out = { scenarios: {} };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const serverDone = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.done'); return (r.body && r.body.item) || null; };
  let n = 0;
  async function freshPhone() {
    const ph = await L.newDevice({ name: 'Eli phone ' + (++n), profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await d.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0 && hub.sync.pending === 0), 20000);
    await sleep(1500);
    return { d, f };
  }
  // Fill this origin's localStorage to the last char, leaving exactly `slack` chars of value room (+ the probe key).
  const fill = (d, slack) => d.page.evaluate(slack => {
    const r = { error: null };
    if (slack) localStorage.setItem('audit.slack', 'x'.repeat(slack));
    let filled = 0, size = 262144, i = 0;
    while (size >= 1) { try { localStorage.setItem('audit.fill.' + i, 'x'.repeat(size)); i++; filled += size; } catch (e) { r.error = e.name; size = Math.floor(size / 2); } }
    localStorage.removeItem('audit.slack');
    let free = 0;
    for (let s = slack + 64; s >= 1; s--) { try { localStorage.setItem('audit.p', 'x'.repeat(s)); localStorage.removeItem('audit.p'); free = s; break; } catch {} }
    r.filledChars = filled; r.freeValueCharsForA7CharKey = free;
    r.totalChars = Object.keys(localStorage).reduce((a, k) => a + k.length + (localStorage.getItem(k) || '').length, 0);
    return r;
  }, slack);
  const unfill = d => d.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('audit.')) localStorage.removeItem(k); });
  const lsState = (d, id) => d.page.evaluate(([QKEY, CKEY, id]) => {
    let q = null, c = null; try { q = JSON.parse(localStorage.getItem(QKEY)); } catch {} try { c = JSON.parse(localStorage.getItem(CKEY)); } catch {}
    const done = c && c.items && c.items['f260.done'] && c.items['f260.done'].v;
    return { persistedQueueKeys: q ? Object.keys(q) : null, cacheHasTick: !!(done && done[id]), cacheDoneT: c && c.items && c.items['f260.done'] && c.items['f260.done'].t };
  }, [QKEY, CKEY, id]);
  const hubState = f => f.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending, lastError: hub.sync.lastError }));
  const frameAfterReload = async d => { const f = await waitFor(() => d.frame('f260'), 10000); await f.waitForSelector('#todayDone'); await sleep(1500); return f; };
  const tickShown = (f, id) => f.evaluate(id => { const el = document.querySelector('[data-day="' + id + '"]'); return !!(el && el.classList.contains('done')); }, id);
  const onScreenMessages = f => f.evaluate(() => [...document.querySelectorAll('#hub-toast, .toast, [role=status], [role=alert]')].filter(e => !e.hidden && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 120)));
  const errLogs = d => d.logs.filter(l => /pageerror|quota|error/i.test(l));
  const shot = async (d, name) => { const p = path.join(EVID, name); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, p).split(path.sep).join('/'); };

  async function scenario(name, { slack, offline, reload, heal = false }) {
    const r = {}; const { d, f } = await freshPhone();
    const id = await f.getAttribute('#todayDone', 'data-target'); r.target = id;
    const before = await serverDone(); r.serverHadTickBefore = !!(before && before.value && before.value[id]);
    r.doneMapJsonChars = before ? JSON.stringify(before.value).length : 0;
    r.fill = await fill(d, slack);
    if (offline) await d.setOffline(true);
    await f.click('#todayDone'); await sleep(900);
    r.afterTick = { hub: await hubState(f), ls: await lsState(d, id), tickShown: await tickShown(f, id), messages: await onScreenMessages(f), errorLogs: errLogs(d) };
    if (reload) {
      await d.page.reload({ waitUntil: 'load' }); await d.setOffline(true);
      const f2 = await frameAfterReload(d);
      r.afterOfflineReload = { hub: await hubState(f2), ls: await lsState(d, id), tickShown: await tickShown(f2, id) };
      if (name === 'B') r.shotOfflineReload = await shot(d, 'verify-quota-B-phone-after-offline-reload.png');
    }
    await unfill(d);
    if (offline) await d.setOffline(false);
    await sleep(6000);
    const f3 = d.frame('f260');
    const srv = await serverDone();
    r.afterOnline = { hub: await hubState(f3), ls: await lsState(d, id), tickShown: await tickShown(f3, id), serverHasTick: !!(srv && srv.value && srv.value[id]), serverDoneT: srv && srv.updated_at, errorLogs: errLogs(d) };
    if (name === 'B') r.shotOnline = await shot(d, 'verify-quota-B-phone-online-synced.png');
    if (heal) {   // B2: the next tick on this phone, with room, online
      const id2 = await f3.getAttribute('#todayDone', 'data-target'); r.heal = { target: id2 };
      await f3.click('#todayDone'); await sleep(4000);
      const s2 = await serverDone();
      r.heal.serverHasNewTick = !!(s2 && s2.value && s2.value[id2]); r.heal.serverNowHasLostTick = !!(s2 && s2.value && s2.value[id]);
    }
    await d.close();
    out.scenarios[name] = r;
    log(name, JSON.stringify(r));
    return r;
  }

  const A = await scenario('A', { slack: 0, offline: true, reload: true });
  const B = await scenario('B', { slack: 300, offline: true, reload: true, heal: true });
  const C = await scenario('C', { slack: 0, offline: false, reload: false });
  const D = await scenario('D', { slack: 300, offline: true, reload: false });

  log('SUMMARY');
  log(`A (exactly full, offline, reload): persisted queue ${JSON.stringify(A.afterTick.ls.persistedQueueKeys)}, cache has tick ${A.afterTick.ls.cacheHasTick}; after offline reload tick shown ${A.afterOfflineReload.tickShown}; online → server has it ${A.afterOnline.serverHasTick}; messages ${JSON.stringify(A.afterTick.messages)}`);
  log(`B (300 chars free, offline, reload): pending in memory ${B.afterTick.hub.pending}, persisted queue ${JSON.stringify(B.afterTick.ls.persistedQueueKeys)}, cache has tick ${B.afterTick.ls.cacheHasTick}, errors ${JSON.stringify(B.afterTick.errorLogs)}, messages ${JSON.stringify(B.afterTick.messages)}`);
  log(`B after offline reload: pending ${B.afterOfflineReload.hub.pending}, tick shown ${B.afterOfflineReload.tickShown}; after online: state ${B.afterOnline.hub.state}, pending ${B.afterOnline.hub.pending}, tick shown ${B.afterOnline.tickShown}, server has it ${B.afterOnline.serverHasTick}`);
  log(`B2 next tick online: server has new tick ${B.heal.serverHasNewTick}, server now also has the lost tick ${B.heal.serverNowHasLostTick}`);
  log(`C (exactly full, online, no reload): persisted queue ${JSON.stringify(C.afterTick.ls.persistedQueueKeys)}, server has it ${C.afterOnline.serverHasTick}`);
  log(`D (300 free, offline, no reload, freed, online): server has it ${D.afterOnline.serverHasTick}`);
  fs.writeFileSync(path.join(EVID, 'verify-quota-errors-swallowed-1.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-quota-errors-swallowed-1.json');
} finally { await L.close(); }
