// PROF skeptic #1 for finding "picker-title-hidden-iphone": does the signed-out profile picker open with its h1
// ("Anderson House") above the top edge on iPhone sizes, and can it be reached?
//
//   node "audits/tools/phase2/PROF/verify-picker-title-hidden-iphone-1.mjs"
//
// Cases: WebKit + Chromium; typical seed (9 profiles incl. the guest Grandma Jo), the same with guests filtered out of
// /api/profiles (the 8-person household), overflow seed; rig iPhone PWA 430x932, iPhone Safari 430x740 and a
// 390x844 standard iPhone. Prints h1 top at open, the gate's scroll range, and (Chromium) a synthetic touch drag.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
const measure = page => page.evaluate(() => {
  const g = document.getElementById('gate'), h1 = document.querySelector('.gate-title h1'), p = document.querySelector('.gate-title p');
  const r = el => Math.round(el.getBoundingClientRect().top);
  const cs = getComputedStyle(g);
  return { vh: innerHeight, gateH: g.clientHeight, scrollH: g.scrollHeight, scrollTop: g.scrollTop, h1Top: r(h1), h1H: Math.round(h1.getBoundingClientRect().height), pTop: r(p), cards: document.querySelectorAll('#profiles .pcard[data-id]').length, justify: cs.justifyContent, overflowY: cs.overflowY, active: document.activeElement && document.activeElement.dataset.id };
});
for (const engine of ['webkit', 'chromium']) {
  for (const variant of ['typical', 'overflow']) {
    const L = await local({ variant, clock: 'real', engine });
    try {
      const cases = variant === 'typical'
        ? [['iphone-pwa', null, false], ['iphone-pwa', null, true], ['iphone-safari', null, false], ['iphone-safari', null, true], ['iphone-pwa', { width: 390, height: 844 }, true]]
        : [['iphone-pwa', null, false]];
      for (const [dev, vp, noGuests] of cases) {
        const d = await L.device({ device: dev, profile: null, fixedTime: false });
        if (noGuests) await d.ctx.route('**/api/profiles', async r => { const res = await r.fetch(); const j = await res.json(); const list = (j.profiles || j).filter(p => !p.is_guest); await r.fulfill({ response: res, json: j.profiles ? { ...j, profiles: list } : list }); });
        if (vp) await d.page.setViewportSize(vp);
        await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await sleep(1200);
        const open = await measure(d.page);
        const tag = `${engine}-${variant}-${dev}${vp ? '-' + vp.width + 'x' + vp.height : ''}${noGuests ? '-8people' : ''}`;
        if ((variant === 'typical' && dev === 'iphone-pwa' && !vp && !noGuests) || (vp && engine === 'webkit') || (dev === 'iphone-safari' && noGuests && engine === 'webkit'))
          await d.page.screenshot({ path: path.join(OUT, `verify-picker-title-1-${tag}-open.png`), scale: 'css' });
        const up = await d.page.evaluate(() => { const g = document.getElementById('gate'); g.scrollTop = -10000; const h1 = document.querySelector('.gate-title h1'); return { scrollTop: g.scrollTop, h1Top: Math.round(h1.getBoundingClientRect().top) }; });
        let drag = null;
        if (engine === 'chromium') {
          await d.page.evaluate(() => { document.getElementById('gate').scrollTop = 0; });
          const cdp = await d.ctx.newCDPSession(d.page);
          // a finger dragging downwards (content moves down = scroll towards the top)
          await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 300, yDistance: 600, gestureSourceType: 'touch', speed: 800 });
          await sleep(500);
          drag = await d.page.evaluate(() => ({ scrollTop: document.getElementById('gate').scrollTop, h1Top: Math.round(document.querySelector('.gate-title h1').getBoundingClientRect().top) }));
        }
        const row = { case: tag, ...open, minScrollTop: up.scrollTop, h1TopAtMin: up.h1Top, touchDragUp: drag };
        rows.push(row);
        console.log(JSON.stringify(row));
        await d.close();
      }
    } finally { await L.close(); }
  }
}

// Safe areas: the rig cannot emulate env(safe-area-inset-*), so the 8-person household is re-measured with the insets a
// Home Screen app gets on an iPhone with a Dynamic Island (top 59 / bottom 34, web view under the status bar) and with
// the status bar outside the web view (top 0 / bottom 34, viewport 59 px shorter). WebKit only; --safe-* overridden by an
// injected style (no app file is changed).
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try {
    for (const [label, vp, top, bottom] of [['430x932-under-statusbar', { width: 430, height: 932 }, 59, 34], ['430x873-below-statusbar', { width: 430, height: 873 }, 0, 34],
                                            ['390x844-under-statusbar', { width: 390, height: 844 }, 59, 34], ['390x785-below-statusbar', { width: 390, height: 785 }, 0, 34]]) {
      const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false });
      await d.ctx.route('**/api/profiles', async r => { const res = await r.fetch(); const j = await res.json(); const list = (j.profiles || j).filter(p => !p.is_guest); await r.fulfill({ response: res, json: j.profiles ? { ...j, profiles: list } : list }); });
      await d.ctx.addInitScript(([t, b]) => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--safe-top:' + t + 'px !important;--safe-bottom:' + b + 'px !important}'; document.head.appendChild(s); }); }, [top, bottom]);
      await d.page.setViewportSize(vp);
      await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await sleep(1200);
      const m = await measure(d.page);
      const row = { case: 'webkit-8people-safearea-' + label, safeTop: top, safeBottom: bottom, ...m, h1VisibleBelowStatusBar: m.h1Top >= top };
      rows.push(row); console.log(JSON.stringify(row));
      await d.page.screenshot({ path: path.join(OUT, 'verify-picker-title-1-safearea-' + label + '.png'), scale: 'css' });
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify-picker-title-hidden-iphone-1.json'), JSON.stringify(rows, null, 1));
