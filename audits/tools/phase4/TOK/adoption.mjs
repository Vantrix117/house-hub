// Phase 4 TOK: token adoption per area and category = token references / (token references + literal violations).
// Reads usage-matrix.json and literals-*.json (run usage.mjs and literals.mjs first).
//   node audits/tools/phase4/TOK/adoption.mjs   → audits/evidence/p4/TOK/adoption.json + a markdown table on stdout
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './lib-tok.mjs';

const U = JSON.parse(fs.readFileSync(path.join(OUT, 'usage-matrix.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(OUT, 'literals-summary.json'), 'utf8')).summary;
const areas = ['design.css', 'shell', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const CAT = {
  'font size': { tok: r => /^--fs-/.test(r.token), lit: ['fontSize'] },
  spacing: { tok: r => /^--sp-/.test(r.token), lit: ['spacing'] },
  radius: { tok: r => /^--r(-|$)/.test(r.token), lit: ['radius'] },
  'motion (duration+easing)': { tok: r => /^--(dur|ease|spring)/.test(r.token), lit: ['duration', 'easing'] },
  'shadow/elevation': { tok: r => /^--(e\d|shadow|glow|focus)/.test(r.token), lit: ['shadow'] },
  colour: { tok: r => r.category === 'colour' || /^--glass(-strong|-line|-spec|-edge|-ring|-inner)?$/.test(r.token), lit: ['colour'] },
  'target size': { tok: r => /^--tap/.test(r.token), lit: ['targetSize'] },
};
const out = {};
for (const a of areas) {
  out[a] = {};
  for (const [c, def] of Object.entries(CAT)) {
    const t = U.rows.filter(def.tok).reduce((s, r) => s + (r[a] || 0), 0);
    const l = def.lit.reduce((s, k) => s + ((S[a].violations[k] || {}).total || 0), 0);
    out[a][c] = { tokenRefs: t, literals: l, adoption: t + l ? Math.round(100 * t / (t + l)) : null };
  }
}
fs.writeFileSync(path.join(OUT, 'adoption.json'), JSON.stringify({ method: 'token refs from usage-matrix.json; literals = status "violation" in literals-<area>.json (Dollywood: flavour rules only; its base rules 13-139 are a separate bucket)', out }, null, 1));
console.log('| Area | ' + Object.keys(CAT).join(' | ') + ' |');
console.log('|---|' + Object.keys(CAT).map(() => '---').join('|') + '|');
for (const a of areas) console.log(`| ${a} | ` + Object.keys(CAT).map(c => { const x = out[a][c]; return x.adoption === null ? '—' : `${x.adoption}% (${x.tokenRefs}/${x.literals})`; }).join(' | ') + ' |');
