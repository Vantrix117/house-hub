// UX-DOLLYWOOD-4 skeptic s1: where do search results land relative to the search box, per device, for a no-match,
// a multi-match and a one-match query; is there any empty-state text; is there a clear control in the field.
//   node audits/tools/phase5/ux-verify/UX-DOLLYWOOD-4/s1-search.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-4/s1');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['ipad-portrait', 'iphone-pwa', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(500);
    const queries = await f.evaluate(() => {
      const c = q => OFF.filter(o => o.name.toLowerCase().includes(q)).length;
      return { zipline: c('zipline'), mine: c('mine'), grill: c('grill'), coaster: c('coaster'), thunder: c('thunder'), total: OFF.length };
    });
    log(device + '.queryCounts', queries);
    for (const q of ['zipline', 'mine', 'thunder']) {
      await f.evaluate(() => { window.scrollTo(0, 0); try { closePop(); } catch {} const t = document.querySelector('.toolbar'); if (t && t.dataset.more !== undefined) t.dataset.more = 'open'; }); await sleep(250);
      const qVisible = await f.evaluate(() => { const r = document.getElementById('q').getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (!qVisible) { await f.evaluate(() => { const b = document.querySelector('.toolbar .more'); if (b) b.click(); }); await sleep(250); }
      await f.fill('#q', q); await sleep(900);
      const m = await f.evaluate(() => {
        const l = document.getElementById('tab-list'), r = l.getBoundingClientRect(), qb = document.getElementById('q').getBoundingClientRect();
        const firstItem = l.querySelector('.oi'); const fr = firstItem && firstItem.getBoundingClientRect();
        const pop = document.getElementById('pop'); const pr = pop.getBoundingClientRect();
        const build = document.getElementById('build'); const br = build && build.getBoundingClientRect();
        let cancel = null; try { const cs = getComputedStyle(document.getElementById('q'), '::-webkit-search-cancel-button'); cancel = { display: cs.display, appearance: cs.webkitAppearance || cs.appearance }; } catch (e) { cancel = String(e); }
        return { vw: innerWidth, vh: innerHeight, scrollY: Math.round(scrollY), qType: document.getElementById('q').type, searchBoxBottom: Math.round(qb.bottom), listPanelTop: Math.round(r.top), firstResultTop: fr ? Math.round(fr.top) : null,
          gap: Math.round(r.top - qb.bottom), listInViewport: r.top < innerHeight && r.bottom > 0, countText: (l.textContent.match(/\d+ of \d+/) || [])[0],
          emptyMessage: /no (match|result|listing)|nothing|try /i.test(l.textContent), listText: l.innerText.replace(/\s+/g, ' ').slice(0, 160),
          popOpen: pop.classList.contains('show'), popTitle: (document.querySelector('#pop h2') || {}).textContent || null, popTop: Math.round(pr.top), popBottom: Math.round(pr.bottom),
          sheetTop: br && getComputedStyle(build).position === 'fixed' ? Math.round(br.top) : null, cancelPseudo: cancel };
      });
      log(`${device}.${q}`, m);
      if (q !== 'thunder') await d.page.screenshot({ path: path.join(EV, `${device}-${q}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      await f.evaluate(() => { try { closePop(); } catch {} const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input')); }); await sleep(250);
    }
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'search.json'), JSON.stringify(out, null, 1));
  await L.close();
}
