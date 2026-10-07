// R-guide round 5: the phone sheet's peek row at 375/390/430, default and XXL, and in a short (Safari-like) viewport: is everything in it whole?
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8901;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h] of [[375, 667], [390, 664], [390, 844], [430, 740], [430, 932]]) for (const ts of ['', 'xxl']) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await pg.addInitScript(t => { try { if (t) localStorage.setItem('hub.prefs', JSON.stringify({ textSize: t })); } catch {} }, ts);
  await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
  const r = await pg.evaluate(() => { const vh = innerHeight, b = document.getElementById('build'); const out = { state: b.dataset.state, sheetTop: Math.round(b.getBoundingClientRect().top) }; const cut = [];
    for (const sel of ['#b-sec', '#pk-done', '#b-nextun', '#b-count', '#b-menu', '.bhead .bar']) { const e = document.querySelector(sel); if (!e || !e.offsetWidth) { cut.push(sel + ':hidden'); continue; } const r = e.getBoundingClientRect(); if (r.bottom > vh + 0.5 || r.top < 0) cut.push(`${sel}:${Math.round(r.top)}-${Math.round(r.bottom)}>${vh}`); if (e.scrollWidth > e.clientWidth + 1) cut.push(sel + ':text-overflow'); }
    const pk = document.getElementById('pk-done'); out.pk = pk && pk.offsetWidth ? [Math.round(pk.offsetWidth), Math.round(pk.offsetHeight)] : null; out.cut = cut; return out; });
  // tap the peek's Mark done
  let tapped = null; if (r.pk) { const before = await pg.evaluate(() => Object.keys(doneMap).filter(k => doneMap[k]).length); await pg.tap('#pk-done'); await pg.waitForTimeout(300); tapped = { before, after: await pg.evaluate(() => Object.keys(doneMap).filter(k => doneMap[k]).length), state: await pg.evaluate(() => document.getElementById('build').dataset.state) }; }
  console.log(`${w}x${h} ${ts || 'default'}`, JSON.stringify(r), 'tap', JSON.stringify(tapped));
  if (w === 375 && ts === 'xxl') await pg.screenshot({ path: 'C:/Users/ex_bo/b910/rev-guide/peek-375-xxl.png' });
  if (w === 390 && h === 664 && !ts) await pg.screenshot({ path: 'C:/Users/ex_bo/b910/rev-guide/peek-390-664.png' });
  await pg.close();
}
await b.close(); srv.close();
