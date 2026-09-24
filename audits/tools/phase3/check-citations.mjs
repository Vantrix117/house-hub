// Phase 3 citation check: every repo path cited in the Phase 3 reports exists, and every file:line is inside the file.
//   node audits/tools/phase3/check-citations.mjs                      → audits/03-apps.md + audits/03-apps/*.md
//   node audits/tools/phase3/check-citations.mjs audits/03-apps/tally.md
// Prints each broken citation as <report>:<line>: <citation> — <why>, then a count. Exit code 1 if any are broken.
// Paths with a wildcard (*) or a placeholder (<…>) must match at least one file. `../dollywood-build-project/…` is
// checked too (the sibling repo the Dollywood exports come from).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let files = process.argv.slice(2);
if (!files.length) {
  files = ['audits/03-apps.md'];
  const dir = path.join(ROOT, 'audits', '03-apps');
  if (fs.existsSync(dir)) files.push(...fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => 'audits/03-apps/' + f));
}
const HEAD = String.raw`(?:\.\.\/dollywood-build-project\/|apps\/|audits\/|worker\/|scripts\/|icons\/|art\/|docs\/|handoff\/|index\.html|sw\.js|apps\.json|CLAUDE\.md|manifest\.json)`;
const RE = new RegExp(String.raw`(?<![\w/.-])(${HEAD}[^\s\`'"()\[\],;|]*?)(?::(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*))?(?=[\s\`'"()\[\],;|]|\.(?:\s|$)|:(?!\d)|$)`, 'g');
const lineCount = new Map();
const countLines = f => { if (!lineCount.has(f)) lineCount.set(f, fs.readFileSync(f, 'utf8').split('\n').length); return lineCount.get(f); };
function globExists(rel) {
  const abs = path.resolve(ROOT, rel.replace(/<[^>]*>/g, '*'));
  const dir = path.dirname(abs), pat = path.basename(abs);
  if (!/[*]/.test(path.dirname(rel))) {
    if (!fs.existsSync(dir)) return false;
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).some(f => re.test(f));
  }
  return true; // wildcard in a directory part: not checked
}
let broken = 0, checked = 0;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.log(`${rel}: report missing`); broken++; continue; }
  const text = fs.readFileSync(abs, 'utf8').split('\n');
  text.forEach((ln, i) => {
    for (const m of ln.matchAll(RE)) {
      let p = m[1].replace(/[.:*]+$/, ''); const lines = m[2];
      if (/^https?:/.test(p) || p.endsWith('/')) { if (p.endsWith('/') && !/[<*{]/.test(p) && !fs.existsSync(path.resolve(ROOT, p))) { console.log(`${rel}:${i + 1}: ${p} — directory not found`); broken++; } checked++; continue; }
      checked++;
      if (/[{…]/.test(p)) continue;
      if (/[*<]/.test(p)) { if (!globExists(p)) { console.log(`${rel}:${i + 1}: ${p} — no file matches`); broken++; } continue; }
      const f = path.resolve(ROOT, p);
      if (!fs.existsSync(f)) { console.log(`${rel}:${i + 1}: ${p}${lines ? ':' + lines : ''} — not found`); broken++; continue; }
      if (lines && fs.statSync(f).isFile()) {
        const max = countLines(f);
        const nums = lines.split(/[-–,]/).map(s => parseInt(s, 10)).filter(Number.isFinite);
        const bad = nums.filter(n => n < 1 || n > max);
        if (bad.length) { console.log(`${rel}:${i + 1}: ${p}:${lines} — line ${bad.join(', ')} past the end (${max} lines)`); broken++; }
      }
    }
  });
}
console.log(`${checked} citations checked, ${broken} broken`);
process.exit(broken ? 1 : 0);
