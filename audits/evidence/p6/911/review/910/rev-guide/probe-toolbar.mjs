// R-guide probe: the phone toolbar's More row over scrolled content: is its backdrop blur live (WebKit + Chromium)?
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const pw = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8895;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
for (const eng of ['webkit', 'chromium']) {
  const b = eng === 'webkit' ? await pw.webkit.launch() : await pw.chromium.launch({ channel: 'chrome' });
  const pg = await b.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: eng !== 'webkit' ? true : undefined });
  await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
  await pg.click('#more-btn'); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.scrollTo(0, 900)); await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => { const t = document.getElementById('toolbar'); const cs = getComputedStyle(t); const kids = [...t.querySelectorAll('.grp')].map(g => { const c = getComputedStyle(g); return (g.className) + ' bg=' + c.backgroundColor + ' bf=' + (c.backdropFilter || c.webkitBackdropFilter); });
    return { more: t.dataset.more, bf: cs.backdropFilter, wbf: cs.webkitBackdropFilter, bg: cs.backgroundColor, rect: t.getBoundingClientRect().toJSON(), pos: cs.position, glassVar: cs.getPropertyValue('--material-chrome-filter'), kids }; });
  console.log(eng, JSON.stringify(r));
  await pg.screenshot({ path: `C:/Users/ex_bo/b910/rev-guide/toolbar-${eng}.png`, clip: { x: 0, y: 0, width: 430, height: 260 } });
  await b.close();
}
srv.close();
