// Phase 4 · token proposal · round-5 completeness and coherence verifier (independent of contrast.mjs / browser-check.mjs /
// rev2-runtime.mjs and of the round 3-4 verifiers; shares none of their code).
//   node audits/tools/phase4/tokens/verify-coherence-5.mjs [out.json]
//   default output: audits/evidence/p4/tokens/verify-coherence-5.json
//   P4_SECTIONS=<dir holding TOK.md … TELL.md, TOKENS.md> (optional; without it S1 uses audits/04-design-system.md only)
// Engines come from the audit harness (audits/tools/lib/local.mjs → playwright()). Pages are served on a fake origin
// (http://probe.local/); every other request is aborted: no rig server, no production. Both browsers are always closed.
//
// Static
//   S1  the gap inventory: "Token gaps for the proposal" items per dimension section vs the proposal's gap rows
//   S2  hand-copied glass recipes that compute the person pickup from var(--accent) × var(--glass-pickup) (the tokens batch 1a
//       changes), and whether the proposal's migration section names each file for batch 1a
//   S3  `.ds .hero .btn-primary` (apps/design.css:423): named in the proposal's batch rows?
//   S4  hub.js cross-frame propagation: which localStorage keys the storage listener re-applies; is hub.prefs named?
//   S5  custom properties defined in the shell/apps that neither the token file nor the migration section names
// Runtime, WebKit AND Chromium (each item depends on cascade order / inheritance / var() substitution)
//   R1  the hand-copied pickup recipes (Tally, Larder, Prayer, F260, the template's --lv-glass) read under TODAY's tokens, under
//       v3 after batch 1a (the recipe unchanged), and v3's own --glass-bg-strong-tinted: primary / secondary text over the page,
//       #767676 and a white photo, full sheen + full pickup (the gate's own upper-bound method), 6 palettes × 9 people
//   R2  the Me hero's "Switch" button (.ds .hero .btn-primary: white 92 % capsule, color var(--accent-deep)) under today's
//       tokens and under v3 with the batch-1a .ds .hero rewrite, 6 palettes × 9 people
//   R3  theme aliases: data-theme="light" ≡ hearth and "dark" ≡ midnight, every declared token + color-scheme, 6 modes
//   R4  stale scheme: every theme with the WRONG data-scheme ≡ the same theme with the right one, every token, 4 modes
//   R5  what reduce-transparency and the kiosk leave in --blur (read by 17 literal backdrop-filter recipes in the apps)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const out = process.argv[2] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-coherence-5.json');
const { webkit, chromium } = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const nl = s => s.replace(/\r\n/g, '\n');

const TOK = rd('audits/tools/phase4/tokens/proposed-tokens.css');
const DESIGN = rd('apps/design.css');
const TODAY_TOKENS = DESIGN.split('\n').slice(0, 289).join('\n');     // today's token half (lines 14-289 + header)
const COMPONENTS = DESIGN.split('\n').slice(289).join('\n');          // today's component half
const HUBJS = rd('apps/hub.js');
const SECTIONS = process.env.P4_SECTIONS || '';
const TOKENS_MD = nl(SECTIONS && fs.existsSync(path.join(SECTIONS, 'TOKENS.md')) ? fs.readFileSync(path.join(SECTIONS, 'TOKENS.md'), 'utf8')
  : (() => { const a = nl(rd('audits/04-design-system.md')); const i = a.indexOf('## Proposed token set'); const r = a.slice(i); const j = r.indexOf('\n## ', 5); return j < 0 ? r : r.slice(0, j); })());
