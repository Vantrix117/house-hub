// Skeptic #1 for "percent-rounds-to-100": does the progress line read "100% complete" at 259/260 and "0% complete" at 1/260?
// Independent of logic.mjs: seeds eli's f260.done on the local rig only, opens F260 in the hub viewer, reads #pct/#doneCount/#todayTitle.
//   node "audits/tools/phase3/f260/verify-percent-rounds-to-100-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = n => path.join(EVID, 'verify-percent-rounds-to-100-1' + n);

async function put(L, key, value) {
  const g = await L.apiAs('eli', `/api/data/f260?scope=person&key=__none__`);
  const r = await L.apiAs('eli', `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } });
  if (r.status && r.status >= 400) throw new Error('PUT ' + key + ' ' + r.status + ' ' + JSON.stringify(r.body));
}
const read = f => f.evaluate(() => {
  const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  const pct = document.getElementById('pct'); const r = pct.getBoundingClientRect();
  return { pct: t('#pct'), doneCount: t('#doneCount'), todayTitle: t('#todayTitle'), todayDoneHidden: document.getElementById('todayDone').hidden,
    meterWidth: document.getElementById('meterFill').style.width, pctVisible: r.width > 0 && r.height > 0 };
});

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const cases = { 259: w => !(w.w === 52 && w.d === 4), 1: w => w.w === 1 && w.d === 0, 2: w => w.w === 1 && w.d <= 1, 258: w => !(w.w === 52 && w.d >= 3) };
  for (const [n, keep] of Object.entries(cases)) {
    await L.reset('typical');
    const done = {}; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) if (keep({ w, d })) done[w + '-' + d] = true;
    await put(L, 'f260.done', done);
    await put(L, 'f260.week', +n >= 258 ? 52 : 1);
    const dev = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    const f = await dev.openApp('f260');
    await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 });
    await sleep(600);
    out['n' + n] = { seeded: Object.keys(done).length, ...(await read(f)) };
    if (n === '259') {
      await f.locator('#pct').scrollIntoViewIfNeeded(); await sleep(300);
      await dev.page.screenshot({ path: P('-259-ipad.png'), scale: 'css', animations: 'disabled' });
    }
    await dev.close();
    console.log('n=' + n, JSON.stringify(out['n' + n]));
  }
  out.math = Object.fromEntries([1, 2, 258, 259, 260].map(n => [n, Math.round(n / 260 * 100)]));
  console.log('math', JSON.stringify(out.math));
  fs.writeFileSync(P('.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
