// Phase 4 · token proposal "fidelity" · assembles tokens.css from tokens.src.css + gen.mjs + springs.mjs.
// node audits/tools/phase4/tokens/fidelity/build-tokens.mjs <dir containing tokens.src.css>
// (A proposal-authoring convenience only: the shipped design.css would carry the resulting literal file; no build step.)
import fs from 'node:fs';
import path from 'node:path';
import { css, scales } from './gen.mjs';
import { build } from './springs.mjs';

const dir = process.argv[2];
if (!dir) { console.error('usage: build-tokens.mjs <dir>'); process.exit(2); }
let s = fs.readFileSync(path.join(dir, 'tokens.src.css'), 'utf8');
const c = css();
const FAMILIES = Object.keys(scales());
// graphite first: its block also carries :root (the signed-out default), so every person block must come after it
const PERSON = ['graphite', 'pink', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender'];
const STEPS = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'];

s = s.replace('@GEN_LIGHT@', c.light + '\n  --success-switch: var(--success-strong);');
s = s.replace('@GEN_DARK@', c.dark + '\n  --success-switch: #269143;   /* white knob 4.0:1 on it; 4.1:1 against the dark cards */');
const accent = PERSON.map(k => {
  const sel = k === 'graphite' ? `:root, [data-accent="graphite"]` : `[data-accent="${k}"]`;
  return `${sel} {\n  ${STEPS.map(n => `--accent-${n}: var(--${k}-${n});`).join(' ')}\n}`;
}).join('\n');
s = s.replace('@GEN_ACCENTS@', accent);
s = s.replace(/^([ \t]*)@GEN_HI_INKS@$/gm, (_, ind) => ind + FAMILIES.map(k => `--${k}-ink: var(--${k}-ink-hi);`).join(' '));
for (const k of ['snappy', 'gentle', 'bouncy']) {
  const b = build(k);
  s = s.replace(`@SPRING_${k.toUpperCase()}@`, b.css).replace(`@DUR_${k.toUpperCase()}@`, b.ms + 'ms');
}
if (/@[A-Z_]+@/.test(s)) throw new Error('unfilled placeholder: ' + s.match(/@[A-Z_]+@/)[0]);
fs.writeFileSync(path.join(dir, 'tokens.css'), s);
console.log('wrote', path.join(dir, 'tokens.css'), s.length, 'bytes');