const MIG = TOKENS_MD.slice(TOKENS_MD.indexOf('### Migration table'), TOKENS_MD.indexOf('### Gap-by-gap'));
const declared = [...new Set([...TOK.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map(m => m[1]))];

const result = { generated: new Date().toISOString(), static: {}, engines: {}, verdicts: {} };

// ── S1: gap inventory ─────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const DIMS = ['TOK', 'TYPE', 'SHAPE', 'GLASS', 'MOTION', 'COLOR', 'DARK', 'ACCENT', 'ICON', 'TELL'];
  const rows = TOKENS_MD.slice(TOKENS_MD.indexOf('### Gap-by-gap'), TOKENS_MD.indexOf('**Totals')).split('\n').filter(l => /^\| [A-Z]+-\d+ /.test(l));
  const proposal = {}; for (const r of rows) { const d = r.split('|')[1].trim().split('-')[0]; proposal[d] = (proposal[d] || 0) + 1; }
  const source = {};
  if (SECTIONS) for (const d of DIMS) {
    const f = path.join(SECTIONS, d + '.md'); if (!fs.existsSync(f)) continue;
    const t = nl(fs.readFileSync(f, 'utf8')); const i = t.indexOf('### Token gaps for the proposal'); const j = t.indexOf('\n### ', i + 10);
    const sec = t.slice(i, j < 0 ? undefined : j);
    const table = sec.split('\n').filter(l => /^\| \d+ \|/.test(l)).length;
    const list = sec.split('\n').filter(l => /^\d+\. /.test(l)).length;
    source[d] = table || list;
  }
  result.static.S1 = { proposalRows: rows.length, proposal, source, sourceTotal: Object.values(source).reduce((a, b) => a + b, 0),
    mismatches: Object.keys(source).filter(d => source[d] !== proposal[d]).map(d => ({ dim: d, source: source[d], proposal: proposal[d] })) };
}

