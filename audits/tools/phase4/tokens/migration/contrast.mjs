// Phase 4 "migration" proposal — verification gate.
//   node audits/tools/phase4/tokens/migration/contrast.mjs <tokens.css> [out.json]
// Parses the proposed tokens.css on its own (no import of the generator): a small CSS cascade over a synthetic
// <html> (+ .tp preview and data-tint child elements) resolves every custom property per scenario, then checks:
//   · every text/background pair (4.5:1), large-text pairs (3:1), non-text/graphic pairs (3:1) in every palette,
//     light and dark, including text on glass composited over the page, cards and busy content;
//   · every person accent (8 hues + the neutral) on the surfaces it is painted on, per palette;
//   · every hue and semantic family: ink on fill / fill-2 / surfaces, strong vs surfaces and track, on-<f> on <f>;
//   · semantic separation (success vs destructive luminance >= 1.3; semantic vs person tones dE00 >= 10);
//   · colour-vision-deficiency separation of the person accents (CIEDE2000 >= 10, normal / protan / deutan,
//     Machado 2009 severity 1.0), with tritan and the fill/ink roles reported;
//   · structural rules: dark cards >= 1.2:1 off the page, dark wells lighter than cards, dark chips >= 1.4:1 off
//     the card, light fills at house chroma (C >= 0.055), the preview swatches equal their themes, type floors per
//     kind and device, 44/64 pt targets, the 4 pt grid, concentric radii, durations inside 200-350 ms.
// Exit code 1 if anything fails. WCAG 2.x relative-luminance contrast; alpha composited source-over.
import fs from 'node:fs';
import * as C from './color.mjs';

