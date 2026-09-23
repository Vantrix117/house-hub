// Proves a rig limit: this Playwright WebKit build reports backdrop-filter as supported (CSS.supports and the computed
// style both say blur(20px)) but paints no blur — the stripes behind the panel stay crisp. Output: $TEMP/bdtest.png
// (copied to audits/evidence/p1-webkit-backdrop-filter-no-blur.png on 2026-09-23). Run: node audits/tools/lib/check-backdrop-filter.mjs
import { createRequire } from 'node:module';
const H = process.env.LOCALAPPDATA + '/house-hub-audit';
const req = createRequire(H + '/noop.js'); process.env.PLAYWRIGHT_BROWSERS_PATH = H + '/browsers';
const { webkit } = req('playwright-core');
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 400, height: 200 } });
await p.setContent(`<body style="margin:0;font:bold 40px sans-serif"><div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,#000 0 4px,#fff 4px 8px)"></div>
<div id=g style="position:absolute;left:50px;top:40px;width:300px;height:120px;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);background:rgba(255,255,255,.1)"></div></body>`);
const info = await p.evaluate(() => ({ supports: CSS.supports('backdrop-filter','blur(2px)'), wk: CSS.supports('-webkit-backdrop-filter','blur(2px)'), computed: getComputedStyle(document.getElementById('g')).backdropFilter || getComputedStyle(document.getElementById('g')).webkitBackdropFilter }));
const png = await p.screenshot({ clip: { x: 150, y: 90, width: 40, height: 1 } });
await p.screenshot({ path: process.env.TEMP + '/bdtest.png' });
console.log(JSON.stringify(info), 'bytes', png.length);
await b.close();
