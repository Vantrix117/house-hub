// Phase 4 TOK (4): the .ds component layer. Which areas put class="ds" on <body>, which design.css component classes each
// area actually uses in markup and JS-built markup, and — for the areas that keep their own component CSS — the rules
// that re-implement a shared component (buttons, chips, pills, sheets, cards, rows, toasts, tab bars, segmented controls,
// switches, inputs) with the values they choose for the properties the shared component fixes.
//   node audits/tools/phase4/TOK/components.mjs  → audits/evidence/p4/TOK/components.json
import fs from 'node:fs';
import path from 'node:path';
import { AREAS, OUT, readArea, areaCss, stripCssComments } from './lib-tok.mjs';

const D = readArea(AREAS[0]);
const dsCss = stripCssComments(D.raw);
const COMP = [...new Set([...dsCss.matchAll(/\.ds \.([a-z][\w-]*)/g)].map(m => m[1]))];
const PROPS = ['min-height', 'height', 'min-width', 'border-radius', 'padding', 'font-size', 'font-weight', 'background', 'border', 'box-shadow', 'transform', 'transition', 'backdrop-filter', 'color'];
const SHARED = {
  button: { selector: '.ds .btn', 'min-height': 'var(--tap)', 'border-radius': 'var(--r)', padding: '0 var(--sp-5)', 'font-weight': '600', 'font-size': 'var(--fs-md)', active: 'scale(.96)', transition: 'background var(--dur-1) var(--ease), transform var(--dur-2) var(--spring) …' },
  chip: { selector: '.ds .chip', 'min-height': '32px', 'border-radius': 'var(--r-full)', padding: '0 var(--sp-3)', 'font-weight': '600', 'font-size': 'var(--fs-sm)' },
  pill: { selector: '.ds .pill', 'min-height': '40px', 'border-radius': 'var(--r-full)', 'font-weight': '600', 'font-size': 'var(--fs-sm)' },
  sheet: { selector: '.ds .sheet', 'border-radius': 'var(--r-2xl) var(--r-2xl) 0 0', padding: 'var(--sp-3) var(--sp-5) …', animation: 'hub-rise var(--dur-3) var(--spring)' },
  card: { selector: '.ds .card', 'border-radius': 'var(--r-lg)', padding: 'var(--sp-5)', 'box-shadow': 'var(--e2)' },
  toast: { selector: '.ds .toast', 'border-radius': 'var(--r-full)', 'font-size': 'var(--fs-sm)', 'font-weight': '600' },
  row: { selector: '.ds .row', 'min-height': 'var(--tap-lg)', padding: 'var(--sp-3) var(--sp-4)' },
  input: { selector: '.ds .input', 'min-height': 'var(--tap)', 'border-radius': 'var(--r)', padding: 'var(--sp-3) var(--sp-4)', 'font-size': 'var(--fs-md)' },
  seg: { selector: '.ds .seg', 'border-radius': 'var(--r)', padding: '4px' },
  tabbar: { selector: '.ds .tabbar / .tab', 'min-height': '56px (tab)', 'font-size': 'var(--fs-xs)' },
  switch: { selector: '.ds .switch', height: '32px', 'border-radius': 'var(--r-full)' },
};
const kindOf = sel => {
  const last = sel.split(',').map(s => s.trim().split(/\s+/).pop());
  const s = last.join(' ');
  if (/switch|toggle/.test(s)) return 'switch';
  if (/(^|[^\w-])(seg|segmented)\b/.test(s)) return 'seg';
  if (/\b(toast|snack)\b/.test(s)) return 'toast';
  if (/sheet|modal|dialog|popover|\.pop\b/.test(s)) return 'sheet';
  if (/\b(tabbar|tabs|tab|nav)\b/.test(s) && !/btn/.test(s)) return 'tabbar';
  if (/chip|tag\b|badge/.test(s)) return 'chip';
  if (/\bpill\b/.test(s)) return 'pill';
  if (/(^|[\s,>.])button\b|\.btn|\.fab\b|\bbtn\b|\.b-|\.go\b|\.act\b|\.mark\b|\.prayed\b|\.primary\b/.test(s)) return 'button';
  if (/(^|[\s,>])(input|select|textarea)\b|\.field\b|\.input\b/.test(s)) return 'input';
  if (/\bcard\b|\.panel\b|\.tile\b/.test(s)) return 'card';
  if (/\b(row|item|li)\b/.test(s)) return 'row';
  return null;
};
const out = {};
for (const a of AREAS.slice(1)) {
  if (a.id === 'hub.js' || a.id === 'docs') continue;
  const A = readArea(a);
  const dsBody = /<body[^>]*class=["'][^"']*\bds\b/.test(A.raw) || /document\.body\.classList\.add\(\s*['"]ds['"]/.test(A.raw);
  // class usage in markup and JS-built markup
  const used = {};
  for (const m of A.raw.matchAll(/class(?:Name)?\s*=\s*\\?["'`]([^"'`]*)["'`]/g)) for (const c of m[1].split(/\s+/)) if (COMP.includes(c)) used[c] = (used[c] || 0) + 1;
  for (const m of A.raw.matchAll(/classList\.(?:add|toggle)\(\s*['"]([\w-]+)['"]/g)) if (COMP.includes(m[1])) used[m[1]] = (used[m[1]] || 0) + 1;
  // own component rules
  const own = {};
  for (const d of areaCss(A)) {
    if (!PROPS.includes(d.prop) && d.prop !== 'animation') continue;
    if (/@media print/.test(d.at.join(' '))) continue;
    const k = kindOf(d.selector); if (!k) continue;
    const reusesDs = /\.ds\s+\.(btn|chip|pill|sheet|card|toast|row|input|seg|tab|switch)/.test(d.selector);
    const key = d.selector.slice(0, 90);
    ((own[k] ||= {})[key] ||= { line: d.line, reusesDs, props: {} }).props[d.prop] = d.value.slice(0, 90);
  }
  const summary = Object.fromEntries(Object.entries(own).map(([k, rules]) => {
    const vals = p => [...new Set(Object.values(rules).map(r => r.props[p]).filter(Boolean))];
    return [k, { rules: Object.keys(rules).length, ownRules: Object.values(rules).filter(r => !r.reusesDs).length, radii: vals('border-radius'), minHeights: vals('min-height'), weights: vals('font-weight'), sizes: vals('font-size'), transforms: vals('transform'), transitions: vals('transition').length }];
  }));
  out[a.id] = { dsBody, dsComponentsUsed: used, dsComponentCount: Object.keys(used).length, ownComponentSummary: summary, ownRules: own };
}
fs.writeFileSync(path.join(OUT, 'components.json'), JSON.stringify({ dsComponents: COMP, shared: SHARED, areas: out }, null, 1));
console.log('ds components defined:', COMP.length);
for (const [k, v] of Object.entries(out)) {
  console.log(`\n${k}: body.ds=${v.dsBody} uses ${v.dsComponentCount} ds classes: ${Object.entries(v.dsComponentsUsed).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ':' + n).join(' ')}`);
  for (const [kind, s] of Object.entries(v.ownComponentSummary)) console.log(`   own ${kind}: ${s.ownRules}/${s.rules} rules; radii ${s.radii.join(' | ')}; min-h ${s.minHeights.join(' | ')}; weights ${s.weights.join(' | ')}; active ${s.transforms.join(' | ')}`.slice(0, 400));
}
