// Phase 4 TOK — independent re-measurement of the investigator's key numbers.
// Written from scratch (does not import lib-tok.mjs or any other TOK script). Static parts read the repo;
// runtime parts use WebKit (playwright-core from the audit home) against a read-only static server of the repo,
// and the rig (audits/tools/lib/local.mjs) for the Kid Verse accent check. Nothing outside audits/ is written.
//   node audits/tools/phase4/TOK/remeasure.mjs [--no-rig]
// Output: audits/evidence/p4/TOK/remeasure.json
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { playwright, ROOT, local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'TOK', 'remeasure.json');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const TEMPLATE = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');
const R = {};

// ───────────────────────── static: design.css token blocks ─────────────────────────
const css = read('apps/design.css');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
function blocks(text) {            // flat top-level + one level of @media nesting; returns [{sel, body, line}]
  const out = []; let i = 0; const t = text;
  const lineAt = k => t.slice(0, k).split('\n').length;
  function walk(from, to, prefix) {
    let k = from;
    while (k < to) {
      const open = t.indexOf('{', k); if (open < 0 || open >= to) break;
      const sel = t.slice(k, open).trim();
      let depth = 1, j = open + 1;
      while (j < to && depth) { if (t[j] === '{') depth++; else if (t[j] === '}') depth--; j++; }
      if (sel.startsWith('@media') || sel.startsWith('@supports')) walk(open + 1, j - 1, (prefix ? prefix + ' ' : '') + sel);
      else out.push({ sel: (prefix ? prefix + ' » ' : '') + sel.replace(/\s+/g, ' '), body: t.slice(open + 1, j - 1), line: lineAt(open) });
      k = j;
    }
  }
  walk(0, t.length, '');
  return out;
}
function decls(body) {             // custom-property declarations, split on ; at paren depth 0
  const res = {}; let depth = 0, cur = '';
  for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ';' && depth === 0) { push(cur); cur = ''; } else cur += ch; }
  push(cur);
  function push(d) { const m = d.trim().match(/^(--[\w-]+)\s*:\s*([\s\S]*)$/); if (m) res[m[1]] = m[2].replace(/\s+/g, ' ').trim(); }
  return res;
}
const cssNoC = stripComments(css);
const all = blocks(cssNoC);
// token/theme/kind blocks = those whose selector is :root…, .tp…, or the dark media :root — i.e. everything before the base section
const tokenBlocks = all.filter(b => /(^|» ):root|\.tp\[|\.tp-half/.test(b.sel) && !/\*|html|body/.test(b.sel));
const cat = n => /^--(font|fs|lh|ls)(-|$)/.test(n) ? 'type' : /^--sp-/.test(n) ? 'spacing' : /^--r(-|$)/.test(n) ? 'radius' : /^--tap/.test(n) ? 'target'
  : /^--(max|safe)/.test(n) ? 'layout' : /^--(glass|blur|sheen)/.test(n) ? 'glass' : /^--(e\d|shadow|glow-accent|focus)/.test(n) ? 'shadow'
  : /^--(ease|spring|dur)/.test(n) ? 'motion' : 'colour';
const tokenNames = new Set(); tokenBlocks.forEach(b => Object.keys(decls(b.body)).forEach(n => tokenNames.add(n)));
const byCat = {}; for (const n of tokenNames) byCat[cat(n)] = (byCat[cat(n)] || 0) + 1;
R.tokens = { total: tokenNames.size, byCat, zIndexTokens: [...tokenNames].filter(n => /z(-|index)|layer/.test(n)), weightTokens: [...tokenNames].filter(n => /fw|weight/.test(n)),
  blocks: tokenBlocks.map(b => ({ sel: b.sel.slice(0, 90), line: b.line, n: Object.keys(decls(b.body)).length })) };

// palettes
const find = re => tokenBlocks.find(b => re.test(b.sel));
const P = {
  parchment: find(/data-theme="parchment"/), frost: find(/data-theme="frost"/), midnight: find(/data-theme="midnight"/),
  darkMedia: find(/prefers-color-scheme: dark.*:root:not/), forest: find(/^:root\[data-theme="forest"\]/), tpForest: find(/^\.tp\[data-preview="forest"\]$/),
  tpHearth: find(/^\.tp\[data-preview="hearth"\]/), tpHalf: find(/\.tp-half/),
};
const D = Object.fromEntries(Object.entries(P).map(([k, b]) => [k, b ? decls(b.body) : null]));
const keys = o => Object.keys(o).sort().join(',');
const diff = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); let d = 0, onlyA = [], onlyB = []; for (const k of ks) { if (!(k in a)) onlyB.push(k); else if (!(k in b)) onlyA.push(k); else if (a[k] !== b[k]) d++; } return { differing: d, onlyA, onlyB }; };
R.palettes = {
  counts: Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v && Object.keys(v).length])),
  sameKeySet: ['parchment', 'frost', 'midnight', 'forest'].every(k => keys(D[k]) === keys(D.parchment)),
  midnight_vs_darkMedia: diff(D.midnight, D.darkMedia), midnight_vs_tpHalf: diff(D.midnight, D.tpHalf),
  forest_vs_tpForest: diff(D.forest, D.tpForest),
  tpHearth_missing_vs_palette: Object.keys(D.parchment).filter(k => !(k in D.tpHearth)),
};

