// Rewrites every PNG in audits/evidence/p3/prayer at 1x CSS scale (the evidence rule). The harness's d.shot() saves at
// the device pixel ratio (iPad 2x, iPhone 3x); this divides each image by the ratio its width implies
// (1290->430, 1640->820, 2360->1180, 2880->1440) using a canvas in a headless page. Images already at 1x are left alone.
// Run: node "audits/tools/phase3/prayer/to1x.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { playwright } from '../../lib/local.mjs';
const DIR = 'audits/evidence/p3/prayer';
const CSS = [430, 820, 1180, 1440, 1920];
const pw = playwright();
const b = await pw.webkit.launch();
const p = await (await b.newContext()).newPage();
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.png'))) {
  const file = path.join(DIR, f), b64 = fs.readFileSync(file).toString('base64');
  const out = await p.evaluate(async ([b64, CSS]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = [2, 3].find(k => CSS.includes(img.width / k)); if (!k) return null;
    const c = document.createElement('canvas'); c.width = img.width / k; c.height = Math.round(img.height / k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return { k, w: c.width, h: c.height, data: c.toDataURL('image/png').split(',')[1] };
  }, [b64, CSS]);
  if (!out) { console.log(f, 'already 1x'); continue; }
  fs.writeFileSync(file, Buffer.from(out.data, 'base64'));
  console.log(f, `÷${out.k} -> ${out.w}x${out.h}`, fs.statSync(file).size, 'bytes');
}
await b.close();
