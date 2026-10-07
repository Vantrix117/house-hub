// R-guide round 3: the text size changes while the guide is open (Me → Appearance in the shell, the guide kept loaded): is the card re-measured?
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8899;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome' });
const pg = await b.newPage({ viewport: { width: 1180, height: 820 } });
await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
const sweep = () => pg.evaluate(() => { const box = document.getElementById('b-now'), hs = {}; for (const s of D.steps) { selectSection(s.section, false); curIdx = stepsOf(s.section).indexOf(s); renderStep(); hs[box.offsetHeight] = (hs[box.offsetHeight] || 0) + 1; } return { bnow: box.style.getPropertyValue('--bnow-h'), distinct: Object.keys(hs).length, max: Math.max(...Object.keys(hs).map(Number)) }; });
console.log('default', JSON.stringify(await sweep()));
await pg.evaluate(() => { document.documentElement.dataset.textSize = 'xxl'; }); await pg.waitForTimeout(500);
console.log('after switching to XXL in place (no resize)', JSON.stringify(await sweep()));
await pg.evaluate(() => { document.documentElement.dataset.textSize = 's'; }); await pg.waitForTimeout(500);
console.log('after switching to S in place', JSON.stringify(await sweep()));
await b.close(); srv.close();
