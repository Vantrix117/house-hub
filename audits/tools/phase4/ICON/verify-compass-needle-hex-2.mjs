// Phase 4 ICON skeptic #2: the park map's compass north needle (#lv-north, fill="#FF6B4A") contrast per theme.
// For each engine x theme: open dollywood-live on iphone-pwa as Eli (theme set as Eli's person pref + localStorage),
// read the button's computed paint, screenshot with and without the needle/label painted, and measure
//   needle   = median rendered pixel inside the north path (eroded isPointInFill) vs the median background there with the svg hidden
//   south    = the south half (currentColor at .55) vs the same background, and needle vs south half (adjacent colour)
//   label    = the 9 px "N" (<b>, color var(--danger)) vs its background
// Chromium (installed Chrome) paints backdrop-filter; WebKit on Windows does not, so both are run. Local rig only.
//   node audits/tools/phase4/ICON/verify-compass-needle-hex-2.mjs [webkit,chromium] [themes]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ENGINES = (process.argv[2] || 'webkit,chromium').split(',');
const THEMES = (process.argv[3] || 'hearth,parchment,frost,midnight,forest').split(',');
const OUT = path.resolve('audits/evidence/p4/ICON');
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

const SAMPLE = async ([visB64, hidB64, regions]) => {
  const load = async b => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b)).blob()); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
  const V = await load(visB64), H = await load(hidB64);
  const med = arr => { if (!arr.length) return null; const ch = i => arr.map(p => p[i]).sort((a, b) => a - b)[arr.length >> 1]; return [ch(0), ch(1), ch(2)]; };
  const px = (I, x, y) => { const i = (y * I.width + x) * 4; return [I.data[i], I.data[i + 1], I.data[i + 2]]; };
  const out = {};
  for (const [k, pts] of Object.entries(regions)) {
    const v = [], h = [];
    for (const [x, y] of pts) { if (x < 0 || y < 0 || x >= V.width || y >= V.height) continue; v.push(px(V, x, y)); h.push(px(H, x, y)); }
    out[k] = { n: v.length, fg: med(v), bg: med(h) };
  }
  return out;
};

