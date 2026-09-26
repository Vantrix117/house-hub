// Skeptic s1, VIS-DOLLYWOOD-1: contrast of completed (struck-through) build steps, computed independently of lib-vis.
// Opens the build guide inside the hub on the iPad (portrait), WebKit, as Eli, in each palette. For every .bitem.ok it takes
// the computed text colour, multiplies the opacity of the element and its ancestors, and composites it over the nearest
// opaque ancestor background (itself composited up the chain), then computes the WCAG ratio. Also samples rendered pixels.
//   node "audits/tools/phase5/ux-verify/VIS-DOLLYWOOD-1/s1-contrast.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
    const dark = ['midnight', 'forest'].includes(theme);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, mode: dark ? 'dark' : 'light'});
    const f = await d.openApp('dollywood');
    await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1200);
    await d.page.evaluate(t => hub.setTheme(t), theme); await sleep(1500);
    const r = await f.evaluate(() => {
      const parse = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const Lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const ratio = (a, b) => { const x = Lum(a), y = Lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      // background: composite every ancestor's background from the root down
      const bgOf = el => { const chain = []; for (let p = el; p; p = p.parentElement) chain.unshift(p); let bg = { r: 255, g: 255, b: 255, a: 1 };
        const htmlBg = parse(getComputedStyle(document.documentElement).backgroundColor); if (htmlBg.a > 0) bg = over(htmlBg, bg);
        for (const p of chain) { const c = parse(getComputedStyle(p).backgroundColor); if (c.a > 0) bg = over(c, bg); } return bg; };
      const items = [...document.querySelectorAll('.bitem.ok')];
      const done = items.map(e => { const b = e.querySelector('b'); const cs = getComputedStyle(b); let op = 1; for (let p = b; p; p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity);
        const bg = bgOf(e.parentElement); const fg = parse(cs.color); const eff = over({ ...fg, a: fg.a * op }, bg);
        return { text: b.textContent, fs: cs.fontSize, fw: cs.fontWeight, deco: getComputedStyle(e).textDecorationLine, color: cs.color, opacity: +op.toFixed(3), bg: `rgb(${bg.r.toFixed(0)},${bg.g.toFixed(0)},${bg.b.toFixed(0)})`, ratio: +ratio(eff, bg).toFixed(2), rawRatio: +ratio(fg, bg).toFixed(2) }; });
      const open = [...document.querySelectorAll('.bitem:not(.ok):not(.cur)')].slice(0, 1).map(e => { const b = e.querySelector('b'); const bg = bgOf(e.parentElement); return { text: b.textContent, ratio: +ratio(parse(getComputedStyle(b).color), bg).toFixed(2) }; });
      return { theme: document.documentElement.dataset.theme || 'hearth(default)', scheme: document.documentElement.dataset.scheme, nDone: done.length, done: done.slice(0, 3), openItem: open };
    });
    await f.evaluate(() => document.getElementById('b-list').scrollIntoView({ block: 'center' }));
    await sleep(400);
    const el = await f.$('#b-list');
    if (el) await el.screenshot({ path: path.join(OUT, `ipad-steps-${theme}.png`) });
    out[theme] = r;
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
