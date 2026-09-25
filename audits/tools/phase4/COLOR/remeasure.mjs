#!/usr/bin/env node
// Phase 4 COLOR — independent RE-MEASUREMENT of the COLOR investigation's key numbers.
// Written from scratch: it does not import or reuse palette.mjs / table.mjs / spot.mjs / native-controls.mjs /
// semantic.mjs / nontext-summary.mjs / components.mjs, nor the rig page-lib. Own WCAG, colour-mix, OKLab/OKLCH,
// Machado-2009 CVD maths, own raw-JSON aggregation, own PNG decoder and own in-page probe.
//
//   node audits/tools/phase4/COLOR/remeasure.mjs tokens            # token maths from apps/design.css (no browser)
//   node audits/tools/phase4/COLOR/remeasure.mjs raw               # re-aggregate the rig's raw per-job JSON (no browser)
//   node audits/tools/phase4/COLOR/remeasure.mjs live [webkit|chromium]   # local instance, own pixel sampling
//
// Writes audits/evidence/p4/COLOR/remeasure-<part>[-engine].json. Local instance only (lib/local.mjs blocks production).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const EV = path.join(ROOT, 'audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const part = process.argv[2] || 'tokens';
const r2 = v => Math.round(v * 100) / 100;

// ── colour maths ──
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const toHex = c => '#' + c.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const A = lum(typeof a === 'string' ? hexRgb(a) : a), B = lum(typeof b === 'string' ? hexRgb(b) : b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
// CSS color-mix(in srgb, a p, b): straight interpolation of the gamma-encoded channels
const mix = (a, b, p) => { const A = typeof a === 'string' ? hexRgb(a) : a, B = typeof b === 'string' ? hexRgb(b) : b; return A.map((v, i) => v * p + B[i] * (1 - p)); };
function oklab(c) {
  const [r, g, b] = (typeof c === 'string' ? hexRgb(c) : c).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const oklch = c => { const [L, a, b] = oklab(c); return { L: +L.toFixed(3), C: +Math.hypot(a, b).toFixed(3), H: Math.round((Math.atan2(b, a) * 180 / Math.PI + 360) % 360) }; };
const dE = (x, y) => { const A = oklab(x), B = oklab(y); return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
// Machado, Oliveira & Fernandes 2009, deuteranomaly severity 1.0, applied to linear RGB
const DEUT = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
const sim = (c, M) => { const v = (typeof c === 'string' ? hexRgb(c) : c).map(lin); return M.map(row => unlin(Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])))); };

