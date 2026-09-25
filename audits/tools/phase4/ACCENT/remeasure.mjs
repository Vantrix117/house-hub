// Phase 4 ACCENT — independent re-measurement of the investigator's key numbers (does not import any ACCENT/* script).
//
//   node audits/tools/phase4/ACCENT/remeasure.mjs <part> [<part> …]
//   parts: tokens (browser-resolved tokens + own colour math) · apps (apps.json/seed vs people) · prayer · park · me ·
//          kids · timer · pin · recolour · all
//
// Method (deliberately different from the investigator's runtime.mjs/matrix.mjs):
//  - Tokens: a bare page that loads only apps/design.css from the local site; each theme key is made by data-theme +
//    emulated prefers-color-scheme exactly as hub.js applyTheme() would (apps/hub.js:73-82); --accent set inline on <html>.
//    Values are read back through getComputedStyle and compared with this script's own sRGB color-mix derivation.
//  - Rendered: the local rig (audits/tools/lib/local.mjs), iPad portrait, WebKit. The theme is set as the profile through
//    PUT /api/data/hub/theme?scope=person plus localStorage hub.theme. Ink = the element's computed colour (after ancestor
//    opacity); background = the median pixel of a 1x CSS screenshot of the element's box taken with the ink made
//    transparent (text) or the graphic hidden (strokes, rings). Contrast = WCAG 2.x.
// Output: audits/evidence/p4/ACCENT/remeasure-<part>.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const save = (part, obj) => { const f = path.join(OUT, `remeasure-${part}.json`); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); console.log('wrote', path.relative(ROOT, f)); };

// ── colour math ─────────────────────────────────────────────────────────────────────────────────────────────────
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function parseCss(s) {
  s = String(s).trim();
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
  m = s.match(/^color\(srgb\s+([^)]+)\)$/);
  if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]]; }
  if (/^#[0-9a-f]{6}$/i.test(s)) return [...hex2(s), 1];
  throw new Error('unparsed colour ' + s);
}
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = v => Math.round(v * 100) / 100;
const over = (fg, a, bg) => [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
const mix = (a, p, b) => [0, 1, 2].map(i => a[i] * p + b[i] * (1 - p));       // color-mix(in srgb, a p, b)
function oklab(c) {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const okC = c => { const [, a, b] = oklab(c); return Math.hypot(a, b); };
function lab(c) {
  const [r, g, b] = c.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de00(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1 = hp(b1, ap1), h2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0; if (Cp1 * Cp2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2);
  const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = h1 + h2; if (Cp1 * Cp2 !== 0) { if (Math.abs(h1 - h2) > 180) hb += (h1 + h2 < 360 ? 360 : -360); hb /= 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cpb, Sh = 1 + 0.015 * Cpb * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
// Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear RGB
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const cvd = (c, k) => { const l = c.slice(0, 3).map(lin), M = MACHADO[k]; return M.map(row => unlin(Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])))); };

// ── people and theme keys ───────────────────────────────────────────────────────────────────────────────────────
const HOUSE = { eli: ['Eli', '#4F5D8C'], christian: ['Mae', '#BC5A38'], ezra: ['Ezra', '#137F77'], kiara: ['Kiara', '#B4861B'], mom: ['Elizabeth', '#8A6A4B'], dad: ['David', '#3D5A3D'], niece: ['Mea', '#5B8143'], tv: ['Downstairs TV', '#4C4C58'] };
const EXTRA = { sw9: ['Swatch 9', '#8C4F7A'], sw10: ['Swatch 10', '#4C7B6A'], theo: ['Theo (overflow guest)', '#1F6FB2'] };
const KEYS = {
  'system-light': { theme: 'system', mode: 'light' }, 'hearth-dark': { theme: 'hearth', mode: 'dark' }, parchment: { theme: 'parchment', mode: 'light' },
  frost: { theme: 'frost', mode: 'light' }, midnight: { theme: 'midnight', mode: 'dark' }, forest: { theme: 'forest', mode: 'dark' }, 'system-dark': { theme: 'system', mode: 'dark' },
};
const DARKKEYS = ['hearth-dark', 'midnight', 'forest', 'system-dark'];
// design.css derivation (apps/design.css:87-89 and each theme block): deep = accent p% with black (light) / white (dark)
const DEEP = { 'system-light': [0.72, [0, 0, 0]], frost: [0.72, [0, 0, 0]], parchment: [0.66, [0, 0, 0]], 'hearth-dark': [0.58, [255, 255, 255]], midnight: [0.58, [255, 255, 255]], forest: [0.58, [255, 255, 255]], 'system-dark': [0.58, [255, 255, 255]] };

// ── PNG decode (8-bit, non-interlaced RGB/RGBA as Playwright writes) ──────────────────────────────────────────────
function decodePng(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12]) throw new Error('png format'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('png colour type ' + ct); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - stride + x] : 0, c = x >= bpp && y ? out[o - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + x] = v & 255;
    }
  }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
