// Rescales this check's one PNG (iPhone 3x) to 1x CSS scale. Run after verify-critic-sunday-nudge-says-gone-quiet-6-1.mjs.
import fs from 'node:fs';
import { playwright } from '../../lib/local.mjs';
const file = 'audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1-christian-sunday.png';
const b = await playwright().webkit.launch();
try {
  const p = await (await b.newContext()).newPage();
  const out = await p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / 430; if (k <= 1.01) return null;
    const c = document.createElement('canvas'); c.width = 430; c.height = Math.round(img.height / k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  }, fs.readFileSync(file).toString('base64'));
  if (out) fs.writeFileSync(file, Buffer.from(out, 'base64'));
  console.log(out ? 'rescaled to 430 wide' : 'already 1x');
} finally { await b.close(); }
