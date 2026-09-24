// Skeptic #1 for SYNC finding "migrate-race-overwrites-history" — independent rerun with control arms.
// Claim: hub.migrate() checks only the local cache (apps/hub.js:406-407), so when F260's first pull outlasts hub.ready's
// 6 s cap (apps/hub.js:337), the legacy standalone f260.* localStorage is written over Eli's real server rows.
//   node "audits/tools/phase2/SYNC/verify-migrate-race-overwrites-history-1.mjs"
// Arms (each on a freshly reset DB and a brand-new paired phone holding the same legacy f260.* keys):
//   A  no delay                        → expect server untouched (the first pull lands before migrate runs)
//   B  f260 GETs held 5 s  (< 6 s cap) → expect server untouched
//   C  f260 GETs held 8 s  (> 6 s cap) → the claim: server overwritten
//   D  every /api/data GET held 7 s    → a uniformly slow network, not a selective one
//   E  f260 GETs fail with a network error for the first 1.5 s, then work  → a failed (not slow) first pull
//   F  f260 GETs answer 503 for the first 1.5 s, then work                 → a Worker hiccup on the first pull
//   G  no delay, but a family Kid Verse cache already on the device → hub.ready does not wait at all
//   Pick arms with argv, e.g.  node … E F   (default: all)
// Also: "Forget this device" on arm A's phone (what it leaves behind), and the Kitchen iPad (Eli) after arm D.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { ROOT } from './_util.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);

const legacyDone = {}; for (let w = 1; w <= 3; w++) for (let d = 0; d < 5; d++) legacyDone[w + '-' + d] = true;
const LEGACY = { 'f260.done': legacyDone, 'f260.week': 4, 'f260.log': { '2026-01-20': true, '2026-01-21': true }, 'f260.mem': { '1-0': true } };

