// Phase 2 STAB write-up, evidence hygiene: every PNG a section cites must be at 1x CSS scale.
// Reads a markdown section, collects every `*.png` name it cites (bare names resolve to audits/evidence/p2/STAB/,
// names with a folder resolve from the repo root; `{a,b}` brace pairs are expanded), reads each PNG's IHDR size and
// matches it against the rig's device viewports (lib/devices.mjs): width x height equal to a viewport = 1x;
// equal to viewport x deviceScaleFactor = above 1x (needs a -1x.png copy, see ../PROF/rescale-evidence-1x.mjs).
// Read-only: it opens files and prints; it starts no browser, touches no rig and makes no network request.
//   node "audits/tools/phase2/STAB/check-cited-png-1x.mjs" <section.md>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVICES } from '../../lib/devices.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DIR = path.join(ROOT, 'audits', 'evidence', 'p2', 'STAB');
const md = process.argv[2];
if (!md) { console.error('usage: check-cited-png-1x.mjs <section.md>'); process.exit(2); }
const text = fs.readFileSync(md, 'utf8');

const expand = s => { const m = s.match(/\{([^{}]+)\}/); return m ? m[1].split(',').flatMap(x => expand(s.replace(m[0], x))) : [s]; };
const names = new Set();
for (const m of text.matchAll(/[A-Za-z0-9_./{},\\-]+\.png/g)) for (const n of expand(m[0])) names.add(n.replace(/\\/g, '/'));

const oneX = new Map(), hiX = new Map();
for (const [name, d] of Object.entries(DEVICES)) {
  const { width: w, height: h } = d.viewport;
  oneX.set(`${w}x${h}`, name);
  if (d.deviceScaleFactor > 1) hiX.set(`${w * d.deviceScaleFactor}x${h * d.deviceScaleFactor}`, `${name} @${d.deviceScaleFactor}x`);
}

const rows = [], counts = { one: 0, hi: 0, other: 0, missing: 0, shorthand: 0 }, sizes = new Map();
for (const n of [...names].sort()) {
  if (n.startsWith('-') || n.startsWith('.')) { counts.shorthand++; rows.push(`SHORTHAND ${n}`); continue; }
  const file = n.includes('/') ? path.join(ROOT, n) : path.join(DIR, n);
  if (!fs.existsSync(file)) { counts.missing++; rows.push(`MISSING   ${n}`); continue; }
  const b = fs.readFileSync(file);
  const size = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  if (oneX.has(size)) { counts.one++; sizes.set(size, oneX.get(size)); rows.push(`1x        ${size.padEnd(10)} ${n}`); }
  else if (hiX.has(size)) { counts.hi++; rows.push(`ABOVE-1x  ${size.padEnd(10)} ${n} (${hiX.get(size)})`); }
  else { counts.other++; rows.push(`OTHER     ${size.padEnd(10)} ${n}`); }
}
console.log(rows.join('\n'));
console.log(`\n${names.size} cited PNGs: ${counts.one} at 1x (${[...sizes].map(([s, d]) => `${s} ${d}`).join(', ')}), ` +
  `${counts.hi} above 1x, ${counts.other} other size, ${counts.missing} missing, ${counts.shorthand} shorthand (not a full name)`);
process.exitCode = counts.hi || counts.missing || counts.shorthand ? 1 : 0;
