// Phase 4 · the synthesized token proposal · engine cross-check of contrast.mjs.
//   node audits/tools/phase4/tokens/browser-check.mjs [tokens.css] [contrast.json] [out.json]
//   defaults: proposed-tokens.css, audits/evidence/p4/tokens/contrast.json → audits/evidence/p4/tokens/browser-check.json
// Loads ONLY the token file into a blank page (no server, no app code, no network) in WebKit and in Chromium, sets the
// <html> attributes of every engineSamples context contrast.mjs recorded (6 palettes x 9 people x adult / Increase Contrast
// / Reduce Transparency / kiosk), reads each token through getComputedStyle on a probe, and compares the engine's colour
// with the value contrast.mjs's own cascade produced. Also: nested data-accent and [data-theme-preview] scopes, a bare data-theme element (F260's buttons) keeping the document palette, element-level --sheen-x writes (GLASS-7), the kiosk sizes with and without the 10-foot opt-in, lengths at a
// desktop and a touch iPad width, the prefers-* media mirrors where the engine can emulate them, and CSS feature support.
// Round 3 adds: the no-data-theme dark root equal to Midnight in EVERY mode (every declared token + color-scheme: adult, kid, kiosk,
// Increase Contrast by attribute and emulated media, Reduce Transparency, kiosk + Reduce Transparency, Reduce Motion); the System
// card's night half with data-accent; and GLASS-7's component rule (glass7-component.css) loaded over today's .ds components:
// grabber, sheet scrolling, fixed / sticky bars, the fixed timer pill, no sideways overflow at either end of the drift, the layer
// inside its bar, its colour ending above the tab icons, and no layer on the desktop sidebar.
// Round 4 adds: the identity rules (identity-component.css) over today's components: an avatar carrying Mae's hue (what
// hub.avatarHtml emits from batch 1a) inside Eli's page, a kid's page and the TV's graphite kiosk root wears Mae's fill, ink and ring;
// a record with no colour is graphite; the batch-2 app icon wears its app's family with a size x --r-icon-ratio corner; and Prayer's
// own theme-color meta (apps/prayer.html:9) with the bootstrap placed right after it: one meta, id="themeColor" kept, the palette --bg.
// Revision 5 adds: the hero button (.ds .hero .btn-primary, apps/design.css:423) with its batch-1a row (read from contrast.json ->
// heroButton.row) over today's component half, in 6 palettes x 18 families (Phase 5: the 9 people and the 9 app families) x adult / Increase Contrast / kiosk: the engine paints the
// button in --hero-btn-bg / --hero-btn-ink, the label passes 4.5 (7 in the 7:1 modes) over both hero stops, hovering does not
// replace the capsule, and today's rule under the new tokens is measured for the record (it fails in dark: why the row exists).
// Always closes both browsers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseHex, contrast as cr, over } from './colour-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const cssFile = process.argv[2] || path.join(HERE, 'proposed-tokens.css');
const resFile = process.argv[3] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'contrast.json');
const outFile = process.argv[4] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'browser-check.json');
const H = (process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit'));
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const css = fs.readFileSync(cssFile, 'utf8');
// apps/design.css is one file in two halves. Since audit batch 1a the v3 token half comes first and the components start at
// the "COMPONENTS (audit batch 1b" banner; before that batch the token half was lines 1-289 (so the gate still runs on either).
const designSplit = t => { const L = t.split('\n'); let i = L.findIndex(l => l.includes('COMPONENTS (audit batch 1b')); i = i > 0 ? i - 1 : 289; return { tokens: L.slice(0, i).join('\n'), components: L.slice(i).join('\n'), offset: i }; };
const COMPONENTS = designSplit(fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8')).components;   // the shipped .ds component half
const GLASS7 = fs.readFileSync(path.join(HERE, 'glass7-component.css'), 'utf8');
const IDENTITY = fs.readFileSync(path.join(HERE, 'identity-component.css'), 'utf8');                                 // the avatar (1a) and app-icon (batch 2) rules
const BOOT = fs.readFileSync(path.join(HERE, 'bootstrap.js'), 'utf8');
const PRAYER_HEAD = fs.readFileSync(path.join(ROOT, 'apps', 'prayer.html'), 'utf8').split('\n').slice(0, 9).join('\n');   // lines 1-9: up to its theme-color meta                                     // the proposed GLASS-7 rule (TOKENS.md §7)
const { engineSamples, heroButton: HERO } = JSON.parse(fs.readFileSync(resFile, 'utf8'));
// round-6 item 21: the hero row is SUBSTITUTED at the shipped rule's own line (apps/design.css:423), not appended, so the hover
// result below reflects the real cascade order
const HERO_LINE = COMPONENTS.split('\n').findIndex(l => l.trim().startsWith('.ds .hero .btn-primary {'));
if (HERO_LINE < 0) throw new Error('apps/design.css: the .ds .hero .btn-primary rule moved; re-point the hero probe');
const COMPONENTS_WITH_ROW = COMPONENTS.split('\n').map((l, i) => (i === HERO_LINE ? HERO.row : l)).join('\n');
// Phase 5: the people and the nine app families (D5)
const ACCENTS = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite', 'coral', 'apricot', 'honey', 'pistachio', 'leaf', 'seafoam', 'lagoon', 'cornflower', 'orchid'];

const toRGBA = s => {
  let m = s.match(/^rgba?\(([^)]*)\)$/);
  if (m) { const a = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255, a: a[3] ?? 1 }; }
  m = s.match(/^color\(srgb ([^)]*)\)$/);
  if (m) { const a = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a[3] ?? 1 }; }
  throw new Error('computed colour not understood: ' + s);
};
const fromHex = h => { const c = parseHex(h.slice(0, 7)); c.a = h.length > 7 ? parseInt(h.slice(7), 16) / 255 : 1; return c; };
const delta = (a, b) => Math.max(...['r', 'g', 'b'].map(k => Math.abs(a[k] * (a.a) - b[k] * (b.a)) * 255), Math.abs(a.a - b.a) * 255);

