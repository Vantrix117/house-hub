// Skeptic s2, VIS-DOLLYWOOD-1: contrast of ticked build steps (.bitem.ok), measured inside the hub viewer (not standalone),
// by sampling rendered pixels: glyph-darkest vs row background, plus a computed blend. WebKit, as Eli, typical seed.
//   node audits/tools/phase5/ux-verify/VIS-DOLLYWOOD-1/s2-contrast.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const [dev, theme, mode] of [['ipad-portrait', 'hearth', 'light'], ['ipad-portrait', 'midnight', 'dark'], ['ipad-portrait', 'parchment', 'light'], ['iphone-pwa', 'hearth', 'light']]) {
    const d = await L.device({ device: dev, profile: 'eli', mode, fixedTime: false, localStorage: theme === 'hearth' ? {} : { 'hub.theme': JSON.stringify(theme) } });
    const f = await d.openApp('dollywood');
    await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1200);
    if (dev === 'iphone-pwa') { await f.evaluate(() => { document.getElementById('build').dataset.state = 'full'; }); await sleep(700); }
    const info = await f.evaluate(() => {
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
      const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.95)) return { el: n.className || n.tagName, c: c.slice(0, 3) }; } return { el: 'none', c: [255, 255, 255] }; };
      const ok = [...document.querySelectorAll('.bitem.ok')], cur = document.querySelector('.bitem.cur'), plain = document.querySelector('.bitem:not(.ok):not(.cur)');
      const one = e => { if (!e) return null; const b = e.querySelector('b'); const cs = getComputedStyle(b); let op = 1; for (let n = b; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity); const fg = rgb(cs.color).slice(0, 3), bg = bgOf(e); const blend = fg.map((v, i) => op * v + (1 - op) * bg.c[i]);
        const r = e.getBoundingClientRect(); return { text: b.textContent, fs: parseFloat(cs.fontSize), weight: cs.fontWeight, deco: getComputedStyle(e).textDecorationLine, color: cs.color, opacity: op, bgFrom: bg.el, bg: bg.c, blended: blend.map(Math.round), ratio: +cr(blend, bg.c).toFixed(2), rect: [r.x, r.y, r.width, r.height].map(Math.round) }; };
      return { theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, nOk: ok.length, nItems: document.querySelectorAll('.bitem').length, done: one(ok[0]), cur: one(cur), notDone: one(plain) };
    });
    // scroll the list into view and screenshot the frame's build card
    await f.evaluate(() => { const l = document.getElementById('b-list'); l.scrollIntoView({ block: 'center' }); });
    await sleep(500);
    const el = await f.$('#b-list');
    const png = path.join(OUT, `${dev}-${theme}-list.png`);
    await el.screenshot({ path: png, animations: 'disabled' }).catch(e => { info.shotErr = String(e); });
    res[`${dev}.${theme}`] = { ...info, png: path.relative(process.cwd(), png).split(path.sep).join('/') };
    console.log(dev, theme, JSON.stringify(info));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(res, null, 1));
  await L.close();
}