// ── S2: hand-copied pickup recipes ────────────────────────────────────────────────────────────────────────────────────────
{
  const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
  const hits = [];
  for (const f of files) {
    const lines = rd(f).split('\n');
    lines.forEach((l, i) => { const n = (l.match(/color-mix\(in srgb,\s*var\(--accent\)\s*var\(--glass-pickup\)/g) || []).length; if (n) hits.push({ file: f, line: i + 1, count: n }); });
  }
  const byFile = {}; for (const h of hits) byFile[h.file] = (byFile[h.file] || 0) + h.count;
  // does the migration section route these recipes (the literal pickup) to a batch-1a change?
  const namesRecipeFix = /var\(--accent\)\s*var\(--glass-pickup\)|hand[- ]cop(y|ies)[^.\n]*1a|pickup[^.\n]*hand[- ]cop/i.test(MIG);
  result.static.S2 = { hits, byFile, total: hits.reduce((a, h) => a + h.count, 0), migrationNamesTheLegacyPickupRecipes: namesRecipeFix,
    glassPickupRowSays: (MIG.split('\n').find(l => /--glass-pickup/.test(l) && /tile-end/.test(l)) || '').slice(0, 400) };
}

// ── S3: the hero button ────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const line = DESIGN.split('\n').findIndex(l => /\.ds \.hero \.btn-primary/.test(l)) + 1;
  result.static.S3 = { rule: DESIGN.split('\n')[line - 1].trim(), line,
    namedInProposal: new RegExp(`design\\.css:${line}\\b|:${line}\\b[^|]*hero|hero \\.btn-primary|\\.hero \\.btn`).test(TOKENS_MD),
    meHeroSwitch: /class="hero me-hero"[\s\S]{0,600}btn btn-primary" id="switch"/.test(rd('index.html')) };
}

// ── S4: cross-frame propagation of the new preferences ─────────────────────────────────────────────────────────────────────
{
  const m = HUBJS.match(/addEventListener\('storage'[\s\S]{0,400}/);
  const keys = m ? [...m[0].matchAll(/ev\.key === (LS\.\w+|'[^']+')/g)].map(x => x[1]) : [];
  // a sentence that names the hub.prefs key together with the storage listener / another frame
  const sentences = TOKENS_MD.replace(/```[\s\S]*?```/g, '').split(/(?<=[.!?])\s+/);
  const hit = sentences.filter(s => /hub\.prefs/.test(s) && /storage listener|storage event|other frame|in frames|iframe|postMessage/i.test(s));
  result.static.S4 = { storageListenerKeys: keys, proposalNamesPrefsInStorageListener: hit.length > 0, sentences: hit.map(s => s.slice(0, 300)),
    sessionRefreshSentence: (sentences.find(s => /storage listener/.test(s)) || '').slice(0, 300) };
}

// ── S5: app-defined custom properties that nothing names ─────────────────────────────────────────────────────────────────
{
  const inTok = n => new RegExp(`(^|[^A-Za-z0-9-])${n}\\s*:`).test(TOK);
  const inMig = n => new RegExp(`(^|[^A-Za-z0-9-])${n}(?![A-Za-z0-9-])`).test(MIG);
  const ranges = ['--g-', '--d', '--tally-', '--cat-'];   // named in the table as ranges (…, /-mid/-lo, -shop/-dine/-ink)
  const files = ['index.html', 'docs/design.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
  const unnamed = {};
  for (const f of files) {
    const t = rd(f);
    const defs = new Set([...t.matchAll(/(?:^|[;{\s"`(])(--[A-Za-z][A-Za-z0-9-]*)\s*:/g), ...t.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9-]+)/g)].map(m => m[1]));
    const miss = [...defs].filter(n => !inTok(n) && !inMig(n) && !ranges.some(r => n.startsWith(r) && /^--(g|d\d|tally|cat)/.test(n)));
    if (miss.length) unnamed[f] = miss;
  }
  result.static.S5 = unnamed;
}

// ── runtime helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function open(browser, html) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.route('**/*', r => r.request().url().startsWith('http://probe.local/') ? r.fulfill({ status: 200, contentType: 'text/html', body: html }) : r.abort());
  const page = await context.newPage(); await page.goto('http://probe.local/p');
  return { context, page };
}
const doc = (head, body = '') => `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}<i id="probe"></i></body></html>`;
const setRoot = (page, attrs, style = {}) => page.evaluate(({ a, s }) => {
  const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name);
  for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); for (const [k, v] of Object.entries(s)) h.style.setProperty(k, v);
}, { a: attrs, s: style });
const rawAll = (page, names, sel = 'html') => page.evaluate(({ names, sel }) => { const cs = getComputedStyle(document.querySelector(sel)); const o = {}; for (const n of names) o[n] = cs.getPropertyValue(n).trim(); o['color-scheme'] = cs.colorScheme; return o; }, { names, sel });
// resolve colour tokens at an element: color: var(--x) on a child → computed colour string
const colours = (page, names, sel = '#probe') => page.evaluate(({ names, sel }) => { const host = document.querySelector(sel); const o = {};
  for (const n of names) { const i = document.createElement('i'); i.style.color = `var(${n})`; host.appendChild(i); o[n] = getComputedStyle(i).color; i.remove(); } return o; }, { names, sel });
const lengths = (page, names) => page.evaluate(names => { const i = document.createElement('i'); i.style.display = 'block'; document.body.appendChild(i); const o = {};
  for (const n of names) { i.style.width = ''; i.style.width = `var(${n})`; o[n] = parseFloat(getComputedStyle(i).width); } i.remove(); return o; }, names);
const pct = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

// colour maths (own copy): parse rgb()/rgba()/color(srgb …), composite in sRGB gamma space (as CSS does), WCAG contrast
function parse(s) {
  s = s.trim(); let m;
  if ((m = s.match(/^rgba?\(([^)]+)\)$/))) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p[3] ?? 1 }; }
  if ((m = s.match(/^color\(srgb ([^)]+)\)$/))) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  throw new Error('unparsed colour ' + s);
}
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const withA = (c, a) => ({ ...c, a: (c.a ?? 1) * a });
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = x => Math.floor(x * 100) / 100;
const WHITE = { r: 1, g: 1, b: 1, a: 1 }, GREY = { r: 118 / 255, g: 118 / 255, b: 118 / 255, a: 1 };

const THEMES = ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'];
const SCHEME = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
// the household's today hexes (worker/seed.sql, SWATCHES) for the D3 families
const TODAY_HEX = { periwinkle: '#4F5D8C', bubblegum: '#BC5A38', aqua: '#137F77', butter: '#B4861B', peach: '#8A6A4B', sky: '#3D5A3D', mint: '#5B8143', graphite: '#4C4C58', lavender: '#8C4F7A' };
const FAMS = Object.keys(TODAY_HEX);

// the full-pickup stack at a glass surface's top edge (the gate's own upper bound): backdrop ← fill ← pickup ← sheen
function stack({ backdrop, fill, pickup, pickupA, spec, specScale = 1 }) {
  let c = over(fill, backdrop);
  c = over(withA(pickup, pickupA), c);
  c = over(withA(spec, specScale), c);
  return c;
}

for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = result.engines[name] = { version: browser.version() };
  try {
    // ── R1: hand-copied pickup recipes ─────────────────────────────────────────────────────────────────────────────────────
    {
      const names = ['--accent', '--accent-fill-strong', '--glass', '--glass-strong', '--glass-spec', '--text', '--text-2', '--bg', '--surface'];
      const measure = async (page, theme, fam, v3) => {
        if (v3) await setRoot(page, { 'data-theme': theme, 'data-scheme': SCHEME[theme], 'data-accent': fam });
        else await setRoot(page, theme === 'hearth' ? { 'data-scheme': 'light' } : { 'data-theme': theme, 'data-scheme': SCHEME[theme] }, { '--accent': TODAY_HEX[fam] });
        const c = await colours(page, names); const P = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, parse(v)]));
        const pickupA = parseFloat(await pct(page, '--glass-pickup')) / 100;
        return { P, pickupA };
      };
      const variants = {};
      for (const [tag, css, v3] of [['today', TODAY_TOKENS, false], ['v3', TOK, true]]) {
        const { context, page } = await open(browser, doc(`<style>${css}</style>`));
        for (const theme of THEMES) for (const fam of FAMS) {
          const { P, pickupA } = await measure(page, theme, fam, v3);
          const back = { page: P['--bg'], grey: GREY, white: WHITE };
          const cases = { legacyStrong: { fill: P['--glass-strong'], tone: P['--accent'] }, legacyGlass: { fill: P['--glass'], tone: P['--accent'] } };
          if (v3) cases.tokenTinted = { fill: P['--glass-strong'], tone: P['--accent-fill-strong'] };
          // the template's hub flavour (apps/dollywood-live.html:215, 219-220): light = glass-strong + full sheen; dark = surface 94 % + 40 % sheen
          const dark = SCHEME[theme] === 'dark';
          cases.templateLv = { fill: dark ? withA(P['--surface'], 0.94) : P['--glass-strong'], tone: P['--accent'], specScale: dark ? 0.4 : 1 };
          for (const [k, cs] of Object.entries(cases)) for (const [bk, b] of Object.entries(back)) {
            const bg = stack({ backdrop: b, fill: cs.fill, pickup: cs.tone, pickupA, spec: P['--glass-spec'], specScale: cs.specScale ?? 1 });
            const key = `${tag}.${k}.${bk}.${SCHEME[theme]}`;
            const p1 = cr(P['--text'], bg), p2 = cr(P['--text-2'], bg);
            const v = variants[key] ||= { primary: 99, secondary: 99, at: null };
            if (p1 < v.primary) { v.primary = p1; v.atPrimary = `${theme}/${fam}`; }
            if (p2 < v.secondary) { v.secondary = p2; v.at = `${theme}/${fam}`; }
            if (fam !== 'graphite') { v.personPrimary = Math.min(v.personPrimary ?? 99, p1); v.personSecondary = Math.min(v.personSecondary ?? 99, p2); }
          }
          if (v3 && theme === 'midnight' && fam === 'bubblegum') E.R1sample = { pickupA, accent: await colours(page, ['--accent']), fillStrong: await colours(page, ['--accent-fill-strong']) };
          if (!v3 && theme === 'midnight' && fam === 'bubblegum') E.R1sampleToday = { pickupA, accent: await colours(page, ['--accent']) };
        }
        await context.close();
      }
      for (const v of Object.values(variants)) { for (const k of ['primary', 'secondary', 'personPrimary', 'personSecondary']) v[k] = r2(v[k]); }
      E.R1 = variants;
    }

    // ── R2: the Me hero's Switch button ────────────────────────────────────────────────────────────────────────────────────
    {
      const body = '<div class="ds"><div class="hero me-hero" id="hero"><button class="btn btn-primary" id="sw">Switch</button></div></div>';
      const REWRITE_1A_HERO = '.ds .hero { background: var(--hero-bg); color: var(--accent-ink); }';   // TOKENS.md migration §2, batch 1a
      const res = {};
      for (const [tag, css, v3] of [['today', TODAY_TOKENS + COMPONENTS, false], ['v3', TOK + COMPONENTS + REWRITE_1A_HERO, true]]) {
        const { context, page } = await open(browser, doc(`<style>${css}</style>`, body));
        for (const theme of THEMES) for (const fam of FAMS) {
          if (v3) await setRoot(page, { 'data-theme': theme, 'data-scheme': SCHEME[theme], 'data-accent': fam });
          else await setRoot(page, theme === 'hearth' ? { 'data-scheme': 'light' } : { 'data-theme': theme, 'data-scheme': SCHEME[theme] }, { '--accent': TODAY_HEX[fam] });
          const got = await page.evaluate(() => { const b = document.getElementById('sw'); const cs = getComputedStyle(b); return { color: cs.color, bg: cs.backgroundColor }; });
          // the hero behind the capsule: its gradient stops (today: accent-mix-white / accent / accent-deep; v3: accent-wash → accent-fill)
          const stops = await colours(page, v3 ? ['--accent-wash', '--accent-fill'] : ['--accent', '--accent-deep'], '#hero');
          const fg = parse(got.color), cap = parse(got.bg);
          const worst = Math.min(...Object.values(stops).map(s => cr(fg, over(cap, parse(s)))));
          const key = `${tag}.${SCHEME[theme]}`; const v = res[key] ||= { min: 99, at: null, max: 0 };
          if (worst < v.min) { v.min = worst; v.at = `${theme}/${fam}`; v.label = got.color; v.capsule = got.bg; }
          if (worst > v.max) v.max = worst;
        }
        await context.close();
      }
      for (const v of Object.values(res)) { v.min = r2(v.min); v.max = r2(v.max); }
      E.R2 = res;
    }

    // ── R3 / R4: theme aliases and stale schemes ───────────────────────────────────────────────────────────────────────────
    {
      const { context, page } = await open(browser, doc(`<style>${TOK}</style>`));
      const modes = { adult: {}, kid: { 'data-kind': 'kid' }, kiosk: { 'data-kind': 'kiosk' }, contrast: { 'data-contrast': 'more' }, transparency: { 'data-transparency': 'reduce' }, kioskContrast: { 'data-kind': 'kiosk', 'data-contrast': 'more' } };
      E.R3 = {};
      for (const [alias, real] of [['light', 'hearth'], ['dark', 'midnight']]) for (const [m, extra] of Object.entries(modes)) {
        await setRoot(page, { 'data-theme': real, 'data-scheme': SCHEME[real], 'data-accent': 'mint', ...extra }); const a = await rawAll(page, declared);
        await setRoot(page, { 'data-theme': alias, 'data-scheme': SCHEME[real], 'data-accent': 'mint', ...extra }); const b = await rawAll(page, declared);
        const diff = Object.keys(a).filter(k => a[k] !== b[k]); E.R3[`${alias}.${m}`] = { identical: diff.length === 0, diff: diff.slice(0, 10) };
      }
      E.R4 = {};
      for (const theme of THEMES) for (const [m, extra] of Object.entries({ adult: {}, kiosk: { 'data-kind': 'kiosk' }, contrast: { 'data-contrast': 'more' }, transparency: { 'data-transparency': 'reduce' } })) {
        await setRoot(page, { 'data-theme': theme, 'data-scheme': SCHEME[theme], 'data-accent': 'lavender', ...extra }); const a = await rawAll(page, declared);
        await setRoot(page, { 'data-theme': theme, 'data-scheme': SCHEME[theme] === 'dark' ? 'light' : 'dark', 'data-accent': 'lavender', ...extra }); const b = await rawAll(page, declared);
        const diff = Object.keys(a).filter(k => a[k] !== b[k]); E.R4[`${theme}.${m}`] = { identical: diff.length === 0, diff: diff.slice(0, 10) };
      }
      // R5: --blur under reduce-transparency and on the kiosk
      E.R5 = {};
      for (const [m, extra] of Object.entries({ adult: {}, reduce: { 'data-transparency': 'reduce' }, kiosk: { 'data-kind': 'kiosk' } })) {
        await setRoot(page, { 'data-theme': 'hearth', 'data-scheme': 'light', ...extra });
        E.R5[m] = { ...(await lengths(page, ['--blur', '--blur-sm', '--blur-lg'])), glassFilter: await pct(page, '--glass-filter') };
      }
      await context.close();
    }
  } finally { await browser.close(); }
}

