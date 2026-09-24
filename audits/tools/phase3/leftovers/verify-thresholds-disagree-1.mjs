// Skeptic #1 for "thresholds-disagree": one typical fridge, read through the Larder, Home card, Apps badge and the 8 am push job.
// Independent of thresholds.mjs: own selectors, reads the Larder's group headings, and asks the Worker for the push result.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom' });
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => {
    const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent));
    return c ? { big: c.querySelector('.gbig').textContent.trim(), bars: [...c.querySelectorAll('.fresh > div')].map(r => r.textContent.replace(/\s+/g, ' ').trim() + (r.classList.contains('stale') ? ' [stale]' : '')) } : null;
  });
  await d.page.screenshot({ path: path.join(EV, 'verify-thresholds-disagree-1-home-iphone.png'), scale: 'css' });
  await d.goto('#apps'); await sleep(1500);
  const badge = await d.page.evaluate(() => { const b = document.querySelector('.tile[data-id="leftovers"] .badge'); return b ? { text: b.textContent, aria: b.getAttribute('aria-label') } : null; });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 15000 });
  await sleep(800);
  const larder = await f.evaluate(() => ({
    banner: document.getElementById('alert').textContent.trim(),
    groups: [...document.querySelectorAll('.group')].map(g => ({ heading: (g.querySelector('h2,h3,.gh,header') || g).textContent.replace(/\s+/g, ' ').trim().slice(0, 60), items: [...g.querySelectorAll('.item')].map(i => i.querySelector('.nm').textContent + ' ' + i.dataset.days + 'd → ' + i.querySelector('.status').textContent) })),
  }));
  await d.page.screenshot({ path: path.join(EV, 'verify-thresholds-disagree-1-larder-iphone.png'), scale: 'css' });
  const m = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const out = { profile: 'mom', device: 'iphone-pwa', home, appsBadge: badge, larder, push: m };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, 'verify-thresholds-disagree-1.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
