// Phase 4 TYPE: static scan of every font declaration in the shipped CSS/JS.
// Usage: node audits/tools/phase4/TYPE/code-scan.mjs  -> audits/evidence/p4/TYPE/code-scan.json
// Lines longer than 5000 chars (Dollywood data blobs) are skipped; the Dollywood pair is also
// scanned through ../dollywood-build-project/scripts/template.html (read-only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const FILES = ['apps/design.css', 'index.html', 'apps/f260.html', 'apps/leftovers.html', 'apps/prayer.html', 'apps/tally.html',
  'apps/timer.html', 'apps/kidverse.html', 'apps/verses.html', 'apps/dollywood.html', 'apps/dollywood-live.html',
  '../dollywood-build-project/scripts/template.html'];
const out = { note: 'Every font-size / font shorthand / font-family / font-weight / letter-spacing / font-variant-numeric / text-transform declaration found in each file (lines <= 5000 chars). sizeKinds: token = var(--fs-*), localVar = another var(), px/rem/em literal, clamp/calc, inherit/keyword. under11 = literal px/em-resolved sizes < 11 px (em/rem assume a 16 px parent: approximate). Lines are 1-based.', files: {} };
const RE = /(font-size|font-family|font-weight|letter-spacing|font-variant-numeric|text-transform|(?<![-\w])font)\s*:\s*([^;}"'`]+)/g;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const r = { lines: lines.length, skippedLongLines: 0, sizeKinds: {}, sizes: {}, fsTokens: {}, families: {}, weights: {}, tracking: {}, numeric: {}, transform: {}, under11: [], sizeLines: [] };
  lines.forEach((ln, i) => {
    if (ln.length > 5000) { r.skippedLongLines++; return; }
    let m; RE.lastIndex = 0;
    while ((m = RE.exec(ln))) {
      const prop = m[1], val = m[2].trim().replace(/\s*!important/, '');
      const at = i + 1;
      if (prop === 'font-size' || prop === 'font') {
        let sz = val;
        if (prop === 'font') { // shorthand: [style] [weight] size[/lh] family
          if (/^(inherit|initial|unset)$/.test(val)) sz = 'inherit';
          else { const mm = val.match(/(var\(--fs-[\w-]+\)|var\(--[\w-]+\)|clamp\([^)]*\)|calc\([^)]*\)|[\d.]+(px|rem|em|%|vw|vh))(\/[\w.()-]+)?\s/); sz = mm ? mm[1] : null; const w = val.match(/^(?:italic\s+)?(\d{3}|bold|normal)\s/); if (w) r.weights[w[1]] = (r.weights[w[1]] || 0) + 1; const fam = val.match(/(?:px|rem|em|\))(?:\/[\w.()-]+)?\s+(.+)$/); if (fam) r.families[fam[1].trim()] = (r.families[fam[1].trim()] || 0) + 1; }
          if (!sz) continue;
        }
        let kind = 'other';
        if (/^var\(--fs-/.test(sz)) { kind = 'token'; const t = sz.match(/--fs-[\w-]+/)[0]; r.fsTokens[t] = (r.fsTokens[t] || 0) + 1; }
        else if (/^var\(/.test(sz)) kind = 'localVar';
        else if (/^[\d.]+px$/.test(sz)) kind = 'px';
        else if (/^[\d.]+(rem|em)$/.test(sz)) kind = 'rem/em';
        else if (/^[\d.]+%$/.test(sz)) kind = '%';
        else if (/^(clamp|calc|min|max)\(/.test(sz)) kind = 'clamp/calc';
        else if (/^(inherit|initial|unset|smaller|larger|small|large|medium)$/.test(sz)) kind = 'inherit/keyword';
        r.sizeKinds[kind] = (r.sizeKinds[kind] || 0) + 1;
        if (kind === 'px' || kind === 'rem/em') {
          r.sizes[sz] = (r.sizes[sz] || 0) + 1;
          const px = kind === 'px' ? parseFloat(sz) : parseFloat(sz) * 16;
          if (px < 11) r.under11.push({ line: at, value: sz, ctx: ln.trim().slice(0, 160) });
        }
        r.sizeLines.push([at, kind, sz]);
      } else if (prop === 'font-family') r.families[val] = (r.families[val] || 0) + 1;
      else if (prop === 'font-weight') r.weights[val] = (r.weights[val] || 0) + 1;
      else if (prop === 'letter-spacing') r.tracking[val] = (r.tracking[val] || 0) + 1;
      else if (prop === 'font-variant-numeric') r.numeric[val] = (r.numeric[val] || 0) + 1;
      else if (prop === 'text-transform') r.transform[val] = (r.transform[val] || 0) + 1;
    }
  });
  r.sizeLines = r.sizeLines.length; // keep the file small: count only
  out.files[f] = r;
}
const dst = path.join(ROOT, 'audits/evidence/p4/TYPE/code-scan.json');
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
for (const [f, r] of Object.entries(out.files)) console.log(f.padEnd(52), JSON.stringify(r.sizeKinds), 'under11:', r.under11.length, 'fsTokens:', JSON.stringify(r.fsTokens));
console.log('->', dst);
