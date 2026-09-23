#!/usr/bin/env node
// House Hub visual capture rig (audit Phase 1). One command captures every screen of the hub and every app across
// the device matrix, in light and dark, in each state, into audits/screens/<area>/<screen>-<state>-<device>-<mode>.png,
// then writes contact sheets and the index in audits/01-capture.md.
//
//   node audits/tools/capture.mjs                 everything (tens of minutes)
//   node audits/tools/capture.mjs --area shell --screen home,picker --state typical --device ipad-portrait --mode light
//   node audits/tools/capture.mjs --quick         iPad portrait + iPhone PWA, light only (for iterating)
//   node audits/tools/capture.mjs --list          print the plan and exit
//   node audits/tools/capture.mjs --serve         just run the seeded local instance (typical) until Ctrl+C
//   options: --out <dir> (trial runs)  --parallel N (default 4)  --scale css|device (default css: 1 image px per CSS px)  --no-sheets  --variant <v> (with --serve)
//
// It runs against a local instance only: lib/server.mjs serves the repo and runs worker/src on an in-memory SQLite
// database seeded with the demo household (seed.mjs). No production data or endpoint is touched.
// Playwright (playwright-core + WebKit) is installed on first run into %LOCALAPPDATA%\house-hub-audit (or
// $HUB_AUDIT_HOME), never into the repo — the repo has no package.json on purpose.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEVICES, DEFAULT_DEVICES, SAFARI_STATES, MODES, STATES, contextOptions } from './lib/devices.mjs';
import { DEMO_TIME } from './seed/story.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'audits', 'screens');
const HOME = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
const ASSETS = path.join(HOME, 'assets-v2');
const PW_VERSION = '1.63.0';
const PROD_API = 'https://house-hub-api.catalystfarm1.workers.dev';

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const list = n => { const v = opt(n); return v ? v.split(',').map(s => s.trim()).filter(Boolean) : null; };
const QUICK = flag('quick');
const F = {
  area: list('area'), file: list('file'), screen: list('screen'), state: list('state'),
  device: list('device') || (QUICK ? ['ipad-portrait', 'iphone-pwa'] : null),
  mode: list('mode') || (QUICK ? ['light'] : null),
};
const PARALLEL = +opt('parallel', 4);
// --out <dir>: write screenshots + manifest somewhere else (for trial runs); contact sheets and the index are only
// built for the real output folder.
const OUT = opt('out') ? path.resolve(opt('out')) : DEFAULT_OUT;
const SCALE = opt('scale', 'css');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Playwright bootstrap (outside the repo) ──────────────────────────────────
function playwright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(HOME, 'browsers');
  const req = createRequire(path.join(HOME, 'noop.js'));
  let pw;
  try { pw = req('playwright-core'); } catch {
    log(`installing playwright-core@${PW_VERSION} into ${HOME} (first run only)`);
    fs.mkdirSync(HOME, { recursive: true });
    execSync(`npm install --prefix "${HOME}" --no-audit --no-fund playwright-core@${PW_VERSION}`, { stdio: 'inherit', shell: true });
    pw = req('playwright-core');
  }
  if (!fs.existsSync(pw.webkit.executablePath())) {
    log('downloading Playwright WebKit (first run only)');
    execSync(`node "${req.resolve('playwright-core/cli.js')}" install webkit`, { stdio: 'inherit', env: process.env });
  }
  return pw;
}

