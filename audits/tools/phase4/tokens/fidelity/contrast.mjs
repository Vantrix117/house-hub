// Phase 4 · token proposal "fidelity" · verifies tokens.css by computation.
//   node audits/tools/phase4/tokens/fidelity/contrast.mjs <tokens.css> [out.json]
// It parses tokens.css, runs the cascade for every context (5 palettes x 9 person families x
// {adult, kiosk, Increase Contrast, Reduce Transparency}), resolves var() and color-mix(), composites translucent
// layers over their backdrops, and checks every pair below against its threshold:
//   text 4.5 (7 in the kiosk and Increase Contrast contexts), large text 3, non-text/graphic 3,
//   depth (surface steps) and chroma floors, CVD separation of the person tones (CIEDE2000 >= 10 under normal,
//   protanopia and deuteranopia, Machado 2009 severity 1), semantic distinctness, the type floor (11 / kid 16 / TV 28)
//   in every width x text-size x kind combination, targets, the 4-pt grid, concentric radii, and that every
//   prefers-* @media block mirrors its attribute block exactly. Exit code 1 if anything fails.
import fs from 'node:fs';
import { parseColour, over, contrast, lum, oklch, de2000, simulate, hex } from './colour-lib.mjs';

const file = process.argv[2];
const outFile = process.argv[3];
if (!file) { console.error('usage: contrast.mjs <tokens.css> [out.json]'); process.exit(2); }
const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ── parse: rules with selector, media and custom-property declarations ─────────────────────────────
function parseRules(css) {
  const rules = []; let i = 0, order = 0;
  function block(media) {
    while (i < css.length) {
      const close = css.indexOf('}', i), open = css.indexOf('{', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return; }
      if (open === -1) { i = css.length; return; }
      const head = css.slice(i, open).trim(); i = open + 1;
      if (head.startsWith('@media')) { block(head.slice(6).trim()); continue; }
      // declaration body: find the matching close brace (no nested braces in declarations)
      const end = css.indexOf('}', i); const body = css.slice(i, end); i = end + 1;
      const decls = {};
      // split on ; that are not inside parentheses
      let depth = 0, cur = '';
      for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ';' && depth === 0) { push(cur); cur = ''; } else cur += ch; }
      push(cur);
      function push(d) { const m = d.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/); if (m) decls[m[1]] = m[2].replace(/\s+/g, ' '); }
      rules.push({ selectors: head.split(',').map(s => s.trim()), media, decls, order: order++ });
    }
  }
  block(null);
  return rules;
}
const RULES = parseRules(src);

function matchSel(sel, ctx) {
  if (/\s/.test(sel) || sel.includes(':not(') || sel.includes(':where(')) return null;
  const parts = sel.match(/:root|\[[^\]]+\]/g) || [];
  if (parts.join('') !== sel) return null;
  let spec = 0;
  for (const p of parts) {
    spec++;
    if (p === ':root') continue;
    const m = p.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
    if (!m) return null;
    if (!(m[1] in ctx)) return null;
    if (m[2] !== undefined && ctx[m[1]] !== m[2]) return null;
  }
  return spec;
}
function cascade(ctx) {
  const hits = [];
  for (const r of RULES) {
    if (r.media) continue;
    let best = null;
    for (const s of r.selectors) { const sp = matchSel(s, ctx); if (sp != null && (best == null || sp > best)) best = sp; }
    if (best != null) for (const [k, v] of Object.entries(r.decls)) hits.push({ k, v, spec: best, order: r.order });
  }
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const map = {}; for (const h of hits) map[h.k] = h.v;
  return map;
}
function resolver(map) {
  const cache = {};
  function res(name, stack = []) {
    if (name in cache) return cache[name];
    if (stack.includes(name)) throw new Error('cycle: ' + [...stack, name].join(' -> '));
    if (!(name in map)) return undefined;
    const v = subst(map[name], [...stack, name]);
    cache[name] = v; return v;
  }
  function subst(v, stack) {
    let guard = 0;
    while (v.includes('var(') && guard++ < 50) {
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))*[^()]*))?\)/g, (m, n, fb) => { const r = res(n, stack); return r !== undefined ? r : (fb !== undefined ? fb : 'UNDEFINED(' + n + ')'); });
    }
    return v;
  }
  return res;
}
// ── colour evaluation (hex, rgb[a], named, color-mix in srgb) ─────────────────────────────────────
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; }
function evalColour(v) {
  v = v.trim();
  const m = v.match(/^color-mix\(\s*in srgb\s*,([\s\S]*)\)$/);
  if (m) {
    const [a, b] = splitTop(m[1]);
    const pa = a.match(/^(.*?)\s+([\d.]+)%$/), pb = b.match(/^(.*?)\s+([\d.]+)%$/);
    const ca = evalColour(pa ? pa[1] : a), cb = evalColour(pb ? pb[1] : b);
    let p1 = pa ? +pa[2] / 100 : null, p2 = pb ? +pb[2] / 100 : null;
    if (p1 == null && p2 == null) { p1 = p2 = 0.5; } else if (p1 == null) p1 = 1 - p2; else if (p2 == null) p2 = 1 - p1;
    const alpha = ca.a * p1 + cb.a * p2;
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = k => (ca[k] * ca.a * p1 + cb[k] * cb.a * p2) / alpha;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a: alpha };
  }
  return parseColour(v);
}

