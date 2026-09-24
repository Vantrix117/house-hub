// Visual-score checker: how visible are the "not yet" cells of F260's progress graphics?
// Measures the rendered fill of unread year-grid weeks (.ygrid button), empty heatmap days (.heat span), the meter
// track (.meter) and unread book-bar segments (.jbar button) against the page background, in light and dark, and the
// same for the house minimum for non-text graphics (3:1). Colours are resolved to sRGB through a canvas.
// Run: node "audits/tools/phase3/f260/vischeck-empty-cells.mjs"
import { local, save, shot, ready } from './_lib.mjs';

const L = await local({ variant: 'empty', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  for (const mode of ['light', 'dark']) {
    const d = await L.device({ device: 'ipad-landscape', profile: 'eli', mode });
    await d.goto('#home'); const f = await d.openApp('f260'); await ready(f);
    out[mode] = await f.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d');
      const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const p = cx.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2], p[3]]; };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
      const page = rgb(getComputedStyle(document.body).backgroundColor);
      const pick = (sel, filt = () => true) => { const e = [...document.querySelectorAll(sel)].find(filt); if (!e) return null;
        const s = getComputedStyle(e); const c = rgb(s.backgroundColor); return { sel, bg: s.backgroundColor, rgb: c.slice(0, 3), opacity: s.opacity, vsPage: cr(c, page) }; };
      return {
        theme: document.documentElement.dataset.theme || '(system)', scheme: document.documentElement.dataset.scheme, page: page.slice(0, 3),
        yearUnread: pick('#ygrid button, .ygrid button', e => !e.classList.contains('done') && !e.classList.contains('cur') && !e.classList.contains('part')),
        heatEmpty: pick('#heat span', e => !e.className),
        meterTrack: pick('.meter'),
        bookUnread: pick('#jbar button', e => !e.querySelector('i') || getComputedStyle(e.querySelector('i')).width === '0px'),
      };
    });
    await shot(d.page, `vischeck-empty-cells-ipad-landscape-${mode}.png`, { clip: { x: 0, y: 380, width: 440, height: 440 } });
    await d.close?.();
  }
  console.log(JSON.stringify(out, null, 1));
  console.log('saved', save('vischeck-empty-cells.json', out));
} finally { await L.close(); }