const WANT_SCHEME = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const summary = { tokens: path.relative(ROOT, cssFile).replace(/\\/g, '/'), engines: {} };
for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><i id="p"></i><div id="n"><i id="q"></i></div></body></html>`);
    const support = await page.evaluate(() => ({
      colorMixSrgb: CSS.supports('color', 'color-mix(in srgb, red 20%, transparent)'),
      linearEasing: CSS.supports('transition-timing-function', getComputedStyle(document.documentElement).getPropertyValue('--spring-bouncy').trim()),
      maxFn: CSS.supports('width', 'max(11px, calc(17px * 1.2))'),
      notAttr: CSS.supports('selector(:root:not([data-contrast="standard"]))'),
      whereSel: CSS.supports('selector(:root:where([data-scheme="dark"]:not([data-theme])))'),
      backdropFilter: CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'),
    }));
    const reset = async attrs => page.evaluate(attrs => { const h = document.documentElement; for (const a of [...h.attributes]) h.removeAttribute(a.name); for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v); }, attrs);
    let checked = 0, mismatches = 0, maxDelta = 0; const bad = [];
    for (const s of engineSamples) {
      await reset(s.attrs);
      const got = await page.evaluate(toks => { const p = document.getElementById('p'); const o = {}; for (const t of toks) { p.style.color = `var(${t})`; o[t] = getComputedStyle(p).color; } return o; }, Object.keys(s.toks));
      for (const [t, want] of Object.entries(s.toks)) {
        const d = delta(toRGBA(got[t]), fromHex(want)); checked++; maxDelta = Math.max(maxDelta, d);
        if (d > 1.5) { mismatches++; if (bad.length < 15) bad.push({ attrs: s.attrs, token: t, engine: got[t], contrastMjs: want }); }
      }
    }
    // nested scopes: a person-coloured element inside another person's page; a theme card inside another theme
    const nested = [];
    for (const [outer, inner, expectFrom] of [
      [{ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult' }, { 'data-accent': 'mint' }, { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'mint', 'data-kind': 'adult' }],
      [{ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'aqua', 'data-kind': 'kid' }, { 'data-accent': 'bubblegum' }, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'bubblegum', 'data-kind': 'kid' }],
      [{ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'graphite', 'data-kind': 'adult' }, { 'data-theme-preview': 'forest', 'data-scheme': 'dark', 'data-accent': 'lavender' }, { 'data-theme': 'forest', 'data-scheme': 'dark', 'data-accent': 'lavender', 'data-kind': 'adult' }],
      [{ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'graphite', 'data-kind': 'adult' }, { 'data-theme-preview': 'parchment', 'data-scheme': 'light', 'data-accent': 'butter' }, { 'data-theme': 'parchment', 'data-scheme': 'light', 'data-accent': 'butter', 'data-kind': 'adult' }],
    ]) {
      const toks = ['--bg', '--surface', '--text', '--text-2', '--accent-fill', '--accent-ink', '--accent-graphic', '--accent-strong', '--sel-fill', '--focus-ring-color', '--hero-btn-bg', '--tint', '--accent', '--glass-strong'];
      await reset(expectFrom);
      const want = await page.evaluate(toks => { const p = document.getElementById('p'); const o = {}; for (const t of toks) { p.style.color = `var(${t})`; o[t] = getComputedStyle(p).color; } return o; }, toks);
      await reset(outer);
      const got = await page.evaluate(({ toks, inner }) => { const n = document.getElementById('n'); for (const a of [...n.attributes]) if (a.name !== 'id') n.removeAttribute(a.name); for (const [k, v] of Object.entries(inner)) n.setAttribute(k, v); const q = document.getElementById('q'); const o = {}; for (const t of toks) { q.style.color = `var(${t})`; o[t] = getComputedStyle(q).color; } return o; }, { toks, inner });
      const diff = toks.filter(t => delta(toRGBA(got[t]), toRGBA(want[t])) > 1.5);
      nested.push({ outer, inner, ok: diff.length === 0, diff });
      await page.evaluate(() => { const n = document.getElementById('n'); for (const a of [...n.attributes]) if (a.name !== 'id') n.removeAttribute(a.name); });
    }
    // a BARE data-theme element (apps/f260.html:2028 <button data-theme="midnight">, index.html:1259) is data: it keeps the document palette
    const bareTheme = [];
    for (const [outer, inner] of [[{ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult' }, 'midnight'], [{ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult' }, 'forest'], [{ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'periwinkle', 'data-kind': 'adult' }, 'hearth'], [{ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'periwinkle', 'data-kind': 'adult' }, 'frost']]) {
      await reset(outer);
      const r = await page.evaluate(inner => {
        const toks = ['--bg', '--surface', '--text', '--text-2', '--accent-ink'];
        const n = document.getElementById('n'), p = document.getElementById('p'), q = document.getElementById('q');
        const read = el => { const o = { colorScheme: getComputedStyle(el).colorScheme }; for (const t of toks) { el.style.color = `var(${t})`; o[t] = getComputedStyle(el).color; } el.style.color = ''; return o; };
        const doc = read(p); n.setAttribute('data-theme', inner); const btn = read(q); n.removeAttribute('data-theme');
        return { doc, btn, same: Object.keys(doc).every(k => doc[k] === btn[k]) };
      }, inner);
      bareTheme.push({ outer: outer['data-theme'], inner, ...r });
    }
    // GLASS-7: an element-level --sheen-x write changes no token (the sheen is not in --glass-bg), and a root write neither
    await reset({ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'mint', 'data-kind': 'adult' });
    const sheen = await page.evaluate(() => {
      const q = document.getElementById('q'), h = document.documentElement;
      const toks = ['--glass-bg', '--glass-bg-strong', '--glass-bg-tinted', '--glass-bg-strong-tinted', '--material-chrome-bg', '--glass-pickup-layer'];
      const read = () => Object.fromEntries(toks.map(t => [t, getComputedStyle(q).getPropertyValue(t).trim()]));
      const before = read();
      q.style.setProperty('--sheen-x', '80%'); const afterElement = read(); const own = getComputedStyle(q).getPropertyValue('--sheen-x').trim();
      q.style.removeProperty('--sheen-x'); h.style.setProperty('--sheen-x', '70%'); const afterRoot = read(); h.style.removeProperty('--sheen-x');
      const noSheenInTokens = toks.every(t => !/sheen/.test(before[t]) && before[t].length > 0);
      return { noSheenInTokens, elementWriteChangesNoToken: toks.every(t => before[t] === afterElement[t]), rootWriteChangesNoToken: toks.every(t => before[t] === afterRoot[t]), elementSeesOwnValue: own === '80%' };
    });
    // lengths: desktop (fine pointer, no iPad tier) at 1440, kid and TV
    const lengths = {};
    const readLen = toks => page.evaluate(toks => { const p = document.getElementById('p'); p.style.display = 'block'; const o = {}; for (const t of toks) { p.style.width = `var(${t})`; o[t] = parseFloat(getComputedStyle(p).width); } return o; }, toks);
    const LEN = ['--fs-body', '--fs-caption2', '--fs-large-title', '--fs-glance-2', '--tap', '--tap-lg', '--tap-row', '--pad-card', '--r-control', '--r-card', '--r-lg', '--margin'];
    for (const [label, attrs] of [['adult-1440-desktop', { 'data-kind': 'adult' }], ['kid-1440', { 'data-kind': 'kid' }], ['kiosk-1440', { 'data-kind': 'kiosk' }], ['adult-xxl', { 'data-kind': 'adult', 'data-text-size': 'xxl' }], ['kiosk-xxl (ignores text size)', { 'data-kind': 'kiosk', 'data-text-size': 'xxl' }]]) {
      await reset({ 'data-theme': 'hearth', 'data-scheme': 'light', ...attrs }); lengths[label] = await readLen(LEN);
    }
    // the kiosk keeps today's TV sizes and spacing at every width; the 10-foot scale only with data-tv-scale="10ft" at 1600 px+
    for (const [w, h] of [[1024, 768], [1920, 1080]]) for (const opt of [false, true]) {
      await page.setViewportSize({ width: w, height: h });
      await reset({ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-kind': 'kiosk', ...(opt ? { 'data-tv-scale': '10ft' } : {}) });
      lengths[`kiosk-${w}${opt ? '-10ft' : ''}`] = await readLen([...LEN, '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl', '--fs-3xl', '--fs-4xl', '--sp-4', '--sp-6', '--fs-floor']);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    // color-scheme follows the theme (even under a stale data-scheme); a dark root without data-theme gets Midnight's grounds
    const schemes = {};
    for (const [t, sc] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
      await reset({ 'data-theme': t, 'data-scheme': sc === 'light' ? 'dark' : 'light' });
      schemes[t] = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    }
    const bare = {};
    for (const attrs of [{ 'data-scheme': 'dark' }, { 'data-theme': 'midnight', 'data-scheme': 'dark' }]) {
      await reset(attrs);
      bare[JSON.stringify(attrs)] = await page.evaluate(() => { const p = document.getElementById('p'); const o = { colorScheme: getComputedStyle(document.documentElement).colorScheme }; for (const t of ['--bg', '--surface', '--text', '--text-2']) { p.style.color = `var(${t})`; o[t] = getComputedStyle(p).color; } return o; });
    }
    const [b1, b2] = Object.values(bare);
    const noTheme = { same: ['colorScheme', '--bg', '--surface', '--text', '--text-2'].every(k => b1[k] === b2[k]), values: bare };
    // …and in EVERY mode: every custom property the token file declares, read on the root, plus color-scheme (round 3: the
    // guard at (0,3,0) overrode the kiosk, Increase Contrast and Reduce Transparency blocks on this root)
    const ALL = [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))];
    noTheme.everyMode = {};
    const readAll = () => page.evaluate(names => { const cs = getComputedStyle(document.documentElement); const o = { colorScheme: cs.colorScheme }; for (const n of names) o[n] = cs.getPropertyValue(n).trim(); return o; }, ALL);
    for (const [mode, extra, emu] of [['adult', {}], ['kid', { 'data-kind': 'kid' }], ['kiosk', { 'data-kind': 'kiosk' }], ['contrast-more', { 'data-contrast': 'more' }], ['reduce-transparency', { 'data-transparency': 'reduce' }],
      ['kiosk+reduce-transparency', { 'data-kind': 'kiosk', 'data-transparency': 'reduce' }], ['reduce-motion', { 'data-motion': 'reduce' }], ['prefers-contrast: more (emulated)', {}, { contrast: 'more' }], ['kiosk + prefers-contrast: more (emulated)', { 'data-kind': 'kiosk' }, { contrast: 'more' }]]) {
      let emulated = true;
      if (emu) { try { await page.emulateMedia(emu); emulated = await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches); } catch { emulated = false; } }
      await reset({ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'sky', ...extra }); const mid = await readAll();
      await reset({ 'data-scheme': 'dark', 'data-accent': 'sky', ...extra }); const fb = await readAll();
      if (emu) await page.emulateMedia({ contrast: 'no-preference' }).catch(() => {});
      const diff = Object.keys(mid).filter(k => mid[k] !== fb[k]);
      noTheme.everyMode[mode] = emulated ? { identical: diff.length === 0, tokens: Object.keys(mid).length, diff: diff.slice(0, 8).map(k => ({ token: k, midnight: mid[k], noTheme: fb[k] })) } : { identical: null, note: 'media feature not emulated by this engine (contrast.mjs gates it)' };
    }
    // the System card: a night half nested in a day swatch; with data-accent it must equal the real palette (the rule); without
    // it, it inherits the swatch's light-scheme accent (reported)
    await reset({ 'data-theme': 'frost', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult' });
    const nestedHalf = await page.evaluate(() => {
      const toks = ['--accent-fill', '--accent-ink', '--accent-strong', '--accent-on', '--sel-fill', '--hero-btn-bg', '--surface', '--text'];
      const wrap = document.createElement('div'); wrap.setAttribute('data-theme-preview', 'hearth'); wrap.setAttribute('data-scheme', 'light'); wrap.setAttribute('data-accent', 'bubblegum');
      const withA = document.createElement('div'); withA.setAttribute('data-theme-preview', 'midnight'); withA.setAttribute('data-scheme', 'dark'); withA.setAttribute('data-accent', 'bubblegum');
      const without = document.createElement('div'); without.setAttribute('data-theme-preview', 'midnight'); without.setAttribute('data-scheme', 'dark');
      wrap.append(withA, without); document.body.append(wrap);
      const read = el => { const i = document.createElement('i'); el.append(i); const o = {}; for (const t of toks) { i.style.color = `var(${t})`; o[t] = getComputedStyle(i).color; } i.remove(); return o; };
      const a = read(withA), b = read(without); wrap.remove();
      const h = document.documentElement; const save = [...h.attributes].map(x => [x.name, x.value]);
      for (const [k] of save) h.removeAttribute(k); for (const [k, v] of Object.entries({ 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'bubblegum' })) h.setAttribute(k, v);
      const real = read(document.body); for (const k of ['data-theme', 'data-scheme', 'data-accent']) h.removeAttribute(k); for (const [k, v] of save) h.setAttribute(k, v);
      return { withAccentEqualsReal: toks.every(t => a[t] === real[t]), withoutAccentEqualsReal: toks.every(t => b[t] === real[t]), withoutAccent: b, real };
    });
    // media mirrors, where the engine can emulate the feature
    const mirrors = {};
    for (const [feature, emu, attr] of [['prefers-reduced-motion', { reducedMotion: 'reduce' }, { 'data-motion': 'reduce' }], ['prefers-contrast', { contrast: 'more' }, { 'data-contrast': 'more' }]]) {
      try {
        const base = { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'mint', 'data-kind': 'adult' };
        const toks = ['--text-2', '--mint-ink', '--glass-alpha', '--press-scale', '--spring-gentle', '--enter-distance', '--focus-ring-w'];
        await reset({ ...base, ...attr }); const viaAttr = await page.evaluate(t => Object.fromEntries(t.map(x => [x, getComputedStyle(document.documentElement).getPropertyValue(x).trim()])), toks);
        await reset(base); await page.emulateMedia(emu);
        const matches = await page.evaluate(q => matchMedia(q).matches, `(${feature}: ${Object.values(emu)[0]})`);
        const viaMedia = await page.evaluate(t => Object.fromEntries(t.map(x => [x, getComputedStyle(document.documentElement).getPropertyValue(x).trim()])), toks);
        await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'no-preference' }).catch(() => page.emulateMedia({ reducedMotion: 'no-preference' }));
        mirrors[feature] = { emulated: matches, identical: matches ? toks.every(t => viaAttr[t] === viaMedia[t]) : null, viaAttr, viaMedia };
      } catch (e) { mirrors[feature] = { emulated: false, error: e.message.slice(0, 120) }; }
    }
    // GLASS-7, the component half (glass7-component.css) against today's .ds components (apps/design.css from line 290): the sheet
    // keeps its grabber and scrolls, the bars keep position fixed / sticky, the timer pill stays fixed, nothing overflows sideways at
    // either end of the drift, the drifting layer never leaves its bar, and its colour ends above the tab icons (bottom bar);
    // the desktop sidebar carries no layer (its tabs start at the top).
    const glass7 = {};
    for (const [label, vw, vh, cls] of [['bottom bar 390', 390, 844, 'tabbar'], ['sidebar 1180 (class="tabbar sidebar", index.html:393)', 1180, 820, 'tabbar sidebar'], ['phone with the sidebar class 390', 390, 844, 'tabbar sidebar']]) {
      const ctx2 = await browser.newContext({ viewport: { width: vw, height: vh } });
      await ctx2.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
      const p2 = await ctx2.newPage();
      const tab = t => `<button class="tab"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg><span>${t}</span></button>`;
      await p2.setContent(`<!doctype html><html data-theme="forest" data-scheme="dark" data-accent="lavender" data-kind="adult"><head><style>${css}\n${COMPONENTS}\n${GLASS7}</style></head>
        <body class="ds"><header class="topbar" id="top"><span class="title">Title</span></header><main style="height:2400px"></main>
        <nav class="${cls}" id="tb"><div class="tabs">${tab('Home')}${tab('Apps')}${tab('Chat')}${tab('Me')}</div></nav>
        <button class="pill" id="pill" style="position:fixed;left:50%;bottom:120px;transform:translateX(-50%)">0:42</button>
        <div class="sheet-backdrop"><div class="sheet" id="sh"><h2>Sheet</h2><p style="height:1600px;margin:0">tall</p></div></div></body></html>`);
      const out = [];
      for (const sx of ['0%', '30%', '100%']) {
        out.push(await p2.evaluate(sx => {
          const tb = document.getElementById('tb'), top = document.getElementById('top'), sh = document.getElementById('sh'), pill = document.getElementById('pill');
          for (const el of [tb, top]) el.style.setProperty('--sheen-x', sx);
          const layer = el => {
            const b = getComputedStyle(el, '::after'), r = el.getBoundingClientRect();
            if (b.content === 'none' || b.display === 'none') return { none: true };
            const m = b.transform === 'none' ? [1, 0, 0, 1, 0, 0] : b.transform.match(/matrix\(([^)]*)\)/)[1].split(',').map(Number);
            const left = parseFloat(b.left) + m[4], width = parseFloat(b.width), topY = parseFloat(b.top), height = parseFloat(b.height);
            return { none: false, zIndex: b.zIndex, x0: +left.toFixed(1), x1: +(left + width).toFixed(1), barWidth: +r.width.toFixed(1), insideBar: left >= -0.5 && left + width <= r.width + 0.5, top: topY, height };
          };
          const L = layer(tb), T = layer(top);
          // the pickup's colour ends at cy + ry x stop of the layer height (read from --glass-pickup-layer)
          const g = getComputedStyle(tb).getPropertyValue('--glass-pickup-layer');
          const gm = g.match(/radial-gradient\(\s*[\d.]+% ([\d.]+)% at [\d.]+% (-?[\d.]+)%/), stop = +(g.match(/transparent ([\d.]+)%\)\s*$/) || [])[1];
          const colourEnd = L.none ? null : L.top + L.height * ((+gm[2]) / 100 + (+gm[1]) / 100 * stop / 100);
          const tbTop = tb.getBoundingClientRect().top;
          const icons = [...tb.querySelectorAll('.tab .icon, .tab span')].map(e => +(e.getBoundingClientRect().top - tbTop).toFixed(1));
          const sb = getComputedStyle(sh, '::before');
          return { sheenX: sx, tabbarPosition: getComputedStyle(tb).position, topbarPosition: getComputedStyle(top).position, pillPosition: getComputedStyle(pill).position,
            docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            sheetOverflowY: getComputedStyle(sh).overflowY, sheetScrolls: sh.scrollHeight > sh.clientHeight && getComputedStyle(sh).overflowY !== 'hidden' && getComputedStyle(sh).overflowY !== 'clip',
            sheetOverflowX: sh.scrollWidth - sh.clientWidth, sheetPaintsPickup: /radial-gradient/.test(getComputedStyle(sh).backgroundImage),
            grabber: { display: sb.display, width: sb.width, position: sb.position, isGrabber: sb.display !== 'none' ? (!/gradient/.test(sb.backgroundImage) && sb.backgroundColor !== 'rgba(0, 0, 0, 0)' && sb.position === 'static') : 'hidden at this width (design.css:587)' },
            tabbarLayer: L, topbarLayer: T, pickupColourEndsAt: colourEnd == null ? null : +colourEnd.toFixed(1), tabContentTops: icons,
            tabsClearOfPickup: L.none || icons.every(y => y >= colourEnd - 0.5) };
        }, sx));
      }
      await ctx2.close();
      const o = out;
      glass7[label] = { samples: o, ok: o.every(s => s.tabbarPosition === 'fixed' && s.topbarPosition === 'sticky' && s.pillPosition === 'fixed' && s.docOverflowX <= 0 && s.sheetScrolls && s.sheetOverflowX <= 0 && s.sheetPaintsPickup
        && (s.grabber.isGrabber === true || typeof s.grabber.isGrabber === 'string') && (s.tabbarLayer.none || s.tabbarLayer.insideBar) && s.topbarLayer.insideBar && +s.topbarLayer.zIndex === -1 && s.tabsClearOfPickup)
        && (vw >= 1024 && /sidebar/.test(cls) ? o.every(s => s.tabbarLayer.none) : o.every(s => !s.tabbarLayer.none)) };
    }
    // round 4: person and app identity (identity-component.css over today's component half)
    const identity = {};
    for (const [label, rootAttrs] of [['Eli (periwinkle), Hearth', { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult' }],
      ['Eli (periwinkle), Midnight', { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'periwinkle', 'data-kind': 'adult' }],
      ['Ezra (aqua), kid, Parchment', { 'data-theme': 'parchment', 'data-scheme': 'light', 'data-accent': 'aqua', 'data-kind': 'kid' }],
      ['the TV (graphite kiosk), Midnight', { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'graphite', 'data-kind': 'kiosk' }],
      ['the TV (graphite kiosk), Hearth', { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'graphite', 'data-kind': 'kiosk' }]]) {
      const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx3.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
      const p3 = await ctx3.newPage();
      const attrs = Object.entries(rootAttrs).map(([k, v]) => `${k}="${v}"`).join(' ');
      await p3.setContent(`<!doctype html><html ${attrs}><head><style>${css}\n${COMPONENTS}\n${IDENTITY}</style></head><body class="ds">
        <span class="avatar" id="mae" data-accent="peach">M</span>
        <span class="avatar avatar-sm" id="mae-sm" data-accent="peach">M</span>
        <span class="avatar" id="nocolour" data-accent="graphite">·</span>
        <span class="avatar" id="today" style="--tint:#BC5A38">M</span>
        <div class="card"><h2><span class="app-icon" id="card-icon" data-accent="leaf"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></span>Guests</h2></div>
        <button class="tile" data-accent="honey"><span class="app-icon ticon" id="tile-icon"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></span></button>
        <i id="ref"></i></body></html>`);
      identity[label] = await p3.evaluate(() => {
        const ref = document.getElementById('ref');
        const tok = t => { ref.style.color = `var(${t})`; return getComputedStyle(ref).color; };
        const ring = el => { const m = getComputedStyle(el).boxShadow.match(/rgba?\([^)]*\)/g) || []; return m[1] || null; };   // 2nd shadow = the identity ring
        const av = id => { const el = document.getElementById(id), cs = getComputedStyle(el); return { background: cs.backgroundColor, ink: cs.color, ring: ring(el) }; };
        const fam = f => ({ background: tok(`--${f}-fill`), ink: tok(`--${f}-ink`), ring: tok(`--${f}-graphic`) });
        const eq = (a, b) => a.background === b.background && a.ink === b.ink && a.ring === b.ring;
        const mae = av('mae'), maeSm = av('mae-sm'), none = av('nocolour'), today = av('today');
        const icon = id => { const el = document.getElementById(id), cs = getComputedStyle(el); return { bgImage: cs.backgroundImage, ink: cs.color, width: parseFloat(cs.width), radius: parseFloat(cs.borderTopLeftRadius) }; };
        const ci = icon('card-icon'), ti = icon('tile-icon');
        const hasFam = (i, f) => i.bgImage.includes(tok(`--${f}-fill`)) && i.ink === tok(`--${f}-ink`);
        const rootAccent = document.documentElement.dataset.accent;
        return {
          maeIsMae: eq(mae, fam('peach')) && eq(maeSm, fam('peach')), mae,
          noColourIsGraphite: eq(none, fam('graphite')),
          todayMarkupUnderTheRewrite: { wears: eq(today, fam(rootAccent)) ? `the page's family (${rootAccent}): why hub.avatarHtml must emit data-accent in the same batch` : 'other', value: today },
          cardIcon: { ...ci, isLeaf: hasFam(ci, 'leaf'), radiusIsRatio: Math.abs(ci.radius - ci.width * 0.225) < 0.05 },
          tileIcon: { ...ti, isHoney: hasFam(ti, 'honey'), radiusIsRatio: Math.abs(ti.radius - ti.width * 0.225) < 0.05 },
        };
      });
      const r = identity[label]; r.ok = r.maeIsMae && r.noColourIsGraphite && r.cardIcon.isLeaf && r.cardIcon.radiusIsRatio && r.tileIcon.isHoney && r.tileIcon.radiusIsRatio;
      await ctx3.close();
    }
    // Phase 5, revision 6d (verify-rev6 round 3, issue 3): on a see-through glass level the text and icon outlines take the card colour
    // of the NEAREST palette, so a theme preview or data-scheme island inside another palette outlines in its own --surface
    const nestedOutline = [];
    for (const [rootTheme, rootScheme, innerTheme, innerScheme] of [['hearth', 'light', 'midnight', 'dark'], ['midnight', 'dark', 'hearth', 'light']]) for (const level of ['clear', 'current']) {
      const ctx6 = await browser.newContext({ viewport: { width: 400, height: 300 } });
      await ctx6.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
      const p6 = await ctx6.newPage();
      await p6.setContent(`<!doctype html><html data-theme="${rootTheme}" data-scheme="${rootScheme}" data-accent="sky" data-kind="adult" data-glass="${level}" data-transparency="full"><head><style>${css}
        .t { text-shadow: var(--glass-text-shadow); } .i { filter: var(--glass-icon-filter); }</style></head><body>
        <span class="t" id="outer">A</span><svg class="i" id="outerIcon" width="10" height="10"></svg>
        <div data-theme-preview="${innerTheme}" data-scheme="${innerScheme}" data-accent="sky"><span class="t" id="inner">A</span><svg class="i" id="innerIcon" width="10" height="10"></svg><i id="innerRef" style="color:var(--surface)"></i></div>
        <i id="outerRef" style="color:var(--surface)"></i></body></html>`);
      const got = await p6.evaluate(() => { const g = id => getComputedStyle(document.getElementById(id));
        // computed shadows may serialise the colour as rgb(), color(srgb …) or color-mix(…): normalise every colour through a canvas
        const cv = document.createElement('canvas').getContext('2d');
        const norm = c => { const m = c.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (m) return '#' + [m[1], m[2], m[3]].map(x => Math.round(+x * 255).toString(16).padStart(2, '0')).join('');
          cv.fillStyle = '#000'; cv.fillStyle = c; return cv.fillStyle; };
        const first = v => { const m = v.match(/(rgba?|color|color-mix)\((?:[^()]|\([^()]*\))*\)/); return m ? norm(m[0]) : 'none'; };
        return { outer: first(g('outer').textShadow), inner: first(g('inner').textShadow), outerIcon: first(g('outerIcon').filter), innerIcon: first(g('innerIcon').filter), outerSurface: norm(g('outerRef').color), innerSurface: norm(g('innerRef').color), raw: g('inner').textShadow.slice(0, 80) }; });
      got.ok = got.outer === got.outerSurface && got.inner === got.innerSurface && got.outerIcon === got.outerSurface && got.innerIcon === got.innerSurface && got.inner !== got.outer;
      nestedOutline.push({ rootTheme, innerTheme, level, ...got });
      await ctx6.close();
    }
    // round 4: Prayer keeps its own <meta name="theme-color" id="themeColor"> (CLAUDE.md: its ids stay); the bootstrap goes right after it
    const prayerMeta = {};
    for (const [label, stored, scheme, want] of [['System, light OS', null, 'light', '#F4F1EC'], ['System, dark OS', null, 'dark', '#0B0A09'], ['Midnight stored', 'midnight', 'light', '#0B0A09'], ['Forest stored', 'forest', 'light', '#070F0D']]) {
      const ctx4 = await browser.newContext({ colorScheme: scheme });
      await ctx4.route('**/*', r => r.request().url().startsWith('http://prayer.test/') ? r.fulfill({ status: 200, contentType: 'text/html', body: `${PRAYER_HEAD}\n<script>${BOOT}</script>\n<style>${css}</style>\n<title>Prayer</title>\n</head><body></body></html>` }) : r.abort());
      if (stored) await ctx4.addInitScript(t => { try { localStorage.setItem('hub.theme', JSON.stringify(t)); } catch (e) {} }, stored);
      const p4 = await ctx4.newPage();
      await p4.goto('http://prayer.test/apps/prayer.html');
      prayerMeta[label] = await p4.evaluate(() => { const ms = [...document.querySelectorAll('meta[name="theme-color"]')]; return { count: ms.length, id: ms[0] && ms[0].id, content: ms[0] && ms[0].getAttribute('content'), media: ms[0] && ms[0].getAttribute('media'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), theme: document.documentElement.dataset.theme }; });
      const m = prayerMeta[label]; m.want = want; m.ok = m.count === 1 && m.id === 'themeColor' && (m.content || '').toUpperCase() === want && m.media === null && (m.bg || '').toUpperCase() === want;
      await ctx4.close();
    }
    // revision 5: the hero button with its batch-1a row (HERO.row, the rule contrast.mjs gates) vs today's rule, under the tokens
    const heroButton = { row: HERO.row, contexts: 0, rowMin: {}, todayMin: {}, engineEqualsTokens: true, hoverKeepsCapsule: true, hoverChecked: 0, bad: [] };
    for (const withRow of [true, false]) {
      const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx5.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
      const p5 = await ctx5.newPage();
      await p5.setContent(`<!doctype html><html><head><style>${css}\n${withRow ? COMPONENTS_WITH_ROW : COMPONENTS}
/* harness: read the settled state, not .ds .btn's background transition between contexts */ #hb, #plain { transition: none !important; }</style></head><body class="ds"><div class="hero me-hero"><button class="btn btn-primary" id="hb">Switch</button></div><button class="btn btn-primary" id="plain">Plain</button><i id="ref"></i></body></html>`);
      for (const theme of Object.keys(WANT_SCHEME)) for (const accent of ACCENTS) for (const [mode, extra] of [['adult', {}], ['contrast-more', { 'data-contrast': 'more' }], ['kiosk', { 'data-kind': 'kiosk' }]]) {
        await p5.evaluate(a => { const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name); for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); }, { 'data-theme': theme, 'data-scheme': WANT_SCHEME[theme], 'data-accent': accent, 'data-kind': 'adult', ...extra });
        const g = await p5.evaluate(() => {
          const b = document.getElementById('hb'), ref = document.getElementById('ref'), cs = getComputedStyle(b);
          const cv = (window.__cv ??= document.createElement('canvas')); cv.width = cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true });
          const norm = str => { x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = str; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255, css: str }; };
          const tok = t => { ref.style.color = `var(${t})`; return norm(getComputedStyle(ref).color); };
          return { bg: norm(cs.backgroundColor), ink: norm(cs.color), tbg: tok('--hero-btn-bg'), tink: tok('--hero-btn-ink'), wash: tok('--accent-wash'), fill: tok('--accent-fill') };
        });
        const bg = g.bg, ink = g.ink, hi = mode !== 'adult', T = hi ? 7 : 4.5, key = WANT_SCHEME[theme] + (hi ? ' 7:1 modes' : '');
        const c = Math.min(...[g.wash, g.fill].map(st => { const s0 = st, b0 = bg.a < 0.999 ? over(bg, s0) : bg; return cr(ink.a < 0.999 ? over(ink, b0) : ink, b0); }));
        const tgt = withRow ? heroButton.rowMin : heroButton.todayMin; tgt[key] = Math.min(tgt[key] ?? Infinity, Math.floor(c * 100 + 1e-9) / 100);
        if (withRow) {
          heroButton.contexts++;
          const same = delta(bg, g.tbg) <= 1.5 && delta(ink, g.tink) <= 1.5;
          if (!same) heroButton.engineEqualsTokens = false;
          if (!same || c < T) heroButton.bad.push({ theme, accent, mode, contrast: +c.toFixed(3), threshold: T, same, g });
          if (accent === 'butter' && mode === 'adult') {
            await p5.hover('#hb'); await p5.waitForTimeout(450); const hv = await p5.evaluate(() => { const x = window.__cv.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = getComputedStyle(document.getElementById('hb')).backgroundColor; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }; }); await p5.mouse.move(0, 0);
            await p5.hover('#plain'); await p5.waitForTimeout(450); const pv = await p5.evaluate(() => ({ hover: getComputedStyle(document.getElementById('plain')).backgroundImage + '|' + getComputedStyle(document.getElementById('plain')).backgroundColor, media: matchMedia('(hover: hover) and (pointer: fine)').matches })); await p5.mouse.move(0, 0); await p5.waitForTimeout(450);
            const pr = await p5.evaluate(() => getComputedStyle(document.getElementById('plain')).backgroundImage + '|' + getComputedStyle(document.getElementById('plain')).backgroundColor);
            heroButton.hoverMediaMatches = pv.media; if (pv.hover !== pr) heroButton.hoverRuleSeenOnPlainButton = (heroButton.hoverRuleSeenOnPlainButton ?? 0) + 1;
            heroButton.hoverChecked++;
            if (delta(hv, bg) > 1.5) { heroButton.hoverKeepsCapsule = false; heroButton.bad.push({ theme, accent, mode, hover: hv, rest: g.bg }); }
          }
        }
      }
      await ctx5.close();
    }
    heroButton.substitutedAtLine = 290 + HERO_LINE;
    heroButton.ok = heroButton.contexts === 6 * ACCENTS.length * 3 && heroButton.hoverChecked === 6 && heroButton.hoverMediaMatches === true && heroButton.hoverRuleSeenOnPlainButton === 6 && heroButton.engineEqualsTokens && heroButton.hoverKeepsCapsule && heroButton.bad.length === 0;
    summary.engines[name] = { version: browser.version(), support, identity, prayerMeta, heroButton, nestedOutline, valuesChecked: checked, mismatches, maxChannelDelta255: +maxDelta.toFixed(2), examples: bad, nested, nestedHalf, bareTheme, sheen, lengths, mirrors, colorSchemeUnderStaleScheme: schemes, darkRootWithoutTheme: noTheme, glass7 };
  } finally { await browser.close(); }
}
const WANT = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const ok = Object.values(summary.engines).every(e => e.mismatches === 0 && e.nested.every(n => n.ok) && e.darkRootWithoutTheme.same && Object.entries(WANT).every(([t, sc]) => e.colorSchemeUnderStaleScheme[t] === sc) && e.bareTheme.every(b => b.same) && e.sheen.noSheenInTokens && e.sheen.elementWriteChangesNoToken && e.sheen.rootWriteChangesNoToken && e.sheen.elementSeesOwnValue
  && ['kiosk-1024', 'kiosk-1920', 'kiosk-1024-10ft'].every(k => e.lengths[k]['--margin'] <= 32 && e.lengths[k]['--fs-md'] === 22 && e.lengths[k]['--fs-3xl'] === 56 && e.lengths[k]['--fs-4xl'] === 84 && e.lengths[k]['--sp-4'] === 16 && e.lengths[k]['--fs-floor'] === 18)
  && e.lengths['kiosk-1920-10ft']['--margin'] === 96 && e.lengths['kiosk-1920-10ft']['--fs-floor'] === 28
  && e.support.whereSel && Object.values(e.darkRootWithoutTheme.everyMode).every(m => m.identical !== false) && e.nestedHalf.withAccentEqualsReal && Object.values(e.glass7).every(g => g.ok) && Object.values(e.identity).every(i => i.ok) && Object.values(e.prayerMeta).every(m => m.ok) && e.heroButton.ok && e.nestedOutline.length === 4 && e.nestedOutline.every(n => n.ok));
summary.ok = ok;
fs.writeFileSync(outFile, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary.engines).map(([k, e]) => [k, { version: e.version, support: e.support, valuesChecked: e.valuesChecked, mismatches: e.mismatches, maxChannelDelta255: e.maxChannelDelta255, nestedOk: e.nested.map(n => n.ok), bareThemeOk: e.bareTheme.map(b => b.same), sheen: e.sheen, lengths: e.lengths, mirrors: Object.fromEntries(Object.entries(e.mirrors).map(([f, m]) => [f, { emulated: m.emulated, identical: m.identical, error: m.error }])) }])), null, 1));
console.log('OK', ok);
process.exit(ok ? 0 : 1);
