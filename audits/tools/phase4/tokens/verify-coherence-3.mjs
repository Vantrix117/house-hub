// Phase 4 · token proposal · round-3 completeness and coherence verifier (independent of contrast.mjs / browser-check.mjs).
//   node audits/tools/phase4/tokens/verify-coherence-3.mjs [out.json]
//   default output: audits/evidence/p4/tokens/verify-coherence-3.json
// Static: every var(--x) the shell, the apps, design.css's component half, docs/design.html and the Dollywood template read
// is defined by the token file or locally. Runtime, in WebKit AND Chromium, on a fake origin (http://probe.local/, every other
// request aborted: no rig, no production):
//   R1  the no-data-theme dark root (the legacy fallback) vs Midnight under kiosk / Increase Contrast / Reduce Transparency
//   R2  the real bootstrap.js in <head> for every hub.THEMES id (+ graphite) x OS light/dark, legacy sessions, prefs, and a
//       document with its own later theme-color meta (Prayer's layout)
//   R3  the GLASS-7 ::before pickup rule (TOKENS.md §7) against today's .ds component CSS (sheet grabber, sheet scroller,
//       fixed tab bar), as written (unscoped) and scoped under .ds
//   R4  the System theme card's night half (data-theme-preview + data-scheme, no data-accent)
//   R5  a bare data-theme element (F260's theme buttons) keeps the document palette
//   R6  a nested data-accent inside the kiosk gets the 7:1 swaps
//   R7  the desktop sidebar tab bar: does the top-third pickup layer reach the tabs?
// Edits nothing but its output file; always closes both browsers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const out = process.argv[2] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-coherence-3.json');
const H = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TOK = rd('audits/tools/phase4/tokens/proposed-tokens.css');
const BOOT = rd('audits/tools/phase4/tokens/bootstrap.js');
const DESIGN = rd('apps/design.css');
const COMPONENTS = DESIGN.split('\n').slice(289).join('\n');   // today's component half (after the token half, lines 14-289)
const HUBJS = rd('apps/hub.js');
const TEMPLATE_P = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');

// the GLASS-7 rule exactly as TOKENS.md §7 writes it
const GLASS7 = `
.glass, .glass-strong, .tabbar, .topbar, .sheet, .pill, .btn-glass { position: relative; overflow: hidden; background: var(--glass-bg); }
:is(.glass, .glass-strong, .tabbar, .topbar, .sheet, .pill, .btn-glass)::before {
  content: ""; position: absolute; inset: 0 -50%; pointer-events: none; z-index: 0;
  background: var(--glass-pickup-layer);
  transform: translateX(calc((var(--sheen-x) - 50%) / 2)); will-change: transform; }
.tabbar::before { inset: 0 -50% 67%; }`;
// the same rule scoped the way design.css scopes its components today (.ds …), placed after them
const GLASS7_DS = `
.ds :is(.glass, .glass-strong, .tabbar, .topbar, .sheet, .pill, .btn-glass) { position: relative; overflow: hidden; background: var(--glass-bg); }
.ds :is(.glass, .glass-strong, .tabbar, .topbar, .sheet, .pill, .btn-glass)::before {
  content: ""; position: absolute; inset: 0 -50%; pointer-events: none; z-index: 0;
  background: var(--glass-pickup-layer);
  transform: translateX(calc((var(--sheen-x) - 50%) / 2)); will-change: transform; }
.ds .tabbar::before { inset: 0 -50% 67%; }`;

const result = { generated: new Date().toISOString(), static: {}, engines: {} };

// ── static: every var() read resolves ─────────────────────────────────────────────────────────────────────────────
{
  const defined = new Set([...TOK.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map(m => m[1]));
  const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f), 'docs/design.html'];
  const texts = files.map(f => [f, rd(f)]);
  texts.push(['apps/design.css (component half)', COMPONENTS]);
  if (fs.existsSync(TEMPLATE_P)) texts.push(['../dollywood-build-project/scripts/template.html', fs.readFileSync(TEMPLATE_P, 'utf8')]);
  const missing = [];
  for (const [f, t] of texts) {
    const local = new Set([...t.matchAll(/(--[A-Za-z0-9-]+)\s*:/g), ...t.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9-]+)/g)].map(m => m[1]));
    for (const m of t.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*(,)?/g)) {
      const n = m[1]; if (m[2] || defined.has(n) || local.has(n)) continue;
      if (n.endsWith('-')) continue;   // a name built in JS (F260's var(--g-' + id + ')', the guide's var(--sp-${n}) for 1-12): checked by hand
      missing.push({ file: f, name: n });
    }
  }
  const uniq = [...new Map(missing.map(x => [x.file + x.name, x])).values()];
  result.static.unresolvedReads = uniq;
  result.static.filesScanned = texts.length;
  // selectors in the token file with specificity above (0,2,0) that set a token the kiosk / contrast / transparency blocks also set
  const swapped = new Set(['--text-2', '--text-3', '--separator', '--glass-pickup', '--glass-alpha', '--glass-alpha-strong', '--hairline', '--glass-edge']);
  const hi = [];
  for (const m of TOK.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(s => s.trim()).filter(Boolean);
    const props = [...m[2].matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map(x => x[1]);
    for (const s of sels) {
      if (s.startsWith('@')) continue;
      const attrs = (s.match(/\[[^\]]+\]/g) || []).length, pcs = (s.match(/:(?!:)[a-z-]+/g) || []).filter(p => p !== ':not' && p !== ':is' && p !== ':where').length;
      const spec = attrs + pcs;
      const hit = props.filter(p => swapped.has(p));
      if (spec > 2 && hit.length) hi.push({ selector: s, specificityB: spec, sets: hit });
    }
  }
  result.static.highSpecificityNeutralSelectors = hi;
  // hub.THEMES ids from hub.js
  result.static.hubThemes = [...HUBJS.matchAll(/\{ id: '([a-z]+)', name: '[^']+', scheme: (null|'light'|'dark')/g)].map(m => ({ id: m[1], scheme: m[2] === 'null' ? null : m[2].replace(/'/g, '') }));
}

