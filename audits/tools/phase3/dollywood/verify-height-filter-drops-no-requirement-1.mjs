// Phase 3 / dollywood skeptic check: does the listings tab's "rider height: up to N"" filter hide listings with no
// height requirement? Drives the real <select id="hf"> via Playwright selectOption on the iPad (webkit, typical seed),
// reads the "N of M" counter and the rendered rows, and compares with the data (OFF = D.official).
//   node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-height-filter-drops-no-requirement-1';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(400);
  // open the listings tab through its own button
  const tabBtn = await f.$('[data-tab="list"]');
  log('listTabButton', !!tabBtn);
  if (tabBtn) await tabBtn.click();
  await f.waitForSelector('#hf', { state: 'attached', timeout: 10000 });
  log('data', await f.evaluate(() => {
    const none = OFF.filter(o => !o.height_in);
    const byCat = {}; none.forEach(o => { byCat[o.cat] = (byCat[o.cat] || 0) + 1; });
    const reqCats = {}; OFF.filter(o => o.height_in).forEach(o => { reqCats[o.cat] = (reqCats[o.cat] || 0) + 1; });
    return { total: OFF.length, noRequirement: none.length, noReqByCat: byCat, withReqByCat: reqCats,
      noReqRideLike: none.filter(o => /attraction|ride|coaster/i.test(o.cat)).map(o => o.num + ' ' + o.name).slice(0, 40) };
  }));
  const res = {};
  for (const v of ['any', 'none', '36', '39', '42', '48', '55']) {
    await f.selectOption('#hf', v);
    await sleep(150);
    res[v] = await f.evaluate(() => {
      const t = document.getElementById('tab-list');
      const counter = (t.textContent.match(/(\d+) of (\d+)/) || []).slice(1);
      const rows = [...t.querySelectorAll('.oi')].map(e => ({ n: +e.dataset.n, h: OFFNUM[+e.dataset.n].height_in || null }));
      return { counter, rows: rows.length, rowsWithoutReq: rows.filter(r => !r.h).length, maxReq: Math.max(0, ...rows.map(r => r.h || 0)), selected: document.getElementById('hf').value };
    });
    if (v === '36') await d.page.screenshot({ path: path.join(EV, PFX + '-ipad-up-to-36.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  }
  log('filter', res);
  // what the same code base considers "can ride" elsewhere (live map's fits()): no requirement = fits
  log('fitsDefined', await f.evaluate(() => typeof fits === 'function' ? fits.toString().slice(0, 200) : 'fits not defined in this flavour'));
  log('listItemsSrc', await f.evaluate(() => listItems.toString().slice(0, 300)));
} finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