// ── design.css token blocks (own parser) ──
function tokenBlocks() {
  const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
  const grab = re => { const m = css.match(re); if (!m) throw new Error('block not found ' + re); const start = m.index + m[0].length; let depth = 1, i = start; while (depth && i < css.length) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; } return css.slice(start, i - 1); };
  const vars = body => { const o = {}; for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\b/g)) o[m[1]] = m[2].toUpperCase(); return o; };
  const hearth = vars(grab(/:root\s*\{/));
  const T = { hearth, parchment: { ...hearth, ...vars(grab(/:root\[data-theme="parchment"\][^{]*\{/)) }, frost: { ...hearth, ...vars(grab(/:root\[data-theme="frost"\][^{]*\{/)) },
    midnight: { ...hearth, ...vars(grab(/:root\[data-theme="midnight"\][^{]*\{/)) }, forest: { ...hearth, ...vars(grab(/:root\[data-theme="forest"\][^{]*\{/)) } };
  return T;
}

function tokensPart() {
  const T = tokenBlocks();
  const out = { note: 'Token maths from apps/design.css, own parser + own WCAG 2.x relative luminance, CSS color-mix in srgb, OKLab (Ottosson), Machado 2009 deuteranomaly 1.0.' };
  // 1. house pairs (audits/HUB-AUDIT-PROMPT.md:57-64)
  const prompt = fs.readFileSync(path.join(ROOT, 'audits/HUB-AUDIT-PROMPT.md'), 'utf8');
  const house = {}; for (const m of prompt.matchAll(/^\s+(Bubblegum|Peach|Butter|Mint|Aqua|Sky|Periwinkle|Lavender)\s+(#[0-9A-F]{6})\s*\/\s*(#[0-9A-F]{6})/gim)) house[m[1]] = { fill: m[2], ink: m[3], inkOnFill: r2(cr(m[3], m[2])), fillOklch: oklch(m[2]) };
  out.house = house;
  // 2. soft-fill chroma
  const SOFT = ['--mocha-soft', '--gold-soft', '--olive-soft', '--teal-soft', '--terra-soft', '--slate-soft'];
  out.softChroma = {}; for (const [k, t] of Object.entries(T)) { const cs = SOFT.map(s => oklch(t[s]).C); out.softChroma[k] = { min: Math.min(...cs), max: Math.max(...cs), each: Object.fromEntries(SOFT.map((s, i) => [s, cs[i]])) }; }
  const hc = Object.values(house).map(h => h.fillOklch.C); out.softChroma.house = { min: Math.min(...hc), max: Math.max(...hc) };
  // 3. gold as text, light palettes
  out.gold = {}; for (const k of ['hearth', 'parchment', 'frost']) { const t = T[k]; out.gold[k] = { goldOnBg: r2(cr(t['--gold'], t['--bg'])), goldOnSurface: r2(cr(t['--gold'], t['--surface'])), goldOnGoldSoft: r2(cr(t['--gold'], t['--gold-soft'])), goldInkOnGoldSoft: r2(cr(t['--gold-ink'], t['--gold-soft'])) }; }
  // 4. --muted on --surface-2 + F260 NT paper (apps/f260.html:28-29: 93% --bg + teal)
  out.muted = {}; for (const k of Object.keys(T)) { const t = T[k]; out.muted[k] = { onSurface2: r2(cr(t['--muted'], t['--surface-2'])), onBg: r2(cr(t['--muted'], t['--bg'])), onSurface: r2(cr(t['--muted'], t['--surface'])) }; }
  const ntPaper = mix(T.hearth['--bg'], T.hearth['--teal'], 0.93); out.muted.f260NtPaperHearth = { paper: toHex(ntPaper), ratio: r2(cr(T.hearth['--muted'], ntPaper)) };
  // 5. success vs destructive
  out.semantic = {}; for (const k of Object.keys(T)) { const o = T[k]['--olive'], te = T[k]['--terra']; out.semantic[k] = { lumRatio: r2(cr(o, te)), dENormal: +dE(o, te).toFixed(1), dEDeutan: +dE(sim(o, DEUT), sim(te, DEUT)).toFixed(1) }; }
  // 6. neutrals: card vs page
  out.neutrals = {}; for (const k of Object.keys(T)) out.neutrals[k] = r2(cr(T[k]['--surface'], T[k]['--bg']));
  out.neutrals.iosDark = r2(cr('#1C1C1E', '#000000')); out.neutrals.iosLight = r2(cr('#FFFFFF', '#F2F2F7'));
  // 7. raw person colour on the Midnight surface (worker/seed.sql:4-11)
  const seed = fs.readFileSync(path.join(ROOT, 'worker/seed.sql'), 'utf8');
  const prof = {}; for (const m of seed.matchAll(/\('(\w+)',\s*'([^']+)',\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})'/g)) prof[m[1]] = { name: m[2], color: m[3].toUpperCase() };
  out.rawOnSurface = {}; for (const [id, p] of Object.entries(prof)) out.rawOnSurface[p.name] = { color: p.color, midnight: r2(cr(p.color, T.midnight['--surface'])), forest: r2(cr(p.color, T.forest['--surface'])), hearth: r2(cr(p.color, T.hearth['--surface'])), parchment: r2(cr(p.color, T.parchment['--surface'])), frost: r2(cr(p.color, T.frost['--surface'])) };
  // 8. --tint-ink = color-mix(profile 70%, --text) (index.html:955, 1070) on --surface and --bg
  out.tintInk = {}; for (const [id, p] of Object.entries(prof)) { out.tintInk[p.name] = {}; for (const k of Object.keys(T)) { const ink = mix(p.color, T[k]['--text'], 0.7); out.tintInk[p.name][k] = { onSurface: r2(cr(ink, T[k]['--surface'])), onBg: r2(cr(ink, T[k]['--bg'])) }; } }
  // 9. hero Switch by token maths: --accent-deep (dark: 58% accent + white) on rgba(255,255,255,.92) over the hero
  out.heroSwitchTokenDark = {}; for (const [id, p] of Object.entries(prof)) { const deep = mix(p.color, '#FFFFFF', 0.58); const heroMid = hexRgb(p.color); const btn = mix('#FFFFFF', heroMid, 0.92); out.heroSwitchTokenDark[p.name] = r2(cr(deep, btn)); }
  return out;
}

// ── raw aggregation (independent of aggregate.mjs) ──
function rawPart() {
  const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
  const areas = process.argv.slice(3).length ? process.argv.slice(3) : ['f260', 'dollywood', 'dollywood-live', 'tally'];
  const key = j => j.theme === 'system' ? 'system-' + j.mode : j.theme === 'hearth' ? 'hearth-' + j.mode : j.theme;
  const large = t => t.fs >= 24 || (t.fs >= 18.66 && t.fw >= 700);
  const res = {}, spots = {}, rings = {};
  // [name, selector regex, job-file regex]: min/max rig p10 of these texts per theme key
  const TEXTPROBES = [['park wait minutes, kid-filtered (span.wtile > b)', /span\.wtile > b$/, /waits-kid/], ['park wait minutes, all (span.wtile > b)', /span\.wtile > b$/, null],
    ['feed names (div.fwho)', /\.fwho$/, null], ['Me hero Switch (#switch)', /#switch$/, null], ['reminder field (#remtext)', /#remtext$/, null]];
  for (const area of areas) {
    const A = res[area] = {};
    for (const run of ['themes', 'devices', 'states']) {
      const dir = path.join(RAW, run, area); if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
        if ((j.v || 1) < 2 || !j.ok) continue;
        const k = key(j);
        for (const scope of ['all', run]) {
          const R = (A[k] ||= {})[scope] ||= { jobs: 0, occ: 0, failRig: 0, failOwn: 0, ownDocOcc: 0, ownDocFail: 0 };
          R.jobs++;
          for (const t of j.text || []) {
            if (!t.measured || t.p10 == null) continue;
            R.occ++; if (t.aa === false) R.failRig++;
            const req = large(t) ? 3 : 4.5; const fail = t.p10 < req; if (fail) R.failOwn++;
            const own = area === 'shell' || area === 'tv' ? t.doc === 'page' : t.doc !== 'page';
            if (own) { R.ownDocOcc++; if (fail) R.ownDocFail++; }
            if (scope === 'all') for (const [name, re, jre] of TEXTPROBES) if (re.test(t.sel) && (!jre || jre.test(f))) { const S = ((spots[name] ||= {})[k] ||= { n: 0, min: 99, max: 0, colors: [], jobs: [] }); S.n++; S.min = Math.min(S.min, t.p10); S.max = Math.max(S.max, t.p10); const c = toHex(t.color); if (!S.colors.includes(c) && S.colors.length < 4) S.colors.push(c); if (S.jobs.length < 2 && !S.jobs.includes(f)) S.jobs.push(f); }
          }
          if (scope === 'all') for (const g of (j.nontext && j.nontext.graphics) || []) if (g.kind === 'ring' && /today/.test(g.sel)) { const S = ((rings[area] ||= {})[g.sel] ||= {})[k] ||= { n: 0, min: 99, max: 0 }; S.n++; S.min = Math.min(S.min, g.ratio); S.max = Math.max(S.max, g.ratio); }
        }
      }
    }
    for (const k of Object.keys(A)) for (const s of Object.keys(A[k])) { const R = A[k][s]; R.pctRig = +(100 * R.failRig / Math.max(1, R.occ)).toFixed(1); R.pctOwn = +(100 * R.failOwn / Math.max(1, R.occ)).toFixed(1); R.pctOwnDoc = +(100 * R.ownDocFail / Math.max(1, R.ownDocOcc)).toFixed(1); }
  }
  return { note: 'Independent re-aggregation of raw/<run>/<area>/*.json (v2, ok): every measured text with a p10. failRig = t.aa===false; failOwn = own threshold (p10 < 4.5, or < 3 for >=24px or >=18.66px/700). ownDoc = only the app document (the shell page excluded). spots = rig p10 of selected texts; rings = rig nontext graphics of kind ring whose selector contains "today".', res, spots, rings };
}

// ── PNG decoder (8-bit RGB/RGBA, non-interlaced: what Playwright writes) ──
function decodePng(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported png'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break; p += 12 + len; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('colour type ' + ct); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)]; const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0; let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255; } }
  const px = []; for (let i = 0; i < out.length; i += bpp) px.push([out[i], out[i + 1], out[i + 2]]);
  return { w, h, px };
}

// ── in-page probe: find the element, read its ink, hide the text, return the sampling rect ──
async function probe(frame, spec) {
  return frame.evaluate(spec => {
    const pick = () => {
      if (spec.sel) return document.querySelector(spec.sel);
      const all = [...document.querySelectorAll('body *')];
      return all.find(e => { const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); if (!own) return false; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        const shown = cs.textTransform === 'uppercase' ? own.toUpperCase() : own; return spec.text instanceof Array ? spec.text.includes(shown) : shown === spec.text; }) || null;
    };
    const e = pick(); if (!e) return { found: false };
    e.scrollIntoView({ block: 'center', inline: 'nearest' });
    const cs = getComputedStyle(e);
    const col = spec.placeholder ? getComputedStyle(e, '::placeholder').color : cs.color;
    let op = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= +getComputedStyle(x).opacity;
    // the sampling box: the first line box of the element's own text, or the control's inner box
    let r = e.getBoundingClientRect();
    if (!spec.box) { const tn = [...e.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (tn) { const rg = document.createRange(); rg.selectNodeContents(tn); const rs = rg.getClientRects(); if (rs.length) r = rs[0]; } }
    const inset = spec.box ? 6 : 0;
    const st = document.createElement('style'); st.id = '__rm_hide';
    e.setAttribute('data-rm-hide', '');
    st.textContent = '[data-rm-hide],[data-rm-hide] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}[data-rm-hide]::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}';
    document.head.append(st);
    const root = document.documentElement;
    return { found: true, text: spec.placeholder ? e.placeholder : (e.innerText || e.value || '').trim().slice(0, 40), color: col, opacity: +op.toFixed(3), fs: cs.fontSize, fw: cs.fontWeight, tag: e.tagName.toLowerCase(), cls: e.className && e.className.baseVal === undefined ? e.className : '',
      rect: { x: r.x + inset, y: r.y + inset, w: Math.max(2, r.width - 2 * inset), h: Math.max(2, r.height - 2 * inset) },
      dataTheme: root.dataset.theme || null, dataScheme: root.dataset.scheme || null, colorScheme: getComputedStyle(root).colorScheme, bgDecl: cs.backgroundColor, appearance: cs.appearance || cs.webkitAppearance };
  }, spec);
}
async function unhide(frame) { await frame.evaluate(() => { document.getElementById('__rm_hide')?.remove(); document.querySelectorAll('[data-rm-hide]').forEach(e => e.removeAttribute('data-rm-hide')); }).catch(() => {}); }
const parseCol = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; }
  const c = s.match(/color\(srgb ([^)]+)\)/); if (c) { const v = c[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] == null ? 1 : v[3]]; } throw new Error('colour ' + s); };

async function measure(d, frame, spec, sleep) {
  const P = await probe(frame, spec); if (!P.found) return { ...spec, found: false };
  await sleep(250);
  let ox = 0, oy = 0;
  if (frame !== d.page) { const fe = await frame.frameElement(); const b = await fe.boundingBox(); ox = b.x; oy = b.y; }
  const clip = { x: Math.round(P.rect.x + ox), y: Math.round(P.rect.y + oy), width: Math.max(2, Math.round(P.rect.w)), height: Math.max(2, Math.round(P.rect.h)) };
  const png = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
  await unhide(frame);
  const { px } = decodePng(png);
  const c = parseCol(P.color); const a = c[3] * P.opacity;
  const ratios = px.map(bg => cr(mix(c, bg, a), bg)).sort((x, y) => x - y);
  const bgs = px.map(q => q[0] * 65536 + q[1] * 256 + q[2]).sort((x, y) => x - y); const bm = bgs[bgs.length >> 1];
  return { ...spec, ...P, clip, n: px.length, bgMedian: toHex([bm >> 16, (bm >> 8) & 255, bm & 255]), p10: r2(ratios[Math.floor(ratios.length * 0.1)]), median: r2(ratios[ratios.length >> 1]) };
}

async function livePart(engine) {
  const { local, sleep } = await import('../../lib/local.mjs');
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const res = [];
  const log = (tag, r) => { res.push({ ...r, tag }); console.log(tag.padEnd(44), r.found === false ? 'NOT FOUND' : `${r.text}  p10 ${r.p10} med ${r.median}  ink ${r.color} a=${r.opacity}  bg ${r.bgMedian}  theme=${r.dataTheme} scheme=${r.dataScheme} cs=${r.colorScheme}`); };
  async function themed(profile, theme, mode, device = 'ipad-portrait') {
    await L.reset('typical');
    if (theme !== 'system') { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme ' + r.status); }
    return L.device({ device, mode, profile, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
  }
  try {
    // A. native controls in the Larder frame: #size select + an injected unstyled <button> probe; computed color-scheme
    for (const [theme, mode] of [['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark'], ['system', 'light']]) {
      const d = await themed('eli', theme, mode); await d.goto('#home'); const f = await d.openApp('leftovers', { wait: '#size' }); await sleep(2500);
      await f.evaluate(() => { const b = document.createElement('button'); b.id = '__rm_btn'; b.textContent = 'Probe button text'; b.style.cssText = 'position:fixed;left:40px;top:220px;z-index:99999;font-size:17px;padding:10px 18px'; document.body.append(b); });
      log(`${engine} larder select#size ${theme}/${mode}OS`, await measure(d, f, { sel: '#size', box: true }, sleep));
      log(`${engine} default <button> ${theme}/${mode}OS`, await measure(d, f, { sel: '#__rm_btn', box: true }, sleep));
      await d.close();
    }
    if (engine === 'webkit') {
      // B. Me hero Switch
      for (const [p, theme, mode] of [['eli', 'midnight', 'light'], ['kiara', 'midnight', 'light'], ['ezra', 'system', 'dark'], ['dad', 'forest', 'light'], ['kiara', 'system', 'light']]) {
        const d = await themed(p, theme, mode); await d.goto('#me'); await d.page.waitForSelector('#switch', { timeout: 15000 }); await sleep(1800);
        log(`me #switch ${p} ${theme}/${mode}OS`, await measure(d, d.page, { sel: '#switch' }, sleep)); await d.close();
      }
      // C. reminder placeholder
      for (const [theme, mode] of [['system', 'light'], ['frost', 'light'], ['midnight', 'light']]) {
        const d = await themed('eli', theme, mode); await d.goto('#home'); await d.page.waitForSelector('#remtext', { timeout: 15000 }); await sleep(1800);
        log(`home #remtext placeholder ${theme}/${mode}OS`, await measure(d, d.page, { sel: '#remtext', placeholder: true, box: true }, sleep)); await d.close();
      }
      // D. Prayer kitchen category label
      for (const [theme, mode] of [['midnight', 'light'], ['system', 'light']]) {
        const d = await themed('eli', theme, mode); await d.goto('#home'); const f = await d.openApp('prayer'); await sleep(2500);
        await f.click('#moreBtn'); await f.waitForSelector('#sheet.on', { timeout: 6000 }); await f.click('[data-more="kitchen"]'); await f.waitForSelector('#kitchen.on', { timeout: 6000 }); await sleep(700);
        log(`prayer #kitchen .k-cat eli ${theme}/${mode}OS`, await measure(d, f, { sel: '#kitchen .k-cat' }, sleep)); await d.close();
      }
      // E. F260 gold text on Today (Hearth by day)
      { const d = await themed('eli', 'system', 'light'); await d.goto('#home'); const f = await d.openApp('f260'); await sleep(3500);
        log('f260 "343" system/lightOS', await measure(d, f, { text: '343' }, sleep));
        log('f260 "THIS WEEK" system/lightOS', await measure(d, f, { text: 'THIS WEEK' }, sleep)); await d.close(); }
    }
  } finally { await L.close(); }
  return { note: 'Own probe: own-text first line box (or control inner box inset 6px), text hidden via transparent colour, 1x CSS screenshot, own PNG decode; per pixel contrast of the ink (alpha x opacity chain, blended in sRGB) over that pixel; p10 and median. iPad portrait, typical seed, theme set like the rig (server row PUT + localStorage).', engine, res };
}

const main = async () => {
  let out, name;
  if (part === 'tokens') { out = tokensPart(); name = 'remeasure-tokens.json'; }
  else if (part === 'raw') { out = rawPart(); name = 'remeasure-raw.json'; }
  else if (part === 'live') { const eng = process.argv[3] || 'webkit'; out = await livePart(eng); name = `remeasure-live-${eng}.json`; }
  else throw new Error('part: tokens | raw | live');
  fs.writeFileSync(path.join(EV, name), JSON.stringify(out, null, 1) + '\n');
  if (part !== 'live') console.log(JSON.stringify(out, null, 1).slice(0, 12000));
  console.log('wrote', path.join('audits/evidence/p4/COLOR', name));
};
main().catch(e => { console.error(e); process.exit(1); });
