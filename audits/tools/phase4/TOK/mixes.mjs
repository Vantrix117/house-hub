// Phase 4 TOK: ad-hoc derived colours. Every color-mix(in srgb, A N%, B) recipe per area (design.css included), and the
// distinct ratios applied to the person colour (--accent / --tint / an inline profile colour). A token system would name
// a handful of steps (soft, tint, ring, deep, glow); this counts how many one-off steps exist instead.
// Lines over 5,000 characters (the Dollywood payload) are skipped. Nested mixes are not counted (lower bound).
//   node audits/tools/phase4/TOK/mixes.mjs   → audits/evidence/p4/TOK/mixes.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, AREAS } from './lib-tok.mjs';

const all = {}; const perArea = {};
for (const a of AREAS) {
  if (a.id === 'dollywood-live' || a.id === 'hub.js' || a.id === 'docs') continue;   // the park map's CSS is byte-identical to the build guide's (lines 6-566)
  const src = fs.readFileSync(path.join(ROOT, a.file), 'utf8').split('\n').map(l => l.length < 5000 ? l : '').join('\n');
  const re = /color-mix\(\s*in\s+srgb\s*,\s*(var\(--[\w-]+\)|\$\{[^}]*\}|[#\w]+)\s*(\d+(?:\.\d+)?)%\s*,\s*(var\(--[\w-]+\)|[#\w]+)(?:\s*(\d+)%)?\s*\)/g;
  let m, n = 0;
  while ((m = re.exec(src))) { n++; const k = `${m[1].replace(/\$\{.*\}/, '${profile}')} ${m[2]}% / ${m[3]}`; (all[k] ||= new Set()).add(a.id); }
  perArea[a.id] = n;
}
const recipes = Object.entries(all).map(([k, s]) => ({ recipe: k, areas: [...s] }));
const person = recipes.filter(r => /--accent\)|--tint\)|profile/.test(r.recipe.split(' ')[0]));
const ratios = [...new Set(person.map(r => +r.recipe.split(' ')[1].replace('%', '')))].sort((a, b) => a - b);
const out = { note: 'lower bound: single-level color-mix only; dollywood-live CSS = dollywood CSS', totalMixes: Object.values(perArea).reduce((s, x) => s + x, 0), perArea, distinctRecipes: recipes.length, personColourRecipes: person.length, personColourRatios: ratios, recipes };
fs.writeFileSync(path.join(OUT, 'mixes.json'), JSON.stringify(out, null, 1));
console.log('color-mix total', out.totalMixes, JSON.stringify(perArea));
console.log('distinct recipes', recipes.length, '; person-colour recipes', person.length, '; distinct ratios on the person colour', ratios.length, ':', ratios.join(','));
