// Phase 4 TOK (3): every hardcoded value that should be a token, per area and category, each with the token it should
// use or "no token exists" (a gap). Starts where audits/tools/phase3/compliance.mjs stops: that counter is regex over
// raw text and counts only colour/font-size/radius/spacing/shadow/duration/z-index; this one parses the CSS properly
// (selector + at-rule context), also covers weight, line-height, tracking, family, blur, easing, opacity, target sizes
// and breakpoints, reads inline style attributes and JS style strings, and applies explicit false-positive and
// exemption rules (listed in RULES below and in the output).
//   node audits/tools/phase4/TOK/literals.mjs   → audits/evidence/p4/TOK/literals-<area>.json, literals-summary.json
import fs from 'node:fs';
import path from 'node:path';
import { AREAS, OUT, readArea, areaCss, inlineDecls, parseDesignCss, THEME_BLOCKS, TOKVAL, nearest, parseColor, dE, hex } from './lib-tok.mjs';

const RULES = {
  notLiteral: '0, 0px, auto, inherit, initial, unset, none, normal, currentColor, transparent, 100%, 1 (opacity), 0/1 z-index 0 are not literals',
  varOnly: 'values built only from var(--token), calc() of tokens and color-mix() of tokens are not literals; the percentages inside a token color-mix are counted separately as "mixRatio" (ad-hoc derived colours)',
  fallback: 'a literal inside var(--x, <literal>) is a fallback, counted as status "fallback", not a violation',
  print: '@media print declarations are exempt',
  keyframes: 'declarations inside @keyframes are motion frames: counted only for colour',
  hairline: '1px and 2px in spacing/borders are sub-grid hairlines: status "subgrid", not counted as violations',
  circle: 'border-radius 50% is a circle: status "acceptable"',
  relative: 'em/%/vw/ch/dvh/cqw values are relative: status "relative" (they scale with their parent, unlike px), not violations',
  dollywood: 'Dollywood template: selectors are split by flavour ([data-flavor=hub] = build guide only, [data-flavor=live] = park map only, html:not([data-flavor=live]) = build guide/standalone); lines 259-308 and 525-565 and SVG-shape selectors are cartography (colour exempt, as scripts/screens-apps.mjs allows); the :where(:root) / :where([data-theme=light]) palette blocks (lines 7-12) are standalone-only (overridden by the hub flavour block at line 212) except the map category colours',
  designCss: 'apps/design.css: only declarations outside the token/theme/kind blocks are scanned (the component layer, resets, print)',
  meta: '<meta name="theme-color"> hex is counted in category colour with status "meta" (a token cannot reach a meta tag; hub.js/index.html set it from JS)',
};
const { tokens: DT } = parseDesignCss();
// Hearth token colours for suggestions (+ every theme's value for exact matches)
const TOKCOL = [];
for (const t of Object.values(DT)) for (const [theme, v] of Object.entries(t.values)) { const c = parseColor(v); if (c && c.a === 1) TOKCOL.push({ token: t.name, theme, c }); }
const suggestColour = lit => {
  const c = parseColor(lit); if (!c) return { token: null, why: 'unparsed' };
  if (c.a < 1) {
    if (c.r > 240 && c.g > 240 && c.b > 240) return { token: null, match: 'none', role: '--hairline / --glass-spec', why: `white at ${c.a}: a highlight; design.css has theme-aware highlight tokens but no scale (gap: --highlight-*)` };
    if (c.r < 40 && c.g < 40 && c.b < 40) return { token: null, match: 'none', role: '--scrim / --e* / --glass-inner', why: `black at ${c.a}: a shade; no shade scale exists (gap: --shade-*)` };
    return { token: null, match: 'none', why: `translucent colour ${hex(c)} at ${c.a}` };
  }
  if (lit.toLowerCase() === 'white' || /^#f{3}$|^#f{6}$/i.test(lit)) return { token: null, match: 'none', why: 'pure white: no --white / --on-solid token (gap); nearest roles --on-accent (light themes) or --surface' };
  if (lit.toLowerCase() === 'black' || /^#0{3}$|^#0{6}$/i.test(lit)) return { token: null, match: 'none', why: 'pure black: no --black / shade token (gap)' };
  const exact = TOKCOL.filter(x => hex(x.c) === hex(c));
  if (exact.length) return { token: exact.find(x => x.theme === 'hearth')?.token || exact[0].token, match: 'exact', why: 'exact value of ' + [...new Set(exact.map(x => `${x.token}@${x.theme}`))].slice(0, 4).join(', ') };
  const near = TOKCOL.filter(x => x.theme === 'hearth').map(x => ({ ...x, d: dE(x.c, c) })).sort((a, b) => a.d - b.d)[0];
  if (lit.toLowerCase() === 'white' || lit === '#fff' || lit.toLowerCase() === '#ffffff') return { token: '--on-accent / --surface', why: 'pure white: no --white/--on-solid token (gap)' };
  if (lit.toLowerCase() === 'black' || lit === '#000' || lit.toLowerCase() === '#000000') return { token: '--text', why: 'pure black: no --black/shade token (gap)' };
  return { token: near.d <= 6 ? near.token : null, match: near.d <= 6 ? 'near' : 'none', why: `nearest Hearth token ${near.token} (ΔE ${near.d})` };
};
const NAMEDRE = /\b(white|black|gray|grey|silver|red|green|blue|orange|yellow|purple|pink|navy|teal|maroon|olive|lime|aqua|fuchsia|brown|tan|gold|beige|ivory|khaki|coral|salmon|crimson|indigo|violet|lavender|plum|orchid|turquoise|cyan|magenta|wheat|linen|snow|azure|dimgray|dimgrey|lightgray|lightgrey|darkgray|whitesmoke|gainsboro)\b/gi;
const stripVars = v => { let s = v; for (let i = 0; i < 5; i++) s = s.replace(/var\(\s*--[\w-]+\s*(,\s*([^()]*(\([^()]*\))?)*)?\)/g, m => /,/.test(m) ? ' FALLBACK(' + m.replace(/^var\(\s*--[\w-]+\s*,/, '').replace(/\)$/, '') + ') ' : ' TOKEN '); return s; };
const fallbackPart = v => (v.match(/FALLBACK\(([^)]*(\([^)]*\))?[^)]*)\)/g) || []).join(' ');
const px = s => [...s.matchAll(/(-?\d*\.?\d+)px/g)].map(m => +m[1]);

