#!/usr/bin/env node
// Phase 4 token proposal "access": verification by computation.
//   node audits/tools/phase4/tokens/access/contrast.mjs <tokens.css> [out.json]
// Parses the proposed tokens.css, resolves the cascade for every state of <html>
// (theme x contrast x transparency x accent x kind x size class x text size), and checks:
//   A neutral text pairs, B neutral non-text, C hue families, D semantic families and ramps,
//   E person-accent roles on every surface they are used on, F colour-vision separation of the
//   person hues (Machado 2009 dichromacy, CIEDE2000), G TV board, H kids, I motion, J type floors, K targets.
// No pair may fail. Exit code 1 if any does. No network, no browser: pure token maths.
import fs from 'node:fs';
import path from 'node:path';
import * as C from './color.mjs';

const cssPath = process.argv[2];
const outPath = process.argv[3];
if (!cssPath) { console.error('usage: node contrast.mjs <tokens.css> [out.json]'); process.exit(2); }
const src = fs.readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. a small CSS parser: top-level rules and one level of @media ─────────────────────────────
const rules = [];
function parseBlock(text, media) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i); if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (depth && j < text.length) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@media')) parseBlock(body, head.slice(6).trim());
    else {
      const decls = {};
      for (const m of body.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) decls[m[1]] = m[2].trim();
      rules.push({ selectors: head.split(',').map(s => s.trim()), decls, media, order: rules.length });
    }
    i = j;
  }
}
parseBlock(src, null);

// ── 2. selector matching against <html> with a set of attributes ────────────────────────────────
function matchCompound(sel, attrs) {
  if (!sel) return null;
  let spec = 0, rest = sel;
  if (rest.startsWith(':root')) { spec++; rest = rest.slice(5); }
  else if (/^[.\w]/.test(rest)) return null;                // classes / type selectors are not <html>
  for (const m of rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    spec++;
    const v = attrs[m[1]];
    if (v === undefined) return null;
    if (m[2] !== undefined && v !== m[2]) return null;
  }
  if (rest.replace(/\[[^\]]*\]/g, '').trim()) return null;   // anything else (descendants, pseudo) does not match html
  return spec;
}
function mediaOk(media, st) {
  if (!media) return true;
  const m = media.match(/min-width:\s*(\d+)px/);
  return m ? st.width >= +m[1] : false;
}
function computed(st) {
  const attrs = { 'data-theme': st.theme, 'data-scheme': st.scheme, 'data-accent': st.accent, 'data-contrast': st.contrast, 'data-transparency': st.transparency, 'data-kind': st.kind, 'data-motion': st.motion };
  if (st.textSize) attrs['data-text-size'] = st.textSize;
  const hits = [];
  for (const r of rules) {
    if (!mediaOk(r.media, st)) continue;
    let best = null;
    for (const s of r.selectors) { const sp = matchCompound(s, attrs); if (sp !== null && (best === null || sp > best)) best = sp; }
    if (best !== null) hits.push({ r, spec: best });
  }
  hits.sort((a, b) => a.spec - b.spec || a.r.order - b.r.order);
  const map = {};
  for (const h of hits) Object.assign(map, h.r.decls);
  return map;
}
function resolve(map, name, seen = new Set()) {
  if (seen.has(name)) throw new Error('cycle at ' + name);
  seen.add(name);
  const v = map[name];
  if (v === undefined) return undefined;
  return subst(map, v, seen);
}
function subst(map, v, seen) {
  let guard = 0;
  while (v.includes('var(') && guard++ < 50) {
    v = v.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/, (_, n, fb) => { const r = resolve(map, n, new Set(seen)); return r !== undefined ? r : (fb !== undefined ? fb : 'UNDEFINED(' + n + ')'); });
  }
  return v;
}
const colour = (map, name) => {
  const v = resolve(map, name);
  if (v === undefined || /UNDEFINED/.test(v)) throw new Error('undefined token ' + name + ' -> ' + v);
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return C.parse(v);
};
const opaque = (map, name, backdrop) => { const c = colour(map, name); return c.a < 1 ? C.over(c, backdrop || colour(map, '--bg')) : c; };

