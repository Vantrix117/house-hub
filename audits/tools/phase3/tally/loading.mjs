// What a household member sees and can do while Tally's first pull is slow (no tally cache on the device):
// taps on + at 1.5 s (before hub.ready resolves, tally.html:145) — do they do anything, are they queued?
// Then the display once ready (6 s timeout, hub.js:337) and once the held pull lands.
// Run: node "audits/tools/phase3/tally/loading.mjs"  -> audits/evidence/p3/tally/loading.json (+ PNG at 1.5 s)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
try {
  const dev = await L.newDevice({ name: 'New phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
  await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { await sleep(9000); r.continue().catch(() => {}); });
  const t0 = Date.now();
  const f = await phone.openApp('tally', { wait: '.dial' });
  await sleep(Math.max(0, 1500 - (Date.now() - t0)));
  const snap = () => f.evaluate(() => ({ count: document.getElementById('n').textContent, who: document.getElementById('who').textContent, plusWired: typeof document.getElementById('plus').onclick === 'function', busy: document.querySelector('[aria-busy="true"],.skeleton') ? true : false }));
  res.at1500 = await snap();
  for (let i = 0; i < 3; i++) await f.locator('#plus').click();
  res.afterThreeTaps = { ...(await snap()), ms: Date.now() - t0, queue: (await phone.hub(f)).queue };
  await phone.page.screenshot({ path: `${OUT}/loading-at-1500ms-iphone.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 12000 });
  res.atReady = { ...(await snap()), ms: Date.now() - t0 };
  await sleep(Math.max(0, 10500 - (Date.now() - t0)));
  res.afterPullLanded = { ...(await snap()), ms: Date.now() - t0, server: await server() };
  console.log(JSON.stringify(res, null, 1));
} finally {
  fs.writeFileSync(`${OUT}/loading.json`, JSON.stringify(res, null, 1));
  await L.close();
}
