// Revision-6 verifier (independent). Resolves the proposed token CSS in real engines (WebKit and Chromium) through
// getComputedStyle on a probe, then checks the revision-6 claims with its own colour code (colour.mjs).
//   ROUND 2 (revision 6b). node audits/tools/phase5/verify-rev6/verify-r2.mjs [webkit|chromium|both]
// Output: audits/evidence/p5/verify-rev6/verify.json (+ halo-*.png crops). No network: every request but data:/about:blank is aborted.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse, hex, contrast, over, de2000, floor, decodePng } from './colour.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUTDIR = path.join(ROOT, 'audits', 'evidence', 'p5', 'verify-rev6');
fs.mkdirSync(OUTDIR, { recursive: true });
const TOK = path.join(ROOT, 'audits', 'tools', 'phase4', 'tokens');
const css = fs.readFileSync(path.join(TOK, 'proposed-tokens.css'), 'utf8');
const BOOT = fs.readFileSync(path.join(TOK, 'bootstrap.js'), 'utf8');

// the same way browser-check.mjs (lines 23-37) finds playwright-core and Chrome
const H = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const WHICH = process.argv[2] || 'both';

const PALETTES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const APPS = ['coral', 'apricot', 'honey', 'pistachio', 'leaf', 'seafoam', 'lagoon', 'cornflower', 'orchid'];
const FAMS = [...PEOPLE, ...APPS];
const SEM = ['success', 'warning', 'danger'];
const ROLES = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'];
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field'];
const NEUTRAL = [...OPAQUE, 'text', 'text-2', 'text-3', 'text-2-hi', 'placeholder', 'muted'];
const ACC = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'].map(r => 'accent-' + r);
const DERIVED = ['hero-btn-bg', 'hero-btn-ink', 'sel-fill', 'sel-ink', 'sel-fill-strong', 'sel-ink-strong', 'focus-ring-color', 'today-ring',
  'progress-fill', 'progress-track', 'tint-fill', 'tint-fill-strong', 'tint-ink', 'tint-graphic', 'accent', 'accent-soft', 'accent-tint', 'accent-deep', 'on-accent', 'timer-done', 'glass-halo'];
const NESTED = DERIVED;   // --timer-done is declared on :root/[data-scheme] only: 'the owner's colour', not the tile's (reported)
const GLASS = ['glass', 'glass-strong', 'glass-spec', 'glass-halo', 'glass-solid', 'glass-look', 'glass-strong-solid'];
const COLOURS = [...FAMS.flatMap(f => ROLES.map(r => `${f}-${r}`)), ...SEM.flatMap(f => ROLES.map(r => `${f}-${r}`)), ...NEUTRAL, ...ACC, ...DERIVED, ...GLASS];
const RAW = ['glass-halo-edge-alpha', 'glass-alpha', 'glass-alpha-strong', 'glass-halo-alpha', 'glass-pickup', 'glass-pickup-layer', 'glass-filter', 'glass-filter-strong', 'blur', 'blur-sm', 'blur-lg', 'dur-crossfade', 'glass-text-shadow', 'hero-btn-mix'];

const MODES = {                                     // [attrs, media, 7:1?]
  adult: [{ 'data-kind': 'adult' }, null, false],
  kid: [{ 'data-kind': 'kid' }, null, false],
  kiosk: [{ 'data-kind': 'kiosk' }, null, true],
  'contrast-more': [{ 'data-kind': 'adult', 'data-contrast': 'more' }, null, true],
  'contrast-more (media)': [{ 'data-kind': 'adult' }, { contrast: 'more' }, true],
  'kid+contrast-more': [{ 'data-kind': 'kid', 'data-contrast': 'more' }, null, true],
  'reduce-transparency': [{ 'data-kind': 'adult', 'data-transparency': 'reduce' }, null, false],
  'kiosk+reduce-transparency': [{ 'data-kind': 'kiosk', 'data-transparency': 'reduce' }, null, true],
};

const failures = [];
const stats = { evaluations: 0, failing: 0 };
const minima = {};
function check(id, v, thr, ctx) {
  stats.evaluations++;
  const m = (minima[id] ??= { min: Infinity, at: '', thr });
  if (v < m.min) { m.min = v; m.at = ctx; }
  if (!(v >= thr - 1e-9)) { stats.failing++; if (failures.length < 400) failures.push({ id, value: floor(v, 3), thr, ctx }); }
}

const PAGE = `<!doctype html><html><head><meta name="theme-color" content="#123456"><style>${css}</style></head><body style="margin:0">
<div id="sentinel" style="color: rgb(1, 2, 3)"><div id="probe"></div></div></body></html>`;

// in-page reader: set <html> attributes, optionally nest the probe in scope elements, read every token
function reader() {
  window.__read = (jobs) => jobs.map(({ attrs, nest, colours, raw }) => {
    const d = document.documentElement;
    for (const a of [...d.attributes]) if (a.name.startsWith('data-')) d.removeAttribute(a.name);
    for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v);
    const s = document.getElementById('sentinel'); s.innerHTML = '';
    let host = s;
    for (const n of nest || []) { const e = document.createElement('div'); for (const [k, v] of Object.entries(n)) e.setAttribute(k, v); host.appendChild(e); host = e; }
    const p = document.createElement('div'); host.appendChild(p);
    const out = {}, cs = getComputedStyle(p);
    for (const n of colours) { p.style.color = ''; p.style.color = `var(--${n})`; const v = cs.color; out[n] = v === 'rgb(1, 2, 3)' ? 'INVALID' : v; }
    for (const n of raw) out['raw:' + n] = cs.getPropertyValue('--' + n).trim();
    return out;
  });
  window.__resolve = (list) => { let p = document.getElementById('rprobe'); if (!p) { p = document.createElement('div'); p.id = 'rprobe'; document.body.appendChild(p); } return list.map(v => { p.style.color = ''; p.style.color = v; return getComputedStyle(p).color; }); };
}

const same = (a, b) => { if (a === b) return true; if (!a || !b || a === 'INVALID' || b === 'INVALID') return false; const x = parse(a), y = parse(b); return ['r', 'g', 'b'].every(k => Math.abs(x[k] - y[k]) <= 0.6 / 255) && Math.abs(x.a - y.a) <= 0.004; };
const pickupOf = s => { const i = s.indexOf('color-mix('); if (i < 0) return null; let d = 0, k = i; for (; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')' && --d === 0) break; } return s.slice(i, k + 1); };

