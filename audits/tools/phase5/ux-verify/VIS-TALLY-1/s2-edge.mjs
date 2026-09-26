// Skeptic s2, VIS-TALLY-1: does the disc boundary (ring, edge, shadow) of − / + / the dial reach 3:1 against the wash in
// the dark palettes, even though the fill does not? Samples a horizontal line across the left edge of each disc and
// reports the fill-vs-wash ratio and the max ratio of any edge pixel (within ±6 px of the border) against the wash.
// Also the glyph/count text ratio. WebKit: backdrop-filter blur is not painted (the wash is a smooth gradient, so blur
// would change little). Run: node audits/tools/phase5/ux-verify/VIS-TALLY-1/s2-edge.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/VIS-TALLY-1/s2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const CASES = [['midnight', 'light', 'dad'], ['midnight', 'light', 'eli'], ['forest', 'light', 'dad'], ['system', 'dark', 'ezra'], ['system', 'dark', 'kiara'], ['system', 'light', 'eli']];
const rows = [];
try {
  for (const [theme, mode, profile] of CASES) {
    const d = await L.device({ device: 'ipad-portrait', profile, mode, localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
    await d.page.goto(L.site + '/apps/tally.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    await sleep(400);
    const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    fs.writeFileSync(`${OUT}/${theme}-${mode}os-${profile}.png`, png);
    const r = await d.page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const out = { scheme: document.documentElement.dataset.scheme };
      for (const id of ['minus', 'plus', 'dial']) {
        const el = id === 'dial' ? document.querySelector('.dial') : document.getElementById(id);
        const b = el.getBoundingClientRect(); const y = b.y + b.height / 2;
        const wash = px(b.x - 24, y), fill = px(b.x + b.width * 0.25, y);
        let edgeMax = 0, edgePx = null;
        for (let dx = -6; dx <= 6; dx++) { const p = px(b.x + dx, y); const q = ratio(p, wash); if (q > edgeMax) { edgeMax = q; edgePx = p; } }
        // top edge too (specular sheen is along the top)
        const tw = px(b.x + b.width / 2, b.y - 24); let topMax = 0;
        for (let dy = -6; dy <= 8; dy++) { const q = ratio(px(b.x + b.width / 2, b.y + dy), tw); if (q > topMax) topMax = q; }
        out[id] = { w: Math.round(b.width), wash, fill, fillVsWash: ratio(fill, wash), edgeMaxVsWash: edgeMax, edgePx, topEdgeMaxVsWash: topMax };
      }
      const txt = s => getComputedStyle(document.querySelector(s)).color;
      out.textColors = { plus: txt('#plus'), minus: txt('#minus'), count: txt('#n') };
      return out;
    }, png.toString('base64'));
    rows.push({ theme, os: mode, profile, ...r });
    console.log(theme, mode, profile, r.scheme, ['minus', 'plus', 'dial'].map(k => `${k}: fill ${r[k].fillVsWash} edge ${r[k].edgeMaxVsWash} top ${r[k].topEdgeMaxVsWash}`).join(' | '));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/edge.json`, JSON.stringify(rows, null, 1));
  await L.close();
}
