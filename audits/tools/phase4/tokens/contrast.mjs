// Phase 4 · the synthesized token proposal · verification by computation.
//   node audits/tools/phase4/tokens/contrast.mjs [tokens.css] [out.json]
//   defaults: audits/tools/phase4/tokens/proposed-tokens.css → audits/evidence/p4/tokens/contrast.json
//
// It parses the token file, runs the CSS cascade itself (selector specificity and source order, :root / attribute /
// :not() compound selectors, @media width / pointer / prefers-* conditions, custom-property INHERITANCE into nested
// data-accent / data-theme-preview scopes and inline element styles, var() substitution with fallbacks, color-mix(in srgb) and alpha compositing) and
// checks every pair against its threshold, in every palette (6) x person family (9) x mode (adult, kid, kiosk,
// Increase Contrast, Reduce Transparency, kiosk + Reduce Transparency):
//   graded text: --text >= 7 everywhere incl. glass over the worst backdrop; --text-2 >= 6 on page/card/sheet and
//     >= 4.5 on wells and every glass (the fill alone; under the full sheen on --glass-strong everywhere and on --glass over
//     the page, a card and #767676); --text-3/--placeholder >= 4.5; 7 in the kiosk and Increase Contrast for neutral text,
//     inks, person solids, the badge and the toast (semantic solid labels stay AA by design, under their own id);
//   hue families: ink on wash/fill/every surface, ink-hi 7:1, on-strong labels, strong >= 4.5 as text (legacy
//     color:var(--accent) stays AA), graphic/non-text 3:1, tile glyphs 3:1, dark chips >= 1.5 off the card, chroma;
//   semantic: success/warning vs danger luminance >= 1.3, every semantic graphic >= 10 dE00 from every person graphic;
//   person accents through the data-accent scope; focus, today, selection, progress, hero, tab labels on glass;
//   legacy aliases as text on every surface; the kids' star outline; the TV panel over any photo;
//   CVD separation of the person graphics (CIEDE2000 >= 10, normal / protanopia / deuteranopia, Machado 2009);
//   type floors (11 / kid 16 / kiosk 18) in 90 kind x width x text-size contexts x 15 roles, glance roles, fields >= 16;
//   the kiosk keeping today's TV sizes and spacing EXACTLY at every width with the normal margin, and the opt-in 10-foot
//   scale (data-tv-scale="10ft": floor 28, body >= 32, margin 96, no legacy size shrinking) only at 1600 px+ and inert below;
//   kid mode rounded in every font token, adults' display in the text face; targets (44 / 60 / 52 rows; kid 64 / 84;
//   TV 64 / 88) growing with text size, the 4-pt grid, concentric radii and the kiosk's legacy radii, motion durations
//   (200-350 for every transition token incl. bouncy, exit, progress and the legacy --dur-1/2/3; the press-in is 0),
//   press scale, reduce-motion incl. the pulse;
//   structure: each prefers-* @media block resolves identically to its attribute block (and the opt-outs work), a stale
//   data-scheme cannot repaint a theme, "light"/"dark" alias Hearth/Midnight, [data-theme-preview] previews and nested
//   data-accent scopes re-derive, a BARE data-theme (F260's seg buttons, the Me theme cards) keeps the document palette,
//   no token carries var(--sheen-x) and an element-level --sheen-x write moves only that element (GLASS-7), Reduce
//   Transparency beats the kiosk look, color-scheme follows the theme, a dark root without data-theme resolves like
//   Midnight IN EVERY MODE (every token; the guard is (0,1,0)), a nested theme preview carrying data-accent re-derives and the
//   shipped markup carries data-accent on every data-scheme / data-theme-preview element, every hub.THEMES id is in every list (and in the bootstrap's scheme and theme-color maps), Forest keeps its
//   gold wash, every var() is defined, every name apps/design.css defines (but the 3 retired, 0-reader names) and every
//   var() the shell and apps read still resolves;
//   the pre-paint bootstrap (bootstrap.js) run in a sandbox in 12 cases, its attributes and theme-color metas fed back
//   through the cascade;
//   the labelled legacy backgrounds of the shell, apps and Dollywood template read as the shipped CSS writes them,
//   each passing as written or through its batch-1a pairing rewrite;
//   the hero button (.ds .hero .btn-primary, not a legacy-hue background) through its batch-1a row, in every palette x person x mode;
//   and a mutation test: 26 planted faults (tokens or bootstrap) must each make the gate fail.
// Reported minima are rounded DOWN (fl()), so a stated ">= x" is never above the true minimum.
// Exit code 1 if anything fails.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseColour, over, contrast, lum, oklch, de2000, simulate, hex } from './colour-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const FILE = process.argv[2] || path.join(HERE, 'proposed-tokens.css');
const OUT = process.argv[3] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'contrast.json');

// ── parsing ──────────────────────────────────────────────────────────────────────────────────────────────
function parseRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = []; let i = 0, order = 0;
  function block(media) {
    while (i < css.length) {
      const close = css.indexOf('}', i), open = css.indexOf('{', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return; }
      if (open === -1) { i = css.length; return; }
      const head = css.slice(i, open).trim(); i = open + 1;
      if (head.startsWith('@media')) { block(head.slice(6).trim()); continue; }
      const end = css.indexOf('}', i); const body = css.slice(i, end); i = end + 1;
      const decls = {};
      let depth = 0, cur = '', q = null;
      const push = d => { const m = d.match(/^\s*(--[\w-]+|color-scheme)\s*:\s*([\s\S]*?)\s*$/); if (m) decls[m[1]] = m[2].replace(/\s+/g, ' '); };   // color-scheme is inherited too
      for (const ch of body) {
        if (q) { if (ch === q) q = null; cur += ch; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        if (ch === '(') depth++; if (ch === ')') depth--;
        if (ch === ';' && depth === 0) { push(cur); cur = ''; } else cur += ch;
      }
      push(cur);
      rules.push({ selectors: head.split(',').map(s => s.trim()), media, decls, order: order++ });
    }
  }
  block(null);
  return rules;
}

// compound selectors only: :root, [attr], [attr="v"], :not([attr="v"]), .class, and :where(<compound>) which adds NO specificity
function matchSel(sel, el) {
  if (/\s/.test(sel.replace(/\[[^\]]*\]/g, ''))) return null;           // descendant selectors are not used in the token file
  const w = sel.match(/:where\(((?:[^()]|\((?:[^()])*\))*)\)/);          // one :where() with one level of nested parens (:not(...))
  if (w) {
    const inner = matchSel(w[1], el), outer = matchSel(sel.replace(w[0], ''), el);
    return inner == null || outer == null ? null : outer;                // :where() contributes 0 to the specificity
  }
  const parts = sel.match(/:root|:not\(\[[^\]]+\]\)|\[[^\]]+\]|\.[\w-]+/g) || [];
  if (parts.join('') !== sel) return null;
  let spec = 0;
  for (const p of parts) {
    spec++;
    if (p === ':root') { if (!el.isRoot) return null; continue; }
    if (p.startsWith('.')) { if (!(el.classes || []).includes(p.slice(1))) return null; continue; }
    const neg = p.startsWith(':not(');
    const m = (neg ? p.slice(5, -1) : p).match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
    if (!m) return null;
    const has = m[1] in el.attrs && (m[2] === undefined || el.attrs[m[1]] === m[2]);
    if (neg ? has : !has) return null;
  }
  return spec;
}
function matchMedia(media, env) {
  return media.split(/\s+and\s+/).every(cond => {
    const m = cond.trim().match(/^\(\s*([\w-]+)\s*:\s*([\w-]+?)(px)?\s*\)$/);
    if (!m) return false;
    const [, f, v] = m;
    if (f === 'min-width') return (env.width ?? 390) >= +v;
    if (f === 'max-width') return (env.width ?? 390) <= +v;
    if (f === 'pointer') return (env.pointer ?? 'coarse') === v;
    if (f === 'prefers-contrast') return env.prefersContrast === v;
    if (f === 'prefers-reduced-transparency') return env.prefersReducedTransparency === v;
    if (f === 'prefers-reduced-motion') return env.prefersReducedMotion === v;
    return false;
  });
}

// ── the cascade with inheritance ─────────────────────────────────────────────────────────────────────────
function makeEngine(RULES) {
  function declared(el, env) {
    const hits = [];
    for (const r of RULES) {
      if (r.media && !matchMedia(r.media, env)) continue;
      let best = null;
      for (const s of r.selectors) { const sp = matchSel(s, el); if (sp != null && (best == null || sp > best)) best = sp; }
      if (best != null) for (const [k, v] of Object.entries(r.decls)) hits.push({ k, v, spec: best, order: r.order });
    }
    hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
    const map = {}; for (const h of hits) map[h.k] = h.v;
    if (el.style) Object.assign(map, el.style);                 // an inline style (element.style.setProperty) wins over every rule
    return map;
  }
  // chain: [rootEl, childEl, ...]; returns get(name) for the last element (computed values, custom-property inheritance)
  function computed(chain, env = {}) {
    let parent = () => undefined;
    for (const el of chain) {
      const decl = declared(el, env), cache = {}, up = parent;
      const get = (name, stack = []) => {
        if (name in cache) return cache[name];
        if (!(name in decl)) return up(name);
        if (stack.includes(name)) return undefined;             // cycle: guaranteed-invalid
        const v = subst(decl[name], n => get(n, [...stack, name]));
        cache[name] = v; return v;
      };
      get.declared = decl;
      parent = get;
    }
    return parent;
  }
  return { declared, computed };
}
function subst(v, get) {
  let out = '', i = 0;
  while (i < v.length) {
    const j = v.indexOf('var(', i);
    if (j === -1) { out += v.slice(i); break; }
    out += v.slice(i, j);
    let d = 0, k = j + 3, comma = -1;
    for (; k < v.length; k++) { const c = v[k]; if (c === '(') d++; else if (c === ')') { d--; if (d === 0) break; } else if (c === ',' && d === 1 && comma < 0) comma = k; }
    const inner = v.slice(j + 4, k);
    const name = (comma < 0 ? inner : v.slice(j + 4, comma)).trim();
    const fb = comma < 0 ? undefined : v.slice(comma + 1, k).trim();
    let r = get(name);
    if (r === undefined && fb !== undefined) r = subst(fb, get);
    if (r === undefined) return undefined;
    out += r; i = k + 1;
  }
  return out;
}

