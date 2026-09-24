// Phase 3 / dollywood, skeptic #2: does the Build guide's "rider height: up to N"" filter hide listings with no requirement?
// Fresh local instance, iPad portrait, Eli, typical seed. Uses a real <select> choice (selectOption), not a direct onchange call.
//   node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(500);
  log('data', await f.evaluate(() => {
    const cats = {}; OFF.forEach(o => { const k = o.cat + (o.height_in ? ':req' : ':noreq'); cats[k] = (cats[k] || 0) + 1; });
    return { total: OFF.length, byCatReq: cats,
      heights: [...new Set(OFF.filter(o => o.height_in).map(o => o.height_in))].sort((a, b) => a - b),
      noReqAttractions: OFF.filter(o => !o.height_in && o.cat === 'attraction').map(o => o.num + ' ' + o.name) };
  }));
  const counts = {}; let names36 = null;
  for (const v of ['any', 'none', '36', '39', '42', '48', '55']) {
    await f.selectOption('#hf', v); await sleep(400);
    counts[v] = await f.evaluate(() => (document.getElementById('tab-list').textContent.match(/(\d+) of \d+/) || [])[1]);
    if (v === '36') {
      names36 = await f.evaluate(() => [...document.querySelectorAll('#tab-list .oi')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
      await f.evaluate(() => document.getElementById('hf').scrollIntoView({ block: 'start' })); await sleep(300);
      await d.page.screenshot({ path: path.join(EV, 'verify-height-filter-drops-no-requirement-2-upto36.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
  }
  log('countsViaSelect', counts);
  log('shownAtUpTo36', names36);
  log('filterSource', await f.evaluate(() => listItems.toString().slice(0, 400)));
  // sibling app's notion of "fits" for comparison is code-only (dollywood-live fits(): !o.height_in || ...)
  fs.writeFileSync(path.join(EV, 'verify-height-filter-drops-no-requirement-2.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
