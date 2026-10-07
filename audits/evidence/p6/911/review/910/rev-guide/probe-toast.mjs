// R-guide probe: finishing a section from the sticky bar: where does the "<Section> done" toast land relative to the bar?
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8897;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h] of [[820, 1180], [1180, 820]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { selectSection('entrance', false); curIdx = 0; renderStep(); window.scrollTo(0, 0); });
  await pg.waitForTimeout(400);
  const sb = await pg.evaluate(() => !document.getElementById('stickbar').hidden);
  for (let i = 0; i < 9; i++) { await pg.evaluate(() => (document.getElementById('stickbar').hidden ? document.getElementById('b-done') : document.getElementById('sb-done')).click()); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const t = [...document.querySelectorAll('[id*=toast],[class*=toast]')].filter(e => e.offsetWidth && /done/.test(e.textContent)); const s = document.getElementById('stickbar');
    return { toast: t.map(e => ({ id: e.id, txt: e.textContent.trim().slice(0, 50), r: e.getBoundingClientRect().toJSON() })), bar: s.hidden ? null : s.getBoundingClientRect().toJSON(), barDone: (() => { const d = document.getElementById('sb-done'); return d && !s.hidden ? d.getBoundingClientRect().toJSON() : null; })() }; });
  console.log(`${w}x${h} stickbar shown at start=${sb}`, JSON.stringify(r));
  await pg.screenshot({ path: `C:/Users/ex_bo/b910/rev-guide/toast-${w}.png` });
  await pg.close();
}
await b.close(); srv.close();
