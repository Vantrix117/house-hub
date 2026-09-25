// Re-save evidence screenshots that were written at device scale (2x / 3x) at 1x CSS scale, in place.
// The browser resamples each PNG into a canvas of (width / scale) × (height / scale) with high-quality smoothing.
// Usage: node audits/tools/phase4/HYGIENE/rescale-1x.mjs <file.png>:<scale> [...]
//   e.g. audits/evidence/p4/DARK/theme-color-A-iphone-server-midnight.png:3
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../../lib/local.mjs';
const jobs = process.argv.slice(2).map(a => { const i = a.lastIndexOf(':'); return [a.slice(0, i), +a.slice(i + 1)]; });
const pw = playwright();
const browser = await pw.webkit.launch({ headless: true });   // the rig's own WebKit (no Chromium download needed)
try {
  const page = await browser.newPage();
  for (const [rel, scale] of jobs) {
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(path.join(ROOT, 'audits', 'evidence', 'p4'))) throw new Error('only audits/evidence/p4 files: ' + rel);
    const src = 'data:image/png;base64,' + fs.readFileSync(abs).toString('base64');
    const out = await page.evaluate(async ({ src, scale }) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = Math.round(img.naturalWidth / scale), h = Math.round(img.naturalHeight / scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      return { w0: img.naturalWidth, h0: img.naturalHeight, w, h, data: c.toDataURL('image/png').split(',')[1] };
    }, { src, scale });
    const before = fs.statSync(abs).size;
    fs.writeFileSync(abs, Buffer.from(out.data, 'base64'));
    console.log(JSON.stringify({ rel, from: `${out.w0}x${out.h0}`, to: `${out.w}x${out.h}`, bytesBefore: before, bytesAfter: fs.statSync(abs).size }));
  }
} finally { await browser.close(); }