// ── verdicts (true = the proposal's claim holds) ────────────────────────────────────────────────────────────────────────────
{
  const W = result.engines.webkit, C = result.engines.chromium;
  const both = f => [W, C].every(e => e && f(e));
  result.verdicts.S1_gapCountsMatchSources = result.static.S1.mismatches.length === 0;
  result.verdicts.S2_legacyPickupRecipesRoutedIn1a = result.static.S2.migrationNamesTheLegacyPickupRecipes;
  result.verdicts.S3_heroButtonRuleNamed = result.static.S3.namedInProposal;
  result.verdicts.S4_prefsPropagateAcrossFrames = result.static.S4.proposalNamesPrefsInStorageListener || result.static.S4.storageListenerKeys.some(k => /prefs/.test(k));
  result.verdicts.S5_everyAppLocalNameNamed = Object.keys(result.static.S5).length === 0;
  // R1: after batch 1a the unmigrated recipes must still meet the gate's own glass thresholds (primary ≥ 7, secondary ≥ 4.5) wherever
  // today's did; report per backdrop
  result.verdicts.R1_legacyRecipesMeetGateOverPage = both(e => ['legacyStrong', 'legacyGlass'].every(k => ['light', 'dark'].every(s => e.R1[`v3.${k}.page.${s}`].primary >= 7 && e.R1[`v3.${k}.page.${s}`].secondary >= 4.5)));
  result.verdicts.R1_legacyRecipesNoWorseThanToday = both(e => ['legacyStrong', 'legacyGlass', 'templateLv'].every(k => ['page', 'grey', 'white'].every(b => ['light', 'dark'].every(s =>
    e.R1[`v3.${k}.${b}.${s}`].primary >= e.R1[`today.${k}.${b}.${s}`].primary && e.R1[`v3.${k}.${b}.${s}`].secondary >= e.R1[`today.${k}.${b}.${s}`].secondary))));
  result.verdicts.R1_templateLvMeetsGateOverWhite = both(e => ['light', 'dark'].every(s => e.R1[`v3.templateLv.white.${s}`].primary >= 7 && e.R1[`v3.templateLv.white.${s}`].secondary >= 4.5));
  result.verdicts.R1_tokenRecipeMeetsGateOverWhite = both(e => ['light', 'dark'].every(s => e.R1[`v3.tokenTinted.white.${s}`].primary >= 7 && e.R1[`v3.tokenTinted.white.${s}`].secondary >= 4.5));
  result.verdicts.R2_heroSwitchButtonAA_v3 = both(e => ['light', 'dark'].every(s => e.R2[`v3.${s}`].min >= 4.5));
  result.verdicts.R3_aliasesEqualTheirPalettes = both(e => Object.values(e.R3).every(x => x.identical));
  result.verdicts.R4_staleSchemeHarmless = both(e => Object.values(e.R4).every(x => x.identical));
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.verdicts, null, 1));
console.log('wrote', path.relative(ROOT, out));
