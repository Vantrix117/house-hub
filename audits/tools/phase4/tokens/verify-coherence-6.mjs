// Phase 4 · round 6 coherence verifier (independent of browser-check.mjs) · the revision-5 hero button row.
//   node audits/tools/phase4/tokens/verify-coherence-6.mjs [TOKENS.md]
// Reads the batch-1a row for `.ds .hero .btn-primary` out of TOKENS.md (the ```css block in the migration sequence), applies it
// IN PLACE of apps/design.css:423 (not appended at the end), and also applies the batch-1a `.ds .hero` rewrite (--hero-bg with
// --accent-ink) in place, over proposed-tokens.css + today's .ds component half. Serves that page from a fake origin
// (http://coherence6.test/) with every other request aborted, in WebKit and Chromium, and for 6 palettes x 9 people x 6 modes
// (adult, kid, kiosk, Increase Contrast, Reduce Transparency, kiosk + Reduce Transparency) reads:
//   - the button's computed background and colour vs the resolved --hero-btn-bg / --hero-btn-ink (canvas-normalised);
//   - the painted pixels (element screenshot: capsule pixel in the left padding, darkest/lightest label pixels) and their contrast;
//   - the label contrast over both hero stops; the capsule vs the hero backdrop next to it (boundary, reported only);
//   - today's rule (unchanged line 423) under the new tokens, for the record;
//   - hover (Chromium + WebKit, one light and one dark palette): the capsule stays.
// Writes audits/evidence/p4/tokens/verify-coherence-6.json. Always closes both browsers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { contrast as cr, over } from './colour-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const TOKMD = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'Temp', 'claude', 'C--Users-ex-bo-OneDrive-Claude-Related-App-Hub', 'ead87424-01af-4f71-ad5e-f00aad581d0b', 'scratchpad', 'p4', 'sections', 'TOKENS.md');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-coherence-6.json');
const H = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const md = fs.readFileSync(TOKMD, 'utf8');
const tokens = fs.readFileSync(path.join(HERE, 'proposed-tokens.css'), 'utf8');
const designLines = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8').split('\n');
const report = { tokensMd: TOKMD, static: {}, engines: {}, issues: [] };

// ── static: the row in TOKENS.md, the shipped rule, the order ────────────────────────────────
const blk = md.match(/hero button moves onto its pair[\s\S]*?```css\s*\n\s*(\.ds \.hero \.btn-primary \{[^\n]*\})\s*\n\s*```/);
const ROW = blk ? blk[1].trim() : null;
report.static.rowFromTokensMd = ROW;
const cj = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'contrast.json'), 'utf8'));
report.static.rowEqualsContrastJson = ROW === cj.heroButton?.row;
report.static.accent4RowQuotesSameRule = md.split('\n').some(l => l.startsWith('| ACCENT-4 |') && l.includes(ROW.replace(/;\s*\}$/, '; }')));
report.static.accent4Status = (md.split('\n').find(l => l.startsWith('| ACCENT-4 |')) || '').split(' | ').pop();
report.static.color3Status = (md.split('\n').find(l => l.startsWith('| COLOR-3 |')) || '').split(' | ').pop();
const idx = designLines.findIndex(l => l.startsWith('.ds .hero .btn-primary {'));
report.static.shippedLine = idx + 1;
report.static.shippedRule = designLines[idx];
const heroIdx = designLines.findIndex(l => l.startsWith('.ds .hero {'));
const hovers = designLines.map((l, i) => [l.trim(), i + 1]).filter(([l]) => /^\.ds \.btn(-primary)?:(hover|active|focus-visible)/.test(l));
report.static.stateRulesBefore = hovers.map(([l, n]) => ({ line: n, rule: l.slice(0, 80), before423: n < idx + 1 }));
// in-place application: line 423 -> ROW; .ds .hero background/colour -> --hero-bg / --accent-ink (batch 1a, the .ds .hero row)
const applied = designLines.slice();
applied[idx] = ROW;
let heroEnd = heroIdx; while (!applied[heroEnd].includes('}')) heroEnd++;
for (let i = heroIdx; i <= heroEnd; i++) {
  applied[i] = applied[i].replace(/^(\s*)color: var\(--on-accent\);/, '$1color: var(--accent-ink);').replace(/^(\s*)background: radial-gradient\([^;]*\);/, '$1background: var(--hero-bg);');
}
report.static.heroRewriteApplied = applied.slice(heroIdx, heroEnd + 1).join(' ').includes('var(--hero-bg)');
const COMP_ROW = applied.slice(289).join('\n');
const heroOnly = designLines.slice(); for (let i = heroIdx; i <= heroEnd; i++) heroOnly[i] = applied[i];
const COMP_TODAY = heroOnly.slice(289).join('\n');   // today's line 423, the hero already rewritten

