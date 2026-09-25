// Phase 4 DARK: theme-block completeness in apps/design.css (static). For every custom property the :root (Hearth)
// block defines, is it overridden in each named theme block? A literal colour (or shadow/glass rgba) left to the
// Hearth value inside a dark theme is a light value leaking into dark. Also diffs the four copies of the Midnight
// palette (:root[data-theme=midnight], the prefers-color-scheme System block, .tp System half) and the two of Forest.
//   node audits/tools/phase4/DARK/theme-blocks.mjs  -> audits/evidence/p4/DARK/theme-blocks.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
const lines = css.split('\n');
function block(startRe) { const i = lines.findIndex(l => startRe.test(l)); let depth = 0, body = []; for (let k = i; k < lines.length; k++) { const l = lines[k]; if (k > i) body.push([k + 1, l]); depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length; if (depth <= 0 && k > i) break; if (k === i && depth === 0) break; } return { line: i + 1, body }; }
const decls = b => { const o = {}; for (const [n, l] of b.body) for (const m of l.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) o[m[1]] = { v: m[2].trim(), line: n }; return o; };
const B = {
  hearth: block(/^:root \{/), parchment: block(/^:root\[data-theme="parchment"\]/), frost: block(/^:root\[data-theme="frost"\]/),
  midnight: block(/^:root\[data-theme="midnight"\]/), systemDark: block(/^  :root:not\(\[data-theme\]\) \{/), forest: block(/^:root\[data-theme="forest"\] \{/),
  tpForest: block(/^\.tp\[data-preview="forest"\] \{/), tpHearth: block(/^\.tp\[data-preview="hearth"\]/), tpSystemNight: block(/^\.tp\[data-preview="system"\] \.tp-half/),
};
const D = Object.fromEntries(Object.entries(B).map(([k, b]) => [k, decls(b)]));
const isLiteral = v => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(v) && !/var\(--accent|var\(--text|var\(--surface/.test(v);
const colourish = n => !/^--(font|fs|lh|ls|sp|r-|r$|tap|max|safe|dur|ease|spring|blur|sheen)/.test(n) && n !== '--r';
const out = { note: 'missing = custom properties the Hearth :root block defines with a literal colour/shadow value that the theme block does not override (so the Hearth value applies in that theme). drift = values that differ between copies of the same palette.', blocks: Object.fromEntries(Object.entries(B).map(([k, b]) => [k, { line: b.line, count: Object.keys(D[k]).length }])), missing: {}, drift: {} };
for (const t of ['parchment', 'frost', 'midnight', 'systemDark', 'forest']) {
  out.missing[t] = Object.entries(D.hearth).filter(([n, d]) => colourish(n) && isLiteral(d.v) && !(n in D[t])).map(([n, d]) => ({ token: n, hearthValue: d.v, line: d.line }));
}
const cmp = (a, b) => { const r = []; for (const n of new Set([...Object.keys(D[a]), ...Object.keys(D[b])])) { const x = D[a][n], y = D[b][n]; if (!x || !y || x.v.replace(/\s+/g, '') !== y.v.replace(/\s+/g, '')) r.push({ token: n, [a]: x && x.v, [b]: y && y.v }); } return r; };
out.drift['midnight~systemDark'] = cmp('midnight', 'systemDark');
out.drift['midnight~tpSystemNight'] = cmp('midnight', 'tpSystemNight');
out.drift['forest~tpForest'] = cmp('forest', 'tpForest');
out.drift['hearth~tpHearth'] = cmp('hearth', 'tpHearth').filter(d => colourish(d.token));
// tokens used by apps/index but defined nowhere in design.css
const defined = new Set(Object.keys(D.hearth));
const used = {}; for (const f of ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => /\.html$/.test(f) && !/dollywood/.test(f)).map(f => 'apps/' + f)]) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const localDefs = new Set([...src.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)\s*([,)])/g)) if (!defined.has(m[1]) && !localDefs.has(m[1]) && m[2] === ')') (used[f] ||= new Set()).add(m[1]);
}
out.undefinedNoFallback = Object.fromEntries(Object.entries(used).map(([f, s]) => [f, [...s]]));
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/theme-blocks.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.blocks)); for (const [t, m] of Object.entries(out.missing)) console.log(t, 'missing', m.map(x => x.token).join(' '));
for (const [k, d] of Object.entries(out.drift)) console.log('drift', k, d.length, JSON.stringify(d).slice(0, 400));
console.log('undefined without fallback', JSON.stringify(out.undefinedNoFallback));