// ── demo assets: "photos" rendered from the repo's own illustrations ─────────
async function renderAssets(browser) {
  // Each SVG is painted over its own backdrop colour (several art files are pale shapes on transparency).
  const want = { 'photo-a': ['art/ambient/dawn.svg', '#E9D8C4'], 'photo-b': ['art/story/05-law.svg', '#D9C6E8'],
    'album-1': ['art/story/01-creation.svg', '#CFE3F2'], 'album-2': ['art/ambient/day.svg', '#CFE3F2'], 'album-3': ['art/story/03-promise.svg', '#F2DCC8'],
    'album-4': ['art/ambient/dusk.svg', '#E8C7B0'], 'album-5': ['art/story/04-exodus.svg', '#F0E0B8'], 'album-6': ['art/story/09-nativity.svg', '#DCD3EE'],
    'album-7': ['art/ambient/night.svg', '#2B3350'], 'album-8': ['art/story/02-flood.svg', '#C8E0EA'], 'album-9': ['art/story/06-kings.svg', '#EAD9B6'],
    'album-10': ['art/story/10-teaching.svg', '#D6E8D0'], 'album-11': ['art/story/12-church.svg', '#F0D8D2'], 'album-12': ['art/story/07-prophets.svg', '#E4DCCB'] };
  fs.mkdirSync(ASSETS, { recursive: true });
  const todo = Object.entries(want).filter(([n]) => !fs.existsSync(path.join(ASSETS, n + '-1024.jpg')));
  if (!todo.length) return;
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const [name, [src, bg]] of todo) {
    const svg = fs.readFileSync(path.join(ROOT, src), 'utf8');
    await page.setContent(`<body style="margin:0;background:${bg}"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:1024px;height:1024px;object-fit:cover;display:block"></body>`);
    await page.waitForTimeout(100);
    for (const size of [1024, 256]) {
      await page.setViewportSize({ width: size, height: size });
      await page.evaluate(s => { const i = document.querySelector('img'); i.style.width = i.style.height = s + 'px'; }, size);
      fs.writeFileSync(path.join(ASSETS, `${name}-${size}.jpg`), await page.screenshot({ type: 'jpeg', quality: 78 }));
    }
    await page.setViewportSize({ width: 1024, height: 1024 });
  }
  await page.close();
}

