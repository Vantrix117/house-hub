// s2: independent recount of GAP-TOK-3 from design.css surfaces, apps.json, seed.sql and index.html SWATCHES.
import fs from 'node:fs';
const root = new URL('../../../../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const apps = JSON.parse(read('apps.json')); const list = apps.apps || apps;
const sw = read('index.html').match(/const SWATCHES = \[([^\]]+)\]/)[1].match(/#[0-9A-Fa-f]{6}/g);
const surf = { hearth: '#FFFCF8', parchment: '#F1E7D2', frost: '#FAFBFD', midnight: '#241E19', forest: '#182225' };
const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const R = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
const entries = [...list.map(a => [a.id, a.color]), ...sw.map((c, i) => ['SWATCHES[' + i + ']', c])];
const css = read('apps/design.css').toUpperCase();
const out = { entries: entries.length, nonToken: entries.filter(([, c]) => !css.includes(c.toUpperCase())).map(e => e.join(' ')), themes: {} };
for (const [t, s] of Object.entries(surf)) {
  const S = h(s); const r = { glyph22: [], glyph15: [], ring: [] };
  for (const [id, c] of entries) { const C = h(c);
    if (R(C, mix(C, S, .22)) < 3) r.glyph22.push(id); if (R(C, mix(C, S, .15)) < 3) r.glyph15.push(id); if (R(C, S) < 3) r.ring.push(id + ' ' + R(C, S).toFixed(2)); }
  out.themes[t] = { glyph22: r.glyph22.length, glyph15: r.glyph15.length, ring: r.ring.length, glyph22ids: r.glyph22, ringIds: r.ring };
}
fs.writeFileSync(new URL('audits/evidence/p5/ux-verify/GAP-TOK-3/s2/recount.json', root), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