const row = async (L, key) => { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
async function serverState(L) {
  const [d, w, m, g] = await Promise.all(['f260.done', 'f260.week', 'f260.mem', 'f260.log'].map(k => row(L, k)));
  return { done: Object.keys(d.value || {}).length, week: w.value, mem: Object.keys(m.value || {}).length, logDays: Object.keys(g.value || {}).length, doneUpdatedAt: d.updated_at };
}
const shot = (page, name) => page.screenshot({ path: path.join(EVID, name), scale: 'css', animations: 'disabled', caret: 'hide' });

const out = { arms: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const arm of [
    { id: 'A-no-delay', match: null, hold: 0 },
    { id: 'B-f260-5s', match: /\/api\/data\/f260\?/, hold: 5000 },
    { id: 'C-f260-8s', match: /\/api\/data\/f260\?/, hold: 8000 },
    { id: 'D-all-data-7s', match: /\/api\/data\/[a-z0-9-]+\?/, hold: 7000 },
    { id: 'E-f260-neterr-1.5s', match: /\/api\/data\/f260\?/, hold: 1500, fail: 'abort' },
    { id: 'F-f260-503-1.5s', match: /\/api\/data\/f260\?/, hold: 1500, fail: 503 },
    // G: no delay at all, but this device already holds the family Kid Verse cache (a kid used Kid Verse here), so F260's
    //    hub.ready sees a pulled channel and skips its wait (apps/hub.js:334-337); opened straight on #f260
    { id: 'G-fast-kidverse-cached', match: null, hold: 0, extraLs: { 'hub.cache.kidverse.family': { items: {}, since: Date.now() - 60000 } } },
  ].filter(a => process.argv.length <= 2 || process.argv.slice(2).includes(a.id[0]))) {
    await L.reset('typical');
    const before = await serverState(L);
    const ph = await L.newDevice({ name: 'Eli old phone ' + arm.id, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph, localStorage: { ...LEGACY, ...(arm.extraLs || {}) } });
    const net = []; let T = Date.now();
    phone.page.on('request', r => { const u = r.url(); if (/\/api\/data\/f260/.test(u)) net.push({ t: Date.now() - T, dir: 'req', m: r.method() }); });
    phone.page.on('response', r => { const u = r.url(); if (/\/api\/data\/f260/.test(u)) net.push({ t: Date.now() - T, dir: 'res', m: r.request().method(), s: r.status() }); });
    let holding = !!arm.match;
    if (arm.match) await phone.ctx.route(arm.match, async route => {
      if (route.request().method() === 'GET' && holding) {
        if (arm.fail === 'abort') return route.abort('internetdisconnected').catch(() => {});
        if (arm.fail) return route.fulfill({ status: arm.fail, contentType: 'application/json', body: '{"error":"unavailable"}' }).catch(() => {});
        await sleep(arm.hold);
      }
      route.continue().catch(() => {});
    });
    T = Date.now();
    const f = await phone.openApp('f260');
    if (arm.fail) { await sleep(Math.max(0, arm.hold - (Date.now() - T))); holding = false; await sleep(12000); }
    else { await sleep(arm.hold + 1500); holding = false; await sleep(12000); }
    const after = await serverState(L);
    const res = {
      before, after,
      overwritten: after.done !== before.done || after.week !== before.week,
      migratedMark: await phone.page.evaluate(() => localStorage.getItem('hub.migrated')),
      phoneUi: { today: await f.textContent('#todayTitle').catch(() => null), count: await f.textContent('#doneCount').catch(() => null) },
      f260Traffic: net.slice(0, 14),
    };
    out.arms[arm.id] = res;
    log(arm.id, '| server before', JSON.stringify({ done: before.done, week: before.week, mem: before.mem, logDays: before.logDays }),
      '→ after', JSON.stringify({ done: after.done, week: after.week, mem: after.mem, logDays: after.logDays }),
      '| overwritten =', res.overwritten, '| phone UI', JSON.stringify(res.phoneUi), '| hub.migrated', res.migratedMark);
    log('   f260 traffic (ms from open):', net.map(n => `${n.dir}${n.dir === 'res' ? n.s : ''} ${n.m} @${(n.t / 1000).toFixed(1)}s`).join(', '));
    if (arm.id === 'C-f260-8s') await shot(phone.page, 'verify-migrate-race-phone-C.png');
    if (arm.id === 'A-no-delay') {
      // "Forget this device" on this phone (its migration already ran, harmlessly): what survives in localStorage?
      const p = phone.page;
      const keysBefore = await p.evaluate(() => Object.keys(localStorage).sort());
      p.on('dialog', d => d.accept().catch(() => {}));
      await phone.goto('#me'); await sleep(2000);
      const btn = await p.$('#forget');
      if (btn) { await btn.click(); await sleep(2500); }
      const keysAfter = await p.evaluate(() => Object.keys(localStorage).sort());
      out.forget = { clicked: !!btn, keysBefore, keysAfter, legacyLeft: keysAfter.filter(k => k.startsWith('f260.')), migratedLeft: keysAfter.includes('hub.migrated') };
      log('   Forget this device clicked =', !!btn, '| hub.migrated before:', keysBefore.includes('hub.migrated'),
        '| after: f260.* left', JSON.stringify(out.forget.legacyLeft), '| hub.migrated left', out.forget.migratedLeft, '| hub.* left', JSON.stringify(keysAfter.filter(k => k.startsWith('hub.'))));
    }
    if (arm.id === 'D-all-data-7s') {
      // Another of Eli's devices (the rig's Kitchen iPad, own cache, normal network) after the overwrite
      const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      const fi = await ipad.openApp('f260'); await sleep(4000);
      out.ipadAfterD = { today: await fi.textContent('#todayTitle').catch(() => null), count: await fi.textContent('#doneCount').catch(() => null) };
      log('   Kitchen iPad (Eli) F260 after arm D:', JSON.stringify(out.ipadAfterD));
      await shot(ipad.page, 'verify-migrate-race-ipad-after.png');
      await ipad.close();
    }
    await phone.close();
  }
  const evName = 'verify-migrate-race-overwrites-history-1' + (process.argv.length > 2 ? '-' + process.argv.slice(2).join('') : '') + '.json';
  fs.writeFileSync(path.join(EVID, evName), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/' + evName);
} finally { await L.close(); }
