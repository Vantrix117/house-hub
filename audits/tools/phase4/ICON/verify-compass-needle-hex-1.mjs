// Phase 4 ICON skeptic #1 — independent re-measure of the park-map compass (#lv-north) north needle contrast per theme.
// For each palette: theme set as eli's person pref (PUT /api/data/hub/theme) + localStorage, dollywood-live opened on
// iphone-pwa (and dollywood on ipad-portrait, where the build guide shows the compass: the hub-flavour hide rule is
// under @media(max-width:699px)). Rotation is neutralised during sampling (colours only). Background = per-channel
// median of the pixels at the needle's interior points with the svg + "N" hidden; needle = the same points shown.
// Also records the computed fill of the north path, the "N" letter colour/size and its contrast.
//   node audits/tools/phase4/ICON/verify-compass-needle-hex-1.mjs
// → audits/evidence/p4/ICON/verify-compass-needle-hex-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const THEMES = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['system', 'light']];
const SURF = [['dollywood-live', 'iphone-pwa'], ['dollywood', 'ipad-portrait'], ['dollywood', 'iphone-pwa']];
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const parseRgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
// interior points of the north kite M12 2.5 l4.2 10.5 L12 10.6 7.8 13z (viewBox 24)
const PTS = [[12, 6], [12, 7.5], [12, 9], [11, 9.5], [13, 9.5], [12, 5]];

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { script: 'audits/tools/phase4/ICON/verify-compass-needle-hex-1.mjs', engine: 'webkit', variant: 'typical', results: [] };
try {
  for (const [theme, mode] of THEMES) {
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } });
    for (const [app, device] of SURF) {
      const d = await L.device({ device, mode, profile: 'eli', localStorage: theme === 'system' ? {} : { 'hub.theme': JSON.stringify(theme) } });
      try {
        const f = await d.openApp(app);
        await sleep(5000);
        const info = await f.evaluate((PTS) => {
          const b = document.getElementById('lv-north');
          if (!b) return { found: false };
          const cs = getComputedStyle(b), wrap = b.closest('.lv-northwrap');
          const visible = !!(b.offsetWidth && getComputedStyle(wrap).display !== 'none' && getComputedStyle(wrap).visibility !== 'hidden' && +getComputedStyle(wrap).opacity > 0);
          const savedT = b.style.transform; b.dataset.vTr = b.style.transition; b.style.transition = 'none'; b.style.transform = 'none';
          const svg = b.querySelector('svg'), p = svg.querySelector('path'), n = b.querySelector('b');
          const r = svg.getBoundingClientRect(), br = b.getBoundingClientRect();
          const pts = PTS.map(([x, y]) => [r.x + x / 24 * r.width, r.y + y / 24 * r.height]);
          const ncs = getComputedStyle(n);
          return { found: true, visible, savedT, theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, flavor: document.documentElement.dataset.flavor,
            fillAttr: p.getAttribute('fill'), fillComputed: getComputedStyle(p).fill, pathOpacity: getComputedStyle(p).opacity,
            svgRect: { x: r.x, y: r.y, w: r.width, h: r.height }, btn: { w: br.width, h: br.height, bg: cs.backgroundColor, color: cs.color },
            pts, N: { color: ncs.color, fontSize: ncs.fontSize, fontWeight: ncs.fontWeight } };
        }, PTS);
        const rec = { theme, mode, app, device, ...info };
        if (info.found && info.visible) {
          const fe = await f.frameElement(); const bb = await fe.boundingBox(); const iw = await f.evaluate(() => innerWidth); const s = bb.width / iw;
          const pagePts = info.pts.map(([x, y]) => [bb.x + x * s, bb.y + y * s]);
          const clip = { x: Math.floor(bb.x + info.svgRect.x * s) - 2, y: Math.floor(bb.y + info.svgRect.y * s) - 2, width: Math.ceil(info.svgRect.w * s) + 4, height: Math.ceil(info.svgRect.h * s) + 4 };
          const grab = async () => (await d.page.screenshot({ clip })).toString('base64');
          await sleep(300); const shown = await grab();
          await f.evaluate(() => { const b = document.getElementById('lv-north'); b.querySelector('svg').style.setProperty('visibility', 'hidden', 'important'); b.querySelector('b').style.setProperty('visibility', 'hidden', 'important'); });
          const hidden = await grab();
          await f.evaluate(t => { const b = document.getElementById('lv-north'); b.querySelector('svg').style.removeProperty('visibility'); b.querySelector('b').style.removeProperty('visibility'); b.style.transform = t; b.style.transition = b.dataset.vTr || ''; delete b.dataset.vTr; }, info.savedT);
          const rel = pagePts.map(([x, y]) => [x - clip.x, y - clip.y]);
          const sample = await d.page.evaluate(async ({ a, h, rel, cw }) => {
            const px = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const k = img.width / cw; return rel.map(([x, y]) => Array.from(cx.getImageData(Math.min(Math.round(x * k), img.width - 1), Math.min(Math.round(y * k), img.height - 1), 1, 1).data).slice(0, 3)); };
            return { shown: await px(a), hidden: await px(h) };
          }, { a: shown, h: hidden, rel, cw: clip.width });
          const med = arr => [0, 1, 2].map(i => { const v = arr.map(p => p[i]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; });
          const bg = med(sample.hidden), needle = med(sample.shown);
          const fill = parseRgb(info.fillComputed);
          rec.sample = { bgPixels: sample.hidden, needlePixels: sample.shown, bgMedian: bg, needleMedian: needle };
          rec.contrast = { declaredFillVsBg: cr(fill, bg), renderedNeedleVsBg: cr(needle, bg), NletterVsBg: cr(parseRgb(info.N.color), bg), southHalfNote: 'currentColor at .55 not measured' };
          if (theme === 'parchment' && app === 'dollywood-live') fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/ICON/verify-compass-needle-hex-1-parchment.png'), await d.page.screenshot({ clip: { x: clip.x - 20, y: clip.y - 20, width: clip.width + 40, height: clip.height + 40 }, scale: 'css' }));
        }
        delete rec.pts;
        out.results.push(rec);
        console.log(theme, app, device, rec.theme, rec.scheme, 'visible=' + rec.visible, rec.fillComputed, JSON.stringify(rec.contrast || null), 'N', rec.N && rec.N.color, rec.N && rec.N.fontSize);
      } finally { await d.close?.(); }
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/ICON/verify-compass-needle-hex-1.json'), JSON.stringify(out, null, 1));
