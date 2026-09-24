// Phase 3 / dollywood — skeptic #2 for "Scale tab copy points to an 'Info tab' that does not exist".
//   node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-2.mjs"
// Opens the build guide as Eli on the iPad (typical seed), lists every tab / tablist button in the document, reads the Scale
// tab paragraph, then opens a building popover and checks where the "(N in game)" values actually render.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const NAME = 'verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-2';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await sleep(2500);
  log('tabs', await f.evaluate(() => [...document.querySelectorAll('[role=tab], .tabs button, [data-tab]')].map(b => ({ text: b.textContent.trim(), tab: b.dataset.tab || null, visible: !!(b.offsetWidth || b.offsetHeight) }))));
  log('anyElementLabelledInfo', await f.evaluate(() => [...document.querySelectorAll('button,[role=tab],summary,h2,h3,a')].filter(e => /^\s*info\b/i.test(e.textContent)).map(e => e.outerHTML.slice(0, 120))));
  await f.evaluate(() => showTab('scale')); await sleep(400);
  log('scaleParagraph', await f.evaluate(() => document.querySelector('#tab-scale p').textContent.replace(/\s+/g, ' ').trim()));
  log('plotWidth', await f.evaluate(() => ({ input: document.getElementById('sc-plot').value, fac: scale.fac })));
  const p = await f.$('#tab-scale'); if (p) await p.screenshot({ path: path.join(EV, NAME + '-scale-tab.png'), scale: 'css' });
  // where do the game-metre values show? open the first official listing that has a building footprint
  const pop = await f.evaluate(() => { const o = OFF.find(x => x.bld != null); showOfficial(o); const el = document.getElementById('pop'); return { name: o.name, popVisible: el.classList.contains('show'), inGame: (el.textContent.match(/\(\d+ in game\)/g) || []), insideTabbody: !!el.closest('.tabbody') }; });
  log('popover', pop);
  await sleep(400);
  const pe = await f.$('#pop'); if (pe) await pe.screenshot({ path: path.join(EV, NAME + '-popover.png'), scale: 'css' });
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 1));
