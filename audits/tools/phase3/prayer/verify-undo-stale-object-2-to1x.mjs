// Rewrites only verify-undo-stale-object-2-*.png in audits/evidence/p3/prayer at 1x CSS scale (iPhone 3x -> 430 wide).
// Run: node "audits/tools/phase3/prayer/verify-undo-stale-object-2-to1x.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { playwright } from '../../lib/local.mjs';
const DIR = 'audits/evidence/p3/prayer';
const pw = playwright();
const b = await pw.webkit.launch();
try {
  const p = await (await b.newContext()).newPage();
  for (const f of fs.readdirSync(DIR).filter(f => f.startsWith('verify-undo-stale-object-2') && f.endsWith('.png'))) {
    const file = path.join(DIR, f), b64 = fs.readFileSync(file).toString('base64');
    const out = await p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const k = img.width / 430; if (k !== 2 && k !== 3) return null;
      const c = document.createElement('canvas'); c.width = 430; c.height = Math.round(img.height / k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
      return { w: c.width, h: c.height, data: c.toDataURL('image/png').split(',')[1] };
    }, b64);
    if (out) { fs.writeFileSync(file, Buffer.from(out.data, 'base64')); console.log(f, out.w + 'x' + out.h); } else console.log(f, 'left alone');
  }
} finally { await b.close(); }