const result = { script: 'audits/tools/phase4/ICON/verify-compass-needle-hex-2.mjs', runs: [] };
for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    for (const theme of THEMES) {
      const mode = ['midnight', 'forest'].includes(theme) ? 'dark' : 'light';
      await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } });
      const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
      try {
        const f = await d.openApp('dollywood-live'); await sleep(5000);
        const info = await f.evaluate(() => {
          const b = document.getElementById('lv-north'); const svg = b.querySelector('svg'); const [pn, ps] = svg.querySelectorAll('path'); const lab = b.querySelector('b');
          const cs = getComputedStyle(b), r = b.getBoundingClientRect();
          const pts = (p) => {
            const inv = p.getScreenCTM().inverse(); const bb = p.getBoundingClientRect(); const o = []; const pt = svg.createSVGPoint();
            for (let y = Math.floor(bb.top); y <= bb.bottom; y++) for (let x = Math.floor(bb.left); x <= bb.right; x++) {
              let ok = true;
              for (const [dx, dy] of [[0.5, 0.5], [-0.5, 0.5], [1.5, 0.5], [0.5, -0.5], [0.5, 1.5]]) { pt.x = x + dx; pt.y = y + dy; const q = pt.matrixTransform(inv); if (!p.isPointInFill(q)) { ok = false; break; } }
              if (ok) o.push([x, y]);
            }
            return o;
          };
          const lr = lab.getBoundingClientRect();
          const labPts = []; for (let y = Math.floor(lr.top); y < lr.bottom; y++) for (let x = Math.floor(lr.left); x < lr.right; x++) labPts.push([x, y]);
          return {
            theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, flavor: document.documentElement.dataset.flavor,
            shown: getComputedStyle(b.parentElement).display !== 'none', rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            btnColor: cs.color, backdrop: cs.backdropFilter || cs.webkitBackdropFilter, transform: b.style.transform || cs.transform,
            northFill: pn.getAttribute('fill'), northComputed: getComputedStyle(pn).fill, southComputed: getComputedStyle(ps).fill, southOpacity: getComputedStyle(ps).opacity,
            labelColor: getComputedStyle(lab).color, labelSize: getComputedStyle(lab).fontSize, labelWeight: getComputedStyle(lab).fontWeight,
            glass: getComputedStyle(document.documentElement).getPropertyValue('--glass').trim(), danger: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
            northPts: pts(pn), southPts: pts(ps), labPts,
            aria: { pressed: b.getAttribute('aria-pressed'), title: b.title, label: b.getAttribute('aria-label') },
            upright: (document.getElementById('l-upright') || {}).checked,
          };
        });
        const fe = await f.frameElement(); const bb = await fe.boundingBox(); const iw = await f.evaluate(() => innerWidth); const s = bb.width / iw;
        const map = a => a.map(([x, y]) => [Math.round(bb.x + x * s), Math.round(bb.y + y * s)]);
        const regions = { north: map(info.northPts), south: map(info.southPts), label: map(info.labPts) };
        const vis = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
        await f.evaluate(() => { const b = document.getElementById('lv-north'); b.querySelector('svg').style.visibility = 'hidden'; b.querySelector('b').style.visibility = 'hidden'; }); await sleep(80);
        const hid = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
        await f.evaluate(() => { const b = document.getElementById('lv-north'); b.querySelector('svg').style.visibility = ''; b.querySelector('b').style.visibility = ''; });
        const S = await d.page.evaluate(SAMPLE, [vis.toString('base64'), hid.toString('base64'), regions]);
        if (['parchment', 'midnight'].includes(theme)) {
          const r = info.rect; const clip = { x: Math.max(0, bb.x + r.x * s - 10), y: Math.max(0, bb.y + r.y * s - 10), width: r.w * s + 20, height: r.h * s + 20 };
          await d.page.screenshot({ path: path.join(OUT, `verify-compass-needle-hex-2-${engine}-${theme}.png`), clip, scale: 'css' });
        }
        const lc = (info.labelColor.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const row = {
          engine, theme, applied: { theme: info.theme, scheme: info.scheme, flavor: info.flavor }, shown: info.shown, rect: info.rect, transform: info.transform, upright: info.upright,
          backdrop: info.backdrop, glass: info.glass, danger: info.danger, btnColor: info.btnColor, northFill: info.northFill, northComputed: info.northComputed, southComputed: info.southComputed, southOpacity: info.southOpacity,
          label: { color: info.labelColor, size: info.labelSize, weight: info.labelWeight }, aria: info.aria,
          samples: S,
          contrast: {
            needle_vs_bg: S.north.fg && S.north.bg ? cr(S.north.fg, S.north.bg) : null,
            declaredNeedle_vs_bg: S.north.bg ? cr([255, 107, 74], S.north.bg) : null,
            south_vs_bg: S.south.fg && S.south.bg ? cr(S.south.fg, S.south.bg) : null,
            needle_vs_south: S.north.fg && S.south.fg ? cr(S.north.fg, S.south.fg) : null,
            labelDeclared_vs_bg: lc.length === 3 && S.label.bg ? cr(lc, S.label.bg) : null,
          },
        };
        result.runs.push(row);
        console.log(engine, theme, JSON.stringify({ applied: row.applied, shown: row.shown, n: S.north.n, needle: S.north.fg, bg: S.north.bg, c: row.contrast, label: row.label, backdrop: row.backdrop, transform: row.transform }));
      } catch (e) { console.log(engine, theme, 'ERROR', String(e && e.stack || e).slice(0, 400)); result.runs.push({ engine, theme, error: String(e && e.message || e) }); }
      await d.close();
    }
  } finally { await L.close(); }
}
const file = path.join(OUT, 'verify-compass-needle-hex-2.json');
fs.writeFileSync(file, JSON.stringify(result, null, 1));
console.log('wrote', path.relative(process.cwd(), file));
