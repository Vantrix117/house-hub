// Summarise audits/evidence/p4/SHAPE/cards.json → cards-summary.json: per area, the distinct card, row, button, field
// and chrome treatments (radius, padding, border, elevation token, fill token, backdrop), column max-widths and grids.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const IN = path.join(ROOT, 'audits/evidence/p4/SHAPE/cards.json');
const OUT = path.join(ROOT, 'audits/evidence/p4/SHAPE/cards-summary.json');
const J = JSON.parse(fs.readFileSync(IN, 'utf8'));

function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
function colorOf(t) { const m = t.match(/rgba?\([^)]*\)/); if (m) { const n = m[0].match(/[\d.]+/g).map(Number); return [n[0], n[1], n[2], n[3] == null ? 1 : n[3]]; } const c = t.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (c) return [c[1] * 255, c[2] * 255, c[3] * 255, c[4] == null ? 1 : +c[4]]; return null; }
function layer(t) { const inset = /\binset\b/.test(t); const c = colorOf(t); const rest = t.replace(/rgba?\([^)]*\)/, '').replace(/color\([^)]*\)/, '').replace(/\binset\b/, ''); const n = (rest.match(/-?[\d.]+(px)?/g) || []).map(v => parseFloat(v)); while (n.length < 4) n.push(0); return { inset, x: n[0], y: n[1], blur: n[2], spread: n[3], c }; }
const same = (a, b) => a.inset === b.inset && a.x === b.x && a.y === b.y && a.blur === b.blur && a.spread === b.spread && a.c && b.c && a.c.slice(0, 3).every((v, i) => Math.abs(v - b.c[i]) < 2) && Math.abs(a.c[3] - b.c[3]) < 0.011;
const parse = s => (!s || s === 'none') ? [] : splitTop(s).map(layer);
function shadowTokens(v, toks) {
  let L = parse(v); const used = [];
  const order = Object.entries(toks).map(([n, s]) => [n, parse(s)]).filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
  for (const [n, t] of order) { for (let i = 0; i + t.length <= L.length; i++) { if (t.every((l, k) => same(L[i + k], l))) { used.push(n); L.splice(i, t.length); break; } } }
  const insets = L.filter(l => l.inset).length; const rings = L.filter(l => !l.inset && !l.x && !l.y && !l.blur && l.spread > 0).length; const lit = L.filter(l => !l.inset && !(!l.x && !l.y && !l.blur && l.spread > 0));
  const alias = { '--shadow': '--e2', '--shadow-lg': '--e3', '--shadow-sm': '--e1' };
  const names = [...new Set(used.map(n => alias[n] || n))];
  return (names.join('+') || '') + (insets ? (names.length ? '+' : '') + insets + 'inset' : '') + (rings ? '+ring' : '') + (lit.length ? (names.length || insets ? '+' : '') + 'literal[' + lit.map(l => `${l.x} ${l.y} ${l.blur} ${l.spread}`).join(',') + ']' : '') || 'none';
}
function tokenOf(c, colors) {
  if (!c || c[3] <= 0.05) return 'none';
  const hits = Object.entries(colors).filter(([, t]) => t.slice(0, 3).every((v, i) => Math.abs(v - c[i]) < 3) && Math.abs(t[3] - c[3]) < 0.02).map(([n]) => n);
  const pref = ['--surface', '--surface-2', '--bg', '--sunk', '--raised', '--paper', '--panel', '--panel2', '--accent-soft', '--glass', '--glass-strong'];
  hits.sort((a, b) => (pref.indexOf(a) + 1 || 99) - (pref.indexOf(b) + 1 || 99));
  return hits.length ? hits.slice(0, 2).join('|') : `rgba(${c.map(v => Math.round(v * 100) / 100).join(',')})`;
}
const cls = s => s.split(' > ').pop().replace(/#[\w-]+/, '').replace(/^(\w+)/, '$1') || s;
const out = { note: 'Per area: distinct treatments of painted boxes >= 100x40 in the area document (System theme, light OS, typical household). card = non-fixed container >= 200x60; row = li/.row; button/field by tag or role; chrome = fixed/sticky. r = corner radii; pad = padding T/R/B/L; border = width; shadow = elevation tokens found in the computed box-shadow (+N inset glass layers, +ring, literal[x y blur spread] for layers no token explains); fill = colour token(s) whose resolved value equals the background (or the literal rgba); bf = backdrop-filter. widths: elements >= 200 px wide with a max-width. grids: multi-track grids.', areas: {} };
for (const j of J.jobs) {
  if (j.error) continue;
  const A = out.areas[j.area] ||= {};
  const key = `${j.device}${j.profile === 'ezra' ? ' (kid)' : j.profile === 'tv' ? ' (kiosk)' : ''}${j.hash ? ' ' + j.hash : ''}`;
  const groups = {};
  for (const b of j.boxes) {
    let role = b.kind;
    if (role === 'container') { if (b.w < 200 || b.h < 60) continue; role = 'card'; }
    if (role === 'button' && b.h < 40) continue;
    const sig = [role, cls(b.sel), 'r' + [...new Set(b.r)].join('/'), 'pad ' + [...new Set(b.pad)].join('/'), b.border ? 'border ' + b.border.sides.join('/') : 'no border', shadowTokens(b.shadow, j.shadowsTok), tokenOf(b.bg, j.colors) + (b.bgImage ? ' +' + b.bgImage.split('(')[0] : ''), b.bf === 'none' ? '' : 'bf ' + b.bf].join(' · ');
    const g = groups[sig] ||= { role, n: 0, w: [], h: [], ex: b.sel };
    g.n++; g.w.push(b.w); g.h.push(b.h);
  }
  A[key] = {
    vw: j.vw, kind: j.kind, ds: j.ds,
    treatments: Object.entries(groups).sort((a, b) => a[1].role.localeCompare(b[1].role) || b[1].n - a[1].n).map(([sig, g]) => `${sig} · n${g.n} · ${Math.min(...g.w)}-${Math.max(...g.w)}x${Math.min(...g.h)}-${Math.max(...g.h)}`),
    widths: j.widths.map(w => `${w.sel} max ${w.maxWidth} w${w.w} x${w.left}`),
    grids: j.grids.map(g => `${g.sel} ${g.tracks} tracks (${g.cols}) gap ${g.gap} w${g.w}`),
  };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const [a, v] of Object.entries(out.areas)) { console.log('\n########', a); for (const [k, x] of Object.entries(v)) { console.log('==', k, 'vw', x.vw, x.kind, 'ds', x.ds); for (const t of x.treatments) console.log('   ', t); for (const w of x.widths) console.log('   W', w); for (const g of x.grids) console.log('   G', g); } }