const THEMES = [...result.static.hubThemes, { id: 'graphite', scheme: 'dark' }];

// ── runtime ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const page0 = (head, body = '') => `<!doctype html><html><head>${head}</head><body>${body}<i id="p"></i></body></html>`;
async function serve(context, html) {
  await context.unroute('**/*').catch(() => {});
  await context.route('**/*', r => r.request().url().startsWith('http://probe.local/') ? r.fulfill({ status: 200, contentType: 'text/html', body: html }) : r.abort());
}
const colourOf = (page, names, sel = '#p') => page.evaluate(({ names, sel }) => {
  const host = document.querySelector(sel); const i = document.createElement('i'); host.appendChild(i); const o = {};
  for (const n of names) { i.style.color = ''; i.style.color = `var(${n})`; o[n] = getComputedStyle(i).color; }
  i.remove(); return o;
}, { names, sel });
const raw = (page, names, sel = 'html') => page.evaluate(({ names, sel }) => { const cs = getComputedStyle(document.querySelector(sel)); const o = {}; for (const n of names) o[n] = cs.getPropertyValue(n).trim(); o['color-scheme'] = cs.colorScheme; return o; }, { names, sel });
const setRoot = (page, attrs) => page.evaluate(a => { const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name); for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); }, attrs);

for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = result.engines[name] = {};
  try {
    // R1 ─ legacy fallback root vs Midnight
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await serve(context, page0(`<style>${TOK}</style>`));
      const page = await context.newPage(); await page.goto('http://probe.local/r1');
      const toks = ['--text-2', '--text-3', '--separator', '--hairline', '--glass-edge', '--bg', '--surface'];
      const rawToks = ['--glass-pickup', '--glass-alpha', '--glass-alpha-strong'];
      const modes = { adult: {}, kiosk: { 'data-kind': 'kiosk' }, contrast: { 'data-contrast': 'more' }, transparency: { 'data-transparency': 'reduce' } };
      E.R1 = {};
      for (const [m, extra] of Object.entries(modes)) {
        await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', ...extra });
        const mid = { ...(await colourOf(page, toks)), ...(await raw(page, rawToks)) };
        await setRoot(page, { 'data-scheme': 'dark', ...extra });
        const fb = { ...(await colourOf(page, toks)), ...(await raw(page, rawToks)) };
        const diff = Object.keys(mid).filter(k => mid[k] !== fb[k]).map(k => ({ token: k, midnight: mid[k], noThemeFallback: fb[k] }));
        E.R1[m] = { identical: diff.length === 0, diff };
      }
      await context.close();
    }

    // R2 ─ the real bootstrap in <head>, before the stylesheet
    {
      E.R2 = { themes: [], cases: {} };
      const run = async ({ ls = {}, scheme = 'light', laterMeta = false, staticMetas = false }) => {
        const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, colorScheme: scheme });
        const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
          (staticMetas ? `<meta name="theme-color" content="#F7F2EB" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#1A1512" media="(prefers-color-scheme: dark)">` : '') +
          `<script>${BOOT}</script><style>${TOK}</style>` + (laterMeta ? `<meta name="theme-color" id="themeColor" content="#F7F2EB">` : '');
        await serve(context, page0(head));
        await context.addInitScript(ls => { try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, ls);
        const page = await context.newPage(); await page.goto('http://probe.local/r2');
        const o = await page.evaluate(() => {
          const h = document.documentElement, cs = getComputedStyle(h);
          const i = document.getElementById('p'); const col = n => { i.style.color = `var(${n})`; return getComputedStyle(i).color; };
          return {
            attrs: Object.fromEntries([...h.attributes].map(a => [a.name, a.value])),
            computedColorScheme: cs.colorScheme, bg: col('--bg'), accentStrong: col('--accent-strong'), durSnappy: cs.getPropertyValue('--dur-snappy').trim(),
            metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => ({ id: m.id || null, content: m.getAttribute('content'), media: m.getAttribute('media') })),
          };
        });
        await context.close(); return o;
      };
      const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
      const B = { hearth: '#F4F1EC', parchment: '#ECE2CD', frost: '#F2F2F7', midnight: '#0B0A09', forest: '#070F0D', graphite: '#000000' };
      for (const t of THEMES) for (const os of ['light', 'dark']) {
        const o = await run({ ls: t.id === 'system' ? {} : { 'hub.theme': t.id }, scheme: os, staticMetas: true });
        const want = t.id === 'system' ? (os === 'dark' ? 'midnight' : 'hearth') : t.id;
        const wantScheme = t.scheme || os;
        const metaOk = o.metas.length > 0 && o.metas.every(m => m.media == null && m.content.toLowerCase() === B[want].toLowerCase());
        E.R2.themes.push({ theme: t.id, os, dataTheme: o.attrs['data-theme'], choice: o.attrs['data-theme-choice'], dataScheme: o.attrs['data-scheme'], computedColorScheme: o.computedColorScheme,
          ok: o.attrs['data-theme'] === want && o.attrs['data-scheme'] === wantScheme && o.computedColorScheme === wantScheme && o.bg === hex2rgb(B[want]) && metaOk && o.attrs.style === `color-scheme: ${wantScheme};` });
      }
      E.R2.cases.darkAlias = await run({ ls: { 'hub.theme': 'dark' } });
      E.R2.cases.legacyAdultHex = await run({ ls: { 'hub.session': { profile: { id: 'christian', kind: 'adult', color: '#BC5A38' } } } });
      E.R2.cases.legacyKidHex = await run({ ls: { 'hub.session': { profile: { id: 'kiara', kind: 'kid', color: '#B4861B' } } } });
      E.R2.cases.prefs = await run({ ls: { 'hub.prefs': { motion: 'reduce', transparency: 'reduce', contrast: 'more', textSize: 'xl' } } });
      E.R2.cases.prayerLaterMeta = await run({ ls: { 'hub.theme': 'midnight' }, laterMeta: true });
    }

    // R3 ─ GLASS-7 rule vs today's .ds components
    {
      const body = `<nav class="tabbar" id="tb"><div class="tabs"><button class="tab" id="t1">Home</button><button class="tab">Apps</button></div></nav>
        <div class="sheet-backdrop"><div class="sheet" id="sh"><h2>Sheet</h2><p style="height:1600px;margin:0">tall</p></div></div>`;
      E.R3 = {};
      for (const [variant, extra] of [['today', ''], ['asWritten', GLASS7], ['scopedDs', GLASS7_DS]]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await serve(context, `<!doctype html><html data-theme="hearth" data-scheme="light" data-accent="bubblegum"><head><style>${TOK}\n${COMPONENTS}\n${extra}</style></head><body class="ds">${body}</body></html>`);
        const page = await context.newPage(); await page.goto('http://probe.local/r3');
        E.R3[variant] = await page.evaluate(() => {
          const sh = document.getElementById('sh'), tb = document.getElementById('tb');
          const b = getComputedStyle(sh, '::before'), shc = getComputedStyle(sh);
          return {
            tabbarPosition: getComputedStyle(tb).position,
            sheetOverflowY: shc.overflowY, sheetScrollable: sh.scrollHeight > sh.clientHeight && shc.overflowY !== 'hidden',
            sheetHorizontalOverflow: sh.scrollWidth - sh.clientWidth,
            sheetBefore: { position: b.position, width: b.width, height: b.height, left: b.left, marginLeft: b.marginLeft, transform: b.transform,
              bgIsGrabber: !/gradient/.test(b.backgroundImage) && b.backgroundColor !== 'rgba(0, 0, 0, 0)', bgImage: b.backgroundImage.slice(0, 60) },
          };
        });
        await context.close();
      }
    }

    // R4 ─ the System card's night half; R5 ─ a bare data-theme; R6 ─ nested accent in the kiosk
    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
      const body = `<div id="card" data-theme-preview="hearth" data-scheme="light" data-accent="bubblegum"><div id="half" data-theme-preview="midnight" data-scheme="dark"></div>
        <div id="halfOk" data-theme-preview="midnight" data-scheme="dark" data-accent="bubblegum"></div></div>
        <button id="f260btn" data-theme="midnight">Midnight</button><span id="acc" data-accent="sky"></span>`;
      await serve(context, `<!doctype html><html data-theme="hearth" data-scheme="light" data-accent="graphite"><head><style>${TOK}</style></head><body>${body}<i id="p"></i></body></html>`);
      const page = await context.newPage(); await page.goto('http://probe.local/r4');
      const accToks = ['--accent-fill', '--accent-ink', '--accent-strong', '--hero-btn-bg', '--sel-fill', '--surface'];
      E.R4 = { nightHalfNoAccent: await colourOf(page, accToks, '#half'), nightHalfWithAccent: await colourOf(page, accToks, '#halfOk') };
      E.R4.halfMatchesRealMidnight = Object.keys(E.R4.nightHalfNoAccent).every(k => E.R4.nightHalfNoAccent[k] === E.R4.nightHalfWithAccent[k]);
      const nt = ['--text', '--text-2', '--surface', '--bg'];
      const doc = await colourOf(page, nt, 'body'), btn = await colourOf(page, nt, '#f260btn');
      E.R5 = { identicalToDocument: JSON.stringify(doc) === JSON.stringify(btn), colorScheme: await page.evaluate(() => getComputedStyle(document.getElementById('f260btn')).colorScheme) };
      await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-kind': 'kiosk', 'data-accent': 'graphite' });
      const k = await colourOf(page, ['--accent-strong', '--sky-ink-hi', '--accent-ink'], '#acc');
      E.R6 = { ...k, strongIsInkHi: k['--accent-strong'] === k['--sky-ink-hi'], inkIsInkHi: k['--accent-ink'] === k['--sky-ink-hi'] };
      await context.close();
    }

    // R7 ─ the desktop sidebar: the pickup's top third vs the tabs
    {
      const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
      const body = `<nav class="tabbar sidebar" id="tb"><div class="tabs"><button class="tab" id="t1">Home</button><button class="tab" id="t2">Apps</button><button class="tab" id="t3">Me</button></div></nav>`;
      await serve(context, `<!doctype html><html data-theme="forest" data-scheme="dark" data-accent="lavender"><head><style>${TOK}\n${COMPONENTS}\n${GLASS7}</style></head><body class="ds">${body}</body></html>`);
      const page = await context.newPage(); await page.goto('http://probe.local/r7');
      E.R7 = await page.evaluate(() => {
        const tb = document.getElementById('tb').getBoundingClientRect(), b = getComputedStyle(document.getElementById('tb'), '::before');
        const layerBottom = tb.top + parseFloat(b.top) + parseFloat(b.height);
        const tabs = ['t1', 't2', 't3'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, top: r.top, bottom: r.bottom, underPickupLayer: r.top < layerBottom }; });
        return { sidebarHeight: tb.height, pickupLayerBottom: layerBottom, tabs };
      });
      await context.close();
    }
  } finally { await browser.close(); }
}