// ── contexts ───────────────────────────────────────────────────────────────────────────────────────
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark' };
const SYSTEM = { 'system (day)': 'frost', 'system (night)': 'midnight' };
const PEOPLE = ['pink', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const HUES = PEOPLE.slice(0, 8);
const FAMILIES = [...PEOPLE, 'success', 'warning', 'danger'];
const MODES = {
  adult: {},
  kid: { kind: 'kid' },
  kiosk: { kind: 'kiosk' },
  'contrast-more': { contrast: 'more' },
  'reduce-transparency': { transparency: 'reduce' },
};
const HI_MODES = new Set(['kiosk', 'contrast-more']);
const BUSY = { mid: '#767676', black: '#000000', white: '#FFFFFF' };

const results = new Map();   // pairId -> aggregate
const failures = [];
let evaluated = 0;
function record(id, meta, value, threshold, ctxLabel, extra = {}) {
  evaluated++;
  let a = results.get(id);
  if (!a) { a = { id, ...meta, threshold, n: 0, min: Infinity, max: -Infinity, worst: null, fails: 0 }; results.set(id, a); }
  a.n++;
  if (value < a.min) { a.min = value; a.worst = ctxLabel; }
  if (value > a.max) a.max = value;
  if (threshold > a.threshold) a.threshold = threshold;
  if (value < threshold - 1e-9) { a.fails++; failures.push({ id, context: ctxLabel, value: +value.toFixed(3), threshold, ...extra }); }
}

const matrix = {};   // theme -> accent -> selected numbers for the proposal tables (adult mode)
for (const [theme, scheme] of Object.entries(THEMES)) {
  for (const accent of PEOPLE) {
    for (const [mode, extra] of Object.entries(MODES)) {
      const ctx = { theme, scheme, accent, kind: 'adult', ...extra };
      const label = `${theme}/${accent}/${mode}`;
      const map = cascade(ctx); const res = resolver(map);
      const col = n => { const v = res(n.startsWith("--") ? n : "--" + n); if (v === undefined) throw new Error(`${label}: ${n} undefined`); return evalColour(v); };
      const solid = n => { const c = col(n); if (c.a < 0.999) throw new Error(`${label}: ${n} not opaque`); return c; };
      const hi = HI_MODES.has(mode);
      const T_TEXT = hi ? 7 : 4.5;
      const surfaces = ['bg', 'surface', 'surface-2', 'surface-raised'];
      const pair = (id, fgC, bgC, thr, kind, fgN, bgN) => record(id, { kind, fg: fgN, bg: bgN }, contrast(fgC, bgC), thr, label);

      // A. neutral text
      for (const fg of ['text', 'text-2', 'text-3', 'placeholder'])
        for (const bg of [...surfaces, 'fill-field', 'hover'])
          pair(`text:${fg}/${bg}`, solid(fg), solid(bg), (fg === 'text' || fg === 'text-2' || fg === 'text-3' || fg === 'placeholder') ? T_TEXT : 4.5, 'text', fg, bg);
      // B. non-text neutrals
      for (const fg of ['field-border', 'track-info', 'switch-off-ring', 'status-offline'])
        for (const bg of surfaces) pair(`ui:${fg}/${bg}`, solid(fg), solid(bg), 3, 'non-text', fg, bg);
      pair('ui:field-border/fill-field', solid('field-border'), solid('fill-field'), 3, 'non-text', 'field-border', 'fill-field');
      pair('ui:switch-on/surface', solid('switch-on'), solid('surface'), 3, 'non-text', 'switch-on', 'surface');
      pair('ui:switch-knob/switch-on', solid('switch-knob'), solid('switch-on'), 3, 'non-text', 'switch-knob', 'switch-on');
      // depth: card off the page, the well lighter than the card in dark
      const dSurf = contrast(solid('surface'), solid('bg'));
      record(`depth:surface/bg (${scheme})`, { kind: 'depth', fg: 'surface', bg: 'bg' }, dSurf, scheme === 'dark' ? 1.2 : 1.05, label);
      if (scheme === 'dark') {
        const s2 = solid('surface-2'), s1 = solid('surface');
        record('depth:surface-2 lighter than surface (dark)', { kind: 'depth', fg: 'surface-2', bg: 'surface' }, lum(s2) > lum(s1) ? contrast(s2, s1) : 1 / contrast(s2, s1), 1.1, label);
        record('depth:surface-raised lighter than surface (dark)', { kind: 'depth', fg: 'surface-raised', bg: 'surface' }, lum(col('surface-raised')) > lum(s1) ? contrast(col('surface-raised'), s1) : 0, 1.05, label);
      }
      // C. families (only once per theme+mode: family tokens do not depend on the accent)
      if (accent === 'pink') {
        for (const f of FAMILIES) {
          const F = n => solid(`${f}-${n}`);
          for (const bg of ['wash', 'fill']) pair(`fam:${f}-ink/${f}-${bg}`, F('ink'), F(bg), T_TEXT, 'text', `${f}-ink`, `${f}-${bg}`);
          for (const bg of surfaces) pair(`fam:${f}-ink/${bg}`, F('ink'), solid(bg), T_TEXT, 'text', `${f}-ink`, bg);
          pair(`fam:${f}-ink-hi/${f}-fill`, F('ink-hi'), F('fill'), 7, 'text-hi', `${f}-ink-hi`, `${f}-fill`);
          pair(`fam:${f}-ink-hi/surface`, F('ink-hi'), solid('surface'), 7, 'text-hi', `${f}-ink-hi`, 'surface');
          pair(`fam:${f}-ink-hi/${f}-fill-strong`, F('ink-hi'), F('fill-strong'), 4.5, 'text', `${f}-ink-hi`, `${f}-fill-strong`);
          pair(`fam:${f}-ink/${f}-fill-strong (tile glyph)`, F('ink'), F('fill-strong'), 3, 'graphic', `${f}-ink`, `${f}-fill-strong`);
          pair(`fam:${f}-on/${f}-strong`, F('on'), F('strong'), 4.5, 'text', `${f}-on`, `${f}-strong`);
          for (const bg of surfaces) pair(`fam:${f}-strong/${bg}`, F('strong'), solid(bg), 3, 'graphic', `${f}-strong`, bg);
          pair(`fam:${f}-strong/${f}-fill (progress on its track)`, F('strong'), F('fill'), 3, 'graphic', `${f}-strong`, `${f}-fill`);
          for (const bg of surfaces) pair(`fam:${f}-graphic/${bg}`, F('graphic'), solid(bg), 3, 'graphic', `${f}-graphic`, bg);
          if (scheme === 'dark') record(`depth:${f}-fill/surface (dark chip)`, { kind: 'depth', fg: `${f}-fill`, bg: 'surface' }, contrast(F('fill'), solid('surface')), 1.4, label);
          if (mode === 'adult' && f !== 'graphite') {
            const Cf = oklch(F('fill')).C, Cs = oklch(F('strong')).C;
            record(`chroma:${f}-fill (${scheme})`, { kind: 'chroma', fg: `${f}-fill` }, Cf, scheme === 'light' ? 0.055 : 0.05, label);
            record(`chroma:${f}-strong (${scheme})`, { kind: 'chroma', fg: `${f}-strong` }, Cs, 0.09, label);
          }
        }
        // semantic distinctness
        const sc = n => solid(`${n}-strong`);
        const ratio = contrast(sc('success'), sc('danger'));
        record(`semantic:success-strong vs danger-strong luminance ratio (${scheme})`, { kind: 'distinct' }, ratio, 1.3, label);
        record(`semantic:warning-strong vs danger-strong luminance ratio (${scheme})`, { kind: 'distinct' }, contrast(sc('warning'), sc('danger')), 1.3, label);
        for (const [a, b] of [['success', 'danger'], ['success', 'warning'], ['warning', 'danger']])
          for (const vis of ['normal', 'protan', 'deutan'])
            record(`semantic:${a}/${b} dE00 ${vis} (${scheme}; info: the glyph carries the state)`, { kind: 'info' }, de2000(simulate(solid(`${a}-graphic`), vis), simulate(solid(`${b}-graphic`), vis)), 0, label);
        // glass, toast, inverse glass (backdrops: the page, a card, and busy content)
        const glassOver = (g, back) => over(col(g), back);
        const backs = { bg: solid('bg'), surface: solid('surface'), mid: parseColour(BUSY.mid), extreme: parseColour(scheme === 'light' ? BUSY.black : BUSY.white) };
        for (const [bn, b] of Object.entries(backs)) {
          const gs = glassOver('glass-strong', b), g = glassOver('glass', b);
          pair(`glass:text/glass-strong over ${bn}`, solid('text'), gs, T_TEXT, 'text', 'text', 'glass-strong');
          pair(`glass:text-2/glass-strong over ${bn}`, solid('text-2'), gs, bn === 'extreme' ? 4.5 : T_TEXT, 'text', 'text-2', 'glass-strong');
          pair(`glass:text/glass over ${bn}`, solid('text'), g, bn === 'extreme' || bn === 'mid' ? 4.5 : T_TEXT, 'text', 'text', 'glass');
          pair(`glass:text (icon)/glass over ${bn}`, solid('text'), g, 3, 'graphic', 'text', 'glass');
          pair(`glass:status-offline/glass-strong over ${bn}`, solid('status-offline'), gs, 3, 'non-text', 'status-offline', 'glass-strong');
          pair(`glass:map-north/glass-strong over ${bn}`, solid('map-north'), gs, 3, 'graphic', 'map-north', 'glass-strong');
          pair(`toast:toast-ink/toast-bg over ${bn}`, solid('toast-ink'), over(col('toast-bg'), b), 4.5, 'text', 'toast-ink', 'toast-bg');
          pair(`toast:toast-ink-2/toast-bg over ${bn}`, solid('toast-ink-2'), over(col('toast-bg'), b), 4.5, 'text', 'toast-ink-2', 'toast-bg');
          pair(`glass:glass-inverse-ink/glass-inverse over ${bn}`, solid('glass-inverse-ink'), over(col('glass-inverse'), b), 4.5, 'text', 'glass-inverse-ink', 'glass-inverse');
        }
        // aliases that must keep their meaning through the migration
        pair('legacy:danger (badge) / on-danger', solid('danger-on'), solid('danger'), 4.5, 'text', 'danger-on', 'danger (alias)');
        for (const n of ['gold-ink', 'olive-ink', 'teal-ink', 'terra-ink', 'slate-ink', 'mocha-ink', 'ok-ink', 'warn-ink', 'danger-ink', 'muted'])
          pair(`legacy:${n}/surface`, solid(n), solid('surface'), T_TEXT, 'text', n, 'surface');
        for (const n of ['gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger'])
          pair(`legacy:${n} (as text, lint target)/surface`, solid(n), solid('surface'), 4.5, 'text', n, 'surface');
      }
      // D. the person's accent through the scope mechanism
      const A = n => solid(`accent-${n}`);
      // the scope really resolves to this person's family (catches a cascade-order mistake in the accent blocks)
      record('scope:data-accent resolves every --accent-* step to its own family', { kind: 'static' }, ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'].every(n => hex(A(n)) === hex(solid(`${accent}-${n}`))) ? 1 : 0, 1, label);
      pair('accent:sel-ink/sel-fill', solid('sel-ink'), solid('sel-fill'), T_TEXT, 'text', 'sel-ink', 'sel-fill');
      pair('accent:sel-ink-strong/sel-fill-strong', solid('sel-ink-strong'), solid('sel-fill-strong'), 4.5, 'text', 'sel-ink-strong', 'sel-fill-strong');
      pair('accent:accent-on/accent-strong (primary button)', A('on'), A('strong'), 4.5, 'text', 'accent-on', 'accent-strong');
      for (const bg of surfaces) {
        pair(`accent:accent-ink/${bg}`, A('ink'), solid(bg), T_TEXT, 'text', 'accent-ink', bg);
        pair(`accent:focus-ring/${bg}`, solid('focus-ring-color'), solid(bg), 3, 'non-text', 'focus-ring-color', bg);
        pair(`accent:today-ring/${bg}`, solid('today-ring'), solid(bg), 3, 'non-text', 'today-ring', bg);
        pair(`accent:sel-fill-strong/${bg}`, solid('sel-fill-strong'), solid(bg), 3, 'non-text', 'sel-fill-strong', bg);
      }
      // large text (>= 18.66 px bold / 24 px): big numerals and counts in the person colour, the page wash under titles
      for (const bg of surfaces) pair(`large:accent-graphic numerals/${bg}`, A('graphic'), solid(bg), 3, 'large-text', 'accent-graphic', bg);
      for (const bg of surfaces) pair(`large:timer-done numerals/${bg}`, solid('timer-done'), solid(bg), 3, 'large-text', 'timer-done', bg);
      for (const fg of ['text', 'text-2', 'text-3']) pair(`text:${fg}/accent-wash (page wash)`, solid(fg), over(A('wash'), solid('bg')), T_TEXT, 'text', fg, 'accent-wash');
      record(`info:selected label vs idle label luminance ratio (sel-ink vs text-2)`, { kind: 'info' }, contrast(solid('sel-ink'), solid('text-2')), 0, label);
      pair('accent:accent-ink/accent-wash', A('ink'), A('wash'), T_TEXT, 'text', 'accent-ink', 'accent-wash');
      pair('accent:progress-fill/progress-track', solid('progress-fill'), solid('progress-track'), 3, 'non-text', 'progress-fill', 'progress-track');
      pair('accent:progress-fill/surface', solid('progress-fill'), solid('surface'), 3, 'non-text', 'progress-fill', 'surface');
      pair('accent:hero-btn-ink/hero-btn-bg', solid('hero-btn-ink'), solid('hero-btn-bg'), T_TEXT, 'text', 'hero-btn-ink', 'hero-btn-bg');
      pair('accent:accent-ink/tile end (accent-fill-strong)', A('ink'), A('fill-strong'), 3, 'graphic', 'accent-ink', 'accent-fill-strong');
      for (const [bn, b] of Object.entries({ bg: solid('bg'), surface: solid('surface'), mid: parseColour(BUSY.mid) })) {
        const gs = over(col('glass-strong'), b);
        pair(`accent:accent-ink (tab label)/glass-strong over ${bn}`, A('ink'), gs, bn === 'mid' ? 4.5 : T_TEXT, 'text', 'accent-ink', 'glass-strong');
        pair(`accent:accent-graphic (tab icon)/glass-strong over ${bn}`, A('graphic'), gs, 3, 'graphic', 'accent-graphic', 'glass-strong');
        pair(`accent:sel-ink/sel-fill in the bar over ${bn}`, solid('sel-ink'), over(col('sel-fill'), gs), bn === 'mid' ? 4.5 : T_TEXT, 'text', 'sel-ink', 'sel-fill on glass');
      }
      if (mode === 'adult') {
        (matrix[theme] ??= {})[accent] = {
          'ink/surface': +contrast(A('ink'), solid('surface')).toFixed(2), 'ink/bg': +contrast(A('ink'), solid('bg')).toFixed(2),
          'ink/fill': +contrast(A('ink'), A('fill')).toFixed(2), 'on/strong': +contrast(A('on'), A('strong')).toFixed(2),
          'graphic/surface': +contrast(A('graphic'), solid('surface')).toFixed(2), 'graphic/bg': +contrast(A('graphic'), solid('bg')).toFixed(2),
          'ink/tile-end': +contrast(A('ink'), A('fill-strong')).toFixed(2), 'hero': +contrast(solid('hero-btn-ink'), solid('hero-btn-bg')).toFixed(2),
          fill: hex(A('fill')), strong: hex(A('strong')), graphic: hex(A('graphic')), ink: hex(A('ink')),
          'fill C': +oklch(A('fill')).C.toFixed(3),
        };
      }
    }
  }
}

// ── G. CVD separation of the person families (identity tones), per scheme ───────────────────────────
const cvd = {};
for (const [theme, scheme] of [['frost', 'light'], ['midnight', 'dark']]) {
  const map = cascade({ theme, scheme, accent: 'pink', kind: 'adult' }); const res = resolver(map);
  const c = n => evalColour(res("--" + n));
  cvd[scheme] = { graphic: {}, fill: {} };
  for (const role of ['graphic', 'fill']) for (const vis of ['normal', 'protan', 'deutan', 'tritan']) {
    let min = Infinity, pair = '', under10 = 0;
    const set = role === 'graphic' ? PEOPLE : HUES;
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const d = de2000(simulate(c(`${set[i]}-${role}`), vis), simulate(c(`${set[j]}-${role}`), vis));
      if (d < min) { min = d; pair = `${set[i]}/${set[j]}`; }
      if (d < 10) under10++;
      if (role === 'graphic' && vis !== 'tritan') record(`cvd:person graphic ${set[i]}/${set[j]} ${vis} (${scheme})`, { kind: 'cvd' }, d, 10, `${theme}/${scheme}`);
    }
    cvd[scheme][role][vis] = { min: +min.toFixed(2), closest: pair, pairsUnder10: under10, gated: role === 'graphic' && vis !== 'tritan' };
  }
}

// ── H. type floor, I. targets, K. grid, L. concentric radii ────────────────────────────────────────
function num(expr) {
  const js = expr.replace(/calc\(/g, '(').replace(/max\(/g, 'Math.max(').replace(/min\(/g, 'Math.min(').replace(/(\d*\.?\d+)px/g, '$1');
  if (/[^\d.\s+*\/()\-,Mathmaxin]/.test(js)) throw new Error('cannot evaluate: ' + expr);
  return Function('return ' + js)();
}
const typeRoles = ['large-title', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subheadline', 'footnote', 'caption1', 'caption2'];
const typeTable = {};
for (const kind of ['adult', 'kid', 'kiosk']) for (const width of [1, 1.12]) for (const size of ['xs', 's', 'm', 'l', 'xl', 'xxl']) {
  const ctx = { theme: 'frost', scheme: 'light', accent: 'pink', kind, ...(size === 'm' ? {} : { 'text-size': size }) };
  const map = cascade(ctx);
  if (kind !== 'kiosk') map['--ts-width'] = String(width);   // the (min-width: 744px) and (pointer: coarse) tier
  const res = resolver(map);
  const floor = num(res('--fs-floor'));
  const need = { adult: 11, kid: 16, kiosk: 28 }[kind];
  record(`type:floor token (${kind})`, { kind: 'type' }, floor, need, `${kind}/w${width}/${size}`);
  for (const r of typeRoles) {
    const px = num(res(`--fs-${r}`));
    record(`type:${r} >= floor (${kind})`, { kind: 'type' }, px, need, `${kind}/w${width}/${size}`);
    if (size === 'm') (typeTable[kind] ??= {})[`${r}@${width}`] = +px.toFixed(1);
  }
}
for (const [kind, need, needLg] of [['adult', 44, 60], ['kid', 64, 84], ['kiosk', 64, 84]]) {
  const res = resolver(cascade({ theme: 'frost', scheme: 'light', accent: 'pink', kind }));
  record(`target:--tap (${kind})`, { kind: 'target' }, num(res('--tap')), need, kind);
  record(`target:--tap-lg (${kind})`, { kind: 'target' }, num(res('--tap-lg')), needLg, kind);
  const rc = num(res('--r-control')), rcard = num(res('--r-card')), pad = num(res('--pad-card')), rs = num(res('--r-sheet')), ps = num(res('--pad-sheet'));
  record(`shape:concentric card (${kind}) |r-card - pad-card - r-control|`, { kind: 'shape' }, 1 - Math.abs(rcard - pad - rc), 1, kind);
  record(`shape:concentric sheet (${kind}) |r-sheet - pad-sheet - r-control|`, { kind: 'shape' }, 1 - Math.abs(rs - ps - rc), 1, kind);
}
{
  const map = cascade({ theme: 'frost', scheme: 'light', accent: 'pink', kind: 'adult' });
  for (const [k, v] of Object.entries(map)) {
    const m = k.match(/^--sp-(\d+)$/); if (!m) continue;
    const base = +v.match(/calc\((\d+)px/)[1];
    record(`grid:${k} on the 4-pt grid`, { kind: 'grid' }, base % 4 === 0 ? 1 : 0, 1, 'adult');
  }
}

// ── J. every prefers-* @media block mirrors its attribute block ────────────────────────────────────
const MIRRORS = [['prefers-contrast: more', 'contrast', 'more'], ['prefers-reduced-transparency: reduce', 'transparency', 'reduce'], ['prefers-reduced-motion: reduce', 'motion', 'reduce']];
for (const [q, attr, val] of MIRRORS) {
  const media = RULES.find(r => r.media && r.media.includes(q));
  const attrRule = RULES.find(r => !r.media && r.selectors.includes(`:root[data-${attr}="${val}"]`));
  const same = media && attrRule && JSON.stringify(media.decls) === JSON.stringify(attrRule.decls);
  record(`mirror:@media (${q}) == :root[data-${attr}="${val}"]`, { kind: 'mirror' }, same ? 1 : 0, 1, 'static');
}
// every var() used in the file is defined somewhere
{
  const defined = new Set(RULES.flatMap(r => Object.keys(r.decls)));
  const used = new Set([...src.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
  const missing = [...used].filter(u => !defined.has(u));
  record('static:every var() reference is defined', { kind: 'static', missing }, missing.length === 0 ? 1 : 0, 1, 'static', { missing });
}

// ── output ─────────────────────────────────────────────────────────────────────────────────────────
const pairs = [...results.values()].map(a => ({ ...a, min: +a.min.toFixed(3), max: +a.max.toFixed(3) }));
const byKind = {};
for (const p of pairs) { const k = p.kind; byKind[k] ??= { checks: 0, evaluations: 0, failingChecks: 0 }; byKind[k].checks++; byKind[k].evaluations += p.n; if (p.fails) byKind[k].failingChecks++; }
const summary = {
  generated: new Date().toISOString(), tokens: file,
  contexts: { themes: THEMES, system: SYSTEM, people: PEOPLE, modes: Object.keys(MODES), note: 'System resolves in hub.js to frost (day) / midnight (night); "Hearth on a dark OS" cannot occur because data-theme and data-scheme always agree and each theme sets color-scheme.' },
  pairKinds: pairs.length, evaluations: evaluated, failingPairKinds: pairs.filter(p => p.fails).length, failingEvaluations: failures.length,
  byKind,
};
const out = { summary, failures: failures.slice(0, 500), cvd, typeTable, accentMatrix: matrix, pairs };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(summary, null, 1));
const worst = pairs.filter(p => p.fails).sort((a, b) => a.min / a.threshold - b.min / b.threshold).slice(0, 40);
for (const w of worst) console.log(`FAIL ${w.id}: min ${w.min} < ${w.threshold} (${w.fails}/${w.n}; worst ${w.worst})`);
console.log('CVD', JSON.stringify(cvd));
process.exit(failures.length ? 1 : 0);