// ── 3. evaluation of numeric token expressions (px) ─────────────────────────────────────────────
function num(map, name) {
  let v = resolve(map, name);
  if (v === undefined) throw new Error('undefined ' + name);
  v = v.replace(/(-?[\d.]+)px/g, '$1').replace(/calc\(/g, '(').replace(/\bmax\(/g, 'Math.max(').replace(/\bmin\(/g, 'Math.min(');
  if (/[a-df-z%]/i.test(v.replace(/Math\.(max|min)/g, ''))) throw new Error('not numeric: ' + name + ' = ' + v);
  return Function('return (' + v + ')')();
}

// ── 4. states ───────────────────────────────────────────────────────────────────────────────────
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark' };   // hub.THEMES; system -> hearth | midnight
const HUES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender'];
const ACCENTS = [...HUES, 'graphite'];
const SEM = ['ok', 'warn', 'danger'];
const base = { kind: 'adult', motion: 'full', width: 430 };
const results = new Map();   // check id -> { threshold, rows: [] }
let pairs = 0, failing = 0;
function check(id, threshold, state, fgName, bgName, ratio, fgHex, bgHex, note) {
  pairs++;
  const pass = ratio >= threshold - 1e-9;
  if (!pass) failing++;
  if (!results.has(id)) results.set(id, { threshold, note, rows: [] });
  results.get(id).rows.push([state, fgName, bgName, fgHex, bgHex, +ratio.toFixed(2), pass]);
}
const key = st => [st.theme, st.contrast, st.transparency, st.accent].join('/');
const surfacesOf = map => {
  const bg = colour(map, '--bg');
  const glassWorst = map['--color-scheme'] === 'dark' ? C.parse('#FFFFFF') : C.parse('#000000');
  const scheme = resolve(map, 'color-scheme');
  const worst = scheme === 'dark' ? C.parse('#FFFFFF') : C.parse('#000000');
  return {
    '--bg': bg, '--surface': colour(map, '--surface'), '--surface-raised': colour(map, '--surface-raised'), '--well': colour(map, '--well'),
    '--glass-solid': colour(map, '--glass-solid'),
    'glass-over-page': opaque(map, '--glass-bg', bg),
    'glass-strong-over-page': opaque(map, '--glass-bg-strong', bg),
    'glass-over-worst': opaque(map, '--glass-bg', worst),
    'glass-strong-over-worst': opaque(map, '--glass-bg-strong', worst),
  };
};
const hx = c => C.hex(c);

for (const theme of Object.keys(THEMES)) for (const contrast of ['standard', 'more']) for (const transparency of ['normal', 'reduce']) {
  const scheme = THEMES[theme];
  const st0 = { ...base, theme, scheme, contrast, transparency, accent: 'graphite' };
  const map = computed(st0);
  const S = surfacesOf(map);
  const ks = key(st0).replace(/\/graphite$/, '');
  { // A0 cascade sanity: the theme's own block wins (its --bg is the one declared in the rule that names the theme)
    const own = rules.find(r => r.selectors.some(s => s.includes(`[data-theme="${theme}"]`)) && r.decls['--bg']);
    check('A0 cascade: data-theme resolves to its own neutrals', 1, ks, '--bg', theme, own && own.decls['--bg'] === resolve(map, '--bg') ? 1 : 0, resolve(map, '--bg'), own ? own.decls['--bg'] : 'none');
    const fam = rules.find(r => r.selectors.includes(scheme === 'dark' ? '[data-scheme="dark"]' : '[data-scheme="light"]') && r.decls['--mint-graphic']);
    check('A0 cascade: data-scheme resolves to its own hue families', 1, ks, '--mint-graphic', scheme, fam && fam.decls['--mint-graphic'] === resolve(map, '--mint-graphic') ? 1 : 0, '', '');
  }
  if (resolve(map, 'color-scheme') !== scheme)check('theme.color-scheme-matches-hub.THEMES', 1, ks, 'color-scheme', scheme, 0, resolve(map, 'color-scheme'), scheme);
  const T = (id, thr, fg, bgs, note) => { const f = colour(map, fg); for (const b of bgs) { const bc = S[b]; const fc = f.a < 1 ? C.over(f, bc) : f; check(id, thr, ks, fg, b, C.contrast(fc, bc), hx(fc), hx(bc), note); } };
  const CORE = ['--bg', '--surface', '--surface-raised'];
  const ALL = [...CORE, '--well', '--glass-solid', 'glass-over-page', 'glass-strong-over-page'];
  // A. text
  T('A1 --text >= 7 (AAA) on every surface incl. glass over the worst backdrop', 7, '--text', [...ALL, 'glass-over-worst', 'glass-strong-over-worst']);
  T('A2 --text-2 >= 6 on page, card, sheet', 6, '--text-2', CORE);
  T('A3 --text-2 >= 4.5 on wells and every glass incl. worst backdrop', 4.5, '--text-2', ['--well', '--glass-solid', 'glass-over-page', 'glass-strong-over-page', 'glass-over-worst', 'glass-strong-over-worst']);
  T('A4 --text-3 >= 4.5 on every opaque surface and glass over the page (never on glass over photos)', 4.5, '--text-3', ALL);
  T('A5 --placeholder >= 4.5 on the field and every surface', 4.5, '--placeholder', ALL);
  { const tb = colour(map, '--toast-bg'), ti = colour(map, '--toast-ink'); check('A6 toast ink >= 7 on toast', 7, ks, '--toast-ink', '--toast-bg', C.contrast(ti, tb), hx(ti), hx(tb)); }
  // B. non-text
  T('B1 --edge (field border, switch off-track, empty cell, scrollbar) >= 3', 3, '--edge', ['--bg', '--surface', '--surface-raised', '--well']);
  T('B2 --field-border >= 3 on card and sheet', 3, '--field-border', ['--surface', '--surface-raised', '--bg']);
  T('B3 --control-off >= 3', 3, '--control-off', ['--surface', '--surface-raised', '--bg']);
  T('B4 --status-offline >= 3 on bars', 3, '--status-offline', ['--glass-solid', 'glass-over-page', 'glass-strong-over-page', '--surface']);
  for (const s of ['--status-synced', '--status-pending', '--status-error']) T('B5 sync status dots >= 3 on bars', 3, s, ['--glass-solid', 'glass-over-page', 'glass-strong-over-page', '--surface']);
  { const k = colour(map, '--switch-knob-off'), t = colour(map, '--control-off'); check('B6 switch knob (off) >= 3 on off-track', 3, ks, '--switch-knob-off', '--control-off', C.contrast(k, t), hx(k), hx(t)); }
  // B7 depth ladder
  { const bg = S['--bg'], sf = S['--surface'], rs = S['--surface-raised'], wl = S['--well'];
    const step = C.contrast(bg, sf); check('B7 card-vs-page step >= ' + (scheme === 'dark' ? '1.20 (dark)' : '1.10 (light)'), scheme === 'dark' ? 1.2 : 1.1, ks, '--surface', '--bg', step, hx(sf), hx(bg));
    if (scheme === 'dark') {
      check('B8 dark: sheet lighter than card (ratio >= 1.15)', 1.15, ks, '--surface-raised', '--surface', C.luminance(rs) > C.luminance(sf) ? C.contrast(rs, sf) : 0, hx(rs), hx(sf));
      check('B9 dark: well lighter than card (ratio > 1)', 1.0001, ks, '--well', '--surface', C.luminance(wl) > C.luminance(sf) ? C.contrast(wl, sf) : 0, hx(wl), hx(sf));
    } }
  // C/D. hue and semantic families on this theme's surfaces
  for (const h of [...HUES, 'graphite', ...SEM]) {
    const grp = SEM.includes(h) ? 'D' : 'C';
    const fill = colour(map, `--${h}-fill`), ink = colour(map, `--${h}-ink`), g = colour(map, `--${h}-graphic`), solid = colour(map, `--${h}-solid`), on = colour(map, `--${h}-on-solid`);
    check(`${grp}1 ${grp === 'C' ? 'hue' : 'semantic'} ink >= 4.5 on its own fill`, 4.5, ks, `--${h}-ink`, `--${h}-fill`, C.contrast(ink, fill), hx(ink), hx(fill));
    for (const b of ['--bg', '--surface', '--surface-raised', '--well']) check(`${grp}2 ${grp === 'C' ? 'hue' : 'semantic'} ink >= 4.5 on every surface`, 4.5, ks, `--${h}-ink`, b, C.contrast(ink, S[b]), hx(ink), hx(S[b]));
    for (const b of ['--bg', '--surface', '--surface-raised', '--well', '--glass-solid', 'glass-over-page']) check(`${grp}3 ${grp === 'C' ? 'hue' : 'semantic'} graphic >= 3 on every surface`, 3, ks, `--${h}-graphic`, b, C.contrast(g, S[b]), hx(g), hx(S[b]));
    { const tr = colour(map, '--track'); check(`${grp}4 graphic >= 3 on the bar track (progress fill vs trough)`, 3, ks, `--${h}-graphic`, '--track', C.contrast(g, tr), hx(g), hx(tr)); }
    check(`${grp}5 on-solid >= 4.5 on solid (filled buttons)`, 4.5, ks, `--${h}-on-solid`, `--${h}-solid`, C.contrast(on, solid), hx(on), hx(solid));
    for (const b of ['--bg', '--surface']) check(`${grp}6 solid button >= 3 against the surface`, 3, ks, `--${h}-solid`, b, C.contrast(solid, S[b]), hx(solid), hx(S[b]));
    if (grp === 'C') {
      const strong = colour(map, `--${h}-fill-strong`);
      check('C7 tile glyph (ink) >= 3 on the saturated tile stop', 3, ks, `--${h}-ink`, `--${h}-fill-strong`, C.contrast(ink, strong), hx(ink), hx(strong));
      if (scheme === 'dark') check('C8 dark chip fill >= 1.40 off the card', 1.4, ks, `--${h}-fill`, '--surface', C.contrast(fill, S['--surface']), hx(fill), hx(S['--surface']));
      if (h !== 'graphite') check('C9 fill chroma OKLCH C >= 0.055 (vibrant, never grey) x100', 5.5, ks, `--${h}-fill`, 'chroma', C.oklch(fill).C * 100, hx(fill), '');
      check('C10 text on selection (::selection) >= 4.5', 4.5, ks, '--text', `--${h}-fill`, C.contrast(colour(map, '--text'), fill), hx(colour(map, '--text')), hx(fill));
    }
  }
  { const ok = colour(map, '--ok-graphic'), dg = colour(map, '--danger-graphic'); check('D7 success vs destructive differ in lightness (luminance ratio >= 1.30)', 1.3, ks, '--ok-graphic', '--danger-graphic', C.contrast(ok, dg), hx(ok), hx(dg)); }
  { const bb = colour(map, '--badge-bg'), bi = colour(map, '--badge-ink'); check('D8 badge ink >= 4.5 on badge', 4.5, ks, '--badge-ink', '--badge-bg', C.contrast(bi, bb), hx(bi), hx(bb));
    check('D9 badge >= 3 against the card it sits on', 3, ks, '--badge-bg', '--surface', C.contrast(bb, S['--surface']), hx(bb), hx(S['--surface'])); }
  { const st = colour(map, '--star-stroke'); for (const b of ['--surface', '--bg', '--well']) check('H1 kids: star outline >= 3', 3, ks, '--star-stroke', b, C.contrast(st, S[b]), hx(st), hx(S[b])); }
  // E. every person accent on the surfaces it is used on
  for (const accent of ACCENTS) {
    const st = { ...st0, accent }; const m = computed(st); const Sa = surfacesOf(m); const k = key(st);
    const c = n => colour(m, n);
    // E0 cascade sanity: the accent the state asks for is the one that resolves (catches order/specificity mistakes)
    check('E0 cascade: data-accent resolves to its own hue family', 1, k, '--accent-hue', accent, resolve(m, '--accent-hue') === accent && C.hex(c('--accent-ink')) === C.hex(c(`--${accent}-ink`)) ? 1 : 0, resolve(m, '--accent-hue'), accent);
    const pair =(id, thr, fgN, bgN, bgC) => { const f = c(fgN), b = bgC || c(bgN); check(id, thr, k, fgN, bgN, C.contrast(f, b), hx(f), hx(b)); };
    for (const b of ['--bg', '--surface', '--surface-raised', '--well']) pair('E1 --accent-ink (links, labels, selected text) >= 4.5 on every surface', 4.5, '--accent-ink', b, Sa[b]);
    pair('E2 --accent-ink >= 4.5 on --accent-fill (chips, hero, selection)', 4.5, '--accent-ink', '--accent-fill');
    pair('E2 --sel-ink >= 4.5 on --sel-fill', 4.5, '--sel-ink', '--sel-fill');
    pair('E3 hero text >= 4.5 on hero', 4.5, '--hero-ink', '--hero-bg');
    pair('E4 hero button label >= 4.5 on hero button', 4.5, '--hero-btn-ink', '--hero-btn-bg');
    pair('E5 hero button >= 3 against the hero', 3, '--hero-btn-bg', '--hero-bg');
    pair('E6 primary button label >= 4.5', 4.5, '--accent-on-solid', '--accent-solid');
    for (const g of ['--focus-color', '--sel-indicator', '--today-ring', '--accent-graphic', '--accent'])
      for (const b of ['--bg', '--surface', '--surface-raised', '--well', '--glass-solid', 'glass-over-page', 'glass-strong-over-page'])
        pair('E7 accent graphics (focus ring, selection indicator, today ring, rings, legacy --accent) >= 3 on every surface', 3, g, b, Sa[b]);
    pair('E8 switch on-track >= 3 against the card', 3, '--switch-on', '--surface', Sa['--surface']);
    pair('E9 switch knob (on) >= 3 on the on-track', 3, '--switch-knob-on', '--switch-on');
    pair('E10 toast action (pastel) >= 4.5 on toast', 4.5, '--toast-action', '--toast-bg');
  }
}

// F. colour-vision separation of the person hues (graphic role: rings, arcs, markers; fill role: chips)
const cvd = {};
for (const scheme of ['light', 'dark']) {
  const theme = scheme === 'light' ? 'hearth' : 'midnight';
  const map = computed({ ...base, theme, scheme, contrast: 'standard', transparency: 'normal', accent: 'graphite' });
  for (const role of ['graphic', 'fill']) {
    const cols = Object.fromEntries(HUES.map(h => [h, colour(map, `--${h}-${role}`)]));
    for (const kind of ['normal', 'protan', 'deutan', 'tritan']) {
      let min = 99, at = '';
      const rows = [];
      for (let i = 0; i < HUES.length; i++) for (let j = i + 1; j < HUES.length; j++) {
        const d = C.de2000(C.cvd(cols[HUES[i]], kind), C.cvd(cols[HUES[j]], kind));
        rows.push([HUES[i] + '/' + HUES[j], +d.toFixed(2)]);
        if (d < min) { min = d; at = HUES[i] + '/' + HUES[j]; }
      }
      cvd[`${scheme}.${role}.${kind}`] = { min: +min.toFixed(2), closest: at, pairsUnder10: rows.filter(r => r[1] < 10).length, rows };
      // gates: graphic role must stay >= 10 for normal, protanopia, deuteranopia; >= 5 for tritanopia (rare; also always paired with a face).
      // fill role must stay >= 10 for normal vision; under dichromacy pastels cannot be separated (reported, not gated: chips
      // always carry the graphic-role ring and a face).
      if (role === 'graphic') {
        const thr = kind === 'tritan' ? 5 : 10;
        for (const [p, d] of rows) check(`F1 person hues, ring/marker role, pairwise CIEDE2000 >= ${thr} (${kind})`, thr, scheme, p, kind, d, '', '');
      } else if (kind === 'normal') for (const [p, d] of rows) check('F2 person hues, chip-fill role, pairwise CIEDE2000 >= 10 (normal vision)', 10, scheme, p, 'normal', d, '', '');
    }
  }
  // semantic ramp distinctness (wait bands, freshness): ok / warn / danger / graphite graphics
  const R = ['ok', 'warn', 'danger', 'graphite'];
  for (const kind of ['normal', 'protan', 'deutan']) for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const d = C.de2000(C.cvd(colour(map, `--${R[i]}-graphic`), kind), C.cvd(colour(map, `--${R[j]}-graphic`), kind));
    check(`F3 semantic ramp steps pairwise CIEDE2000 >= 10 (${kind})`, 10, scheme, `${R[i]}/${R[j]}`, kind, d, '', '');
  }
  // semantic vs person hues: a status colour must not be mistaken for a person's colour (normal vision; under
  // dichromacy the glyph + word rule carries it). Gate >= 10 on the graphic role.
  cvd[`${scheme}.semantic-vs-person`] = SEM.map(s => ({ semantic: s, nearest: HUES.map(h => [h, +C.de2000(colour(map, `--${s}-graphic`), colour(map, `--${h}-graphic`)).toFixed(1)]).sort((a, b) => a[1] - b[1])[0] }));
  for (const s of SEM) for (const h of HUES) check('F4 semantic graphic vs every person graphic CIEDE2000 >= 10 (normal vision)', 10, scheme, `${s}/${h}`, 'normal', C.de2000(colour(map, `--${s}-graphic`), colour(map, `--${h}-graphic`)), '', '');
}

// G. TV board over album photos (kiosk, both TV-capable themes)
for (const theme of Object.keys(THEMES)) {
  const map = computed({ ...base, kind: 'kiosk', theme, scheme: THEMES[theme], contrast: 'standard', transparency: 'normal', accent: 'graphite', width: 1920 });
  const panel = colour(map, '--tv-panel');
  for (const photo of ['#FFFFFF', '#F2E6C8', '#000000']) {
    const bgc = C.over(panel, C.parse(photo));
    for (const [t, thr] of [['--tv-text', 7], ['--tv-text-2', 4.5]]) { const f = colour(map, t); check(`G1 TV ${t} >= ${thr} on the scrim panel over any photo`, thr, theme + '/kiosk/photo' + photo, t, 'tv-panel', C.contrast(f, bgc), C.hex(f), C.hex(bgc)); }
  }
}

// I. motion: springs inside the house range, bounded overshoot; reduce variants are crossfades
{
  const map = computed({ ...base, theme: 'hearth', scheme: 'light', contrast: 'standard', transparency: 'normal', accent: 'graphite' });
  for (const k of ['snappy', 'smooth', 'bouncy']) {
    const pts = resolve(map, `--spring-${k}`).replace(/^linear\(|\)$/g, '').split(',').map(Number);
    const over = (Math.max(...pts) - 1) * 100;
    check('I1 spring overshoot <= 5 % (score = 5 - overshoot)', 0, 'motion', `--spring-${k}`, 'overshoot', 5 - over, '', '');
    check('I2 spring starts at 0 and ends at 1', 1, 'motion', `--spring-${k}`, 'endpoints', pts[0] === 0 && pts[pts.length - 1] === 1 ? 1 : 0, '', '');
    const d = parseFloat(resolve(map, `--dur-${k}`));
    check('I3 spring settle time within 200-350 ms (score = 1 if inside)', 1, 'motion', `--dur-${k}`, d + 'ms', d >= 200 && d <= 350 ? 1 : 0, '', '');
  }
  for (const k of ['--dur-1', '--dur-2', '--dur-3']) { const d = parseFloat(resolve(map, k)); check('I4 UI durations <= 350 ms', 1, 'motion', k, d + 'ms', d <= 350 ? 1 : 0, '', ''); }
  const r = computed({ ...base, motion: 'reduce', theme: 'hearth', scheme: 'light', contrast: 'standard', transparency: 'normal', accent: 'graphite' });
  check('I5 reduce motion: press scale 1, distance 0, no ambient cycles', 1, 'motion/reduce', 'press/distance/ambient', '', (resolve(r, '--press-scale') === '1' && resolve(r, '--motion-distance') === '0' && resolve(r, '--ambient-cycles') === '0') ? 1 : 0, '', '');
}

// J. type floors and K. targets for every kind x size class x text-size
const typeRows = [];
{
  const ROLES = ['large-title', 'title-1', 'title-2', 'title-3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption-1', 'caption-2', 'field', 'glance-3', 'glance-2', 'glance-1'];
  for (const kind of ['adult', 'kid', 'kiosk']) for (const width of [430, 820, 1920]) for (const ts of [undefined, 'xs', 'm', 'xxl']) {
    if (kind === 'kiosk' && width !== 1920) continue;
    const map = computed({ ...base, kind, width, textSize: ts, theme: 'hearth', scheme: 'light', contrast: 'standard', transparency: 'normal', accent: 'graphite' });
    const floor = kind === 'kid' ? 16 : kind === 'kiosk' ? 28 : 11;
    const row = { kind, width, textSize: ts || 'default' };
    for (const r of ROLES) { const px = num(map, `--fs-${r}`); row[r] = +px.toFixed(1); check(`J1 type role >= floor (${kind}: ${floor} px)`, floor, `${kind}/${width}/${ts || 'default'}`, `--fs-${r}`, 'px', px, '', ''); }
    check('J2 fields never below 16 px (no iOS zoom)', 16, `${kind}/${width}/${ts || 'default'}`, '--fs-field', 'px', num(map, '--fs-field'), '', '');
    if (kind === 'kiosk') check('J3 TV information text (body) >= 32 px at 1080p', 32, `${kind}/${width}/${ts || 'default'}`, '--fs-body', 'px', num(map, '--fs-body'), '', '');
    const tap = num(map, '--tap'), lg = num(map, '--tap-lg'); row.tap = tap; row['tap-lg'] = lg;
    check(`K1 minimum target (${kind === 'kid' ? 64 : 44} px)`, kind === 'kid' ? 64 : 44, `${kind}/${width}/${ts || 'default'}`, '--tap', 'px', tap, '', '');
    check('K2 primary target >= 60 px', 60, `${kind}/${width}/${ts || 'default'}`, '--tap-lg', 'px', lg, '', '');
    check('K3 concentric: --r-card == --r-control + --pad-card', 1, `${kind}/${width}/${ts || 'default'}`, '--r-card', 'calc', Math.abs(num(map, '--r-card') - (num(map, '--r-control') + num(map, '--pad-card'))) < 0.01 ? 1 : 0, '', '');
    typeRows.push(row);
  }
}

// resolved role values for the WebKit cross-check (cascade-check.mjs)
const resolved = {};
{ const ROLES = ['--text', '--text-2', '--text-3', '--bg', '--surface', '--surface-raised', '--well', '--edge', '--accent-ink', '--accent-fill', '--accent-graphic', '--accent-solid', '--accent-on-solid', '--focus-color', '--sel-fill', '--hero-btn-bg', '--hero-btn-ink', '--switch-on', '--switch-knob-on', '--toast-action'];
  for (const theme of Object.keys(THEMES)) for (const accent of ACCENTS) { const st = { ...base, theme, scheme: THEMES[theme], contrast: 'standard', transparency: 'normal', accent }; const m = computed(st); resolved[key(st)] = Object.fromEntries(ROLES.map(r => [r, C.hex(colour(m, r))])); } }

// ── 5. report ───────────────────────────────────────────────────────────────────────────────────
const checks = [...results.entries()].map(([id, r]) => {
  const worst = r.rows.reduce((a, b) => (b[5] - r.threshold) < (a[5] - r.threshold) ? b : a);
  return { id, threshold: r.threshold, pairs: r.rows.length, failing: r.rows.filter(x => !x[6]).length, min: worst[5], worst: { state: worst[0], fg: worst[1], bg: worst[2], fgHex: worst[3], bgHex: worst[4] }, fails: r.rows.filter(x => !x[6]) };
});
const out = {
  generated: new Date().toISOString(), source: path.resolve(cssPath), script: 'audits/tools/phase4/tokens/access/contrast.mjs',
  method: 'WCAG 2.x relative luminance; alpha composited in sRGB; glass measured over the page and over the worst backdrop (black under light glass, white under dark glass), unblurred; CVD = Machado, Oliveira & Fernandes 2009 at severity 1.0 in linear sRGB; distance = CIEDE2000 (D65). Themes = hub.THEMES (system resolves to hearth / midnight).',
  summary: { pairs, failing, checks: checks.length },
  checks: checks.map(({ fails, ...c }) => ({ ...c, fails: fails.slice(0, 20) })),
  cvd, type: typeRows, resolved,
};
if (outPath) fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
for (const c of checks) console.log((c.failing ? 'FAIL ' : 'ok   ') + c.id.padEnd(112).slice(0, 112) + ' n=' + String(c.pairs).padStart(5) + ' min=' + c.min + (c.failing ? '  failing=' + c.failing + ' e.g. ' + JSON.stringify(c.worst) : ''));
console.log(`\n${pairs} pairs, ${failing} failing, ${checks.length} checks`);
for (const [k, v] of Object.entries(cvd)) if (v.min !== undefined) console.log('cvd', k.padEnd(24), 'min', v.min, v.closest, 'under10', v.pairsUnder10);
process.exit(failing ? 1 : 0);
