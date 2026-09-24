// Skeptic #1 for "first-load-tap-overwrites-count": a tap during a slow/failed first Tally load replaces the saved count.
// Independent re-run with different triggers than the investigator's script:
//   abort   : GET /api/data/tally?... aborted (network error, no status) for the first 8 s; tap MINUS once the name shows
//   hold    : GET held 8 s; tap PLUS once the name shows (ready after the 6 s race)
//   control : no interference; tap PLUS
// Then a SECOND, already-warm device (the rig's Kitchen iPad, Eli) opens Tally to see what it adopts.
// Run: node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-1.mjs"
//   -> audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-1.json (+ one PNG at the abort tap)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const NAME = 'verify-first-load-tap-overwrites-count-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? { value: it.value, updated_at: it.updated_at } : null; };
try {
  for (const mode of ['abort', 'hold', 'control']) {
    await L.reset('typical');
    const dev = await L.newDevice({ name: 'Verify phone ' + mode, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const t0 = Date.now(); const log = [];
    await phone.ctx.route(u => u.href.includes('/api/data/tally'), async r => {
      const req = r.request(); const at = Date.now() - t0; log.push({ at, method: req.method(), url: req.url().replace(/^.*\/api/, '/api') });
      if (req.method() === 'GET' && mode === 'abort' && at < 8000) return r.abort('failed');
      if (req.method() === 'GET' && mode === 'hold') await sleep(8000);
      r.continue().catch(() => {});
    });
    let cacheBefore = null;
    const before = await server();
    const f = await phone.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 15000 });
    const readyAt = Date.now() - t0;
    const shown = await f.evaluate(() => document.getElementById('n').textContent);
    cacheBefore = await f.evaluate(() => Object.keys(localStorage).filter(k => k.includes('tally')).map(k => k + '=' + localStorage.getItem(k).slice(0, 120)));
    const btn = mode === 'abort' ? '#minus' : '#plus';
    await f.locator(btn).click(); const tapAt = Date.now() - t0;
    const shownAfterTap = await f.evaluate(() => document.getElementById('n').textContent);
    if (mode === 'abort') await phone.page.screenshot({ path: `${OUT}/${NAME}-abort-after-tap.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(mode === 'control' ? 2500 : 11000);
    const after = await server();
    const shownEnd = await f.evaluate(() => document.getElementById('n').textContent);
    await phone.close();
    // a second device (the rig's Kitchen iPad, Eli, warm session) opens Tally afterwards
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const g = await ipad.openApp('tally');
    await g.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 15000 });
    await sleep(1500);
    const ipadShows = await g.evaluate(() => document.getElementById('n').textContent);
    await ipad.close();
    res[mode] = { tallyStorageAtReady: cacheBefore, serverBefore: before, readyAtMs: readyAt, shownAtReady: shown, tapped: btn, tapAtMs: tapAt, shownAfterTap, serverAfter: after, shownEnd, secondDeviceShows: ipadShows, requests: log };
    console.log(mode, JSON.stringify({ ...res[mode], requests: log.map(x => `${x.at} ${x.method} ${x.url}`) }));
  }
} finally {
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 1));
  await L.close();
}
