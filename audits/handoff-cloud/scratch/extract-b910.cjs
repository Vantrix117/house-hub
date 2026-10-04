// Batches 9 + 10 (the two Dollywood flavours of one template), combined: entries -> b910.md; their scripts -> b910-scripts.txt
const fs = require('fs');
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub/';
const SP = __dirname + '/';
const t = fs.readFileSync(REPO + 'audits/05-findings.md', 'utf8');
const a = t.indexOf('\n### Batch 9 — Dollywood build guide (') + 1, b = t.indexOf('\n### Batch 11 — ', a);
let sec = t.slice(a, b).trim();
const ids = [...sec.matchAll(/^#### (\S+) — /gm)].map(m => m[1]);
fs.writeFileSync(SP + 'b910.md', '# Batches 9 + 10 — Dollywood build guide and park map (one template): ' + ids.length + ' entries + the kept improvements; carry-overs are in b910-carry.md\n\n' + sec + '\n');
const scripts = new Set();
for (const m of sec.matchAll(/node "(audits\/tools\/[^"]+\.mjs)"/g)) scripts.add(m[1]);
const list = [...scripts].filter(s => fs.existsSync(REPO + s)), missing = [...scripts].filter(s => !fs.existsSync(REPO + s));
fs.writeFileSync(SP + 'b910-scripts.txt', list.join('\n') + '\n');
console.log('entries', ids.length, '| scripts', list.length, 'missing', missing.length);