async function runEngine(name, launcher, opts) {
  const R = { engine: name };
  const browser = await launcher.launch(opts);
  try {
    R.version = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let blocked = 0;
    await context.route('**/*', r => { const u = r.request().url(); if (u.startsWith('data:') || u === 'about:blank') return r.continue(); blocked++; return r.abort(); });
    const page = await context.newPage();
    await page.setContent(PAGE);
    await page.evaluate(reader);
    const read = jobs => page.evaluate(j => window.__read(j), jobs);
    const resolve = list => page.evaluate(l => window.__resolve(l), list);
    const col = (o, n) => { const v = o[n]; if (v == null || v === 'INVALID') throw new Error(`${name}: --${n} ${v}`); return parse(v); };
    let cdp = null; if (name === 'chromium') cdp = await context.newCDPSession(page);
    const setMedia = async (m) => {
      await page.emulateMedia({ contrast: m?.contrast || 'no-preference', reducedMotion: m?.reducedMotion || 'no-preference' });
      if (cdp) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: m?.rt || 'no-preference' }] }).catch(() => {});
    };
    await setMedia(null);
    const cache = {};   // ctxKey → resolved map (adult root contexts reused for distinctness and nesting)

    // ── 1. the role-pair matrix, 18 families x 6 palettes x 8 modes, through the root data-accent ─────────────────────
    R.values = 0;
    for (const [mode, [mattrs, media, hi]] of Object.entries(MODES)) {
      await setMedia(media);
      if (media) R.mediaEmulated = { ...(R.mediaEmulated || {}), [mode]: await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches) };
      const T = hi ? 7 : 4.5;
      for (const [theme, scheme] of Object.entries(PALETTES)) {
        const jobs = FAMS.map(f => ({ attrs: { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': f, ...mattrs }, colours: COLOURS, raw: RAW }));
        const res = await read(jobs);
        res.forEach((o, i) => {
          const f = FAMS[i]; const ctx = `${theme}/${mode}/${f}`; cache[ctx] = o; R.values += Object.keys(o).length;
          const c = n => col(o, n);
          // re-derivation: every --accent-* equals the family's own role
          for (const r of ROLES) check('accent re-derives: --accent-' + r + ' === --' + f + '-' + r, o['accent-' + r] === o[`${f}-${r}`] ? 1 : 0, 1, ctx);
          // family pairs (the family's own tokens, checked once per root; the accent is irrelevant to them)
          const F = r => c(`${f}-${r}`);
          const kind = APPS.includes(f) ? 'app' : 'person';
          for (const b of ['wash', 'fill']) check(`${kind}: ink on its ${b}`, contrast(F('ink'), F(b)), T, ctx);
          for (const b of OPAQUE) check(`${kind}: ink on opaque surfaces`, contrast(F('ink'), c(b)), T, `${ctx}/${b}`);
          check(`${kind}: ink-hi on its fill`, contrast(F('ink-hi'), F('fill')), 7, ctx);
          for (const b of OPAQUE) check(`${kind}: ink-hi on opaque surfaces`, contrast(F('ink-hi'), c(b)), 7, `${ctx}/${b}`);
          check(`${kind}: tile glyph (ink) on fill-strong`, contrast(F('ink'), F('fill-strong')), 3, ctx);
          check(`${kind}: tile glyph (ink) on fill`, contrast(F('ink'), F('fill')), 3, ctx);
          check(`${kind}: on label on strong`, contrast(F('on'), F('strong')), T, ctx);
          for (const b of OPAQUE) check(`${kind}: strong as text on opaque surfaces`, contrast(F('strong'), c(b)), T, `${ctx}/${b}`);
          for (const b of OPAQUE) check(`${kind}: graphic on opaque surfaces`, contrast(F('graphic'), c(b)), 3, `${ctx}/${b}`);
          check(`${kind}: strong (progress) on its fill`, contrast(F('strong'), F('fill')), 3, ctx);
          if (scheme === 'dark') check(`${kind}: dark fill off the card (>= 1.5)`, contrast(F('fill'), c('surface')), 1.5, ctx);
          // 7:1 swaps
          if (hi) {
            check(`${kind}: 7:1 mode swaps ink -> ink-hi`, o[`${f}-ink`] === o[`${f}-ink-hi`] ? 1 : 0, 1, ctx);
            if (scheme === 'light') check(`${kind}: 7:1 mode swaps strong -> ink-hi (light)`, o[`${f}-strong`] === o[`${f}-ink-hi`] ? 1 : 0, 1, ctx);
          } else {
            check(`${kind}: no swap outside the 7:1 modes`, o[`${f}-ink`] !== o[`${f}-ink-hi`] ? 1 : 0, 1, ctx);
          }
          // neutrals and the dark --text-3 lift (revision 6b): once per palette x mode
          if (f === "graphite") {
            const N = n => c(n);
            for (const b of OPAQUE) {
              check("neutral: text on opaque >= 7", contrast(N("text"), N(b)), 7, `${ctx}/${b}`);
              check("neutral: text-2 on opaque >= T", contrast(N("text-2"), N(b)), T, `${ctx}/${b}`);
              check("neutral: text-3 on opaque >= T", contrast(N("text-3"), N(b)), T, `${ctx}/${b}`);
              if (!hi) check("neutral: hierarchy text > text-2 > text-3 (contrast on every opaque ground)", contrast(N("text"), N(b)) > contrast(N("text-2"), N(b)) && contrast(N("text-2"), N(b)) > contrast(N("text-3"), N(b)) ? 1 : 0, 1, `${ctx}/${b}`);
              if (!hi) { const k = `text-2 vs text-3 contrast step on ${b} (${scheme})`; const v = contrast(N("text-2"), N(b)) / contrast(N("text-3"), N(b)); const M = (R.hierarchy ??= {}); if (!M[k] || v < M[k].v) M[k] = { v: floor(v, 3), at: ctx, dE: floor(de2000(N("text-2"), N("text-3")), 1) }; }
            }
            check("neutral: placeholder and --muted are text-3", same(o.placeholder, o["text-3"]) && same(o.muted, o["text-3"]) ? 1 : 0, 1, ctx);
            if (mode === "adult") (R.text3 ??= {})[theme] = { "text-3": hex(N("text-3")), "text-2": hex(N("text-2")), onBg: floor(contrast(N("text-3"), N("bg"))), onSurface: floor(contrast(N("text-3"), N("surface"))), onSurface2: floor(contrast(N("text-3"), N("surface-2"))), onFillField: floor(contrast(N("text-3"), N("fill-field"))), dE_text2: floor(de2000(N("text-2"), N("text-3")), 1) };
          }
          // accent-context roles
          const A = n => c(n);
          for (const b of ['accent-wash', 'accent-fill', ...OPAQUE]) check(`${kind} accent: accent-ink on ${b.startsWith('accent') ? b : 'opaque'}`, contrast(A('accent-ink'), A(b)), T, `${ctx}/${b}`);
          check(`${kind} accent: hero button label (hero-btn-ink on hero-btn-bg)`, contrast(A('hero-btn-ink'), A('hero-btn-bg')), T, ctx);
          const edge = Math.min(contrast(A('hero-btn-bg'), A('accent-wash')), contrast(A('hero-btn-bg'), A('accent-fill')));
          if (scheme === 'dark') check(`${kind} accent: dark hero capsule edge vs both hero stops`, edge, 3, ctx);
          (R.heroEdge ??= {})[`${scheme}${hi ? ' 7:1' : ''}`] = Math.min(R.heroEdge[`${scheme}${hi ? ' 7:1' : ''}`] ?? Infinity, edge);
          (R.heroLabel ??= {})[`${scheme}${hi ? ' 7:1' : ''}`] = Math.min(R.heroLabel[`${scheme}${hi ? ' 7:1' : ''}`] ?? Infinity, contrast(A('hero-btn-ink'), A('hero-btn-bg')));
          if (scheme === 'dark' && mode === 'adult') check(`${kind} accent: dark hero bg is --accent-strong, label --accent-on`, same(o['hero-btn-bg'], o['accent-strong']) && same(o['hero-btn-ink'], o['accent-on']) ? 1 : 0, 1, ctx);
          if (scheme === 'light' && mode === 'adult') check(`${kind} accent: light hero bg is white, label --accent-ink`, hex(A('hero-btn-bg')) === '#FFFFFF' && same(o['hero-btn-ink'], o['accent-ink']) ? 1 : 0, 1, ctx);
          check(`${kind} accent: selected pill (sel-ink on sel-fill)`, contrast(A('sel-ink'), A('sel-fill')), T, ctx);
          check(`${kind} accent: segmented selection (sel-ink-strong on sel-fill-strong)`, contrast(A('sel-ink-strong'), A('sel-fill-strong')), T, ctx);
          for (const b of OPAQUE) check(`${kind} accent: focus ring / today ring on opaque`, contrast(A('focus-ring-color'), A(b)), 3, `${ctx}/${b}`);
          check(`${kind} accent: progress fill on its track`, contrast(A('progress-fill'), A('progress-track')), 3, ctx);
          for (const b of OPAQUE) check(`${kind} accent: legacy --accent as text on opaque`, contrast(A('accent'), A(b)), T, `${ctx}/${b}`);
          check(`${kind} accent: tile glyph (accent-ink) on both tile stops`, Math.min(contrast(A('accent-ink'), A('accent-fill')), contrast(A('accent-ink'), A('accent-fill-strong'))), 3, ctx);
          check(`${kind} accent: timer-done is the owner's strong`, o['timer-done'] === o['accent-strong'] ? 1 : 0, 1, ctx);
        });
      }
    }
    await setMedia(null);

    // ── 2. nested scopes: an app data-accent inside another person's page, a kid page, the kiosk, and a theme preview ──
    R.nested = { checked: 0, bad: [] };
    for (const [theme, scheme] of Object.entries(PALETTES)) for (const mode of ['adult', 'kid', 'kiosk', 'contrast-more']) {
      const jobs = FAMS.map(f => ({ attrs: { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': 'periwinkle', ...MODES[mode][0] }, nest: [{ 'data-accent': f }], colours: [...ACC, ...DERIVED], raw: ['glass-pickup-layer'] }));
      const res = await read(jobs);
      res.forEach((o, i) => {
        const f = FAMS[i], ref = cache[`${theme}/${mode}/${f}`];
        for (const n of [...ACC, ...NESTED]) { R.nested.checked++; if (!same(o[n], ref[n])) R.nested.bad.push({ ctx: `${theme}/${mode}/periwinkle>${f}`, token: n, nested: o[n], root: ref[n] }); }
        if (f !== 'periwinkle' && same(o['timer-done'], ref['timer-done'])) R.nested.timerDoneFollowsTile = (R.nested.timerDoneFollowsTile || 0) + 1; else if (f !== 'periwinkle') R.nested.timerDoneKeepsPage = (R.nested.timerDoneKeepsPage || 0) + 1;
        check('nested data-accent re-derives every accent role like a root', ACC.concat(NESTED).every(n => same(o[n], ref[n])) ? 1 : 0, 1, `${theme}/${mode}/periwinkle>${f}`);
      });
    }
    // a Me swatch: [data-theme-preview][data-scheme][data-accent] inside a root of the OTHER scheme and in the kiosk: adult values of its palette
    for (const [theme, scheme] of Object.entries(PALETTES)) for (const [rootTheme, rootScheme] of [['hearth', 'light'], ['graphite', 'dark']]) for (const rootKind of ['adult', 'kiosk']) {
      const jobs = FAMS.map(f => ({ attrs: { 'data-theme': rootTheme, 'data-scheme': rootScheme, 'data-accent': 'peach', 'data-kind': rootKind }, nest: [{ 'data-theme-preview': theme, 'data-scheme': scheme, 'data-accent': f }], colours: [...ACC, ...DERIVED.filter(d => d !== 'glass-halo'), 'surface', 'bg'], raw: [] }));
      const res = await read(jobs);
      res.forEach((o, i) => {
        const f = FAMS[i], ref = cache[`${theme}/adult/${f}`];
        const bad = [...ACC, ...DERIVED.filter(d => d !== 'glass-halo'), 'surface', 'bg'].filter(n => !same(o[n], ref[n]));
        check('theme preview (swatch) with an app/person data-accent shows its palette\'s adult values', bad.length ? 0 : 1, 1, `${rootTheme}/${rootKind} > preview ${theme}/${f}${bad.length ? ' differs: ' + bad.join(',') : ''}`);
      });
    }

    // ── 3. glass levels: model with and without the halo, from engine-resolved layers ─────────────────────────────
    R.glass = {};
    const worstOf = s => parse(s === 'light' ? '#000000' : '#FFFFFF');
    for (const level of ['frosted', 'current', 'clear']) for (const kind of ['adult', 'kid', 'kiosk']) for (const [theme, scheme] of Object.entries(PALETTES)) {
      const jobs = FAMS.map(f => ({ attrs: { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': f, 'data-kind': kind, ...(level === 'frosted' ? {} : { 'data-glass': level, 'data-transparency': 'full' }) }, colours: ['text', 'text-2', 'text-3', 'accent-ink', ...OPAQUE, ...GLASS], raw: RAW }));
      const res = await read(jobs);
      const picks = await resolve(res.map(o => pickupOf(o['raw:glass-pickup-layer']) || 'transparent'));
      res.forEach((o, i) => {
        const f = FAMS[i], ctxb = `${level}/${kind}/${theme}/${f}`, c = n => col(o, n), pick = parse(picks[i]);
        const hi = kind === 'kiosk';
        const halo = c('glass-halo');
        const K = (R.glass[`${level}/${scheme}${kind === 'adult' ? '' : '/' + kind}`] ??= { alpha: o['raw:glass-alpha'], alphaStrong: o['raw:glass-alpha-strong'], halo: o['raw:glass-halo-alpha'] });
        const backs = { page: c('bg'), card: c('surface'), mid: parse('#767676'), worst: worstOf(scheme) };
        for (const [bn, b] of Object.entries(backs)) for (const g of ['glass', 'glass-strong']) {
          const grounds = { plain: over(c(g), b), sheen: over(c('glass-spec'), over(c(g), b)), 'sheen+pickup': over(c('glass-spec'), over(pick, over(c(g), b))) };
          for (const [gn, gr] of Object.entries(grounds)) {
            const wh = over(halo, gr), ctx = `${ctxb}/${g} over ${bn} (${gn})`;
            const pairs = [['text', 7], ['text-2', hi ? 7 : 4.5], ['text-3', hi ? 7 : 4.5], ['accent-ink', 4.5]];
            for (const [t, thr] of pairs) {
              if (t === 'accent-ink' && g !== 'glass-strong') continue;
              const vH = contrast(c(t), wh), v0 = contrast(c(t), gr);
              const claimed = level !== 'frosted' && (bn !== 'worst' || t === 'text' || t === 'text-2');
              // frosted (the palettes' own alpha) as revision 5 gated it: plain over every backdrop (text-3 not over the worst),
              // the sheen on glass-strong everywhere and on glass away from the worst backdrop; the tab ink is reported only
              const frostedGate = level === 'frosted' && t !== 'accent-ink' && (gn === 'plain' ? (bn !== 'worst' || t !== 'text-3') : gn === 'sheen' ? (t !== 'text-3' && (bn !== 'worst' || g === 'glass-strong')) : false);
              if (level === 'frosted' && t === 'text-3' && gn !== 'plain' && bn !== 'worst') { const kk = 'frosted text-3 under the sheen' + (gn === 'sheen+pickup' ? ' and pickup' : '') + ' (not gated in rev 5; reported)'; const M = (R.frostedText3 ??= {}); if (!M[kk] || v0 < M[kk].v) M[kk] = { v: floor(v0), at: ctx }; }
              if (claimed) check(`glass ${level}: ${t} with the halo (model)`, vH, thr, ctx);
              if (frostedGate) check(`glass frosted: ${t}`, v0, thr, ctx);
              if (t === 'text-3' && g === 'glass-strong' && gn === 'sheen+pickup' && bn !== 'worst' && kind !== 'kiosk') { if (level === 'frosted') check(`glass frosted: text-3 on glass-strong under the full sheen and pickup (6b gate)`, v0, 4.5, ctx); const M = (R.text3Sheet ??= {}); const kk = `${level} ${scheme}`; if (!M[kk] || v0 < M[kk].v) M[kk] = { v: floor(v0), at: ctx }; }
              const k1 = `${t} ${g} over ${bn}`;
              K[k1 + ' (halo model)'] = floor(Math.min(K[k1 + ' (halo model)'] ?? Infinity, vH));
              K[k1 + ' (no halo)'] = floor(Math.min(K[k1 + ' (no halo)'] ?? Infinity, v0));
            }
          }
        }
      });
    }

    // ── 4. cascade order: glass level vs Increase Contrast vs Reduce Transparency, attribute and media ─────────────
    R.cascade = {};
    const one = async (attrs, media) => { await setMedia(media); const [o] = await read([{ attrs: { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'sky', ...attrs }, colours: ['glass', 'glass-strong', 'glass-solid', 'glass-strong-solid', 'glass-look', 'glass-halo', 'surface'], raw: RAW }]); await setMedia(null); return o; };
    const rtEmul = async () => { if (!cdp) return false; await setMedia({ rt: 'reduce' }); const m = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches); await setMedia(null); return m; };
    R.cascade.reducedTransparencyEmulated = await rtEmul();
    const alphaOf = o => parse(o.glass).a;
    const cases = [
      ['clear alone (40/48, halo 70, outline 100)', { 'data-glass': 'clear', 'data-transparency': 'full' }, null, o => o['raw:glass-alpha'] === '40%' && o['raw:glass-alpha-strong'] === '48%' && o['raw:glass-halo-alpha'] === '70%' && o['raw:glass-halo-edge-alpha'] === '100%' && Math.abs(alphaOf(o) - 0.4) < 0.01],
      ['current alone', { 'data-glass': 'current', 'data-transparency': 'full' }, null, o => o['raw:glass-alpha'] === '64%' && o['raw:glass-alpha-strong'] === '84%' && o['raw:glass-halo-alpha'] === '60%' && o['raw:glass-halo-edge-alpha'] === '100%'],
      ['frosted (no attribute) = palette alpha, no halo', {}, null, o => o['raw:glass-alpha'] === '78%' && o['raw:glass-halo-alpha'] === '0%' && parse(o['glass-halo']).a === 0],
      ['frosted (explicit attribute) = no attribute', { 'data-glass': 'frosted', 'data-transparency': 'full' }, null, o => o['raw:glass-alpha'] === '78%' && o['raw:glass-halo-alpha'] === '0%'],
      ['clear + data-contrast=more -> 96/98', { 'data-glass': 'clear', 'data-transparency': 'full', 'data-contrast': 'more' }, null, o => o['raw:glass-alpha'] === '96%' && o['raw:glass-alpha-strong'] === '98%'],
      ['clear + prefers-contrast more (media) -> 96/98', { 'data-glass': 'clear', 'data-transparency': 'full' }, { contrast: 'more' }, o => o['raw:glass-alpha'] === '96%'],
      ['clear + prefers-contrast more + data-contrast=standard -> stays clear', { 'data-glass': 'clear', 'data-transparency': 'full', 'data-contrast': 'standard' }, { contrast: 'more' }, o => o['raw:glass-alpha'] === '40%'],
      ['clear + data-transparency=reduce -> solid', { 'data-glass': 'clear', 'data-transparency': 'reduce' }, null, o => same(o.glass, o['glass-solid']) && alphaOf(o) === 1 && o['raw:blur'] === '0px'],
      ['kiosk + clear -> the look (glass-look), no live filter', { 'data-kind': 'kiosk', 'data-glass': 'clear', 'data-transparency': 'full' }, null, o => same(o.glass, o['glass-look']) && o['raw:glass-filter'] === 'none'],
      ['kiosk + clear: halo alpha on the TV (report)', { 'data-kind': 'kiosk', 'data-glass': 'clear', 'data-transparency': 'full' }, null, o => true],
    ];
    if (R.cascade.reducedTransparencyEmulated) cases.push(
      ['OS Reduce Transparency (media), no choice -> solid, blur 0', {}, { rt: 'reduce' }, o => same(o.glass, o['glass-solid']) && o['raw:blur'] === '0px' && o['raw:blur-lg'] === '0px' && o['raw:blur-sm'] === '0px'],
      ['OS Reduce Transparency (media) + explicit clear (bootstrap writes full) -> clear wins over the OS', { 'data-glass': 'clear', 'data-transparency': 'full' }, { rt: 'reduce' }, o => Math.abs(alphaOf(o) - 0.4) < 0.01],
      ['OS Reduce Transparency (media) + explicit FROSTED (bootstrap writes full) -> OS setting lost (report)', { 'data-glass': 'frosted', 'data-transparency': 'full' }, { rt: 'reduce' }, o => same(o.glass, o['glass-solid'])],
      ['OS Reduce Transparency (media) on the kiosk with no choice -> solid', { 'data-kind': 'kiosk' }, { rt: 'reduce' }, o => same(o.glass, o['glass-solid'])],
      ['OS Reduce Transparency (media) on the kiosk after a glass choice (full) -> solid? (report)', { 'data-kind': 'kiosk', 'data-glass': 'current', 'data-transparency': 'full' }, { rt: 'reduce' }, o => same(o.glass, o['glass-solid'])],
    );
    for (const [n, a, m, ok] of cases) { const o = await one(a, m); const pass = !!ok(o); R.cascade[n] = { pass, glass: o.glass, alpha: o['raw:glass-alpha'], alphaStrong: o['raw:glass-alpha-strong'], halo: o['raw:glass-halo-alpha'], blur: o['raw:blur'], filter: o['raw:glass-filter'] }; if (!n.includes('(report)')) check('cascade: ' + n, pass ? 1 : 0, 1, name); }

    // ── 5. blur and crossfade tokens ───────────────────────────────────────────────────────────────────────────────
    R.tokens = {};
    const tok = async (label, attrs, media) => { const o = await one(attrs, media); R.tokens[label] = { blur: o['raw:blur'], blurSm: o['raw:blur-sm'], blurLg: o['raw:blur-lg'], filter: o['raw:glass-filter'], crossfade: o['raw:dur-crossfade'] }; return R.tokens[label]; };
    let t;
    t = await tok('adult', {}); check('tokens: adult blur 20/8/32, crossfade 2500ms', t.blur === '20px' && t.blurSm === '8px' && t.blurLg === '32px' && t.crossfade === '2500ms' ? 1 : 0, 1, name);
    t = await tok('reduce-transparency (attr)', { 'data-transparency': 'reduce' }); check('tokens: RT attr blur 0', t.blur === '0px' && t.blurSm === '0px' && t.blurLg === '0px' && t.filter === 'none' ? 1 : 0, 1, name);
    t = await tok('kiosk', { 'data-kind': 'kiosk' }); check('tokens: kiosk blur 0', t.blur === '0px' && t.blurSm === '0px' && t.blurLg === '0px' && t.filter === 'none' ? 1 : 0, 1, name);
    t = await tok('kiosk + transparency full', { 'data-kind': 'kiosk', 'data-transparency': 'full' }); check('tokens: kiosk blur 0 even with data-transparency=full', t.blur === '0px' ? 1 : 0, 1, name);
    if (R.cascade.reducedTransparencyEmulated) { t = await tok('reduce-transparency (media)', {}, { rt: 'reduce' }); check('tokens: RT media blur 0', t.blur === '0px' && t.blurSm === '0px' && t.blurLg === '0px' ? 1 : 0, 1, name); }
    t = await tok('motion reduce (attr)', { 'data-motion': 'reduce' }); check('tokens: reduce motion attr crossfade 150ms', t.crossfade === '150ms' ? 1 : 0, 1, name);
    t = await tok('motion reduce (attr) kiosk', { 'data-motion': 'reduce', 'data-kind': 'kiosk' }); check('tokens: reduce motion attr on the kiosk crossfade 150ms', t.crossfade === '150ms' ? 1 : 0, 1, name);
    t = await tok('motion reduce (media) kiosk', { 'data-kind': 'kiosk' }, { reducedMotion: 'reduce' }); check('tokens: reduce motion media on the kiosk crossfade 150ms', t.crossfade === '150ms' ? 1 : 0, 1, name);
    t = await tok('motion reduce (media) + data-motion=full', { 'data-motion': 'full', 'data-kind': 'kiosk' }, { reducedMotion: 'reduce' }); check('tokens: data-motion=full opts out (2500ms)', t.crossfade === '2500ms' ? 1 : 0, 1, name);

    // ── 6. the bootstrap, run in this real page with a stubbed localStorage / matchMedia ──────────────────────────
    R.bootstrap = [];
    const bootCase = async (label, store, dark, expect) => {
      const got = await page.evaluate(({ BOOT, store, dark }) => {
        const d = document.documentElement;
        for (const a of [...d.attributes]) if (a.name.startsWith('data-')) d.removeAttribute(a.name);
        d.style.colorScheme = '';
        const ls = { getItem: k => (k in store ? store[k] : null) };
        const mm = q => ({ matches: dark && /prefers-color-scheme: dark/.test(q) });
        new Function('localStorage', 'matchMedia', BOOT)(ls, mm);
        const o = {}; for (const a of d.attributes) o[a.name] = a.value;
        o.metas = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.getAttribute('content'));
        return o;
      }, { BOOT, store: Object.fromEntries(Object.entries(store).map(([k, v]) => [k, JSON.stringify(v)])), dark });
      const bad = Object.entries(expect).filter(([k, v]) => (v === undefined ? got[k] !== undefined : got[k] !== v));
      R.bootstrap.push({ label, got, expect, pass: !bad.length });
      if (!label.includes('(report)')) check('bootstrap: ' + label, bad.length ? 0 : 1, 1, name + (bad.length ? ' ' + JSON.stringify(bad) : ''));
      return got;
    };
    const sess = (color, extra = {}) => ({ profile: { id: 'x', kind: 'adult', color, ...extra } });
    const D3 = { '#4F5D8C': 'periwinkle', '#BC5A38': 'peach', '#8A6A4B': 'bubblegum', '#3D5A3D': 'mint', '#5B8143': 'butter', '#137F77': 'aqua', '#B4861B': 'lavender', '#4C4C58': 'graphite' };
    const who = { '#4F5D8C': 'Eli', '#BC5A38': 'Mae', '#8A6A4B': 'Elizabeth', '#3D5A3D': 'David', '#5B8143': 'Mea', '#137F77': 'Ezra', '#B4861B': 'Kiara', '#4C4C58': 'TV' };
    for (const [c, h] of Object.entries(D3)) await bootCase(`${who[c]} (${c}) -> ${h}`, { 'hub.session': sess(c, { kind: who[c] === 'TV' ? 'kiosk' : ['Ezra', 'Kiara'].includes(who[c]) ? 'kid' : 'adult' }) }, false, { 'data-accent': h });
    await bootCase('guest swatch #8C4F7A -> sky', { 'hub.session': sess('#8C4F7A', { is_guest: true }) }, false, { 'data-accent': 'sky' });
    await bootCase('guest swatch #4C7B6A -> sky', { 'hub.session': sess('#4C7B6A', { is_guest: true }) }, false, { 'data-accent': 'sky' });
    await bootCase('guest made with the Add-a-guest sheet default colour (SWATCHES[2] #137F77), no hue -> sky', { 'hub.session': sess('#137F77', { is_guest: true, hue: null }) }, false, { 'data-accent': 'sky' });
    await bootCase('guest made through the API with no colour (worker default #8A6A4B), no hue -> sky', { 'hub.session': sess('#8A6A4B', { is_guest: true, hue: null }) }, false, { 'data-accent': 'sky' });
    await bootCase('lowercase hex #bc5a38 -> peach', { 'hub.session': sess('#bc5a38') }, false, { 'data-accent': 'peach' });
    await bootCase('unknown hex -> graphite', { 'hub.session': sess('#123456') }, false, { 'data-accent': 'graphite' });
    await bootCase('stored hue wins over the hex', { 'hub.session': sess('#BC5A38', { hue: 'coral' }) }, false, { 'data-accent': 'coral' });
    await bootCase('glass clear -> data-glass=clear + data-transparency=full', { 'hub.prefs': { glass: 'clear' } }, false, { 'data-glass': 'clear', 'data-transparency': 'full' });
    await bootCase('glass current -> data-glass=current + full', { 'hub.prefs': { glass: 'current' } }, false, { 'data-glass': 'current', 'data-transparency': 'full' });
    await bootCase('glass frosted (explicit) -> data-glass=frosted + full', { 'hub.prefs': { glass: 'frosted' } }, false, { 'data-glass': 'frosted', 'data-transparency': 'full' });
    await bootCase('glass solid -> data-transparency=reduce, no data-glass', { 'hub.prefs': { glass: 'solid' } }, false, { 'data-transparency': 'reduce', 'data-glass': undefined });
    await bootCase('no glass pref -> neither attribute (follows the OS)', { 'hub.prefs': {} }, false, { 'data-transparency': undefined, 'data-glass': undefined });
    await bootCase('glass solid + stale transparency full -> reduce', { 'hub.prefs': { glass: 'solid', transparency: 'full' } }, false, { 'data-transparency': 'reduce' });
    await bootCase('glass clear + transparency reduce (both stored) -> glass wins (documented)', { 'hub.prefs': { glass: 'clear', transparency: 'reduce' } }, false, { 'data-glass': 'clear', 'data-transparency': 'full' });
    await bootCase('guest with a stored household hue (peach) -> still sky', { 'hub.session': sess('#BC5A38', { is_guest: true, hue: 'peach' }) }, false, { 'data-accent': 'sky' });
    await bootCase('guest flag as 1 (SQLite integer) -> sky', { 'hub.session': sess('#137F77', { is_guest: 1 }) }, false, { 'data-accent': 'sky' });
    await bootCase('household adult with is_guest false -> own colour', { 'hub.session': sess('#BC5A38', { is_guest: false }) }, false, { 'data-accent': 'peach' });
    await bootCase('kiosk session + glass solid -> ignored (no reduce written)', { 'hub.session': sess('#4C4C58', { kind: 'kiosk' }), 'hub.prefs': { glass: 'solid' } }, false, { 'data-glass': undefined, 'data-transparency': undefined });
    await bootCase('kiosk session + an OLD transparency:full row -> OS Reduce Transparency still applies? (report)', { 'hub.session': sess('#4C4C58', { kind: 'kiosk' }), 'hub.prefs': { transparency: 'full', glass: 'current' } }, false, { 'data-transparency': undefined });
    await bootCase('TV device before sign-in (no session) + glass current -> data-glass written (report)', { 'hub.prefs': { glass: 'current' } }, false, { 'data-glass': undefined, 'data-transparency': undefined });
    await bootCase('kiosk session + glass current -> ignored on the TV', { 'hub.session': sess('#4C4C58', { kind: 'kiosk' }), 'hub.prefs': { glass: 'current' } }, false, { 'data-glass': undefined });
    await bootCase('Mae + glass clear + midnight', { 'hub.session': sess('#BC5A38'), 'hub.theme': 'midnight', 'hub.prefs': { glass: 'clear' } }, false, { 'data-accent': 'peach', 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-glass': 'clear', 'data-transparency': 'full' });
    await bootCase('Kiara + system at night -> midnight, lavender, kid', { 'hub.session': sess('#B4861B', { kind: 'kid' }), 'hub.theme': 'system' }, true, { 'data-accent': 'lavender', 'data-theme': 'midnight', 'data-kind': 'kid' });
    // feed the Mae/Clear/Midnight bootstrap result back through the cascade
    {
      const got = R.bootstrap.find(b => b.label.startsWith('Mae + glass clear')).got;
      const attrs = Object.fromEntries(Object.entries(got).filter(([k]) => k.startsWith('data-')));
      const [o] = await read([{ attrs, colours: ['accent-fill', 'peach-fill', 'glass'], raw: ['glass-alpha', 'glass-halo-alpha'] }]);
      R.bootstrapFedBack = o;
      check('bootstrap -> cascade: Mae/Clear/Midnight paints peach at 40 % with the 70 % glow', o['accent-fill'] === o['peach-fill'] && o['raw:glass-alpha'] === '40%' && o['raw:glass-halo-alpha'] === '70%' ? 1 : 0, 1, name);
    }
    // restore the page head (the bootstrap rewrote the meta)
    await page.setContent(PAGE); await page.evaluate(reader);

    // ── 7 (round 2). the outline halo AS RENDERED, my ring method, both engines ─────────────────────────────────────
    // Pane with the FULL recipe (--glass-bg(-strong)-tinted: sheen + pickup + fill) and the live --glass-filter over a backdrop;
    // text at the top centre (the pickup's centre, under the sheen). Three renders with identical layout: the mask (black glyphs on
    // white, no shadow), the halo field (transparent glyphs WITH the shadow) and the plain field (no shadow). Ring = device pixels
    // 0.5-1.5 CSS px from the glyph core (coverage > 0.5) and outside the glyph (coverage < 0.02); ring2 = 1.5-3 CSS px (outside the
    // 1 px outline, inside the glow). Contrast of the text colour against each ring pixel of the halo field.
    R.haloRendered = [];
    const BACKDROPS = { page: 'var(--bg)', card: 'var(--surface)', mid: '#767676', worst: null,
      edge: 'linear-gradient(90deg, #000 0 50%, #FFF 50% 100%)', stripes: 'repeating-linear-gradient(90deg, #000 0 3px, #FFF 3px 6px)' };
    const haloCtxs = {};
    const haloPage = async dsf => {
      if (haloCtxs[dsf]) return haloCtxs[dsf];
      const hc = await browser.newContext({ viewport: { width: 700, height: 200 }, deviceScaleFactor: dsf });
      await hc.route('**/*', r => { const u = r.request().url(); if (u.startsWith('data:') || u === 'about:blank') return r.continue(); blocked++; return r.abort(); });
      return (haloCtxs[dsf] = { hc, hp: await hc.newPage() });
    };
    const q_ = (a, p) => { const s = [...a].sort((u, v) => u - v); return s.length ? floor(s[Math.floor(p * (s.length - 1))]) : null; };
    const renderHalo = async ({ theme, scheme, level, g, tn, size = 15, weight = 400, bk, dsf = 2, kind = 'adult', accent = 'sky', icon = false, crop = null }) => {
      const { hp } = await haloPage(dsf);
      const back = bk === 'worst' ? (scheme === 'light' ? '#000000' : '#FFFFFF') : BACKDROPS[bk];
      const glassAttr = level === 'frosted' ? '' : `data-glass="${level}" data-transparency="full"`;
      const bg = g === 'glass-strong' ? 'var(--glass-bg-strong-tinted)' : 'var(--glass-bg-tinted)';
      const html = variant => `<!doctype html><html data-theme="${theme}" data-scheme="${scheme}" data-accent="${accent}" data-kind="${kind}" ${glassAttr}><head><style>${css}
        body{margin:0;background:var(--bg)} #b{position:absolute;left:0;top:0;width:700px;height:200px;background:${back}}
        #g{position:absolute;left:30px;top:20px;width:640px;height:140px;border-radius:0;
           ${variant === 'mask' ? 'background:#FFFFFF' : `background:${bg};-webkit-backdrop-filter:var(--glass-filter);backdrop-filter:var(--glass-filter)`}}
        #t{position:absolute;left:0;right:0;top:10px;text-align:center;font-family:var(--font-ui);font-size:${size}px;font-weight:${weight};line-height:1.3;white-space:nowrap;
           color:${variant === 'halo' ? 'transparent' : variant === 'mask' ? '#000000' : `var(--${tn})`};
           text-shadow:${variant === 'mask' || variant === 'plain' ? 'none' : 'var(--glass-text-shadow)'}}
        #t svg{width:${Math.round(size * 1.4)}px;height:${Math.round(size * 1.4)}px;vertical-align:middle;fill:none;stroke:${variant === 'mask' ? '#000' : variant === 'halo' ? 'transparent' : 'currentColor'};stroke-width:1.75}
        </style></head><body><div id="b"></div><div id="g"><div id="t">${icon ? '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/></svg><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>' : 'Hamburgefonstiv 0123456789 wear sky'}</div></div></body></html>`;
      const clip = { x: 30, y: 20, width: 640, height: 60 };
      const shot = async v => { await hp.setContent(html(v)); return decodePng(await hp.screenshot({ clip })); };
      const mask = await shot('mask'), halo = await shot('halo'), plain = await shot('plain');
      await hp.setContent(html('real'));
      const tcol = await hp.evaluate(n => { const p = document.createElement('div'); document.body.appendChild(p); p.style.color = `var(--${n})`; return getComputedStyle(p).color; }, tn);
      if (crop) fs.writeFileSync(path.join(OUTDIR, `${crop}-${name}-r2.png`), await hp.screenshot({ clip: { x: 130, y: 22, width: 440, height: Math.round(size * 1.3) + 16 } }));
      const W = mask.w, Hh = mask.h, cov = new Float32Array(W * Hh);
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const p = mask.px(x, y); cov[y * W + x] = 1 - (p.r + p.g + p.b) / 3; }
      const dist = new Int16Array(W * Hh).fill(99); const qq = [];
      for (let i = 0; i < W * Hh; i++) if (cov[i] > 0.5) { dist[i] = 0; qq.push(i); }
      for (let qi = 0; qi < qq.length; qi++) { const i = qq[qi], x = i % W, y = (i / W) | 0; if (dist[i] >= 20) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const j = Y * W + X; if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; qq.push(j); } } }
      const r1 = [Math.max(1, Math.round(0.5 * dsf)), Math.max(1, Math.floor(1.5 * dsf))], r2 = [Math.floor(1.5 * dsf) + 1, 3 * dsf];
      const tc = parse(tcol); const ring = [], ringNo = [], ring2 = [], ringIn = [];
      for (let i = 0; i < W * Hh; i++) { if (cov[i] > 0.02) continue; const x = i % W, y = (i / W) | 0;
        if (dist[i] >= 1 && dist[i] <= dsf) ringIn.push(contrast(tc, halo.px(x, y)));   // within 1 CSS px of the core: the outline's own width
        if (dist[i] >= r1[0] && dist[i] <= r1[1]) { ring.push(contrast(tc, halo.px(x, y))); ringNo.push(contrast(tc, plain.px(x, y))); }
        else if (dist[i] >= r2[0] && dist[i] <= r2[1]) ring2.push(contrast(tc, halo.px(x, y))); }
      const thr = tn === 'text' ? 7 : 4.5;
      const row = { theme, level, glass: g, text: tn, size, weight, over: bk, dsf, kind, icon, ringPixels: ring.length,
        ringMin: q_(ring, 0), ringP10: q_(ring, 0.1), ringMedian: q_(ring, 0.5), shareUnder: floor(ring.filter(v => v < (icon ? 3 : thr)).length / Math.max(1, ring.length), 3),
        ringMedianNoHalo: q_(ringNo, 0.5), ringP10NoHalo: q_(ringNo, 0.1), ring2Median: q_(ring2, 0.5), ring2P10: q_(ring2, 0.1), ringInP10: q_(ringIn, 0.1), ringInMedian: q_(ringIn, 0.5) };
      R.haloRendered.push(row);
      return row;
    };
    // A. the author's gated set, re-measured my way: 6 palettes x 3 levels x 2 materials x 4 backdrops x 3 roles
    for (const [theme, scheme] of Object.entries(PALETTES)) for (const level of ['frosted', 'current', 'clear']) for (const g of ['glass-strong', 'glass']) for (const bk of ['page', 'card', 'mid', 'worst']) for (const tn of ['text', 'text-2', 'text-3']) {
      if (bk === 'worst' && tn === 'text-3') continue;
      const row = await renderHalo({ theme, scheme, level, g, tn, bk });
      const thr = tn === 'text' ? 7 : 4.5, ctx = `${level}/${theme}/${g}/${tn}/${bk}`;
      const gatedByAuthor = level !== 'frosted' && !(g === 'glass' && tn === 'text-3');
      if (gatedByAuthor) { check(`halo rendered (my ring): ${tn} median, ${level}`, row.ringMedian, thr, ctx); check(`halo rendered (my ring): ${tn} p10, ${level} (stricter than the author's bar)`, row.ringP10, thr, ctx); }
    }
    // B. stress: sizes, weights, kid face, device scales, busy backdrops, icons
    for (const [theme, scheme] of [['hearth', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['graphite', 'dark']]) for (const level of ['clear', 'current']) for (const g of ['glass-strong', 'glass']) {
      for (const [tn, size, weight] of [['text-2', 11, 400], ['text-2', 13, 400], ['text-2', 17, 600], ['text', 11, 500], ['text-3', 13, 400]]) for (const bk of ['worst', 'mid']) {
        if (tn === 'text-3' && bk === 'worst') continue;
        const row = await renderHalo({ theme, scheme, level, g, tn, size, weight, bk });
        check(`halo stress: ${tn} ${size}px/${weight} median`, row.ringMedian, tn === 'text' ? 7 : 4.5, `${level}/${theme}/${g}/${bk}`);
      }
      for (const bk of ['worst', 'mid']) {
        const row = await renderHalo({ theme, scheme, level, g, tn: 'text-2', size: 18, bk, kind: 'kid', accent: 'lavender' });   // kid body is 17 x 1.2 ~ 20; 18 px rounded face
        check('halo stress: kid (rounded face) text-2 median', row.ringMedian, 4.5, `${level}/${theme}/${g}/${bk}`);
      }
      for (const dsf of [1, 3]) for (const bk of ['worst', 'mid']) {
        const row = await renderHalo({ theme, scheme, level, g, tn: 'text-2', bk, dsf });
        check(`halo stress: text-2 at device scale ${dsf} median`, row.ringMedian, 4.5, `${level}/${theme}/${g}/${bk}`);
      }
      for (const bk of ['edge', 'stripes']) for (const tn of ['text', 'text-2']) {
        const row = await renderHalo({ theme, scheme, level, g, tn, bk });
        check(`halo stress: ${tn} over a busy photo (${bk}, blurred by the live filter) median`, row.ringMedian, tn === 'text' ? 7 : 4.5, `${level}/${theme}/${g}`);
      }
      // icons: an SVG stroke icon (a tab or button glyph) gets no text-shadow; non-text 3:1
      for (const bk of ['worst', 'mid']) for (const [tn, acc] of [['text-2', 'sky'], ['accent-ink', 'periwinkle']]) {
        const row = await renderHalo({ theme, scheme, level, g, tn, bk, icon: true, accent: acc });
        check(`halo stress: an SVG icon (${tn}) on see-through glass, non-text >= 3 (median of its ring)`, row.ringMedian, 3, `${level}/${theme}/${g}/${bk}`);
      }
    }
    // C. crops for the legibility judgement
    for (const [crop, o] of [
      ['crop-hearth-clear-strong-black-text2-15', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass-strong', tn: 'text-2', bk: 'worst' }],
      ['crop-hearth-frosted-strong-black-text2-15', { theme: 'hearth', scheme: 'light', level: 'frosted', g: 'glass-strong', tn: 'text-2', bk: 'worst' }],
      ['crop-hearth-clear-pill-edge-text-15', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass', tn: 'text', bk: 'edge' }],
      ['crop-midnight-clear-strong-white-text2-15', { theme: 'midnight', scheme: 'dark', level: 'clear', g: 'glass-strong', tn: 'text-2', bk: 'worst' }],
      ['crop-midnight-clear-pill-stripes-text-15', { theme: 'midnight', scheme: 'dark', level: 'clear', g: 'glass', tn: 'text', bk: 'stripes' }],
      ['crop-graphite-clear-strong-white-text2-11', { theme: 'graphite', scheme: 'dark', level: 'clear', g: 'glass-strong', tn: 'text-2', size: 11, bk: 'worst' }],
      ['crop-hearth-clear-strong-black-text2-11-dsf1', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass-strong', tn: 'text-2', size: 11, bk: 'worst', dsf: 1 }],
      ['crop-hearth-clear-strong-mid-text2-15', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass-strong', tn: 'text-2', bk: 'mid' }],
      ['crop-hearth-clear-strong-card-text-15', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass-strong', tn: 'text', bk: 'card' }],
      ['crop-hearth-clear-strong-black-icons', { theme: 'hearth', scheme: 'light', level: 'clear', g: 'glass-strong', tn: 'accent-ink', bk: 'worst', icon: true, accent: 'periwinkle' }],
    ]) await renderHalo({ ...o, crop });
    for (const { hc } of Object.values(haloCtxs)) await hc.close();


    // ── 8. distinctness (CIEDE2000, adult roots) and app vs semantic ────────────────────────────────────────────
    R.distinct = { light: {}, dark: {} }; R.appVsSemantic = { light: {}, dark: {} };
    for (const [theme, scheme] of Object.entries(PALETTES)) {
      const o = cache[`${theme}/adult/graphite`]; const c = n => col(o, n);
      for (const role of ['fill-strong', 'graphic', 'fill', 'strong']) {
        const D = R.distinct[scheme];
        for (let i = 0; i < APPS.length; i++) {
          for (let j = i + 1; j < APPS.length; j++) { const d = de2000(c(`${APPS[i]}-${role}`), c(`${APPS[j]}-${role}`)); const k = `app vs app ${role}`; if (!D[k] || d < D[k].v) D[k] = { v: d, pair: `${APPS[i]}/${APPS[j]}`, theme }; }
          for (const p of PEOPLE) { const d = de2000(c(`${APPS[i]}-${role}`), c(`${p}-${role}`)); const k = `app vs person ${role}`; if (!D[k] || d < D[k].v) D[k] = { v: d, pair: `${APPS[i]}/${p}`, theme }; }
          for (const s of SEM) { const d = de2000(c(`${APPS[i]}-${role}`), c(`${s}-${role}`)); const k = `app vs ${s} ${role}`; const S = R.appVsSemantic[scheme]; if (!S[k] || d < S[k].v) S[k] = { v: d, pair: `${APPS[i]}/${s}`, theme }; }
        }
        for (const p of PEOPLE) for (const s of SEM) { const d = de2000(c(`${p}-${role}`), c(`${s}-${role}`)); const k = `person vs ${s} ${role}`; const S = R.appVsSemantic[scheme]; if (!S[k] || d < S[k].v) S[k] = { v: d, pair: `${p}/${s}`, theme }; }
      }
      for (const role of ROLES) for (const s of SEM) {
        const pMin = Math.min(...PEOPLE.map(p => de2000(c(`${p}-${role}`), c(`${s}-${role}`))));
        const pAll = Math.min(...SEM.flatMap(s2 => PEOPLE.map(p => de2000(c(`${p}-${role}`), c(`${s2}-${role}`)))));
        for (const a of APPS) {
          const d = de2000(c(`${a}-${role}`), c(`${s}-${role}`));
          check('app vs status (per role, per status): no closer than the closest person to THAT status', d, pMin - 0.005, `${theme}/${a}/${s}/${role} (person min ${floor(pMin, 2)})`);
          check('app vs status (per role): no closer than the closest person to ANY status (the author wording, looser)', d, pAll - 0.005, `${theme}/${a}/${s}/${role}`);
          const M = (R.statusTable ??= {}); const k = `${scheme} ${role} vs ${s}`; if (!M[k] || d < M[k].app) M[k] = { app: floor(d, 2), appPair: a, personMin: floor(pMin, 2) };
        }
      }
      // the people's own semantic rule (semantic graphic >= 10 dE00 from every person graphic), applied to the apps
      for (const a of APPS) for (const s of SEM) check('app graphic vs semantic graphic dE00 >= 10 (the rule the person graphics meet)', de2000(c(`${a}-graphic`), c(`${s}-graphic`)), 10, `${theme}/${a}/${s}`);
      for (const p of PEOPLE) for (const s of SEM) check('person graphic vs semantic graphic dE00 >= 10 (control)', de2000(c(`${p}-graphic`), c(`${s}-graphic`)), 10, `${theme}/${p}/${s}`);
    }
    for (const sch of ['light', 'dark']) for (const X of [R.distinct[sch], R.appVsSemantic[sch]]) for (const k of Object.keys(X)) X[k].v = floor(X[k].v, 2);

    R.blockedRequests = blocked;
    await context.close();
  } finally { await browser.close(); }
  for (const k of ['heroEdge', 'heroLabel']) for (const kk of Object.keys(R[k] || {})) R[k][kk] = floor(R[k][kk]);
  return R;
}

// ── 9. the diff against revision 5 (git show HEAD:…, read-only) ─────────────────────────────────────────────────────
function declMap(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map(); let i = 0;
  const walk = (media) => {
    while (i < src.length) {
      const open = src.indexOf('{', i), close = src.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return; }
      if (open === -1) { i = src.length; return; }
      const sel = src.slice(i, open).trim().replace(/\s+/g, ' '); i = open + 1;
      if (sel.startsWith('@media')) { walk(sel); continue; }
      const end = src.indexOf('}', i); const body = src.slice(i, end); i = end + 1;
      for (const d of body.split(/;(?![^(]*\))/)) { const k = d.indexOf(':'); if (k < 0) continue; const prop = d.slice(0, k).trim(); const val = d.slice(k + 1).trim().replace(/\s+/g, ' '); if (!prop) continue;
        map.set(`${media || ''} | ${sel} | ${prop}`, val); }
    }
  };
  walk(null); return map;
}
function diffRev5() {
  const rel = 'audits/tools/phase4/tokens/proposed-tokens.css';
  const old = execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const A = declMap(old), B = declMap(css);
  const added = [], removed = [], changed = [];
  for (const [k, v] of B) { if (!A.has(k)) added.push(k + ' = ' + v); else if (A.get(k) !== v) changed.push({ k, was: A.get(k), now: v }); }
  for (const [k, v] of A) if (!B.has(k)) removed.push(k + ' = ' + v);
  const appRe = new RegExp(`--(${APPS.join('|')})-`);
  const expected = s => appRe.test(s) || /data-accent="(coral|apricot|honey|pistachio|leaf|seafoam|lagoon|cornflower|orchid)"/.test(s) || /data-glass/.test(s) || /--glass-halo|--glass-text-shadow/.test(s)
    || /(data-transparency="reduce"|prefers-reduced-transparency|data-kind="kiosk"\]) \| .*--blur(-sm|-lg)?$/.test(s.split(' = ')[0]) || /--dur-crossfade/.test(s) || /--hero-btn-(mix|bg)/.test(s);
  const unexpected = [...added.filter(s => !expected(s)).map(s => 'added: ' + s), ...removed.map(s => 'removed: ' + s), ...changed.filter(c => !expected(c.k + ' = ' + c.now) && !(/--(bubblegum|peach|butter|mint|aqua|sky|periwinkle|lavender|graphite)-(ink|strong)$/.test(c.k) && appRe.test(c.now))).map(c => ({ changed: c.k, was: c.was, now: c.now }))];
  // a changed swap-list declaration whose value only GAINED app entries still counts as expected; list what else changed in it
  const swapLists = changed.filter(c => c.now.length > c.was.length && c.now.startsWith(c.was.split(';')[0]));
  const bootOld = execFileSync('git', ['show', 'HEAD:audits/tools/phase4/tokens/bootstrap.js'], { cwd: ROOT, encoding: 'utf8' });
  return { declarationsRev5: A.size, declarationsRev6: B.size, added: added.length, removed: removed.length, changed: changed.length, unexpected, changedList: changed, swapListsGrown: swapLists.length,
    bootstrapChangedLines: (() => { const a = bootOld.split(/\r?\n/), b = BOOT.split(/\r?\n/); return b.map((l, i) => (l !== a[i] ? { line: i + 1, was: a[i], now: l } : null)).filter(Boolean); })() };
}

const out = { generated: new Date().toISOString(), tokens: 'audits/tools/phase4/tokens/proposed-tokens.css', engines: {} };
const engines = [];
if (WHICH !== 'chromium') engines.push(['webkit', webkit, {}]);
if (WHICH !== 'webkit') engines.push(['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]);
for (const [n, l, o] of engines) { const t0 = Date.now(); out.engines[n] = await runEngine(n, l, o); out.engines[n].seconds = Math.round((Date.now() - t0) / 1000); console.error(n, 'done', out.engines[n].seconds, 's'); }
out.diffRev5 = diffRev5();
for (const k of Object.keys(minima)) minima[k].min = floor(minima[k].min, 3);
out.summary = { ...stats, checkKinds: Object.keys(minima).length };
out.minima = minima;
out.failures = failures;
fs.writeFileSync(path.join(OUTDIR, 'verify-r2.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary));
console.log(`failures: ${failures.length}`);
for (const f of failures.slice(0, 60)) console.log(' ', JSON.stringify(f));
