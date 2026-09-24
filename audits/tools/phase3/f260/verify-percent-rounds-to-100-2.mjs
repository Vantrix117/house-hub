// Skeptic #2 for F260 finding "percent-rounds-to-100": does #pct read "100% complete" at 259/260 and "0%" at 1/260?
// Independent of logic.mjs: writes f260.done straight through the local API, opens F260 in the shell on an iPad
// (demo clock, typical household), reads #pct, #doneCount, #todayTitle, #meterFill width for n = 1, 2, 258, 259, 260.
//   node "audits/tools/phase3/f260/verify-percent-rounds-to-100-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-percent-rounds-to-100-2';

const ALL = []; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) ALL.push(w + '-' + d);
async function putRow(L, key, value) {
  const g = await L.apiAs('eli', '/api/data/f260?scope=person&key=__none__');
  const r = await L.apiAs('eli', `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } });
  if (r.status >= 300) throw new Error('PUT ' + key + ' ' + r.status + ' ' + JSON.stringify(r.body));
}
const out = { script: 'audits/tools/phase3/f260/' + P + '.mjs', cases: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const n of [1, 2, 258, 259, 260]) {
    await L.reset('typical');
    // first n readings in plan order ticked (for 259: everything but 52-4, the last reading)
    const done = {}; ALL.slice(0, n).forEach(k => { done[k] = true; });
    const week = n >= 256 ? 52 : 1;
    await putRow(L, 'f260.done', done); await putRow(L, 'f260.week', week);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    const f = await d.openApp('f260');
    await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0 && document.getElementById('pct').textContent.trim(); }, null, { timeout: 20000 });
    await sleep(500);
    const ui = await f.evaluate(() => {
      const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      return { pct: t('#pct'), doneCount: t('#doneCount'), todayTitle: t('#todayTitle'), todayKind: t('#todayKind'), jWhere: t('#jWhere'),
        meterFill: document.getElementById('meterFill').style.width, completeModal: document.getElementById('complete')?.classList.contains('on') || false };
    });
    out.cases[n] = ui;
    if (n === 259 || n === 1) {
      await f.evaluate(() => document.getElementById('pct').scrollIntoView({ block: 'center' })); await sleep(300);
      await d.page.screenshot({ path: path.join(EVID, `${P}-${n}-of-260-ipad.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    console.log('n=' + n, JSON.stringify(ui));
    await d.close();
  }
  fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