// ── the local instance ────────────────────────────────────────────────────────
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function startServer(variant = 'typical') {
  const [sitePort, apiPort] = [await freePort(), await freePort()];
  const child = spawn(process.execPath, [path.join(TOOLS, 'lib', 'server.mjs'), '--site-port', sitePort, '--api-port', apiPort, '--variant', variant, '--demo-time', DEMO_TIME, '--assets', ASSETS], { stdio: ['ignore', 'pipe', 'pipe'] });
  const errors = [];
  child.stderr.on('data', d => { const s = String(d); errors.push(s); if (/rig api error|unhandled/.test(s)) process.stderr.write('[server] ' + s); });
  const ready = await new Promise((ok, fail) => {
    let buf = '';
    child.stdout.on('data', d => { buf += d; const line = buf.split('\n').find(l => l.includes('"ready"')); if (line) ok(JSON.parse(line)); });
    child.on('exit', code => fail(new Error('server exited ' + code + '\n' + errors.join(''))));
    setTimeout(() => fail(new Error('server did not start\n' + errors.join(''))), 30000);
  });
  const rig = async (p, init) => { const r = await fetch(ready.api + p, init); if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`); return r.json(); };
  return { ...ready, child, errors, rig, stop: () => child.kill() };
}

// Per-variant session material for the browser: the device, each profile's session (as /api/login returns it)
// and the picker's cached profile list (what a real device has after its first visit).
async function sessionsFor(srv) {
  const info = await srv.rig('/__rig/info');
  const call = async (p, pt) => { const r = await fetch(srv.api + p, { headers: { 'X-Device-Token': info.device.token, ...(pt ? { 'X-Profile-Token': pt } : {}) } }); return r.json(); };
  const profiles = await call('/api/profiles');
  const sessions = {};
  for (const [id, token] of Object.entries(info.sessions)) { const me = await call('/api/me', token); if (me.profile) sessions[id] = { token, profile: me.profile }; }
  return { info, profiles: profiles.profiles || profiles, sessions };
}

// ── catalog ───────────────────────────────────────────────────────────────────
async function loadCatalog() {
  const dir = path.join(TOOLS, 'areas');
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    for (const s of mod.screens || []) out.push({ area: mod.area || f.replace(/\.mjs$/, ''), file: f.replace(/\.mjs$/, ''), ...s });
  }
  return out;
}
const variantFor = (s, state) => (s.variant && s.variant[state]) || (['empty', 'typical', 'overflow'].includes(state) ? state : 'typical');

function plan(catalog) {
  const jobs = [];
  for (const s of catalog) {
    if (F.area && !F.area.includes(s.area)) continue;
    if (F.file && !F.file.includes(s.file)) continue;
    if (F.screen && !F.screen.includes(s.screen)) continue;
    for (const state of s.states || ['typical']) {
      if (!STATES.includes(state)) throw new Error(`${s.area}/${s.screen}: unknown state ${state}`);
      if (F.state && !F.state.includes(state)) continue;
      const devs = s.devices || DEFAULT_DEVICES;
      const quickFallback = QUICK && !list('device') && !devs.some(d => F.device.includes(d)) ? devs[0] : null;
      for (const device of devs) {
        if (!DEVICES[device]) throw new Error(`${s.area}/${s.screen}: unknown device ${device}`);
        if (F.device && !F.device.includes(device) && device !== quickFallback) continue;
        if (device === 'iphone-safari' && !SAFARI_STATES.includes(state) && !(s.devices || []).includes('iphone-safari')) continue;
        for (const mode of s.modes || MODES) {
          if (F.mode && !F.mode.includes(mode)) continue;
          jobs.push({ s, state, device, mode, variant: variantFor(s, state), file: path.join(OUT, s.area, `${s.screen}-${state}-${device}-${mode}.png`) });
        }
      }
    }
  }
  return jobs;
}

// ── one capture ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOLD = /\/api\/(data|activity|profiles|chat\/history|admin\/usage|dollywood\/waits)/;

async function capture(browser, srv, S, job) {
  const { s, state, device, mode } = job;
  const dev = DEVICES[device];
  // Service workers are blocked except on screens that study them (s.sw): Playwright WebKit cannot serve an offline
  // navigation from a service worker, and a first install shows the shell's "Hub updated" toast on every capture.
  const ctx = await browser.newContext({ ...contextOptions(device, mode), serviceWorkers: s.sw ? 'allow' : 'block' });
  const t0 = Date.now();
  const logs = [];
  // network-quiet tracking for settle(); requests held on purpose (loading state, t.hold) are not waited for
  const pending = new Set(), heldReqs = new Set();
  let lastNet = Date.now();
  ctx.on('request', r => { if (!r.url().startsWith('data:')) { pending.add(r); lastNet = Date.now(); } });
  const done = r => { pending.delete(r); lastNet = Date.now(); };
  ctx.on('requestfinished', done); ctx.on('requestfailed', done);
  const busy = () => [...pending].some(r => !heldReqs.has(r));
  await ctx.route(PROD_API + '/**', r => r.abort());                     // belt and braces: production is never reachable
  const held = [];
  const holdRoute = r => { held.push(r); heldReqs.add(r.request()); };
  if (state === 'loading') await ctx.route(u => HOLD.test(u.href) && u.href.startsWith(srv.api), holdRoute);
  const who = s.profile === undefined ? 'eli' : s.profile;             // null = signed out (picker); 'unpaired' = no device
  const cfg = {
    site: srv.site, api: srv.api, dev: { platform: dev.platform, touchPoints: dev.touchPoints, standalone: dev.standalone },
    device: who === 'unpaired' ? null : S.info.device,
    session: who && who !== 'unpaired' ? S.sessions[who] : null,
    profiles: who === 'unpaired' ? null : S.profiles,
    last: s.lastProfile || (who && who !== 'unpaired' ? who : null),
    extra: s.localStorage || null,
  };
  if (who && who !== 'unpaired' && !cfg.session) throw new Error(`no session for profile ${who}`);
  await ctx.addInitScript(c => {
    try {
      // Safari (iOS 14.5+, macOS) has webkitSpeechRecognition, so the hub's mic buttons show there; WebKit on Windows
      // lacks it. An inert stand-in (no microphone, never returns a result) lets the captures show the same UI.
      if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        window.webkitSpeechRecognition = class extends EventTarget {
          constructor() { super(); this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; }
          start() {}
          stop() { setTimeout(() => { const e = new Event('end'); if (this.onend) this.onend(e); this.dispatchEvent(e); }, 0); }
          abort() { this.stop(); }
        };
      }
      const def = (k, v) => Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true });
      def('platform', c.dev.platform); def('maxTouchPoints', c.dev.touchPoints); if (c.dev.standalone) def('standalone', true);
      if (location.origin === c.site && !localStorage.getItem('rig.init')) {
        localStorage.clear();
        localStorage.setItem('hub.api', JSON.stringify(c.api));
        if (c.device) localStorage.setItem('hub.device', JSON.stringify(c.device));
        if (c.session) localStorage.setItem('hub.session', JSON.stringify(c.session));
        if (c.profiles) localStorage.setItem('hub.profiles', JSON.stringify(c.profiles));
        if (c.last) localStorage.setItem('hub.lastProfile', JSON.stringify(c.last));
        if (c.extra) for (const [k, v] of Object.entries(c.extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        localStorage.setItem('rig.init', '1');
      }
    } catch (e) {}
  }, cfg);
  // the browser clock is fixed half a second after the demo instant: seeded times are whole minutes before it, so
  // floor-rounded labels ("1m ago") never sit on a boundary
  await ctx.clock.setFixedTime(new Date(Date.parse(DEMO_TIME) + 500));
  const page = await ctx.newPage();
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/registration blocked by Playwright/.test(m.text())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', e => logs.push(`pageerror: ${e.message}`.slice(0, 300)));

  const settle = async (max = 8000) => {
    if (state === 'loading') { await sleep(s.loadingWait || 1200); return; }
    const until = Date.now() + max;
    while (Date.now() < until && (busy() || Date.now() - lastNet < 400)) await sleep(100);
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
    for (const f of page.frames()) { try { await f.evaluate(() => document.fonts && document.fonts.ready); } catch {} }
    await sleep(s.settle || 350);
  };
  const frame = () => page.frameLocator('#frame');
  const cors = { 'Access-Control-Allow-Origin': srv.site, 'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', Vary: 'Origin' };
  const matcher = m => typeof m === 'function' ? m : m instanceof RegExp ? (u => m.test(u.href)) : (u => u.href.startsWith(srv.api + m));
  const t = {
    page, ctx, state, device, mode, variant: job.variant, profile: who, site: srv.site, api: srv.api, dev,
    loading: state === 'loading', offline: state === 'offline', error: state === 'error',
    touch: dev.hasTouch, settle, sleep, frame,
    /** Open the shell at a hash ('#home', '#apps', '#prayer' …). */
    async goto(hash = '') { await page.goto(srv.site + '/index.html' + hash, { waitUntil: 'load' }); },
    /** Open an app inside the shell viewer and wait for its document. */
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id);
      await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      const f = await waitFrame(page, id);
      if (wait && !t.loading) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {});
      return f;
    },
    /** The app iframe's Frame (after openApp). */
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    /** Tap (touch devices) or click. */
    async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    /** Tap inside a frame (e.g. the app Frame from openApp); opts.force skips Playwright's actionability waits. */
    async tapIn(frameOrLoc, selector, opts = {}) { const loc = selector ? frameOrLoc.locator(selector).first() : frameOrLoc; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    /** Hold matching requests unanswered for the rest of the capture (settle does not wait for them). match: '/api/…' prefix, RegExp or (url) => bool. */
    async hold(match) { await ctx.route(matcher(match), holdRoute); },
    /** Answer matching API requests with a canned response (CORS headers for the site added). */
    async answer(match, { status = 200, body = {}, contentType = 'application/json', headers = {} } = {}) {
      await ctx.route(matcher(match), r => r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({ status, contentType, headers: { ...cors, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
    },
    /** Make matching API requests fail the way the Worker fails: { error, message } with a status. */
    async failApi(match, { status = 500, error = 'internal', message = 'Something went wrong on the server.' } = {}) { await t.answer(match, { status, body: { error, message } }); },
    /** Move the fixed browser clock (ms or Date). */
    async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    /** Scroll an element (default the shell's #views) by y px, or to 'bottom'. */
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };

  let ok = true, error = null;
  try {
    if (state === 'offline') {
      // Offline, as a device that has used the hub before sees it: a warm load fills hub.js's local cache, then the
      // API and every other host become unreachable and navigator.onLine is false, and the screen is opened again.
      // The site's own files are still served — standing in for the service-worker cache, because Playwright WebKit
      // cannot serve an offline navigation from a service worker (see 01-capture.md, manual checks).
      await s.go(t); await settle();
      // photos stay available: /api/media/* is served immutable for a year, so a device that has seen them has them cached
      await ctx.route(u => !u.href.startsWith(srv.site) && !u.href.startsWith(srv.api + '/api/media/') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), r => r.abort('internetdisconnected'));
      await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true }); } catch {} });
      t.reopened = true;
      await s.go(t).catch(e => logs.push('offline reopen: ' + e.message));
      await sleep(1200);
      await settle(3000);
    } else {
      await s.go(t);
      await settle();
    }
    if (s.after) await s.after(t);
    fs.mkdirSync(path.dirname(job.file), { recursive: true });
    await page.screenshot({ path: job.file, ...(s.animations === 'allow' ? {} : { animations: 'disabled' }), caret: 'hide', scale: SCALE === 'css' ? 'css' : 'device', timeout: 20000 });
  } catch (e) {
    ok = false; error = String(e && e.message || e).split('\n')[0];
    try { fs.mkdirSync(path.dirname(job.file), { recursive: true }); await page.screenshot({ path: job.file, scale: 'css' }); } catch {}
  }
  for (const r of held) r.abort().catch(() => {});
  await ctx.close().catch(() => {});
  const rel = path.relative(ROOT, job.file);
  return { file: (rel.startsWith('..') ? job.file : rel).replace(/\\/g, '/'), area: s.area, screen: s.screen, state, device, mode, variant: job.variant,
    ok, error, ms: Date.now() - t0, console: logs.slice(0, 20), note: s.note || null };
}

async function waitFrame(page, id, timeout = 10000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const f = page.frames().find(f => f.url().includes(`/apps/${id}.html`));
    if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); return f; }
    await sleep(100);
  }
  throw new Error('app frame did not load: ' + id);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const pw = playwright();
  if (flag('serve')) {
    const srv = await startServer(opt('variant', 'typical'));
    const S = await sessionsFor(srv);
    log(`serving ${srv.site}  (API ${srv.api}, variant ${opt('variant', 'typical')}); device token ${S.info.device.token}; Ctrl+C to stop`);
    return new Promise(() => {});
  }
  const catalog = await loadCatalog();
  const jobs = plan(catalog);
  if (flag('list')) { for (const j of jobs) console.log(path.relative(ROOT, j.file)); console.log(jobs.length, 'captures'); return; }
  if (!jobs.length) { log('nothing to capture for these filters'); return; }
  log(`${jobs.length} captures planned`);

  const browser = await pw.webkit.launch();
  await renderAssets(browser);
  const srv = await startServer('typical');
  const results = [];
  try {
    // group by (screen, variant): reset the database once per group, run the group's captures in parallel
    const groups = new Map();
    // screens that write (isolate: true) and error states (wrong PINs/codes hit the Worker's rate limits) get a fresh database per capture
    for (const j of jobs) { const k = `${j.s.area}/${j.s.screen}|${j.variant}|${j.state}` + (j.s.isolate || j.state === 'error' ? '|' + j.file : ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(j); }
    let n = 0;
    for (const [key, group] of groups) {
      await srv.rig('/__rig/reset?variant=' + group[0].variant, { method: 'POST' });
      const S = await sessionsFor(srv);
      const queue = [...group];
      await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        while (queue.length) {
          const job = queue.shift();
          const r = await capture(browser, srv, S, job);
          results.push(r); n++;
          if (!r.ok || n % 25 === 0) log(`${n}/${jobs.length} ${r.ok ? 'ok ' : 'ERR'} ${r.file}${r.error ? ' — ' + r.error : ''}`);
        }
      }));
    }
  } finally {
    srv.stop();
  }
  writeManifest(results);
  if (!flag('no-sheets') && OUT === DEFAULT_OUT) {
    const { buildSheets } = await import(pathToFileURL(path.join(TOOLS, 'lib', 'sheets.mjs')).href);
    await buildSheets(browser, { root: ROOT, out: OUT, areas: [...new Set(results.map(r => r.area))] });
  }
  await browser.close();
  const bad = results.filter(r => !r.ok);
  log(`done: ${results.length - bad.length} ok, ${bad.length} failed`);
  for (const b of bad) log('  FAILED', b.file, b.error);
}

function writeManifest(results) {
  const file = path.join(OUT, 'manifest.json');
  const abs = f => path.isAbsolute(f) ? f : path.join(ROOT, f);
  const key = f => path.resolve(abs(f)).toLowerCase();
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).captures || []; } catch {}
  const byFile = new Map(prev.map(r => [key(r.file), r]));
  for (const r of results) {
    const buf = fs.existsSync(abs(r.file)) ? fs.readFileSync(abs(r.file)) : null;
    byFile.set(key(r.file), { ...r, bytes: buf ? buf.length : 0, sha256: buf ? crypto.createHash('sha256').update(buf).digest('hex') : null, capturedAt: new Date().toISOString() });
  }
  const captures = [...byFile.values()].filter(r => fs.existsSync(abs(r.file))).sort((a, b) => a.file.localeCompare(b.file));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ engine: 'Playwright WebKit ' + PW_VERSION, demoTime: DEMO_TIME, scale: SCALE, captures }, null, 1) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