// ── value evaluation ─────────────────────────────────────────────────────────────────────────────────────
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
function num(expr) {
  if (expr === undefined) throw new Error('undefined length');
  const js = expr.replace(/calc\(/g, '(').replace(/max\(/g, 'Math.max(').replace(/min\(/g, 'Math.min(').replace(/(\d*\.?\d+)(px|ms)/g, '$1');
  if (/[^\d.\s+*\/()\-,Mathmaxin]/.test(js)) throw new Error('cannot evaluate: ' + expr);
  return Function('return ' + js)();
}

// ── the model of the household ───────────────────────────────────────────────────────────────────────────
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const HUES = PEOPLE.slice(0, 8);
// Phase 5, decision D5: the nine APP families (in-between pastels, none shared with a person; audits/tools/phase5/app-hues.mjs).
// An app tile / glance card / icon carries data-accent=<its hue>, so every accent-context check runs for them too.
const APPS = ['coral', 'apricot', 'honey', 'pistachio', 'leaf', 'seafoam', 'lagoon', 'cornflower', 'orchid'];
const APP_OF = { timer: 'coral', prayer: 'apricot', kidverse: 'honey', verses: 'pistachio', leftovers: 'leaf', tally: 'seafoam', 'dollywood-live': 'lagoon', f260: 'cornflower', dollywood: 'orchid' };   // apps.json id → hue (batch 2 writes it as "hue")
const ACCENTS = [...PEOPLE, ...APPS];
const SEMANTIC = ['success', 'warning', 'danger'];
const FAMILIES = [...PEOPLE, ...APPS, ...SEMANTIC];
const ROLES = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'];
const MODES = {
  adult: {}, kid: { kind: 'kid' }, kiosk: { kind: 'kiosk' },
  'contrast-more': { contrast: 'more' }, 'reduce-transparency': { transparency: 'reduce' },
  'kiosk+reduce-transparency': { kind: 'kiosk', transparency: 'reduce' },
};
const HI = new Set(['kiosk', 'contrast-more', 'kiosk+reduce-transparency']);
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'];
const PAGE_CARD = ['bg', 'surface', 'surface-raised'];
const WELLS = ['surface-2', 'fill-field', 'hover'];
const P = parseColour;
const fl = (v, d = 2) => Math.floor(v * 10 ** d + 1e-9) / 10 ** d;   // reported MINIMA round down, never up
const rootEl = (theme, extra = {}) => ({ isRoot: true, attrs: { theme, scheme: THEMES[theme] ?? (theme === 'light' ? 'light' : 'dark'), kind: 'adult', ...extra } });

// ── L6: legacy backgrounds that carry a label, read exactly as the shipped CSS writes them ───────────────────
// Files: the shell, the design.css component half, every app, and the Dollywood template (the exported pair's source).
// A rule qualifies when its background reads a legacy hue / person colour and the same rule sets `color:`.
const TEMPLATE = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');
const LABEL_LOCALS = {                                                   // the file-local names those rules read
  'apps/f260.html': { light: { '--on-solid': 'white' }, dark: { '--on-solid': 'var(--on-accent)' } },          // apps/f260.html:26, :28
  'apps/leftovers.html': { any: { '--ledger': 'var(--olive-ink)', '--ledger-ink': 'var(--surface)' } },        // apps/leftovers.html:14
  'template.html': { any: { '--forest': 'var(--olive-ink)', '--cat-ink': '#1C1714' } },                         // template.html:212, :217
};
const LEGACY_BG = /var\(--(gold|olive|teal|terra|slate|mocha|ok|warn|danger|info|accent|accent-deep|accent-strong|tint|ledger|forest|ochre|moss|clay)[,)]/;
const ON_LABEL = /^(#fff(fff)?|white|var\(--(on-accent|on-solid|ledger-ink)\))$/i;
const FAMILY_OF = { gold: 'butter', olive: 'mint', teal: 'aqua', terra: 'peach', slate: 'periwinkle', mocha: 'graphite', ok: 'success', warn: 'warning', danger: 'danger', info: 'sky', ledger: 'success', forest: 'mint', ochre: 'butter', moss: 'success', clay: 'danger' };
const SEMANTIC_BY_SELECTOR = [[/\.btn\.danger$/, 'danger'], [/\.tdone$|\.btn\.got$|\.btn\.got\.btn-primary$/, 'success']];
function rewriteFor(selector, bg, label) {
  if (/\.hero$/.test(selector)) return { bg: 'linear-gradient(160deg, var(--accent-wash), var(--accent-fill))', label: 'var(--accent-ink)', why: 'a surface: --hero-bg with --accent-ink (the deep tint in dark)' };
  if (/\.msg\.user$/.test(selector)) return { bg: 'var(--accent-fill)', label: 'var(--accent-ink)', why: 'a surface (the chat bubble): --accent-fill with --accent-ink' };
  if (/\.avatar$/.test(selector)) return { bg: 'var(--accent-fill)', label: 'var(--accent-ink)', why: 'an avatar is a small surface carrying an initial (or the fallback dot): --accent-fill with --accent-ink; its ring is --accent-graphic' };
  if (/\.badge$/.test(selector) && /--danger\)/.test(bg)) return { bg: 'var(--badge-bg)', label: 'var(--badge-ink)', why: 'the badge tokens' };
  if (!ON_LABEL.test(label)) return null;                       // a tint carrying a text colour: no rewrite, it must pass as written
  const n = bg.match(LEGACY_BG)[1];
  let fam = /^(accent|accent-deep|accent-strong|tint)$/.test(n) ? 'accent' : FAMILY_OF[n];
  for (const [re, f] of SEMANTIC_BY_SELECTOR) if (re.test(selector)) fam = f;
  return { bg: `var(--${fam}-strong)`, label: `var(--${fam}-on)`, why: `pairing rule: --${fam}-strong + --${fam}-on` };
}
function bgStops(v) {
  v = v.replace(/!important/g, '').replace(/\s+/g, ' ').trim();
  if (splitTop(v).length > 1) return null;                       // a layered glass recipe, not a solid
  const g = v.match(/^(?:linear|radial)-gradient\(([\s\S]*)\)$/);
  if (!g) return [v];
  return splitTop(g[1]).map(p => p.replace(/(\s+-?[\d.]+(%|px|deg)?)+$/, '').trim()).filter(p => /^(var\(|color-mix\(|#|rgba?\(|white|black)/i.test(p));
}
function labelPass(E, record, extras) {
  const files = ['index.html', 'apps/design.css', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => /\.html$/.test(f) && !/^dollywood/.test(f)).map(f => 'apps/' + f)];
  if (fs.existsSync(TEMPLATE)) files.push('template.html');
  for (const f of files) {
    let t = fs.readFileSync(f === 'template.html' ? TEMPLATE : path.join(ROOT, f), 'utf8');
    let offset = 0;
    if (f === 'apps/design.css') { const lines = t.split('\n'); offset = 289; t = lines.slice(289).join('\n'); }   // the component half
    const re = /([^{}]*)\{([^{}]*)\}/g; let m;
    while ((m = re.exec(t))) {
      const body = m[2];
      const bgm = body.match(/background(?:-color)?\s*:\s*([^;]*)/); const col = body.match(/(?:^|;|\s)color\s*:\s*([^;]+)/);
      if (!bgm || !col || !LEGACY_BG.test(bgm[1])) continue;
      const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').pop().trim().replace(/\s+/g, ' ');
      const line = offset + t.slice(0, m.index + m[1].length + 1 + body.indexOf(bgm[0])).split('\n').length;
      const at = `${f === 'template.html' ? '../dollywood-build-project/scripts/template.html' : f}:${line} ${selector}`;
      const bg = bgm[1].replace(/\s+/g, ' ').trim(), label = col[1].replace(/!important/g, '').trim();
      if (/--pop-cat/.test(bg)) { extras.labels.push({ at, bg, label, status: 'exempt: a map-category badge (cartography, D12); --pop-cat is set per category' }); continue; }
      const stops = bgStops(bg);
      if (!stops) { extras.labels.push({ at, bg: bg.slice(0, 80), label, status: 'skipped: a layered background (several layers, not one solid or gradient), label --text; the glass recipes among them are covered by the glass checks' }); continue; }
      const thr = /icon/.test(selector) ? 3 : 4.5;
      const rw = rewriteFor(selector, bg, label);
      const measure = (bgExpr, lab) => {
        let min = Infinity, worst = '';
        for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of ACCENTS) {
          const get = E.computed([rootEl(theme, { accent })]);
          const loc = { ...(LABEL_LOCALS[f]?.any || {}), ...(LABEL_LOCALS[f]?.[scheme] || {}) };
          const g = n => (n in loc ? subst(loc[n], g) : get(n));
          const surface = evalColour(get('--surface'));
          const colour = expr => { const v = subst(expr, g); if (v === undefined) throw new Error(`${at}: cannot resolve ${expr}`); const c = evalColour(v); return c.a < 0.999 ? over(c, surface) : c; };
          const L = colour(lab);
          for (const st of bgStops(bgExpr)) { const c = contrast(L, colour(st)); if (c < min) { min = c; worst = `${theme}/${accent}`; } }
        }
        return { min: fl(min), worst };
      };
      const asWritten = measure(bg, label);
      const entry = { at, bg: bg.slice(0, 90), label, threshold: thr, asWritten };
      if (rw) {
        entry.rewrite = { bg: rw.bg, label: rw.label, why: rw.why, ...measure(rw.bg, rw.label) };
        entry.status = asWritten.min >= thr ? 'passes as written; batch 1a still applies the pairing rewrite' : 'FAILS as written; the batch-1a rewrite fixes it';
        record(`labels:every labelled legacy background has a batch-1a rewrite that passes (${thr === 3 ? 'icon 3:1' : 'text 4.5:1'})`, { kind: 'legacy' }, entry.rewrite.min, thr, `${at} → ${rw.bg} / ${rw.label} (${entry.rewrite.worst})`);
        const onLabel = /-on\)$|badge-ink|^white$|^#fff/i.test(rw.label);
        record('labels:pairing rule: an -on / white label only ever sits on a -strong (or the badge), never on -fill, -wash or -fill-strong', { kind: 'structure' }, !onLabel || /-strong\)$|badge-bg/.test(rw.bg) ? 1 : 0, 1, at);
      } else {
        entry.status = asWritten.min >= thr ? 'passes as written' : 'FAILS as written (no rewrite)';
        record(`labels:a labelled legacy tint passes as written (${thr === 3 ? 'icon 3:1' : 'text 4.5:1'})`, { kind: 'legacy' }, asWritten.min, thr, `${at} (${asWritten.worst})`);
      }
      extras.labels.push(entry);
    }
  }
}

// ── L7 (revision 5): the hero button, the one labelled capsule whose background is NOT a legacy hue ─────────
// `.ds .hero .btn-primary` (apps/design.css:423, the Me hero's Switch) paints rgba(255,255,255,.92) with a var(--accent-deep)
// label, so labelPass (legacy-hue backgrounds only) never saw it. Once batch 1a points --accent-deep at the glowing dark ink,
// the label reads 1.19-1.29 in dark. The batch-1a row replaces the rule with HERO_BTN_ROW; this pass reads the shipped rule
// (it must still be what the row was written against), measures it as written (reported, not gated: the row exists because it
// fails) and gates the row's pair in every palette x person x mode, composited over both hero stops, plus the cascade guard
// (the rule must stay after every same-specificity .btn / .btn-primary state rule that sets a background).
const HERO_BTN_SELECTOR = '.ds .hero .btn-primary';
const HERO_BTN_SHIPPED = { background: 'rgba(255,255,255,.92)', color: 'var(--accent-deep)' };
const HERO_BTN_ROW = { background: 'var(--hero-btn-bg)', color: 'var(--hero-btn-ink)', 'box-shadow': 'var(--e2)' };
function heroButtonPass(E, record, extras) {
  const css = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
  const lines = css.split('\n');
  const idx = lines.findIndex(l => l.trim().startsWith(HERO_BTN_SELECTOR + ' {'));
  const at = `apps/design.css:${idx + 1} ${HERO_BTN_SELECTOR}`;
  const body = idx >= 0 ? lines[idx].slice(lines[idx].indexOf('{') + 1, lines[idx].lastIndexOf('}')) : '';
  const decl = n => { const m = body.match(new RegExp('(?:^|;)\\s*' + n + '\\s*:\\s*([^;]+)')); return m ? m[1].trim().replace(/\s+/g, '') : null; };
  const shippedOk = idx >= 0 && decl('background') === HERO_BTN_SHIPPED.background.replace(/\s+/g, '') && decl('color') === HERO_BTN_SHIPPED.color;
  record('labels:the hero button row is written against the shipped rule (.ds .hero .btn-primary: white 92 % capsule, --accent-deep label)', { kind: 'structure' }, shippedOk ? 1 : 0, 1, at, { background: decl('background'), color: decl('color') });
  // the cascade guard: .ds .btn:hover (:373) and .ds .btn-primary:hover (:374) have the same specificity (0,3,0) and set a background;
  // the hero rule wins only because it comes later, and the row keeps it there.
  const states = lines.map((l, i) => [l.trim(), i]).filter(([l]) => /^\.ds \.btn(-primary)?:(hover|active|focus-visible)\s*\{/.test(l) && /background/.test(l));
  const orderOk = idx >= 0 && states.every(([, i]) => i < idx);
  record('labels:the hero button row stays after every same-specificity .btn / .btn-primary state rule that sets a background', { kind: 'structure' }, orderOk ? 1 : 0, 1, `${at} after ${states.map(([, i]) => ':' + (i + 1)).join(', ')}`);
  const out = { at, row: `${HERO_BTN_SELECTOR} { ${Object.entries(HERO_BTN_ROW).map(([k, v]) => `${k}: ${v}`).join('; ')}; }`, asWritten: {}, row_min: {} };
  for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of ACCENTS) for (const [mode, extra] of Object.entries(MODES)) {
    const get = E.computed([rootEl(theme, { accent, ...extra })]);
    const colour = expr => { const v = subst(expr, get); if (v === undefined) throw new Error(`${at}: cannot resolve ${expr}`); return evalColour(v); };
    const stops = [colour('var(--accent-wash)'), colour('var(--accent-fill)')];     // the hero after batch 1a: --hero-bg, wash → fill
    const hi = HI.has(mode), T = hi ? 7 : 4.5, ctx = `${theme}/${accent}/${mode}`;
    let wMin = Infinity, rMin = Infinity;
    for (const st of stops) {
      const wBg = over(colour(HERO_BTN_SHIPPED.background), st), wInk = colour(HERO_BTN_SHIPPED.color);
      wMin = Math.min(wMin, contrast(wInk.a < 0.999 ? over(wInk, wBg) : wInk, wBg));
      const rBgRaw = colour(HERO_BTN_ROW.background), rBg = rBgRaw.a < 0.999 ? over(rBgRaw, st) : rBgRaw, rInkRaw = colour(HERO_BTN_ROW.color);
      rMin = Math.min(rMin, contrast(rInkRaw.a < 0.999 ? over(rInkRaw, rBg) : rInkRaw, rBg));
    }
    record(`labels:the hero button (${HERO_BTN_SELECTOR}, batch-1a row --hero-btn-bg / --hero-btn-ink) over both hero stops` + (hi ? ' [7:1 modes: kiosk, Increase Contrast]' : ''), { kind: 'legacy' }, rMin, T, `${at} ${ctx}`);
    const k = `${scheme}${hi ? ' 7:1 modes' : ''}`;
    out.asWritten[k] = Math.min(out.asWritten[k] ?? Infinity, wMin);
    out.row_min[k] = Math.min(out.row_min[k] ?? Infinity, rMin);
  }
  for (const o of [out.asWritten, out.row_min]) for (const k of Object.keys(o)) o[k] = fl(o[k]);
  extras.heroButton = out;
}

// ── one full verification of a token source ──────────────────────────────────────────────────────────────
const BOOT_SRC = fs.readFileSync(path.join(HERE, 'bootstrap.js'), 'utf8');
function verify(src, { withExtras = true, boot = BOOT_SRC } = {}) {
  const RULES = parseRules(src);
  const E = makeEngine(RULES);
  const results = new Map(); const failures = []; let evaluated = 0;
  function record(id, meta, value, threshold, ctx, extra = {}) {
    evaluated++;
    let a = results.get(id);
    if (!a) { a = { id, ...meta, threshold, n: 0, min: Infinity, max: -Infinity, worst: null, fails: 0 }; results.set(id, a); }
    a.n++;
    if (value < a.min) { a.min = value; a.worst = ctx; }
    if (value > a.max) a.max = value;
    if (threshold > a.threshold) a.threshold = threshold;
    if (!(value >= threshold - 1e-9)) { a.fails++; if (failures.length < 2000) failures.push({ id, context: ctx, value: +(+value).toFixed(3), threshold, ...extra }); }
  }
  const extras = { familyTable: {}, accentMatrix: {}, neutralTable: {}, cvd: {}, typeTable: {}, samples: [], legacy: null, semantic: {}, glassLayers: {}, labels: [], bootstrap: [], kioskTiers: {}, heroButton: null };

  // A–G: every palette x person x mode
  for (const [theme, scheme] of Object.entries(THEMES)) {
    for (const accent of ACCENTS) {
      for (const [mode, extra] of Object.entries(MODES)) {
        const label = `${theme}/${accent}/${mode}`;
        const get = E.computed([rootEl(theme, { accent, ...extra })]);
        const raw = n => { const v = get('--' + n); if (v === undefined) throw new Error(`${label}: --${n} undefined`); return v; };
        const col = n => evalColour(raw(n));
        const solid = n => { const c = col(n); if (c.a < 0.999) throw new Error(`${label}: --${n} not opaque (${raw(n)})`); return c; };
        const A0 = n => solid('accent-' + n);
        const hi = HI.has(mode);
        const T = hi ? 7 : 4.5;
        const pickupColour = () => { const v = raw('glass-pickup-layer'), i = v.indexOf('color-mix('); let d = 0, k = i; for (; k < v.length; k++) { if (v[k] === '(') d++; else if (v[k] === ')' && --d === 0) break; } return evalColour(v.slice(i, k + 1)); };
        const pair = (id, f, b, thr, kind) => record(hi ? id + " [7:1 modes: kiosk, Increase Contrast]" : id, { kind }, contrast(f, b), thr, label);

        // A. neutral text, graded
        for (const bg of OPAQUE) {
          pair(`text:text/${bg} (primary >= 7)`, solid('text'), solid(bg), 7, 'text');
          pair(`text:text-2/${bg} (secondary)`, solid('text-2'), solid(bg), hi ? 7 : (PAGE_CARD.includes(bg) ? 6 : 4.5), 'text');
          for (const fg of ['text-3', 'placeholder']) pair(`text:${fg}/${bg}`, solid(fg), solid(bg), T, 'text');
        }
        // non-text neutrals
        // --muted-decor (legacy alias): its readers are PIN rings, the offline dot and unearned badge icons, so >= 3:1
        for (const fg of ['field-border', 'track-info', 'cell-empty', 'switch-off-ring', 'status-offline', 'muted-decor'])
          for (const bg of OPAQUE) pair(`ui:${fg}/${bg}`, solid(fg), solid(bg), 3, 'non-text');
        for (const bg of OPAQUE) pair(`ui:switch-on/${bg}`, solid('switch-on'), solid(bg), 3, 'non-text');
        pair('ui:switch-knob/switch-on', solid('switch-knob'), solid('switch-on'), 3, 'non-text');
        pair('ui:chevron-colour/fill-field', solid('chevron-colour'), solid('fill-field'), 3, 'non-text');
        pair('ui:badge-ink/badge-bg', solid('badge-ink'), solid('badge-bg'), T, 'text');
        for (const bg of PAGE_CARD) pair(`ui:badge-bg/${bg}`, solid('badge-bg'), solid(bg), 3, 'non-text');
        // depth
        record(`depth:surface off bg (${scheme})`, { kind: 'depth' }, contrast(solid('surface'), solid('bg')), scheme === 'dark' ? 1.2 : 1.05, label);
        if (scheme === 'dark') {
          const s1 = solid('surface');
          for (const w of ['surface-2', 'fill-field']) { const c = solid(w); record(`depth:${w} lighter than surface (dark)`, { kind: 'depth' }, lum(c) > lum(s1) ? contrast(c, s1) : 0, 1.1, label); }
          const r = solid('surface-raised'); record('depth:surface-raised lighter than surface (dark)', { kind: 'depth' }, lum(r) > lum(s1) ? contrast(r, s1) : 0, 1.05, label);
        }

        // B. glass over the page, a card, busy content and the worst backdrop (black under light glass, white under dark)
        const backs = { bg: solid('bg'), surface: solid('surface'), mid: P('#767676'), worst: P(scheme === 'light' ? '#000000' : '#FFFFFF') };
        for (const [bn, b] of Object.entries(backs)) {
          for (const g of ['glass', 'glass-strong']) {
            const gc = over(col(g), b);
            pair(`glass:text/${g} over ${bn}`, solid('text'), gc, 7, 'text');
            pair(`glass:text-2/${g} over ${bn}`, solid('text-2'), gc, hi ? 7 : 4.5, 'text');
            if (bn !== 'worst') pair(`glass:text-3/${g} over ${bn}`, solid('text-3'), gc, T, 'text');
          }
          const gs = over(col('glass-strong'), b);
          if (bn !== 'worst') {
            for (const s of ['status-offline', 'status-pending', 'status-synced', 'status-error', 'map-north']) pair(`glass:${s}/glass-strong over ${bn}`, solid(s), gs, 3, 'non-text');
          }
          pair(`toast:toast-ink/toast-bg over ${bn}`, solid('toast-ink'), over(col('toast-bg'), b), 7, 'text');
          // The shipped recipe (--glass-bg / --glass-bg-strong) adds two layers over the fill: the white specular sheen
          // (--glass-spec, full at the top edge, gone by 34 % of the height) and the person's strong tone at --glass-pickup (a
          // radial above the bar). GATED: text and text-2 under the FULL sheen (sheet titles sit in the top third) in every mode.
          // REPORTED (upper bounds, not gated): the tab icon and label under the FULL pickup; the radial fades before the label row.
          {
            const sheen = g => over(col('glass-spec'), over(col(g), b));
            // sheets, the top bar and the tab bar are --glass-strong: gated there
            pair(`glass:text under the full sheen/glass-strong over ${bn}`, solid('text'), sheen('glass-strong'), 7, 'text');
            pair(`glass:text-2 under the full sheen/glass-strong over ${bn}`, solid('text-2'), sheen('glass-strong'), hi ? 7 : 4.5, 'text');
            // pills and buttons (--glass) under the full sheen: GATED over the page, a card and busy content (#767676); over a photo
            // (the worst backdrop) only reported, with the rule "pills and buttons over photos use --glass-strong"
            // sheets and every glass surface but the two bars paint the pickup IN PLACE (--glass-bg(-strong)-tinted): text under the
            // full sheen AND the full pickup (sheet titles, the top of a pill)
            const pick0 = pickupColour();   // the colour --glass-pickup-layer paints at its centre (read from the token)
            const tinted = g => over(col('glass-spec'), over(pick0, over(col(g), b)));
            pair(`glass:text under the full sheen and pickup/glass-strong (sheets) over ${bn}`, solid('text'), tinted('glass-strong'), 7, 'text');
            pair(`glass:text-2 under the full sheen and pickup/glass-strong (sheets) over ${bn}`, solid('text-2'), tinted('glass-strong'), hi ? 7 : 4.5, 'text');
            if (bn !== 'worst') pair(`glass:text-3 under the full sheen and pickup/glass-strong (sheets) over ${bn}`, solid('text-3'), tinted('glass-strong'), T, 'text');   // revision 6b (verify-rev6 issue 6); text-3 on --glass is a lint row, never used
            if (bn !== 'worst') {
              pair(`glass:text under the full sheen and pickup/glass (pills, buttons) over ${bn}`, solid('text'), tinted('glass'), 7, 'text');
              pair(`glass:text-2 under the full sheen and pickup/glass (pills, buttons) over ${bn}`, solid('text-2'), tinted('glass'), hi ? 7 : 4.5, 'text');
              pair(`glass:text under the full sheen/glass (pills, buttons) over ${bn}`, solid('text'), sheen('glass'), 7, 'text');
              pair(`glass:text-2 under the full sheen/glass (pills, buttons) over ${bn}`, solid('text-2'), sheen('glass'), hi ? 7 : 4.5, 'text');
            }
            if (mode === 'adult' || mode === 'contrast-more') {
              const L0 = extras.glassLayers[`${theme}/${mode}`] ??= {};
              for (const [k, v] of [['text under the full sheen on --glass (buttons, pills)', contrast(solid('text'), sheen('glass'))], ['text-2 under the full sheen on --glass (buttons, pills)', contrast(solid('text-2'), sheen('glass'))]]) {
                const kk = `${k} over ${bn}`; if (!(kk in L0) || v < L0[kk].v) L0[kk] = { v: fl(v), at: accent };
              }
              const pick = pickupColour();
              const withPick = over(pick, over(col('glass-strong'), b));
              const L = extras.glassLayers[`${theme}/${mode}`] ??= {};
              const mn = (k, v) => { k = `${k} over ${bn}`; if (!(k in L) || v < L[k].v) L[k] = { v: fl(v), at: accent }; };
              mn('accent-graphic (an identity mark) under the full pickup', contrast(A0('graphic'), withPick));
              mn('accent-ink (the selected tab: icon and label) under the full pickup', contrast(A0('ink'), withPick));
              mn('accent-graphic (an identity mark) under the full sheen', contrast(A0('graphic'), over(col('glass-spec'), over(col('glass-strong'), b))));
            }
          }
          pair(`toast:toast-ink-2/toast-bg over ${bn}`, solid('toast-ink-2'), over(col('toast-bg'), b), T, 'text');
          pair(`glass:glass-inverse-ink/glass-inverse over ${bn}`, solid('glass-inverse-ink'), over(col('glass-inverse'), b), T, 'text');
        }
        // Reduce Transparency must give opaque glass (also on the TV, where the kiosk block sets the look)
        if (extra.transparency === 'reduce') for (const g of ['glass', 'glass-strong', 'glass-look'])
          record(`structure:reduce-transparency makes --${g} solid (${mode})`, { kind: 'structure' }, col(g).a >= 0.999 && hex(col(g)) === hex(solid(g === 'glass-strong' ? 'glass-strong-solid' : 'glass-solid')) ? 1 : 0, 1, label);

        // C. families (independent of the accent: once per theme x mode)
        if (accent === 'graphite') {
          for (const f of FAMILIES) {
            const F = n => solid(`${f}-${n}`);
            for (const bg of ['wash', 'fill']) pair(`fam:${f}-ink/${f}-${bg}`, F('ink'), F(bg), T, 'text');
            for (const bg of OPAQUE) pair(`fam:${f}-ink/${bg}`, F('ink'), solid(bg), T, 'text');
            pair(`fam:${f}-ink-hi/${f}-fill`, F('ink-hi'), F('fill'), 7, 'text-hi');
            for (const bg of OPAQUE) pair(`fam:${f}-ink-hi/${bg}`, F('ink-hi'), solid(bg), 7, 'text-hi');
            pair(`fam:${f}-ink/${f}-fill-strong (tile glyph)`, F('ink'), F('fill-strong'), 3, 'graphic');
            if (SEMANTIC.includes(f)) record(`fam:${f}-on/${f}-strong (semantic solid label: AA in every mode, never swapped)`, { kind: 'text' }, contrast(F('on'), F('strong')), 4.5, label);
            else pair(`fam:${f}-on/${f}-strong (label on a solid fill)`, F('on'), F('strong'), T, 'text');
            for (const bg of OPAQUE) {
              pair(`fam:${f}-strong/${bg}`, F('strong'), solid(bg), SEMANTIC.includes(f) ? 3 : T, SEMANTIC.includes(f) ? 'graphic' : 'text');
              pair(`fam:${f}-graphic/${bg}`, F('graphic'), solid(bg), 3, 'graphic');
            }
            pair(`fam:${f}-strong/${f}-fill (progress on its track)`, F('strong'), F('fill'), 3, 'graphic');
            if (scheme === 'dark') record(`depth:${f}-fill off surface (dark chip, >= 1.5: COLOR-8)`, { kind: 'depth' }, contrast(F('fill'), solid('surface')), 1.5, label);
            if (mode === 'adult' && f !== 'graphite') {
              record(`chroma:${f}-fill (${scheme})`, { kind: 'chroma' }, oklch(F('fill')).C, scheme === 'light' ? 0.055 : 0.05, label);
              record(`chroma:${f}-strong (${scheme})`, { kind: 'chroma' }, oklch(F('strong')).C, 0.09, label);
            }
            if (mode === 'adult') {
              const t = (extras.familyTable[scheme] ??= {})[f] ??= {};
              const mn = (k, v) => { t[k] = Math.min(t[k] ?? Infinity, fl(v)); };
              mn('ink/fill', contrast(F('ink'), F('fill'))); mn('ink/wash', contrast(F('ink'), F('wash')));
              mn('ink/surfaces', Math.min(...OPAQUE.map(b => contrast(F('ink'), solid(b)))));
              mn('ink-hi/fill', contrast(F('ink-hi'), F('fill'))); mn('on/strong', contrast(F('on'), F('strong')));
              mn('strong/surfaces', Math.min(...OPAQUE.map(b => contrast(F('strong'), solid(b)))));
              mn('graphic/surfaces', Math.min(...OPAQUE.map(b => contrast(F('graphic'), solid(b)))));
              mn('ink/fill-strong', contrast(F('ink'), F('fill-strong')));
              if (scheme === 'dark') mn('fill/surface', contrast(F('fill'), solid('surface')));
              for (const r of ROLES) t[r] = hex(F(r));
              t['fill C'] = Math.min(t['fill C'] ?? Infinity, fl(oklch(F('fill')).C, 3));
            }
          }
          // D. semantic distinctness
          const sc = n => solid(`${n}-strong`);
          record(`semantic:success-strong vs danger-strong luminance ratio`, { kind: 'semantic' }, contrast(sc('success'), sc('danger')), 1.3, label);
          record(`semantic:warning-strong vs danger-strong luminance ratio`, { kind: 'semantic' }, contrast(sc('warning'), sc('danger')), 1.3, label);
          for (const s of SEMANTIC) for (const p of PEOPLE)
            record(`semantic:${s}-graphic vs person ${p}-graphic dE00 (${scheme})`, { kind: 'semantic' }, de2000(solid(`${s}-graphic`), solid(`${p}-graphic`)), 10, label);
          // a semantic -strong is a FILL only (round 4): as text it is under 4.5 on the light pages, so semantic text is -ink. Reported here,
          // not gated as text (the gate holds it to 3:1 as a graphic above); the Phase 6 lint refuses --success-strong / --warning-strong as text.
          if (mode === 'adult') for (const s of SEMANTIC) {
            const t = (extras.semantic[scheme] ??= {}); const k = s + '-strong as text, lowest on an opaque surface (reported: a fill only)';
            t[k] = Math.min(t[k] ?? Infinity, fl(Math.min(...OPAQUE.map(b => contrast(sc(s), solid(b))))));
          }
          if (mode === 'adult') for (const [a, b] of [['success', 'danger'], ['success', 'warning'], ['warning', 'danger']]) for (const vis of ['normal', 'protan', 'deutan'])
            (extras.semantic[scheme] ??= {})[`${a}/${b} ${vis}`] = fl(de2000(simulate(solid(`${a}-graphic`), vis), simulate(solid(`${b}-graphic`), vis)), 1);
          // the kids' star is read by its outline
          for (const bg of OPAQUE) pair(`star:star-stroke/${bg}`, solid('star-stroke'), solid(bg), 3, 'non-text');
          // legacy hue aliases as text (every existing color: var(--gold) … must be AA the day the file lands)
          for (const n of ['gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger', 'gold-ink', 'olive-ink', 'teal-ink', 'terra-ink', 'slate-ink', 'mocha-ink', 'ok-ink', 'warn-ink', 'danger-ink', 'muted'])
            for (const bg of OPAQUE) pair(`legacy:--${n} as text/${bg}`, solid(n), solid(bg), T, 'legacy');
          // the TV board over any album photo
          if (mode === 'kiosk') {
            const photos = { white: P('#FFFFFF'), black: P('#000000'), mid: P('#767676'), ...Object.fromEntries(FAMILIES.flatMap(f => [[`${f}-fill`, solid(`${f}-fill`)], [`${f}-fill-strong`, solid(`${f}-fill-strong`)]])) };
            for (const [pn, ph] of Object.entries(photos)) {
              const bgc = over(col('tv-panel'), ph);
              record('tv:tv-text over tv-panel over any photo', { kind: 'text' }, contrast(solid('tv-text'), bgc), 7, `${label}/${pn}`);
              record('tv:tv-text-2 over tv-panel over any photo (the kiosk is a 7:1 mode)', { kind: 'text' }, contrast(solid('tv-text-2'), bgc), 7, `${label}/${pn}`);
            }
          }
        }

        // E. the person's accent through the scope mechanism
        const A = n => solid(`accent-${n}`);
        record('scope:data-accent resolves every --accent-* role to its own family', { kind: 'structure' }, ROLES.every(n => hex(A(n)) === hex(solid(`${accent}-${n}`))) ? 1 : 0, 1, label);
        pair('accent:sel-ink/sel-fill', solid('sel-ink'), solid('sel-fill'), T, 'text');
        pair('accent:sel-ink-strong/sel-fill-strong', solid('sel-ink-strong'), solid('sel-fill-strong'), T, 'text');
        pair('accent:accent-on/accent-strong (primary button)', A('on'), A('strong'), T, 'text');
        for (const bg of OPAQUE) {
          pair(`accent:accent-ink/${bg}`, A('ink'), solid(bg), T, 'text');
          pair(`accent:focus-ring-color/${bg}`, solid('focus-ring-color'), solid(bg), 3, 'non-text');
          pair(`accent:today-ring/${bg}`, solid('today-ring'), solid(bg), 3, 'non-text');
          pair(`accent:sel-fill-strong/${bg}`, solid('sel-fill-strong'), solid(bg), 3, 'non-text');
          pair(`large:accent-graphic numerals/${bg}`, A('graphic'), solid(bg), 3, 'large-text');
          pair(`large:timer-done numerals/${bg}`, solid('timer-done'), solid(bg), 3, 'large-text');
          for (const n of ['accent', 'tint', 'accent-strong', 'accent-deep', 'tint-ink']) pair(`legacy:--${n} as text/${bg}`, solid(n), solid(bg), T, 'legacy');
        }
        pair('legacy:--on-accent/--accent (a solid in the person colour)', solid('on-accent'), solid('accent'), T, 'legacy');
        for (const fg of ['text', 'text-2', 'text-3']) pair(`accent:${fg}/accent-wash (page wash)`, solid(fg), over(A('wash'), solid('bg')), T, 'text');
        pair('accent:accent-ink/accent-wash (hero top stop)', A('ink'), A('wash'), T, 'text');
        pair('accent:accent-ink/accent-fill (hero bottom stop)', A('ink'), A('fill'), T, 'text');
        pair('accent:progress-fill/progress-track', solid('progress-fill'), solid('progress-track'), 3, 'non-text');
        pair('accent:progress-fill/surface', solid('progress-fill'), solid('surface'), 3, 'non-text');
        pair('accent:hero-btn-ink/hero-btn-bg', solid('hero-btn-ink'), solid('hero-btn-bg'), T, 'text');
        pair('accent:tile glyph accent-ink/accent-fill-strong', A('ink'), A('fill-strong'), 3, 'graphic');
        for (const [bn, b] of Object.entries({ bg: solid('bg'), surface: solid('surface'), mid: P('#767676') })) {
          const gs = over(col('glass-strong'), b);
          pair(`accent:accent-ink (the selected tab: icon and label)/glass-strong over ${bn}`, A('ink'), gs, T, 'text');
          pair(`accent:accent-graphic (an identity mark in a bar, e.g. the avatar ring)/glass-strong over ${bn}`, A('graphic'), gs, 3, 'graphic');
          pair(`accent:sel-ink/sel-fill in the bar over ${bn}`, solid('sel-ink'), over(col('sel-fill'), gs), T, 'text');
          // the desktop sidebar's tabs sit in the top 34 % of a full-height bar, under the white sheen (not the pickup: the sidebar
          // carries none, glass7-component.css). Gated under the FULL sheen, an upper bound for any row of tabs.
          const gsh = over(col('glass-spec'), gs);
          pair(`accent:accent-ink (the selected tab: icon and label, currentColor) under the full sheen/glass-strong over ${bn}`, A('ink'), gsh, T, 'text');
          pair(`accent:text-3 (an unselected tab's label and icon) under the full sheen/glass-strong over ${bn}`, solid('text-3'), gsh, T, 'text');
        }
        if (withExtras && mode === 'adult') {
          (extras.accentMatrix[theme] ??= {})[accent] = {
            'ink/surface': fl(contrast(A('ink'), solid('surface'))), 'ink/bg': fl(contrast(A('ink'), solid('bg'))),
            'ink/fill': fl(contrast(A('ink'), A('fill'))), 'on/strong': fl(contrast(A('on'), A('strong'))),
            'strong/bg': fl(contrast(A('strong'), solid('bg'))), 'graphic/surface': fl(contrast(A('graphic'), solid('surface'))),
            'graphic/bg': fl(contrast(A('graphic'), solid('bg'))), 'hero btn': fl(contrast(solid('hero-btn-ink'), solid('hero-btn-bg'))),
            'tab label on glass/mid': fl(contrast(A('ink'), over(col('glass-strong'), P('#767676')))),
          };
          if (accent === 'graphite') {
            const nt = {}; for (const n of ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'text', 'text-2', 'text-3', 'text-2-hi', 'field-border', 'track']) nt[n] = hex(solid(n));
            nt['text/bg'] = fl(contrast(solid('text'), solid('bg')));
            nt['text-2/surface'] = fl(contrast(solid('text-2'), solid('surface')));
            nt['text-2 min opaque'] = fl(Math.min(...OPAQUE.map(b => contrast(solid('text-2'), solid(b)))));
            nt['text-3 min opaque'] = fl(Math.min(...OPAQUE.map(b => contrast(solid('text-3'), solid(b)))));
            nt['text-2 on glass over worst'] = fl(contrast(solid('text-2'), over(col('glass'), backs.worst)));
            nt['surface/bg'] = fl(contrast(solid('surface'), solid('bg')));
            nt['field-border min'] = fl(Math.min(...OPAQUE.map(b => contrast(solid('field-border'), solid(b)))));
            nt['glass alpha'] = raw('glass-alpha'); nt['glass-strong alpha'] = raw('glass-alpha-strong');
            extras.neutralTable[theme] = nt;
          }
        }
        // engine samples for browser-check.mjs (opaque colour tokens as this context resolves them)
        if (withExtras && ['adult', 'contrast-more', 'reduce-transparency', 'kiosk'].includes(mode)) {
          const toks = {};
          for (const n of ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'text', 'text-2', 'text-3', 'placeholder', 'field-border', 'status-offline',
            'accent-fill', 'accent-strong', 'accent-graphic', 'accent-ink', 'accent-on', 'sel-fill', 'sel-ink', 'focus-ring-color', 'today-ring', 'hero-btn-bg', 'hero-btn-ink',
            'accent', 'tint', 'gold', 'olive', 'muted', 'danger', 'badge-bg', 'star-stroke', 'toast-ink', 'switch-on', 'glass', 'glass-strong', 'glass-look']) {
            const c = col(n); toks['--' + n] = hex(c) + (c.a < 0.999 ? Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
          }
          extras.samples.push({ attrs: { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': accent, 'data-kind': extra.kind || 'adult', ...(extra.contrast ? { 'data-contrast': extra.contrast } : {}), ...(extra.transparency ? { 'data-transparency': extra.transparency } : {}) }, toks });
        }
      }
    }
  }

  // H. CVD separation of the person graphics (gated) and fills (reported), per palette
  for (const theme of Object.keys(THEMES)) {
    const get = E.computed([rootEl(theme)]);
    const c = n => evalColour(get('--' + n));
    const t = extras.cvd[theme] = { graphic: {}, fill: {} };
    for (const role of ['graphic', 'fill']) for (const vis of ['normal', 'protan', 'deutan', 'tritan']) {
      let min = Infinity, pr = '', under = 0; const set = role === 'graphic' ? PEOPLE : HUES;
      for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
        const d = de2000(simulate(c(`${set[i]}-${role}`), vis), simulate(c(`${set[j]}-${role}`), vis));
        if (d < min) { min = d; pr = `${set[i]}/${set[j]}`; }
        if (d < 10) under++;
        if (role === 'graphic' && vis !== 'tritan') record(`cvd:person graphic ${vis} (${THEMES[theme]})`, { kind: 'cvd' }, d, 10, `${theme}/${set[i]}/${set[j]}`);
      }
      t[role][vis] = { min: fl(min), closest: pr, pairsUnder10: under, gated: role === 'graphic' && vis !== 'tritan' };
    }
  }

  // H2 (Phase 5, D5). The app families: each app's colour is its own, and none is a person's. Tiles stand side by side on the Apps
  // grid, so app vs app on the tile end (-fill-strong) and the mark (-graphic) is gated at the people's own spacing; app vs person is
  // gated at a clearly visible step (CIEDE2000 >= 4 on the tile end, >= 5 on the mark). Colour-vision simulations are REPORTED: a
  // tile is identified by its glyph and name, never by colour alone (the people keep their gated CVD separation above).
  extras.appHues = {};
  for (const theme of Object.keys(THEMES)) {
    const get = E.computed([rootEl(theme)]);
    const c = n => evalColour(get('--' + n));
    const t = extras.appHues[theme] = {};
    for (const [role, aa, ap] of [['fill-strong', 8, 4], ['graphic', 10, 5], ['fill', null, null]]) for (const vis of ['normal', 'protan', 'deutan']) {
      let mAA = [Infinity, ''], mAP = [Infinity, ''];
      for (let i = 0; i < APPS.length; i++) {
        for (let j = i + 1; j < APPS.length; j++) { const d = de2000(simulate(c(`${APPS[i]}-${role}`), vis), simulate(c(`${APPS[j]}-${role}`), vis)); if (d < mAA[0]) mAA = [d, `${APPS[i]}/${APPS[j]}`];
          if (vis === 'normal' && aa) record(`apphue:app vs app ${role} dE00 (${THEMES[theme]})`, { kind: 'cvd' }, d, aa, `${theme}/${APPS[i]}/${APPS[j]}`); }
        for (const p of PEOPLE) { const d = de2000(simulate(c(`${APPS[i]}-${role}`), vis), simulate(c(`${p}-${role}`), vis)); if (d < mAP[0]) mAP = [d, `${APPS[i]}/${p}`];
          if (vis === 'normal' && ap) record(`apphue:app vs person ${role} dE00, never a person's colour (${THEMES[theme]})`, { kind: 'cvd' }, d, ap, `${theme}/${APPS[i]}/${p}`); }
      }
      t[`${role} ${vis}`] = { appVsApp: fl(mAA[0], 1), closestApps: mAA[1], appVsPerson: fl(mAP[0], 1), closestPerson: mAP[1], gated: vis === 'normal' && !!aa };
    }
    // revision 6b (verify-rev6 issue 2): an app tile must never read as a status chip. Per role, no app sits closer to success, warning
    // or danger than the closest PERSON already does (the people's own minimum in this palette, rounded down); on the mark (-graphic)
    // the people's gate itself, >= 10.
    for (const role of ['wash', 'fill', 'fill-strong', 'graphic', 'strong', 'on', 'ink', 'ink-hi']) {   // revision 6c: every role (verify-rev6 round 2, issue 1)
      let pMin = Infinity; for (const s of SEMANTIC) for (const p of PEOPLE) pMin = Math.min(pMin, de2000(c(`${s}-${role}`), c(`${p}-${role}`)));
      const floor = role === 'graphic' ? 10 : Math.floor(pMin * 10) / 10;
      if (floor < 0.05) { t[`${role} vs status colours`] = { note: 'identical for every family, people and status alike (light -on is white)' }; continue; }
      let m = [Infinity, ''];
      for (const s of SEMANTIC) for (const a of APPS) { const d = de2000(c(`${s}-${role}`), c(`${a}-${role}`)); if (d < m[0]) m = [d, `${a}/${s}`];
        record(`apphue:an app ${role} is no closer to a status colour than the closest person (${THEMES[theme]})`, { kind: 'cvd' }, d, floor, `${theme}/${a}/${s}`); }
      t[`${role} vs status colours`] = { appMin: fl(m[0], 1), closest: m[1], floor, peopleMin: fl(pMin, 1) };
      // reported (verify-rev6 round 3, issue 2): the same rule taken status by status is weaker for some pairs (coral vs danger)
      for (const s of SEMANTIC) { let pm = Infinity, am = [Infinity, '']; for (const p of PEOPLE) pm = Math.min(pm, de2000(c(`${s}-${role}`), c(`${p}-${role}`)));
        for (const a of APPS) { const d = de2000(c(`${s}-${role}`), c(`${a}-${role}`)); if (d < am[0]) am = [d, a]; }
        t[`${role} vs ${s} (reported)`] = { appMin: fl(am[0], 1), app: am[1], peopleMin: fl(pm, 1) }; }
    }
    // revision 6d (verify-rev6 round 3, issue 1): app vs person in EVERY role, at half the people's own closest spacing in that role
    // (never under the tile end's 4 or the mark's 5). Round 3 found Kid Verse's dark honey fill, glyph and label on Mae's peach.
    for (const role of ROLES) {
      let pp = Infinity; for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) pp = Math.min(pp, de2000(c(`${PEOPLE[i]}-${role}`), c(`${PEOPLE[j]}-${role}`)));
      const floor = Math.max(Math.floor(pp / 2 * 10) / 10, role === 'fill-strong' ? 4 : role === 'graphic' ? 5 : 0);
      if (floor < 0.05) continue;
      let m = [Infinity, ''];
      for (const a of APPS) for (const p of PEOPLE) { const d = de2000(c(`${a}-${role}`), c(`${p}-${role}`)); if (d < m[0]) m = [d, `${a}/${p}`];
        record(`apphue:app vs person in every role, at half the people's own spacing: ${role} (${THEMES[theme]})`, { kind: 'cvd' }, d, floor, `${theme}/${a}/${p}`); }
      t[`${role} vs person (every role)`] = { appMin: fl(m[0], 1), closest: m[1], floor, peopleSpacing: fl(pp, 1) };
    }
  }
  {
    const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => a.id);
    const hues = apps.map(id => APP_OF[id]);
    record('apphue:every apps.json app has its own app family (APP_OF, batch 2 writes it as "hue"), nine different, none a person family', { kind: 'structure' },
      hues.every(h => APPS.includes(h)) && new Set(hues).size === hues.length && !hues.some(h => PEOPLE.includes(h)) ? 1 : 0, 1, apps.map((id, i) => `${id}→${hues[i]}`).join(', '));
  }

  // B2 (Phase 5, D8; revision 6b). The glass level. Clear and Current are see-through, and their text carries an OUTLINE halo
  // (--glass-text-shadow: eight 1 px offsets at 0 blur in --glass-halo-edge, the card colour at 100 %, then a soft glow). A blurred
  // glow gated as one flat layer overstated what engines paint (the independent verifier, verify-rev6), so the halo is proved AS
  // RENDERED by audits/tools/phase5/halo-check.mjs (both engines; the ring 0.5-1.5 CSS px round the glyphs; medians gated at text 7,
  // text-2 4.5, text-3 4.5). This gate: (1) the see-through levels carry the solid outline and Frosted none; (2) halo-check.json
  // exists, was made from THIS token file (sha-256) and passed; (3) REPORTED: every glass text pair WITHOUT the halo.
  extras.glassLevels = {};
  for (const level of ['current', 'clear']) for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of ACCENTS) for (const kind of ['adult', 'kid']) {
    const get = E.computed([rootEl(theme, { accent, kind, glass: level, transparency: 'full' })]);
    const col = n => evalColour(get('--' + n)); const solid = n => { const c = col(n); if (c.a < 0.999) throw new Error(`glass level ${level}: --${n} not opaque`); return c; };
    const edge = col('glass-halo-edge');
    record('structure:the see-through glass levels paint a SOLID outline halo in the card colour (--glass-halo-edge = --surface at 100 %)', { kind: 'structure' }, edge.a >= 0.999 && hex(edge) === hex(solid('surface')) && (RULES.find(r => '--glass-text-outline' in r.decls)?.decls['--glass-text-outline'].split('var(--glass-halo-edge)').length - 1) === 8 && (RULES.find(r => '--glass-icon-outline' in r.decls)?.decls['--glass-icon-outline'].split('var(--glass-halo-edge)').length - 1) === 4 && /--glass-halo-edge/.test(get.declared['--glass-text-shadow'] ?? '') === false && get('--glass-text-shadow') !== 'none' && get('--glass-icon-filter') !== 'none' ? 1 : 0, 1, `${level}/${theme}/${accent}/${kind}`);
    const vs = get('--glass-pickup-layer'); const i0 = vs.indexOf('color-mix('); let d = 0, k = i0; for (; k < vs.length; k++) { if (vs[k] === '(') d++; else if (vs[k] === ')' && --d === 0) break; }
    const pick = evalColour(vs.slice(i0, k + 1));
    const backs = { bg: solid('bg'), surface: solid('surface'), mid: P('#767676'), worst: P(scheme === 'light' ? '#000000' : '#FFFFFF') };
    const L = extras.glassLevels[`${level}/${theme}`] ??= { alpha: get('--glass-alpha'), alphaStrong: get('--glass-alpha-strong'), glow: get('--glass-halo-alpha'), outline: get('--glass-halo-edge-alpha') };
    if (withExtras && kind === 'adult' && ['sky', 'coral', 'graphite'].includes(accent)) {
      const toks = {}; for (const n of ['glass', 'glass-strong', 'glass-halo', 'glass-halo-edge', 'accent-ink', 'text', 'text-2']) { const c = col(n); toks['--' + n] = hex(c) + (c.a < 0.999 ? Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase() : ''); }
      extras.samples.push({ attrs: { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': accent, 'data-kind': 'adult', 'data-glass': level, 'data-transparency': 'full' }, toks });
    }
    for (const [bn, b] of Object.entries(backs)) for (const g of ['glass', 'glass-strong']) {
      const gr = over(col('glass-spec'), over(pick, over(col(g), b)));
      for (const fg of ['text', 'text-2', 'text-3']) { const key = `${fg} without the halo, ${g} over ${bn} (sheen + pickup)`; const v = fl(contrast(solid(fg), gr)); if (!(key in L) || v < L[key]) L[key] = v; }
    }
  }
  {
    const hc = path.join(ROOT, 'audits', 'evidence', 'p5', 'halo-check.json');
    const r = fs.existsSync(hc) ? JSON.parse(fs.readFileSync(hc, 'utf8')) : null;
    const sha = crypto.createHash('sha256').update(src).digest('hex');
    record('glasslevel:the rendered halo check (audits/tools/phase5/halo-check.mjs) passed on THIS token file, in both engines', { kind: 'text' }, r && r.ok && r.tokensSha256 === sha && Object.keys(r.engines || {}).length === 2 ? 1 : 0, 1, r ? `ok=${r.ok} sha match=${r.tokensSha256 === sha}` : 'missing', { rerun: 'node audits/tools/phase5/halo-check.mjs' });
    if (r) extras.haloRendered = r.summary;
  }
  for (const theme of Object.keys(THEMES)) {
    const plain = E.computed([rootEl(theme, { accent: 'sky' })]);
    const frosted = E.computed([rootEl(theme, { accent: 'sky', glass: 'frosted', transparency: 'full' })]);
    record('structure:the default glass level is Frosted (no attribute = data-glass="frosted"), with no halo', { kind: 'structure' }, plain('--glass-alpha') === frosted('--glass-alpha') && plain('--glass-alpha-strong') === frosted('--glass-alpha-strong') && plain('--glass-halo-alpha') === '0%' && plain('--glass-halo-edge-alpha') === '0%' && plain('--glass-text-shadow') === 'none' && plain('--glass-icon-filter') === 'none' ? 1 : 0, 1, theme);
    for (const level of ['current', 'clear']) {
      const more = E.computed([rootEl(theme, { accent: 'sky', glass: level, contrast: 'more' })]);
      record('structure:Increase Contrast beats a see-through glass level (96 % / 98 %)', { kind: 'structure' }, more('--glass-alpha') === '96%' && more('--glass-alpha-strong') === '98%' ? 1 : 0, 1, `${theme}/${level}`);
      const rt = E.computed([rootEl(theme, { accent: 'sky', glass: level, transparency: 'reduce' })]);
      record('structure:Solid (Reduce Transparency) beats a see-through glass level', { kind: 'structure' }, hex(evalColour(rt('--glass'))) === hex(evalColour(rt('--glass-solid'))) && evalColour(rt('--glass')).a >= 0.999 ? 1 : 0, 1, `${theme}/${level}`);
    }
  }
  // round-5 item 12: no live blur left under Reduce Transparency (attribute and media) and on the kiosk: --blur* are 0 too
  for (const [name, x, env] of [['reduce-transparency', { transparency: 'reduce' }, {}], ['reduce-transparency (media)', {}, { prefersReducedTransparency: 'reduce' }], ['kiosk', { kind: 'kiosk' }, {}]]) {
    const g = E.computed([rootEl('hearth', { accent: 'sky', ...x })], env);
    record('structure:no live blur under Reduce Transparency or on the kiosk (--glass-filter none, --blur / --blur-sm / --blur-lg 0)', { kind: 'structure' }, g('--glass-filter') === 'none' && ['blur', 'blur-sm', 'blur-lg'].every(b => num(g('--' + b)) === 0) ? 1 : 0, 1, name);
  }
  // round-5 item 17: the TV crossfade is 150 ms under Reduce Motion from the tokens themselves (attribute and media), kiosk included
  for (const [name, x, env] of [['reduce-motion', { motion: 'reduce', kind: 'kiosk' }, {}], ['reduce-motion (media)', { kind: 'kiosk' }, { prefersReducedMotion: 'reduce' }]]) {
    const g = E.computed([rootEl('midnight', { accent: 'graphite', ...x })], env);
    record('motion:Reduce Motion sets the TV crossfade to 150 ms in the tokens (not only through the kept kill)', { kind: 'motion' }, num(g('--dur-crossfade')) === 150 ? 1 : 0, 1, name);
  }
  // round-6 item 19 (D15): in dark the hero's Switch capsule is the glowing pastel solid, so it has an edge of its own against both
  // hero stops (>= 3, a UI component boundary); in light the white capsule is reported
  extras.heroEdge = {};
  for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of ACCENTS) {
    const g = E.computed([rootEl(theme, { accent })]); const c = n => evalColour(g('--' + n));
    const e = Math.min(contrast(c('hero-btn-bg'), c('accent-wash')), contrast(c('hero-btn-bg'), c('accent-fill')));
    if (scheme === 'dark') record('accent:the dark hero capsule has its own edge against both hero stops (D15; round-6 item 19)', { kind: 'non-text' }, e, 3, `${theme}/${accent}`);
    extras.heroEdge[scheme] = Math.min(extras.heroEdge[scheme] ?? Infinity, fl(e));
  }

  // I. type floors, glance roles, fields; J. targets; K. grid and concentric radii; motion
  const typeRoles = ['large-title', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subheadline', 'footnote', 'caption1', 'caption2', 'numeral-s', 'glance-3', 'glance-2', 'glance-1'];
  for (const kind of ['adult', 'kid', 'kiosk']) for (const [width, pointer] of [[390, 'coarse'], [820, 'coarse'], [1024, 'fine'], [1440, 'fine'], [1920, 'fine']]) for (const size of ['xs', 's', 'm', 'l', 'xl', 'xxl']) {
    const get = E.computed([rootEl('hearth', { kind, ...(size === 'm' ? {} : { 'text-size': size }) })], { width, pointer });
    const need = { adult: 11, kid: 16, kiosk: 18 }[kind];   // the kiosk keeps today's TV sizes at every width; the 10-foot scale is opt-in (below)
    const ctx = `${kind}/${width}${pointer === 'fine' ? '-desktop' : ''}/${size}`;
    record(`type:--fs-floor (${kind})`, { kind: 'type' }, num(get('--fs-floor')), need, ctx);
    for (const r of typeRoles) {
      const px = num(get(`--fs-${r}`));
      record(`type:--fs-${r} >= floor (${kind})`, { kind: 'type' }, px, need, ctx);
      if (size === 'm') (extras.typeTable[kind] ??= {})[`${r}@${width}`] = +px.toFixed(1);
    }
    record('type:--fs-field >= 16 (no iOS focus zoom)', { kind: 'type' }, num(get('--fs-field')), 16, ctx);
    if (kind === 'kiosk' && size === 'm') {
      // the TV board reads the legacy sizes and spacing (index.html:103-176) inside a grid that fits 1080 px only at today's
      // values (apps/design.css:287; measured in verify-constraints-1.json and rev2-runtime.json). So at EVERY width the kiosk keeps
      // them EXACTLY (both bounds), keeps today's spacing and the normal margin, unless the opt-in 10-foot scale is on.
      const TODAY = { 'fs-sm': 18, 'fs-md': 22, 'fs-lg': 26, 'fs-xl': 32, 'fs-2xl': 40, 'fs-3xl': 56, 'fs-4xl': 84, 'sp-2': 8, 'sp-4': 16, 'sp-6': 24 };
      const tier = extras.kioskTiers[width] = { margin: num(get('--margin')) };
      for (const [k, t] of Object.entries(TODAY)) {
        const v = num(get('--' + k)); tier[k] = { now: +v.toFixed(1), today: t };
        record("type:the kiosk keeps today's TV sizes and spacing at every width (legacy --fs-* and --sp-*, exactly)", { kind: 'type' }, Math.abs(v - t) < 0.01 ? 1 : 0, 1, `${ctx} --${k} ${v.toFixed(1)} vs today ${t}`);
      }
      record("type:the kiosk keeps today's TV sizes and spacing at every width (legacy --fs-* and --sp-*, exactly)", { kind: 'type' }, get('--fs-hero') === 'clamp(56px, 8vw, 96px)' ? 1 : 0, 1, `${ctx} --fs-hero ${get('--fs-hero')}`);
      record('type:without the opt-in the TV margin stays the normal margin (<= 32)', { kind: 'type' }, tier.margin <= 32 ? 1 : 0, 1, `${ctx} margin ${tier.margin}`);
      // the opt-in 10-foot scale (data-tv-scale="10ft"): active only at 1600 px+; below that it changes nothing
      const g10 = E.computed([rootEl('hearth', { kind, 'tv-scale': '10ft' })], { width, pointer });
      const t10 = extras.kioskTiers[width + ' opt-in 10ft'] = { margin: num(g10('--margin')), 'fs-floor': num(g10('--fs-floor')), 'fs-body': +num(g10('--fs-body')).toFixed(1), 'fs-md': +num(g10('--fs-md')).toFixed(1), 'fs-4xl': +num(g10('--fs-4xl')).toFixed(1), 'sp-4': num(g10('--sp-4')) };
      if (width >= 1600) {
        record('type:opt-in 10ft at 1600 px+: floor 28, body >= 32, margin 96', { kind: 'type' }, t10['fs-floor'] === 28 && t10['fs-body'] >= 32 && t10.margin === 96 ? 1 : 0, 1, JSON.stringify(t10));
        for (const r of typeRoles) record('type:opt-in 10ft at 1600 px+: every role >= 28', { kind: 'type' }, num(g10(`--fs-${r}`)), 28, `${ctx} --fs-${r}`);
        for (const k of ['fs-xs', 'fs-sm', 'fs-md', 'fs-lg', 'fs-xl', 'fs-2xl', 'fs-3xl', 'fs-4xl']) record('type:opt-in 10ft: no legacy size shrinks below today', { kind: 'type' }, num(g10('--' + k)) >= (TODAY[k] ?? 12) - 1e-9 ? 1 : 0, 1, `${ctx} --${k} ${num(g10('--' + k)).toFixed(1)}`);
      } else {
        const same = ['fs-md', 'fs-2xl', 'sp-4', 'margin', 'fs-floor'].every(k => g10('--' + k) === get('--' + k));
        record('type:opt-in 10ft is inert under 1600 px', { kind: 'type' }, same ? 1 : 0, 1, ctx);
      }
    }
    if (kind === 'adult' && pointer === 'fine' && size === 'm') record('type:a desktop window keeps the phone scale (no iPad tier)', { kind: 'type' }, num(get('--fs-body')) === 17 ? 1 : 0, 1, ctx);
    if (kind === 'adult' && width === 820 && size === 'm') record('type:iPad tier lifts body to >= 19 px', { kind: 'type' }, num(get('--fs-body')), 19, ctx);
    const needT = { adult: [44, 60, 52], kid: [64, 84, 72], kiosk: [64, 88, 72] }[kind];
    record(`target:--tap (${kind})`, { kind: 'target' }, num(get('--tap')), needT[0], ctx);
    record(`target:--tap-lg (${kind})`, { kind: 'target' }, num(get('--tap-lg')), needT[1], ctx);
    record(`target:--tap-row (${kind})`, { kind: 'target' }, num(get('--tap-row')), needT[2], ctx);
    if (size === 'xxl' && kind === 'adult') record('target:--tap grows with the text size (xxl >= 66)', { kind: 'target' }, num(get('--tap')), 66, ctx);
  }
  for (const kind of ['adult', 'kid', 'kiosk']) {
    const get = E.computed([rootEl('hearth', { kind })]);
    const rc = num(get('--r-control')), rcard = num(get('--r-card')), pad = num(get('--pad-card')), rs = num(get('--r-sheet')), ps = num(get('--pad-sheet'));
    record(`shape:concentric card = control + card padding (${kind})`, { kind: 'shape' }, Math.abs(rcard - pad - rc) < 1e-6 ? 1 : 0, 1, `${kind}: ${rcard} = ${rc} + ${pad}`);
    record(`shape:concentric sheet = control + sheet padding (${kind})`, { kind: 'shape' }, Math.abs(rs - ps - rc) < 1e-6 ? 1 : 0, 1, `${kind}: ${rs} = ${rc} + ${ps}`);
    record(`shape:--r-inset returns the control radius (${kind})`, { kind: 'shape' }, Math.abs(num(get('--r-inset')) - rc) < 1e-6 ? 1 : 0, 1, kind);
    for (const k of ['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5', 'sp-6', 'sp-8', 'sp-10', 'sp-12', 'sp-16']) {
      const base = +get.declared['--' + k]?.match(/calc\((\d+)px/)?.[1];
      if (kind === 'adult') record(`grid:--${k} on the 4-pt grid`, { kind: 'grid' }, base % 4 === 0 ? 1 : 0, 1, kind);
    }
    if (kind === 'kid') record('shape:legacy kid radius --r-lg stays 28 px', { kind: 'shape' }, num(get('--r-lg')) === 28 ? 1 : 0, 1, kind);
    if (kind === 'kiosk') record('shape:the kiosk scales the legacy radii the TV board reads (--r-lg 22 x 1.5 = 33 px)', { kind: 'shape' }, num(get('--r-lg')) === 33 ? 1 : 0, 1, kind);
  }
  {
    const get = E.computed([rootEl('hearth')]);
    for (const [k, lo, hi] of [['dur-snappy', 200, 350], ['dur-gentle', 200, 350], ['dur-bouncy', 200, 350], ['dur-fast', 200, 350], ['dur-base', 200, 350], ['dur-slow', 200, 350], ['dur-exit', 200, 350], ['dur-progress', 200, 350], ['dur-1', 200, 350], ['dur-2', 200, 350], ['dur-3', 200, 350]])
      record(`motion:--${k} (a UI transition token) within 200-350 ms`, { kind: 'motion' }, num(get('--' + k)) >= lo && num(get('--' + k)) <= hi ? 1 : 0, 1, get('--' + k));
    // the one ambient transition outside the range, an owner-approved exception (D18): the TV album crossfade, kiosk only
    record('motion:--dur-crossfade is the one ambient transition outside 200-350 ms: 2500 ms, the TV album crossfade (D18)', { kind: 'motion' }, num(get('--dur-crossfade')) === 2500 && num(E.computed([rootEl('midnight', { kind: 'kiosk' })])('--dur-crossfade')) === 2500 ? 1 : 0, 1, get('--dur-crossfade'));
    record('motion:--press-scale is 0.97', { kind: 'motion' }, Math.abs(num(get('--press-scale')) - 0.97) < 1e-9 ? 1 : 0, 1, get('--press-scale'));
    for (const s of ['spring-snappy', 'spring-gentle', 'spring-bouncy']) {
      const pts = get('--' + s).match(/linear\(([^)]*)\)/)[1].split(',').map(Number);
      const over = Math.max(...pts) - 1;
      record(`motion:--${s} ends at 1 and overshoots <= ${s === 'spring-bouncy' ? '10' : '2'} %`, { kind: 'motion' }, pts[pts.length - 1] === 1 && over <= (s === 'spring-bouncy' ? 0.1 : 0.02) ? 1 : 0, 1, `overshoot ${(over * 100).toFixed(1)} %`);
    }
    const r = E.computed([rootEl('hearth', { motion: 'reduce' })]);
    record('motion:reduce motion removes travel, scale and the pulse', { kind: 'motion' }, r('--press-scale') === '1' && r('--enter-distance') === '0px' && r('--spring-gentle') === 'linear' && r('--ambient-iterations') === '0' && r('--pulse-scale') === '1' ? 1 : 0, 1, 'reduce');
    record('motion:--dur-press is 0 (the press-in is an instant :active state; the release uses --dur-snappy)', { kind: 'motion' }, num(get('--dur-press')) === 0 ? 1 : 0, 1, get('--dur-press'));
  }

  // L. structure: mirrors, opt-outs, stale scheme, theme aliases, previews, nested scopes
  const COLOUR_TOKENS = ['bg', 'surface', 'surface-2', 'text', 'text-2', 'text-3', 'field-border', 'glass', 'glass-strong', 'accent-fill', 'accent-strong', 'accent-graphic', 'accent-ink', 'accent-on', 'sel-fill', 'focus-ring-color', 'hero-btn-bg', 'tint', 'gold', 'muted', 'star-stroke', 'switch-on', 'toast-bg', 'art-plate', 'chevron-colour', ...FAMILIES.flatMap(f => ROLES.map(r => `${f}-${r}`))];
  const snapshot = (get, list = COLOUR_TOKENS) => Object.fromEntries(list.map(n => { const v = get('--' + n); return [n, v === undefined ? 'UNDEFINED' : (() => { try { const c = evalColour(v); return hex(c) + (c.a < 0.999 ? '/' + c.a.toFixed(3) : ''); } catch { return v; } })()]; }));
  const same = (a, b) => { const d = Object.keys(a).filter(k => a[k] !== b[k]); return { ok: d.length === 0, diff: d.slice(0, 6) }; };
  const ALL_PROPS = [...new Set(RULES.flatMap(r => Object.keys(r.decls)))].filter(n => n.startsWith('--')).map(n => n.slice(2));
  const fullSnap = get => Object.fromEntries(ALL_PROPS.map(n => [n, get('--' + n) ?? 'UNDEFINED']));
  for (const [q, attr, val, envKey, optOut] of [['prefers-contrast: more', 'contrast', 'more', 'prefersContrast', 'standard'], ['prefers-reduced-transparency: reduce', 'transparency', 'reduce', 'prefersReducedTransparency', 'full'], ['prefers-reduced-motion: reduce', 'motion', 'reduce', 'prefersReducedMotion', 'full']]) {
    for (const theme of Object.keys(THEMES)) for (const kind of ['adult', 'kiosk']) {
      const viaAttr = fullSnap(E.computed([rootEl(theme, { accent: 'mint', kind, [attr]: val })]));
      const viaMedia = fullSnap(E.computed([rootEl(theme, { accent: 'mint', kind })], { [envKey]: val }));
      const plain = fullSnap(E.computed([rootEl(theme, { accent: 'mint', kind })]));
      const optedOut = fullSnap(E.computed([rootEl(theme, { accent: 'mint', kind, [attr]: optOut })], { [envKey]: val }));
      const s1 = same(viaAttr, viaMedia), s2 = same(plain, optedOut);
      record(`mirror:@media (${q}) resolves exactly like data-${attr}="${val}"`, { kind: 'structure' }, s1.ok ? 1 : 0, 1, `${theme}/${kind}`, { diff: s1.diff });
      record(`mirror:data-${attr}="${optOut}" opts out of the OS setting`, { kind: 'structure' }, s2.ok ? 1 : 0, 1, `${theme}/${kind}`, { diff: s2.diff });
    }
  }
  for (const [theme, scheme] of Object.entries(THEMES)) {
    const good = snapshot(E.computed([rootEl(theme, { accent: 'sky' })]));
    const stale = snapshot(E.computed([rootEl(theme, { accent: 'sky', scheme: scheme === 'light' ? 'dark' : 'light' })]));
    const s = same(good, stale);
    record('structure:a stale data-scheme cannot repaint the theme (the theme wins)', { kind: 'structure' }, s.ok ? 1 : 0, 1, theme, { diff: s.diff });
  }
  for (const [alias, real] of [['light', 'hearth'], ['dark', 'midnight']]) {
    const s = same(snapshot(E.computed([rootEl(real, { accent: 'peach' })])), snapshot(E.computed([{ isRoot: true, attrs: { theme: alias, scheme: THEMES[real], kind: 'adult', accent: 'peach' } }])));
    record(`structure:data-theme="${alias}" is an alias of ${real}`, { kind: 'structure' }, s.ok ? 1 : 0, 1, alias, { diff: s.diff });
  }
  // a theme card: <span data-theme-preview=T data-scheme=S data-accent=A> inside a page of another theme resolves like the real thing
  for (const outer of ['hearth', 'midnight']) for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of ['bubblegum', 'aqua']) {
    const real = snapshot(E.computed([rootEl(theme, { accent })]));
    const card = snapshot(E.computed([rootEl(outer, { accent: 'graphite' }), { isRoot: false, attrs: { 'theme-preview': theme, scheme, accent } }]));
    const s = same(real, card);
    record('structure:a theme preview ([data-theme-preview]) inside another theme resolves like the real palette', { kind: 'structure' }, s.ok ? 1 : 0, 1, `${theme}/${accent} inside ${outer}`, { diff: s.diff });
  }
  // the System card: a night half nested in a day swatch. The --accent-* roles are declared only on :root and [data-accent], so a
  // half WITHOUT data-accent inherits the swatch's light-scheme accent (round 3: #FFC8DD fill on Midnight's #211F1D). The rule:
  // every element carrying data-scheme or data-theme-preview also carries data-accent. Gated with the attribute; the counterexample
  // without it is kept in the output (nestedPreviewWithoutAccent), and a static check holds the shipped markup to the rule.
  extras.nestedPreviewWithoutAccent = [];
  for (const outer of ['frost', 'midnight']) for (const accent of ['bubblegum', 'aqua', 'graphite']) {
    const real = snapshot(E.computed([rootEl('midnight', { accent })]));
    const card = { isRoot: false, attrs: { 'theme-preview': 'hearth', scheme: 'light', accent } };
    const withA = same(real, snapshot(E.computed([rootEl(outer, { accent: 'periwinkle' }), card, { isRoot: false, attrs: { 'theme-preview': 'midnight', scheme: 'dark', accent } }])));
    const without = same(real, snapshot(E.computed([rootEl(outer, { accent: 'periwinkle' }), card, { isRoot: false, attrs: { 'theme-preview': 'midnight', scheme: 'dark' } }])));
    record('structure:a nested theme preview (the System card\'s night half) carrying data-accent resolves like the real palette', { kind: 'structure' }, withA.ok ? 1 : 0, 1, `midnight/${accent} half in a hearth swatch in ${outer}`, { diff: withA.diff });
    extras.nestedPreviewWithoutAccent.push({ outer, accent, identicalWithoutDataAccent: without.ok, differs: without.diff });
  }
  {
    const files = ['index.html', 'docs/design.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => /\.html$/.test(f) && !/^dollywood/.test(f)).map(f => 'apps/' + f)];
    const tags = files.flatMap(f => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/<[a-z][^<>]*\bdata-(?:theme-preview|scheme)=[^<>]*>/gi)].map(m => ({ f, tag: m[0] })));
    const bad = tags.filter(t => !/\bdata-accent=/.test(t.tag));
    record('structure:every element that carries data-scheme or data-theme-preview in the shipped markup also carries data-accent', { kind: 'structure' }, bad.length ? 0 : 1, 1, `${tags.length} such elements in ${files.length} files today (the swatches gain them in batch 1a)`, { bad: bad.slice(0, 5) });
  }
  // a bare data-theme is DATA, never a palette scope: F260's theme buttons (apps/f260.html:2028 <button data-theme="midnight">) and
  // the Me theme cards (index.html:1259) must resolve exactly like the document around them (every token, color-scheme included)
  for (const outer of Object.keys(THEMES)) for (const inner of [...Object.keys(THEMES), 'system', 'light', 'dark']) {
    const doc = E.computed([rootEl(outer, { accent: 'periwinkle' })]);
    const btn = E.computed([rootEl(outer, { accent: 'periwinkle' }), { isRoot: false, attrs: { theme: inner } }]);
    const s = same({ ...fullSnap(doc), cs: doc('color-scheme') }, { ...fullSnap(btn), cs: btn('color-scheme') });
    record('structure:a non-preview element carrying data-theme (the F260 seg button, the Me theme card) keeps the document palette', { kind: 'structure' }, s.ok ? 1 : 0, 1, `<button data-theme=${inner}> in ${outer}`, { diff: s.diff });
  }
  // kid mode is rounded everywhere (house style); adults keep the text face for display, the serif for reading, rounded numerals
  for (const theme of ['hearth', 'midnight']) {
    const k = E.computed([rootEl(theme, { kind: 'kid', accent: 'butter' })]), a = E.computed([rootEl(theme, { accent: 'butter' })]);
    for (const f of ['font-text', 'font-ui', 'font-sans', 'font-display', 'font-serif', 'font-mono', 'font-numeral'])
      record('type:kid mode: every font token resolves to ui-rounded first', { kind: 'type' }, /^ui-rounded\b/.test(k('--' + f) || '') ? 1 : 0, 1, `${theme} --${f} = ${(k('--' + f) || '').slice(0, 30)}`);
    for (const [f, re] of [['font-display', /^system-ui\b/], ['font-sans', /^system-ui\b/], ['font-serif', /^ui-serif\b/], ['font-numeral', /^ui-rounded\b/]])
      record('type:adults: display and body in the text face, the serif for reading, rounded numerals', { kind: 'type' }, re.test(a('--' + f) || '') ? 1 : 0, 1, `${theme} --${f}`);
  }
  // GLASS-7: no token carries var(--sheen-x) (a custom property's var() is substituted where it is DECLARED, so a :root token would
  // freeze the sheen). A glass element writing --sheen-x on itself (hub.js, per frame) leaves every token unchanged, and the
  // component rule's ::before transform, resolved AT the element, follows the element's own value.
  {
    const bad = RULES.flatMap(r => Object.entries(r.decls).filter(([k, v]) => k !== '--sheen-x' && /var\(\s*--sheen-x\b/.test(v)).map(([k]) => `${r.selectors[0]} ${k}`));
    record('glass:no token declaration contains var(--sheen-x) (GLASS-7)', { kind: 'structure' }, bad.length ? 0 : 1, 1, 'file', { bad });
    for (const theme of ['hearth', 'midnight']) for (const where of ['child', 'grandchild']) {
      const root = rootEl(theme, { accent: 'mint' }), el = { isRoot: false, attrs: {}, style: { '--sheen-x': '80%' } };
      const chain = where === 'child' ? [root, el] : [root, { isRoot: false, attrs: { accent: 'sky' } }, el];
      const g = E.computed(chain), ref = E.computed(chain.slice(0, -1));
      const toks = ['glass-bg', 'glass-bg-strong', 'glass-bg-tinted', 'glass-bg-strong-tinted', 'material-chrome-bg', 'glass-pickup-layer'];
      const tokensSame = toks.every(t => g('--' + t) === ref('--' + t) && g('--' + t) !== undefined);
      const transform = subst('translateX(calc((var(--sheen-x) - 50%) / 2))', n => g(n));
      record('glass:a glass element writing --sheen-x on itself moves its own ::before and no token (GLASS-7)', { kind: 'structure' }, tokensSame && /80%/.test(transform) ? 1 : 0, 1, `${theme}/${where}: ${transform}`);
    }
  }
  // a person-coloured element inside another person's page re-derives every role (and keeps kid radii)
  for (const theme of ['hearth', 'midnight']) for (const inner of ACCENTS) for (const kind of ['adult', 'kid']) {
    const get = E.computed([rootEl(theme, { accent: 'periwinkle', kind }), { isRoot: false, attrs: { accent: inner } }]);
    const ref = E.computed([rootEl(theme, { accent: inner, kind })]);
    const list = ['accent-fill', 'accent-ink', 'accent-graphic', 'accent-strong', 'sel-fill', 'sel-ink', 'focus-ring-color', 'today-ring', 'tint', 'accent', 'accent-soft', 'accent-deep', 'hero-btn-bg', 'tile-bg', 'glass-bg'];
    const s = same(Object.fromEntries(list.map(n => [n, ref('--' + n)])), Object.fromEntries(list.map(n => [n, get('--' + n)])));
    record('structure:a nested data-accent element re-derives every role token', { kind: 'structure' }, s.ok ? 1 : 0, 1, `${inner} in ${theme}/${kind}`, { diff: s.diff });
    record('structure:a nested data-accent element keeps the kind scale (radii, type)', { kind: 'structure' }, get('--r-lg') === ref('--r-lg') && get('--fs-body') === ref('--fs-body') && get('--tap') === ref('--tap') ? 1 : 0, 1, `${inner} in ${theme}/${kind}`);
  }

  // round 4: a face carries its OWN family. hub.avatarHtml (batch 1a) writes data-accent="<hue>" on every avatar, so Mae's avatar inside
  // Eli's page (periwinkle), a kid's page and the TV's graphite kiosk root resolves Mae's fill, ink and ring (identity-component.css;
  // both engines in browser-check.json → identity). A record with no colour is graphite.
  for (const [theme, rootAccent, kind] of [['hearth', 'periwinkle', 'adult'], ['midnight', 'periwinkle', 'adult'], ['parchment', 'aqua', 'kid'], ['midnight', 'graphite', 'kiosk'], ['hearth', 'graphite', 'kiosk']]) {
    for (const [who, hue] of [['Mae', 'peach'], ['a record with no colour', 'graphite'], ['the Kid Verse tile (an app family)', 'honey']]) {
      const g = E.computed([rootEl(theme, { accent: rootAccent, kind }), { isRoot: false, attrs: { accent: hue } }]);
      const r = E.computed([rootEl(theme, { accent: rootAccent, kind })]);
      const okF = ['fill', 'ink', 'graphic'].every(x => hex(evalColour(g('--accent-' + x))) === hex(evalColour(r('--' + hue + '-' + x))));
      record("structure:an avatar carrying its person's hue (hub.avatarHtml, batch 1a) resolves that person's fill, ink and ring inside any page", { kind: 'structure' }, okF ? 1 : 0, 1, who + ' (' + hue + ') inside ' + theme + '/' + rootAccent + '/' + kind);
    }
  }
  // round 4: the 7:1 modes swap the person solids to ink-hi in LIGHT palettes only; a dark root keeps the glowing pastel solid
  for (const [theme, scheme] of Object.entries(THEMES)) for (const [mode, x, env] of [['kiosk', { kind: 'kiosk' }, {}], ['contrast-more', { contrast: 'more' }, {}], ['contrast-more (media)', {}, { prefersContrast: 'more' }]]) {
    const g = E.computed([rootEl(theme, { accent: 'lavender', ...x })], env), a = E.computed([rootEl(theme, { accent: 'lavender' })]);
    const ok = ACCENTS.every(f => scheme === 'light'
      ? g('--' + f + '-strong') !== a('--' + f + '-strong') && hex(evalColour(g('--' + f + '-strong'))) === hex(evalColour(g('--' + f + '-ink-hi')))
      : hex(evalColour(g('--' + f + '-strong'))) === hex(evalColour(a('--' + f + '-strong'))));
    record('structure:the 7:1 modes swap the person solids to ink-hi in light palettes and keep the dark pastel solid (never dulled)', { kind: 'structure' }, ok ? 1 : 0, 1, theme + '/' + mode);
  }
  for (const sc of ['light', 'dark']) {
    const g = E.computed([{ isRoot: true, attrs: { scheme: sc, kind: 'kiosk', accent: 'sky' } }]), m = E.computed([rootEl(sc === 'light' ? 'hearth' : 'midnight', { accent: 'sky', kind: 'kiosk' })]);
    record('structure:the 7:1 modes swap the person solids to ink-hi in light palettes and keep the dark pastel solid (never dulled)', { kind: 'structure' }, ACCENTS.every(f => hex(evalColour(g('--' + f + '-strong'))) === hex(evalColour(m('--' + f + '-strong')))) ? 1 : 0, 1, 'no-theme ' + sc + ' kiosk root');
  }

  // L2. color-scheme follows the theme (and a stale scheme cannot change it); a root with data-scheme but NO data-theme
  //     (a document running today's hub.js, which deletes data-theme for System: apps/hub.js:77) gets matching grounds
  for (const [theme, scheme] of Object.entries(THEMES)) {
    for (const sc of ['light', 'dark']) {
      const cs = E.computed([rootEl(theme, { scheme: sc })])('color-scheme');
      record('structure:color-scheme follows the theme, whatever data-scheme says', { kind: 'structure' }, cs === scheme ? 1 : 0, 1, `${theme} (data-scheme=${sc}) → ${cs}`);
    }
  }
  // …in EVERY mode, not only adult: the guard is (0,1,0), so the kiosk, Increase Contrast (attribute and media), Reduce
  // Transparency (attribute and media) and kid blocks still apply on this root (round 3: at (0,3,0) it overrode them).
  // Every custom property the file declares is compared, plus color-scheme.
  const NO_THEME_MODES = { ...Object.fromEntries(Object.entries(MODES).map(([m, x]) => [m, [x, {}]])),
    'contrast-more (media)': [{}, { prefersContrast: 'more' }], 'reduce-transparency (media)': [{}, { prefersReducedTransparency: 'reduce' }],
    'kiosk + contrast-more (media)': [{ kind: 'kiosk' }, { prefersContrast: 'more' }], 'reduce-motion (media)': [{}, { prefersReducedMotion: 'reduce' }] };
  for (const [sc, ref] of [['dark', 'midnight'], ['light', 'hearth']]) {
    for (const [mode, [extra, env]] of Object.entries(NO_THEME_MODES)) {
      const bare = E.computed([{ isRoot: true, attrs: { scheme: sc, kind: 'adult', accent: 'sky', ...extra } }], env);
      const real = E.computed([rootEl(ref, { accent: 'sky', ...extra })], env);
      const s = same({ ...fullSnap(real), cs: real('color-scheme') }, { ...fullSnap(bare), cs: bare('color-scheme') });
      record(`structure:a ${sc} root without data-theme resolves exactly like ${ref} in every mode (every token + color-scheme)`, { kind: 'structure' }, s.ok ? 1 : 0, 1, `data-scheme=${sc}, no data-theme, ${mode}`, { diff: s.diff });
      if (mode === 'adult') record(`structure:a ${sc} root without data-theme declares color-scheme: ${sc}`, { kind: 'structure' }, bare('color-scheme') === sc ? 1 : 0, 1, `→ ${bare('color-scheme')}`);
    }
  }
  // L3. every hub.THEMES id (apps/hub.js:64-71) plus the proposed graphite is in each list a theme has to be in:
  //     its scheme's hue block (§2), its scheme's role block (§4), a color-scheme declaration, a neutral block (§3), the bootstrap
  {
    const hubjs = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
    const ids = [...hubjs.matchAll(/\{\s*id:\s*'(\w+)',\s*name:\s*'[^']*',\s*scheme:\s*(?:null|'(\w+)')/g)].map(m => [m[1], m[2]]).filter(([id]) => id !== 'system');
    ids.push(['graphite', 'dark']);                                 // proposed (decision D2)
    // the bootstrap source (bootstrap.js, or a mutated copy)
    const S = Object.fromEntries([...boot.match(/S=\{([^}]*)\}/)[1].matchAll(/(\w+):'(\w+)'/g)].map(m => [m[1], m[2]]));
    const B = Object.fromEntries([...boot.match(/B=\{([^}]*)\}/)[1].matchAll(/(\w+):'(#[0-9A-Fa-f]{6})'/g)].map(m => [m[1], m[2]]));   // theme-color = the palette's v3 --bg
    const ruleWith = (prop, pred) => RULES.filter(r => prop in r.decls && pred(r));
    for (const [id, scheme] of ids) {
      const sel = `:root[data-theme="${id}"]`;
      const hueOK = ruleWith('--bubblegum-fill', r => r.selectors.includes(`[data-scheme="${scheme}"]`) && r.selectors.includes(sel)).length > 0;
      const roleOK = ruleWith('--glass-look', r => r.selectors.includes(`[data-scheme="${scheme}"]`) && r.selectors.includes(sel)).length > 0;
      const csOK = ruleWith('color-scheme', r => r.decls['color-scheme'] === scheme && r.selectors.includes(sel) && r.selectors.includes(`[data-theme-preview="${id}"]`)).length > 0;
      const neutralOK = ruleWith('--bg', r => r.selectors.includes(sel) && r.selectors.includes(`[data-theme-preview="${id}"]`)).length > 0;
      const bg = hex(evalColour(E.computed([rootEl(id)])('--bg')));
      const bootOK = S[id] === scheme && (B[id] || '').toUpperCase() === bg;
      // round 4: the 7:1 person-solid swap is light-only, keyed per light theme (kiosk, Increase Contrast, its media mirror); a dark theme is in none
      const swapSel = [':root[data-kind="kiosk"]', ':root[data-contrast="more"]', ':root:not([data-contrast="standard"])'].map(x => x + sel.slice(5));
      const inSwap = swapSel.map(x => ruleWith('--mint-strong', r => r.selectors.includes(x)).length > 0);
      const swapOK = scheme === 'light' ? inSwap.every(Boolean) : !inSwap.some(Boolean);
      record('structure:every hub.THEMES id is in its hue list, role list, color-scheme line (root + preview), a neutral block (root + preview) and the bootstrap maps (scheme; theme-color = its --bg); a light theme also in the light-only 7:1 solid swaps', { kind: 'structure' }, hueOK && roleOK && csOK && neutralOK && bootOK && swapOK ? 1 : 0, 1, id, { hueOK, roleOK, csOK, neutralOK, bootOK, swapOK });
    }
  }
  // L3b. the neutral legacy aliases whose value changes resolve to the documented target in every palette
  //      (their readers are counted by property in legacy-reads.json; --muted-decor is also gated >= 3:1 above)
  for (const theme of Object.keys(THEMES)) {
    const g = E.computed([rootEl(theme, { accent: 'sky' })]);
    for (const [alias, target] of [['muted-decor', 'track-info'], ['line-soft', 'separator'], ['bg-2', 'surface-2'], ['glass-line', 'glass-ring']])
      record('structure:each changed neutral alias resolves to its documented target', { kind: 'structure' }, g('--' + alias) !== undefined && g('--' + alias) === g('--' + target) ? 1 : 0, 1, `${theme} --${alias} → --${target}`);
  }
  // L4. Forest keeps its gold: the page wash carries the butter graphic (hub.THEMES blurb "Deep green, gold ink")
  {
    const w = E.computed([rootEl('forest', { accent: 'sky' })])('--wash') || '';
    record('structure:Forest keeps its gold wash', { kind: 'structure' }, /#FFDB7E/i.test(w) ? 1 : 0, 1, 'forest --wash');
  }
  // L5. the pre-paint bootstrap (bootstrap.js, pasted inline in every <head>) run against a stub document, then through the cascade
  {
    const code = boot;
    const pm0 = fs.readFileSync(path.join(ROOT, 'apps', 'prayer.html'), 'utf8').split('\n')[8].match(/<meta ([^>]*)>/);
    const PRAYER_META0 = pm0 ? Object.fromEntries([...pm0[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])) : {};
    // metas: 'static' = today's two media-keyed metas (index.html:8-9) are already in <head>; 'none' = the snippet creates one
    const run = (ls, media = {}, metas = 'static') => {
      const attrs = {}, style = {};
      const store = Object.fromEntries(Object.entries(ls).map(([k, v]) => [k, JSON.stringify(v)]));
      const mm = q => ({ matches: !!media[q] });
      const mkMeta = a => ({ a: { ...a }, setAttribute(k, v) { this.a[k] = String(v); }, removeAttribute(k) { delete this.a[k]; } });
      const head = metas === 'static' ? [mkMeta({ name: 'theme-color', content: '#F7F2EB', media: '(prefers-color-scheme: light)' }), mkMeta({ name: 'theme-color', content: '#1A1512', media: '(prefers-color-scheme: dark)' })]
        : metas === 'prayer' ? [mkMeta(PRAYER_META0)] : [];
      const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = String(v); }, style },
        querySelectorAll: q => (q === 'meta[name="theme-color"]' ? head.filter(m => m.a.name === 'theme-color') : []),
        createElement: () => mkMeta({}), head: { appendChild: m => { head.push(m); return m; } } };
      vm.runInNewContext(code, { document, localStorage: { getItem: k => (k in store ? store[k] : null) }, matchMedia: mm, window: { matchMedia: mm } });
      return { attrs, colorScheme: style.colorScheme, metas: head.map(m => ({ ...m.a })) };
    };
    // Prayer keeps its own <meta name="theme-color" id="themeColor"> (apps/prayer.html:9; CLAUDE.md: its ids stay). In Prayer the
    // bootstrap goes right AFTER that meta (still before design.css at :10), so it finds and rewrites it and creates none.
    const pm = fs.readFileSync(path.join(ROOT, 'apps', 'prayer.html'), 'utf8').split('\n')[8].match(/<meta ([^>]*)>/)[1];
    const PRAYER_META = Object.fromEntries([...pm.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    if (PRAYER_META.name !== 'theme-color' || PRAYER_META.id !== 'themeColor') throw new Error('apps/prayer.html:9 is no longer the theme-color meta');
    const seedHex = [...fs.readFileSync(path.join(ROOT, 'worker', 'seed.sql'), 'utf8').matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map(m => m[1]);
    const swatches = [...(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/const SWATCHES = \[([^\]]*)\]/)[1].matchAll(/'(#[0-9A-Fa-f]{6})'/g))].map(m => m[1]);
    const H = Object.fromEntries([...code.match(/H=\{([^}]*)\}/)[1].matchAll(/'(#[0-9a-f]{6})':'(\w+)'/g)].map(m => [m[1], m[2]]));
    for (const hx of new Set([...seedHex, ...swatches])) record('bootstrap:every stored profile hex (seed.sql, the SWATCHES) has a PERSON hue fallback', { kind: 'structure' }, PEOPLE.includes(H[hx.toLowerCase()]) ? 1 : 0, 1, `${hx} → ${H[hx.toLowerCase()]}`);
    // D3 (household answer 2026-09-25): the seeded people map to their chosen families; D4: both guest swatches map to the free hue, sky
    const WANT = { '#4f5d8c': 'periwinkle', '#bc5a38': 'peach', '#8a6a4b': 'bubblegum', '#3d5a3d': 'mint', '#5b8143': 'butter', '#137f77': 'aqua', '#b4861b': 'lavender', '#4c4c58': 'graphite', '#8c4f7a': 'sky', '#4c7b6a': 'sky' };
    for (const [hx, hue] of Object.entries(WANT)) record('bootstrap:the fallback table carries the household’s colour decisions (D3 people, D4 guests)', { kind: 'structure' }, H[hx] === hue ? 1 : 0, 1, `${hx} → ${H[hx]} (want ${hue})`);
    const household = Object.entries(WANT).filter(([hx]) => !['#8c4f7a', '#4c7b6a'].includes(hx)).map(([, h]) => h);
    record('bootstrap:the eight household people hold eight different families, and the guests’ family is none of them (D4)', { kind: 'structure' }, new Set(household).size === household.length && !household.includes('sky') ? 1 : 0, 1, household.join(','));
    const A = (code.match(/var A=' ([a-z ]+) '/) || [, ''])[1].split(' ');
    record('bootstrap:the hues a profile may store are exactly the 18 accent families (people + apps; admin-assigned, 2026-09-26)', { kind: 'structure' }, JSON.stringify([...A].sort()) === JSON.stringify([...ACCENTS].sort()) ? 1 : 0, 1, A.join(','));
    const cases = [
      ['System on a dark OS', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C' } } }, { '(prefers-color-scheme: dark)': true }, { theme: 'midnight', scheme: 'dark', choice: 'system', accent: 'periwinkle' }],
      ['System on a light OS (no static theme-color meta: the snippet creates one)', {}, {}, { theme: 'hearth', scheme: 'light', choice: 'system' }, 'none'],
      ['Hearth on a dark OS stays Hearth', { 'hub.theme': 'hearth' }, { '(prefers-color-scheme: dark)': true }, { theme: 'hearth', scheme: 'light' }],
      ['the "dark" alias', { 'hub.theme': 'dark' }, {}, { theme: 'midnight', scheme: 'dark' }],
      ['Forest', { 'hub.theme': 'forest' }, {}, { theme: 'forest', scheme: 'dark' }],
      ['Graphite (D2)', { 'hub.theme': 'graphite' }, {}, { theme: 'graphite', scheme: 'dark' }],
      ['an unknown stored theme falls back to System', { 'hub.theme': 'neon' }, {}, { theme: 'hearth', scheme: 'light' }],
      ['a session stored BEFORE the deploy (no hue: Mae #BC5A38) resolves by the fallback table (D3: peach)', { 'hub.session': { profile: { kind: 'adult', color: '#BC5A38' } } }, {}, { accent: 'peach', kind: 'adult' }],
      ['a legacy kid session (Kiara #B4861B, D3: lavender)', { 'hub.session': { profile: { kind: 'kid', color: '#B4861B' } } }, {}, { accent: 'lavender', kind: 'kid' }],
      ['a legacy guest session (swatch #8C4F7A, D4: guests share the free hue, sky)', { 'hub.session': { profile: { kind: 'adult', color: '#8C4F7A' } } }, {}, { accent: 'sky' }],
      ['a guest whose stored colour is a household one (the Add-a-guest default #137F77) is still sky (D4; verify-rev6 issue 3)', { 'hub.session': { profile: { kind: 'adult', color: '#137F77', is_guest: true } } }, {}, { accent: 'sky' }],
      ['the TV ignores a stored glass level (the kiosk keeps its own panels; verify-rev6 issue 4)', { 'hub.session': { profile: { kind: 'kiosk', color: '#4C4C58' } }, 'hub.prefs': { glass: 'clear' } }, {}, { kind: 'kiosk', glass: undefined, transparency: undefined }],
      ['the glass level Clear (D8): data-glass, and an explicit choice opts out of the OS', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C' } }, 'hub.prefs': { glass: 'clear' } }, {}, { glass: 'clear', transparency: 'full' }],
      ['no one signed in: a stored glass level is not applied (it belongs to a person)', { 'hub.prefs': { glass: 'clear' } }, {}, { glass: undefined, transparency: undefined }],
      ['the glass level Solid (D8) is Reduce Transparency', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C' } }, 'hub.prefs': { glass: 'solid' } }, {}, { transparency: 'reduce' }],
      ['a new session carries its hue', { 'hub.session': { profile: { kind: 'adult', color: '#123456', hue: 'sky' } } }, {}, { accent: 'sky' }],
      // admin-assigned colours (household answer 2026-09-26, amending D3/D4): any of the 18 families, for anyone, guests included
      ['the admin gave a household person an app family (orchid): the stored hue wins', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C', hue: 'orchid' } } }, {}, { accent: 'orchid' }],
      ['the admin gave a guest a colour (coral): the stored hue wins over the sky default', { 'hub.session': { profile: { kind: 'adult', color: '#137F77', is_guest: true, hue: 'coral' } } }, {}, { accent: 'coral' }],
      ['a guest with no stored hue is sky (the D4 default)', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C', is_guest: true } } }, {}, { accent: 'sky' }],
      ['an unknown stored hue name is ignored: the fallback table applies (Mae #BC5A38 → peach)', { 'hub.session': { profile: { kind: 'adult', color: '#BC5A38', hue: 'neon' } } }, {}, { accent: 'peach' }],
      ['a stored hue of two names ("sky periwinkle") is not a name: the fallback table applies (Eli #4F5D8C → periwinkle)', { 'hub.session': { profile: { kind: 'adult', color: '#4F5D8C', hue: 'sky periwinkle' } } }, {}, { accent: 'periwinkle' }],
      ['an unknown stored hue on a guest falls back to sky', { 'hub.session': { profile: { kind: 'adult', color: '#123456', is_guest: true, hue: 'neon' } } }, {}, { accent: 'sky' }],
      ['an unknown hex falls back to graphite, never to another person', { 'hub.session': { profile: { kind: 'adult', color: '#123456' } } }, {}, { accent: 'graphite' }],
      ['Prayer (its own meta id="themeColor", apps/prayer.html:9, the bootstrap right after it) on System, light OS', {}, {}, { theme: 'hearth', scheme: 'light' }, 'prayer'],
      ['Prayer on Midnight', { 'hub.theme': 'midnight' }, {}, { theme: 'midnight', scheme: 'dark' }, 'prayer'],
      ['person preferences, motion included', { 'hub.prefs': { textSize: 'l', contrast: 'more', transparency: 'reduce', motion: 'reduce' } }, {}, { 'text-size': 'l', contrast: 'more', transparency: 'reduce', motion: 'reduce' }],
    ];
    for (const [name, ls, media, want, metas] of cases) {
      const { attrs, colorScheme, metas: tc } = run(ls, media, metas);
      const got = { theme: attrs['data-theme'], scheme: attrs['data-scheme'], choice: attrs['data-theme-choice'], accent: attrs['data-accent'], kind: attrs['data-kind'], 'text-size': attrs['data-text-size'], contrast: attrs['data-contrast'], transparency: attrs['data-transparency'], motion: attrs['data-motion'], glass: attrs['data-glass'] };
      const okAttrs = Object.entries(want).every(([k, v]) => got[k] === v);
      // the attributes it wrote, through the cascade: the inline colorScheme equals the CSS color-scheme, and the accent is that family
      const el = { isRoot: true, attrs: Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'data-theme-choice').map(([k, v]) => [k.slice(5), v])) };
      const g = E.computed([el]);
      const okCss = colorScheme === g('color-scheme') && (!got.accent || (() => { try { return hex(evalColour(g('--accent-strong'))) === hex(evalColour(g(`--${got.accent}-strong`))); } catch (e) { return false; } })());   // an accent with no family fails here, not by a crash
      // theme-color (TELL-1): every theme-color meta, static or created, carries the resolved palette's --bg and no media query
      const bgHex = hex(evalColour(g('--bg')));
      const okMeta = tc.length >= 1 && tc.every(m => m.name === 'theme-color' && (m.content || '').toUpperCase() === bgHex && !('media' in m));
      record('bootstrap:the pre-paint snippet writes the right attributes and color-scheme, and they resolve through the tokens', { kind: 'structure' }, okAttrs && okCss ? 1 : 0, 1, name, { got, colorScheme });
      record('bootstrap:every theme-color meta carries the resolved palette --bg, with no media query (TELL-1)', { kind: 'structure' }, okMeta ? 1 : 0, 1, name, { metas: tc, bgHex });
      if (metas === 'prayer') record('bootstrap:in Prayer the snippet rewrites its own meta and creates none: exactly one theme-color meta, id="themeColor" kept', { kind: 'structure' }, tc.length === 1 && tc[0].id === 'themeColor' && okMeta ? 1 : 0, 1, name, { metas: tc });
      extras.bootstrap.push({ case: name, attrs, colorScheme, themeColor: tc, ok: okAttrs && okCss && okMeta });
    }
  }
  // L6. every legacy background that carries a label, read as the shipped CSS writes them (label AND background), under
  //     the proposed tokens in every palette x person. A rule that fails as written must have a named batch-1a rewrite that
  //     passes (the pairing rule: a labelled background maps to the family's -strong, its label to that family's -on;
  //     surfaces map to --hero-bg / --accent-fill with --accent-ink; the badge to --badge-bg / --badge-ink).
  labelPass(E, record, extras);
  heroButtonPass(E, record, extras);

  // M. every var() in the file is defined
  {
    const defined = new Set(RULES.flatMap(r => Object.keys(r.decls)));
    const used = new Set([...src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
    const missing = [...used].filter(u => !defined.has(u));
    record('static:every var() reference in the token file is defined', { kind: 'static' }, missing.length ? 0 : 1, 1, 'file', { missing });
  }

  // N. legacy coverage: every name apps/design.css defines, and every var() the shell and apps read, still resolves
  if (withExtras !== 'skip-legacy') {
    const defined = new Set(RULES.flatMap(r => Object.keys(r.decls)));
    const design = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
    const tokenHalf = design.split('\n').slice(0, 289).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const designNames = [...new Set([...tokenHalf.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))].sort();
    const files = ['index.html', 'apps/design.css', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => /\.(html|js)$/.test(f)).map(f => 'apps/' + f)];
    const REMOVED = { '--dur': 'retired: 0 readers (GAP-TOK-9); --dur-fast replaces it', '--shadow-sm': 'retired: 0 readers (GAP-TOK-9); --e1 / --elev-card', '--info': 'retired: 0 readers (GAP-TOK-9); --sky-ink' };
    const readers = {}; const perFile = {}; let missingUse = [];
    for (const f of files) {
      let t = fs.readFileSync(path.join(ROOT, f), 'utf8');
      if (f === 'apps/design.css') t = t.split('\n').slice(289).join('\n');           // the component half keeps its own locals
      const local = new Set([...t.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]).concat([...t.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)].map(m => m[1])));
      const used = [...t.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].filter(m => !m[2]).map(m => m[1]);   // a var() with a fallback always resolves
      for (const u of used) readers[u] = (readers[u] || 0) + 1;
      const miss = [...new Set(used)].filter(u => !u.endsWith('-') && !local.has(u) && !defined.has(u));
      perFile[f] = { varNamesRead: new Set(used).size, resolvedByLocalDefinitions: [...new Set(used)].filter(u => local.has(u) && !defined.has(u)).length, missing: miss };
      missingUse = missingUse.concat(miss.map(m => `${f}: ${m}`));
    }
    const designMissing = designNames.filter(n => !defined.has(n) && !REMOVED[n]);
    const removedWithReaders = Object.keys(REMOVED).filter(n => readers[n]);
    record('legacy:every token apps/design.css defines today still resolves', { kind: 'legacy' }, designMissing.length ? 0 : 1, 1, `${designNames.length} names`, { missing: designMissing });
    record('legacy:every var() the shell and apps read resolves (token file or the file\'s own locals)', { kind: 'legacy' }, missingUse.length ? 0 : 1, 1, `${files.length} files`, { missing: missingUse.slice(0, 40) });
    record('legacy:retired names have no readers', { kind: 'legacy' }, removedWithReaders.length ? 0 : 1, 1, Object.keys(REMOVED).join(','), { readers: removedWithReaders });
    extras.legacy = { designCssNames: designNames.length, removed: REMOVED, designMissing, files: perFile, readersOfRemoved: Object.fromEntries(Object.keys(REMOVED).map(n => [n, readers[n] || 0])) };
  }

  return { results, failures, evaluated, extras };
}

// ── run, then the mutation test ──────────────────────────────────────────────────────────────────────────
const SRC = fs.readFileSync(FILE, 'utf8');
const t0 = Date.now();
const main = verify(SRC);
const MUTATIONS = [
  { name: 'Hearth --text-3 set to #8E8E93 (iOS tertiary grey)', expect: 'text:text-3', mutate: s => s.replace('--text-3: #635B53;', '--text-3: #8E8E93;') },
  { name: 'light mint graphic moved onto aqua\'s #007E79', expect: 'cvd:', mutate: s => s.replace('--mint-graphic: #006F46;', '--mint-graphic: #007E79;') },
  { name: '--tap-base 40px', expect: 'target:--tap', mutate: s => s.replace('--tap-base: 44px;', '--tap-base: 40px;') },
  { name: 'the --font-sans alias deleted', expect: 'legacy:every token', mutate: s => s.replace('--font-sans: var(--font-ui); ', '') },
  { name: 'the graphite accent block repeated at the end (cascade-order bug)', expect: 'scope:', mutate: s => s + '\n:root, [data-accent="graphite"] { --accent-wash: var(--graphite-wash); --accent-fill: var(--graphite-fill); --accent-fill-strong: var(--graphite-fill-strong); --accent-strong: var(--graphite-strong); --accent-graphic: var(--graphite-graphic); --accent-ink: var(--graphite-ink); --accent-ink-hi: var(--graphite-ink-hi); --accent-on: var(--graphite-on); }\n' },
  { name: 'Reduce Transparency block moved before the kiosk block', expect: 'structure:reduce-transparency', mutate: s => { const m = s.match(/:root\[data-transparency="reduce"\] \{[^}]*\}/)[0]; return s.replace(m, '').replace(':root[data-kind="kiosk"] {', m + '\n:root[data-kind="kiosk"] {'); } },
  { name: 'the no-data-theme dark selector removed from the Midnight neutral block', expect: 'structure:a dark root without data-theme', mutate: s => s.replace(',\n:root:where([data-scheme="dark"]:not([data-theme])) {', ' {') },
  { name: 'the no-data-theme guard back at (0,3,0) (round 3: it overrode the kiosk, Increase Contrast and Reduce Transparency blocks)', expect: 'structure:a dark root without data-theme resolves exactly like midnight in every mode', mutate: s => s.replace(':root:where([data-scheme="dark"]:not([data-theme])) {', ':root[data-scheme="dark"]:not([data-theme]) {') },
  { name: '--tv-panel back to .66 (--tv-text-2 5.10 over a white photo)', expect: 'tv:tv-text-2', mutate: s => s.replace('--tv-panel: rgba(0, 0, 0, 0.74);', '--tv-panel: rgba(0, 0, 0, 0.66);') },
  { name: 'Increase Contrast keeps the adult inverse glass (no --glass-inverse-hi)', expect: 'glass:glass-inverse-ink/glass-inverse', mutate: s => s.replace(/(:root\[data-contrast="more"\] \{[\s\S]*?) --glass-inverse: var\(--glass-inverse-hi\);/, '$1') },
  { name: 'the pickup painted in the person strong tone again (a light pastel in dark)', expect: 'glass:text under the full sheen and pickup', mutate: s => s.replace('color-mix(in srgb, var(--accent-fill-strong) var(--glass-pickup), transparent)', 'color-mix(in srgb, var(--accent-strong) var(--glass-pickup), transparent)') },
  { name: 'the kid block stops rounding --font-mono (the Larder counts)', expect: 'type:kid mode', mutate: s => s.replace('  --font-mono: var(--font-rounded);', '') },
  { name: '--dur-bouncy back to 460ms', expect: 'motion:--dur-bouncy', mutate: s => s.replace('--dur-bouncy: 340ms;', '--dur-bouncy: 460ms;') },
  { name: '--muted-decor back to the 16 % separator', expect: 'ui:muted-decor', mutate: s => s.replace('--muted-decor: var(--track-info);', '--muted-decor: var(--separator);') },
  { name: 'Increase Contrast drops the 7:1 solid swaps', expect: 'accent:accent-on/accent-strong', mutate: s => s.replace(/(:root\[data-contrast="more"\]:not\(\[data-theme\]\):not\(\[data-scheme="dark"\]\) \{[^}]*?)--bubblegum-strong: [^\n]*\n/, '$1') },
  { name: 'the person-solid swap applied in dark again (the pastel fill dulled to ink-hi)', expect: 'structure:the 7:1 modes swap the person solids', mutate: s => s.replace(':root[data-kind="kiosk"][data-theme="hearth"],\n', ':root[data-kind="kiosk"][data-theme="hearth"],\n:root[data-kind="kiosk"][data-theme="midnight"],\n') },
  { name: 'Prayer\'s meta ignored (the bootstrap then creates a second, id-less meta)', expect: 'bootstrap:in Prayer', mutate: s => s, boot: b => b.replace('var ms=document.querySelectorAll(\'meta[name="theme-color"]\'),i;', 'var ms=[],i;') },
  { name: 'Graphite dark chip back to #3C3C41', expect: 'depth:graphite-fill', mutate: s => s.replace('--graphite-fill: #404045;', '--graphite-fill: #3C3C41;') },
  { name: 'the 10-foot TV scale made the default (the opt-in attribute dropped)', expect: "type:the kiosk keeps today's TV sizes", mutate: s => s.replace(':root[data-kind="kiosk"][data-tv-scale="10ft"] {', ':root[data-kind="kiosk"] {') },
  { name: 'a bare [data-theme="midnight"] palette scope put back (the F260 seg-button collision)', expect: 'structure:a non-preview element carrying data-theme', mutate: s => s.replace(':root[data-theme="midnight"], :root[data-theme="dark"], [data-theme-preview="midnight"],', ':root[data-theme="midnight"], :root[data-theme="dark"], [data-theme-preview="midnight"], [data-theme="midnight"],') },
  { name: 'var(--sheen-x) put back into --glass-bg (a :root token freezes the sheen)', expect: 'glass:no token declaration contains var(--sheen-x)', mutate: s => s.replace('  --glass-bg:\n    linear-gradient(to bottom, var(--glass-spec) 0, transparent 34%),\n', '  --glass-bg:\n    linear-gradient(to bottom, var(--glass-spec) 0, transparent 34%),\n    radial-gradient(90% 70% at var(--sheen-x) -10%, transparent, transparent),\n') },
  { name: 'the kid block stops rounding the serif', expect: 'type:kid mode', mutate: s => s.replace(' --font-serif: var(--font-rounded);', '') },
  { name: '--dur-progress back to 800ms', expect: 'motion:--dur-progress', mutate: s => s.replace('--dur-progress: var(--dur-slow);', '--dur-progress: 800ms;') },
  { name: 'the bootstrap theme-color for Midnight left at the old #1A1512', expect: 'structure:every hub.THEMES id', mutate: s => s, boot: b => b.replace("midnight:'#0B0A09'", "midnight:'#1A1512'") },
  { name: 'the dark hero button back to a white capsule (the glowing ink on white, 1.19-1.29 in dark)', expect: 'labels:the hero button (', mutate: s => s.replace('--hero-btn-mix: 100%;', '--hero-btn-mix: 0%;') },
  { name: 'the kiosk forgets the app inks (seafoam stays at its AA ink on the TV)', expect: 'fam:seafoam-ink', mutate: s => s.replace(/(:root\[data-kind="kiosk"\] \{[\s\S]*?) --seafoam-ink: var\(--seafoam-ink-hi\);/, '$1') },
  { name: 'an app family painted in a person colour (coral tile end = bubblegum #FF97BF)', expect: 'apphue:app vs person fill-strong', mutate: s => s.replace('--coral-fill-strong: #FF9AA8;', '--coral-fill-strong: #FF97BF;') },
  { name: 'Clear glass without its outline halo', expect: 'structure:the see-through glass levels paint a SOLID outline', mutate: s => s.replace('--glass-halo-alpha: 70%; --glass-halo-edge-alpha: 100%;', '--glass-halo-alpha: 70%; --glass-halo-edge-alpha: 0%;') },
  { name: 'Clear glass leaves its icons without an outline (verify-rev6 round 2, issue 2)', expect: 'structure:the see-through glass levels paint a SOLID outline', mutate: s => s.replace('--glass-alpha-strong: 48%; --glass-halo-alpha: 70%; --glass-halo-edge-alpha: 100%;\n  --glass-text-shadow: var(--glass-text-outline); --glass-icon-filter: var(--glass-icon-outline); }', '--glass-alpha-strong: 48%; --glass-halo-alpha: 70%; --glass-halo-edge-alpha: 100%;\n  --glass-text-shadow: var(--glass-text-outline); }') },
  { name: 'Kid Verse dark honey fill back on Mae\'s peach (verify-rev6 round 3, issue 1)', expect: 'apphue:app vs person in every role', mutate: s => s.replace(/(--honey-wash: #3[0-9A-F]{5}; --honey-fill: )#[0-9A-F]{6}/, '$1#5F3712') },
  { name: 'Kid Verse dark honey glyph back on the warning ink (verify-rev6 round 2, issue 1)', expect: 'apphue:an app ink is no closer', mutate: s => s.replace(/(--honey-wash: #3[0-9A-F]{5};[^\n]*?--honey-ink: )#[0-9A-F]{6}/, '$1#FACD98') },
  { name: 'Kid Verse honey back on the warning colour in dark (verify-rev6 issue 2)', expect: 'apphue:an app fill is no closer', mutate: s => s.replace(/--honey-fill: #[0-9A-F]{6}; (--honey-fill-strong: #[0-9A-F]{6}; --honey-strong: #[0-9A-F]{6}; --honey-graphic: #[0-9A-F]{6}; --honey-ink: #[0-9A-F]{6}; --honey-ink-hi: #[0-9A-F]{6}; --honey-on: #2)/, '--honey-fill: #5A390A; $1') },
  { name: 'the bootstrap gives a guest a household colour (verify-rev6 issue 3)', expect: 'bootstrap:the pre-paint snippet', mutate: s => s, boot: b => b.replace("?p.hue:p.is_guest?'sky':", '?p.hue:') },
  { name: 'the bootstrap trusts any stored hue name (an unknown hue paints no family)', expect: 'bootstrap:the pre-paint snippet', mutate: s => s, boot: b => b.replace("p.hue&&A.split(' ').indexOf(p.hue)>0?p.hue:", 'p.hue?p.hue:') },
  { name: 'the glass levels moved after Increase Contrast (a see-through level beats it)', expect: 'structure:Increase Contrast beats', mutate: s => { const m = s.match(/:root\[data-glass="current"\][\s\S]*?:root\[data-glass="clear"\][\s\S]*?\}\n/)[0]; return s.replace(m, '') + '\n' + m; } },
  { name: 'the dark hero capsule back to the deep fill (no edge: 1.00 against the end stop)', expect: 'accent:the dark hero capsule', mutate: s => s.replace('--hero-btn-bg: color-mix(in srgb, var(--accent-strong) var(--hero-btn-mix), #FFFFFF);', '--hero-btn-bg: color-mix(in srgb, var(--accent-fill) var(--hero-btn-mix), #FFFFFF);') },
  { name: 'Reduce Transparency leaves --blur at 20 px', expect: 'structure:no live blur', mutate: s => s.replace('--scrim-blur: 0px; --blur: 0px; --blur-sm: 0px; --blur-lg: 0px;\n', '--scrim-blur: 0px;\n') },
  { name: 'Reduce Motion leaves the TV crossfade at 2.5 s', expect: 'motion:Reduce Motion sets the TV crossfade', mutate: s => s.replace('  --dur-crossfade: 150ms;                                              /*', '  /*') },
  { name: 'the bootstrap maps Kiara back to butter (before D3)', expect: 'bootstrap:the fallback table carries', mutate: s => s, boot: b => b.replace("'#b4861b':'lavender'", "'#b4861b':'butter'") },
  { name: 'the prefers-contrast media block drops the ink swaps', expect: 'mirror:@media (prefers-contrast', mutate: s => s.replace(/(@media \(prefers-contrast: more\) \{\s*:root:not\(\[data-contrast="standard"\]\) \{\s*--text-2: var\(--text-2-hi\); --text-3: var\(--text-2-hi\);)\s*--bubblegum-ink: [^\n]*\n/, '$1\n') },
];
const mutationResults = [];
for (const m of MUTATIONS) {
  const src2 = m.mutate(SRC);
  const boot2 = m.boot ? m.boot(BOOT_SRC) : undefined;
  if (src2 === SRC && boot2 === undefined) { mutationResults.push({ mutation: m.name, applied: false, caught: false }); continue; }
  let r; try { r = verify(src2, { withExtras: false, ...(boot2 ? { boot: boot2 } : {}) }); } catch (e) { mutationResults.push({ mutation: m.name, applied: true, caught: true, how: 'threw: ' + e.message.slice(0, 120) }); continue; }
  const hits = [...r.results.values()].filter(a => a.fails && a.id.startsWith(m.expect));
  mutationResults.push({ mutation: m.name, applied: true, caught: hits.length > 0, failingChecks: [...r.results.values()].filter(a => a.fails).length, failingEvaluations: r.failures.length, expectedCheck: m.expect, example: hits[0]?.id });
}
for (const m of mutationResults) {
  main.evaluated++;
  const id = 'mutation:a planted fault makes the gate fail';
  let a = main.results.get(id); if (!a) { a = { id, kind: 'mutation', threshold: 1, n: 0, min: Infinity, max: -Infinity, worst: null, fails: 0 }; main.results.set(id, a); }
  a.n++; const v = m.applied && m.caught ? 1 : 0; if (v < a.min) { a.min = v; a.worst = m.mutation; } a.max = Math.max(a.max, v);
  if (!v) { a.fails++; main.failures.push({ id, context: m.mutation, value: 0, threshold: 1 }); }
}

// ── output ───────────────────────────────────────────────────────────────────────────────────────────────
const pairs = [...main.results.values()].map(a => ({ ...a, min: fl(+a.min, 3), max: +(+a.max).toFixed(3) }));
const byKind = {};
for (const p of pairs) { const k = p.kind; byKind[k] ??= { checks: 0, evaluations: 0, failingChecks: 0, min: null }; byKind[k].checks++; byKind[k].evaluations += p.n; if (p.fails) byKind[k].failingChecks++; }
const summary = {
  generated: new Date().toISOString(), tokens: path.relative(ROOT, FILE).replace(/\\/g, '/'), script: path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/'),
  method: 'WCAG 2.x relative luminance; translucent layers composited in sRGB over the page, a card, #767676 and the worst backdrop (black under light glass, white under dark), unblurred; CVD = Machado, Oliveira & Fernandes 2009 at severity 1.0 in linear sRGB; distance = CIEDE2000 (D65); the cascade (specificity, order, @media, inheritance, var(), color-mix) is run by this script.',
  contexts: { themes: THEMES, system: 'System resolves in hub.js to hearth (day) / midnight (night) — CLAUDE.md', people: PEOPLE, apps: APP_OF, modes: Object.keys(MODES), glassLevels: ['frosted (default)', 'current', 'clear', 'solid = reduce-transparency'] },
  checkKinds: pairs.length, evaluations: main.evaluated, failingCheckKinds: pairs.filter(p => p.fails).length, failingEvaluations: main.failures.length,
  mutationTest: mutationResults.map(m => ({ mutation: m.mutation, caught: m.caught, failingEvaluations: m.failingEvaluations })), runtimeMs: Date.now() - t0,
  byKind,
};
const out = { summary, failures: main.failures.slice(0, 300), glassLayersReported: main.extras.glassLayers, nestedPreviewWithoutAccent: main.extras.nestedPreviewWithoutAccent, legacyLabels: main.extras.labels, heroButton: main.extras.heroButton, bootstrap: main.extras.bootstrap, kioskTiers: main.extras.kioskTiers, familyTable: main.extras.familyTable, neutralTable: main.extras.neutralTable, accentMatrix: main.extras.accentMatrix, semanticCvdInfo: main.extras.semantic, cvd: main.extras.cvd, appHues: main.extras.appHues, glassLevels: main.extras.glassLevels, heroEdge: main.extras.heroEdge, typeTable: main.extras.typeTable, legacy: main.extras.legacy, mutationTest: mutationResults, checks: pairs, engineSamples: main.extras.samples };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const { byKind: _bk, ...headline } = summary;
console.log(JSON.stringify({ ...headline, byKind }, null, 1));
for (const w of pairs.filter(p => p.fails).sort((a, b) => a.min / a.threshold - b.min / b.threshold).slice(0, 60)) console.log(`FAIL ${w.id}: min ${w.min} < ${w.threshold} (${w.fails}/${w.n}; worst ${w.worst})`);
for (const f of main.failures.filter(f => f.missing || f.diff).slice(0, 10)) console.log('  detail', JSON.stringify(f).slice(0, 400));
console.log('CVD graphic', JSON.stringify(Object.fromEntries(Object.entries(main.extras.cvd).map(([t, v]) => [t, Object.fromEntries(Object.entries(v.graphic).map(([k, x]) => [k, x.min]))]))));
process.exit(main.failures.length ? 1 : 0);
