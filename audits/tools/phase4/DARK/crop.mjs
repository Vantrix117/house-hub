// Phase 4 DARK: crop rig screenshots (git-ignored, some > 1 MB) into small cited evidence PNGs.
//   node audits/tools/phase4/DARK/crop.mjs <src.png> <x> <y> <w> <h> <out.png>   (out goes under audits/evidence/p4/DARK/)
import fs from 'node:fs'; import path from 'node:path'; import { playwright, ROOT } from '../../lib/local.mjs';
const [src, x, y, w, h, out] = process.argv.slice(2);
const pw = playwright(); const b = await pw.webkit.launch({ headless: true }); const p = await b.newPage();
const data = fs.readFileSync(path.resolve(ROOT, src)).toString('base64');
const png = await p.evaluate(async ({ data, x, y, w, h }) => { const i = new Image(); i.src = 'data:image/png;base64,' + data; await i.decode(); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(i, x, y, w, h, 0, 0, w, h); return c.toDataURL('image/png').split(',')[1]; }, { data, x: +x, y: +y, w: +w, h: +h });
await b.close();
const dst = path.join(ROOT, 'audits/evidence/p4/DARK', out); fs.writeFileSync(dst, Buffer.from(png, 'base64')); console.log(dst, fs.statSync(dst).size);
