#!/usr/bin/env node
// Phase 4 ACCENT — skeptic #1 for "park-north-n-on-accent". Independent re-measure on the local rig (park seed, WebKit).
// Opens the park map (dollywood-live) as several adults in several themes, taps #lv-north so it is aria-pressed=true,
// then reads (a) the computed button background and the "N" colour/size resolved to rgb via a canvas, with the WCAG ratio
// of those two exact paints (token math at runtime), and (b) a device-scale screenshot of the N's box: background = median
// of pixels close to the resolved fill, glyph (only pixels inside the button fill, r <= 19 px) = the pixel farthest from that fill (p95 of distance), ratio of the two.
//   node audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-1.mjs
// -> audits/evidence/p4/ACCENT/verify-park-north-n-on-accent-1.json (+ two 1x crops)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const OUT = path.join(EV, 'verify-park-north-n-on-accent-1.json');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const THEMES = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], hearth: ['hearth', 'light'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'light'], forest: ['forest', 'light'] };
const CASES = [
  ...['eli', 'christian', 'mom', 'dad', 'niece'].flatMap(p => [[p, 'system-light'], [p, 'system-dark']]),
  ['eli', 'hearth'], ['eli', 'parchment'], ['eli', 'frost'], ['eli', 'midnight'], ['eli', 'forest'],
];

const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  await L.reset('park');
  for (const [who, tk] of CASES) {
    const [th, mode] = THEMES[tk];
    await L.apiAs(who, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } });
    const d = await L.device({ device: 'iphone-pwa', mode, profile: who, localStorage: { 'hub.theme': JSON.stringify(th) } });
    try {
      const f = await d.openApp('dollywood-live', { wait: '#lv-pill[data-state]' });
      await sleep(1500);
      const before = await f.evaluate(() => document.getElementById('lv-north').getAttribute('aria-pressed'));
      await f.locator('#lv-north').click({ timeout: 5000 });
      await sleep(1200);
      const info = await f.evaluate(() => {
        const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgb = c => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
        const btn = document.getElementById('lv-north'), b = btn.querySelector('b');
        const cb = getComputedStyle(btn), cn = getComputedStyle(b), root = getComputedStyle(document.documentElement);
        const r = b.getBoundingClientRect(), rb = btn.getBoundingClientRect();
        return { pressed: btn.getAttribute('aria-pressed'), theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme,
          accent: root.getPropertyValue('--accent').trim(), btnBg: cb.backgroundColor, btnBgImage: cb.backgroundImage.slice(0, 60), btnBgRgb: rgb(cb.backgroundColor),
          nColor: cn.color, nRgb: rgb(cn.color), nFont: cn.fontSize, nWeight: cn.fontWeight, dangerTok: root.getPropertyValue('--danger').trim(),
          nRect: { x: r.left, y: r.top, w: r.width, h: r.height }, btnRect: { x: rb.left, y: rb.top, w: rb.width, h: rb.height }, btnTransform: btn.style.transform };
      });
      const page = d.page;
      const off = await page.evaluate(() => { const e = document.querySelector('#frame'); const r = e.getBoundingClientRect(); return { x: r.left + e.clientLeft, y: r.top + e.clientTop }; });
      const png = decodePng(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' }));
      const dpr = png.w / page.viewportSize().width;
      const R = { x: info.nRect.x + off.x, y: info.nRect.y + off.y, w: info.nRect.w, h: info.nRect.h };
      const cx = (info.btnRect.x + off.x + info.btnRect.w / 2) * dpr, cy = (info.btnRect.y + off.y + info.btnRect.h / 2) * dpr; const px = [];
      for (let y = Math.floor(R.y * dpr); y < Math.ceil((R.y + R.h) * dpr); y++) for (let x = Math.floor(R.x * dpr); x < Math.ceil((R.x + R.w) * dpr); x++) { if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 19 * dpr) continue; const i = (y * png.w + x) * 4; px.push([png.px[i], png.px[i + 1], png.px[i + 2]]); }
      const near = px.filter(c => dist(c, info.btnBgRgb) <= 24);
      const bgM = near.length ? [0, 1, 2].map(i => q(near.map(c => c[i]), 0.5)) : null;
      let glyph = null;
      if (bgM) { const ds = px.map(c => dist(c, bgM)); const t = q(ds, 0.95); glyph = px[ds.findIndex(v => v >= t)]; }
      const row = { profile: who, themeKey: tk, pressedBefore: before, ...info, tokenRatio: ratio(info.nRgb, info.btnBgRgb), dpr,
        pixel: bgM ? { bgPx: near.length, of: px.length, bgMeasured: bgM, glyphMeasured: glyph, ratio: ratio(glyph, bgM) } : { bgPx: 0, of: px.length } };
      rows.push(row);
      console.log(who, tk, info.scheme, 'pressed', info.pressed, 'bg', info.btnBg, 'N', info.nColor, info.nFont, 'token', row.tokenRatio, 'pixel', row.pixel.ratio, JSON.stringify(row.pixel.glyphMeasured), JSON.stringify(row.pixel.bgMeasured));
      if (who === 'eli' && (tk === 'system-dark' || tk === 'system-light')) {
        const rb = { x: info.btnRect.x + off.x - 20, y: info.btnRect.y + off.y - 20 };
        await page.screenshot({ path: path.join(EV, `verify-park-north-n-on-accent-1-eli-${tk}.png`), clip: { x: Math.max(0, rb.x), y: Math.max(0, rb.y), width: 90, height: 90 }, animations: 'disabled', scale: 'css' });
      }
    } catch (e) { rows.push({ profile: who, themeKey: tk, error: String(e.message).split('\n')[0] }); console.log('ERR', who, tk, String(e.message).split('\n')[0]); }
    finally { await d.close(); }
  }
} finally { await L.close(); }
const ok = rows.filter(r => !r.error);
const pr = ok.filter(r => r.pixel && r.pixel.ratio).map(r => r.pixel.ratio);
const summary = { cases: rows.length, measured: ok.length, allPressed: ok.every(r => r.pressed === 'true'), defaultPressed: [...new Set(ok.map(r => r.pressedBefore))],
  tokenFail45: ok.filter(r => r.tokenRatio < 4.5).length, tokenFail3: ok.filter(r => r.tokenRatio < 3).length,
  tokenRange: ok.length ? [Math.min(...ok.map(r => r.tokenRatio)), Math.max(...ok.map(r => r.tokenRatio))] : null,
  pixelRange: pr.length ? [Math.min(...pr), Math.max(...pr)] : null };
console.log(JSON.stringify(summary));
fs.writeFileSync(OUT, JSON.stringify({ script: 'audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-1.mjs', device: 'iphone-pwa webkit', summary, rows }, null, 1));
