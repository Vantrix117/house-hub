import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots10'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const put = (k, v) => L.apiAs('ezra', `/api/data/tally/${encodeURIComponent(k)}?scope=person`, { method: 'PUT', body: { value: v, updated_at: Date.now() } });
  await put('counter:k1', { name: 'Glasses of water today', at: Date.now() });
  for (const [w, h, xxl] of [[375, 667, true], [390, 844, false]]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, localStorage: { 'hub.tally.sel.ezra': 'k1' } });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await sleep(1200);
    if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(1200); }
    console.log(w, h, JSON.stringify(await f.evaluate(() => ({ seg: !document.getElementById('seg').hidden, pick: !document.getElementById('cpick').hidden }))));
    await d.page.screenshot({ path: `${OUT}/chip-${w}x${h}${xxl ? '-xxl' : ''}.png` });
    await d.close();
  }
} finally { await L.close(); }
