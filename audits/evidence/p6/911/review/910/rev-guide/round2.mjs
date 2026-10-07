// R-guide round 2 probes: card height + sizeCard cost (CPU x4 / x6), plot typing with the 900 ms debounce, toast vs sticky bar, reference icons over file://
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const ROOT = 'C:/Users/ex_bo/hub-audit'; const PORT = 8898;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const URL = `http://127.0.0.1:${PORT}/apps/dollywood.html`;
const b = await chromium.launch({ channel: 'chrome' });
// 1) heights + cost
for (const [w, h, ts] of [[820, 1180, ''], [1180, 820, ''], [1440, 900, ''], [1180, 820, 'xxl']]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  if (ts) await pg.addInitScript(() => { try { localStorage.setItem('hub.prefs', JSON.stringify({ textSize: 'xxl' })); } catch {} });
  await pg.goto(URL, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const out = { hs: {}, over: 0 }; const box = document.getElementById('b-now');
    for (const s of D.steps) { selectSection(s.section, false); curIdx = stepsOf(s.section).indexOf(s); renderStep(); out.hs[box.offsetHeight] = (out.hs[box.offsetHeight] || 0) + 1; }
    out.bnow = box.style.getPropertyValue('--bnow-h'); out.distinct = Object.keys(out.hs); return out; });
  const cdp = await pg.context().newCDPSession(pg); const cost = {};
  for (const rate of [1, 4, 6]) { await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    cost['x' + rate] = await pg.evaluate(() => { const t = []; for (let i = 0; i < 3; i++) { cardW = -1; const a = performance.now(); sizeCard(); t.push(Math.round(performance.now() - a)); } return t; }); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`${w}x${h}${ts}: --bnow-h=${r.bnow} distinct heights=${JSON.stringify(r.hs)} sizeCard ms ${JSON.stringify(cost)}`);
  await pg.close();
}
// 2) plot typing (standalone: localStorage dw-plot), with the debounce
{ const pg = await b.newPage({ viewport: { width: 1180, height: 820 } });
  await pg.goto(URL, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  const cdp = await pg.context().newCDPSession(pg);
  await pg.evaluate(() => showTab('scale')); await pg.waitForTimeout(300); const f = pg.locator('#sc-plot'); await f.scrollIntoViewIfNeeded(); await f.click(); const log = []; const st = async l => log.push(`${l} field="${await f.inputValue()}" saved=${JSON.stringify(await pg.evaluate(() => localStorage.getItem('dw-plot')))} err="${await pg.textContent('#sc-err')}"`);
  for (const k of '2500') { await pg.keyboard.type(k); await pg.waitForTimeout(150); } await st('typed 2500 fast'); await pg.waitForTimeout(1100); await st('+1.1 s');
  for (let i = 0; i < 4; i++) await pg.keyboard.press('Backspace'); await st('cleared'); await pg.waitForTimeout(1100); await st('+1.1 s (paused before retyping)');
  for (const k of '500e') { await pg.keyboard.type(k); await pg.waitForTimeout(150); } await st('typed 500e'); await pg.waitForTimeout(1100); await st('+1.1 s');
  await pg.keyboard.press('Backspace'); await pg.waitForTimeout(1100); await st('after removing e +1.1 s');
  // sizeCard calls while typing a new width (each changes the factor)
  await pg.evaluate(() => { window.__sc = 0; const o = sizeCard; window.sizeCard = function () { window.__sc++; return o.apply(this, arguments); }; });
  await f.fill(''); await f.click(); for (const k of '1200') { await pg.keyboard.type(k); await pg.waitForTimeout(100); }
  log.push('sizeCard calls while typing 1200 (global wrapper; renderStep may call the inner binding): ' + await pg.evaluate(() => window.__sc));
  await pg.waitForTimeout(1200); await st('typed 1200');
  console.log('plot:\n  ' + log.join('\n  ')); await pg.close(); }
// 3) toast vs bar
for (const [w, h] of [[820, 1180], [1180, 820]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto(URL, { waitUntil: 'load' }); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { selectSection('entrance', false); curIdx = 0; renderStep(); window.scrollTo(0, 0); }); await pg.waitForTimeout(400);
  for (let i = 0; i < 9; i++) { await pg.evaluate(() => (document.getElementById('stickbar').hidden ? document.getElementById('b-done') : document.getElementById('sb-done')).click()); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => { const t = document.getElementById('hub-toast'); const s = document.getElementById('stickbar'); const tr = t && t.offsetWidth ? t.getBoundingClientRect() : null, sr = s.hidden ? null : s.getBoundingClientRect();
    return { toast: tr && [Math.round(tr.top), Math.round(tr.bottom)], bar: sr && [Math.round(sr.top), Math.round(sr.bottom)], overlap: !!(tr && sr && tr.bottom > sr.top && tr.top < sr.bottom), txt: t && t.textContent.trim().slice(0, 40), inDs: !!(t && t.closest('.ds')) }; });
  console.log(`toast ${w}x${h}`, JSON.stringify(r)); await pg.screenshot({ path: `C:/Users/ex_bo/b910/rev-guide/r2-toast-${w}.png` }); await pg.close();
}
// 4) reference over file://
{ const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  await pg.goto('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/dollywood-build-project/build/dollywood_terrain_reference.html', { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const uses = [...document.querySelectorAll('svg use')].filter(u => /^#i-|sprite/.test(u.getAttribute('href') || '')); const drawn = uses.filter(u => { try { const bb = u.getBBox(); return bb.width > 0; } catch { return false; } });
    return { uses: uses.length, drawn: drawn.length, external: uses.filter(u => /sprite\.svg/.test(u.getAttribute('href'))).length, blankBtns: [...document.querySelectorAll('button')].filter(x => x.offsetWidth && !x.textContent.trim() && !x.querySelector('svg use')).map(x => x.id).slice(0, 8) }; });
  console.log('reference file://', JSON.stringify(r), 'console errors', errs.length, errs.slice(0, 2));
  await pg.screenshot({ path: 'C:/Users/ex_bo/b910/rev-guide/r2-ref.png', clip: { x: 0, y: 0, width: 1280, height: 450 } }); await pg.close(); }
await b.close(); srv.close();
