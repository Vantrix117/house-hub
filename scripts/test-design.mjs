#!/usr/bin/env node
// Roadmap 3 checks: the design-system style guide (docs/design.html) in light/dark, phone/desktop, kid variant;
// every text pair on the page must pass WCAG AA for all nine person families (v3 tokens, data-accent); reduced motion:
// animations off, transitions opacity and colour only, <= 150 ms (the re-keyed kill, 04-design-system.md §8).
//   node scripts/test-design.mjs
// Writes screenshots to docs/screens/rm3-design-*.png
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

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const errors = [];
    for (const scheme of ['light', 'dark']) {
      console.log(`\n## ${scheme}`);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(scheme + ': ' + e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(scheme + ': ' + m.text()); });
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      await page.goto(SITE + '/docs/design.html', { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(bg === (scheme === 'dark' ? 'rgb(11, 10, 9)' : 'rgb(244, 241, 236)'), `body uses --bg (${bg})`);
      const rows = await page.evaluate(() => window.__contrast);
      const bad = rows.filter(r => !r.pass);
      ok(rows.length >= 30, `contrast table computed (${rows.length} pairs)`);
      ok(bad.length === 0, 'every text pair passes WCAG AA across all nine families', bad.map(r => `${r.name} ${r.ratio.toFixed(2)}`).join('; '));
      const minRatio = Math.min(...rows.map(r => r.ratio));
      console.log(`    lowest ratio ${minRatio.toFixed(2)}:1`);
      const secs = await page.$$eval('section', els => els.map(s => [s.id, s.getBoundingClientRect().height]));
      ok(secs.every(([, h]) => h > 60), 'every section has content', JSON.stringify(secs.filter(([, h]) => h <= 60)));
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 390');
      const glass = await page.$eval('.controls.glass', el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter);
      ok(/blur/.test(glass), `glass uses backdrop-filter (${glass})`);
      const g3 = await page.$eval('#glass .glass.glass-strong', el => { const cs = getComputedStyle(el); return { bg: cs.backgroundImage, sh: cs.boxShadow, bf: cs.backdropFilter || cs.webkitBackdropFilter }; });
      ok(/linear-gradient/.test(g3.bg) && /radial-gradient/.test(g3.bg), 'v3 glass layers a specular sheen and a colour pickup over the pane');
      ok((g3.sh.match(/inset/g) || []).length >= 3 && /saturate/.test(g3.bf), `v3 glass has inner rings + inner shadow and a saturated blur (${(g3.sh.match(/inset/g) || []).length} inset layers)`);
      const card = await page.$eval('#surfaces .card.glass', el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter);
      ok(card === 'none', 'in-page glass cards skip backdrop blur (perf guard)');
      const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sheen-x').trim());
      await page.evaluate(() => { const r = document.getElementById('sheen'); r.value = 70; r.dispatchEvent(new Event('input')); });
      ok(before !== await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sheen-x').trim()), 'the sheen moves with --sheen-x');
      const small = await page.$$eval('.btn, .tab, .seg > button, .swatch', els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 36).map(e => e.className));
      ok(small.length === 0, 'every control is at least 36 px tall', small.join(','));
      const kickerCase = await page.$eval('.kicker', el => getComputedStyle(el).textTransform);
      ok(kickerCase === 'uppercase', 'kicker utility styled');
      await page.screenshot({ path: path.join(shots, `rm3-design-390-${scheme}.png`), fullPage: true });
      await page.evaluate(() => { document.documentElement.dataset.kind = 'kid'; });
      const kidBtn = await page.$eval('.btn.btn-primary', el => el.getBoundingClientRect().height);
      const kidFs = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
      ok(kidBtn >= 56 && kidFs >= 18, `kid variant scales controls and type (${kidBtn.toFixed(0)}px / ${kidFs}px)`);
      await page.screenshot({ path: path.join(shots, `rm3-design-390-${scheme}-kid.png`), fullPage: false });
      await ctx.close();

      const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const dp = await desk.newPage();
      await dp.goto(SITE + '/docs/design.html', { waitUntil: 'load' });
      await dp.waitForTimeout(300);
      const cols = await dp.$eval('.grid-3', el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      ok(cols === 3, `grid-3 is three columns on desktop (${cols})`);
      await dp.screenshot({ path: path.join(shots, `rm3-design-1280-${scheme}.png`), fullPage: true });
      await desk.close();
    }
    console.log('\n## reduced motion + theme override');
    const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const rp = await rm.newPage();
    await rp.goto(SITE + '/docs/design.html', { waitUntil: 'load' });
    const anim = await rp.$eval('.hero.pop-in', el => getComputedStyle(el).animationDuration);
    ok(parseFloat(anim) < 0.02, `pop-in animation disabled under reduced motion (${anim})`);
    // the re-keyed kill is an opacity-only substitute: no movement, only a short fade of opacity and colour
    const tr = await rp.$eval('.btn', el => { const cs = getComputedStyle(el); return { props: cs.transitionProperty.split(',').map(x => x.trim()), durs: cs.transitionDuration.split(',').map(parseFloat) }; });
    ok(tr.props.every(p => ['opacity', 'color', 'background-color', 'border-color'].includes(p)) && Math.max(...tr.durs) <= 0.15, `transitions are opacity and colour only, <= 150 ms, under reduced motion (${tr.props.join(' ')} / ${tr.durs.join(' ')} s)`);
    // the switch in Me does the same with no OS setting (data-motion="reduce")
    const sw = await browser.newContext({ viewport: { width: 390, height: 844 } }); const sp = await sw.newPage();
    await sp.goto(SITE + '/docs/design.html', { waitUntil: 'load' });
    await sp.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });
    const swAnim = await sp.$eval('.hero.pop-in', el => getComputedStyle(el).animationDuration);
    const swTr = await sp.$eval('.btn', el => getComputedStyle(el).transitionProperty);
    ok(parseFloat(swAnim) < 0.02 && !/transform/.test(swTr), `data-motion="reduce" (the Me switch) stops animation and transform transitions (${swAnim} / ${swTr})`);
    await sw.close();
    await rp.evaluate(() => window.__setTheme('midnight')); await rp.waitForTimeout(250);   // the body background fades for 150 ms
    const forced = await rp.evaluate(() => getComputedStyle(document.body).backgroundColor + ' / ' + document.documentElement.dataset.theme + ' / ' + document.documentElement.dataset.scheme);
    ok(forced === 'rgb(11, 10, 9) / midnight / dark', `data-theme=midnight overrides a light system scheme and resolves data-scheme=dark (${forced})`);
    await rp.evaluate(() => window.__setTheme('dark')); await rp.waitForTimeout(50);
    ok(await rp.evaluate(() => document.documentElement.dataset.theme === 'midnight'), "'dark' is still accepted as an alias for Midnight");
    await rm.close();

    console.log('\n## every named theme passes AA for every family colour');
    const THEMES = { hearth: 'rgb(244, 241, 236)', parchment: 'rgb(236, 226, 205)', frost: 'rgb(242, 242, 247)', midnight: 'rgb(11, 10, 9)', forest: 'rgb(7, 15, 13)', graphite: 'rgb(0, 0, 0)' };
    const DARK = new Set(['midnight', 'forest', 'graphite']);
    const tp = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await tp.goto(SITE + '/docs/design.html', { waitUntil: 'load' });
    for (const [t, bg] of Object.entries(THEMES)) {
      await tp.evaluate(t => window.__setTheme(t), t); await tp.waitForTimeout(200);
      const got = await tp.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(got === bg, `${t}: body uses its own --bg (${got})`);
      const rows = await tp.evaluate(() => window.__contrast); const bad = rows.filter(r => !r.pass);
      ok(bad.length === 0, `${t}: ${rows.length} text pairs pass AA (lowest ${Math.min(...rows.map(r => r.ratio)).toFixed(2)}:1)`, bad.map(r => `${r.name} ${r.ratio.toFixed(2)}`).join('; '));
      const scheme = await tp.evaluate(() => document.documentElement.dataset.scheme);
      ok(scheme === (DARK.has(t) ? 'dark' : 'light'), `${t}: data-scheme=${scheme}`);
      ok(await tp.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === scheme, `${t}: color-scheme follows the palette, so native controls do too`);
      await tp.evaluate(() => { document.getElementById('themes').scrollIntoView(); window.scrollBy(0, -80); });
      await tp.screenshot({ path: path.join(shots, `rm25-guide-${t}.png`), fullPage: false });
    }
    ok(await tp.$$eval('#theme-row .tp', els => els.map(e => getComputedStyle(e).backgroundColor)).then(bgs => new Set(bgs).size === 6), 'the six theme previews each paint their own palette regardless of the page theme');
    ok(await tp.$$eval('[data-scheme], [data-theme-preview]', els => els.filter(e => e !== document.documentElement).every(e => e.hasAttribute('data-accent'))), 'every data-scheme / data-theme-preview element also carries data-accent');
    await tp.close();
    ok(errors.length === 0, 'no console/page errors', errors.join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
