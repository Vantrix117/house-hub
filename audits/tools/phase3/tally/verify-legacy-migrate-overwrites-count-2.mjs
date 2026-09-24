// Skeptic #2 for "legacy-migrate-overwrites-count": does hub.migrate (tally.html:147) write a device's pre-hub
// 'tally.count' over the server's real count when the tally/person first pull has not landed?
// Arms (each on a fresh reset of the typical household; Eli's server count is 37; the new phone holds 'tally.count' = "5"):
//   hold9   GET /api/data/tally held 9 s (past hub.ready's 6 s race, hub.js:337)           -> expect overwrite if the claim holds
//   abort   GET /api/data/tally fails with a network error for the first 8 s              -> wider trigger?
//   hold4   GET held 4 s (under 6 s)                                                      -> expect safe
//   control no hold                                                                       -> expect safe (the design, cf. scripts/test-hub.mjs:186-192)
// hold9 also runs on Chromium to rule out a WebKit-on-Windows artefact, and then opens Tally on the rig's Kitchen iPad
// (Eli) to see whether the overwrite spreads. No taps anywhere.
// Run: node "audits/tools/phase3/tally/verify-legacy-migrate-overwrites-count-2.mjs"
//   -> audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-2.json (+ -ipad.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const res = {};
async function runEngine(engine, arms) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? { value: it.value, updated_at: it.updated_at } : null; };
  try {
    for (const arm of arms) {
      await L.reset('typical');
      const dev = await L.newDevice({ name: 'Verify phone ' + arm, profiles: ['eli'] });
      const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev, localStorage: { 'tally.count': '5' } });
      const t0 = Date.now(); let gets = 0;
      const hold = { hold9: 9000, hold4: 4000 }[arm];
      if (hold) await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets++; await sleep(hold); r.continue().catch(() => {}); });
      if (arm === 'abort') await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { gets++; if (Date.now() - t0 < 8000) r.abort('failed').catch(() => {}); else r.continue().catch(() => {}); });
      const before = await server();
      const f = await phone.openApp('tally');
      await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
      const readyAtMs = Date.now() - t0;
      const shownAtReady = await f.evaluate(() => document.getElementById('n').textContent);
      const queuedAtReady = await f.evaluate(() => { try { return Object.keys(localStorage).filter(k => k.startsWith('hub.queue')).map(k => [k, localStorage.getItem(k)]); } catch { return null; } });
      await sleep(13000);                       // held/failed pull has returned; well before the 30 s poll
      const after = await server();
      const shownEnd = await f.evaluate(() => document.getElementById('n').textContent);
      const migrated = await f.evaluate(() => { try { return JSON.parse(localStorage.getItem('hub.migrated') || '{}'); } catch { return null; } });
      const legacyKept = await f.evaluate(() => localStorage.getItem('tally.count'));
      const r = { engine, arm, serverBefore: before, readyAtMs, shownAtReady, queuedAtReady, getsIntercepted: gets, serverAfter: after, shownEnd, migratedMark: migrated, legacyKept, tapped: false };
      if (arm === 'hold9' && engine === 'webkit') {
        const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
        const fi = await ipad.openApp('tally');
        await fi.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
        await sleep(1500);
        r.kitchenIpadShows = await fi.evaluate(() => document.getElementById('n').textContent);
        await ipad.page.screenshot({ path: `${OUT}/verify-legacy-migrate-overwrites-count-2-ipad.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
        await ipad.close();
      }
      res[engine + ':' + arm] = r;
      console.log(JSON.stringify(r));
      await phone.close();
    }
  } finally { await L.close(); }
}
try {
  await runEngine('webkit', ['hold9', 'abort', 'hold4', 'control']);
  await runEngine('chromium', ['hold9']);
} finally {
  fs.writeFileSync(`${OUT}/verify-legacy-migrate-overwrites-count-2.json`, JSON.stringify(res, null, 1));
}
