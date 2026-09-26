// s2: soft fills vs --surface per theme, read straight from apps/design.css theme blocks.
import { readFileSync } from 'node:fs';
import { cr, mix, oklch } from '../VIS-ACCENT-1/s2-colour.mjs';
const css = readFileSync(new URL('../../../../../apps/design.css', import.meta.url), 'utf8');
const block = sel => { const i = css.indexOf(sel); const j = css.indexOf('\n}', i); return css.slice(i, j); };
const get = (b, v) => (b.match(new RegExp('--' + v + ':\\s*(#[0-9A-Fa-f]{6})')) || [])[1];
const themes = { hearth: ':root {', parchment: ':root[data-theme="parchment"]', frost: ':root[data-theme="frost"]', midnight: ':root[data-theme="midnight"]', forest: ':root[data-theme="forest"]' };
const P = ['#4F5D8C','#BC5A38','#137F77','#B4861B','#8A6A4B','#3D5A3D','#5B8143'];
const out = {};
for (const [t, sel] of Object.entries(themes)) { const b = block(sel); const s = get(b, 'surface'); const row = { surface: s, sunk: get(b,'sunk') };
  for (const n of ['mocha','gold','olive','teal','terra','slate']) { const f = get(b, n + '-soft'), ink = get(b, n + '-ink'); row[n] = { soft: f, softVsSurface: +cr(f, s).toFixed(2), softC: +oklch(f).C.toFixed(3), inkOnSoft: +cr(ink, f).toFixed(2), rawVsSurface: +cr(get(b,n), s).toFixed(2) }; }
  const acc = P.map(h => +cr(mix(h, s, 0.14), s).toFixed(2)); row.accentSoft = { min: Math.min(...acc), max: Math.max(...acc) };
  out[t] = row; }
console.log(JSON.stringify(out, null, 1));
