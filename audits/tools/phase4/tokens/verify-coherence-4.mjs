// Phase 4 · token proposal · round-4 completeness and coherence verifier (independent of contrast.mjs / browser-check.mjs /
// rev2-runtime.mjs; shares none of their code).
//   node audits/tools/phase4/tokens/verify-coherence-4.mjs [out.json]
//   default output: audits/evidence/p4/tokens/verify-coherence-4.json
// Engines come from the audit harness (audits/tools/lib/local.mjs → playwright()); pages are served on a fake origin
// (http://probe.local/), every other request is aborted: no rig server, no production. Both browsers are always closed.
//
// Static
//   S1  every var(--x) the shell, the apps, design.css's component half, docs/design.html and the Dollywood template read is
//       defined by the token file, locally, or read with a fallback
//   S2  every hub.THEMES id (+ graphite) is in each list "Adding a theme" names: neutral block, scheme hue list, scheme role
//       list, color-scheme line, bootstrap S and B maps
//   S3  per-element --tint writers that the batch-1a/1b component rewrites (.ds .avatar → --accent-fill, .app-icon → --tile-bg)
//       stop reading: hub.avatarHtml, the shell, Kid Verse, apps.json colours
//   S4  CLAUDE.md sentences the adoption changes but the proposal's CLAUDE.md edit list does not name
// Runtime, WebKit AND Chromium (every item is a claim that depends on cascade order or inheritance)
//   R1  a dark root with no data-theme vs a Midnight root, every declared token + color-scheme, in 8 modes
//   R2  kid fonts / kid legacy radii and kiosk pinned legacy sizes on the root AND inside nested data-accent / preview scopes;
//       kiosk ignores the text size; the 10-foot opt-in is inert at 1024 and live at 1920
//   R3  person and app identity under the batch-1a .ds .avatar rewrite and the batch-1b .app-icon rewrite, with today's
//       per-element inline --tint markup (hub.avatarHtml, index.html app tiles)
//   R4  the re-keyed global Reduce Motion kill (TOKENS.md §8) against a literal animation: switch, OS, OS + opt-out
//   R5  a theme swatch inside an Increase Contrast / kiosk document: does it keep the 7:1 swaps?
//   R6  Forest's gold wash inside a nested data-accent scope
//   R7  F260's bare data-theme buttons keep the document palette; the batch-1a selector never climbs to <html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const out = process.argv[2] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-coherence-4.json');
const { webkit, chromium } = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TOK = rd('audits/tools/phase4/tokens/proposed-tokens.css');
const BOOT = rd('audits/tools/phase4/tokens/bootstrap.js');
const DESIGN = rd('apps/design.css');
const COMPONENTS = DESIGN.split('\n').slice(289).join('\n');   // today's component half (the token half is lines 14-289)
const HUBJS = rd('apps/hub.js');
const INDEX = rd('index.html');
const CLAUDE = rd('CLAUDE.md');
const TEMPLATE_P = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');
const SCRATCH_TOKENS = process.env.P4_TOKENS_MD || '';
const TOKENS_MD = fs.existsSync(path.join(ROOT, 'audits', '04-design-system.md')) ? rd('audits/04-design-system.md') : '';

// batch rows exactly as TOKENS.md words them (migration §2 table and batch 1b): the rewrites read data-accent-derived roles
const REWRITE_1A_AVATAR = `.ds .avatar { background: var(--accent-fill); color: var(--accent-ink); }`;
const REWRITE_1B_APPICON = `.ds .app-icon { background: var(--tile-bg); color: var(--accent-ink); }`;
// the re-keyed global kill, TOKENS.md §8, quoted
const KILL = `:root[data-motion="reduce"] *, :root[data-motion="reduce"] *::before, :root[data-motion="reduce"] *::after {
  animation-duration: .01ms !important; animation-iteration-count: 1 !important;
  transition-property: opacity, color, background-color, border-color !important; transition-duration: 150ms !important;
  scroll-behavior: auto !important; }
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) *, :root:not([data-motion="full"]) *::before, :root:not([data-motion="full"]) *::after {
  animation-duration: .01ms !important; animation-iteration-count: 1 !important;
  transition-property: opacity, color, background-color, border-color !important; transition-duration: 150ms !important;
  scroll-behavior: auto !important; } }`;

