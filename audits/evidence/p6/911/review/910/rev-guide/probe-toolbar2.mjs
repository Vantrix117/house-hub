// R-guide probe 2: WebKit, phone, More open, scrolled: does the toolbar's backdrop blur the content under it? before (base910) vs after (hub-audit)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const pw = require('playwright-core');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const serve = (root, port) => new Promise(r => { const s = http.createServer((q, res) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(b); }); }); s.listen(port, '127.0.0.1', () => r(s)); });
const roots = { before: 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/base910', after: 'C:/Users/ex_bo/hub-audit' };
const b = await pw.webkit.launch();
let port = 8896;
for (const [name, root] of Object.entries(roots)) {
  const s = await serve(root, ++port);
  for (const variant of ['as-is', 'no-sticky-children-fix']) {
    const pg = await b.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
    await pg.goto(`http://127.0.0.1:${port}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
    const mb = await pg.$('#more-btn'); if (mb) { await mb.click(); await pg.waitForTimeout(300); }
    await pg.evaluate(() => window.scrollTo(0, 900)); await pg.waitForTimeout(600);
    const anc = await pg.evaluate(() => { const out = []; let e = document.getElementById('toolbar'); const tb = e; while (e) { const c = getComputedStyle(e); const f = []; for (const k of ['filter', 'opacity', 'transform', 'willChange', 'isolation', 'mixBlendMode', 'contain', 'overflow', 'clipPath', 'mask', 'zIndex', 'position']) { const v = c[k]; if (v && !['none', '1', 'auto', 'normal', 'visible', 'static'].includes(v)) f.push(k + '=' + v); } out.push((e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) + ' ' + f.join(' ')); e = e.parentElement; }
      const c = getComputedStyle(tb); return { anc: out, tb: { bf: c.webkitBackdropFilter, bg: c.backgroundColor } }; });
    if (variant === 'as-is') { console.log(name, JSON.stringify(anc)); await pg.screenshot({ path: `C:/Users/ex_bo/b910/rev-guide/tb2-${name}.png`, clip: { x: 0, y: 0, width: 430, height: 200 } }); }
    await pg.close(); break;
  }
  s.close();
}
await b.close();
