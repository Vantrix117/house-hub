#!/usr/bin/env node
// Phase 4 ACCENT — skeptic #1 for "selection-by-hue-only". Independent re-measure on the local rig (WebKit, iPhone PWA 430x932).
//   node audits/tools/phase4/ACCENT/verify-selection-by-hue-only-1.mjs [--themes system-light,system-dark] [--profiles dad,kiara] [--areas shell,timer,prayer,park]
// Per profile x theme:
//   shell  (#apps): computed ink of .tab.on vs .tab:not(.on) (luminance ratio), font-weight of both, and rendered PIXELS of
//                   the #tab-ind pill (inside its left edge, away from glyphs) vs the bar beside it.
//   timer  : .presets .btn.on fill pixel vs an unselected chip's fill pixel and vs the page just outside; its border pixel too.
//   prayer : nav button[aria-current=true] fill pixel vs the nav bar pixel beside it (adults only).
//   park   : (variant park) .lv-tabs button[aria-pressed=true] fill pixel vs the sheet beside it.
// → audits/evidence/p4/ACCENT/verify-selection-by-hue-only-1.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const opt = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const THEMES = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], hearth: ['hearth', 'light'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'dark'], forest: ['forest', 'dark'] };
const themes = (opt('themes') || Object.keys(THEMES).join(',')).split(',');
const profiles = (opt('profiles') || 'eli,christian,mom,dad,niece,ezra,kiara').split(',');
const areas = (opt('areas') || 'shell,timer,prayer').split(',');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT/verify-selection-by-hue-only-1' + (opt('tag') ? '-' + opt('tag') : '') + '.json');
const ADULTS = ['eli', 'christian', 'mom', 'dad', 'niece'];

// ── minimal PNG decode (8-bit RGB/RGBA, non-interlaced) ──
function decode(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x]; if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255; } }
  return { w, h, px: (x, y) => { x = Math.round(x); y = Math.round(y); const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
// median of a small patch (dodges anti-aliasing)
const patch = (img, x, y, r = 2) => { const v = []; for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) v.push(img.px(x + dx, y + dy)); return [0, 1, 2].map(k => v.map(q => q[k]).sort((a, b) => a - b)[v.length >> 1]); };
const parseCol = s => { let m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); if (m) return [+m[1], +m[2], +m[3]].map(Math.round);
  m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/); if (m) return [m[1], m[2], m[3]].map(v => Math.round(+v * 255)); return null; };
const hex = c => c && '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

