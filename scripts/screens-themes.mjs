#!/usr/bin/env node
// Roadmap 25: Home, Apps and Me in every named theme at 390 and 1440, plus the Me theme picker. Checks that the
// shell's background follows the theme and that F260 (its own CSS) follows the resolved scheme.
//   cd worker && npx wrangler dev --port 8787
//   node scripts/screens-themes.mjs <pairing-code>      → docs/screens/rm25-<theme>-<surface>-<width>.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const SITE = 'http://localhost:8765';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });
const THEMES = { hearth: ['rgb(247, 242, 235)', 'light'], parchment: ['rgb(231, 217, 190)', 'light'], frost: ['rgb(237, 240, 245)', 'light'], midnight: ['rgb(26, 21, 18)', 'dark'], forest: ['rgb(16, 23, 26)', 'dark'] };
const errors = [];

async function open(browser, width) {
  const mobile = width < 1000;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(width + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(width + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  const create = /Create/.test(await page.$eval('.pcard[data-id=eli] .psub', e => e.textContent));
  await page.click('.pcard[data-id=eli]'); await page.waitForSelector('#pad'); await sleep(450);
  const tap = async () => { for (const d of '1357') await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); };
  await tap();
  if (create) { await page.waitForFunction(() => /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 }); await sleep(200); await tap();
    await page.waitForFunction(() => document.getElementById('gate').hidden || /Enter your PIN/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
    if (await page.$('#gate:not([hidden]) #pad')) { await sleep(200); await tap(); } }
  await page.waitForSelector('#shell:not([hidden])');
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  return { ctx, page };
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    for (const width of [390, 1440]) {
      console.log(`\n## ${width}`);
      const { ctx, page } = await open(browser, width);
      if (width === 390) await page.evaluate(() => { const id = hub.uid(); hub.set('item:' + id, { id, text: 'Take the bins out', by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); hub.set('f260.summary', { week: 3, weekDone: 2, total: 12, streak: 4, readToday: false, next: { week: 3, day: 3, ref: 'Genesis 27–28' }, finished: false }, { app: 'f260', scope: 'person' }); });
      await page.click('.tab[data-tab=me]');
      ok(await page.$$eval('#theme .theme-card', els => els.length) === 6, 'Me shows six theme cards (System + five palettes)');
      for (const [t, [bg, scheme]] of Object.entries(THEMES)) {
        await page.click(`#theme [data-theme=${t}]`); await sleep(350);
        const got = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, document.documentElement.dataset.scheme, document.querySelector('meta[name=theme-color]').content]);
        ok(got[0] === bg && got[1] === scheme, `${t}: shell background + scheme (${got[0]} / ${got[1]})`);
        ok(got[2].toLowerCase() === bg.replace(/rgb\((\d+), (\d+), (\d+)\)/, (_, r, g, b) => '#' + [r, g, b].map(n => (+n).toString(16).padStart(2, '0')).join('')), `${t}: theme-color meta follows (${got[2]})`);
        await page.screenshot({ path: path.join(shots, `rm25-${t}-me-${width}.png`) });
        await page.click('.tab[data-tab=home]'); await sleep(450); await page.screenshot({ path: path.join(shots, `rm25-${t}-home-${width}.png`) });
        await page.click('.tab[data-tab=apps]'); await sleep(450); await page.screenshot({ path: path.join(shots, `rm25-${t}-apps-${width}.png`) });
        await page.click('.tab[data-tab=me]');
      }
      // F260 follows the resolved scheme, not the OS: Parchment → light paper; Forest → its dark paper
      for (const [t, expectDark] of [['parchment', false], ['forest', true]]) {
        await page.click(`#theme [data-theme=${t}]`); await sleep(200);
        await page.click('.tab[data-tab=apps]'); await page.click('.tile[data-id=f260]');
        const f = await (async () => { for (let i = 0; i < 40; i++) { const fr = page.frame({ url: /apps\/f260/ }); if (fr) return fr; await sleep(150); } })();
        await f.waitForFunction(() => window.hub && hub.sync.lastPull > 0);
        await sleep(300);
        const [scheme, paper] = await f.evaluate(() => [document.documentElement.dataset.scheme, getComputedStyle(document.body).backgroundColor]);
        const [r, g, b] = paper.match(/\d+/g).map(Number); const dark = (r + g + b) / 3 < 100;
        ok(scheme === (expectDark ? 'dark' : 'light') && dark === expectDark, `F260 under ${t}: data-scheme=${scheme}, paper ${paper}`);
        await page.screenshot({ path: path.join(shots, `rm25-${t}-f260-${width}.png`) });
        await page.click('#pill-home'); await page.click('.tab[data-tab=me]');
      }
      await page.click('#theme [data-theme=system]');
      await ctx.close();
    }
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
