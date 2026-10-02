// node sheet.mjs out.png width file1 file2 ...  — a wrapped grid, each image scaled to `width` px wide, labelled
import fs from 'node:fs';
import { playwright } from './wr8/audits/tools/lib/local.mjs';
const [out, w, ...files] = process.argv.slice(2);
const pw = playwright(); const b = await pw.webkit.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 800 } });
const html = files.map(f => `<figure style="margin:0;width:${w}px"><figcaption style="font:11px sans-serif;word-break:break-all">${f.split(/[\\/]/).pop()}</figcaption><img style="width:${w}px;display:block;border:1px solid #c00" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></figure>`).join('');
await p.setContent(`<body style="margin:4px;background:#999;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;width:1590px">${html}</body>`); await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true }); await b.close();
