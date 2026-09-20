#!/usr/bin/env node
// Roadmap 22 checks: the build guide's progress follows Eli through hub.js. Signed in as Eli on a PC and an iPad
// (two browser contexts, two paired devices), a tick on the PC is ticked on the iPad after hub.pull(); the legacy
// localStorage progress ("dollywood-build-progress-v2") and plot ("dw-plot") migrate on the first signed-in open;
// the private Light/Dark button is gone and the page's marker colours follow data-scheme (the person's theme);
// the page still opens standalone with no session; the display profile gets a nudge, not a tick.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1, pairing code local-test-code)
//   node scripts/test-dollywood-sync.mjs <pairing-code>
// Serves the repo on localhost:8982 and proxies /api to the Worker (same origin, so no CORS entry is needed).
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
const PORT = 8982;
const SITE = 'http://localhost:' + PORT;
const APP = SITE + '/apps/dollywood.html';
const SHOTS = path.join(ROOT, 'docs', 'screens');
const KEY = 'dollywood-build-progress-v2';
const LOAD = 30000;   // the page is 4.4 MB
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {   // same-origin proxy to the Worker
    const u = new URL(API);
    const up = http.request({ host: u.hostname, port: u.port, method: req.method, path: req.url, headers: { ...req.headers, host: u.host } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', e => { res.writeHead(502); res.end(String(e)); });
    req.pipe(up); return;
  }
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>404</title>not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 15000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const errors = [];

async function newContext(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', ...opts });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  return { ctx, page };
}
const openApp = async page => { await page.goto(APP, { timeout: LOAD, waitUntil: 'load' }); await page.waitForFunction(() => window.hub && document.getElementById('b-list') && typeof stepsOf === 'function', null, { timeout: LOAD }); };
// Pair and sign in through the SDK on the (unsigned) page; the caller reloads so the app boots signed in.
async function signIn(page, id, pin, device) {
  await page.evaluate(async ({ code, id, pin, device }) => {
    if (!hub.device) await hub.pair(code, device);
    try { await hub.login(id, pin); }
    catch (e) { if (e.error === 'needs_pin_setup') await hub.createPin(id, pin); else throw e; }
  }, { code: CODE, id, pin, device });
}
const readyAndPulled = page => page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0, null, { timeout: LOAD });
const settled = page => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0));
// the current step and whether it is painted as done, straight from the DOM the tick handler paints
const tickState = (page, id) => page.evaluate(id => {
  const st = stepsOf(curSec), i = st.findIndex(s => s.id === id);
  const item = document.querySelectorAll('#b-list .bitem')[i];
  const cur = st[curIdx] && st[curIdx].id === id;
  const btn = document.getElementById('b-done');
  return { inMap: !!doneMap[id], listOk: !!item && item.classList.contains('ok'), listTick: !!item && item.querySelector('span').textContent === '✓', btnDone: cur && !!btn && btn.classList.contains('done'), count: (document.getElementById('b-count') || {}).textContent };
}, id);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    console.log('\n## standalone: no session, localStorage only, no crash');
    const PC = await newContext(browser, 'PC');
    await openApp(PC.page);
    ok(await PC.page.evaluate(() => window.hub && !hub.profile), 'hub.js loaded, no profile');
    ok(await PC.page.evaluate(() => document.querySelector('script[src="hub.js"][data-app="dollywood"][data-scope="person"]') !== null), '<script src="hub.js" data-app="dollywood" data-scope="person"> is in the page');
    const ids = await PC.page.evaluate(() => stepsOf('entrance').slice(0, 3).map(s => s.id));
    ok(ids.length === 3, 'entrance section has build steps', ids.join(','));
    ok(await PC.page.$('#theme') === null, 'no private Light/Dark button (#theme)');
    ok(await PC.page.evaluate(() => !document.documentElement.outerHTML.includes('dw-theme')), 'no dw-theme read left in the page');
    // a tick with no session lands in localStorage, exactly as before
    const first = await PC.page.evaluate(() => stepsOf(curSec)[curIdx].id);
    await PC.page.click('#b-done');
    const lsAfter = await PC.page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    ok(lsAfter[first] === true, 'unsigned tick is saved to localStorage', JSON.stringify(lsAfter));
    ok(errors.length === 0, 'no page errors standalone', errors.join(' | '));

    console.log('\n## legacy progress + plot migrate on the first signed-in open (Eli, adult)');
    // seed the legacy keys the way Eli\'s PC has them, then sign in and reload
    await PC.page.evaluate(({ k, ids }) => { localStorage.setItem(k, JSON.stringify({ [ids[0]]: true })); localStorage.setItem('dw-plot', '1200'); localStorage.removeItem('hub.migrated'); }, { k: KEY, ids });
    await signIn(PC.page, 'eli', '1357', 'test-dollywood-pc');
    // start from a clean server copy so the migration assertion is about this run
    await PC.page.evaluate(async () => { for (const k of ['progress', 'plot']) await hub.request(`/api/data/dollywood/${k}?scope=person`, { method: 'DELETE' }); });
    await openApp(PC.page); await readyAndPulled(PC.page);
    await waitFor(() => PC.page.evaluate(() => hub.has('progress')), { label: 'migrated progress row' });
    ok(await PC.page.evaluate(id => hub.get('progress')[id] === true, ids[0]), 'legacy doneMap migrated into hub key "progress"');
    ok(await PC.page.evaluate(() => hub.get('plot') === '1200'), 'legacy dw-plot migrated into hub key "plot"', String(await PC.page.evaluate(() => hub.get('plot'))));
    ok(await PC.page.$eval('#sc-plot', e => e.value) === '1200', 'plot input shows the migrated value');
    let t = await tickState(PC.page, ids[0]);
    ok(t.inMap && t.listOk && t.listTick, 'migrated step is painted ticked in the list', JSON.stringify(t));
    ok(await PC.page.evaluate(() => { const m = JSON.parse(localStorage.getItem('hub.migrated') || '{}'); return !!m['dollywood.person']; }), 'migration marked done for this device');
    await settled(PC.page);

    console.log('\n## tick on the PC → ticked on the iPad after hub.pull()');
    const IPAD = await newContext(browser, 'iPad', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await openApp(IPAD.page);
    await signIn(IPAD.page, 'eli', '1357', 'test-dollywood-ipad');
    await openApp(IPAD.page); await readyAndPulled(IPAD.page);
    ok(await IPAD.page.evaluate(id => doneMap[id] === true, ids[0]), 'iPad already shows the migrated tick from the server');
    // PC ticks the current step (the first undone one)
    const stepId = await PC.page.evaluate(() => stepsOf(curSec)[curIdx].id);
    const stepTitle = await PC.page.evaluate(() => stepsOf(curSec)[curIdx].title);
    ok(stepId !== ids[0], 'PC landed on the first undone step, not the migrated one', stepId);
    ok((await tickState(IPAD.page, stepId)).inMap === false, 'iPad has that step unticked before the PC ticks it');
    await PC.page.click('#b-done');
    t = await tickState(PC.page, stepId);
    ok(t.inMap && t.listOk, 'PC paints the tick at once', JSON.stringify(t));
    ok(await PC.page.evaluate(id => hub.get('progress')[id] === true, stepId), 'PC wrote hub key "progress"');
    ok(await PC.page.evaluate(({ k, id }) => !JSON.parse(localStorage.getItem(k) || '{}')[id], { k: KEY, id: stepId }), 'signed-in save goes through hub.set, not the legacy localStorage key');
    await settled(PC.page);
    await waitFor(() => PC.page.evaluate(() => hub.activityFeed(20).then(r => r.some(a => a.app_id === 'dollywood' && /^Ticked /.test(a.text)))), { label: 'activity line' });
    ok(true, 'hub.activity("Ticked <step>") reached the family feed');
    await IPAD.page.evaluate(() => hub.pull());
    await waitFor(() => IPAD.page.evaluate(id => doneMap[id] === true, stepId), { label: 'iPad doneMap after pull' });
    t = await tickState(IPAD.page, stepId);
    ok(t.inMap && t.listOk && t.listTick, 'iPad: same step is ticked after hub.pull() — repainted in place', JSON.stringify(t));
    ok(/\d+ of \d+ done/.test(t.count), 'iPad: the section count repainted', t.count);
    ok(await IPAD.page.$eval('#sc-plot', e => e.value) === '1200', 'iPad: plot followed Eli too');
    // and the other way: untick on the iPad, the PC follows
    await IPAD.page.evaluate(id => { const st = stepsOf(curSec); curIdx = st.findIndex(s => s.id === id); renderStep(); }, stepId);
    await IPAD.page.click('#b-done');
    ok((await tickState(IPAD.page, stepId)).inMap === false, 'iPad unticks it');
    await settled(IPAD.page);
    await PC.page.evaluate(() => hub.pull());
    await waitFor(() => PC.page.evaluate(id => doneMap[id] === false, stepId), { label: 'PC doneMap after pull' });
    t = await tickState(PC.page, stepId);
    ok(!t.inMap && !t.listOk, 'PC: untick arrived and the list repainted', JSON.stringify(t));
    await PC.page.screenshot({ path: path.join(SHOTS, 'rm22-pc.png') });
    await IPAD.page.screenshot({ path: path.join(SHOTS, 'rm22-ipad.png') });
    console.log('   step:', JSON.stringify(stepTitle));

    console.log('\n## the page follows data-scheme (the person\'s theme), no private toggle');
    const marker = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--attr').trim().toUpperCase());
    const themeBefore = await PC.page.evaluate(() => hub.theme());
    await PC.page.evaluate(() => hub.setTheme('midnight'));
    ok(await PC.page.evaluate(() => document.documentElement.dataset.scheme === 'dark' && document.documentElement.dataset.theme === 'midnight'), 'Midnight → data-theme=midnight, data-scheme=dark');
    const dark = await marker(PC.page);
    await PC.page.evaluate(() => hub.setTheme('parchment'));
    ok(await PC.page.evaluate(() => document.documentElement.dataset.scheme === 'light' && document.documentElement.dataset.theme === 'parchment'), 'Parchment → data-theme=parchment, data-scheme=light');
    const light = await marker(PC.page);
    ok(dark === '#F5EEDC' && light === '#1E1A14', 'marker colours key off data-scheme (light ink on Parchment, cream on Midnight)', dark + ' / ' + light);
    ok(await PC.page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'body background comes from the theme tokens');
    await PC.page.screenshot({ path: path.join(SHOTS, 'rm22-pc-parchment.png') });
    await PC.page.evaluate(t => hub.setTheme(t), themeBefore);
    await settled(PC.page);

    console.log('\n## the display profile can look but not tick');
    const TV = await newContext(browser, 'TV', { viewport: { width: 1280, height: 800 } });
    await openApp(TV.page);
    await signIn(TV.page, 'tv', undefined, 'test-dollywood-tv');
    await openApp(TV.page);
    await TV.page.waitForFunction(() => window.hub && hub.profile && hub.profile.kind === 'kiosk', null, { timeout: LOAD });
    const tvStep = await TV.page.evaluate(() => stepsOf(curSec)[curIdx].id);
    await TV.page.click('#b-done'); await sleep(300);
    ok(await TV.page.evaluate(id => !doneMap[id], tvStep), 'kiosk tap does not tick');
    ok(await TV.page.evaluate(() => { const t = document.getElementById('hub-toast'); return !!t && /only looks/.test(t.textContent); }), 'kiosk gets the "only looks" toast');
    ok(await TV.page.evaluate(() => hub.sync.pending === 0), 'kiosk queued nothing');

    ok(errors.length === 0, 'no page errors across all contexts', errors.join(' | '));
    await PC.ctx.close(); await IPAD.ctx.close(); await TV.ctx.close();
  } catch (e) { fail++; console.error('  ✗ crashed:', e && e.stack || e); }
  await browser.close(); server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
