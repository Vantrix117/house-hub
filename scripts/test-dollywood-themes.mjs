// Render check for apps/dollywood.html (the build guide) across every hub theme.
//   NODE_PATH=<dir with playwright-core> node scripts/test-dollywood-themes.mjs [port]
// Serves the repo root on the given port (default 8781), opens the page at 390x844 and 1024x1366, and for each of
// hearth (no data-theme), light (the page's own toggle state), parchment, frost, midnight, forest asserts:
// no console errors (resource 401/403/404/429 ignored), no horizontal scroll, body background == the theme's --bg.
// Then flips the page's own Light/Dark toggle and checks the background actually changes.
// Screenshots -> docs/screens/rm27-dollywood-<theme>-<width>.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8781);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const THEMES = [
  { name: 'hearth', attr: null, scheme: 'light' },
  { name: 'light', attr: 'light', scheme: 'light' },       // what the page's own toggle sets
  { name: 'parchment', attr: 'parchment', scheme: 'light' },
  { name: 'frost', attr: 'frost', scheme: 'light' },
  { name: 'midnight', attr: 'midnight', scheme: 'dark' },
  { name: 'forest', attr: 'forest', scheme: 'dark' },
];
const SIZES = [[390, 844], [1024, 1366]];
const outDir = path.join(ROOT, 'docs', 'screens');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failures = 0;
const fail = (m) => { failures++; console.log('FAIL ' + m); };
const ok = (m) => console.log('ok   ' + m);

for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('hub.api', JSON.stringify('http://127.0.0.1:8787')); localStorage.removeItem('dw-theme'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(`http://localhost:${PORT}/apps/dollywood.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1500);

  for (const t of THEMES) {
    await page.evaluate(({ attr, scheme }) => {
      const el = document.documentElement;
      if (attr) el.dataset.theme = attr; else delete el.dataset.theme;
      el.dataset.scheme = scheme;
    }, t);
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const probe = document.createElement('div'); probe.style.background = 'var(--bg)'; document.body.appendChild(probe);
      const bgTok = getComputedStyle(probe).backgroundColor; probe.remove();
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor, bgTok,
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
        text: cs.getPropertyValue('--text').trim(), theme: document.documentElement.dataset.theme || '(none)',
      };
    });
    const tag = `${t.name}@${w}`;
    if (r.bodyBg !== r.bgTok) fail(`${tag}: body background ${r.bodyBg} != --bg ${r.bgTok}`); else ok(`${tag}: body background == --bg (${r.bgTok})`);
    if (r.scrollW > r.clientW) fail(`${tag}: horizontal scroll ${r.scrollW} > ${r.clientW}`); else ok(`${tag}: no horizontal scroll`);
    await page.screenshot({ path: path.join(outDir, `rm27-dollywood-${t.name}-${w}.png`), fullPage: false });
  }

  // no private toggle any more (Roadmap 22): hub.js sets data-theme / data-scheme; the marker colours key off data-scheme
  const tog = await page.evaluate(() => !!document.getElementById('theme'));
  await page.evaluate(() => { document.documentElement.dataset.scheme = 'dark'; });
  const dark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--attr').trim());
  await page.evaluate(() => { document.documentElement.dataset.scheme = 'light'; });
  const light = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--attr').trim());
  if (!tog && dark && light && dark !== light) ok(`scheme@${w}: no private toggle; --attr ${dark} (dark) -> ${light} (light)`);
  else fail(`scheme@${w}: ${JSON.stringify({ tog, dark, light })}`);

  const real = errors.filter(e => !/40[134]|429|Failed to load resource|ERR_CONNECTION_REFUSED/.test(e));
  if (real.length) fail(`${w}: console errors: ${real.join(' | ').slice(0, 600)}`); else ok(`${w}: no console errors`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(failures ? `${failures} failure(s)` : 'all checks passed');
process.exit(failures ? 1 : 0);
