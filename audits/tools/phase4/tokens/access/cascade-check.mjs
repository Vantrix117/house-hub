#!/usr/bin/env node
// Cross-check the token resolver in contrast.mjs against a real engine (WebKit, the iPad's engine).
//   node audits/tools/phase4/tokens/access/cascade-check.mjs <tokens.css> <contrast.json>
// For every opaque token pair recorded in contrast.json, sets the same attributes on <html> in a blank
// WebKit page that loads tokens.css, paints the token through `color: var(--x)` on a probe and compares
// the engine's resolved colour with the hex the resolver used. No server, no network; closes the browser.
import fs from 'node:fs';
import { playwright } from '../../../lib/local.mjs';

const [cssPath, jsonPath] = process.argv.slice(2);
const css = fs.readFileSync(cssPath, 'utf8');
const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark' };
const todo = new Map();   // state -> Map(token -> expected hex)
for (const c of report.checks) {
  if (!/^[A-E]/.test(c.id)) continue;
  for (const row of [c.worst, ...(c.fails || [])]) {
    const parts = row.state.split('/'); if (!THEMES[parts[0]]) continue;
    const st = parts.join('/');
    if (!todo.has(st)) todo.set(st, new Map());
    if (/^--/.test(row.fg) && /^#/.test(row.fgHex || '')) todo.get(st).set(row.fg, row.fgHex);
    if (/^--/.test(row.bg) && /^#/.test(row.bgHex || '')) todo.get(st).set(row.bg, row.bgHex);
  }
}
// add a dense sample: every accent role and every neutral in every theme x accent (standard, normal)
const ROLES = ['--text', '--text-2', '--text-3', '--bg', '--surface', '--surface-raised', '--well', '--edge', '--accent-ink', '--accent-fill', '--accent-graphic', '--accent-solid', '--accent-on-solid', '--focus-color', '--sel-fill', '--hero-btn-bg', '--hero-btn-ink', '--switch-on', '--switch-knob-on', '--toast-action'];
const expectedFromReport = new Map();
for (const c of report.checks) if (c.worst) expectedFromReport.set(c.worst.state + '|' + c.worst.fg, c.worst.fgHex);
const pw = playwright();
const browser = await pw.webkit.launch({ headless: true });
const results = { checked: 0, mismatches: [], sampled: 0, engine: 'webkit ' + browser.version() };
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><i id="p"></i></body></html>`);
  const read = (attrs, tokens) => page.evaluate(({ attrs, tokens }) => {
    const h = document.documentElement;
    for (const a of [...h.attributes]) if (a.name.startsWith('data-')) h.removeAttribute(a.name);
    for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v);
    const p = document.getElementById('p'); const out = {};
    const hex = s => { const m = s.match(/[\d.]+/g).map(Number); return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() + (m.length > 3 && m[3] < 1 ? '@' + m[3] : ''); };
    for (const t of tokens) { p.style.color = `var(${t})`; out[t] = hex(getComputedStyle(p).color); }
    return out;
  }, { attrs, tokens });
  const attrsOf = st => { const [theme, contrast, transparency, accent] = st.split('/'); return { 'data-theme': theme, 'data-scheme': THEMES[theme], 'data-contrast': contrast, 'data-transparency': transparency, 'data-accent': accent || 'graphite', 'data-kind': 'adult' }; };
  for (const [st, toks] of todo) {
    const got = await read(attrsOf(st), [...toks.keys()]);
    for (const [t, exp] of toks) { results.checked++; if (got[t] !== exp.toUpperCase()) results.mismatches.push({ state: st, token: t, resolver: exp, webkit: got[t] }); }
  }
  // dense sample: the engine's values, recorded so contrast.mjs's resolver can be diffed against them
  results.sample = {};
  for (const theme of Object.keys(THEMES)) for (const accent of ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite']) {
    const st = `${theme}/standard/normal/${accent}`;
    results.sample[st] = await read(attrsOf(st), ROLES); results.sampled += ROLES.length;
    const exp = (report.resolved || {})[st] || {};
    for (const t of ROLES) if (exp[t]) { results.checked++; if (exp[t] !== results.sample[st][t]) results.mismatches.push({ state: st, token: t, resolver: exp[t], webkit: results.sample[st][t] }); }
  }
} finally { await browser.close(); }
fs.writeFileSync(jsonPath.replace(/\.json$/, '-webkit.json'), JSON.stringify(results, null, 1));
console.log(`${results.engine}: ${results.checked} recorded token values checked, ${results.mismatches.length} mismatches; ${results.sampled} role values sampled`);
if (results.mismatches.length) console.log(JSON.stringify(results.mismatches.slice(0, 10), null, 1));
process.exit(results.mismatches.length ? 1 : 0);
