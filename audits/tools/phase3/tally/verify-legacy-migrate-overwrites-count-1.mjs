// Skeptic #1 for "legacy-migrate-overwrites-count": does hub.migrate (tally.html:147) write the pre-hub 'tally.count'
// over the server's real count when the frame's first tally pull has not landed by the time hub.ready resolves?
// Fresh local instance, a new paired phone signed in as Eli, legacy 'tally.count' = "5" in its localStorage, server
// count 37 (typical seed). No taps in any arm.
//   control  no interference                              expect: shows 37, server stays 37
//   hold5    first GET /api/data/tally held 5 s (< 6 s race)  expect: safe
//   hold9    first GET held 9 s (> 6 s race)               claim: server 37 -> 5
//   fail     GET answered 503 for the first 8 s            (wider trigger?)
// Run: node "audits/tools/phase3/tally/verify-legacy-migrate-overwrites-count-1.mjs"
//   -> audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const arms = process.argv.slice(2).length ? process.argv.slice(2) : ['control', 'hold5', 'hold9', 'fail'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => {
  const r = await L.apiAs('eli', '/api/data/tally?scope=person');
  const it = (r.body.items || []).find(i => i.key === 'count');
  return it ? { value: it.value, updated_at: it.updated_at } : null;
};
try {
  for (const arm of arms) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'Verify phone ' + arm, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev, localStorage: { 'tally.count': '5' } });
    const t0 = Date.now(); const gets = [];
    const hold = { hold5: 5000, hold9: 9000 }[arm];
    if (hold) await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets.push(Date.now() - t0); if (gets.length === 1) await sleep(hold); r.continue().catch(() => {}); });
    if (arm === 'fail') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets.push(Date.now() - t0); if (Date.now() - t0 < 8000) r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); else r.continue(); });
    const before = await server();
    const f = await phone.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
    const readyAtMs = Date.now() - t0;
    const shownAtReady = await f.evaluate(() => document.getElementById('n').textContent);
    await sleep(13000);                       // past the held/failed pull; before the 30 s poll
    const after = await server();
    const st = await f.evaluate(() => ({
      shown: document.getElementById('n').textContent,
      migrated: JSON.parse(localStorage.getItem('hub.migrated') || '{}'),
      legacyLeft: localStorage.getItem('tally.count'),
      sync: { ...hub.sync },
    }));
    res[arm] = { serverBefore: before, readyAtMs, shownAtReady, tallyGetsAtMs: gets, serverAfter: after, ...st };
    console.log(arm, JSON.stringify(res[arm]));
    if (arm === 'hold9') await phone.page.screenshot({ path: `${OUT}/verify-legacy-migrate-overwrites-count-1-hold9.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await phone.close();
  }
  // Does another of Eli's devices (the rig's Kitchen iPad, fresh context) adopt the migrated value?
  if (res.hold9) {
    await L.reset('typical');
    // re-run hold9 quickly on a new phone, then open Tally on the iPad
    const dev = await L.newDevice({ name: 'Verify phone 2', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev, localStorage: { 'tally.count': '5' } });
    await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { await sleep(9000); r.continue().catch(() => {}); });
    const f = await phone.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
    await sleep(12000);
    await phone.close();
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('tally');
    await fi.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
    await sleep(1500);
    res.ipadAfter = { shown: await fi.evaluate(() => document.getElementById('n').textContent), server: await server() };
    console.log('ipadAfter', JSON.stringify(res.ipadAfter));
    await ipad.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/verify-legacy-migrate-overwrites-count-1.json`, JSON.stringify(res, null, 1));
  await L.close();
}
