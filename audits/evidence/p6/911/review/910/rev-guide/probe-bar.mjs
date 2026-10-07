// R-guide round 4: a map card open hides the sticky bar; open/close repeatedly, Escape, and a step change while a card is open
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8900;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome' });
const pg = await b.newPage({ viewport: { width: 820, height: 1180 } });
await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
await pg.evaluate(() => { const m = document.querySelector('.mapbox'); m.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(400);
const st = () => pg.evaluate(() => ({ bar: !document.getElementById('stickbar').hidden, card: document.getElementById('pop').classList.contains('show'), lift: getComputedStyle(document.getElementById('mapbox')).getPropertyValue('--sb-lift') }));
const log = [];
log.push('start ' + JSON.stringify(await st()));
// record every hidden toggle of the bar
await pg.evaluate(() => { window.__tog = 0; new MutationObserver(() => window.__tog++).observe(document.getElementById('stickbar'), { attributes: true, attributeFilter: ['hidden'] }); });
for (let i = 0; i < 5; i++) {
  await pg.evaluate(() => { const o = OFFNUM[Object.keys(OFFNUM)[3 + i]]; showOfficial(o); }).catch(async () => { await pg.evaluate(() => { const o = Object.values(OFFNUM)[3]; showOfficial(o); }); });
  await pg.waitForTimeout(150); const a = await st();
  if (i % 2) await pg.keyboard.press('Escape'); else await pg.evaluate(() => document.getElementById('pop-x').click());
  await pg.waitForTimeout(150); const c = await st(); log.push(`open ${JSON.stringify(a)} -> closed ${JSON.stringify(c)}`);
}
log.push('bar hidden-attribute changes over 5 open/close: ' + await pg.evaluate(() => window.__tog));
// Next while a card is open (keyboard shortcut / list), then close
await pg.evaluate(() => showOfficial(Object.values(OFFNUM)[5])); await pg.waitForTimeout(150);
await pg.evaluate(() => stepNav(1)); await pg.waitForTimeout(300); log.push('after stepNav with a card open ' + JSON.stringify(await st()));
await b.close(); srv.close(); console.log(log.join('\n'));
