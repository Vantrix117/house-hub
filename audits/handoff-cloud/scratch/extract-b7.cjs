// Batch 7's entries (from 05-findings.md) + the Prayer rests batch 1 left to batch 3 → b7.md; their scripts → b7-scripts.txt
const fs = require('fs'), path = require('path');
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub/';
const SP = __dirname + '/';
const t = fs.readFileSync(REPO + 'audits/05-findings.md', 'utf8');
const a = t.indexOf('\n### Batch 7 — Kid Verse (') + 1, b = t.indexOf('#### Improvements with no finding (kidverse)', a);
let sec = t.slice(t.indexOf('\n', a) + 1, b).trim();
const ids = [...sec.matchAll(/^#### (\S+)/gm)].map(m => m[1]);
// the carry-overs from batch 1 (PARTIAL, Prayer's half named for batch 3)
const carry = [];
let extra = '';
for (const id of carry) {
  const i = t.indexOf('#### ' + id + ' ');
  if (i < 0) throw new Error('missing ' + id);
  const j = t.indexOf('\n#### ', i + 5), k = t.indexOf('\n### ', i + 5);
  const end = Math.min(j < 0 ? Infinity : j, k < 0 ? Infinity : k);
  extra += '\n\n' + t.slice(i, end).trim().replace(/^(#### \S+ — )/, '$1[carry-over from batch 1: Prayer\'s half only] ');
}
fs.writeFileSync(SP + 'b7.md', '# Batch 7 — Kid Verse: ' + ids.length + ' entries + ' + carry.length + ' carry-overs from batch 1 (Prayer\'s part only)\n\n' + sec + extra + '\n');
const scripts = new Set();
for (const m of (sec + extra).matchAll(/node "(audits\/tools\/[^"]+\.mjs)"/g)) scripts.add(m[1]);
const list = [...scripts].filter(s => fs.existsSync(REPO + s));
const missing = [...scripts].filter(s => !fs.existsSync(REPO + s));
fs.writeFileSync(SP + 'b7-scripts.txt', list.join('\n') + '\n');
console.log('entries', ids.length, '+ carry', carry.length, '| scripts', list.length, 'missing', missing);
console.log(ids.join(' '));
