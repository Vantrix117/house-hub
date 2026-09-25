// Phase 4 · tokens: sizes the Batch 1a pre-pass. Counts every read, BY PROPERTY, of a token whose meaning changes the
// moment proposed-tokens.css lands:
//   1. the bare legacy hues (--gold --olive --teal --terra --slate --mocha --ok --warn --danger --info), which become inks;
//   2. the same hues read THROUGH an app-local alias, followed transitively (F260 --g-* → --gc, Prayer --d0…--d7, the
//      Larder --ledger, the Dollywood template's --ochre / --moss / --forest / --clay → --gc …), which change with them;
//   3. --accent / --tint (in dark they flip from today's mid-tone profile hex to a light pastel);
//   4. the neutral aliases whose value changes (--muted-decor → --track-info, --line-soft → --separator, --bg-2 → --surface-2,
//      --glass-line → --glass-ring).
// A property class is text (color, caret, text-fill), svg (stroke / fill), surface (background, border, outline, shadow)
// or other. Dynamic names built in JS ('--gc:var(--g-' + g + ')') count as reading every local of that prefix.
//   node audits/tools/phase4/tokens/legacy-reads.mjs  → audits/evidence/p4/tokens/legacy-reads.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const TEMPLATE = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');
const files = ['index.html', 'apps/design.css', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => /\.html$/.test(f)).map(f => 'apps/' + f)];
if (fs.existsSync(TEMPLATE)) files.push('template.html');
const HUES = ['gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger', 'info'].map(n => '--' + n);
const PERSON = ['--accent', '--tint'];
const NEUTRAL = ['--muted-decor', '--line-soft', '--bg-2', '--glass-line'];
const cls = p => /^(color|-webkit-text-fill-color|caret-color|text-decoration-color)$/.test(p) ? 'text'
  : /^(stroke|fill)/.test(p) ? 'svg stroke/fill'
  : /^(background|border|outline|box-shadow|column-rule)/.test(p) ? 'surface (background/border/outline/shadow)' : 'other (' + p + ')';
const varsIn = v => [...v.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]);
const out = { method: 'declarations parsed per file; local aliases followed transitively; design.css scanned from its component half (line 290)', files: {}, totals: {} };
const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
for (const f of files) {
  let t = fs.readFileSync(f === 'template.html' ? TEMPLATE : path.join(ROOT, f), 'utf8');
  if (f === 'apps/design.css') t = t.split('\n').slice(289).join('\n');        // the token half is what the proposal replaces
  // local definitions: CSS declarations, inline style strings, JS strings that write a custom property
  const defs = {};
  for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;{}"]*)/g)) (defs[m[1]] ??= new Set()), varsIn(m[2]).forEach(v => defs[m[1]].add(v));
  const expand = n => (n.endsWith('-') ? Object.keys(defs).filter(k => k.startsWith(n)) : [n]);
  // transitive taint: a local that reads a bare hue (directly or through another local)
  const via = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, refs] of Object.entries(defs)) {
      if (via[k] || HUES.includes(k)) continue;
      for (const r0 of refs) for (const r of expand(r0)) {
        if (HUES.includes(r) || via[r]) { via[k] = HUES.includes(r) ? r : `${r} → ${via[r]}`; changed = true; break; }
      }
    }
  }
  const rec = { localAliasesOfBareHues: via, direct: {}, throughAliases: {}, byAlias: {}, person: {}, neutral: {} };
  for (const m of t.matchAll(/(?:^|[;{\s"'`])(-?[a-z][a-z-]*)\s*:\s*([^;{}]*)/g)) {
    const prop = m[1]; if (prop === 'http' || prop === 'https' || prop === 'data') continue;
    const c = cls(prop);
    for (const v0 of varsIn(m[2])) for (const v of expand(v0)) {
      if (HUES.includes(v)) add(rec.direct, c);
      else if (via[v]) { add(rec.throughAliases, c); (rec.byAlias[v] ??= {}); add(rec.byAlias[v], c); }
      if (PERSON.includes(v)) add(rec.person, `${v} | ${c}`);
      if (NEUTRAL.includes(v)) add(rec.neutral, `${v} | ${c}`);
      if (expand(v0).length > 1) break;                                        // a dynamic prefix counts once
    }
  }
  out.files[f === 'template.html' ? '../dollywood-build-project/scripts/template.html (the Dollywood pair\'s source)' : f] = rec;
  const T = out.totals;
  for (const [k, n] of Object.entries(rec.direct)) add(T[`bare hue, direct | ${k}`] ??= {}, 'n', n);
  for (const [k, n] of Object.entries(rec.throughAliases)) add(T[`bare hue through a local alias | ${k}`] ??= {}, 'n', n);
}
// flatten totals; the two exported Dollywood files and the template are the same CSS, so give totals without the template too
const flat = {}; for (const [k, v] of Object.entries(out.totals)) flat[k] = v.n; out.totals = flat;
out.note = 'apps/dollywood.html and apps/dollywood-live.html are exported from the template: their reads change in ONE place (the template), then export.';
fs.mkdirSync(path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'legacy-reads.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.totals, null, 1));
for (const [f, r] of Object.entries(out.files)) {
  const a = Object.keys(r.localAliasesOfBareHues);
  if (a.length || Object.keys(r.neutral).length) console.log(f, '| aliases:', a.map(k => `${k}(${r.localAliasesOfBareHues[k]})`).join(' '), '| through:', JSON.stringify(r.throughAliases), '| neutral:', JSON.stringify(r.neutral));
}