function classify(d, area, flav) {
  const hits = []; const add = (cat, literal, status, token, why, extra = {}) => hits.push({ cat, prop: d.prop, value: d.value.slice(0, 160), literal: String(literal).slice(0, 60), status, token, why, line: d.line, selector: (d.selector || '').slice(0, 90), src: d.src || 'css', ...extra });
  const prop = d.prop; let v = d.value.replace(/!important/, '').trim();
  const at = d.at.join(' ');
  if (/@media print/.test(at)) { hits.push({ cat: 'print', prop, value: v.slice(0, 80), status: 'exempt', line: d.line }); return hits; }
  const inKey = /@keyframes/.test(at);
  const s0 = stripVars(v); const fb = fallbackPart(s0); const s = s0.replace(/FALLBACK\([^)]*(\([^)]*\))?[^)]*\)/g, ' ');
  const flavour = flav ? flav(d) : null; // dollywood: {applies:'hub'|'live'|'both'|'standalone', carto:boolean, standaloneBlock:boolean}
  // ---- colour ----
  const colourProp = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(-color)?|column-rule|stop-color|flood-color|filter|-webkit-text-stroke|scrollbar-color)$/.test(prop) || prop.startsWith('--') || /gradient\(/.test(v);
  if (colourProp) {
    const lits = [...(s.match(/#[0-9a-fA-F]{3,8}\b/g) || []), ...(s.match(/\b(?:rgba?|hsla?)\([^)]*\)/g) || []), ...((s.replace(/color-mix\(\s*in\s+[a-z-]+/g, '').replace(/url\([^)]*\)/g, '').match(NAMEDRE)) || []).filter(n => !(prop.startsWith('--') && /^(gold|olive|teal)$/i.test(n) && !/^\s*(gold|olive|teal)\s*$/i.test(s)))];
    for (const lit of lits) {
      let status = 'violation';
      if (flavour?.carto || (flavour?.standaloneBlock && flavour.cartoToken)) status = 'exempt-cartography';
      else if (flavour?.standaloneBlock) status = 'standalone-only';
      else if (inKey) status = 'violation';
      const sg = suggestColour(lit.replace(/\s+/g, ''));
      add('colour', lit, status, sg.token, sg.why, { match: sg.match, ...(flavour ? { flavour: flavour.applies } : {}) });
    }
    for (const m of v.matchAll(/%23([0-9a-fA-F]{6})\b/g)) { const sg = suggestColour('#' + m[1]); add('colour', '#' + m[1] + ' (url-encoded)', flavour?.carto ? 'exempt-cartography' : 'violation', sg.token, 'inside a data: URI, so it cannot follow the theme; ' + sg.why, { match: sg.match }); }
    for (const m of (fb.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?)\([^)]*\)/g) || [])) add('colour', m, 'fallback', null, 'literal fallback inside var()');
    // ad-hoc derived colours: color-mix(...) of tokens with a literal ratio
    for (const m of v.matchAll(/color-mix\(\s*in\s+[a-z-]+\s*,([^()]*(\([^()]*\))?[^()]*(\([^()]*\))?[^()]*)\)/g)) {
      const ratios = [...m[1].matchAll(/(\d+(\.\d+)?)%/g)].map(x => +x[1]);
      if (ratios.length) hits.push({ cat: 'mixRatio', prop, literal: ratios.join('/') + '%', status: 'info', line: d.line, mix: m[0].replace(/\s+/g, ' ').slice(0, 120) });
    }
  }
  if (inKey) return hits;
  if (prop.startsWith('--')) {
    // a local token holding a literal length/number: record under 'localLiteral' (it is the source of a hardcoded value)
    if (!colourProp || !/#|rgb|hsl/.test(s)) if (/\d(px|ms|s)\b/.test(s) && !/TOKEN/.test(s)) add('localLiteral', v, 'violation', null, 'local custom property holding a literal ' + (/(ms|\ds)\b/.test(s) ? 'duration' : 'length'));
    return hits;
  }
  const status0 = flavour?.carto ? 'exempt-cartography' : 'violation';
  // ---- type ----
  if (prop === 'font-size' || (prop === 'font' && /\d/.test(s))) {
    const m = s.match(/(-?\d*\.?\d+)(px|rem|em|pt|vw|%)|clamp\([^)]*\)|min\([^)]*\)|max\([^)]*\)/);
    if (m && !/^\s*TOKEN\s*$/.test(s)) {
      if (/clamp|min\(|max\(/.test(m[0])) add('fontSize', m[0], status0, '--fs-hero (only fluid token) / none', 'fluid size: no fluid type scale beyond --fs-hero (gap)');
      else if (m[2] === 'px') { const n = +m[1]; const t = TOKVAL.fs[n]; const nr = nearest(TOKVAL.fs, n); add('fontSize', m[0], n < 11 ? status0 : status0, t || null, t ? 'exact' : `no ${n}px step (nearest ${nr.token} ${nr.key}px)${n < 11 ? '; below the 11 px floor' : ''}`, { px: n }); }
      else if (m[2] === 'pt') add('fontSize', m[0], status0, null, 'pt unit');
      else add('fontSize', m[0], 'relative', null, 'relative size (' + m[2] + ')');
    }
  }
  if (prop === 'font-weight' || (prop === 'font' && /\b[1-9]00\b|bold/.test(s))) { const m = s.match(/\b([1-9]00|bold|bolder|lighter)\b/); if (m) add('fontWeight', m[1], status0, null, 'no weight tokens exist (gap: --fw-regular/-semibold/-bold)'); }
  if (prop === 'line-height') { const m = s.match(/^\s*(\d*\.?\d+)(px)?\s*$/); if (m && m[1] !== '0') { const t = TOKVAL.lh[String(+m[1])]; add('lineHeight', m[0].trim(), status0, t || null, t ? 'exact' : (m[2] ? 'px line-height' : `no ${m[1]} step (tokens 1.1/1.25/1.45)`)); } }
  if (prop === 'letter-spacing') { const m = s.match(/-?\d*\.?\d+(em|px)/); if (m && !/^0(em|px)?$/.test(m[0])) { const t = TOKVAL.ls[m[0]]; add('letterSpacing', m[0], status0, t || null, t ? 'exact' : 'no token (tokens -0.02em / .08em)'); } }
  if (prop === 'font-family' || (prop === 'font' && /[a-z]{3,}[\s,]/i.test(s) && !/^\s*TOKEN\s*$/.test(s) && !/inherit/.test(s))) {
    const fam = s.replace(/TOKEN/g, '').trim(); if (fam && !/^(inherit|inherit;?)$/.test(fam) && /[a-z]/i.test(fam.replace(/\d+(px|%)?|bold|italic|normal|\//g, ''))) add('fontFamily', fam.slice(0, 60), status0, /serif|georgia|fraunces|new york/i.test(fam) && !/sans/i.test(fam) ? '--font-serif / --font-display' : /mono/i.test(fam) ? '--font-mono' : '--font-sans', 'literal family stack');
  }
  // ---- spacing ----
  if (/^(margin|padding|gap|row-gap|column-gap|inset|scroll-padding|scroll-margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/.test(prop)) {
    const nums = px(s).map(Math.abs).filter(n => n !== 0);
    if (nums.length) {
      const off = nums.filter(n => n > 2 && !TOKVAL.sp[n]); const on = nums.filter(n => TOKVAL.sp[n]); const sub = nums.filter(n => n <= 2);
      const status = off.length || on.length ? status0 : 'subgrid';
      add('spacing', nums.join(' '), status, on.length && !off.length ? on.map(n => TOKVAL.sp[n]).join(' ') : null, off.length ? `off the 4-pt token scale: ${off.join(',')}px (nearest ${off.map(n => nearest(TOKVAL.sp, n).token).join(',')})` : on.length ? 'on-scale px: use the token' : 'sub-grid hairline', { offGrid: off, onGrid: on, sub });
    } else if (/\d(em|%|vw|vh|dvh)/.test(s)) add('spacing', s.trim().slice(0, 40), 'relative', null, 'relative spacing');
  }
  // ---- radius ----
  if (/^border(-(top|bottom)-(left|right))?-radius$/.test(prop)) {
    if (/50%/.test(s)) add('radius', '50%', 'acceptable', '--r-full', 'circle');
    const nums = px(s).filter(n => n !== 0);
    if (nums.length) { const t = nums.map(n => TOKVAL.r[n] || (n >= 99 ? '--r-full' : null)); add('radius', nums.join(' '), status0, t.every(Boolean) ? t.join(' ') : null, t.every(Boolean) ? 'exact' : `no ${nums.filter(n => !TOKVAL.r[n] && n < 99).join('/')}px step (tokens 12/16/22/28/36/999)`); }
    else if (/\d(em|%)/.test(s) && !/^\s*50%\s*$/.test(s)) add('radius', s.trim(), 'relative', null, 'relative radius');
  }
  // ---- shadow / blur ----
  if (/^(box-shadow|text-shadow)$/.test(prop) && /\d/.test(s.replace(/TOKEN/g, ''))) {
    const ring = /(^|,)\s*(inset\s+)?0 0 0 \d/.test(s); add('shadow', s.replace(/\s+/g, ' ').trim().slice(0, 70), status0, ring ? null : null, ring ? 'focus/selection ring geometry: no --ring token (gap)' : 'bespoke shadow geometry: not one of --e1..--e4 (gap: an inset/pressed and a coloured-glow elevation)');
  }
  if (/filter$/.test(prop)) {
    for (const m of s.matchAll(/blur\((\d*\.?\d+)px\)/g)) add('blur', m[0], status0, +m[1] === 18 ? '--blur' : null, +m[1] === 18 ? 'exact' : `no ${m[1]}px blur token (only --blur 18/28)`);
    for (const m of s.matchAll(/drop-shadow\([^)]*\)/g)) add('shadow', m[0], status0, null, 'drop-shadow geometry: no token');
    for (const m of s.matchAll(/saturate\([\d.]+\)|brightness\([\d.]+\)/g)) add('glassFilter', m[0], status0, null, 'glass filter constants are not tokens (the recipe repeats saturate(1.4) brightness(1.02))');
  }
  // ---- motion ----
  if (/^(transition|transition-duration|transition-delay|animation|animation-duration|animation-delay)$/.test(prop)) {
    for (const m of s.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) { const ms = m[2] === 's' ? +m[1] * 1000 : +m[1]; if (!ms) continue; const t = TOKVAL.dur[ms]; add('duration', m[0], status0, t || null, t ? 'exact' : `no ${ms}ms token (tokens 120/220/360)`, { ms }); }
    for (const m of s.matchAll(/cubic-bezier\([^)]*\)|\b(ease-in-out|ease-in|ease-out|ease|linear|steps\([^)]*\))\b/g)) add('easing', m[0], status0, null, 'literal easing (tokens --ease/--ease-out/--ease-in-out/--spring)');
  }
  if (/^(transition-timing-function|animation-timing-function)$/.test(prop) && !/^\s*TOKEN\s*$/.test(s)) add('easing', s.trim(), status0, null, 'literal easing');
  // ---- z / opacity ----
  if (prop === 'z-index' && /\d/.test(s) && !/^\s*0\s*$/.test(s)) add('zIndex', s.trim(), status0, null, 'no z-index tokens exist (gap: --z-base/-bar/-sheet/-toast)');
  if (prop === 'opacity' && /^\s*0?\.\d+|^\s*[2-9]/.test(s)) add('opacity', s.trim(), status0, null, 'no opacity/emphasis tokens (gap)');
  // ---- target sizes ----
  if (/^(min-height|min-width|height|width)$/.test(prop)) {
    for (const n of px(s)) { if ([44, 60, 64, 84].includes(n)) add('targetSize', n + 'px', status0, n === 44 ? '--tap' : n === 60 ? '--tap-lg' : n === 64 ? '--tap (kid)' : '--tap-lg (kid)', 'equals a target token value but does not scale with kid mode'); else if (n >= 28 && n <= 72 && /min-/.test(prop)) add('targetSize', n + 'px', status0, n < 44 ? null : '--tap / --tap-lg', n < 44 ? `min target ${n}px < 44 (below --tap)` : 'a target size between the two tokens'); }
  }
  if (/^max-width$/.test(prop)) for (const n of px(s)) { const t = TOKVAL.size[n]; if (t) add('layoutWidth', n + 'px', status0, t, 'exact'); }
  return hits;
}

// Dollywood template flavour/cartography classifier
const dollyFlav = (d) => {
  const sel = d.selector || ''; const ln = d.line;
  const explicitHub = /\[data-flavor=hub\]/.test(sel) && !/\[data-flavor=live\]/.test(sel) || /html:not\(\[data-flavor=live\]\)/.test(sel);
  const explicitLive = /\[data-flavor=live\]/.test(sel) && !/\[data-flavor=hub\]/.test(sel);
  const explicitBoth = /\[data-flavor=hub\]/.test(sel) && /\[data-flavor=live\]/.test(sel);
  // sections of the shared template (section comments at lines 140, 208, 232, 259, 309, 382, 525)
  const section = ln < 13 ? 'palette' : ln < 140 ? 'base' : ln < 208 ? 'guide' : ln < 232 ? 'flavours' : ln < 382 ? 'hub' : 'live';
  const hubOnly = explicitHub || (!explicitLive && !explicitBoth && (section === 'guide' || section === 'hub'));
  const liveOnly = explicitLive || (!explicitHub && !explicitBoth && section === 'live');
  const base = !explicitHub && !explicitLive && !explicitBoth && section === 'base';
  const standaloneBlock = /^:where\((:root|\[data-theme=light\])\)$/.test(sel) || sel === '[data-scheme=light]';
  const cartoToken = standaloneBlock && /^--(attr|shop|dine|coaster|rail|water)$/.test(d.prop);
  const carto = (ln >= 259 && ln <= 308) || (ln >= 525 && ln <= 565) || /(^|[\s,>])(#map|#coaster|#pv|#mini|svg|path|circle|polyline|polygon|text|tspan|line|rect|g)([\s.#[:,>]|$)|\.c-|\.lbl|\.area|\.water|\.tree|#terrain|\.poi|\.mk|marker|\.amen|--cat-|\.legend i|\.mapbox|\.secpoly/.test(sel) || /^--cat-/.test(d.prop) || cartoToken;
  return { applies: standaloneBlock ? 'standalone' : hubOnly ? 'hub' : liveOnly ? 'live' : base ? 'base' : 'both', carto, standaloneBlock, cartoToken };
};

const summary = {};
for (const a of AREAS) {
  if (a.id === 'hub.js') continue;
  const A = readArea(a);
  const hits = [];
  const flav = a.id.startsWith('dollywood') ? dollyFlav : null;
  for (const d of areaCss(A)) {
    if (a.id === 'design.css' && THEME_BLOCKS.some(([, t]) => t(d.selector, d.at))) continue;   // token definitions
    for (const h of classify(d, a.id, flav)) {
      if (flav && h.status === 'violation') { const f = flav(d); if (f.applies === 'hub' && a.id === 'dollywood-live') h.status = 'other-flavour'; if (f.applies === 'live' && a.id === 'dollywood') h.status = 'other-flavour'; if (f.applies === 'standalone') h.status = 'standalone-only'; if (f.applies === 'base') h.status = 'base-rule'; h.flavour = f.applies; }
      hits.push(h);
    }
  }
  for (const d of inlineDecls(A)) for (const h of classify(d, a.id, null)) { if (/\$\{/.test(h.value) && h.cat === 'colour' && !/#|rgb/.test(h.literal)) continue; if (a.id === 'dollywood' && h.line >= 1286 && h.line < 1742 && h.status === 'violation') h.status = 'other-flavour'; hits.push(h); }
  // JS colour literals (strings '#xxxxxx' outside style strings; the Dollywood payload JSON is not a <script> block we scan)
  for (const b of A.scripts) {
    const js = A.raw.slice(b.start, b.end).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const m of js.matchAll(/(['"`])(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\1/g)) {
      const before = js.slice(Math.max(0, m.index - 40), m.index); if (/(querySelector(All)?|getElementById|closest|matches|\$\$?)\(\s*$/.test(before)) continue;
      const ln = A.L(b.start + m.index); const sg = suggestColour(m[2]);
      const ctx = js.slice(Math.max(0, m.index - 50), m.index + 12).replace(/\s+/g, ' ');
      let status = 'violation'; if (flav && !/color\s*\|\|\s*['"]#|style=/.test(ctx)) status = 'js-map-or-data';
      if (!flav && /SWATCHES|FALLBACK|PEOPLE/.test(js.slice(Math.max(0, m.index - 400), m.index + 10))) status = 'palette-data';
      if (a.id === 'dollywood' && ln >= 1286 && ln < 1742 && status === 'violation') status = 'other-flavour';   // "live tracker + family (park flavour only)"
      if (hits.some(h => h.line === ln && h.literal === m[2] && h.src !== 'js')) continue;   // already counted as a style string on this line
      hits.push({ cat: 'colour', src: 'js', prop: 'js-string', literal: m[2], value: ctx.slice(0, 120), status, token: sg.token, why: sg.why, line: ln });
    }
  }
  // theme-color meta and SVG attributes in markup
  for (const m of A.raw.matchAll(/<meta[^>]+name=["']theme-color["'][^>]*>/g)) for (const h of m[0].match(/#[0-9a-fA-F]{3,8}/g) || []) hits.push({ cat: 'colour', src: 'meta', prop: 'meta theme-color', literal: h, status: 'meta', token: suggestColour(h).token, why: 'a meta tag cannot use var(); set it from the resolved --bg in JS', line: A.L(m.index) });
  // breakpoints
  for (const b of A.styles) { const css = A.raw.slice(b.start, b.end); for (const m of css.matchAll(/@media[^{]*?\((min|max)-(width|height)\s*:\s*(\d+)px\)/g)) hits.push({ cat: 'breakpoint', literal: `${m[1]}-${m[2]} ${m[3]}`, status: 'info', token: null, why: 'no breakpoint scale is defined (CSS cannot var() in @media; a documented scale is the gap)', line: A.L(b.start + m.index) }); }
  const by = {}; for (const h of hits) { const k = h.cat; (by[k] ||= {}); by[k][h.status] = (by[k][h.status] || 0) + 1; }
  const viol = hits.filter(h => h.status === 'violation');
  const vcat = {}; for (const h of viol) { (vcat[h.cat] ||= { total: 0, exactToken: 0, noToken: 0 }); vcat[h.cat].total++; if (h.cat === 'colour' ? h.match === 'exact' : (h.token && !/none/.test(h.token) && h.token !== '--tap / --tap-lg')) vcat[h.cat].exactToken++; else vcat[h.cat].noToken++; }
  const distinct = {}; for (const h of viol) (distinct[h.cat] ||= new Set()).add(h.literal);
  const mix = hits.filter(h => h.cat === 'mixRatio');
  summary[a.id] = { file: a.file, byCategoryStatus: by, violations: vcat, distinctViolationValues: Object.fromEntries(Object.entries(distinct).map(([k, s]) => [k, s.size])), mixRatios: { count: mix.length, distinct: [...new Set(mix.map(m => m.literal))].length }, breakpoints: [...new Set(hits.filter(h => h.cat === 'breakpoint').map(h => h.literal))] };
  fs.writeFileSync(path.join(OUT, `literals-${a.id.replace(/\./g, '_')}.json`), JSON.stringify({ area: a.id, file: a.file, rules: RULES, summary: summary[a.id], hits }, null, 1));
}
fs.writeFileSync(path.join(OUT, 'literals-summary.json'), JSON.stringify({ rules: RULES, summary }, null, 1));
const cats = ['colour', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'spacing', 'radius', 'shadow', 'blur', 'glassFilter', 'duration', 'easing', 'zIndex', 'opacity', 'targetSize', 'layoutWidth', 'localLiteral'];
console.log('violations per area x category (total/withExactToken)');
console.log('area'.padEnd(15) + cats.map(c => c.slice(0, 7).padStart(8)).join(''));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(15) + cats.map(c => (v.violations[c] ? `${v.violations[c].total}/${v.violations[c].exactToken}` : '-').padStart(8)).join(''));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(15), 'mix', v.mixRatios.count, 'distinct', v.mixRatios.distinct, 'bps', v.breakpoints.join(' | '));
