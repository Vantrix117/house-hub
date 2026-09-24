// Evidence hygiene (Phase 2 ground rule: PNGs at 1x scale). Re-saves 2x screenshots at 1x, in place, so every
// reference to the same path stays valid. Pixels are only resampled (canvas drawImage, high-quality smoothing);
// nothing is cropped or edited. Prints each file's size before and after.
//
//   node "audits/tools/phase2/STAB/downscale-1x.mjs" <png> [<png> ...]      (paths relative to the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../../lib/local.mjs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: downscale-1x.mjs <png> [...]'); process.exit(2); }
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2');

const pw = playwright();
const browser = await pw.webkit.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const rel of files) {
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(EVID + path.sep) || !abs.endsWith('.png')) throw new Error('refusing to touch ' + rel + ' (only audits/evidence/p2/**/*.png)');
    const buf = fs.readFileSync(abs);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w % 2 || h % 2) throw new Error(rel + ' is ' + w + 'x' + h + ', not an even 2x size');
    const out = await page.evaluate(async ({ b64, w, h }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w / 2; c.height = h / 2;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w / 2, h / 2);
      return c.toDataURL('image/png').split(',')[1];
    }, { b64: buf.toString('base64'), w, h });
    const next = Buffer.from(out, 'base64');
    fs.writeFileSync(abs, next);
    console.log(rel + ': ' + w + 'x' + h + ' (' + buf.length + ' B) -> ' + next.readUInt32BE(16) + 'x' + next.readUInt32BE(20) + ' (' + next.length + ' B)');
  }
} finally {
  await browser.close();
}
