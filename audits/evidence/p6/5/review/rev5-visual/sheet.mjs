// node sheet.mjs out.png colWidth file1 file2 ... (absolute paths; each shown with its name)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const HOME = path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(HOME, 'browsers');
const { webkit } = createRequire(path.join(HOME, 'noop.js'))('playwright-core');
const [out, colW, ...files] = process.argv.slice(2);
const cells = files.map(f => `<figure><figcaption>${path.basename(path.dirname(f)).slice(0, 12)}/${path.basename(f)}</figcaption><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></figure>`).join('');
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
await p.setContent(`<style>body{margin:0;background:#888;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;font:11px sans-serif}figure{margin:0;width:${colW}px}img{width:100%;display:block}figcaption{background:#fff;padding:2px;word-break:break-all}</style>${cells}`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
