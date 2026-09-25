// Phase 4 TOK (1): the full token inventory of apps/design.css — every custom property, its declared value in each theme
// block, the dark-scheme block, the .tp swatch copies and the kid/kiosk blocks — plus each token RESOLVED at runtime in
// WebKit for every theme (and Hearth on a dark OS, the P2-VIS-03 path), and kid/kiosk for the size tokens.
//   node audits/tools/phase4/TOK/tokens.mjs            → audits/evidence/p4/TOK/tokens-inventory.json, tokens-resolved.json
// Runtime: a blank WebKit page with design.css inlined (no server, no Worker, no network). Colours are resolved by applying
// the token to a probe's `color`; lengths through `width`. Nothing else is loaded.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, parseDesignCss, category } from './lib-tok.mjs';
import { playwright } from '../../lib/local.mjs';

const { A, tokens, componentLocal } = parseDesignCss();
const COLS = ['hearth', 'parchment', 'frost', 'midnight', 'system-dark', 'forest', 'tp-forest', 'tp-hearth', 'tp-system-half', 'kid', 'kiosk'];
const inv = Object.values(tokens).map(t => ({ name: t.name, category: category(t.name), values: t.values, lines: t.lines,
  overriddenIn: COLS.filter(c => c !== 'hearth' && t.values[c] !== undefined) }));
// duplicate-block check: which theme blocks are byte-identical copies of another
const same = (a, b) => inv.every(t => (t.values[a] ?? null) === (t.values[b] ?? null) || t.values[a] === undefined || t.values[b] === undefined);
const dupes = [['midnight', 'system-dark'], ['midnight', 'tp-system-half'], ['forest', 'tp-forest'], ['hearth', 'tp-hearth']].map(([a, b]) => {
  const keysA = inv.filter(t => t.values[a] !== undefined).map(t => t.name), keysB = inv.filter(t => t.values[b] !== undefined).map(t => t.name);
  const diff = inv.filter(t => t.values[a] !== undefined && t.values[b] !== undefined && t.values[a] !== t.values[b]).map(t => [t.name, t.values[a], t.values[b]]);
  return { a, b, tokensA: keysA.length, tokensB: keysB.length, onlyInA: keysA.filter(k => !keysB.includes(k)), onlyInB: keysB.filter(k => !keysA.includes(k)), differing: diff };
});
// tokens a theme block does NOT override (inherit Hearth's :root value or re-resolve against the theme)
const themeCols = ['parchment', 'frost', 'midnight', 'system-dark', 'forest'];
const notOverridden = inv.filter(t => t.values.hearth !== undefined && themeCols.every(c => t.values[c] === undefined)).map(t => ({ name: t.name, category: t.category, value: t.values.hearth }));
const partly = inv.filter(t => { const n = themeCols.filter(c => t.values[c] !== undefined).length; return n > 0 && n < themeCols.length; }).map(t => ({ name: t.name, in: themeCols.filter(c => t.values[c] !== undefined) }));
const byCat = {}; for (const t of inv) (byCat[t.category] ||= []).push(t.name);

// ---------- runtime ----------
const FAMILY = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58' };
const SCEN = [
  { id: 'hearth', theme: null, os: 'light' }, { id: 'parchment', theme: 'parchment', os: 'light' }, { id: 'frost', theme: 'frost', os: 'light' },
  { id: 'midnight', theme: 'midnight', os: 'light' }, { id: 'forest', theme: 'forest', os: 'light' },
  { id: 'system-light', theme: null, os: 'light' }, { id: 'system-dark', theme: null, os: 'dark' },
  { id: 'hearth-on-dark-os', theme: null, os: 'dark', note: 'hub.js deletes data-theme for an explicit Hearth too (apps/hub.js:77) → same tokens as system-dark' },
  { id: 'kid', theme: null, os: 'light', kind: 'kid' }, { id: 'kiosk', theme: null, os: 'light', kind: 'kiosk' },
];
// colour tokens: a literal colour, a color-mix, or a var() alias of a colour token (resolved through the Hearth values)
const isCol = (v, seen = 0) => { if (!v || seen > 5) return false; if (/^(#|rgba?\(|color-mix\()/.test(v)) return true; const m = v.match(/^var\((--[\w-]+)\)$/); return !!(m && tokens[m[1]] && isCol(tokens[m[1]].values.hearth, seen + 1)); };
const COLOUR = inv.filter(t => isCol(t.values.hearth)).map(t => t.name);
const css = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
const pw = playwright();
const browser = await pw.webkit.launch({ headless: true });
const resolved = {};
try {
  for (const s of SCEN) {
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, colorScheme: s.os });
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="ds"><div id="p"></div></body></html>`);
    resolved[s.id] = await page.evaluate(({ names, colourNames, theme, kind }) => {
      const root = document.documentElement; if (theme) root.dataset.theme = theme; if (kind) root.dataset.kind = kind;
      const p = document.getElementById('p'); const cs = getComputedStyle(root); const out = {};
      const toRgb = v => { const m = v.match(/-?[\d.]+(?:e-?\d+)?/g); if (!m) return v; const n = m.map(Number); if (/^color\(/.test(v)) return `rgb(${n.slice(0, 3).map(x => Math.round(Math.min(1, Math.max(0, x)) * 255)).join(', ')}${n.length > 3 && n[3] < 1 ? ', ' + +n[3].toFixed(3) : ''})`; return v; };
      for (const n of names) {
        const raw = cs.getPropertyValue(n).trim(); let val = raw;
        if (colourNames.includes(n)) {
          p.style.color = ''; p.style.color = `var(${n})`; val = toRgb(getComputedStyle(p).color);
        } else if (/^(-?[\d.]+px|clamp\(|env\()/.test(raw)) { p.style.width = ''; p.style.width = `var(${n})`; val = getComputedStyle(p).width; }
        out[n] = raw === val ? raw : { raw, resolved: val };
      }
      out.__scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      return out;
    }, { names: inv.map(t => t.name), colourNames: COLOUR, theme: s.theme, kind: s.kind });
    await ctx.close();
  }
} finally { await browser.close(); }

fs.writeFileSync(path.join(OUT, 'tokens-inventory.json'), JSON.stringify({ source: 'apps/design.css', count: inv.length, byCategory: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length])), tokens: inv, componentLocal, duplicateBlocks: dupes, notOverriddenByAnyTheme: notOverridden, overriddenByOnlySomeThemes: partly }, null, 1));
fs.writeFileSync(path.join(OUT, 'tokens-resolved.json'), JSON.stringify({ engine: 'webkit', viewport: '820x1180', scenarios: SCEN, familyColours: FAMILY, resolved }, null, 1));
console.log('tokens', inv.length, JSON.stringify(Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length]))));
console.log('component-local custom properties', componentLocal.map(c => `${c.name}@${c.line}`).join(' '));
for (const d of dupes) console.log(`dup ${d.a} vs ${d.b}: ${d.tokensA}/${d.tokensB} tokens, differing ${d.differing.length}, only in ${d.a}: ${d.onlyInA.join(',') || '-'}, only in ${d.b}: ${d.onlyInB.join(',') || '-'}`);
console.log('not overridden by any theme:', notOverridden.map(t => t.name).join(' '));
console.log('overridden by only some themes:', JSON.stringify(partly));
console.log('hearth-on-dark-os --bg', JSON.stringify(resolved['hearth-on-dark-os']['--bg']), 'system-dark --bg', JSON.stringify(resolved['system-dark']['--bg']));
