// Phase 4 TYPE: where is hierarchy carried by colour alone?
// For every job of the themes run in the System light theme (iPad portrait, typical), looks at sibling texts
// (same parent selector, same document) that share family, size, weight and transform but differ in colour
// by a relative-luminance ratio of at least 1.5 (i.e. one reads as "secondary" only through its ink).
// Usage: node audits/tools/phase4/TYPE/colour-only.mjs [--out DIR]  -> DIR/colour-only.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw/themes');
const ai = process.argv.indexOf('--out');
const OUT = ai > 0 ? path.resolve(process.argv[ai + 1]) : path.join(ROOT, 'audits/evidence/p4/TYPE');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = L(a) + 0.05, y = L(b) + 0.05; return x > y ? x / y : y / x; };
const res = {};
for (const area of fs.readdirSync(RAW)) {
  const ad = path.join(RAW, area);
  for (const f of fs.readdirSync(ad).filter(f => f.endsWith('-light-system.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(ad, f), 'utf8'));
    const own = t => (area === 'shell' || area === 'tv') ? t.doc === 'page' : t.doc !== 'page';
    const groups = {};
    for (const t of j.text.filter(own)) {
      if (!t.color || t.kind !== 'text' || !t.text || t.text.trim().length < 2) continue;
      const parent = t.doc + '|' + t.sel.split(' > ').slice(0, -1).join(' > ');
      (groups[parent] ??= []).push(t);
    }
    const A = res[area] ??= { jobs: 0, pairs: {} };
    A.jobs++;
    for (const [p, ts] of Object.entries(groups)) {
      for (let i = 0; i < ts.length; i++) for (let k = i + 1; k < ts.length; k++) {
        const a = ts[i], b = ts[k];
        if (a.ia || b.ia || /toast/.test(a.sel + b.sel)) continue; // controls differ by fill/state, not hierarchy
        if (a.ff !== b.ff || a.fs !== b.fs || a.fw !== b.fw || a.tt !== b.tt || a.sel === b.sel) continue;
        // effective ink: colour alpha × ancestor opacity folded towards the median background
        const ink = t => { const al = (t.color[3] ?? 1) * (t.op ?? 1); const bg = t.bgMed || [255, 255, 255]; return t.color.slice(0, 3).map((c, n) => c * al + bg[n] * (1 - al)); };
        const r = ratio(ink(a), ink(b));
        if (r < 1.5) continue;
        const [hi, lo] = L(ink(a)) < L(ink(b)) ? [a, b] : [b, a]; // darker first (light theme)
        const key = [hi.sel.split(' > ').pop(), lo.sel.split(' > ').pop(), a.fs, a.fw].join(' | ');
        const P = A.pairs[key] ??= { primary: hi.sel.split(' > ').slice(-2).join(' > '), secondary: lo.sel.split(' > ').slice(-2).join(' > '), fs: a.fs, fw: a.fw, ff: a.ff, inkRatio: +r.toFixed(2), primaryTok: hi.tok, secondaryTok: lo.tok, texts: [hi.text.slice(0, 30), lo.text.slice(0, 30)], jobs: [] };
        if (P.jobs.length < 3 && !P.jobs.includes(f)) P.jobs.push(f.replace(/\.json$/, ''));
      }
    }
  }
}
const out = { note: 'Sibling texts (same parent, same document) with identical family, size, weight and transform (neither interactive, no toasts) whose inks differ by >= 1.5:1 luminance ratio: the difference between them is colour alone. Themes run, System light, iPad portrait (or the screen\'s first device). jobs = example job files under raw/themes/<area>/.', areas: {} };
for (const [a, A] of Object.entries(res)) out.areas[a] = { jobs: A.jobs, distinctPairs: Object.keys(A.pairs).length, pairs: Object.values(A.pairs) };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'colour-only.json'), JSON.stringify(out, null, 1));
for (const [a, A] of Object.entries(out.areas)) console.log(a.padEnd(15), 'jobs', A.jobs, 'colour-only sibling pairs', A.distinctPairs);