const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const MODES = { adult: {}, kid: { 'data-kind': 'kid' }, kiosk: { 'data-kind': 'kiosk' }, 'contrast-more': { 'data-contrast': 'more' }, 'reduce-transparency': { 'data-transparency': 'reduce' }, 'kiosk+reduce-transparency': { 'data-kind': 'kiosk', 'data-transparency': 'reduce' } };
const HI = new Set(['kiosk', 'contrast-more', 'kiosk+reduce-transparency']);
const d255 = (a, b) => Math.max(...['r', 'g', 'b', 'a'].map(k => Math.abs(a[k] - b[k]) * 255));
const fl = x => Math.floor(x * 100 + 1e-9) / 100;
const page = comp => `<!doctype html><html><head><meta charset="utf-8"><title>c6</title><style>${tokens}\n${comp}\nbody{margin:0;padding:24px;width:600px}</style></head><body class="ds">
<div class="hero me-hero" id="hero"><div class="grow"><div class="hero-kicker">Adult</div><div class="hero-title">Eli</div></div>
<button class="btn btn-primary" id="hb" style="padding-left:28px">Switch</button></div><i id="ref"></i></body></html>`;

for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = { version: null, aborted: [], served: 0 };
  try {
    E.version = browser.version();
    for (const variant of ['row', 'today']) {
      const html = page(variant === 'row' ? COMP_ROW : COMP_TODAY);
      const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
      await ctx.route('**/*', r => { const u = r.request().url(); if (u === 'http://coherence6.test/') { E.served++; return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); } E.aborted.push(u); return r.abort(); });
      const p = await ctx.newPage();
      await p.goto('http://coherence6.test/');
      const V = { contexts: 0, engineEqualsTokens: 0, pixelEqualsTokens: 0, min: {}, pixelMin: {}, boundaryMin: {}, boundaryMax: {}, bad: [] };
      for (const [theme, scheme] of Object.entries(THEMES)) for (const accent of PEOPLE) for (const [mode, extra] of Object.entries(MODES)) {
        await p.evaluate(a => { const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name); for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); document.getAnimations().forEach(an => an.finish()); }, { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': accent, 'data-kind': 'adult', ...extra });
        const g = await p.evaluate(() => {
          document.getAnimations().forEach(an => an.finish());
          const b = document.getElementById('hb'), ref = document.getElementById('ref'), cs = getComputedStyle(b);
          const cv = (window.__cv ??= document.createElement('canvas')); cv.width = cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true });
          const norm = s => { x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = s; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }; };
          const tok = t => { ref.style.color = `var(${t})`; return norm(getComputedStyle(ref).color); };
          const r = b.getBoundingClientRect(), hr = document.getElementById('hero').getBoundingClientRect();
          return { bg: norm(cs.backgroundColor), bgImage: cs.backgroundImage, ink: norm(cs.color), tbg: tok('--hero-btn-bg'), tink: tok('--hero-btn-ink'), wash: tok('--accent-wash'), fill: tok('--accent-fill'),
            rect: { x: r.x, y: r.y, w: r.width, h: r.height }, hero: { x: hr.x, y: hr.y, w: hr.width, h: hr.height } };
        });
        // pixels: the button plus 10 px around it
        const clip = { x: Math.floor(g.rect.x) - 10, y: Math.floor(g.rect.y), width: Math.ceil(g.rect.w) + 20, height: Math.ceil(g.rect.h) };
        const png = (await p.screenshot({ clip, animations: 'disabled' })).toString('base64');
        const px = await p.evaluate(async ({ png, w, h }) => {
          const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
          const at = (i, j) => { const d = x.getImageData(i, j, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: 1 }; };
          const cy = Math.floor(img.height / 2);
          const capsule = at(10 + 8, cy), outside = at(3, cy);
          // label pixels: scan the text area and keep the extreme luminance
          const L = q => 0.2126 * q.r + 0.7152 * q.g + 0.0722 * q.b; let lo = capsule, hi = capsule;
          for (let i = 10 + 28; i < img.width - 10 - 16; i++) for (let j = 4; j < img.height - 4; j++) { const q = at(i, j); if (L(q) < L(lo)) lo = q; if (L(q) > L(hi)) hi = q; }
          return { capsule, outside, lo, hi };
        }, { png });
        const T = HI.has(mode) ? 7 : 4.5, key = scheme + (HI.has(mode) ? ' 7:1 modes' : '');
        const c = Math.min(...[g.wash, g.fill].map(st => { const b0 = g.bg.a < 0.999 ? over(g.bg, st) : g.bg; return cr(g.ink.a < 0.999 ? over(g.ink, b0) : g.ink, b0); }));
        const labelPx = Math.abs(cr(px.lo, px.capsule) - 1) > Math.abs(cr(px.hi, px.capsule) - 1) ? px.lo : px.hi;
        const cPix = cr(labelPx, px.capsule), bnd = cr(px.capsule, px.outside);
        V.contexts++;
        V.min[key] = Math.min(V.min[key] ?? Infinity, fl(c));
        V.pixelMin[key] = Math.min(V.pixelMin[key] ?? Infinity, fl(cPix));
        V.boundaryMin[scheme] = Math.min(V.boundaryMin[scheme] ?? Infinity, fl(bnd)); V.boundaryMax[scheme] = Math.max(V.boundaryMax[scheme] ?? 0, fl(bnd));
        if (variant === 'row') {
          const same = d255(g.bg, g.tbg) <= 1.5 && d255(g.ink, g.tink) <= 1.5 && g.bgImage === 'none';
          const pixSame = d255(px.capsule, g.tbg) <= 2.5;
          if (same) V.engineEqualsTokens++; if (pixSame) V.pixelEqualsTokens++;
          if (!same || !pixSame || c < T || cPix < T - 0.3) V.bad.push({ theme, accent, mode, c: +c.toFixed(3), cPix: +cPix.toFixed(3), same, pixSame, bgImage: g.bgImage });
        }
      }
      // hover: the capsule stays (row variant only), one light and one dark palette
      if (variant === 'row') {
        V.hover = [];
        for (const [theme, scheme] of [['hearth', 'light'], ['midnight', 'dark']]) {
          await p.evaluate(a => { const h = document.documentElement; for (const x of [...h.attributes]) h.removeAttribute(x.name); for (const [k, v] of Object.entries(a)) h.setAttribute(k, v); }, { 'data-theme': theme, 'data-scheme': scheme, 'data-accent': 'butter', 'data-kind': 'adult' });
          await p.mouse.move(700, 580); await p.waitForTimeout(400);
          const rest = await p.evaluate(() => { document.getAnimations().forEach(a => a.finish()); const s = getComputedStyle(document.getElementById('hb')); return s.backgroundColor + '|' + s.backgroundImage; });
          await p.hover('#hb'); await p.waitForTimeout(500);
          const hov = await p.evaluate(() => { document.getAnimations().forEach(a => a.finish()); const s = getComputedStyle(document.getElementById('hb')); return { v: s.backgroundColor + '|' + s.backgroundImage, media: matchMedia('(hover: hover) and (pointer: fine)').matches, hovered: document.getElementById('hb').matches(':hover') }; });
          V.hover.push({ theme, rest, hover: hov.v, media: hov.media, hovered: hov.hovered, keeps: rest === hov.v });
          await p.mouse.move(700, 580);
        }
      }
      E[variant] = V;
      await ctx.close();
    }
  } finally { await browser.close(); }
  report.engines[name] = E;
}

