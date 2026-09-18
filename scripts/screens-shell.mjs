#!/usr/bin/env node
// Roadmap 4: screenshots of every hub surface for review against the style guide, plus layout-shift and
// token checks. Phone 390x844, iPad 1024x1366, desktop 1440x900; light + dark; adult, kid, kiosk.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/screens-shell.mjs <pairing-code>
// Writes docs/screens/rm4-<surface>-<width>-<scheme>.png
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
const SIZES = { 390: { width: 390, height: 844, mobile: true }, 1024: { width: 1024, height: 1366, mobile: true }, 1440: { width: 1440, height: 900, mobile: false } };
const errors = [];

async function open(browser, size, scheme) {
  const s = SIZES[size];
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.mobile ? 2 : 1, hasTouch: s.mobile, isMobile: s.mobile, colorScheme: scheme });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|429)/.test(m.text())) errors.push(`${size}/${scheme}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${size}/${scheme}: ${e.message}`));
  await page.goto(SITE + '/index.html');
  await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]');
  await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
const shot = async (page, name) => { await sleep(450); await page.screenshot({ path: path.join(shots, `rm4-${name}.png`), fullPage: false }); };
async function signIn(page, id, pin) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) { await page.waitForSelector('#pad'); await sleep(500); for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo');
    // first tap on a fresh DB creates the PIN: confirm it
    await page.waitForFunction(() => !document.getElementById('gate').hidden === false || /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
    if (await page.$('#gate:not([hidden]) #pad')) { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); } }
  await page.waitForSelector('#shell:not([hidden])');
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    // seed a little content so the cards have something to show
    {
      const { page, ctx } = await open(browser, 390, 'light');
      await signIn(page, 'eli', '1357');
      await page.evaluate(() => {
        const id = hub.uid(); hub.set('item:' + id, { id, text: 'Take the bins out', by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' });
        const d = n => { const t = new Date(); t.setDate(t.getDate() - n); return t.toISOString().slice(0, 10); };
        for (const [name, size, n] of [['Chili', 'Large', 5], ['Rice', 'Small', 8], ['Soup', 'Medium', 2]]) { const iid = hub.uid(); hub.set('item:' + iid, { id: iid, name, size, dateLogged: d(n), createdAt: Date.now() }, { app: 'leftovers', scope: 'family' }); }
        hub.set('f260.summary', { week: 3, weekDone: 2, total: 12, streak: 4, readToday: false, next: { week: 3, day: 3, ref: 'Genesis 27–28' }, finished: false }, { app: 'f260', scope: 'person' });
        hub.activity('Checked off Genesis 25–26', 'f260');
        return hub.flush();
      });
      await ctx.close();
    }
    for (const scheme of ['light', 'dark']) for (const size of [390, 1024, 1440]) {
      console.log(`\n## ${size} ${scheme}`);
      const { page, ctx } = await open(browser, size, scheme);
      await shot(page, `picker-${size}-${scheme}`);
      await page.click('.pcard[data-id=christian]'); await page.waitForSelector('#pad'); await shot(page, `pin-${size}-${scheme}`);
      await page.click('#pad [data-a=back]'); await page.waitForSelector('.pcard[data-id]');
      // layout shift while Home loads (adult)
      await page.evaluate(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await signIn(page, 'eli', '1357');
      await sleep(1200);
      const cls = await page.evaluate(() => window.__cls);
      ok(cls < 0.1, `layout shift on Home load ${cls.toFixed(3)} < 0.1`);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
      if (size === 390) {
        const s0 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sheen-x').trim());
        await page.evaluate(() => { document.getElementById('views').scrollTop = 400; }); await sleep(120);
        const s1 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sheen-x').trim());
        ok(s0 !== s1, `glass sheen drifts with scroll (${s0} → ${s1})`);
        await page.evaluate(() => { document.getElementById('views').scrollTop = 0; }); await sleep(120);
        const tb = await page.$eval('#tabbar', el => { const cs = getComputedStyle(el); return (cs.backdropFilter || cs.webkitBackdropFilter) + ' | ' + (cs.boxShadow.match(/inset/g) || []).length; });
        ok(/saturate/.test(tb), `tab bar is liquid glass (${tb})`);
      }
      await shot(page, `home-${size}-${scheme}`);
      await page.click('.tab[data-tab=apps]'); await shot(page, `apps-${size}-${scheme}`);
      await page.click('.tab[data-tab=chat]'); await page.waitForFunction(() => !document.querySelector('#chat-log .skeleton')); await shot(page, `chat-${size}-${scheme}`);
      await page.click('.tab[data-tab=me]'); await page.waitForFunction(() => !document.querySelector('#admin-body .skeleton')); await shot(page, `me-${size}-${scheme}`);
      if (size === 390 || size === 1440) {
        await page.click('#switch'); await page.waitForSelector('.pcard[data-id]');
        await signIn(page, 'ezra'); await page.click('.tab[data-tab=home]'); await shot(page, `home-kid-${size}-${scheme}`);
        await page.click('.tab[data-tab=apps]'); await shot(page, `apps-kid-${size}-${scheme}`);
        await page.click('.tab[data-tab=me]'); await page.click('#switch'); await page.waitForSelector('.pcard[data-id]');
        await signIn(page, 'tv'); await shot(page, `home-kiosk-${size}-${scheme}`);
      }
      await ctx.close();
    }
    // tokens only: no hex colours in the shell's own stylesheet
    const style = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
    ok(!/#[0-9a-f]{3,8}\b/i.test(style), 'index.html <style> uses tokens only (no hex)');
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
