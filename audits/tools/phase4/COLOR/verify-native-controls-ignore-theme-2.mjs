// Phase 4 COLOR skeptic #2: do UA-painted controls follow the OS instead of the chosen theme?
// Independent of native-controls.mjs. In the Larder frame (as Eli, iPad portrait) it measures the REAL select#size and
// input#date, plus probes: a default <button> (same CSS as F260's week-note Copy: apps/f260.html:45 + design.css:311,
// no background), a <select> with an inline author background red (does the engine honour author backgrounds on an
// appearance:auto select?), and a checkbox. Rendered background = median of inner pixels with text hidden; rendered
// text = the pixel (of those that change when text is shown) furthest in luminance from that background; contrast of both.
// Then it sets documentElement.style.colorScheme = data-scheme in the frame (an in-page experiment, no code change)
// and measures again, to test the root cause.
// Usage: node audits/tools/phase4/COLOR/verify-native-controls-ignore-theme-2.mjs [webkit|chromium|both]
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const engines = (process.argv[2] || 'both') === 'both' ? ['webkit', 'chromium'] : [process.argv[2]];
const CASES = [['hearth', 'light'], ['midnight', 'dark'], ['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark']];
const SEL = ['#size', '#date', '#vb', '#vs', '#vc'];
const out = { script: 'audits/tools/phase4/COLOR/verify-native-controls-ignore-theme-2.mjs', runs: {} };
async function measure(d, f, off) {
  const info = await f.evaluate(S => { const r = document.documentElement; return { scheme: r.dataset.scheme, theme: r.dataset.theme || 'hearth/system', colorScheme: getComputedStyle(r).colorScheme, inlineColorScheme: r.style.colorScheme,
    ctl: S.map(s => { const e = document.querySelector(s), c = getComputedStyle(e), b = e.getBoundingClientRect(); return { sel: s, color: c.color, bgDecl: c.backgroundColor, appearance: c.appearance || c.webkitAppearance, rect: [b.x, b.y, b.width, b.height] }; }) }; }, SEL);
  const shotOn = png(await d.page.screenshot({ scale: 'css' }));
  await f.evaluate(() => { const s = document.createElement('style'); s.id = 'vhide'; s.textContent = '#size,#date,#vb,#vs{color:transparent!important;-webkit-text-fill-color:transparent!important}'; document.head.append(s); });
  await sleep(200);
  const shotOff = png(await d.page.screenshot({ scale: 'css' }));
  await f.evaluate(() => document.getElementById('vhide').remove());
  for (const c of info.ctl) { const [x, y, w, h] = c.rect, bg = [], diff = [];
    for (let yy = Math.ceil(y + 3); yy < y + h - 3; yy++) for (let xx = Math.ceil(x + 3); xx < x + w * .75; xx++) { const X = Math.round(xx + off[0]), Y = Math.round(yy + off[1]); const a = shotOff.at(X, Y), b = shotOn.at(X, Y); bg.push(a); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 30) diff.push(b); }
    bg.sort((p, q) => lum(p) - lum(q)); const med = bg[bg.length >> 1] || [0, 0, 0]; c.renderedBg = hex(med);
    if (diff.length) { const t = diff.reduce((m, p) => Math.abs(lum(p) - lum(med)) > Math.abs(lum(m) - lum(med)) ? p : m); c.renderedText = hex(t); c.renderedContrast = cr(t, med); c.textPixels = diff.length; } else { c.renderedText = null; c.renderedContrast = null; c.textPixels = 0; }
    const m = (c.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number); c.computedTextVsRenderedBg = cr(m, med); }
  return info;
}
for (const engine of engines) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    for (const [theme, mode] of CASES) {
      await L.reset?.('typical');
      await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
      await d.goto('#home'); const f = await d.openApp('leftovers');
      await f.waitForFunction(() => document.querySelectorAll('select#size option').length > 0, null, { timeout: 20000 }); await sleep(1500);
      await f.evaluate(() => { const w = document.createElement('div'); w.id = 'vprobe'; w.style.cssText = 'position:fixed;left:16px;top:120px;z-index:99999;display:flex;gap:12px;align-items:center;padding:12px;background:var(--bg)';
        w.innerHTML = '<button id="vb" type="button">Copy</button><select id="vs" style="background:red;border:1px solid red"><option>Medium</option></select><input id="vc" type="checkbox">'; document.body.append(w);
        document.getElementById('size').scrollIntoView({ block: 'center' }); });
      await sleep(500);
      const off = await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
      const before = await measure(d, f, off);
      const key = `${engine}/${theme}-${mode}os`;
      if (theme === 'midnight' && mode === 'light') await d.page.screenshot({ path: path.join(EV, `verify-native-controls-ignore-theme-2-${engine}-midnight-lightos.png`), scale: 'css' });
      // root-cause experiment: resolved scheme as color-scheme
      await f.evaluate(() => { document.documentElement.style.colorScheme = document.documentElement.dataset.scheme; }); await sleep(400);
      const after = await measure(d, f, off);
      out.runs[key] = { before, afterColorSchemeFix: after };
      const fmt = i => i.ctl.map(c => `${c.sel} txt ${c.renderedText} bg ${c.renderedBg} ${c.renderedContrast ?? '-'} (computed ${c.computedTextVsRenderedBg})`).join(' | ');
      console.log(key, 'scheme', before.scheme, 'color-scheme', before.colorScheme, '\n  before:', fmt(before), '\n  fixed :', fmt(after));
      await d.close?.();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, `verify-native-controls-ignore-theme-2-${engines.join('-')}.json`), JSON.stringify(out, null, 1));
console.log('saved');
