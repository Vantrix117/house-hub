// Phase 4 TOK (5, runtime): what docs/design.html's own contrast table (window.__contrast, docs/design.html:285-307) reports,
// the way scripts/test-design.mjs reads it — every palette on a light-OS page — plus the two cases the test never runs:
// an explicit Hearth on a dark-OS page (the P2-VIS-03 path; the guide's setTheme copies hub.js, docs/design.html:311-316)
// and the pair count per theme. Serves the repo read-only on a random local port (no Worker, no network).
//   node audits/tools/phase4/TOK/guide-contrast.mjs   → audits/evidence/p4/TOK/guide-contrast.json
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { ROOT, OUT } from './lib-tok.mjs';
import { playwright } from '../../lib/local.mjs';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); } fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/docs/design.html`;
const pw = playwright(); const browser = await pw.webkit.launch({ headless: true });
const out = {};
try {
  for (const os of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: os });
    const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(300);
    for (const t of ['system', 'hearth', 'parchment', 'frost', 'midnight', 'forest']) {
      await page.evaluate(t => window.__setTheme(t), t); await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({ rows: window.__contrast.length, fails: window.__contrast.filter(x => !x.pass).map(x => x.name + ' ' + x.ratio.toFixed(2)), min: Math.min(...window.__contrast.map(x => x.ratio)), bg: getComputedStyle(document.body).backgroundColor, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme || '(none)', names: [...new Set(window.__contrast.map(x => x.name.replace(/ \(.*\)$/, '').replace(/, #\w+\)$/, '')))] }));
      out[`${os}-os/${t}`] = r;
    }
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(OUT, 'guide-contrast.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(20), `rows ${v.rows} fails ${v.fails.length} min ${v.min.toFixed(2)} bg ${v.bg} data-theme ${v.theme} data-scheme ${v.scheme}`);
console.log('distinct pair kinds in the table:', out['light-os/hearth'].names.length, out['light-os/hearth'].names.join(' | '));