// ───────────────────────── static: areas ─────────────────────────
const AREAS = {
  'design.css': 'apps/design.css', shell: 'index.html', f260: 'apps/f260.html', leftovers: 'apps/leftovers.html', prayer: 'apps/prayer.html',
  tally: 'apps/tally.html', timer: 'apps/timer.html', dollywood: 'apps/dollywood.html', 'dollywood-live': 'apps/dollywood-live.html',
  kidverse: 'apps/kidverse.html', verses: 'apps/verses.html', docs: 'docs/design.html', 'hub.js': 'apps/hub.js',
};
const SRC = Object.fromEntries(Object.entries(AREAS).map(([a, f]) => [a, read(f)]));
const defsIn = s => { const d = new Set(); for (const m of s.matchAll(/(--[A-Za-z][\w-]*)\s*:/g)) d.add(m[1]); for (const m of s.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) d.add(m[1]); return d; };
const refsIn = s => { const r = []; for (const m of s.matchAll(/var\(\s*(--[A-Za-z][\w-]*)(\s*,)?/g)) r.push({ n: m[1], fb: !!m[2] }); return r; };
const dynIn = s => [...s.matchAll(/var\(\s*--\$\{/g)].length + [...s.matchAll(/var\(--[\w-]*\$\{/g)].length;
const cssDefs = defsIn(stripComments(css)), hubDefs = defsIn(SRC['hub.js']);
R.undefinedTokens = {};
for (const [a, s] of Object.entries(SRC)) {
  const local = defsIn(a === 'design.css' ? cssNoC : s);
  const refs = refsIn(a === 'design.css' ? cssNoC : s);
  const undef = {}; for (const r of refs) if (!cssDefs.has(r.n) && !hubDefs.has(r.n) && !local.has(r.n)) { undef[r.n] ||= { refs: 0, withFallback: 0 }; undef[r.n].refs++; if (r.fb) undef[r.n].withFallback++; }
  // design.css's own consumer inputs (--p, --tabs, --i) are defined by areas; count as undefined *within design.css* only if never defined anywhere
  R.undefinedTokens[a] = { undefinedNoFallback: Object.entries(undef).filter(([, v]) => v.withFallback < v.refs).map(([k, v]) => k + ' ×' + (v.refs - v.withFallback)), withFallbackOnly: Object.entries(undef).filter(([, v]) => v.withFallback === v.refs).map(([k]) => k), dynamicVarRefs: dynIn(s) };
}
// usage per design token across all areas (docs dynamic templates expanded from docs/design.html's own arrays)
const docsDyn = []; {
  const d = SRC.docs;
  const arr = name => { const m = d.match(new RegExp('const ' + name + " = \\[([^\\]]*)\\]")); return m ? [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]) : []; };
  for (const n of arr('NEUTRALS')) docsDyn.push('--' + n);
  for (const n of arr('ACCENTS')) docsDyn.push('--' + n, '--' + n + '-soft', '--' + n + '-ink');
  const sp = d.match(/\[([\d,]+)\]\.map\(n => `<div style="text-align:center"><i style="width:var\(--sp-/); if (sp) sp[1].split(',').forEach(n => docsDyn.push('--sp-' + n));
  const rr = d.match(/\['sm','','lg','xl','2xl'\]/); if (rr) ['--r-sm', '--r', '--r-lg', '--r-xl', '--r-2xl'].forEach(n => docsDyn.push(n));
  for (const a of ['ok', 'warn', 'danger', 'info']) docsDyn.push('--' + a + '-ink', '--' + a + '-soft');   // contrast(): c(a+'-ink'), c(a+'-soft')
  ['--text', '--text-2', '--muted', '--bg', '--surface', '--surface-2', '--accent-deep', '--accent-soft', '--on-accent'].forEach(n => docsDyn.push(n)); // c('…') calls
}
const usage = {}; for (const n of tokenNames) usage[n] = {};
for (const [a, s] of Object.entries(SRC)) {
  const text = a === 'design.css' ? cssNoC : s;
  for (const r of refsIn(text)) if (usage[r.n]) usage[r.n][a] = (usage[r.n][a] || 0) + 1;
}
for (const n of docsDyn) if (usage[n]) usage[n].docs = (usage[n].docs || 0) + 1;
// JS string refs like c('accent-deep') elsewhere are not var() — fine for this measure
R.usage = {
  unused: Object.entries(usage).filter(([, v]) => !Object.keys(v).length).map(([k]) => k),
  docsOnly: Object.entries(usage).filter(([, v]) => Object.keys(v).length === 1 && v.docs).map(([k]) => k),
  docsDynamicExpanded: docsDyn.length,
};

// ───────────────────────── static: font-size and spacing adoption ─────────────────────────
function styleText(s) { return [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n'); }
function dropPrint(t) {  // remove @media print { … } blocks
  let out = '', k = 0;
  for (;;) { const i = t.indexOf('@media print', k); if (i < 0) { out += t.slice(k); break; } out += t.slice(k, i); let j = t.indexOf('{', i) + 1, d = 1; while (d && j < t.length) { if (t[j] === '{') d++; else if (t[j] === '}') d--; j++; } k = j; }
  return out;
}
function adoption(s, { cssOnly = false } = {}) {
  let st = dropPrint(stripComments(styleText(s)));
  const rest = cssOnly ? '' : s.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  const fs_ = { tok: 0, lit: 0, rel: 0 }, sp = { tok: 0, lit: 0, hair: 0, rel: 0 };
  const scan = (t) => {
    for (const m of t.matchAll(/(?<![\w-])font-size\s*:\s*([^;}"'`]+)/g)) {
      const v = m[1].trim();
      if (/var\(--fs/.test(v)) fs_.tok++; else if (/\d(px|rem)/.test(v)) fs_.lit++; else fs_.rel++;
    }
    for (const m of t.matchAll(/(?<![\w-])(padding(?:-(?:top|bottom|left|right|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|bottom|left|right|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}"'`]+)/g)) {
      const v = m[2].trim();
      if (/var\(--sp-/.test(v)) { sp.tok++; continue; }
      const px = [...v.matchAll(/(\d*\.?\d+)px/g)].map(x => +x[1]);
      if (!px.length) { sp.rel++; continue; }
      if (px.every(x => x <= 2)) sp.hair++; else sp.lit++;
    }
  };
  scan(st); scan(rest);
  return { fontSize: fs_, spacing: sp };
}
R.adoption = {};
for (const a of ['shell', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses']) R.adoption[a] = adoption(SRC[a]);
// Dollywood: count from the template (source of truth) — whole-template style text
const tpl = fs.existsSync(TEMPLATE) ? fs.readFileSync(TEMPLATE, 'utf8') : '';
R.adoption['dollywood-template(all flavours)'] = adoption(tpl, { cssOnly: true });

// ───────────────────────── static: breakpoints, color-mix, saturate(1.4) ─────────────────────────
const bp = {};
const bpSrc = { ...Object.fromEntries(Object.entries(SRC).filter(([a]) => !['hub.js', 'docs'].includes(a))) };
for (const [a, s] of Object.entries(bpSrc)) {
  const vals = new Set();
  for (const m of s.matchAll(/@media[^{]*/g)) for (const x of m[0].matchAll(/(min|max)-(width|height)\s*:\s*(\d+)px/g)) vals.add(x[2] === 'height' ? x[3] + 'h' : x[3]);
  bp[a] = [...vals].sort((x, y) => parseInt(x) - parseInt(y));
}
const distinct = new Set(Object.values(bp).flat());
const distinctNum = new Set(Object.values(bp).flat().map(v => parseInt(v)));
R.breakpoints = { perArea: bp, distinctWithAxis: distinct.size, distinctNumbers: distinctNum.size, sharedByAll: [...distinct].filter(v => Object.values(bp).every(l => l.includes(v))) };

const mixFiles = { 'design.css': cssNoC, shell: SRC.shell, f260: SRC.f260, leftovers: SRC.leftovers, prayer: SRC.prayer, tally: SRC.tally, timer: SRC.timer, kidverse: SRC.kidverse, verses: SRC.verses, 'dollywood-template': tpl };
function mixes(s) {
  const out = []; let k = 0;
  for (;;) { const i = s.indexOf('color-mix(', k); if (i < 0) break; let j = i + 10, d = 1; while (d && j < s.length) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; } out.push(s.slice(i, j).replace(/\s+/g, ' ')); k = j; }
  return out;
}
const mixAll = []; const mixPer = {};
for (const [a, s] of Object.entries(mixFiles)) { const m = mixes(s); mixPer[a] = m.length; mixAll.push(...m); }
const person = mixAll.filter(m => /^color-mix\(in \w+, ?var\(--(accent|tint)\)/.test(m));
const ratios = new Set(person.map(m => (m.match(/var\(--(?:accent|tint)\)\s*(\d+)%/) || [, 'none'])[1]));
// also: the person colour as the SECOND argument (e.g. mix(x 60%, var(--accent)))
const personAny = mixAll.filter(m => /var\(--(accent|tint)\)/.test(m));
R.colorMix = { total: mixAll.length, perFile: mixPer, distinct: new Set(mixAll).size, personFirstArg: person.length, personFirstArgRatios: [...ratios].sort((a, b) => a - b), personAnywhere: personAny.length,
  dollywoodHubFiles: { dollywood: mixes(SRC.dollywood).length, 'dollywood-live': mixes(SRC['dollywood-live']).length } };

const sat = {};
for (const [a, s] of Object.entries({ 'design.css': css, shell: SRC.shell, f260: SRC.f260, tally: SRC.tally, leftovers: SRC.leftovers, prayer: SRC.prayer, timer: SRC.timer, kidverse: SRC.kidverse, verses: SRC.verses, 'dollywood-template': tpl, dollywood: SRC.dollywood, 'dollywood-live': SRC['dollywood-live'] }))
  sat[a] = (s.match(/saturate\(1\.4\)/g) || []).length;
R.saturate14 = { perFile: sat, outsideDesignCss_template_once: ['shell', 'f260', 'tally', 'leftovers', 'prayer', 'timer', 'kidverse', 'verses', 'dollywood-template'].reduce((n, a) => n + sat[a], 0) };

// ───────────────────────── colour maths (own) ─────────────────────────
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const mix = (a, p, b) => a.map((v, i) => v * p + b[i] * (1 - p));   // srgb color-mix (opaque)
function parseColor(s) {    // rgb()/rgba()/color(srgb …) → [r,g,b,a] in 0-255 (+alpha 0-1)
  const n = (s.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
  if (/^color\(/.test(s)) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
  return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
}

// ───────────────────────── runtime: static server + WebKit ─────────────────────────
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const PROBE = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/apps/design.css"></head><body class="ds"><div id="p"></div></body></html>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/__probe.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PROBE); }
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const pw = playwright();
const browser = await pw.webkit.launch({ headless: true });
try {
  // guide contrast: 6 themes × light/dark OS
  R.guide = {};
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ colorScheme: scheme }); const page = await ctx.newPage();
    await page.goto(base + '/docs/design.html', { waitUntil: 'load' });
    for (const t of ['system', 'hearth', 'parchment', 'frost', 'midnight', 'forest']) {
      const rows = await page.evaluate(t => { window.__setTheme(t); return window.__contrast.map(r => ({ n: r.name, r: r.ratio, min: r.min })); }, t);
      const low = rows.reduce((m, r) => r.r < m.r ? r : m, rows[0]);
      R.guide[scheme + '/' + t] = { rows: rows.length, fails: rows.filter(r => r.r < r.min).length, lowest: +low.r.toFixed(2), lowestRow: low.n };
    }
    await ctx.close();
  }

  // token pairs: 6 scenarios × 10 swatches
  const SWATCHES = JSON.parse(SRC.shell.match(/const SWATCHES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const APPCOL = JSON.parse(read('apps.json')).apps ? JSON.parse(read('apps.json')).apps.map(a => a.color) : JSON.parse(read('apps.json')).map(a => a.color);
  const SC = [['hearth', 'light', null], ['parchment', 'light', 'parchment'], ['frost', 'light', 'frost'], ['midnight', 'light', 'midnight'], ['forest', 'light', 'forest'], ['hearth-dark-os', 'dark', null]];
  const names = ['surface', 'surface-2', 'bg', 'muted-decor', 'danger', 'line', 'ok', 'accent-deep', 'focus-colour'];
  R.pairs = { scenarios: {}, focus: {}, glyphOnTile: {}, ringOnSurface: {} };
  for (const [id, scheme, theme] of SC) {
    const ctx = await browser.newContext({ colorScheme: scheme }); const page = await ctx.newPage();
    await page.goto(base + '/__probe.html', { waitUntil: 'load' });
    const get = acc => page.evaluate(({ theme, acc }) => {
      const root = document.documentElement; if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
      if (acc) root.style.setProperty('--accent', acc); else root.style.removeProperty('--accent');
      const p = document.getElementById('p'); const out = {};
      for (const n of ['surface', 'surface-2', 'bg', 'muted-decor', 'danger', 'line', 'ok', 'accent-deep']) { p.style.color = `var(--${n})`; out[n] = getComputedStyle(p).color; }
      p.style.color = 'color-mix(in srgb, var(--accent) 38%, transparent)'; out.focusColour = getComputedStyle(p).color;
      p.style.boxShadow = 'var(--focus)'; out.focusShadow = getComputedStyle(p).boxShadow; p.style.boxShadow = '';
      return out;
    }, { theme, acc });
    const v = await get(null);
    const C = k => parseColor(v[k]);
    const surf = C('surface');
    R.pairs.scenarios[id] = {
      placeholder_mutedDecor_on_surface: cr(C('muted-decor'), surf),
      badge_white_on_danger: cr([255, 255, 255], C('danger')),
      switchOff_line_vs_surface: cr(C('line'), surf),
      switchKnob_white_vs_ok: cr([255, 255, 255], C('ok')),
      raw: { surface: v.surface, danger: v.danger, line: v.line, ok: v.ok, mutedDecor: v['muted-decor'] },
    };
    R.pairs.focus[id] = {}; R.pairs.glyphOnTile[id] = {}; R.pairs.ringOnSurface[id] = {};
    for (const sw of SWATCHES) {
      const w = await get(sw); const fc = parseColor(w.focusColour);
      // the focus colour is accent at 38 % alpha (color-mix with transparent) composited over the surface
      const ring = over(fc.slice(0, 3), fc[3], parseColor(w.surface).slice(0, 3));
      R.pairs.focus[id][sw] = { ratio: cr(ring, parseColor(w.surface)), computedAlpha: +fc[3].toFixed(3), shadow: w.focusShadow.slice(0, 60) };
    }
    // app tile glyph on its own tile: glyph = the colour, tile top stop = color-mix(colour 22%, surface)
    for (const c of [...new Set([...APPCOL, ...SWATCHES])].concat([])) {
      const fg = hex(c); R.pairs.glyphOnTile[id][c] = cr(fg, mix(fg, 0.22, surf)); R.pairs.ringOnSurface[id][c] = cr(fg, surf);
    }
    R.pairs.appColours19 = { apps: APPCOL, swatches: SWATCHES };
    await ctx.close();
  }
  // counts over the 19 (9 app tile colours + 10 swatches, duplicates counted per list as the claim does)
  const list19 = [...APPCOL, ...SWATCHES];
  R.pairs.glyphUnder3 = Object.fromEntries(Object.keys(R.pairs.glyphOnTile).map(id => [id, list19.filter(c => R.pairs.glyphOnTile[id][c] < 3).length + '/' + list19.length]));
  R.pairs.glyphUnder3_appsOnly = Object.fromEntries(Object.keys(R.pairs.glyphOnTile).map(id => [id, APPCOL.filter(c => R.pairs.glyphOnTile[id][c] < 3).length + '/' + APPCOL.length]));
  R.pairs.ringUnder3 = Object.fromEntries(Object.keys(R.pairs.ringOnSurface).map(id => [id, list19.filter(c => R.pairs.ringOnSurface[id][c] < 3).length + '/' + list19.length]));
  const fAll = Object.values(R.pairs.focus).flatMap(o => Object.values(o).map(x => x.ratio));
  R.pairs.focusSummary = { cases: fAll.length, under3: fAll.filter(x => x < 3).length, min: Math.min(...fAll), max: Math.max(...fAll) };
} finally { await browser.close(); server.close(); }

// ───────────────────────── runtime: Kid Verse Done ★ accent (rig) ─────────────────────────
if (!process.argv.includes('--no-rig')) {
  const Lr = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    const d = await Lr.device({ device: 'ipad-portrait', mode: 'light', profile: 'ezra' });
    const f = await d.openApp('kidverse');
    await f.waitForSelector('#done', { state: 'attached', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));
    R.kidverse = await f.evaluate(() => {
      const el = document.getElementById('done'); const cs = getComputedStyle(el); const rs = getComputedStyle(document.documentElement);
      const p = document.createElement('i'); el.appendChild(p); p.style.color = 'var(--accent)'; const acc = getComputedStyle(p).color; p.style.color = 'var(--accent-deep)'; const deep = getComputedStyle(p).color; p.remove();
      const q = document.createElement('i'); document.body.appendChild(q); q.style.color = 'var(--accent-deep)'; const rootDeep = getComputedStyle(q).color; q.style.color = 'var(--gold)'; const gold = getComputedStyle(q).color; q.remove();
      return { profile: window.hub && hub.profile && hub.profile.id, rootAccentInline: document.documentElement.style.getPropertyValue('--accent'), classes: el.className, hidden: el.hidden,
        localAccent: acc, localAccentDeep: deep, rootAccentDeep: rootDeep, gold, backgroundImage: cs.backgroundImage, backgroundColor: cs.backgroundColor, color: cs.color };
    });
    await d.close();
  } finally { await Lr.close(); }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, (k, v) => (k === 'raw' || k === 'glyphOnTile' || k === 'ringOnSurface' || k === 'focus' || k === 'blocks') ? undefined : v, 1));
