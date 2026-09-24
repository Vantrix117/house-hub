// Rewrites this verification's PNGs (only files starting verify-critic-share-copies-for-and-category-2-1) at 1x CSS scale.
// Run: node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-1-to1x.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { playwright } from '../../lib/local.mjs';
const DIR = 'audits/evidence/p3/prayer', PRE = 'verify-critic-share-copies-for-and-category-2-1';
const CSS = [430, 820, 1180, 1440, 1920];
const b = await playwright().webkit.launch();
const p = await (await b.newContext()).newPage();
try {
  for (const f of fs.readdirSync(DIR).filter(f => f.startsWith(PRE) && f.endsWith('.png'))) {
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
    console.log(f, `/${out.k} -> ${out.w}x${out.h}`, fs.statSync(file).size, 'bytes');
  }
} finally { await b.close(); }
