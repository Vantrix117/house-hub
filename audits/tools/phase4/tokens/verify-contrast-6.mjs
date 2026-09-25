#!/usr/bin/env node
// verify-contrast-6.mjs — independent contrast verifier, round 6 (checks revision 5 of the Phase 4 token proposal).
// Reuses NOTHING from contrast.mjs, colour-lib.mjs or the earlier verify-* scripts: its own CSS block reader, its own
// WCAG maths, its own engine harness and its own colour parsing (rgb/rgba, color(srgb …), oklab(), lab()/oklch() via canvas).
//
//  A. Analytic (hex from proposed-tokens.css, the cascade rules applied by hand):
//     - the hero button as the batch-1a row paints it: --hero-btn-bg = color-mix(--accent-fill mix%, #FFF) (0 % light, 100 % dark),
//       --hero-btn-ink = --accent-ink (-> --X-ink-hi in the kiosk and Increase Contrast, both schemes);
//     - today's rule under the new tokens (white .92 over the hero stops wash / fill, --accent-deep = --accent-ink);
//     - the semantic -strong figures, --text-2 per surface, the dark -strong (Bubblegum) figures.
//  B. Engines (WebKit + Chromium via playwright-core): design.css with lines 14-289 swapped for the token file and line 423
//     swapped for the row, a real <div class="hero me-hero"><button class="btn btn-primary"> in every palette alias x scheme x
//     family x kind x preference (attribute and media) context, plus stale-scheme roots and nested data-accent scopes; the painted
//     pair is read back, compared to the analytic expectation and its contrast computed here.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const TOKENS = fs.readFileSync(path.join(HERE, 'proposed-tokens.css'), 'utf8');
const DESIGN = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-contrast-6.json');
const ROW = '.ds .hero .btn-primary { background: var(--hero-btn-bg); color: var(--hero-btn-ink); box-shadow: var(--e2); }';

