// s1 skeptic check for UX-TALLY-2: how long Tally's buttons stay dead, and what a tap then does, in three cases:
//   A  first open on a device (no tally cache), network unthrottled  -> ms until #plus is wired
//   B  first open, the tally GET held 9 s                             -> tap at ~1.5 s: count, queue; ms until wired
//   C  second open on the same device (cache present), GET held 9 s   -> ms until wired, shows the cached count?
// Run: node audits/tools/phase5/ux-verify/UX-TALLY-2/s1-loading.mjs -> audits/evidence/p5/ux-verify/UX-TALLY-2/s1/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-TALLY-2/s1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const snap = f => f.evaluate(() => ({ count: document.getElementById('n').textContent, who: document.getElementById('who').textContent, wired: typeof document.getElementById('plus').onclick === 'function', disabled: document.getElementById('plus').disabled, busy: !!document.querySelector('[aria-busy="true"],.skeleton,[aria-disabled="true"]') }));
async function waitWired(f, t0, limit = 15000) { while (Date.now() - t0 < limit) { if ((await snap(f)).wired) return Date.now() - t0; await sleep(25); } return null; }
try {
  res.serverStart = await server();
  // A
  { const dev = await L.newDevice({ name: 'Fast phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const t0 = Date.now(); const f = await d.openApp('tally', { wait: '.dial' });
    const frameAt = Date.now() - t0; const wiredAt = await waitWired(f, t0);
    res.A_firstOpenFast = { frameAt, wiredAt, wiredAfterFrame: wiredAt - frameAt, atWired: await snap(f) };
    await d.close(); }
  // B + C on one device
  { const dev = await L.newDevice({ name: 'Slow phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    let hold = true;
    await d.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { if (hold) await sleep(9000); r.continue().catch(() => {}); });
    let t0 = Date.now(); let f = await d.openApp('tally', { wait: '.dial' });
    await sleep(Math.max(0, 1500 - (Date.now() - t0)));
    const at1500 = await snap(f);
    for (let i = 0; i < 3; i++) await f.locator('#plus').click();
    const afterTaps = { ...(await snap(f)), ms: Date.now() - t0, queue: (await d.hub(f)).queue };
    await d.page.screenshot({ path: `${OUT}/B-first-open-held-at-taps.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    const wiredAt = await waitWired(f, t0);
    const atWired = await snap(f);
    await sleep(Math.max(0, 10500 - (Date.now() - t0)));
    res.B_firstOpenHeld = { at1500, afterTaps, wiredAt, atWired, afterPull: { ...(await snap(f)), ms: Date.now() - t0 }, server: await server() };
    // C: reopen (cache now present), GET still held 9 s
    await d.page.goto(L.site + '/index.html#home'); await sleep(800);
    t0 = Date.now(); f = await d.openApp('tally', { wait: '.dial' });
    const frameAt = Date.now() - t0; const wiredC = await waitWired(f, t0);
    res.C_reopenCachedHeld = { frameAt, wiredAt: wiredC, atWired: await snap(f) };
    await d.close(); }
  console.log(JSON.stringify(res, null, 1));
} finally {
  fs.writeFileSync(`${OUT}/loading.json`, JSON.stringify(res, null, 1));
  await L.close();
}