const median = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medColour = list => [0, 1, 2].map(i => median(list.map(c => c[i])));

// ── rendered measurement ────────────────────────────────────────────────────────────────────────────────────────
async function boxShot(page, box, pad = 0) {
  const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y - pad)), width: Math.ceil(box.width + 2 * pad), height: Math.ceil(box.height + 2 * pad) };
  return { clip, img: decodePng(await page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' })) };
}
/** Text: ink = computed colour × ancestor opacity; bg = median pixel of the box with the ink transparent. */
async function textContrast(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const info = await loc.evaluate(el => {
    const cs = getComputedStyle(el); let op = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    return { color: cs.color, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), fontSize: cs.fontSize, fontWeight: cs.fontWeight, opacity: op };
  });
  const colour = info.color;
  await loc.evaluate(el => {
    for (const e of [el, ...el.querySelectorAll('*')]) {
      e.setAttribute('data-rm-style', e.getAttribute('style') || '');
      for (const [k, v] of [['transition', 'none'], ['color', 'transparent'], ['-webkit-text-fill-color', 'transparent'], ['text-shadow', 'none']]) e.style.setProperty(k, v, 'important');
    }
  });
  await sleep(80);
  const box = await loc.boundingBox();
  const { img } = await boxShot(page, box);
  await loc.evaluate(el => { for (const e of [el, ...el.querySelectorAll('*')]) { e.setAttribute('style', e.getAttribute('data-rm-style')); e.removeAttribute('data-rm-style'); } });
  const all = []; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) all.push(img.px(x, y));
  const bg = medColour(all), fg0 = parseCss(colour), fg = over(fg0, fg0[3] * info.opacity, bg);
  return { text: info.text, fontSize: info.fontSize, fontWeight: info.fontWeight, ink: toHex(fg0), inkAlpha: fg0[3] * info.opacity, bg: toHex(bg), ratio: r2(cr(fg, bg)) };
}
/** Graphic: colour given (or read by fn), bg = median pixel of the box with the element hidden (optionally an annulus). */
async function graphicContrast(page, loc, { read, hide = 'self', ring = null } = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const colour = await loc.evaluate(read);
  const box = await loc.boundingBox();
  await loc.evaluate((el, h) => { const t = h === 'parent' ? el.parentElement : el; t.setAttribute('data-rm-vis', t.style.visibility || ''); t.style.visibility = 'hidden'; }, hide);
  await sleep(60);
  const pad = ring ? ring.outer + 1 : 0;
  const { clip, img } = await boxShot(page, box, pad);
  await loc.evaluate((el, h) => { const t = h === 'parent' ? el.parentElement : el; t.style.visibility = t.getAttribute('data-rm-vis'); t.removeAttribute('data-rm-vis'); }, hide);
  const cx = box.x + box.width / 2 - clip.x, cy = box.y + box.height / 2 - clip.y, r = box.width / 2;
  const list = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (ring) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r; if (d < ring.inner || d > ring.outer) continue; }
    list.push(img.px(x, y));
  }
  const bg = medColour(list), fg = parseCss(colour);
  return { ink: toHex(fg), bg: toHex(bg), ratio: r2(cr(fg, bg)), n: list.length };
}

async function setTheme(L, profile, key) {
  const { theme, mode } = KEYS[key];
  if (profile && profile !== 'tv') { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status !== 200) throw new Error('theme put ' + r.status + JSON.stringify(r.body)); }
  return { mode, localStorage: theme === 'system' ? {} : { 'hub.theme': JSON.stringify(theme) } };
}
async function dev(L, profile, key, extra = {}) {
  const { mode, localStorage } = await setTheme(L, profile, key);
  const d = await L.device({ device: 'ipad-portrait', mode, profile, localStorage: { ...localStorage, ...(extra.localStorage || {}) } });
  return d;
}
async function checkTheme(frame) { return frame.evaluate(() => ({ theme: document.documentElement.dataset.theme || '(none)', scheme: document.documentElement.dataset.scheme, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() })); }