const result = { generated: new Date().toISOString(), static: {}, engines: {} };

// ── S1: every var() read resolves ─────────────────────────────────────────────────────────────────────────────────────
const declared = [...new Set([...TOK.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map(m => m[1]))];
{
  const defined = new Set(declared);
  const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f), 'docs/design.html'];
  const texts = files.map(f => [f, rd(f)]);
  texts.push(['apps/design.css (component half)', COMPONENTS], ['apps/hub.js', HUBJS]);
  if (fs.existsSync(TEMPLATE_P)) texts.push(['../dollywood-build-project/scripts/template.html', fs.readFileSync(TEMPLATE_P, 'utf8')]);
  const missing = [];
  for (const [f, t] of texts) {
    const local = new Set([...t.matchAll(/(--[A-Za-z0-9-]+)\s*:/g), ...t.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9-]+)/g)].map(m => m[1]));
    for (const m of t.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*(,)?/g)) {
      const n = m[1]; if (m[2] || defined.has(n) || local.has(n) || n.endsWith('-')) continue;
      missing.push({ file: f, name: n });
    }
    // names built in JS: docs/design.html c('x') → var(--x)
    if (f === 'docs/design.html') for (const m of t.matchAll(/c\('([a-z0-9-]+)'\)/g)) if (!defined.has('--' + m[1])) missing.push({ file: f, name: '--' + m[1], built: true });
    if (f === 'docs/design.html') for (const a of ['ok', 'warn', 'danger', 'info']) for (const s of ['-ink', '-soft']) if (!defined.has('--' + a + s)) missing.push({ file: f, name: '--' + a + s, built: true });
  }
  result.static.S1 = { filesScanned: texts.length, unresolved: [...new Map(missing.map(x => [x.file + x.name, x])).values()] };
}