async function pageShot(page) { return decode(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' })); }

const R = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { note: 'verify-selection-by-hue-only-1: pixels are CSS-scale screenshot samples (5x5 median); ratios are WCAG luminance ratios.', rows: [] };
const done = new Set(R.rows.map(r => [r.theme, r.profile, r.area].join('|')));

const Lh = await local({ variant: areas.includes('park') ? 'park' : 'typical', engine: 'webkit' });
try {
  for (const theme of themes) {
    const [th, mode] = THEMES[theme];
    for (const prof of profiles) await Lh.apiAs(prof, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }).catch(e => console.log('theme put', prof, e.message));
    for (const prof of profiles) {
      for (const area of areas) {
        const key = [theme, prof, area].join('|'); if (done.has(key)) continue;
        if (area === 'prayer' && !ADULTS.includes(prof)) continue;
        const d = await Lh.device({ device: 'iphone-pwa', mode, profile: prof, localStorage: { 'hub.theme': JSON.stringify(th) } });
        const row = { theme, profile: prof, area };
        try {
          if (area === 'shell') {
            await d.goto('#apps'); await sleep(1500);
            const m = await d.page.evaluate(() => {
              const on = document.querySelector('.tab.on'), off = [...document.querySelectorAll('.tab:not(.on)')][0], ind = document.getElementById('tab-ind'), bar = document.getElementById('tabbar');
              const cs = e => getComputedStyle(e); const r = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
              return { dataTheme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, onTab: on && on.dataset.tab, onInk: on && cs(on).color, offInk: off && cs(off).color, onW: on && cs(on).fontWeight, offW: off && cs(off).fontWeight, indBg: ind && cs(ind).backgroundColor, ind: ind && r(ind), bar: bar && r(bar), barDisplay: bar && cs(bar).display };
            });
            const img = await pageShot(d.page); const cy = m.ind.y + m.ind.h / 2;
            const pill = patch(img, m.ind.x + 6, cy), beside = patch(img, m.ind.x - 8, cy);
            Object.assign(row, { dataTheme: m.dataTheme, scheme: m.scheme, onTab: m.onTab, onInk: m.onInk, offInk: m.offInk, inkRatio: parseCol(m.onInk) && parseCol(m.offInk) ? ratio(parseCol(m.onInk), parseCol(m.offInk)) : null, weightOn: m.onW, weightOff: m.offW, indBg: m.indBg, pillPx: hex(pill), barPx: hex(beside), pillVsBar: ratio(pill, beside) });
          } else if (area === 'timer') {
            const f = await d.openApp('timer', { wait: '.presets .btn.on' }); await sleep(1200);
            const m = await f.evaluate(() => { const on = document.querySelector('.presets .btn.on'), off = document.querySelector('.presets .btn:not(.on)'); const r = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
              return { scheme: document.documentElement.dataset.scheme, dataTheme: document.documentElement.dataset.theme, on: r(on), off: r(off), onBg: getComputedStyle(on).backgroundColor, onBorder: getComputedStyle(on).borderTopColor, offBg: getComputedStyle(off).backgroundColor, onW: getComputedStyle(on).fontWeight, offW: getComputedStyle(off).fontWeight, label: on.textContent }; });
            const fr = await (await f.frameElement()).boundingBox();
            const img = await pageShot(d.page); const oy = fr.y + m.on.y + m.on.h / 2, fy = fr.y + m.off.y + m.off.h / 2;
            const onPx = patch(img, fr.x + m.on.x + m.on.h / 2 + 2, oy, 1), offPx = patch(img, fr.x + m.off.x + m.off.h / 2 + 2, fy, 1);
            const outside = patch(img, fr.x + m.on.x + m.on.w / 2, fr.y + m.on.y - 6, 1), border = img.px(fr.x + m.on.x + m.on.w / 2, fr.y + m.on.y + 0.5);
            Object.assign(row, { dataTheme: m.dataTheme, scheme: m.scheme, label: m.label, onBg: m.onBg, onBorder: m.onBorder, offBg: m.offBg, weightOn: m.onW, weightOff: m.offW, onPx: hex(onPx), offPx: hex(offPx), pagePx: hex(outside), borderPx: hex(border), onVsOff: ratio(onPx, offPx), onVsPage: ratio(onPx, outside), borderVsPage: ratio(border, outside) });
          } else if (area === 'prayer') {
            const f = await d.openApp('prayer', { wait: 'nav button[aria-current="true"]' }); await sleep(1500);
            const m = await f.evaluate(() => { const on = document.querySelector('nav button[aria-current="true"]'); const b = on.getBoundingClientRect(); const off = document.querySelector('nav button:not([aria-current="true"])');
              return { scheme: document.documentElement.dataset.scheme, dataTheme: document.documentElement.dataset.theme, on: { x: b.x, y: b.y, w: b.width, h: b.height }, onBg: getComputedStyle(on).backgroundColor, onInk: getComputedStyle(on).color, offInk: off && getComputedStyle(off).color, onW: getComputedStyle(on).fontWeight, offW: off && getComputedStyle(off).fontWeight, label: on.textContent.trim() }; });
            const fr = await (await f.frameElement()).boundingBox();
            const img = await pageShot(d.page); const cy = fr.y + m.on.y + m.on.h / 2;
            const onPx = patch(img, fr.x + m.on.x + 7, cy, 1), beside = patch(img, fr.x + m.on.x - 4, cy, 1);
            Object.assign(row, { dataTheme: m.dataTheme, scheme: m.scheme, label: m.label, onBg: m.onBg, onInk: m.onInk, offInk: m.offInk, inkRatio: ratio(parseCol(m.onInk), parseCol(m.offInk)), weightOn: m.onW, weightOff: m.offW, onPx: hex(onPx), barPx: hex(beside), onVsBar: ratio(onPx, beside) });
          } else if (area === 'park') {
            const f = await d.openApp('dollywood-live', { wait: '.lv-tabs button[aria-pressed="true"]' }); await sleep(2500);
            const m = await f.evaluate(() => { const on = document.querySelector('.lv-tabs button[aria-pressed="true"]'); if (!on) return null; const b = on.getBoundingClientRect(); const off = document.querySelector('.lv-tabs button[aria-pressed="false"]');
              return { scheme: document.documentElement.dataset.scheme, on: { x: b.x, y: b.y, w: b.width, h: b.height }, onBg: getComputedStyle(on).backgroundColor, onInk: getComputedStyle(on).color, offInk: off && getComputedStyle(off).color, onW: getComputedStyle(on).fontWeight, offW: off && getComputedStyle(off).fontWeight, label: on.textContent.trim() }; });
            if (!m) { row.error = 'no pressed park tab'; } else {
              const fr = await (await f.frameElement()).boundingBox();
              const img = await pageShot(d.page); const cy = fr.y + m.on.y + m.on.h / 2;
              const onPx = patch(img, fr.x + m.on.x + 6, cy, 1), beside = patch(img, fr.x + m.on.x - 3, cy, 1);
              Object.assign(row, { scheme: m.scheme, label: m.label, onBg: m.onBg, onInk: m.onInk, offInk: m.offInk, inkRatio: parseCol(m.onInk) && parseCol(m.offInk) ? ratio(parseCol(m.onInk), parseCol(m.offInk)) : null, weightOn: m.onW, weightOff: m.offW, onPx: hex(onPx), sheetPx: hex(beside), onVsSheet: ratio(onPx, beside) });
            }
          }
          if (opt('shots') && opt('shots').split(',').includes(key.replace(/\|/g, '-'))) await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide', path: path.join(ROOT, 'audits/evidence/p4/ACCENT', 'verify-selection-by-hue-only-1-' + key.replace(/\|/g, '-') + '.png') });
        } catch (e) { row.error = e.message.slice(0, 200); }
        await d.close();
        R.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
        console.log(JSON.stringify(row));
      }
    }
  }
} finally { await Lh.close(); }
