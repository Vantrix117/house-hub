import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots6'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const [pid, w, h, far, xxl] of [['eli', 1180, 820, true, false], ['ezra', 1180, 820, true, false], ['ezra', 375, 667, false, true]]) {
    if (xxl) { const put = (k, v) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(k)}?scope=person`, { method: 'PUT', body: { value: v, updated_at: Date.now() } }); for (let i = 0; i < 6; i++) await put('counter:k' + i, { name: 'Counter number ' + i, at: Date.now() - 1000 + i }); }
    const d = await L.device({ device: 'ipad-portrait', profile: pid, fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await sleep(1200);
    if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(900); }
    if (far) { await f.evaluate(() => __tally.far(true)); await sleep(1200); }
    console.log(pid, w, h, JSON.stringify(await f.evaluate(() => ({ dial: Math.round(document.querySelector('.dial').getBoundingClientRect().width), reset: Math.round(document.getElementById('reset').getBoundingClientRect().bottom), ih: innerHeight, compact: document.getElementById('main').classList.contains('compact') }))));
    await d.page.screenshot({ path: `${OUT}/${pid}-${w}x${h}${far ? '-room' : ''}${xxl ? '-xxl' : ''}.png` });
    await d.close();
  }
} finally { await L.close(); }
