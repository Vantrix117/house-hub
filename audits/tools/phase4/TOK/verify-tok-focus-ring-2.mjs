// Phase 4 TOK skeptic #2: re-measure the --focus ring (design.css:102) from rendered pixels, not token maths.
// In the real shell (desktop, eli), for each named palette and all ten profile swatches, a plain <button> gets real
// keyboard focus (global :focus-visible, design.css:314) and a .ds .input gets :focus (design.css:446). We screenshot and
// sample the ring pixel 1.5 px outside the button edge, the surface beside it, and the input's focused 1 px border.
//   node audits/tools/phase4/TOK/verify-tok-focus-ring-2.mjs [webkit|chromium]
//   → audits/evidence/p4/TOK/verify-tok-focus-ring-2-<engine>.json (+ one PNG of the Hearth/Eli fixture)
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUTD = path.join(ROOT, 'audits/evidence/p4/TOK');
const SW = { Eli: '#4F5D8C', Mae: '#BC5A38', Ezra: '#137F77', Kiara: '#B4861B', Elizabeth: '#8A6A4B', David: '#3D5A3D', Mea: '#5B8143', TV: '#4C4C58', 'guest-plum': '#8C4F7A', 'guest-sea': '#4C7B6A' };
const THEMES = [['hearth', null, 'light'], ['parchment', 'parchment', 'light'], ['frost', 'frost', 'light'], ['midnight', 'midnight', 'dark'], ['forest', 'forest', 'dark']];
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const hx = p => '#' + p.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const L = await local({ variant: 'typical', engine });
const rows = [];
try {
  const d = await L.device({ device: 'desktop', profile: 'eli', mode: 'light' });
  await d.goto('#home');
  await d.page.waitForTimeout(1500);
  await d.page.evaluate(() => {
    const f = document.createElement('div'); f.id = 'fx';
    f.style.cssText = 'position:fixed;left:40px;top:40px;width:400px;height:160px;z-index:2147483647;background:var(--surface);padding:40px;box-sizing:border-box;display:flex;gap:40px;align-items:flex-start';
    f.innerHTML = '<button id="fb" style="display:block;border:0;margin:0;padding:0;width:120px;height:40px;background:var(--surface)"></button><input id="fi" class="input" style="width:140px" aria-label="t">';
    document.body.appendChild(f);
  });
  for (const [id, theme, scheme] of THEMES) for (const [who, col] of Object.entries(SW)) {
    const info = await d.page.evaluate(({ theme, scheme, col }) => {
      const r = document.documentElement;
      if (theme) r.setAttribute('data-theme', theme); else r.removeAttribute('data-theme');
      r.setAttribute('data-scheme', scheme); r.style.setProperty('--accent', col);
      document.activeElement && document.activeElement.blur();
      return { focusTok: getComputedStyle(r).getPropertyValue('--focus').trim(), surface: getComputedStyle(r).getPropertyValue('--surface').trim(), line: getComputedStyle(r).getPropertyValue('--line').trim() };
    }, { theme, scheme, col });
    // button: real keyboard modality, then focus
    await d.page.keyboard.press('Shift');
    await d.page.evaluate(() => document.getElementById('fb').focus());
    const b = await d.page.evaluate(() => { const e = document.getElementById('fb'); return { fv: e.matches(':focus-visible'), bs: getComputedStyle(e).boxShadow }; });
    const bb = await d.page.locator('#fb').boundingBox();
    const clip = { x: 40, y: 40, width: 400, height: 160 };
    const png1 = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    if (id === 'hearth' && who === 'Eli') fs.writeFileSync(path.join(OUTD, `verify-tok-focus-ring-2-${engine}-hearth-eli.png`), png1);
    // input: :focus
    await d.page.evaluate(() => document.getElementById('fi').focus()); await d.page.waitForTimeout(300);
    const ib = await d.page.locator('#fi').boundingBox();
    const inf = await d.page.evaluate(() => { const e = document.getElementById('fi'); const s = getComputedStyle(e); return { bs: s.boxShadow, border: s.borderTopColor }; });
    const png2 = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    // decode pixels in-page via canvas
    const px = await d.page.evaluate(async ({ a, b, pts }) => {
      const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x; };
      const [A, B] = [await load(a), await load(b)];
      return pts.map(([w, x, y]) => Array.from((w ? B : A).getImageData(Math.floor(x), Math.floor(y), 1, 1).data));
    }, { a: png1.toString('base64'), b: png2.toString('base64'), pts: [
      [0, bb.x - 40 - 1.5, bb.y - 40 + bb.height / 2],   // ring, 1.5 px left of the button
      [0, bb.x - 40 + bb.width / 2, bb.y - 40 - 1.5],    // ring, above
      [0, 10, 10],                                        // surface
      [1, ib.x - 40 - 1.5, ib.y - 40 + ib.height / 2],   // input ring
      [1, Math.floor(ib.x - 40) + 0.2, ib.y - 40 + ib.height / 2],   // input focused border (1 px)
    ] });
    const [ring, ringTop, surf, iring, iborder] = px;
    rows.push({ theme: id, accent: who, color: col, buttonFocusVisible: b.fv, buttonBoxShadow: b.bs, surface: hx(surf), ring: hx(ring), ringTop: hx(ringTop),
      ringVsSurface: cr(ring, surf), inputRing: hx(iring), inputRingVsSurface: cr(iring, surf), inputBorder: hx(iborder), inputBorderVsSurface: cr(iborder, surf), inputBorderComputed: inf.border, lineToken: info.line });
  }
} finally { await L.close(); }
const fails = rows.filter(r => r.ringVsSurface < 3);
const summ = { engine, cases: rows.length, ringUnder3: fails.length, ringMin: Math.min(...rows.map(r => r.ringVsSurface)), ringMax: Math.max(...rows.map(r => r.ringVsSurface)),
  focusVisibleAll: rows.every(r => r.buttonFocusVisible), inputBorderUnder3: rows.filter(r => r.inputBorderVsSurface < 3).length,
  byTheme: Object.fromEntries(THEMES.map(([t]) => { const rs = rows.filter(r => r.theme === t); return [t, { min: Math.min(...rs.map(r => r.ringVsSurface)), max: Math.max(...rs.map(r => r.ringVsSurface)), inputBorderMin: Math.min(...rs.map(r => r.inputBorderVsSurface)), inputBorderMax: Math.max(...rs.map(r => r.inputBorderVsSurface)) }]; })) };
fs.writeFileSync(path.join(OUTD, `verify-tok-focus-ring-2-${engine}.json`), JSON.stringify({ summary: summ, rows }, null, 1));
console.log(JSON.stringify(summ, null, 1));
