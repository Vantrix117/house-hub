// Phase 5: checks audits/design-preview.html in the audit's WebKit and in Chromium (the installed Chrome) at three widths
// and both OS schemes: every in-page contrast figure passes its threshold, no horizontal scroll, no page error.
//   node audits/tools/phase5/preview-check.mjs  → audits/evidence/p5/preview-check.json
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { playwright, ROOT } from '../lib/local.mjs';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); }).listen(0);
const port = srv.address().port;
const pw = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const out = [];
for (const [name, launch] of [['webkit', () => pw.webkit.launch()], ['chromium', () => pw.chromium.launch({ executablePath: CHROME })]]) {
  const b = await launch();
  for (const w of [390, 820, 1440]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/audits/design-preview.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 15000 });
    const r = await page.evaluate(() => ({ pass: document.querySelectorAll('.ratio.pass').length, fail: [...document.querySelectorAll('.ratio.fail')].map(e => (e.closest('.pair,tr,.person') || e).innerText.replace(/\s+/g, ' ').slice(0, 80)), hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    out.push({ engine: name, width: w, scheme, ...r, errors: errs });
    await ctx.close();
  }
  await b.close();
}
srv.close();
fs.mkdirSync(path.join(ROOT, 'audits', 'evidence', 'p5'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits', 'evidence', 'p5', 'preview-check.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.engine.padEnd(8), String(o.width).padEnd(5), o.scheme.padEnd(5), 'pass', o.pass, 'fail', o.fail.length, 'hscroll', o.hscroll, 'errors', o.errors.length);
