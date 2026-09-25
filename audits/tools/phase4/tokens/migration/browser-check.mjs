// Cross-checks contrast.mjs against real engines: loads the proposed tokens.css into a blank page in WebKit and in
// Chromium (no server, no app code), sets the same <html> attributes as each contrast.mjs scenario, resolves every token
// a recorded pair uses through getComputedStyle on a probe, and compares the engine's colour with the hex contrast.mjs
// recorded. Also reports engine support for the CSS features the tokens rely on (color-mix in oklab, round(), linear()).
//   node audits/tools/phase4/tokens/migration/browser-check.mjs <tokens.css> <contrast.json> [out.json]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as C from './color.mjs';

const [cssFile, resFile, outFile] = process.argv.slice(2);
const H = process.env.LOCALAPPDATA + '/house-hub-audit';
const req = createRequire(H + '/noop.js'); process.env.PLAYWRIGHT_BROWSERS_PATH = H + '/browsers';
const { webkit, chromium } = req('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const css = fs.readFileSync(cssFile, 'utf8');
const { results } = JSON.parse(fs.readFileSync(resFile, 'utf8'));

const THEMES = {
  'system-light': { 'data-theme': 'system', 'data-scheme': 'light' }, frost: { 'data-theme': 'frost', 'data-scheme': 'light' },
  hearth: { 'data-theme': 'hearth', 'data-scheme': 'light' }, parchment: { 'data-theme': 'parchment', 'data-scheme': 'light' },
  'system-dark': { 'data-theme': 'system', 'data-scheme': 'dark' }, graphite: { 'data-theme': 'graphite', 'data-scheme': 'dark' },
  midnight: { 'data-theme': 'midnight', 'data-scheme': 'dark' }, forest: { 'data-theme': 'forest', 'data-scheme': 'dark' },
};
const MODE = { default: {}, 'contrast-more': { 'data-contrast': 'more' }, 'reduce-transparency': { 'data-transparency': 'reduce' } };
const plain = n => (n && /^--[\w-]+( \(|$)/.test(n) && !/ over |top stop/.test(n)) ? n.split(' ')[0] : null;
// group the recorded pairs by scenario, keep those whose both sides are plain opaque tokens
const jobs = new Map();
for (const r of results) {
  if (!['text', 'non-text', 'large-text'].includes(r.kind)) continue;
  const f = plain(r.fg), b = plain(r.bg); if (!f || !b) continue;
  const key = `${r.theme}|${r.mode}|${r.accent}`;
  if (!jobs.has(key)) jobs.set(key, { theme: r.theme, mode: r.mode, accent: r.accent, pairs: [] });
  jobs.get(key).pairs.push({ f, b, fgHex: r.fgHex, bgHex: r.bgHex, ratio: r.ratio });
}

function parseComputed(s) {
  let m = s.match(/^rgba?\(([^)]*)\)$/);
  if (m) { const a = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255, a: a[3] ?? 1 }; }
  m = s.match(/^color\(srgb ([^)]*)\)$/);
  if (m) { const a = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a[3] ?? 1 }; }
  m = s.match(/^oklab\(([^)]*)\)$/);
  if (m) { const a = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return C.fromOklab({ L: a[0], a: a[1], b: a[2], alpha: a[3] ?? 1 }); }
  throw new Error('computed colour not understood: ' + s);
}

const summary = {};
for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  try {
    const page = await browser.newPage({ viewport: { width: 820, height: 600 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><i id="p"></i></body></html>`);
    const support = await page.evaluate(() => ({
      colorMixOklab: CSS.supports('color', 'color-mix(in oklab, red 20%, blue)'),
      round: CSS.supports('width', 'round(nearest, 13px, 4px)'),
      linearEasing: CSS.supports('transition-timing-function', 'linear(0, 0.5 40%, 1)'),
      springToken: CSS.supports('transition-timing-function', getComputedStyle(document.documentElement).getPropertyValue('--spring-bouncy').trim()),
      maxFn: CSS.supports('width', 'max(11px, calc(17px * 1.2))'),
      oklabColor: CSS.supports('color', 'oklab(0.5 0.1 0.1)'),
    }));
    let checked = 0, mismatch = 0, maxDelta = 0, maxRatioDelta = 0; const bad = [];
    for (const job of jobs.values()) {
      const attrs = { ...THEMES[job.theme], ...MODE[job.mode], 'data-kind': 'adult', 'data-accent': job.accent };
      const toks = [...new Set(job.pairs.flatMap(p => [p.f, p.b]))];
      const got = await page.evaluate(({ attrs, toks }) => {
        const h = document.documentElement; for (const a of [...h.attributes]) h.removeAttribute(a.name);
        for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v);
        const p = document.getElementById('p'); const out = {};
        for (const t of toks) { p.style.color = `var(${t})`; out[t] = getComputedStyle(p).color; }
        return out;
      }, { attrs, toks });
      for (const pr of job.pairs) {
        const f = parseComputed(got[pr.f]), b = parseComputed(got[pr.b]);
        const dF = Math.max(...['r', 'g', 'b'].map(k => Math.abs(f[k] - C.parseHex(pr.fgHex)[k]))) * 255;
        const dB = Math.max(...['r', 'g', 'b'].map(k => Math.abs(b[k] - C.parseHex(pr.bgHex)[k]))) * 255;
        const ratio = C.contrast(f, b); const dR = Math.abs(ratio - pr.ratio);
        checked++; maxDelta = Math.max(maxDelta, dF, dB); maxRatioDelta = Math.max(maxRatioDelta, dR);
        if (dF > 1.5 || dB > 1.5 || dR > 0.03) { mismatch++; if (bad.length < 20) bad.push({ ...job, pairs: undefined, f: pr.f, b: pr.b, engineFg: got[pr.f], engineBg: got[pr.b], recorded: [pr.fgHex, pr.bgHex, pr.ratio], engineRatio: +ratio.toFixed(2) }); }
      }
    }
    // lengths the scale checks rely on (kid on an iPhone, kiosk on the TV)
    const lengths = {};
    for (const [label, vw, attrs] of [['adult-430', 430, { 'data-kind': 'adult' }], ['kid-820', 820, { 'data-kind': 'kid' }], ['kiosk-1920', 1920, { 'data-kind': 'kiosk' }]]) {
      await page.setViewportSize({ width: vw, height: 800 });
      lengths[label] = await page.evaluate(attrs => {
        const h = document.documentElement; for (const a of [...h.attributes]) h.removeAttribute(a.name);
        h.setAttribute('data-theme', 'system'); h.setAttribute('data-scheme', 'light'); for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v);
        const p = document.getElementById('p'); p.style.display = 'block'; const o = {};
        for (const t of ['--fs-body', '--fs-caption-2', '--fs-large-title', '--tap', '--pad-card', '--r-control', '--r-card', '--margin', '--icon-md']) { p.style.width = `var(${t})`; o[t] = getComputedStyle(p).width; }
        return o;
      }, attrs);
    }
    summary[name] = { version: browser.version(), support, pairsChecked: checked, mismatches: mismatch, maxChannelDelta255: +maxDelta.toFixed(2), maxRatioDelta: +maxRatioDelta.toFixed(3), examples: bad, lengths };
  } finally { await browser.close(); }
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
