// Round 2: screenshots of the new layout, and the scrolling switcher: is the chosen counter scrolled into view on open?
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots2'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const now = Date.now();
async function seed(pid, k) {
  const put = (key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
  const names = ['Laps around the garden', 'Glasses of water today', 'Pages read this evening', 'Push-ups before dinner', 'Words of kindness given', 'Birds seen at the feeder', 'Seventh from another iPad'];
  for (let i = 0; i < k; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
  for (let i = 0; i < 5; i++) await put('resetlog:' + (now - 5000 * (i + 1)), { cid: i % 2 && i < k ? 'k' + i : null, from: 1234 - i, at: now - 5000 * (i + 1) });
  await put('c:k' + (k - 1) + ':count:x', { n: 42, epoch: null });
}
try {
  await seed('ezra', 7);
  for (const [w, h, xxl] of [[375, 667, true], [820, 1180, false]]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' });
    await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(900);
    if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(600); }
    await f.evaluate(() => document.getElementById('cpick').click()); await sleep(600);
    await d.page.screenshot({ path: `${OUT}/sheet-ezra-${w}x${h}.png` });
    await d.close();
  }
} finally { await L.close(); }
