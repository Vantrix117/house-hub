// First open of Tally on a device with no tally cache (a new/re-paired phone, first sign-in on the shared iPad,
// cleared storage). hub.ready() races the first pull against 6 s when no channel has a cache (hub.js:334-337) and
// resolves at once when the pull fails; Tally then shows 0 (tally.html:150) and + writes n()+1 = 1 over the server's
// real count (last write wins). The shell does not sync the tally channel (index.html:457-458), so the frame's own
// pull is the only one.
//   hold   GET /api/data/tally held 9 s, tap + once the name pill appears                 server 37 -> ?
//   fail   GET answered 503 for 8 s, tap + once the pill appears                          server 37 -> ?
//   control no hold, tap +                                                                  server 37 -> 38
//   migrate  legacy localStorage 'tally.count' = "5" on the device, GET held 9 s, no tap    server 37 -> ? (hub.migrate, tally.html:147)
// Run: node "audits/tools/phase3/tally/first-load.mjs"  -> audits/evidence/p3/tally/first-load.json (+ PNG at the tap)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
try {
  for (const mode of ['hold', 'fail', 'control', 'migrate']) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'New phone ' + mode, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev, localStorage: mode === 'migrate' ? { 'tally.count': '5' } : null });
    const t0 = Date.now(); let gets = 0;
    if (mode === 'hold' || mode === 'migrate') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets++; await sleep(9000); r.continue().catch(() => {}); });
    if (mode === 'fail') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets++; if (Date.now() - t0 < 8000) r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); else r.continue(); });
    const before = await server();
    const f = await phone.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 15000 });
    const readyAt = Date.now() - t0;
    const shownAtReady = await f.evaluate(() => document.getElementById('n').textContent);
    let tapAt = null;
    if (mode !== 'migrate') { await f.locator('#plus').click(); tapAt = Date.now() - t0; }
    if (mode === 'hold') await phone.page.screenshot({ path: `${OUT}/first-load-hold-at-tap.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(mode === 'control' ? 2000 : 12000);          // the held/failed pull has returned by now, and a 30 s poll has not
    const after = await server();
    const shownEnd = await f.evaluate(() => document.getElementById('n').textContent);
    res[mode] = { serverBefore: before, readyAtMs: readyAt, shownAtReady, tapAtMs: tapAt, getsIntercepted: gets, serverAfter: after, shownEnd, sync: (await phone.hub(f)).sync };
    console.log(mode, JSON.stringify(res[mode]));
    await phone.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/first-load.json`, JSON.stringify(res, null, 1));
  await L.close();
}
