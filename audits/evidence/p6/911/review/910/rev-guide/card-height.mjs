// R-guide probe: does the step card keep ONE height across every step (sizeCard measures the ~90th percentile only)?
// Also: the plot field's intermediate-keystroke saves (standalone: localStorage dw-plot).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8894;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, ts] of [[820, 1180, 'default'], [1180, 820, 'default'], [1440, 900, 'default'], [1180, 820, 'xxl']]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  if (ts === 'xxl') await pg.addInitScript(() => { try { localStorage.setItem('hub.prefs', JSON.stringify({ textSize: 'xxl' })); } catch {} });
  await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' });
  await pg.waitForTimeout(2500);
  const r = await pg.evaluate(async () => {
    const out = { heights: {}, over: [], min: 1e9, max: 0, bnow: null };
    const box = document.getElementById('b-now');
    for (const s of D.sections) { if (s.id === 'all') continue; selectSection(s.id, false); const st = stepsOf(s.id);
      for (let i = 0; i < st.length; i++) { curIdx = i; renderStep(); const hh = box.offsetHeight; out.min = Math.min(out.min, hh); out.max = Math.max(out.max, hh);
        out.heights[hh] = (out.heights[hh] || 0) + 1; out.bnow = box.style.getPropertyValue('--bnow-h'); if (hh > parseFloat(out.bnow) + 0.5) out.over.push(st[i].id + ':' + hh); } }
    out.distinct = Object.keys(out.heights).length; out.ts = document.documentElement.dataset.textSize; return out; });
  console.log(`${w}x${h} ${ts}(${r.ts}): --bnow-h=${r.bnow} min=${r.min} max=${r.max} distinct=${r.distinct} steps taller than --bnow-h: ${r.over.length}/242 e.g. ${r.over.slice(0, 4).join(', ')}`);
  await pg.close();
}
// plot field: type "2500" key by key, then clear and type "1e3"
{ const pg = await b.newPage({ viewport: { width: 1180, height: 820 } });
  await pg.goto(`http://127.0.0.1:${PORT}/apps/dollywood.html`, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const t = [...document.querySelectorAll('button,[role=tab]')].find(e => /^Scale$/.test(e.textContent.trim())); t && t.click(); });
  const f = pg.locator('#sc-plot'); await f.click(); const log = [];
  for (const k of '2500') { await pg.keyboard.type(k); log.push(`typed→${await f.inputValue()} saved=${await pg.evaluate(() => localStorage.getItem('dw-plot'))} err="${await pg.textContent('#sc-err')}"`); }
  for (let i = 0; i < 4; i++) { await pg.keyboard.press('Backspace'); log.push(`bksp→"${await f.inputValue()}" saved=${JSON.stringify(await pg.evaluate(() => localStorage.getItem('dw-plot')))}`); }
  for (const k of ['5', '0', '0', 'e']) { await pg.keyboard.type(k); log.push(`typed ${k}→"${await f.inputValue()}" saved=${JSON.stringify(await pg.evaluate(() => localStorage.getItem('dw-plot')))} err="${await pg.textContent('#sc-err')}"`); }
  console.log('plot keystrokes:\n  ' + log.join('\n  '));
  await pg.close(); }
await b.close(); srv.close();
