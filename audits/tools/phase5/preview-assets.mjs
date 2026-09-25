// Phase 5: the "before" images for audits/design-preview.html. The Phase 1 captures are git-ignored PNGs, so the
// preview carries JPEG copies of the two it shows (Prayer → Today, typical household, iPhone Home Screen app, light and
// dark), made with the audit's own Playwright build.
//   node audits/tools/phase5/preview-assets.mjs  → audits/design-preview-assets/prayer-before-*.jpg
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'design-preview-assets');
fs.mkdirSync(OUT, { recursive: true });
const pw = playwright();
const browser = await pw.webkit.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
for (const mode of ['light', 'dark']) {
  const src = path.join(ROOT, 'audits', 'screens', 'prayer', `today-typical-iphone-pwa-${mode}.png`);
  const b64 = fs.readFileSync(src).toString('base64');
  await page.setContent(`<body style="margin:0"><img src="data:image/png;base64,${b64}" style="display:block;width:430px;height:932px">`);
  await page.evaluate(() => document.images[0].decode());
  const out = path.join(OUT, `prayer-before-iphone-${mode}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 430, height: 932 } });
  console.log(path.relative(ROOT, out), fs.statSync(out).size, 'bytes, from', path.relative(ROOT, src));
}
await browser.close();