// verdicts
const both = f => Object.values(result.engines).every(f);
result.verdicts = {
  staticAllReadsResolve: result.static.unresolvedReads.length === 0,
  R1_fallbackMatchesMidnightInEveryMode: both(e => Object.values(e.R1).every(x => x.identical)),
  R2_bootstrapThemesAllOk: both(e => e.R2.themes.every(x => x.ok)),
  R2_legacyHexToHue: both(e => e.R2.cases.legacyAdultHex.attrs['data-accent'] === 'bubblegum' && e.R2.cases.legacyKidHex.attrs['data-accent'] === 'butter' && e.R2.cases.legacyKidHex.attrs['data-kind'] === 'kid'),
  R2_prefsApplied: both(e => ['data-motion', 'data-transparency', 'data-contrast', 'data-text-size'].every(a => e.R2.cases.prefs.attrs[a]) && e.R2.cases.prefs.durSnappy === '150ms'),
  R2_prayerLayoutSingleMeta: both(e => e.R2.cases.prayerLaterMeta.metas.length === 1),
  R3_glass7RuleKeepsSheetGrabberAndScroller: both(e => ['asWritten', 'scopedDs'].every(v => e.R3[v].sheetBefore.bgIsGrabber && e.R3[v].sheetScrollable && e.R3[v].sheetHorizontalOverflow <= 0 && e.R3[v].tabbarPosition === 'fixed')),
  R4_nightHalfWithoutAccentMatchesMidnight: both(e => e.R4.halfMatchesRealMidnight),
  R5_bareDataThemeIsData: both(e => e.R5.identicalToDocument),
  R6_nestedAccentKioskSwaps: both(e => e.R6.strongIsInkHi && e.R6.inkIsInkHi),
  R7_sidebarTabsClearOfPickup: both(e => e.R7.tabs.every(t => !t.underPickupLayer)),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.verdicts, null, 1));
console.log('unresolved reads:', JSON.stringify(result.static.unresolvedReads));
console.log('high-specificity neutral selectors:', JSON.stringify(result.static.highSpecificityNeutralSelectors));
