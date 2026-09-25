// Phase 4 TOK (2): token usage matrix. For every area (design.css's own component layer, the shell, the nine apps,
// docs/design.html, apps/hub.js) count every var(--x) reference; classify each name as a design.css token, a design.css
// component-local variable (--g, --size), a variable hub.js writes at runtime (--accent, --sheen-x), a token the area
// defines itself, or undefined (with its var() fallback, which is what renders). List every locally defined custom
// property with its value(s) and what design token it duplicates or should become.
//   node audits/tools/phase4/TOK/usage.mjs   → audits/evidence/p4/TOK/usage-matrix.json, local-tokens.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, AREAS, OUT, readArea, areaCss, inlineDecls, parseDesignCss, category, blank } from './lib-tok.mjs';

const { tokens: DT, componentLocal } = parseDesignCss();
const DESIGN = new Set(Object.keys(DT));
const DLOCAL = new Set(componentLocal.map(c => c.name));
const hubRaw = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
const HUBSET = new Set([...hubRaw.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)].map(m => m[1]));

const matrix = {}; const perArea = {};
for (const a of AREAS) {
  const A = readArea(a);
  // references: whole file, CSS comments blanked; the Dollywood payload JSON line is data (skipped by blocks()), but a
  // raw scan of the whole file is still correct because var( never occurs in it.
  const src = a.kind === 'js' ? A.raw.replace(/\/\*[\s\S]*?\*\//g, blank) : A.raw.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
  const refs = {}; const fallbacks = [];
  for (const m of src.matchAll(/var\(\s*(--[\w-]+)(\$\{|`|\s*\+)?\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g)) {
    let name = m[1]; if (m[2]) name += '*';   // built at runtime: --g-${group}
    refs[name] = (refs[name] || 0) + 1;
    if (m[3] !== undefined) fallbacks.push({ name, fallback: m[3].trim(), line: A.L(m.index) });
  }
  // local definitions (CSS custom properties outside design.css's token blocks, inline style, JS style strings, setProperty)
  const defs = {};
  const addDef = (name, value, line, where, selector) => { (defs[name] ||= []).push({ value: value.replace(/\s+/g, ' ').slice(0, 220), line, where, selector: (selector || '').slice(0, 90) }); };
  if (a.id !== 'design.css') {
    for (const d of areaCss(A)) if (d.prop.startsWith('--')) addDef(d.prop, d.value, d.line, 'css', d.selector);
    for (const d of inlineDecls(A)) if (d.prop.startsWith('--')) addDef(d.prop, d.value, d.line, d.src, d.selector);
    // JS object/strings that set custom properties: "--x:" inside string literals not caught above
    for (const b of A.scripts) { const js = A.raw.slice(b.start, b.end); for (const m of js.matchAll(/['"`;{\s](--[a-zA-Z][\w-]*)\s*:\s*([^;'"`}]{1,80})/g)) { const ln = A.L(b.start + m.index); if (!(defs[m[1]] || []).some(x => x.line === ln)) addDef(m[1], m[2], ln, 'js-string', ''); } }
  } else for (const c of componentLocal) addDef(c.name, c.value, c.line, 'css', c.selector);
  const classify = n => { const base = n.replace(/\*$/, ''); if (n.endsWith('*')) return 'dynamic'; if (defs[base] && a.id !== 'design.css') return DESIGN.has(base) ? 'local-shadows-design' : 'local'; if (DESIGN.has(base)) return 'design'; if (DLOCAL.has(base)) return 'design-component-local'; if (HUBSET.has(base)) return 'hub.js'; return 'undefined'; };
  const classes = {}; for (const n of Object.keys(refs)) classes[n] = classify(n);
  for (const [n, c] of Object.entries(refs)) { (matrix[n.replace(/\*$/, '')] ||= {})[a.id] = c; }
  const undef = Object.keys(refs).filter(n => classes[n] === 'undefined').map(n => ({ name: n, refs: refs[n], fallbacks: fallbacks.filter(f => f.name === n) }));
  perArea[a.id] = {
    file: a.file,
    varRefs: Object.values(refs).reduce((s, x) => s + x, 0),
    distinct: Object.keys(refs).length,
    designTokenRefs: Object.entries(refs).filter(([n]) => classes[n] === 'design').reduce((s, [, x]) => s + x, 0),
    designTokensUsed: Object.keys(refs).filter(n => classes[n] === 'design').length,
    localRefs: Object.entries(refs).filter(([n]) => /^local/.test(classes[n])).reduce((s, [, x]) => s + x, 0),
    localDefined: Object.keys(defs).length,
    localShadowingDesign: Object.keys(defs).filter(n => DESIGN.has(n) && a.id !== 'design.css'),
    undefined: undef,
    fallbacks,
    refs, classes, defs,
  };
}
// token × area matrix for design tokens
const areaIds = AREAS.map(a => a.id);
const rows = Object.keys(DT).map(n => { const r = { token: n, category: category(n) }; let tot = 0, appAreas = 0; for (const id of areaIds) { const c = (matrix[n] || {})[id] || 0; r[id] = c; tot += c; if (c && !['design.css', 'docs', 'hub.js'].includes(id)) appAreas++; } r.total = tot; r.areasOutsideDesignCssDocsHub = appAreas; return r; });
const unused = rows.filter(r => r.total === 0).map(r => r.token);
const onlyDocs = rows.filter(r => r.total > 0 && r.total === r.docs).map(r => r.token);
const onlyDesignCss = rows.filter(r => r.total > 0 && r.total === r['design.css'] + r.docs && r['design.css'] > 0 && r.areasOutsideDesignCssDocsHub === 0).map(r => r.token);
const notInAnyApp = rows.filter(r => r.areasOutsideDesignCssDocsHub === 0).map(r => r.token);
const catSummary = {}; for (const r of rows) { const c = (catSummary[r.category] ||= { tokens: 0, unused: 0, refsByArea: {} }); c.tokens++; if (!r.total) c.unused++; for (const id of areaIds) c.refsByArea[id] = (c.refsByArea[id] || 0) + r[id]; }

fs.writeFileSync(path.join(OUT, 'usage-matrix.json'), JSON.stringify({ areas: areaIds, hubJsSets: [...HUBSET], designComponentLocal: [...DLOCAL], rows, unused, onlyDocs, onlyDesignCssAndDocs: onlyDesignCss, notUsedByShellOrAnyApp: notInAnyApp, byCategory: catSummary,
  perArea: Object.fromEntries(Object.entries(perArea).map(([k, v]) => [k, { file: v.file, varRefs: v.varRefs, distinct: v.distinct, designTokenRefs: v.designTokenRefs, designTokensUsed: v.designTokensUsed, localRefs: v.localRefs, localDefined: v.localDefined, localShadowingDesign: v.localShadowingDesign, undefined: v.undefined, fallbacks: v.fallbacks }])) }, null, 1));
fs.writeFileSync(path.join(OUT, 'local-tokens.json'), JSON.stringify(Object.fromEntries(Object.entries(perArea).map(([k, v]) => [k, v.defs])), null, 1));

console.log('area'.padEnd(16), 'refs  distinct designRefs designUsed localDef localRefs shadow undefined fallbacks');
for (const [k, v] of Object.entries(perArea)) console.log(k.padEnd(16), String(v.varRefs).padEnd(5), String(v.distinct).padEnd(8), String(v.designTokenRefs).padEnd(10), String(v.designTokensUsed).padEnd(10), String(v.localDefined).padEnd(8), String(v.localRefs).padEnd(9), String(v.localShadowingDesign.length).padEnd(6), v.undefined.map(u => u.name + (u.fallbacks.length ? '(fb ' + u.fallbacks[0].fallback + ')' : '')).join(' ') || '-', v.fallbacks.length);
console.log('\nunused anywhere:', unused.join(' '));
console.log('only in docs/design.html:', onlyDocs.join(' '));
console.log('never used by the shell or any app:', notInAnyApp.join(' '));
for (const [k, v] of Object.entries(perArea)) if (v.localShadowingDesign.length) console.log('shadowing', k, v.localShadowingDesign.join(' '));
