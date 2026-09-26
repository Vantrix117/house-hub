// s1: sample a full-size audit screenshot in WebKit canvas: for each box, background = most common colour,
// foreground = pixel with the highest contrast against it; report the ratio and write a 4x crop.
// usage: node s1-sample.mjs <png> <outdir> name:x0,y0,x1,y1 ...
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const [png, outDir, ...boxes] = process.argv.slice(2);
const HOME = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(HOME, 'browsers');
const { webkit } = createRequire(path.join(HOME, 'noop.js'))('playwright-core');
fs.mkdirSync(outDir, { recursive: true });
const browser = await webkit.launch();
try {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(png).toString('base64');
  const res = await page.evaluate(async ([s, boxes]) => {
    const img = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
    const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const out = [];
    for (const spec of boxes) {
      const [name, r] = spec.split(':'); const [x0, y0, x1, y1] = r.split(',').map(Number);
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; const hist = new Map(); const px = [];
      for (let i = 0; i < d.length; i += 4) { const p = [d[i], d[i + 1], d[i + 2]]; px.push(p); const k = p.join(','); hist.set(k, (hist.get(k) || 0) + 1); }
      const bg = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
      let best = null, bc = 0; for (const p of px) { const v = cr(p, bg); if (v > bc) { bc = v; best = p; } }
      const z = document.createElement('canvas'); z.width = (x1 - x0) * 4; z.height = (y1 - y0) * 4; const zg = z.getContext('2d'); zg.imageSmoothingEnabled = false;
      zg.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, z.width, z.height);
      out.push({ name, box: [x0, y0, x1, y1], bg: 'rgb(' + bg + ')', fg: 'rgb(' + best + ')', maxContrast: +bc.toFixed(2), crop: z.toDataURL('image/png').split(',')[1] });
    }
    return out;
  }, [b64, boxes]);
  for (const r of res) { fs.writeFileSync(path.join(outDir, r.name + '.png'), Buffer.from(r.crop, 'base64')); delete r.crop; }
  fs.writeFileSync(path.join(outDir, path.basename(png, '.png') + '-samples.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
} finally { await browser.close(); }