// ── colour maths (own) ──────────────────────────────────────────────────────────────────────────────────────
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 }; };
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const comp = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const toHex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const down = (v, p = 2) => Math.floor(v * 10 ** p + 1e-9) / 10 ** p;
const oklabToSrgb = (L, A, B, alpha = 1) => {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B, m_ = L - 0.1055613458 * A - 0.0638541728 * B, s_ = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, Bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const enc = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
  return { r: enc(R), g: enc(G), b: enc(Bl), a: alpha };
};
function parseComputed(s, canvasFallback) {
  s = s.trim();
  let m = s.match(/^rgba?\(([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p[3] ?? 1 }; }
  m = s.match(/^color\(srgb\s+([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
  m = s.match(/^oklab\(([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(v => (v.endsWith('%') ? parseFloat(v) / 100 : Number(v))); return oklabToSrgb(p[0], p[1], p[2], p[3] ?? 1); }
  if (canvasFallback && canvasFallback[s]) return canvasFallback[s];
  throw new Error('unparsed computed colour: ' + s);
}

// ── A. the token file, read by hand ─────────────────────────────────────────────────────────────────────────
const css = TOKENS.replace(/\/\*[\s\S]*?\*\//g, '');
function blockWith(selStart, mustHave) {       // the first rule whose selector begins with selStart and whose body has mustHave
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) { const sel = m[1].trim(); if (sel.startsWith(selStart) && m[2].includes(mustHave)) return m[2]; }
  throw new Error('block not found: ' + selStart);
}
const decls = body => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map(x => [x[1], x[2].trim()]));
const HUE = { light: decls(blockWith(':root, [data-scheme="light"]', '--bubblegum-wash')), dark: decls(blockWith('[data-scheme="dark"], :root[data-theme="midnight"]', '--bubblegum-wash')) };
const NEUTRAL = {};
for (const t of ['hearth', 'frost', 'parchment', 'forest', 'graphite']) NEUTRAL[t] = decls(blockWith(t === 'hearth' ? ':root, :root[data-theme="hearth"]' : `:root[data-theme="${t}"], [data-theme-preview="${t}"]`, '--bg'));
NEUTRAL.midnight = decls(blockWith(':root[data-theme="midnight"], :root[data-theme="dark"]', '--bg'));
const SCHEME = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const FAMILIES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const H = (scheme, name) => { const v = HUE[scheme][name]; if (!/^#/.test(v || '')) throw new Error(`${scheme} ${name} = ${v}`); return v; };
// sanity on the mix knob and the pair's declarations (what the analytic model assumes)
const s4light = decls(blockWith(':root, [data-scheme="light"], :root[data-theme="hearth"]', '--hero-btn-mix'));
const s4dark = decls(blockWith('[data-scheme="dark"], :root[data-theme="midnight"]', '--hero-btn-mix'));
const roles = decls(blockWith(':root, [data-accent], [data-scheme], [data-theme-preview]', '--hero-btn-bg'));
const model = { mixLight: s4light['--hero-btn-mix'], mixDark: s4dark['--hero-btn-mix'], bg: roles['--hero-btn-bg'], ink: roles['--hero-btn-ink'], heroBg: roles['--hero-bg'] };
if (model.mixLight !== '0%' || model.mixDark !== '100%' || !/color-mix\(in srgb, var\(--accent-fill\) var\(--hero-btn-mix\), #FFFFFF\)/.test(model.bg) || model.ink !== 'var(--accent-ink)')
  throw new Error('the token file no longer matches the analytic model: ' + JSON.stringify(model));
// the kiosk / Increase Contrast ink swaps include every family (graphite too)
const kioskBody = blockWith(':root[data-kind="kiosk"]', '--text-2: var(--text-2-hi)');
const icBody = blockWith(':root[data-contrast="more"]', '--text-2: var(--text-2-hi)');
const swapsAll = b => FAMILIES.every(f => b.includes(`--${f}-ink: var(--${f}-ink-hi)`));
model.inkSwapKiosk = swapsAll(kioskBody); model.inkSwapIC = swapsAll(icBody);

const findings = [];
const A = { heroRow: {}, heroShipped: {}, heroPerFamily: {}, heroButtonVsHero: {} };
for (const scheme of ['light', 'dark']) for (const hi of [false, true]) {
  const key = scheme + (hi ? ' 7:1' : '');
  let min = Infinity, at = '', minW = Infinity, atW = '', minEdge = Infinity, atEdge = '';
  for (const f of FAMILIES) {
    const fill = hex(H(scheme, `--${f}-fill`)), wash = hex(H(scheme, `--${f}-wash`));
    const bg = scheme === 'light' ? hex('#FFFFFF') : fill;
    const ink = hex(H(scheme, `--${f}-ink${hi ? '-hi' : ''}`));
    const r = ratio(ink, bg);
    if (r < min) { min = r; at = `${f}: ${toHex(ink)} on ${toHex(bg)}`; }
    if (!hi) A.heroPerFamily[f] = Math.min(A.heroPerFamily[f] ?? Infinity, r);
    for (const stop of [wash, fill]) {
      const wbg = comp({ ...hex('#FFFFFF'), a: 0.92 }, stop);
      const rw = ratio(ink, wbg); if (rw < minW) { minW = rw; atW = `${f}: ${toHex(ink)} on ${toHex(wbg)} (white .92 over ${toHex(stop)})`; }
      const re = ratio(bg, stop); if (re < minEdge) { minEdge = re; atEdge = `${f}: capsule ${toHex(bg)} vs hero stop ${toHex(stop)}`; }
    }
  }
  A.heroRow[key] = { min: +min.toFixed(4), floor: down(min), at };
  A.heroShipped[key] = { min: +minW.toFixed(4), floor: down(minW), at: atW };
  A.heroButtonVsHero[key] = { min: +minEdge.toFixed(4), at: atEdge };
}
for (const f of FAMILIES) A.heroPerFamily[f] = down(A.heroPerFamily[f]);

// semantic -strong / -graphic / -on on every opaque surface
const SURF = ['--bg', '--surface', '--surface-2', '--surface-raised', '--fill-field', '--hover'];
function minOver(pred) { let best = { v: Infinity }; for (const t of Object.keys(SCHEME)) for (const s of SURF) { const r = pred(t, s); if (r && r.v < best.v) best = { ...r, theme: t, surface: s }; } return best; }
const sem = {};
for (const role of ['strong', 'graphic']) for (const fam of ['success', 'warning', 'danger']) {
  sem[`${fam}-${role}`] = minOver((t, s) => { const c = H(SCHEME[t], `--${fam}-${role}`); return { v: ratio(hex(c), hex(NEUTRAL[t][s])), pair: `${c} on ${NEUTRAL[t][s]}` }; });
}
sem.anyStrong = ['success', 'warning', 'danger'].map(f => ({ f, ...sem[`${f}-strong`] })).sort((a, b) => a.v - b.v)[0];
sem.anyGraphic = ['success', 'warning', 'danger'].map(f => ({ f, ...sem[`${f}-graphic`] })).sort((a, b) => a.v - b.v)[0];
sem.lightOnly = {};
for (const fam of ['success', 'warning', 'danger']) {
  sem.lightOnly[fam] = { onParchmentPage: ratio(hex(H('light', `--${fam}-strong`)), hex(NEUTRAL.parchment['--bg'])), onWhite: ratio(hex(H('light', `--${fam}-strong`)), hex('#FFFFFF')) };
  sem.lightOnly[fam].maxOnLightPage = Math.max(...['hearth', 'parchment', 'frost'].map(t => ratio(hex(H('light', `--${fam}-strong`)), hex(NEUTRAL[t]['--bg']))));
}
sem.onLabel = Math.min(...['light', 'dark'].flatMap(sc => ['success', 'warning', 'danger'].map(f => ratio(hex(H(sc, `--${f}-on`)), hex(H(sc, `--${f}-strong`))))));
sem.switchLightMin = minOver((t, s) => SCHEME[t] === 'light' ? { v: ratio(hex(H('light', '--success-strong')), hex(NEUTRAL[t][s])), pair: `#008533 on ${NEUTRAL[t][s]}` } : null);

// --text-2 / --text-3 / --text-2-hi per surface (adult)
const text = { text2: {}, text2PerPalette: {}, text3: null, text2hi: null };
for (const group of [['page, card, sheet', ['--bg', '--surface', '--surface-raised']], ['wells', ['--surface-2']], ['fields', ['--fill-field']], ['hover fill', ['--hover']]]) {
  let best = { v: Infinity };
  for (const t of Object.keys(SCHEME)) for (const s of group[1]) { const v = ratio(hex(NEUTRAL[t]['--text-2']), hex(NEUTRAL[t][s])); if (v < best.v) best = { v, theme: t, pair: `${NEUTRAL[t]['--text-2']} on ${NEUTRAL[t][s]} (${s})` }; }
  text.text2[group[0]] = best;
}
for (const t of Object.keys(SCHEME)) text.text2PerPalette[t] = down(Math.min(...SURF.map(s => ratio(hex(NEUTRAL[t]['--text-2']), hex(NEUTRAL[t][s])))));
text.text3 = down(Math.min(...Object.keys(SCHEME).flatMap(t => SURF.map(s => ratio(hex(NEUTRAL[t]['--text-3']), hex(NEUTRAL[t][s]))))));
text.text2hi = down(Math.min(...Object.keys(SCHEME).flatMap(t => SURF.map(s => ratio(hex(NEUTRAL[t]['--text-2-hi']), hex(NEUTRAL[t][s]))))));

// dark -strong (the glowing pastel solid): as text on every dark surface, its -on label
const darkStrong = { perFamily: {}, minText: { v: Infinity }, minOn: { v: Infinity } };
for (const f of FAMILIES) {
  const st = H('dark', `--${f}-strong`), on = H('dark', `--${f}-on`);
  let mt = { v: Infinity };
  for (const t of ['midnight', 'forest', 'graphite']) for (const s of SURF) { const v = ratio(hex(st), hex(NEUTRAL[t][s])); if (v < mt.v) mt = { v, pair: `${st} on ${t} ${s} ${NEUTRAL[t][s]}` }; }
  const vo = ratio(hex(on), hex(st));
  darkStrong.perFamily[f] = { strong: st, asText: down(mt.v), at: mt.pair, onLabel: down(vo) };
  if (mt.v < darkStrong.minText.v) darkStrong.minText = { ...mt, f };
  if (vo < darkStrong.minOn.v) darkStrong.minOn = { v: vo, f };
}
darkStrong.oldBubblegumOnForestWell = ratio(hex('#FF99C3'), hex(NEUTRAL.forest['--surface-2']));
darkStrong.bubblegumInkHi = H('dark', '--bubblegum-ink-hi');

// ── B. the engines ──────────────────────────────────────────────────────────────────────────────────────────
const lines = DESIGN.split('\n');
const heroIdx = lines.findIndex(l => l.trim().startsWith('.ds .hero .btn-primary {'));
const hoverIdx = lines.map((l, i) => [l, i]).filter(([l]) => /^\s*\.ds \.btn(-primary)?:hover\s*\{[^}]*background/.test(l)).map(([, i]) => i + 1);
const shippedLine = lines[heroIdx];
function sheet(withRow) {
  const L = lines.slice();
  if (withRow) L[heroIdx] = ROW;
  return L.slice(0, 13).join('\n') + '\n' + TOKENS + '\n' + L.slice(289).join('\n');
}
const AH = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(AH, 'browsers');
const { webkit, chromium } = createRequire(path.join(AH, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const THEMES = [   // [label, data-theme, data-scheme, analytic scheme]
  ['hearth', 'hearth', 'light', 'light'], ['light (alias)', 'light', 'light', 'light'], ['parchment', 'parchment', 'light', 'light'], ['frost', 'frost', 'light', 'light'],
  ['midnight', 'midnight', 'dark', 'dark'], ['dark (alias)', 'dark', 'dark', 'dark'], ['forest', 'forest', 'dark', 'dark'], ['graphite', 'graphite', 'dark', 'dark'],
  ['no theme, light', null, 'light', 'light'], ['no theme, dark', null, 'dark', 'dark'], ['no theme, no scheme', null, null, 'light'],
  ['stale: hearth + dark scheme', 'hearth', 'dark', 'light'], ['stale: midnight + light scheme', 'midnight', 'light', 'dark'],
];
const KINDS = ['adult', 'kid', 'kiosk'];
const PREFS = [   // [label, attrs, media]
  ['none', {}, null], ['Increase Contrast (attr)', { 'data-contrast': 'more' }, null], ['Reduce Transparency (attr)', { 'data-transparency': 'reduce' }, null],
  ['IC + RT (attr)', { 'data-contrast': 'more', 'data-transparency': 'reduce' }, null],
  ['Increase Contrast (media)', {}, 'contrast'], ['Reduce Transparency (media)', {}, 'transparency'],
  ['IC media, opted out (data-contrast=standard)', { 'data-contrast': 'standard' }, 'contrast'],
];
const PEOPLE = { eli: 'periwinkle', christian: 'bubblegum', ezra: 'aqua', kiara: 'butter', mom: 'peach', dad: 'sky', niece: 'mint', tv: 'graphite', guest: 'lavender' };

const engines = {};
for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = { version: browser.version(), contexts: 0, mismatches: [], unparsed: 0, min: {}, rowFailures: [], shipped: {}, hover: [], nested: [], mediaSupport: {} };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 }, hasTouch: false });
    await ctx.route('**/*', r => (/^(data:|about:)/.test(r.request().url()) ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    let cdp = null;
    if (name === 'chromium') { try { cdp = await ctx.newCDPSession(page); } catch { cdp = null; } }
    const setMedia = async media => {
      const features = [{ name: 'prefers-contrast', value: media === 'contrast' ? 'more' : 'no-preference' }, { name: 'prefers-reduced-transparency', value: media === 'transparency' ? 'reduce' : 'no-preference' }];
      if (cdp) await cdp.send('Emulation.setEmulatedMedia', { features });
      else { try { await page.emulateMedia({ contrast: media === 'contrast' ? 'more' : 'no-preference' }); } catch { /* not supported */ } }
    };
    for (const withRow of [true, false]) {
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${sheet(withRow)}</style><style>#sw{transition:none!important}</style></head>
        <body class="ds"><div class="hero me-hero" id="hero"><div class="grow"><div class="hero-kicker">Adult</div><div class="hero-title">Name</div></div><button class="btn btn-primary" id="sw">Switch</button></div>
        <div data-accent="bubblegum" id="nest"><div class="hero" id="hero2"><button class="btn btn-primary" id="sw2" style="transition:none">Switch</button></div></div></body></html>`);
      for (const media of [null, 'contrast', 'transparency']) {
        await setMedia(media);
        const mq = await page.evaluate(() => ({ contrast: matchMedia('(prefers-contrast: more)').matches, transparency: matchMedia('(prefers-reduced-transparency: reduce)').matches }));
        if (media) E.mediaSupport[media] = mq[media];
        const jobs = [];
        for (const [tl, theme, scheme, asch] of THEMES) for (const [pid, fam] of Object.entries(PEOPLE)) for (const kind of KINDS) for (const [pl, attrs, pm] of PREFS) {
          if (pm !== media) continue;
          jobs.push({ tl, theme, scheme, asch, pid, fam, kind, pl, attrs });
        }
        const res = await page.evaluate(jobs => {
          const d = document.documentElement, b = document.getElementById('sw');
          const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
          const px = s => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = s; g.fillRect(0, 0, 1, 1); const p = g.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2], p[3]]; };
          return jobs.map(j => {
            for (const a of [...d.attributes]) if (a.name.startsWith('data-')) d.removeAttribute(a.name);
            if (j.theme) d.setAttribute('data-theme', j.theme);
            if (j.scheme) d.setAttribute('data-scheme', j.scheme);
            d.setAttribute('data-accent', j.fam); d.setAttribute('data-kind', j.kind);
            for (const [k, v] of Object.entries(j.attrs)) d.setAttribute(k, v);
            const cs = getComputedStyle(b);
            const bg = cs.backgroundColor, fg = cs.color, img = cs.backgroundImage;
            const rs = getComputedStyle(d);
            return { bg, fg, img, bgPx: px(bg), fgPx: px(fg), wash: px(rs.getPropertyValue('--accent-wash').trim()), fill: px(rs.getPropertyValue('--accent-fill').trim()) };
          });
        }, jobs);
        res.forEach((r, i) => {
          const j = jobs[i]; E.contexts += withRow ? 1 : 0;
          const fb = { [r.bg]: { r: r.bgPx[0] / 255, g: r.bgPx[1] / 255, b: r.bgPx[2] / 255, a: r.bgPx[3] / 255 }, [r.fg]: { r: r.fgPx[0] / 255, g: r.fgPx[1] / 255, b: r.fgPx[2] / 255, a: r.fgPx[3] / 255 } };
          let bg, fg;
          try { bg = parseComputed(r.bg, fb); fg = parseComputed(r.fg, fb); } catch { E.unparsed++; bg = fb[r.bg]; fg = fb[r.fg]; }
          const hiMode = j.kind === 'kiosk' || j.attrs['data-contrast'] === 'more' || (media === 'contrast' && j.attrs['data-contrast'] !== 'standard');
          const wash = { r: r.wash[0] / 255, g: r.wash[1] / 255, b: r.wash[2] / 255, a: 1 }, fill = { r: r.fill[0] / 255, g: r.fill[1] / 255, b: r.fill[2] / 255, a: 1 };
          const stops = [wash, fill];
          const rmin = Math.min(...stops.map(st => { const B = bg.a < 0.999 ? comp(bg, st) : bg; const F = fg.a < 0.999 ? comp(fg, B) : fg; return ratio(F, B); }));
          const key = `${j.asch}${hiMode ? ' 7:1' : ''}`;
          if (withRow) {
            const expBg = j.asch === 'light' ? '#FFFFFF' : H('dark', `--${j.fam}-fill`);
            const expFg = H(j.asch, `--${j.fam}-ink${hiMode ? '-hi' : ''}`);
            const dBg = Math.max(...['r', 'g', 'b'].map(k => Math.abs(bg[k] - hex(expBg)[k]) * 255), Math.abs(1 - bg.a) * 255);
            const dFg = Math.max(...['r', 'g', 'b'].map(k => Math.abs(fg[k] - hex(expFg)[k]) * 255), Math.abs(1 - fg.a) * 255);
            if (dBg > 0.6 || dFg > 0.6 || r.img !== 'none') E.mismatches.push({ ctx: `${j.tl}/${j.pid}/${j.kind}/${j.pl}`, got: [r.bg, r.fg, r.img], want: [expBg, expFg] });
            const cur = E.min[key]; if (!cur || rmin < cur.v) E.min[key] = { v: rmin, ctx: `${j.tl}/${j.pid}(${j.fam})/${j.kind}/${j.pl}`, pair: `${toHex(fg)} on ${toHex(bg)}` };
            if (rmin < (hiMode ? 7 : 4.5)) E.rowFailures.push({ ctx: `${j.tl}/${j.pid}/${j.kind}/${j.pl}`, v: rmin });
          } else {
            const cur = E.shipped[key]; if (!cur || rmin < cur.v) E.shipped[key] = { v: rmin, ctx: `${j.tl}/${j.pid}(${j.fam})/${j.kind}/${j.pl}` };
          }
        });
      }
      await setMedia(null);
      if (withRow) {
        // nested scope: a dark root with Eli's periwinkle, a nested data-accent="bubblegum" hero -> the button re-derives
        for (const [theme, scheme] of [['midnight', 'dark'], ['hearth', 'light'], ['forest', 'dark']]) {
          const n = await page.evaluate(([t, s]) => { const d = document.documentElement; for (const a of [...d.attributes]) if (a.name.startsWith('data-')) d.removeAttribute(a.name); d.setAttribute('data-theme', t); d.setAttribute('data-scheme', s); d.setAttribute('data-accent', 'periwinkle'); d.setAttribute('data-kind', 'adult'); const cs = getComputedStyle(document.getElementById('sw2')); return [cs.backgroundColor, cs.color]; }, [theme, scheme]);
          const bg = parseComputed(n[0]), fg = parseComputed(n[1]);
          const expBg = scheme === 'light' ? '#FFFFFF' : H('dark', '--bubblegum-fill'), expFg = H(scheme, '--bubblegum-ink');
          E.nested.push({ theme, got: [toHex(bg), toHex(fg)], want: [expBg, expFg], ok: toHex(bg) === expBg && toHex(fg) === expFg, ratio: +ratio(fg, bg).toFixed(3) });
        }
        // hover keeps the capsule (the row stays after .ds .btn:hover / .ds .btn-primary:hover)
        for (const [theme, scheme, fam] of [['midnight', 'dark', 'bubblegum'], ['hearth', 'light', 'butter'], ['graphite', 'dark', 'mint']]) {
          await page.evaluate(([t, s, f]) => { const d = document.documentElement; for (const a of [...d.attributes]) if (a.name.startsWith('data-')) d.removeAttribute(a.name); d.setAttribute('data-theme', t); d.setAttribute('data-scheme', s); d.setAttribute('data-accent', f); d.setAttribute('data-kind', 'adult'); }, [theme, scheme, fam]);
          await page.mouse.move(1, 1); await page.hover('#sw');
          const h = await page.evaluate(() => ({ hoverMedia: matchMedia('(hover: hover) and (pointer: fine)').matches, hovered: document.querySelector('#sw:hover') !== null, bg: getComputedStyle(document.getElementById('sw')).backgroundColor, fg: getComputedStyle(document.getElementById('sw')).color }));
          const bg = parseComputed(h.bg), fg = parseComputed(h.fg);
          const expBg = scheme === 'light' ? '#FFFFFF' : H('dark', `--${fam}-fill`);
          E.hover.push({ theme, fam, ...h, got: toHex(bg), want: expBg, ok: toHex(bg) === expBg, ratio: +ratio(fg, bg).toFixed(3) });
          await page.mouse.move(1, 1);
        }
      }
    }
    await ctx.close();
  } finally { await browser.close(); }
  for (const o of [E.min, E.shipped]) for (const k of Object.keys(o)) o[k].floor = down(o[k].v);
  engines[name] = E;
}

// ── the claims in TOKENS.md, compared ───────────────────────────────────────────────────────────────────────
const claims = [
  ['hero row, light adult ≥ 6.58', A.heroRow.light.floor, 6.58],
  ['hero row, dark adult ≥ 6.86', A.heroRow.dark.floor, 6.86],
  ['hero row, light 7:1 ≥ 9.37', A.heroRow['light 7:1'].floor, 9.37],
  ['hero row, dark 7:1 ≥ 8.35', A.heroRow['dark 7:1'].floor, 8.35],
  ['shipped rule under new tokens, dark 1.19', A.heroShipped.dark.floor, 1.19],
  ['shipped rule under new tokens, light ≥ 6.47', A.heroShipped.light.floor, 6.47],
  ['lowest semantic -strong on any surface 3.70 (success on Parchment page)', down(sem.anyStrong.v), 3.70],
  ['warning -strong on Parchment page 3.79', down(sem.lightOnly.warning.onParchmentPage), 3.79],
  ['success -strong on white 4.77 (true 4.7697: 4.76 rounded down, the same pair as the ≥ 4.76 label bound)', down(sem.lightOnly.success.onWhite), 4.77],
  ['warning -strong on white 4.88', down(sem.lightOnly.warning.onWhite), 4.88],
  ["danger -strong as text on Parchment's page 7.42 (light; dark #F07E79 is 5.24 on Forest's well)", down(sem.lightOnly.danger.onParchmentPage), 7.42],
  ['lowest semantic graphic 3.06 (warning graphic on Parchment page)', down(sem.anyGraphic.v), 3.06],
  ['semantic -on on -strong ≥ 4.76', down(sem.onLabel), 4.76],
  ['switch on, light 3.70 on Parchment page', down(sem.switchLightMin.v), 3.70],
  ['--text-2 page, card, sheet 8.13', down(text.text2['page, card, sheet'].v), 8.13],
  ['--text-2 wells 8.13', down(text.text2.wells.v), 8.13],
  ['--text-2 fields 7.83', down(text.text2.fields.v), 7.83],
  ['--text-2 hover fill 7.50', down(text.text2['hover fill'].v), 7.50],
  ['--text-3 lowest 5.07', text.text3, 5.07],
  ['--text-2-hi lowest 10.38', text.text2hi, 10.38],
  ['dark -strong as text, lowest ≥ 7.06', down(darkStrong.minText.v), 7.06],
  ['dark -on on -strong, lowest ≥ 8.67', down(darkStrong.minOn.v), 8.67],
  ['dark Bubblegum -strong is #FF9BC4', HUE.dark['--bubblegum-strong'], '#FF9BC4'],
  ['dark Bubblegum -strong as text 7.06', darkStrong.perFamily.bubblegum.asText, 7.06],
  ['dark Bubblegum on/strong 8.67', darkStrong.perFamily.bubblegum.onLabel, 8.67],
  ['old #FF99C3 on Forest well 6.97', down(darkStrong.oldBubblegumOnForestWell), 6.97],
].map(([claim, mine, stated]) => ({ claim, mine, stated, ok: typeof stated === 'number' ? Math.abs(mine - stated) <= 0.05 : mine === stated }));
const perPal = { hearth: 8.21, parchment: 8.36, frost: 7.50, midnight: 8.58, forest: 8.86, graphite: 9.15 };
for (const [t, v] of Object.entries(perPal)) claims.push({ claim: `§2.3 --text-2 lowest, ${t} ${v}`, mine: text.text2PerPalette[t], stated: v, ok: Math.abs(text.text2PerPalette[t] - v) <= 0.05 });
const famCol = { bubblegum: 6.86, peach: 6.79, butter: 6.58, mint: 6.59, aqua: 6.91, sky: 7.14, periwinkle: 7.01, lavender: 6.93, graphite: 7.39 };
for (const [f, v] of Object.entries(famCol)) claims.push({ claim: `§2.4 hero button ink / bg, ${f} ${v}`, mine: A.heroPerFamily[f], stated: v, ok: Math.abs(A.heroPerFamily[f] - v) <= 0.05 });
for (const [n, E] of Object.entries(engines)) {
  claims.push({ claim: `${n}: row paints exactly the tokens in every context`, mine: `${E.contexts - E.mismatches.length}/${E.contexts}`, stated: 'all', ok: E.mismatches.length === 0 && E.unparsed === 0 });
  claims.push({ claim: `${n}: no context under 4.5 (7 in 7:1 modes)`, mine: E.rowFailures.length, stated: 0, ok: E.rowFailures.length === 0 });
  for (const k of ['light', 'dark', 'light 7:1', 'dark 7:1']) claims.push({ claim: `${n}: engine min ${k} equals analytic`, mine: E.min[k]?.floor, stated: A.heroRow[k].floor, ok: Math.abs((E.min[k]?.floor ?? 0) - A.heroRow[k].floor) <= 0.01 });
  claims.push({ claim: `${n}: hover keeps the capsule`, mine: E.hover.map(h => h.ok && h.hovered && h.hoverMedia), stated: 'all true', ok: E.hover.every(h => h.ok && h.hovered && h.hoverMedia) });
  claims.push({ claim: `${n}: nested data-accent re-derives`, mine: E.nested.map(x => x.ok), stated: 'all true', ok: E.nested.every(x => x.ok) });
  claims.push({ claim: `${n}: today's rule, dark ~1.19-1.20`, mine: E.shipped.dark?.floor, stated: 1.19, ok: Math.abs((E.shipped.dark?.floor ?? 0) - 1.19) <= 0.05 });
}
const out = {
  script: 'audits/tools/phase4/tokens/verify-contrast-6.mjs', row: ROW, shippedLine: `apps/design.css:${heroIdx + 1} ${shippedLine.trim()}`, hoverRulesAt: hoverIdx, rowAfterHover: hoverIdx.every(i => i < heroIdx + 1),
  model, analytic: A, semantic: sem, text, darkStrong, engines: Object.fromEntries(Object.entries(engines).map(([k, E]) => [k, { ...E, mismatches: E.mismatches.slice(0, 20), rowFailures: E.rowFailures.slice(0, 20) }])),
  claims, allOk: claims.every(c => c.ok),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
for (const c of claims) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.claim}: mine ${JSON.stringify(c.mine)} vs stated ${JSON.stringify(c.stated)}`);
console.log(JSON.stringify({ heroRow: A.heroRow, heroShipped: A.heroShipped, heroButtonVsHero: A.heroButtonVsHero, rowAfterHover: out.rowAfterHover, hoverRulesAt: hoverIdx, heroLine: heroIdx + 1, engines: Object.fromEntries(Object.entries(engines).map(([k, E]) => [k, { version: E.version, contexts: E.contexts, mismatches: E.mismatches.length, unparsed: E.unparsed, mediaSupport: E.mediaSupport, min: E.min, shipped: E.shipped, nested: E.nested, hover: E.hover }])) }, null, 1));
console.log('allOk', out.allOk);
process.exit(out.allOk ? 0 : 1);
