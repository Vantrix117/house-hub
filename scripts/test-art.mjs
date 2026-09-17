#!/usr/bin/env node
// Roadmap 5 checks: the illustration set in art/ — every SVG parses and renders, every app in apps.json has a
// tile icon and a spot illustration, the whole set is precached by sw.js and stays under 600 KB; contact sheet
// screenshots of the style guide's Illustrations section (light + dark) into docs/screens/rm5-art-*.png.
//   node scripts/test-art.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'http://localhost:8765';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8765);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });

const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.svg')) files.push(path.relative(ROOT, f).replace(/\\/g, '/')); } })(path.join(ROOT, 'art'));
const total = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

(async () => {
  console.log('\n## files');
  ok(files.length >= 30, `art set has ${files.length} files`);
  ok(total <= 600 * 1024, `total ${(total / 1024).toFixed(1)} KB ≤ 600 KB`);
  const missingArt = apps.filter(a => !fs.existsSync(path.join(ROOT, 'art', 'app', a.id + '.svg'))).map(a => a.id);
  ok(missingArt.length === 0, 'every app in apps.json has art/app/<id>.svg', missingArt.join(','));
  const missingIcon = apps.filter(a => !/\.svg$/.test(a.icon || '') || !fs.existsSync(path.join(ROOT, a.icon))).map(a => a.id);
  ok(missingIcon.length === 0, 'every app has an SVG tile icon in icons/', missingIcon.join(','));
  const notCached = files.filter(f => !sw.includes(`'${f}'`));
  ok(notCached.length === 0, 'every art file is precached by sw.js', notCached.join(','));
  const swRefs = [...sw.matchAll(/'(art\/[^']+)'/g)].map(m => m[1]).filter(f => !fs.existsSync(path.join(ROOT, f)));
  ok(swRefs.length === 0, 'sw.js precache list has no dead art paths', swRefs.join(','));
  for (const f of ['art/hero/morning.svg', 'art/hero/afternoon.svg', 'art/hero/evening.svg', 'art/hero/play.svg', 'art/app/f260.svg', 'art/app/leftovers.svg', 'art/app/prayer.svg', 'art/empty/list.svg', 'art/empty/feed.svg', 'art/empty/chat.svg'])
    ok(shell.includes(f) || (f.startsWith('art/hero/') && shell.includes('art/hero/${')) || (f.startsWith('art/empty/') && shell.includes('art/empty/${') && shell.includes(`'${path.basename(f, '.svg')}')`)), `index.html uses ${f}`);
  ok(!/<symbol id="art-/.test(shell), 'inline hero art symbols removed from index.html');
  const hexInArt = files.filter(f => !/#[0-9A-Fa-f]{6}\b/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  ok(hexInArt.length === 0, 'art files carry their own colours (standalone in <img>)', hexInArt.join(','));

  console.log('\n## render');
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(SITE + '/docs/design.html');
    const bad = [];
    for (const f of files) {
      const r = await page.evaluate(async src => {
        const txt = await (await fetch(src)).text();
        const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
        if (doc.querySelector('parsererror')) return 'parse error';
        const img = new Image(); img.src = src;
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('load error')); }).catch(e => e.message);
        return img.naturalWidth > 0 ? 'ok' : 'no size';
      }, '../' + f);
      if (r !== 'ok') bad.push(f + ': ' + r);
    }
    ok(bad.length === 0, `all ${files.length} SVGs parse and render`, bad.join(' | '));
    ok(await page.$$eval('#art img', els => els.every(i => i.complete && i.naturalWidth > 0)), 'style guide shows the whole set');
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(300);
      const box = await page.$eval('#art', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + window.scrollY, width: r.width, height: r.height }; });
      await page.screenshot({ path: path.join(shots, `rm5-art-${scheme}.png`), fullPage: true, clip: box });
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
