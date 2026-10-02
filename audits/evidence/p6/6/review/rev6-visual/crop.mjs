// node crop.mjs out.png in.png:x,y,w,h[:scale] [in2.png:x,y,w,h ...]  — stacks crops vertically (with labels)
import fs from 'node:fs';
import { playwright } from './wr8/audits/tools/lib/local.mjs';
const [out, ...specs] = process.argv.slice(2);
const pw = playwright(); const b = await pw.webkit.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
const parts = specs.map(s => { const [f, box, sc] = s.split(/:(?=[\d,.]+(?::|$))/); const [x, y, w, h] = box.split(',').map(Number); return { f, x, y, w, h, sc: +(sc || 1) }; });
const html = parts.map(q => `<div style="font:12px sans-serif;margin:4px 0">${q.f.split(/[\\/]/).pop()}</div><div style="width:${q.w * q.sc}px;height:${q.h * q.sc}px;overflow:hidden;position:relative;border:1px solid red"><img src="data:image/png;base64,${fs.readFileSync(q.f).toString('base64')}" style="position:absolute;left:${-q.x * q.sc}px;top:${-q.y * q.sc}px;transform-origin:0 0;transform:scale(${q.sc});image-rendering:pixelated"></div>`).join('');
await p.setContent(`<body style="margin:4px;background:#888">${html}</body>`); await p.waitForTimeout(200);
await p.screenshot({ path: out, fullPage: true }); await b.close();
