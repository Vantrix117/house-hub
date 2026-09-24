// Downscales verify-id-collision-1-*.png (iPhone 3x) to 1x CSS scale. Run: node "audits/tools/phase3/prayer/verify-id-collision-1-1x.mjs"
import fs from 'node:fs';
import { playwright } from '../../lib/local.mjs';
const f = 'audits/evidence/p3/prayer/verify-id-collision-1-V1-eli-phone.png';
const b = await playwright().webkit.launch(); const p = await (await b.newContext()).newPage();
const d = await p.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
  if (i.width !== 1290) return null; const c = document.createElement('canvas'); c.width = 430; c.height = Math.round(i.height / 3);
  c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; }, fs.readFileSync(f).toString('base64'));
if (d) fs.writeFileSync(f, Buffer.from(d, 'base64')); await b.close(); console.log(d ? 'scaled' : 'already 1x');
