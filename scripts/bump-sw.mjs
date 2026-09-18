#!/usr/bin/env node
// Bumps the service worker cache VERSION (hub-vN → hub-vN+1) and checks that every file in SHELL exists and
// every icon/art/app file the site ships is either precached or deliberately skipped.
//   node scripts/bump-sw.mjs          # bump + check
//   node scripts/bump-sw.mjs --check  # check only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
const m = sw.match(/const VERSION = 'hub-v(\d+)';/);
if (!m) { console.error('sw.js: VERSION line not found'); process.exit(1); }
const shell = [...sw.matchAll(/'([^']+)'/g)].map(x => x[1]).filter(f => /\.(html|js|css|json|svg|png|jpg)$/.test(f) || f === './');
const missing = shell.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
if (missing.length) { console.error('sw.js precaches files that do not exist:', missing.join(', ')); process.exit(1); }
const skip = new Set(['apps/dollywood.html', 'apps/dollywood/aerial.jpg']);   // multi-megabyte, cached on first use instead
const shipped = [];
for (const dir of ['apps', 'icons', 'art']) (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(html|js|css|svg|png|jpg)$/.test(e.name)) shipped.push(path.relative(ROOT, f).replace(/\\/g, '/')); } })(path.join(ROOT, dir));
const notCached = shipped.filter(f => !shell.includes(f) && !skip.has(f));
if (notCached.length) { console.error('shipped but not precached (add to SHELL or to the skip list here):', notCached.join(', ')); process.exit(1); }
console.log(`sw.js: ${shell.length} precached files all present; ${shipped.length} shipped files accounted for`);
if (process.argv.includes('--check')) process.exit(0);
const next = +m[1] + 1;
sw = sw.replace(m[0], `const VERSION = 'hub-v${next}';`);
fs.writeFileSync(SW, sw);
console.log(`VERSION hub-v${m[1]} → hub-v${next}`);
