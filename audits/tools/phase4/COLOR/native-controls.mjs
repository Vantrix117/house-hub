// Phase 4 COLOR: do UA-painted controls follow the chosen theme? design.css:15 fixes `color-scheme: light dark` and
// hub.js applyTheme (apps/hub.js:74-82) never sets the resolved scheme as color-scheme, so native selects, default
// buttons, date fields and checkboxes follow the OS, while their text inherits the theme's --text (design.css:311).
// For each engine x (theme, OS mode) it opens the Larder as Eli, reads select#size / input#date, and appends three
// probes (a default <button>, a <select>, a checkbox) to the Larder frame, then samples the rendered pixels.
// Usage: node audits/tools/phase4/COLOR/native-controls.mjs [webkit|chromium|both]
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
// minimal PNG decoder (8-bit RGBA/RGB, non-interlaced) for the page screenshot
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const engines = (process.argv[2] || 'both') === 'both' ? ['webkit', 'chromium'] : [process.argv[2]];
const CASES = [['system', 'light'], ['system', 'dark'], ['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark']];
const out = { note: 'Per engine/theme/OS mode: the computed text colour and the rendered background (median of the control\'s inner pixels, text hidden) of each native control in the Larder frame, and their contrast. colorScheme = computed color-scheme on the frame root.', runs: {} };
for (const engine of engines) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    for (const [theme, mode] of CASES) {
      await L.reset?.('typical');
      if (theme !== 'system') await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
      await d.goto('#home'); const f = await d.openApp('leftovers');
      await f.waitForFunction(() => document.querySelectorAll('select#size option').length > 0, null, { timeout: 20000 }); await sleep(1500);
      await f.evaluate(() => { const w = document.createElement('div'); w.id = 'probe'; w.style.cssText = 'position:fixed;left:16px;top:120px;z-index:99999;display:flex;gap:12px;align-items:center;padding:12px;background:var(--bg)';
        w.innerHTML = '<button id="pb">Copy</button><select id="ps"><option>Medium</option></select><input id="pc" type="checkbox"><input id="pt" type="text" placeholder="Placeholder">'; document.body.append(w);
        document.getElementById('size').scrollIntoView({ block: 'center' }); });
      await sleep(400);
      const info = await f.evaluate(() => { const r = document.documentElement, cs = getComputedStyle(r); const q = s => { const e = document.querySelector(s), c = getComputedStyle(e), b = e.getBoundingClientRect(); return { sel: s, color: c.color, bgDecl: c.backgroundColor, appearance: c.appearance || c.webkitAppearance, rect: [b.x, b.y, b.width, b.height] }; };
        return { theme: r.dataset.theme || 'system', scheme: r.dataset.scheme, colorScheme: cs.colorScheme, bg: getComputedStyle(document.body).backgroundColor, ctl: ['#size', '#date', '#pb', '#ps', '#pc', '#pt'].map(q) }; });
      const off = await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
      // hide text to sample the painted control background
      await f.evaluate(() => { const s = document.createElement('style'); s.id = 'hide'; s.textContent = '#size,#date,#pb,#ps,#pt{color:transparent!important;-webkit-text-fill-color:transparent!important}#pt::placeholder{color:transparent!important}'; document.head.append(s); });
      await sleep(150);
      const img = png(await d.page.screenshot({ scale: 'css' }));
      await f.evaluate(() => document.getElementById('hide').remove());
      for (const c of info.ctl) { const [x, y, w, h] = c.rect; const px = []; for (let yy = Math.ceil(y + h * .3); yy < y + h * .7; yy += 2) for (let xx = Math.ceil(x + 6); xx < x + w * .6; xx += 2) px.push(img.at(Math.round(xx + off[0]), Math.round(yy + off[1])));
        px.sort((a, b) => lum(a) - lum(b)); const med = px[px.length >> 1] || [0, 0, 0]; c.renderedBg = '#' + med.map(v => v.toString(16).padStart(2, '0')).join(''); c.contrast = cr(rgb(c.color), med); }
      const key = `${engine}/${theme}-${mode}os`; out.runs[key] = info;
      console.log(key, 'scheme', info.scheme, 'color-scheme', info.colorScheme, info.ctl.map(c => `${c.sel} ${c.color}→${c.renderedBg} ${c.contrast}`).join(' | '));
      if ((theme === 'midnight' && mode === 'light') || (theme === 'parchment' && mode === 'dark')) await d.page.screenshot({ path: path.join(EV, `native-controls-${engine}-${theme}-${mode}os.png`), scale: 'css', clip: { x: 0, y: 0, width: 820, height: 1180 } });
      await d.close?.();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'native-controls.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p4/COLOR/native-controls.json');
