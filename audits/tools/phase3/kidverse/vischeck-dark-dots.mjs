// Visual-score checker: samples pixels of Phase 1 captures to measure the contrast of the
// kid "today" ring, the unearned day dots and the unearned badge discs against their card in dark mode.
// Run: node "audits/tools/phase3/kidverse/vischeck-dark-dots.mjs"  -> audits/evidence/p3/kidverse/vischeck-dark-dots.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { playwright } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const shots = [
  // [file, label, card-bg sample, list of [label, x0,y0,x1,y1] vertical/horizontal scan lines]
  ['audits/screens/kidverse/kid-stars-typical-ipad-landscape-dark.png', 'kid dark landscape stars', [400, 240],
    [['today ring only (vertical, above the T glyph)', 502, 280, 502, 291], ['unearned dot W fill only (vertical, above the W glyph)', 546, 288, 546, 294], ['glyph letters row (horizontal)', 440, 304, 740, 304]]],
  ['audits/screens/kidverse/kid-stars-typical-ipad-landscape-light.png', 'kid light landscape stars', [400, 240], [['today ring only (vertical, above the T glyph)', 502, 280, 502, 291], ['unearned dot W fill only', 546, 288, 546, 294]]],
  ['audits/screens/kidverse/kid-rewards-empty-ipad-portrait-dark.png', 'kid dark rewards empty', [95, 1060],
    [['unearned badge disc First star, rim to top of glyph', 138, 1022, 138, 1034], ['unearned badge tile vs card (horizontal)', 70, 1100, 110, 1100]]],
];
const pw = playwright(); const b = await pw.webkit.launch();
const out = [];
try {
  const page = await b.newPage();
  for (const [f, label, bgAt, scans] of shots) {
    const abs = path.join(ROOT, f); if (!fs.existsSync(abs)) { out.push({ f, missing: true }); continue; }
    const data = 'data:image/png;base64,' + fs.readFileSync(abs).toString('base64');
    const r = await page.evaluate(async ({ data, bgAt, scans }) => {
      const img = new Image(); img.src = data; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
      const lum = ([r, gg, bb]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb); };
      const cr = (a, bb) => { const [l1, l2] = [lum(a), lum(bb)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
      if (!bgAt) return { size: [img.width, img.height] };
      const bg = px(...bgAt); const res = { size: [img.width, img.height], bg };
      res.scans = scans.map(([l, x0, y0, x1, y1]) => { let best = { cr: 1 }; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); const p = px(x, y); const k = cr(p, bg); if (k > best.cr) best = { cr: k, x, y, p }; } return { label: l, maxContrastVsCard: best }; });
      return res;
    }, { data, bgAt, scans });
    out.push({ f, label, ...r });
  }
} finally { await b.close(); }
const dest = path.join(ROOT, 'audits/evidence/p3/kidverse/vischeck-dark-dots.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
for (const o of out) { console.log(o.label, o.size, 'bg', o.bg); for (const s of o.scans || []) console.log('  ', s.label, JSON.stringify(s.maxContrastVsCard)); }