// ── verdicts ───────────────────────────────────────────────────────────────────────────────
const claims = { light: 6.58, dark: 6.86, 'light 7:1 modes': 9.37, 'dark 7:1 modes': 8.35 };
const checks = [];
const ck = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
ck('row found in TOKENS.md and equals contrast.json heroButton.row', ROW && report.static.rowEqualsContrastJson, ROW);
ck('ACCENT-4 row quotes the same rule; ACCENT-4 and COLOR-3 are T+R', report.static.accent4RowQuotesSameRule && /^T\+R/.test(report.static.accent4Status) && /^T\+R/.test(report.static.color3Status), [report.static.accent4Status, report.static.color3Status]);
ck('shipped rule at apps/design.css:423 is the one the row replaces', idx + 1 === 423 && /rgba\(255,255,255,\.92\); color: var\(--accent-deep\)/.test(report.static.shippedRule), report.static.shippedRule);
ck('every same-specificity .btn/.btn-primary state rule is before line 423', report.static.stateRulesBefore.every(s => s.before423), report.static.stateRulesBefore);
for (const [n, E] of Object.entries(report.engines)) {
  ck(`${n}: no request left the fake origin`, E.aborted.length === 0 && E.served === 2, { served: E.served, aborted: E.aborted });
  ck(`${n}: 324/324 contexts paint --hero-btn-bg / --hero-btn-ink (computed, no gradient left)`, E.row.engineEqualsTokens === 324, E.row.engineEqualsTokens);
  ck(`${n}: 324/324 capsule pixels equal --hero-btn-bg`, E.row.pixelEqualsTokens === 324, E.row.pixelEqualsTokens);
  ck(`${n}: row label passes 4.5 / 7 over both hero stops and minima match TOKENS.md`, E.row.bad.length === 0 && Object.entries(claims).every(([k, v]) => Math.abs(E.row.min[k] - v) <= 0.011), { min: E.row.min, claims, bad: E.row.bad.slice(0, 5) });
  ck(`${n}: today's rule under the new tokens fails in dark (~1.19-1.20) and is >= 6.47 in light`, E.today.min.dark <= 1.21 && E.today.min.light >= 6.46, E.today.min);
  ck(`${n}: hovering keeps the capsule (hover media matched and :hover applied)`, E.row.hover.every(h => h.keeps && h.media && h.hovered), E.row.hover);
}
report.checks = checks;
report.ok = checks.every(c => c.ok);
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
for (const c of checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.id + (c.ok ? '' : '  ' + JSON.stringify(c.detail).slice(0, 400)));
for (const [n, E] of Object.entries(report.engines)) console.log(n, E.version, 'row', JSON.stringify(E.row.min), 'pix', JSON.stringify(E.row.pixelMin), 'boundary', JSON.stringify(E.row.boundaryMin), JSON.stringify(E.row.boundaryMax), 'today', JSON.stringify(E.today.min), 'todayBoundary', JSON.stringify(E.today.boundaryMin));
console.log('ok', report.ok);
process.exitCode = report.ok ? 0 : 1;
