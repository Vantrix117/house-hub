// Downscales audits/evidence/p3/prayer/verify-category-count-mismatch-2.png (iPhone 3x) to 1x CSS scale (430 wide).
// Run: node "audits/tools/phase3/prayer/verify-category-count-mismatch-2-1x.mjs"
import fs from 'node:fs';
import { playwright } from '../../lib/local.mjs';
const FILE = 'audits/evidence/p3/prayer/verify-category-count-mismatch-2.png';
const b = await playwright().webkit.launch();
try {
  const p = await (await b.newContext()).newPage();
  const out = await p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    if (img.width !== 1290) return null;
    const c = document.createElement('canvas'); c.width = 430; c.height = Math.round(img.height / 3);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: c.toDataURL('image/png').split(',')[1] };
  }, fs.readFileSync(FILE).toString('base64'));
  if (out) fs.writeFileSync(FILE, Buffer.from(out.data, 'base64'));
  console.log(out ? `${FILE} -> ${out.w}x${out.h}` : 'already 1x');
} finally { await b.close(); }