// ── S2: hub.THEMES ids in every list ───────────────────────────────────────────────────────────────────────────────────
const hubThemes = [...HUBJS.matchAll(/\{ id: '([a-z]+)', name: '[^']+', scheme: (null|'light'|'dark')/g)].map(m => ({ id: m[1], scheme: m[2] === 'null' ? null : m[2].replace(/'/g, '') }));
const THEMES = [...hubThemes.filter(t => t.scheme), { id: 'graphite', scheme: 'dark' }];
{
  const blocks = [...TOK.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  const hueList = s => blocks.find(b => /--bubblegum-fill:/.test(b.body) && b.sel.includes(`[data-scheme="${s}"]`));
  const roleList = s => blocks.find(b => /--glass-strong:/.test(b.body) && /--toast-bg:/.test(b.body) && b.sel.includes(`[data-scheme="${s}"]`));
  const csLine = s => blocks.find(b => b.body.trim() === `color-scheme: ${s};`);   // the end-of-§3 line (it also carries the no-theme guard)
  const neutral = id => blocks.find(b => /--bg:/.test(b.body) && b.sel.split(',').map(x => x.trim()).includes(`:root[data-theme="${id}"]`));
  const Smap = Object.fromEntries([...BOOT.matchAll(/S=\{([^}]*)\}/g)][0][1].split(',').map(x => x.split(':').map(y => y.replace(/'/g, '').trim())));
  const Bmap = Object.fromEntries([...BOOT.matchAll(/B=\{([^}]*)\}/g)][0][1].split(',').map(x => x.split(':').map(y => y.replace(/'/g, '').trim())));
  result.static.S2 = THEMES.map(t => {
    const sel = `:root[data-theme="${t.id}"]`;
    const n = neutral(t.id);
    const bg = n && (n.body.match(/--bg:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    return { id: t.id, scheme: t.scheme, neutralBlock: !!n, previewHook: !!n && n.sel.includes(`[data-theme-preview="${t.id}"]`),
      hueList: !!hueList(t.scheme) && hueList(t.scheme).sel.includes(sel), roleList: !!roleList(t.scheme) && roleList(t.scheme).sel.includes(sel),
      colorSchemeLine: !!csLine(t.scheme) && csLine(t.scheme).sel.includes(sel), bootS: Smap[t.id] === t.scheme, bootB: !!bg && (Bmap[t.id] || '').toLowerCase() === bg.toLowerCase() };
  });
  result.static.hubThemes = hubThemes;
}

// ── S3: per-element --tint writers the rewrites stop reading ──────────────────────────────────────────────────────────
{
  const apps = fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html'));
  const count = (t, re) => (t.match(re) || []).length;
  result.static.S3 = {
    hubAvatarHtmlWritesInlineTint: /hub\.avatarHtml[\s\S]{0,300}style="--tint:\$\{e\(\(p && p\.color\) \|\| '#8A6A4B'\)\}"/.test(HUBJS),
    hubAvatarHtmlFallbackHex: (HUBJS.match(/avatarHtml[\s\S]{0,300}\|\| '(#[0-9A-Fa-f]{6})'/) || [])[1] || null,
    avatarHtmlCallers: Object.fromEntries([['index.html (via avatar())', INDEX], ...apps.map(f => ['apps/' + f, rd('apps/' + f)])].map(([f, t]) => [f, count(t, /avatarHtml\(|[^.\w]avatar\((?!\s*\))/g)]).filter(([, n]) => n)),
    shellInlineTintWrites: count(INDEX, /--tint:\$\{/g) + count(INDEX, /--tint:var\(--/g),
    shellAppIconTintWrites: count(INDEX, /class="app-icon[^"]*" style="--tint/g) + count(INDEX, /app-icon[^>]*--tint/g),
    todaysAvatarRuleReadsTint: /\.ds \.avatar \{[^}]*var\(--tint\)/.test(COMPONENTS),
    todaysAppIconRuleReadsTint: /\.ds \.app-icon \{[^}]*var\(--tint\)/.test(COMPONENTS),
    proposalMentionsAvatarHtml: /avatarHtml/.test(TOKENS_MD.slice(TOKENS_MD.indexOf('## Proposed token set'))),
    appsJsonHexes: [...new Set((rd('apps.json').match(/#[0-9A-Fa-f]{6}/g) || []))],
  };
}

// ── S4: CLAUDE.md sentences that go stale ─────────────────────────────────────────────────────────────────────────────
{
  const tokSec = TOKENS_MD.slice(TOKENS_MD.indexOf('## Proposed token set'));
  const editList = (tokSec.match(/\*\*The adoption changes CLAUDE\.md in these places\*\*[\s\S]*?\n\n\*\*The profile/) || [''])[0];
  const probes = [
    { claim: '`--accent` is the signed-in person\'s colour, set by hub.js', re: /`--accent` is the signed-in person's colour, set by hub\.js/ },
    { claim: 'hub.THEMES blurb Hearth "Warm paper" (apps/hub.js)', re: /blurb: 'Warm paper'/ , src: 'hubjs' },
    { claim: 'hub.avatarHtml(p) renders photo-or-emoji', re: /hub\.avatarHtml\(p\)` renders photo-or-emoji/ },
  ];
  result.static.S4 = probes.map(p => ({ claim: p.claim, presentToday: p.re.test(p.src === 'hubjs' ? HUBJS : CLAUDE),
    namedInEditList: p.src === 'hubjs' ? /Warm paper/.test(tokSec) && /hub\.THEMES[^.]*blurb/.test(tokSec) : /signed-in person's colour|avatarHtml/.test(editList) }));
  result.static.S4editListFound = !!editList;
}

// ── runtime ────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function open(browser, html, ctxOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, ...ctxOpts });
  await context.route('**/*', r => r.request().url().startsWith('http://probe.local/') ? r.fulfill({ status: 200, contentType: 'text/html', body: html }) : r.abort());
  const page = await context.newPage(); await page.goto('http://probe.local/p');
  return { context, page };
}
const doc = (rootAttrs, head, body) => `<!doctype html><html ${Object.entries(rootAttrs).map(([k, v]) => `${k}="${v}"`).join(' ')}><head><meta charset="utf-8">${head}</head><body>${body}<i id="probe"></i></body></html>`;
const setRoot = (page, attrs) => page.evaluate(a => { const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name); for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); }, attrs);
const rawAll = (page, names, sel = 'html') => page.evaluate(({ names, sel }) => { const cs = getComputedStyle(document.querySelector(sel)); const o = {}; for (const n of names) o[n] = cs.getPropertyValue(n).trim(); o['color-scheme'] = cs.colorScheme; return o; }, { names, sel });
const colour = (page, names, sel) => page.evaluate(({ names, sel }) => { const host = document.querySelector(sel); const i = document.createElement('i'); host.appendChild(i); const o = {};
  for (const n of names) { i.style.color = ''; i.style.color = `var(${n})`; o[n] = getComputedStyle(i).color; } i.remove(); return o; }, { names, sel });
const lengthPx = (page, names, sel) => page.evaluate(({ names, sel }) => { const host = document.querySelector(sel); const i = document.createElement('i'); i.style.display = 'block'; host.appendChild(i); const o = {};
  for (const n of names) { i.style.width = ''; i.style.width = `var(${n})`; o[n] = parseFloat(getComputedStyle(i).width); } i.remove(); return o; }, { names, sel });

for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = result.engines[name] = { version: browser.version() };
  try {
    // R1 ─ no-theme dark root vs Midnight, every declared token, 8 modes
    {
      const { context, page } = await open(browser, doc({}, `<style>${TOK}</style>`, ''));
      const modes = { adult: {}, kid: { 'data-kind': 'kid' }, kiosk: { 'data-kind': 'kiosk' }, contrast: { 'data-contrast': 'more' },
        transparency: { 'data-transparency': 'reduce' }, kioskTransparency: { 'data-kind': 'kiosk', 'data-transparency': 'reduce' },
        motion: { 'data-motion': 'reduce' }, kidContrastXL: { 'data-kind': 'kid', 'data-contrast': 'more', 'data-text-size': 'xl' } };
      E.R1 = {};
      for (const [m, extra] of Object.entries(modes)) {
        await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'sky', ...extra });
        const mid = await rawAll(page, declared);
        await setRoot(page, { 'data-scheme': 'dark', 'data-accent': 'sky', ...extra });
        const fb = await rawAll(page, declared);
        const diff = Object.keys(mid).filter(k => mid[k] !== fb[k]);
        E.R1[m] = { compared: Object.keys(mid).length, identical: diff.length === 0, diff: diff.slice(0, 12) };
      }
      await context.close();
    }

    // R2 ─ kid fonts/radii and kiosk sizes on the root and in nested scopes
    {
      const body = `<div id="acc" data-accent="aqua"><div id="deep" data-accent="butter"><span id="leaf"></span></div></div>
        <div id="sw" data-theme-preview="midnight" data-scheme="dark" data-accent="aqua"><span id="swleaf"></span></div>`;
      E.R2 = {};
      for (const [vw, vh] of [[390, 844], [1024, 768], [1920, 1080]]) {
        const { context, page } = await open(browser, doc({}, `<style>${TOK}</style>`, body), { viewport: { width: vw, height: vh } });
        const fonts = ['--font-text', '--font-ui', '--font-sans', '--font-display', '--font-serif', '--font-mono', '--font-numeral'];
        const kidR = {}, kioskR = {};
        await setRoot(page, { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'mint', 'data-kind': 'kid' });
        for (const sel of ['html', '#acc', '#leaf', '#swleaf']) {
          const f = await rawAll(page, fonts, sel); delete f['color-scheme'];
          kidR[sel] = { allRounded: Object.values(f).every(v => v.startsWith('ui-rounded')), notRounded: Object.entries(f).filter(([, v]) => !v.startsWith('ui-rounded')).map(([k]) => k), ...(await lengthPx(page, ['--r-lg', '--fs-xs', '--fs-body'], sel)) };
        }
        const legacy = ['--fs-xs', '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl', '--fs-3xl', '--fs-4xl', '--sp-4', '--sp-6', '--r-2xl', '--margin', '--fs-floor', '--fs-body'];
        for (const [label, attrs] of [['kiosk', { 'data-kind': 'kiosk' }], ['kioskXL', { 'data-kind': 'kiosk', 'data-text-size': 'xxl' }], ['kiosk10ft', { 'data-kind': 'kiosk', 'data-tv-scale': '10ft' }]]) {
          await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'graphite', ...attrs });
          kioskR[label] = {};
          for (const sel of ['html', '#leaf']) kioskR[label][sel] = await lengthPx(page, legacy, sel);
        }
        E.R2[`${vw}x${vh}`] = { kid: kidR, kiosk: kioskR };
        await context.close();
      }
    }

    // R3 ─ identity under the batch-1a avatar and batch-1b app-icon rewrites, with today's inline --tint markup
    {
      // exactly what hub.avatarHtml (apps/hub.js:461) and the shell (index.html:955, :701) emit today, for Mae (#BC5A38) and the Larder tile (#B8623A)
      const body = `<ul><li id="feedrow" style="--tint:#BC5A38"><span id="mae" class="avatar avatar-sm" style="--tint:#BC5A38">🌸</span></li></ul>
        <span id="nocolour" class="avatar" style="--tint:#8A6A4B">·</span>
        <span id="tile" class="app-icon" style="--tint:#B8623A"><svg class="icon"></svg></span>`;
      E.R3 = {};
      for (const [variant, extra] of [['asWrittenToday', ''], ['batch1a1b', `${REWRITE_1A_AVATAR}\n${REWRITE_1B_APPICON}`]]) {
        const { context, page } = await open(browser, doc({ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle' }, `<style>${TOK}\n${COMPONENTS}\n${extra}</style>`, `<div class="ds">${body}</div>`));
        E.R3[variant] = await page.evaluate(() => {
          const g = id => { const cs = getComputedStyle(document.getElementById(id)); return { bgColor: cs.backgroundColor, bgImage: cs.backgroundImage.slice(0, 140), color: cs.color, ring: cs.boxShadow.slice(0, 120) }; };
          return { mae: g('mae'), nocolour: g('nocolour'), tile: g('tile') };
        });
        await context.close();
      }
      const { context, page } = await open(browser, doc({ 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle' }, `<style>${TOK}</style>`, `<span id="b" data-accent="bubblegum"></span><span id="pe" data-accent="peach"></span>`));
      E.R3.ref = { viewerPeriwinkleFill: (await colour(page, ['--accent-fill'], 'html'))['--accent-fill'], maeBubblegumFill: (await colour(page, ['--accent-fill'], '#b'))['--accent-fill'],
        viewerInk: (await colour(page, ['--accent-ink'], 'html'))['--accent-ink'] };
      await context.close();
      const w = E.R3.batch1a1b, r = E.R3.ref;
      E.R3.verdict = {
        avatarPaintsViewersColourNotMaes: w.mae.bgColor === r.viewerPeriwinkleFill,
        avatarRingStillMaesHex: /188, 90, 56/.test(w.mae.ring),
        appTilePaintsViewersColour: /rgb\(204, 211, 255\)/.test(w.tile.bgImage) || w.tile.color === r.viewerInk,
        todayAvatarUsesInlineTint: /188, 90, 56|\b(2[0-9]{2}|1[0-9]{2}), /.test(E.R3.asWrittenToday.mae.bgImage),
      };
    }

    // R4 ─ the re-keyed Reduce Motion kill vs a literal animation and transition
    {
      const head = `<style>${TOK}\n${KILL}\n@keyframes spin{to{transform:rotate(1turn)}} #lit{animation:spin 1s linear infinite;transition:transform 400ms ease}</style>`;
      E.R4 = {};
      for (const [label, attrs, rm] of [['switchOnly', { 'data-motion': 'reduce' }, 'no-preference'], ['osOnly', {}, 'reduce'], ['osPlusOptOut', { 'data-motion': 'full' }, 'reduce'], ['neither', {}, 'no-preference']]) {
        const { context, page } = await open(browser, doc({ 'data-theme': 'hearth', 'data-scheme': 'light', ...attrs }, head, '<div id="lit"></div>'), { reducedMotion: rm });
        E.R4[label] = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('lit')), r = getComputedStyle(document.documentElement);
          return { animationDuration: cs.animationDuration, iterations: cs.animationIterationCount, transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration,
            durSnappy: r.getPropertyValue('--dur-snappy').trim(), pulseScale: r.getPropertyValue('--pulse-scale').trim() }; });
        await context.close();
      }
    }

    // R5 ─ a theme swatch inside a 7:1 document; R6 ─ Forest's gold wash in a nested accent; R7 ─ F260's buttons
    {
      const body = `<div id="sw" data-theme-preview="midnight" data-scheme="dark" data-accent="bubblegum"><i id="swi"></i></div><div id="acc" data-accent="bubblegum"></div>
        <div class="seg" id="themeSeg" style="display:flex;gap:8px;padding:4px"><button data-theme="hearth">Hearth</button><button data-theme="midnight">Midnight</button><button data-theme="forest">Forest</button></div>`;
      const { context, page } = await open(browser, doc({}, `<style>${TOK}</style>`, body));
      E.R5 = {};
      for (const [label, attrs] of [['contrast', { 'data-contrast': 'more' }], ['kiosk', { 'data-kind': 'kiosk' }]]) {
        await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'bubblegum', ...attrs });
        const names = ['--text-2', '--text-3', '--bubblegum-ink', '--accent-strong', '--badge-bg'];
        E.R5[label] = { root: await colour(page, names, 'html'), swatch: await colour(page, names, '#sw'), nestedAccent: await colour(page, names, '#acc') };
        E.R5[label].swatchKeeps7to1Swaps = JSON.stringify(E.R5[label].root) === JSON.stringify(E.R5[label].swatch);
        E.R5[label].nestedAccentKeeps = JSON.stringify(E.R5[label].root) === JSON.stringify(E.R5[label].nestedAccent);
      }
      await setRoot(page, { 'data-theme': 'forest', 'data-scheme': 'dark', 'data-accent': 'bubblegum' });
      const wash = await page.evaluate(() => ({ root: getComputedStyle(document.documentElement).getPropertyValue('--wash'), nested: getComputedStyle(document.getElementById('acc')).getPropertyValue('--wash') }));
      E.R6 = { rootRadials: (wash.root.match(/radial-gradient/g) || []).length, nestedRadials: (wash.nested.match(/radial-gradient/g) || []).length };
      await setRoot(page, { 'data-theme': 'midnight', 'data-scheme': 'dark', 'data-accent': 'bubblegum', 'data-theme-choice': 'system' });
      E.R7 = await page.evaluate(() => {
        const seg = document.getElementById('themeSeg'), b = seg.querySelector('[data-theme="hearth"]');
        const r = seg.getBoundingClientRect(), b0 = seg.children[0].getBoundingClientRect();
        const gap = document.elementFromPoint(b0.right + 4, b0.top + b0.height / 2);
        const csB = getComputedStyle(b), csD = getComputedStyle(document.body);
        return { hearthButtonKeepsDocumentPalette: csB.colorScheme === csD.colorScheme && csB.getPropertyValue('--surface') === csD.getPropertyValue('--surface') && csB.getPropertyValue('--text-2') === csD.getPropertyValue('--text-2'),
          gapTarget: gap && (gap.id || gap.tagName), todaysSelectorFromGap: gap && gap.closest('[data-theme]') && gap.closest('[data-theme]').tagName, fixedSelectorFromGap: gap && gap.closest('#themeSeg button') ? 'BUTTON' : null, segWidth: r.width };
      });
      await context.close();
    }
  } finally { await browser.close(); }
}

// verdicts
const both = f => Object.values(result.engines).every(f);
const R2ok = e => Object.values(e.R2).every(v => Object.values(v.kid).every(k => k.allRounded));
result.verdicts = {
  S1_allReadsResolve: result.static.S1.unresolved.length === 0,
  S2_everyThemeInEveryList: result.static.S2.every(t => Object.values(t).every(v => v !== false)),
  S3_avatarAndTileRulesReadTintToday: result.static.S3.todaysAvatarRuleReadsTint && result.static.S3.todaysAppIconRuleReadsTint,
  S3_proposalCoversHubAvatarHtml: result.static.S3.proposalMentionsAvatarHtml,
  S4_staleClaudeMdSentencesNamed: result.static.S4.filter(x => x.presentToday).every(x => x.namedInEditList),
  R1_noThemeDarkRootEqualsMidnightEveryMode: both(e => Object.values(e.R1).every(x => x.identical)),
  R2_kidRoundedOnRootAndNestedScopes: both(R2ok),
  R2_kioskLegacyPinnedEveryWidthAndNested: both(e => ['390x844', '1024x768', '1920x1080'].every(w => ['html', '#leaf'].every(s => { const k = e.R2[w].kiosk.kiosk[s], x = e.R2[w].kiosk.kioskXL[s];
    return k['--fs-sm'] === 18 && k['--fs-md'] === 22 && k['--fs-3xl'] === 56 && k['--fs-4xl'] === 84 && k['--sp-4'] === 16 && JSON.stringify(k) === JSON.stringify(x); }))),
  R2_tv10ftInertBelow1600LiveAt1920: both(e => e.R2['1024x768'].kiosk.kiosk10ft.html['--fs-floor'] === 18 && e.R2['1920x1080'].kiosk.kiosk10ft.html['--fs-floor'] === 28 && e.R2['1920x1080'].kiosk.kiosk10ft.html['--margin'] === 96),
  R3_identityKeptAfterBatch1a1b: both(e => !e.R3.verdict.avatarPaintsViewersColourNotMaes && !e.R3.verdict.appTilePaintsViewersColour),
  R4_switchStopsLiteralAnimation: both(e => parseFloat(e.R4.switchOnly.animationDuration) < 0.001),
  R4_osKillWithoutOptOut: both(e => parseFloat(e.R4.osOnly.animationDuration) < 0.001 && e.R4.osOnly.durSnappy === '150ms'),
  R4_optOutKeepsMotion: both(e => e.R4.osPlusOptOut.animationDuration === '1s' && e.R4.osPlusOptOut.durSnappy === '240ms'),
  R5_swatchIn7to1DocKeepsSwaps: both(e => e.R5.contrast.swatchKeeps7to1Swaps && e.R5.kiosk.swatchKeeps7to1Swaps),
  R5_nestedAccentIn7to1DocKeepsSwaps: both(e => e.R5.contrast.nestedAccentKeeps && e.R5.kiosk.nestedAccentKeeps),
  R6_info_forestGoldOnlyOnRootScope: both(e => e.R6.rootRadials === 2),   // informational: only body.ds paints --wash, and body never carries data-accent where it does
  R7_f260ButtonsAreData: both(e => e.R7.hearthButtonKeepsDocumentPalette && e.R7.fixedSelectorFromGap === null),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.verdicts, null, 1));