const file = process.argv[2]; const outFile = process.argv[3];
if (!file) { console.error('usage: node contrast.mjs <tokens.css> [out.json]'); process.exit(2); }
const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. parse rules (top level and @media (min-width)) ────────────────────────────────────────────
const rules = [];
function parseBlock(src, media) {
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i); if (open < 0) break;
    const head = src.slice(i, open).trim();
    let depth = 1, j = open + 1; while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    const body = src.slice(open + 1, j - 1);
    if (head.startsWith('@media')) { const m = head.match(/min-width:\s*(\d+)px/); parseBlock(body, m ? { minWidth: +m[1] } : { never: true }); }
    else {
      const decls = []; let d = 0, start = 0;
      for (let k = 0; k <= body.length; k++) { const ch = body[k]; if (ch === '(') d++; else if (ch === ')') d--; else if ((ch === ';' || k === body.length) && d === 0) { const s = body.slice(start, k).trim(); if (s) { const c = s.indexOf(':'); decls.push([s.slice(0, c).trim(), s.slice(c + 1).trim()]); } start = k + 1; } }
      rules.push({ selectors: splitTop(head, ','), decls, media, order: rules.length });
    }
    i = j;
  }
}
function splitTop(s, sep) { const out = []; let d = 0, q = null, st = 0; for (let k = 0; k < s.length; k++) { const ch = s[k]; if (q) { if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") q = ch; else if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; else if (ch === sep && d === 0) { out.push(s.slice(st, k).trim()); st = k + 1; } } out.push(s.slice(st).trim()); return out.filter(Boolean); }
parseBlock(css, null);

// ── 2. selectors: compound (:root, .class, [attr], [attr="v"], :not(compound)) with descendant combinator ──
function parseCompound(s) {
  const parts = []; let k = 0;
  while (k < s.length) {
    if (s.startsWith(':root', k)) { parts.push({ t: 'root' }); k += 5; }
    else if (s.startsWith(':not(', k)) { let d = 1, j = k + 5; while (d) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; } parts.push({ t: 'not', inner: parseCompound(s.slice(k + 5, j - 1)) }); k = j; }
    else if (s[k] === '.') { const m = s.slice(k + 1).match(/^[\w-]+/); parts.push({ t: 'class', v: m[0] }); k += 1 + m[0].length; }
    else if (s[k] === '[') { const j = s.indexOf(']', k); const m = s.slice(k + 1, j).match(/^([\w-]+)(?:="([^"]*)")?$/); parts.push({ t: 'attr', n: m[1], v: m[2] }); k = j + 1; }
    else if (s[k] === '*' || s.startsWith('html', k)) { k += s[k] === '*' ? 1 : 4; }
    else throw new Error('selector not understood: ' + s);
  }
  return parts;
}
const spec = parts => parts.reduce((a, p) => a + (p.t === 'not' ? spec(p.inner) : 1), 0);
function matchCompound(parts, el) { return parts.every(p => p.t === 'root' ? el.root : p.t === 'class' ? el.classes.includes(p.v) : p.t === 'attr' ? (p.n in el.attrs) && (p.v === undefined || el.attrs[p.n] === p.v) : !matchCompound(p.inner, el)); }
function matchSelector(sel, el) {
  const comps = sel.split(/\s+/).map(parseCompound);
  if (!matchCompound(comps[comps.length - 1], el)) return false;
  let a = el.parent;
  for (let i = comps.length - 2; i >= 0; i--) { while (a && !matchCompound(comps[i], a)) a = a.parent; if (!a) return false; a = a.parent; }
  return true;
}
const selSpec = sel => sel.split(/\s+/).map(parseCompound).reduce((a, c) => a + spec(c), 0);

// ── 3. cascade + custom-property resolution ──────────────────────────────────────────────────────
function makeEl({ root = false, attrs = {}, classes = [], parent = null, viewport }) {
  const el = { root, attrs, classes, parent, viewport: viewport ?? parent?.viewport ?? 820, declared: new Map(), cache: new Map() };
  const hits = [];
  for (const r of rules) {
    if (r.media) { if (r.media.never || el.viewport < r.media.minWidth) continue; }
    let best = -1; for (const s of r.selectors) if (matchSelector(s, el)) best = Math.max(best, selSpec(s));
    if (best >= 0) for (const [p, v] of r.decls) hits.push({ p, v, spec: best, order: r.order });
  }
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  for (const h of hits) el.declared.set(h.p, h.v);
  return el;
}
function get(el, prop, stack = new Set()) {
  if (el.cache.has(prop)) return el.cache.get(prop);
  let v;
  if (el.declared.has(prop)) {
    if (stack.has(el) && stack.has(prop)) throw new Error('cycle ' + prop);
    const key = prop + '@' + el.attrs['data-theme']; if (stack.has(key)) throw new Error('cycle ' + prop);
    const s2 = new Set(stack); s2.add(key);
    v = substitute(el, el.declared.get(prop), s2);
  } else v = el.parent ? get(el.parent, prop, stack) : undefined;
  el.cache.set(prop, v); return v;
}
function substitute(el, value, stack) {
  let out = '', k = 0;
  while (k < value.length) {
    const i = value.indexOf('var(', k); if (i < 0) { out += value.slice(k); break; }
    out += value.slice(k, i);
    let d = 1, j = i + 4; while (d) { if (value[j] === '(') d++; else if (value[j] === ')') d--; j++; }
    const inner = value.slice(i + 4, j - 1); const c = splitTop(inner, ',');
    const name = c[0].trim(); const fb = c.length > 1 ? inner.slice(inner.indexOf(',') + 1).trim() : undefined;
    let r = get(el, name, stack); if (r === undefined) { if (fb === undefined) throw new Error('undefined ' + name); r = substitute(el, fb, stack); }
    out += r; k = j;
  }
  return out;
}

// ── 4. colour and length evaluation of resolved strings ───────────────────────────────────────────
const NAMED = { white: '#FFFFFF', black: '#000000', transparent: '#00000000' };
function colour(str) {
  const s = str.trim();
  if (NAMED[s]) return C.parseHex(NAMED[s]);
  if (s[0] === '#') return C.parseHex(s);
  let m = s.match(/^rgba?\((.*)\)$/s);
  if (m) { const a = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255, a: a.length > 3 ? a[3] : 1 }; }
  m = s.match(/^color-mix\(in ([\w-]+),(.*)\)$/s);
  if (m) {
    const [x, y] = splitTop(m[2], ',').map(t => { const pm = t.match(/^(.*?)\s+([\d.]+)%$/s); return pm ? [colour(pm[1]), +pm[2]] : [colour(t), null]; });
    return C.mix(m[1], x[0], x[1], y[0], y[1]);
  }
  throw new Error('colour not understood: ' + s.slice(0, 80));
}
function len(str, vw) {   // px value of calc()/max()/min()/clamp()/round() over px, vw and unitless numbers
  const src = str.trim(); let k = 0;
  const ws = () => { while (/\s/.test(src[k])) k++; };
  function atom() {
    ws();
    if (src[k] === '(') { k++; const v = expr(); ws(); k++; return v; }
    const fm = src.slice(k).match(/^(calc|max|min|clamp|round)\(/);
    if (fm) { k += fm[0].length; const args = []; let mode = null; ws();
      if (fm[1] === 'round') { const mm = src.slice(k).match(/^(nearest|up|down|to-zero)\s*,/); if (mm) { mode = mm[1]; k += mm[0].length; } }
      for (;;) { args.push(expr()); ws(); if (src[k] === ',') { k++; continue; } k++; break; }
      if (fm[1] === 'calc') return args[0];
      if (fm[1] === 'max') return Math.max(...args);
      if (fm[1] === 'min') return Math.min(...args);
      if (fm[1] === 'clamp') return Math.min(Math.max(args[1], args[0]), args[2]);
      const [x, st] = args; const q = x / st; return (mode === 'up' ? Math.ceil(q) : mode === 'down' ? Math.floor(q) : Math.round(q)) * st;
    }
    const nm = src.slice(k).match(/^(-?[\d.]+)(px|vw|%|ms|s)?/); if (!nm) throw new Error('length not understood: ' + src);
    k += nm[0].length; const n = +nm[1];
    return nm[2] === 'vw' ? (n * vw) / 100 : nm[2] === 's' ? n * 1000 : n;
  }
  function term() { let v = atom(); for (;;) { ws(); if (src[k] === '*') { k++; v *= atom(); } else if (src[k] === '/') { k++; v /= atom(); } else return v; } }
  function expr() { let v = term(); for (;;) { ws(); if (src[k] === '+' && /\s/.test(src[k + 1])) { k++; v += term(); } else if (src[k] === '-' && /\s/.test(src[k + 1])) { k++; v -= term(); } else return v; } }
  return expr();
}

// ── 5. scenarios ──────────────────────────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'system-light', attrs: { 'data-theme': 'system', 'data-scheme': 'light' }, scheme: 'light', palette: 'frost' },
  { id: 'frost', attrs: { 'data-theme': 'frost', 'data-scheme': 'light' }, scheme: 'light', palette: 'frost' },
  { id: 'hearth', attrs: { 'data-theme': 'hearth', 'data-scheme': 'light' }, scheme: 'light', palette: 'hearth' },
  { id: 'parchment', attrs: { 'data-theme': 'parchment', 'data-scheme': 'light' }, scheme: 'light', palette: 'parchment' },
  { id: 'system-dark', attrs: { 'data-theme': 'system', 'data-scheme': 'dark' }, scheme: 'dark', palette: 'graphite' },
  { id: 'graphite', attrs: { 'data-theme': 'graphite', 'data-scheme': 'dark' }, scheme: 'dark', palette: 'graphite' },
  { id: 'midnight', attrs: { 'data-theme': 'midnight', 'data-scheme': 'dark' }, scheme: 'dark', palette: 'midnight' },
  { id: 'forest', attrs: { 'data-theme': 'forest', 'data-scheme': 'dark' }, scheme: 'dark', palette: 'forest' },
];
const PERSON_HUES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender'];
const HOUSEHOLD = { bubblegum: 'Mae', peach: 'Elizabeth', butter: 'Kiara', mint: 'Mea', aqua: 'Ezra', sky: 'David', periwinkle: 'Eli', lavender: 'guests' };
const ACCENTS = [...PERSON_HUES, 'graphite'];
const FAMILIES = [...PERSON_HUES, 'danger', 'warn', 'ok', 'graphite'];
const MODES = [{ id: 'default', attrs: {} }, { id: 'contrast-more', attrs: { 'data-contrast': 'more' } }, { id: 'reduce-transparency', attrs: { 'data-transparency': 'reduce' } }];

const results = []; let fails = 0;
const hexOf = c => C.toHex(c);
function rec(o) { results.push(o); if (!o.pass) fails++; }
function pair(ctx, kind, fgName, fg, bgName, bg, min, extra = {}) {
  const bgO = bg.a !== undefined && bg.a < 1 ? C.over(bg, C.parseHex('#808080')) : bg;
  const f = fg.a !== undefined && fg.a < 1 ? C.over(fg, bgO) : fg;
  const ratio = C.contrast(f, bgO);
  rec({ ...ctx, kind, fg: fgName, bg: bgName, fgHex: hexOf(f), bgHex: hexOf(bgO), ratio: +ratio.toFixed(2), min, pass: ratio >= min, ...extra });
}
const TEXT = 4.5, LARGE = 3, NONTEXT = 3;

for (const th of THEMES) for (const mode of MODES) for (const acc of ACCENTS) {
  // the person-dependent pairs run for every accent; the neutral pairs once per theme and mode (accent = graphite)
  const neutralRun = acc === 'graphite';
  if (mode.id !== 'default' && !neutralRun) continue;
  const root = makeEl({ root: true, attrs: { ...th.attrs, ...mode.attrs, 'data-kind': 'adult', 'data-accent': acc } });
  const g = n => colour(get(root, n));
  const ctx = { theme: th.id, scheme: th.scheme, mode: mode.id, accent: acc };
  const bg = g('--bg'), surface = g('--surface');
  const over = (n, base) => C.over(g(n), base);
  if (neutralRun) {
    // neutral text on every opaque surface
    const surfs = ['--bg', '--surface', '--surface-2', '--surface-elev', '--hover', '--fill'];
    for (const t of ['--text', '--text-2', '--text-3', '--muted', '--placeholder']) for (const s of surfs) pair(ctx, 'text', t, g(t), s, g(s), TEXT);
    // text on glass (chrome), composited over the page, a card, and busy content (every family's strong and fill-2)
    for (const gl of ['--glass-strong', '--glass']) {
      const bases = [['--bg', bg], ['--surface', surface], ...FAMILIES.flatMap(f => [[`--${f}-strong`, g(`--${f}-strong`)], [`--${f}-fill-2`, g(`--${f}-fill-2`)]])];
      for (const [bn, b] of bases) for (const t of (bn === '--bg' || bn === '--surface' ? ['--text', '--text-2', '--text-3'] : ['--text', '--text-2'])) pair(ctx, 'text-on-glass', t, g(t), `${gl} over ${bn}`, over(gl, b), TEXT);
      for (const [bn, b] of [['--bg', bg], ['--surface', surface]]) pair(ctx, 'text-on-glass', '--text-3', g('--text-3'), `${gl} over ${bn}`, over(gl, b), TEXT);
    }
    // toast
    for (const [bn, b] of [['--bg', bg], ['--surface', surface], ...FAMILIES.map(f => [`--${f}-fill-2`, g(`--${f}-fill-2`)])]) {
      pair(ctx, 'text', '--toast-ink', g('--toast-ink'), `--toast-bg over ${bn}`, over('--toast-bg', b), TEXT);
      pair(ctx, 'text', '--toast-action', g('--toast-action'), `--toast-bg over ${bn}`, over('--toast-bg', b), TEXT);
    }
    // non-text controls and states
    for (const s of ['--bg', '--surface', '--surface-2', '--surface-elev']) {
      pair(ctx, 'non-text', '--field-border', g('--field-border'), s, g(s), NONTEXT);
      pair(ctx, 'non-text', '--cell-empty-border', g('--cell-empty-border'), s, g(s), NONTEXT);
      pair(ctx, 'non-text', '--switch-off', g('--switch-off'), s, g(s), NONTEXT);
      pair(ctx, 'non-text', '--switch-on', g('--switch-on'), s, g(s), NONTEXT);
      for (const st of ['--status-synced', '--status-pending', '--status-offline', '--status-error']) pair(ctx, 'non-text', st, g(st), s, g(s), NONTEXT);
      pair(ctx, 'non-text', '--text-3 (select chevron)', g('--text-3'), s, g(s), NONTEXT);
    }
    for (const st of ['--status-synced', '--status-pending', '--status-offline', '--status-error']) pair(ctx, 'non-text', st, g(st), '--glass-strong over --bg (tab bar)', over('--glass-strong', bg), NONTEXT);
    pair(ctx, 'non-text', '--switch-knob', g('--switch-knob'), '--switch-off', g('--switch-off'), NONTEXT);
    pair(ctx, 'non-text', '--switch-knob', g('--switch-knob'), '--switch-on', g('--switch-on'), NONTEXT);
    // hue and semantic families
    for (const f of FAMILIES) {
      const fill = g(`--${f}-fill`), fill2 = g(`--${f}-fill-2`), ink = g(`--${f}-ink`), strong = g(`--${f}-strong`);
      const fctx = { ...ctx, family: f };
      for (const [bn, b] of [[`--${f}-fill`, fill], [`--${f}-fill-2`, fill2], ['--bg', bg], ['--surface', surface], ['--surface-2', g('--surface-2')], ['--surface-elev', g('--surface-elev')]]) pair(fctx, 'text', `--${f}-ink`, ink, bn, b, TEXT);
      pair(fctx, 'text', `--${f} (bare = legacy colour: var(--hue))`, g(`--${f}`), '--surface', surface, TEXT);
      pair(fctx, 'text', `--${f} (bare)`, g(`--${f}`), '--bg', bg, TEXT);
      for (const [t, bs] of [['--text', [[`--${f}-fill`, fill], [`--${f}-fill-2`, fill2]]], ['--text-2', [[`--${f}-fill`, fill]]]]) for (const [bn, b] of bs) pair(fctx, 'text', t, g(t), bn, b, TEXT);
      for (const [bn, b] of [['--bg', bg], ['--surface', surface], ['--surface-2', g('--surface-2')], ['--surface-elev', g('--surface-elev')], ['--track', g('--track')]]) pair(fctx, 'non-text', `--${f}-strong`, strong, bn, b, NONTEXT);
      pair(fctx, 'text', `--on-${f}`, g(`--on-${f}`), `--${f} (solid)`, g(`--${f}`), TEXT);
      pair(fctx, 'non-text', `--${f}-ink (tile icon)`, ink, `--${f}-fill-2 (tile end)`, fill2, NONTEXT);
      // structural: dark chips must separate from the card; light fills keep house chroma
      if (th.scheme === 'dark') { const r = C.contrast(fill, surface); rec({ ...fctx, kind: 'separation', fg: `--${f}-fill`, bg: '--surface', fgHex: hexOf(fill), bgHex: hexOf(surface), ratio: +r.toFixed(2), min: 1.4, pass: r >= 1.4 }); }
      else if (f !== 'graphite') { const cc = C.oklch(fill).C; rec({ ...fctx, kind: 'chroma', fg: `--${f}-fill`, fgHex: hexOf(fill), ratio: +cc.toFixed(3), min: 0.055, pass: cc >= 0.055, note: 'OKLCH chroma of the pastel fill (house 0.057-0.093)' }); }
    }
    // palette structure
    const s1 = C.contrast(surface, bg), s2 = C.contrast(g('--surface-2'), surface);
    rec({ ...ctx, kind: 'separation', fg: '--surface', bg: '--bg', ratio: +s1.toFixed(2), min: th.scheme === 'dark' ? 1.2 : 1.05, pass: s1 >= (th.scheme === 'dark' ? 1.2 : 1.05), note: 'card off the page' });
    rec({ ...ctx, kind: 'separation', fg: '--surface-2', bg: '--surface', ratio: +s2.toFixed(2), min: 1.05, pass: s2 >= 1.05 && (th.scheme === 'light' || C.lum(g('--surface-2')) > C.lum(surface)), note: th.scheme === 'dark' ? 'well lighter than the card' : 'well off the card' });
    // semantic separation
    for (const role of ['strong', 'ink']) {
      const a = g(`--ok-${role}`), b = g(`--danger-${role}`); const lr = (Math.max(C.lum(a), C.lum(b)) + 0.05) / (Math.min(C.lum(a), C.lum(b)) + 0.05);
      rec({ ...ctx, kind: 'semantic', fg: `--ok-${role}`, bg: `--danger-${role}`, ratio: +lr.toFixed(2), min: 1.3, pass: lr >= 1.3, note: 'success vs destructive luminance ratio' });
    }
    for (const s of ['danger', 'warn', 'ok']) for (const h of PERSON_HUES) {
      const d = C.de00(g(`--${s}-strong`), g(`--${h}-strong`));
      rec({ ...ctx, kind: 'semantic', fg: `--${s}-strong`, bg: `--${h}-strong`, ratio: +d.toFixed(1), min: 10, pass: d >= 10, note: 'CIEDE2000, normal vision: a status never reads as a person' });
    }
    // CVD separation of the person accents (their graphic tone: rings, avatar rings, markers)
    for (const k of ['normal', 'protan', 'deutan', 'tritan']) for (let i = 0; i < PERSON_HUES.length; i++) for (let j = i + 1; j < PERSON_HUES.length; j++) {
      const a = PERSON_HUES[i], b = PERSON_HUES[j];
      const d = C.de00(C.simulate(g(`--${a}-strong`), k), C.simulate(g(`--${b}-strong`), k));
      const gated = k !== 'tritan';
      rec({ ...ctx, kind: 'cvd', vision: k, fg: `--${a}-strong`, bg: `--${b}-strong`, people: `${HOUSEHOLD[a]} / ${HOUSEHOLD[b]}`, ratio: +d.toFixed(1), min: gated ? 10 : 0, pass: gated ? d >= 10 : true, note: gated ? 'gated' : 'reported only' });
      if (mode.id === 'default') for (const role of ['fill', 'ink']) {
        const d2 = C.de00(C.simulate(g(`--${a}-${role}`), k), C.simulate(g(`--${b}-${role}`), k));
        rec({ ...ctx, kind: 'cvd-info', vision: k, fg: `--${a}-${role}`, bg: `--${b}-${role}`, people: `${HOUSEHOLD[a]} / ${HOUSEHOLD[b]}`, ratio: +d2.toFixed(1), min: 0, pass: true, note: 'reported only: fills and inks always carry a name, initial or face' });
      }
    }
  }
  // person-accent pairs (every accent, default mode)
  if (mode.id === 'default' || neutralRun) {
    const actx = { ...ctx, family: 'accent:' + acc };
    const deep = g('--accent-deep');
    for (const s of ['--bg', '--surface', '--surface-2', '--surface-elev', '--accent-soft', '--accent-tint', '--sel-fill', '--hero-btn-bg']) pair(actx, 'text', '--accent-deep', deep, s, g(s), TEXT);
    pair(actx, 'text', '--on-accent', g('--on-accent'), '--accent-deep (.btn-primary)', deep, TEXT);
    pair(actx, 'text', '--on-accent', g('--on-accent'), '.btn-primary top stop: color-mix(--accent-deep 88%, white)', C.mix('srgb', deep, 88, C.parseHex('#FFFFFF'), 12), TEXT);
    for (const [t, ss] of [['--text', ['--accent-soft', '--accent-tint']], ['--text-2', ['--accent-soft']], ['--hero-ink-2', ['--accent-soft', '--accent-tint']]]) for (const s of ss) pair(actx, 'text', t, g(t), s, g(s), TEXT);
    pair(actx, 'text', '--sel-ink', g('--sel-ink'), '--sel-fill', g('--sel-fill'), TEXT);
    for (const t of ['--text', '--text-2', '--text-3', '--accent-deep']) for (const s of ['--paper-tint', '--surface-tint', '--well-tint']) pair(actx, 'text', t, g(t), s, g(s), TEXT);
    for (const s of ['--accent-soft', '--accent-tint']) pair(actx, 'text', '--hero-ink', g('--hero-ink'), `${s} (hero gradient stop)`, g(s), TEXT);
    pair(actx, 'text', '--hero-btn-ink', g('--hero-btn-ink'), '--hero-btn-bg', g('--hero-btn-bg'), TEXT);
    pair(actx, 'text', '--tint-ink', g('--tint-ink'), '--surface', surface, TEXT);
    pair(actx, 'text', '--tint-ink', g('--tint-ink'), '--bg', bg, TEXT);
    pair(actx, 'text', '--text (::selection)', g('--text'), '--accent-tint', g('--accent-tint'), TEXT);
    for (const s of ['--bg', '--surface', '--surface-2', '--surface-elev', '--track']) pair(actx, 'non-text', '--accent (graphic: rings, bars)', g('--accent'), s, g(s), NONTEXT);
    for (const s of ['--bg', '--surface', '--surface-2']) pair(actx, 'non-text', '--focus-ring-color', g('--focus-ring-color'), s, g(s), NONTEXT);
    pair(actx, 'non-text', '--today-ring', g('--today-ring'), '--surface', surface, NONTEXT);
    pair(actx, 'non-text', '--today-ring', g('--today-ring'), '--surface-2', g('--surface-2'), NONTEXT);
    pair(actx, 'non-text', '--sel-indicator', g('--sel-indicator'), '--glass-strong over --bg (tab bar)', over('--glass-strong', bg), NONTEXT);
    pair(actx, 'non-text', '--tint-ink (tile icon)', g('--tint-ink'), '--tint-fill-2 (tile end)', g('--tint-fill-2'), NONTEXT);
    pair(actx, 'large-text', '--accent (graphic) as large numerals', g('--accent'), '--surface', surface, LARGE);
  }
}

// preview swatches (.tp) resolve exactly as their themes, under a page of the opposite scheme
for (const [prev, host, same, half] of [['frost', 'midnight', 'frost'], ['hearth', 'forest', 'hearth'], ['parchment', 'graphite', 'parchment'], ['midnight', 'hearth', 'midnight'], ['forest', 'frost', 'forest'], ['graphite', 'parchment', 'graphite'], ['system', 'midnight', 'system-light'], ['system', 'hearth', 'system-dark', true]]) {
  const root = makeEl({ root: true, attrs: { 'data-theme': host, 'data-scheme': ['midnight', 'forest', 'graphite'].includes(host) ? 'dark' : 'light', 'data-accent': 'mint' } });
  let el = makeEl({ classes: ['tp'], attrs: { 'data-preview': prev }, parent: root });
  if (half) el = makeEl({ classes: ['tp-half'], parent: el });
  const ref = THEMES.find(t => t.id === same);
  const real = makeEl({ root: true, attrs: { ...ref.attrs, 'data-accent': 'mint' } });
  const toks = ['--bg', '--surface', '--surface-2', '--text', '--text-3', '--field-border', '--mint-fill', '--mint-ink', '--mint-strong', '--accent-soft', '--accent-deep', '--accent-tint', '--ok-ink', '--danger-fill', '--focus-ring-color', '--glass-strong'];
  const diff = toks.filter(t => hexOf(colour(get(el, t))) !== hexOf(colour(get(real, t))));
  rec({ kind: 'preview', theme: prev + (half ? ' (night half)' : ''), host, fg: toks.length + ' tokens', ratio: toks.length - diff.length, min: toks.length, pass: diff.length === 0, note: diff.length ? 'differs: ' + diff.join(' ') : 'swatch = theme' });
}
// a person scope (data-tint) inside another person's page re-derives its own accent tokens
{
  const root = makeEl({ root: true, attrs: { 'data-theme': 'system', 'data-scheme': 'light', 'data-accent': 'periwinkle' } });
  const chip = makeEl({ attrs: { 'data-tint': 'bubblegum' }, parent: root });
  const ok = hexOf(colour(get(chip, '--accent-soft'))) === hexOf(colour(get(root, '--bubblegum-fill'))) && hexOf(colour(get(chip, '--accent-deep'))) === hexOf(colour(get(root, '--bubblegum-ink'))) && hexOf(colour(get(chip, '--focus-ring-color'))) === hexOf(colour(get(root, '--bubblegum-ink')));
  rec({ kind: 'scope', fg: '[data-tint=bubblegum] inside [data-accent=periwinkle]', ratio: ok ? 1 : 0, min: 1, pass: ok, note: 'soft, deep and focus re-derive locally (GAP-TOK-6)' });
}

// ── 6. scales: type floors, targets, grid, concentric radii, durations ───────────────────────────
const ROLES = ['--fs-large-title', '--fs-title-1', '--fs-title-2', '--fs-title-3', '--fs-headline', '--fs-body', '--fs-callout', '--fs-subhead', '--fs-footnote', '--fs-caption-1', '--fs-caption-2', '--fs-xs', '--fs-sm', '--fs-md'];
const DT = { '--fs-large-title': 34, '--fs-title-1': 28, '--fs-title-2': 22, '--fs-title-3': 20, '--fs-headline': 17, '--fs-body': 17, '--fs-callout': 16, '--fs-subhead': 15, '--fs-footnote': 13, '--fs-caption-1': 12, '--fs-caption-2': 11 };
const sizes = [];
for (const kind of ['adult', 'kid', 'kiosk']) for (const vw of kind === 'kiosk' ? [1920] : [430, 820, 1440]) for (const ts of ['m', 'xxl']) {
  const root = makeEl({ root: true, viewport: vw, attrs: { 'data-theme': 'system', 'data-scheme': 'light', 'data-kind': kind, 'data-text-size': ts, 'data-accent': 'mint' } });
  const px = n => len(get(root, n), vw);
  const floor = kind === 'kid' ? 16 : kind === 'kiosk' ? 28 : 11;
  const row = { kind: 'scale', theme: 'system-light', people: kind, viewport: vw, textSize: ts };
  const sz = {}; for (const r of ROLES) sz[r] = +px(r).toFixed(2);
  sizes.push({ kind, vw, ts, ...sz, tap: px('--tap'), tapLg: px('--tap-lg'), padCard: px('--pad-card'), rControl: px('--r-control'), rCard: px('--r-card'), margin: px('--margin'), iconMd: px('--icon-md'), field: px('--fs-field') });
  for (const r of ROLES) rec({ ...row, fg: r, ratio: sz[r], min: floor, pass: sz[r] >= floor - 0.01, note: 'px, the floor for this kind' });
  if (kind === 'adult' && vw === 430 && ts === 'm') for (const [r, v] of Object.entries(DT)) rec({ ...row, fg: r + ' = Dynamic Type', ratio: sz[r], min: v, pass: Math.abs(sz[r] - v) < 0.01, note: 'iPhone size equals the iOS Dynamic Type default' });
  rec({ ...row, fg: '--fs-field', ratio: px('--fs-field'), min: 16, pass: px('--fs-field') >= 16, note: 'no iOS focus zoom' });
  const tapMin = kind === 'kid' ? 64 : 44;
  rec({ ...row, fg: '--tap', ratio: px('--tap'), min: tapMin, pass: px('--tap') >= tapMin });
  rec({ ...row, fg: '--tap-lg', ratio: px('--tap-lg'), min: tapMin + 16, pass: px('--tap-lg') >= tapMin + 16 });
  for (const t of ['--margin', '--pad-card', '--pad-row-y', '--pad-row-x', '--pad-sheet', '--gap-list', '--gap-grid', '--btn-pad-x']) { const v = px(t); rec({ ...row, fg: t, ratio: v, min: 0, pass: v % 4 === 0, note: 'on the 4 pt grid' }); }
  const rc = px('--r-card'), conc = px('--r-control') + px('--pad-card');
  rec({ ...row, fg: '--r-card', ratio: rc, min: conc, pass: Math.abs(rc - conc) < 0.01, note: 'concentric: card radius = control radius + card padding' });
  const inner = len(substitute(root, 'max(0px, calc(var(--r-card) - var(--pad-card)))', new Set()), vw);
  rec({ ...row, fg: '--r-inner (default)', ratio: inner, min: px('--r-control'), pass: Math.abs(inner - px('--r-control')) < 0.01, note: 'the helper returns the control radius inside a card' });
}
{
  const root = makeEl({ root: true, attrs: { 'data-theme': 'system', 'data-scheme': 'light', 'data-accent': 'mint' } });
  for (const d of ['--dur-1', '--dur-2', '--dur-3', '--dur-spring-snappy', '--dur-spring-gentle', '--dur-spring-bouncy']) { const v = len(get(root, d), 820); const lo = d === '--dur-1' ? 100 : 200; rec({ kind: 'motion', fg: d, ratio: v, min: lo, pass: v >= lo && v <= 350, note: 'ms, inside the house range (press/fade steps may be shorter)' }); }
  for (const p of ['--press-scale']) { const v = +get(root, p); rec({ kind: 'motion', fg: p, ratio: v, min: 0.97, pass: Math.abs(v - 0.97) < 1e-9 }); }
  const red = makeEl({ root: true, attrs: { 'data-theme': 'system', 'data-scheme': 'light', 'data-accent': 'mint', 'data-motion': 'reduce' } });
  const ok = len(get(red, '--rise'), 820) === 0 && get(red, '--ambient-cycles').trim() === '0';
  rec({ kind: 'motion', fg: '[data-motion=reduce]', ratio: ok ? 1 : 0, min: 1, pass: ok, note: 'no travel, no ambient loops; opacity crossfades keep their durations' });
}

// ── 7. report ──────────────────────────────────────────────────────────────────────────────────
const byKind = {}; for (const r of results) { const k = r.kind; byKind[k] ??= { checks: 0, fails: 0, min: null }; byKind[k].checks++; if (!r.pass) byKind[k].fails++; if (r.min > 0 && ['text', 'text-on-glass', 'non-text', 'large-text'].includes(k)) byKind[k].min = byKind[k].min === null ? r.ratio : Math.min(byKind[k].min, r.ratio); }
const gated = results.filter(r => r.kind !== 'cvd-info' && !(r.kind === 'cvd' && r.min === 0));
const lowest = (kind, n = 8) => results.filter(r => r.kind === kind).sort((a, b) => a.ratio / a.min - b.ratio / b.min).slice(0, n).map(r => ({ theme: r.theme, mode: r.mode, accent: r.accent, fg: r.fg, bg: r.bg, ratio: r.ratio, min: r.min }));
const cvd = {}; for (const r of results.filter(r => r.kind === 'cvd' || r.kind === 'cvd-info')) { const key = `${r.theme}|${r.kind === 'cvd' ? 'strong' : r.fg.split('-').pop()}|${r.vision}`; if (r.mode !== 'default') continue; cvd[key] = Math.min(cvd[key] ?? 99, r.ratio); }
const summary = {
  file, generatedAt: new Date().toISOString(), rules: rules.length,
  pairs: gated.length, failing: gated.filter(r => !r.pass).length,
  byKind, lowestText: lowest('text'), lowestGlass: lowest('text-on-glass'), lowestNonText: lowest('non-text'),
  cvdMinByThemeRoleVision: cvd, sizes,
};
const out = { summary, results };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ rules: summary.rules, pairs: summary.pairs, failing: summary.failing, byKind }, null, 0));
for (const r of results.filter(r => !r.pass).slice(0, 60)) console.log('FAIL', r.kind, r.theme, r.mode || '', r.accent || '', r.fg, 'on', r.bg || '', r.ratio, '<', r.min, r.note || '');
process.exit(summary.failing ? 1 : 0);