// ── parts ───────────────────────────────────────────────────────────────────────────────────────────────────────
const parts = {
  async tokens(L) {
    const ctx = await L.browser.newContext(); const p = await ctx.newPage();
    await p.goto(L.site + '/apps/design.css');
    await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${L.site}/apps/design.css"></head><body><i id="pr"></i></body></html>`, { waitUntil: 'load' });
    const NAMES = ['surface', 'bg', 'glass-strong', 'muted', 'text', 'accent', 'accent-soft', 'accent-tint', 'accent-deep', 'on-accent', 'mocha-soft', 'gold-soft', 'olive-soft', 'teal-soft', 'terra-soft', 'slate-soft'];
    const res = {};
    for (const [key, K] of Object.entries(KEYS)) {
      await p.emulateMedia({ colorScheme: K.mode });
      res[key] = {};
      for (const [id, [name, hex]] of Object.entries({ ...HOUSE, ...EXTRA })) {
        res[key][id] = await p.evaluate(({ theme, hex, NAMES }) => {
          const r = document.documentElement; if (theme === 'system' || theme === 'hearth') delete r.dataset.theme; else r.dataset.theme = theme;
          r.style.setProperty('--accent', hex);
          const pr = document.getElementById('pr'), o = {};
          for (const n of NAMES) { pr.style.color = `var(--${n})`; o[n] = getComputedStyle(pr).color; }
          return o;
        }, { theme: K.theme, hex, NAMES });
      }
    }
    await ctx.close();
    const C = (key, id, n) => parseCss(res[key][id][n]);
    // 1. derivation vs browser
    let maxDiff = 0, checks = 0; const worst = [];
    for (const key of Object.keys(KEYS)) for (const [id, [, hex]] of Object.entries({ ...HOUSE, ...EXTRA })) {
      const a = hex2(hex), s = C(key, id, 'surface');
      const mine = { 'accent-soft': mix(a, 0.14, s), 'accent-tint': mix(a, 0.26, s), 'accent-deep': mix(a, DEEP[key][0], DEEP[key][1]) };
      for (const [n, v] of Object.entries(mine)) { const b = C(key, id, n); const d = Math.max(...[0, 1, 2].map(i => Math.abs(Math.round(v[i]) - b[i]))); checks++; if (d > maxDiff) maxDiff = d; if (d > 1) worst.push({ key, id, n, mine: toHex(v), browser: toHex(b) }); }
    }
    // 2. raw on surface; 17. deep pairs; herobtn; selection; indicator
    const HH = Object.keys(HOUSE), ALL = Object.keys({ ...HOUSE, ...EXTRA });
    const grid = (fn, ids) => { const v = []; for (const key of Object.keys(KEYS)) for (const id of ids) v.push({ key, id, v: fn(key, id) }); return v; };
    const summ = (cells, need) => ({ n: cells.length, fail: cells.filter(c => c.v < need).length, min: r2(Math.min(...cells.map(c => c.v))), max: r2(Math.max(...cells.map(c => c.v))) });
    const rawSurf = (k, id) => cr(C(k, id, 'accent'), C(k, id, 'surface'));
    const rawSurfAll = grid(rawSurf, ALL);
    const passAll = ALL.filter(id => rawSurfAll.filter(c => c.id === id).every(c => c.v >= 4.5));
    const deepSurf = grid((k, id) => cr(C(k, id, 'accent-deep'), C(k, id, 'surface')), ALL);
    const deepSoft = grid((k, id) => cr(C(k, id, 'accent-deep'), C(k, id, 'accent-soft')), ALL);
    const onDeep = grid((k, id) => cr(C(k, id, 'on-accent'), C(k, id, 'accent-deep')), ALL);
    const heroBtn = grid((k, id) => cr(C(k, id, 'accent-deep'), over([255, 255, 255], 0.92, C(k, id, 'accent'))), HH);
    const sel = grid((k, id) => { const a = lum(C(k, id, 'accent-deep')), b = lum(C(k, id, 'muted')); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }, ALL);
    const selDavidDark = sel.filter(c => c.id === 'dad' && DARKKEYS.includes(c.key)).map(c => r2(c.v));
    const davidDarkDeutan = DARKKEYS.map(k => r2(de00(cvd(C(k, 'dad', 'accent-deep'), 'deutan'), cvd(C(k, 'dad', 'muted'), 'deutan'))));
    const ind = grid((k, id) => { const gs = C(k, id, 'glass-strong'); const bar = over(gs, gs[3], C(k, id, 'bg')); return cr(C(k, id, 'accent-soft'), bar); }, HH);
    const softSurf = grid((k, id) => cr(C(k, id, 'accent-soft'), C(k, id, 'surface')), HH);
    // 12. soft chroma in Hearth (system-light)
    const softC = Object.fromEntries(ALL.map(id => [id, { soft: toHex(C('system-light', id, 'accent-soft')), C: +okC(C('system-light', id, 'accent-soft')).toFixed(3) }]));
    const houseFill = Object.fromEntries(['mocha', 'gold', 'olive', 'teal', 'terra', 'slate'].map(n => [n + '-soft (design.css)', +okC(C('system-light', 'eli', n + '-soft')).toFixed(3)]));
    // the HOUSE STYLE pastel fills (audits/HUB-AUDIT-PROMPT.md, "Color — vibrant pastel" list)
    const prompt = fs.readFileSync(path.join(ROOT, 'audits/HUB-AUDIT-PROMPT.md'), 'utf8');
    for (const m of prompt.matchAll(/^\s+([A-Z][a-z]+)\s+(#[0-9A-Fa-f]{6})\s*\/\s*(#[0-9A-Fa-f]{6})/gm)) houseFill['HOUSE ' + m[1] + ' ' + m[2]] = +okC(hex2(m[2])).toFixed(3);
    // 13./14. pairs among the 7 people (TV excluded)
    const PEOPLE = HH.filter(id => id !== 'tv'); const pairs = [];
    for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) {
      const a = PEOPLE[i], b = PEOPLE[j], A = hex2(HOUSE[a][1]), B = hex2(HOUSE[b][1]);
      pairs.push({ pair: HOUSE[a][0] + '/' + HOUSE[b][0], normal: de00(A, B), protan: de00(cvd(A, 'protan'), cvd(B, 'protan')), deutan: de00(cvd(A, 'deutan'), cvd(B, 'deutan')), tritan: de00(cvd(A, 'tritan'), cvd(B, 'tritan')),
        softHearth: de00(C('system-light', a, 'accent-soft'), C('system-light', b, 'accent-soft')), softMidnight: de00(C('midnight', a, 'accent-soft'), C('midnight', b, 'accent-soft')),
        okDeutan: 100 * Math.hypot(...oklab(cvd(A, 'deutan')).map((v, k) => v - oklab(cvd(B, 'deutan'))[k])) });
    }
    const minOf = k => { const s = [...pairs].sort((x, y) => x[k] - y[k])[0]; return { pair: s.pair, v: r2(s[k]) }; };
    const out = {
      derivation: { checks, maxDiff255: maxDiff, worst: worst.slice(0, 10) },
      rawOnSurface: { household: summ(rawSurfAll.filter(c => HH.includes(c.id)), 4.5), all: summ(rawSurfAll, 4.5), coloursPassingAll7: passAll,
        table: Object.fromEntries(ALL.map(id => [id, Object.fromEntries(rawSurfAll.filter(c => c.id === id).map(c => [c.key, r2(c.v)]))])) },
      deepPairs: { deepSurface: summ(deepSurf, 4.5), deepSoft: summ(deepSoft, 4.5), onDeep: summ(onDeep, 4.5) },
      heroButtonToken: { household: summ(heroBtn, 4.5), darkHousehold: summ(heroBtn.filter(c => DARKKEYS.includes(c.key)), 4.5) },
      selection: { all: { min: r2(Math.min(...sel.map(c => c.v))), max: r2(Math.max(...sel.map(c => c.v))) }, davidDark: selDavidDark, davidDarkDeutanDE00: davidDarkDeutan },
      tabIndicatorVsGlassBar: summ(ind, 3), softVsSurface: summ(softSurf, 3),
      softChromaHearth: softC, houseFillChroma: houseFill,
      softPairsHearth: { min: minOf('softHearth'), under5: pairs.filter(p => p.softHearth < 5).length, of: pairs.length }, softPairsMidnight: { min: minOf('softMidnight'), under5: pairs.filter(p => p.softMidnight < 5).length },
      cvd: { normal: minOf('normal'), protan: minOf('protan'), deutan: minOf('deutan'), tritan: minOf('tritan'), okDeutanElizabethMea: r2(pairs.find(p => p.pair === 'Elizabeth/Mea').okDeutan) },
      pairs: pairs.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]))),
      resolved: res,
    };
    save('tokens', out);
    return out;
  },

  async apps() {
    const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
    const people = { ...HOUSE, ...EXTRA };
    const rows = apps.map(a => { const near = Object.entries(people).map(([id, [n, h]]) => ({ id, n, h, d: de00(hex2(a.color), hex2(h)) })).sort((x, y) => x.d - y.d)[0]; return { app: a.id, color: a.color, nearest: near.n, nearestHex: near.h, de00: r2(near.d) }; });
    const out = { rows, identicalToHousehold: rows.filter(r => r.de00 === 0 && Object.values(HOUSE).some(([, h]) => h.toUpperCase() === r.color.toUpperCase())).map(r => r.app + '=' + r.nearest), apps: apps.length };
    save('apps', out); return out;
  },

  async prayer(L) {
    const jobs = process.env.RM_PRAYER ? process.env.RM_PRAYER.split(',').map(s => s.split(':')) : [['eli', 'midnight'], ['eli', 'system-light'], ['eli', 'parchment'], ['mom', 'parchment'], ['mom', 'system-dark'], ['mom', 'system-light']];
    const out = [];
    for (const [who, key] of jobs) {
      const d = await dev(L, who, key);
      try {
        await d.goto('');
        await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 8000 }).catch(() => {});
        const f = await d.openApp('prayer', { wait: '#todayLine:not(:empty)' });
        await f.locator('#moreBtn').tap(); await f.waitForSelector('#sheet.on', { timeout: 5000 });
        await f.locator('[data-more="kitchen"]').tap(); await f.waitForSelector('#kitchen.on', { timeout: 5000 }); await sleep(600);
        const th = await checkTheme(f);
        const n = await f.locator('#kitchenBody > .k-cat').count();
        const m = [];
        for (let i = 0; i < Math.min(n, 3); i++) m.push(await textContrast(d.page, f.locator('#kitchenBody > .k-cat').nth(i)));
        out.push({ who, key, th, count: n, min: Math.min(...m.map(x => x.ratio)), m });
      } catch (e) { out.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    save('prayer', out); return out;
  },

  async park(L) {
    await L.reset('park');
    const out = { nearby: [], tabIcon: [], rideCard: [] };
    const openMap = async d => {
      const f = await d.openApp('dollywood-live');
      await f.waitForSelector('#lv-pill[data-state]', { timeout: 12000 });
      await f.waitForSelector('.lv-wait', { state: 'attached', timeout: 5000 }).catch(() => {});
      await sleep(400); return f;
    };
    const place = async f => {
      await f.locator('#loc-place').tap(); await sleep(300); await f.locator('#lv-act').tap();
      await f.waitForFunction(() => !['placing', 'idle', 'searching', 'denied'].includes(document.getElementById('lv-pill').dataset.state), null, { timeout: 4000, polling: 100 }).catch(() => {});
      await sleep(300);
    };
    const near = async f => { await f.locator('#loc-near').tap(); await f.waitForSelector('#lv-sheet[data-state="half"]', { timeout: 4000 }).catch(() => {}); await sleep(600); };
    for (const [who, key] of [['dad', 'system-dark'], ['eli', 'midnight'], ['christian', 'system-light'], ['niece', 'forest']]) {
      const d = await dev(L, who, key);
      try {
        const f = await openMap(d); await place(f); await near(f);
        const th = await checkTheme(f);
        const loc = f.locator('button.lv-item .d small');
        const n = await loc.count(); const m = [];
        for (let i = 0; i < Math.min(n, 3); i++) m.push(await textContrast(d.page, loc.nth(i)));
        const ic = await graphicContrast(d.page, f.locator('#loc-near svg'), { read: el => getComputedStyle(el).stroke });
        out.nearby.push({ who, key, th, count: n, min: n ? Math.min(...m.map(x => x.ratio)) : null, m });
        out.tabIcon.push({ who, key, pressed: await f.locator('#loc-near').getAttribute('aria-pressed'), ...ic });
      } catch (e) { out.nearby.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    for (const [who, key] of [['kiara', 'system-light'], ['kiara', 'frost'], ['eli', 'system-light']]) {
      const d = await dev(L, who, key);
      try {
        const f = await openMap(d); await near(f);
        const ic = await graphicContrast(d.page, f.locator('#loc-near svg'), { read: el => getComputedStyle(el).stroke });
        out.tabIcon.push({ who, key, th: await checkTheme(f), pressed: await f.locator('#loc-near').getAttribute('aria-pressed'), ...ic });
      } catch (e) { out.tabIcon.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    for (const [who, key] of [['eli', 'midnight'], ['eli', 'system-light']]) {
      const d = await dev(L, who, key);
      try {
        const f = await openMap(d); await place(f);
        await f.locator('#lv-search').tap(); await sleep(500);
        await f.locator('#q').fill('Thunderhead');
        await f.waitForSelector('#tab-list .oi[data-n="28"]', { timeout: 4000 });
        await f.locator('#tab-list .oi[data-n="28"]').tap();
        await f.waitForSelector('#pop.show .pop-head', { timeout: 5000 }).catch(() => {}); await sleep(1200);
        const loc = f.locator('.lv-from b');
        out.rideCard.push({ who, key, count: await loc.count(), ...(await loc.count() ? await textContrast(d.page, loc.first()) : {}) });
      } catch (e) { out.rideCard.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    await L.reset('typical');
    save('park', out); return out;
  },

  async me(L) {
    const out = [];
    for (const [who, key] of [['niece', 'midnight'], ['christian', 'forest'], ['mom', 'system-dark'], ['eli', 'midnight'], ['dad', 'hearth-dark'], ['eli', 'system-light'], ['dad', 'parchment']]) {
      const d = await dev(L, who, key);
      try {
        await d.goto('#me'); await d.page.waitForSelector('#view-me .me-hero', { timeout: 8000 }); await sleep(800);
        out.push({ who, key, th: await checkTheme(d.page), ...(await textContrast(d.page, d.page.locator('#switch'))) });
      } catch (e) { out.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    save('me', out); return out;
  },

  async kids(L) {
    const out = [];
    for (const [who, key] of [['eli', 'parchment'], ['eli', 'frost'], ['eli', 'system-light'], ['mom', 'parchment']]) {
      const d = await dev(L, who, key);
      try {
        await d.goto('#home'); await d.page.waitForSelector('.kid-chip', { timeout: 8000 }); await sleep(800);
        const chip = d.page.locator('.kid-chip', { hasText: 'Kiara' }).first();
        const av = chip.locator('span.avatar').first();
        const read = el => getComputedStyle(el).getPropertyValue('--tint').trim();
        const outside = await graphicContrast(d.page, av, { read, ring: { inner: 4, outer: 6 } });      // what surrounds the ring (the card)
        const surf = await av.evaluate(el => { const p = document.createElement('i'); p.style.color = 'var(--surface)'; el.parentElement.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
        const tint = parseCss(await av.evaluate(read));
        out.push({ who, key, th: await checkTheme(d.page), cls: await av.getAttribute('class'), ring: toHex(tint), vsCard: outside, vsSurfaceGap: r2(cr(tint, parseCss(surf))), min: Math.min(outside.ratio, r2(cr(tint, parseCss(surf)))) });
      } catch (e) { out.push({ who, key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    save('kids', out); return out;
  },

  async timer(L) {
    const out = [];
    let tick = 0;
    const only = process.env.RM_TIMER ? process.env.RM_TIMER.split(',').map(s => s.split(':')) : null;
    for (const [who, key] of only || [['dad', 'system-dark'], ['dad', 'midnight'], ['eli', 'system-dark'], ['kiara', 'parchment'], ['kiara', 'frost']]) {
      await sleep(50);
      const put = await L.apiAs(who, '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: DEMO + 8 * 60000, total: 900, startedAt: DEMO - 7 * 60000 }, updated_at: DEMO + 60000 + (++tick) * 1000 } });   // the rig's demo clock is slowed: an explicit, rising updated_at beats an earlier tombstone
      const back = await L.apiAs(who, '/api/data/timer?scope=person&key=timer.active');
      if (!back.body?.item?.value) console.log('timer row not stored for', who, JSON.stringify(put.body).slice(0, 200), JSON.stringify(back.body).slice(0, 200));
      const d = await dev(L, who, key);
      try {
        await d.goto('#home'); await d.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 10000 }); await sleep(800);
        const fg = d.page.locator('#timer-pill-ring circle.fg');
        const m = await graphicContrast(d.page, d.page.locator('#timer-pill-ring'), { read: el => getComputedStyle(el.querySelector('circle.fg')).stroke });
        out.push({ who, key, put: put.status, th: await checkTheme(d.page), fgCount: await fg.count(), ...m });
      } catch (e) { out.push({ who, key, put: put.status, error: String(e.message).slice(0, 200) }); }
      await d.close();
      await L.apiAs(who, '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: null, updated_at: DEMO + 60000 + (++tick) * 1000 } });
    }
    save('timer', out); return out;
  },

  async pin(L) {
    const out = [];
    for (const key of ['system-light', 'midnight']) {
      const d = await L.device({ device: 'ipad-portrait', mode: KEYS[key].mode, profile: null, localStorage: KEYS[key].theme === 'system' ? {} : { 'hub.theme': JSON.stringify(KEYS[key].theme) } });
      try {
        await d.goto(''); await d.page.waitForSelector('.pcard[data-id="eli"]', { timeout: 8000 });
        await d.page.locator('.pcard[data-id="eli"]').click(); await d.page.waitForSelector('.pin-dots', { timeout: 6000 }); await sleep(500);
        const r = await d.page.evaluate(() => {
          const dot = document.querySelector('.pin-dots i'); const had = dot.classList.contains('on'); dot.classList.add('on');
          const s = getComputedStyle(dot); const o = { dotBg: s.backgroundColor, dotBorder: s.borderTopColor }; if (!had) dot.classList.remove('on');
          const av = document.querySelector('.pin-who .avatar'); const cs = av && getComputedStyle(av);
          o.avatarTint = av && cs.getPropertyValue('--tint').trim(); o.avatarShadow = av && cs.boxShadow;
          o.rootAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); o.theme = document.documentElement.dataset.theme || '(none)'; o.scheme = document.documentElement.dataset.scheme;
          return o;
        });
        out.push({ key, ...r });
      } catch (e) { out.push({ key, error: String(e.message).slice(0, 200) }); }
      await d.close();
    }
    save('pin', out); return out;
  },

  async recolour(L) {
    const out = {};
    const d = await dev(L, 'christian', 'system-light');
    const acc = async () => d.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    try {
      await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 8000 }).catch(() => {}); await sleep(500);
      out.before = await acc();
      const put = await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { color: '#8C4F7A' } });
      out.adminPut = put.status;
      out.serverMe = (await L.apiAs('christian', '/api/me')).body?.profile?.color;
      await d.page.reload({ waitUntil: 'load' }); await sleep(2500);
      out.afterReload = await acc();
      out.peopleAfterReload = await d.page.evaluate(async () => { try { const p = await hub.people(); const arr = Array.isArray(p) ? p : Object.values(p || {}); const m = arr.find(x => x && x.id === 'christian'); return m ? m.color : null; } catch (e) { return 'err ' + e.message; } });
      await sleep(35000);
      out.after35s = await acc();
      const tally = await d.openApp('tally'); await sleep(1500);
      out.tallyFrameAccent = await tally.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
      const fresh = await L.device({ device: 'ipad-portrait', mode: 'light', profile: null });
      await fresh.goto(''); await fresh.page.waitForSelector('.pcard[data-id="christian"]', { timeout: 8000 }); await sleep(800);
      out.freshPickerTint = await fresh.page.locator('.pcard[data-id="christian"]').evaluate(el => getComputedStyle(el).getPropertyValue('--tint').trim());
      await fresh.close();
    } catch (e) { out.error = String(e.message).slice(0, 300); }
    await d.close();
    out.restore = (await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { color: '#BC5A38' } })).status;
    save('recolour', out); return out;
  },
};

const want = process.argv.slice(2); const run = want.includes('all') ? Object.keys(parts) : want;
const L = run.some(p => p !== 'apps') ? await local({ variant: 'typical', clock: 'demo', engine: 'webkit' }) : null;
try {
  for (const p of run) {
    const t0 = Date.now();
    try { const r = await parts[p](L); console.log(p, 'done', Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(r).slice(0, 1500)); }
    catch (e) { console.log(p, 'FAILED', e.stack); }
  }
} finally { if (L) await L.close(); }
