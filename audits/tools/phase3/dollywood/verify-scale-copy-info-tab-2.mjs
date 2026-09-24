// Phase 3 / dollywood — skeptic #2 for finding "scale-copy-info-tab": the Scale tab copy says dimensions "shown in the Info tab"
// will also be shown in game metres, but there is no Info tab. Where DO the converted dimensions appear?
//   node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-2.mjs"
// Arms:
//   A  the build guide on the iPad (portrait): list every [role=tab] label; any element whose text is exactly "Info"
//   B  open the Scale tab: the paragraph text
//   C  set a plot width, open a listing's popover (showOfficial): does "(N in game)" appear there — i.e. the converted
//      dimensions live in the listing pop-up card, not in any tab
// Writes audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2.json (+ one PNG of the Scale tab).
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
  await sleep(2000);
  log('A.tabs', await f.evaluate(() => ({
    tabs: [...document.querySelectorAll('[role=tab]')].map(b => ({ label: b.textContent.trim(), tab: b.dataset.tab || null })),
    elementsTextInfo: [...document.querySelectorAll('button,a,summary,[role=tab],h2,h3')].filter(e => /^\s*info\s*$/i.test(e.textContent)).map(e => e.outerHTML.slice(0, 120)),
    tabbodies: [...document.querySelectorAll('.tabbody')].map(e => e.id),
  })));
  await f.evaluate(() => showTab('scale')); await sleep(400);
  log('B.scaleCopy', await f.evaluate(() => { const p = document.querySelector('#tab-scale p'); return { text: p.textContent.replace(/\s+/g, ' ').trim(), visible: !!p.offsetParent }; }));
  await d.page.screenshot({ path: path.join(EV, 'verify-scale-copy-info-tab-2-scale-tab.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  out.png = 'audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2-scale-tab.png';
  await f.evaluate(() => { const el = document.getElementById('sc-plot'); el.value = '400'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(300);
  log('C.popover', await f.evaluate(() => {
    const o = OFF.find(x => x.bld != null && BLD[x.bld]) || OFF[0];
    showOfficial(o);
    const pop = document.querySelector('.pop, #pop') || (typeof window.pop !== 'undefined' ? window.pop : null);
    const txt = (typeof pop !== 'undefined' && pop) ? pop.textContent.replace(/\s+/g, ' ') : '';
    return { listing: o.name, scaleFac: scale.fac, popHasInGame: /in game/.test(txt), popClass: pop ? (pop.id || pop.className) : null, snippet: (txt.match(/Footprint[^·]*·?[^·]*/) || [''])[0].slice(0, 120), activeTab: document.querySelector('[role=tab][aria-selected=true]')?.textContent };
  }));
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-scale-copy-info-tab-2.json'), JSON.stringify(out, null, 2));
  await L.close();
}
