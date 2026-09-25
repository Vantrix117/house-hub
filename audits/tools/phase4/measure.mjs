#!/usr/bin/env node
// Phase 4 measurement rig. Runs the Phase 1 screen definitions (audits/tools/areas/*.mjs, the same screens, states and
// "t" helper API that capture.mjs gives them) and, instead of taking a picture, MEASURES every screen: the shell page
// and every same-origin frame (the app iframe #frame). One JSON per job:
//   audits/evidence/p4/measure/raw/<run>/<area>/<screen>-<state>-<device>-<mode>-<theme>.json      (git-ignored)
// and, for the named themes of the "themes" run, a 1x CSS screenshot:
//   audits/evidence/p4/measure/shots/<theme>/<area>/<screen>-<state>-<device>-<mode>.png           (git-ignored)
// aggregate.mjs turns raw/ into the committed summaries. See audits/tools/phase4/README.md.
//
//   node audits/tools/phase4/measure.mjs --run themes [--area tally --screen main --state typical --theme frost]
//        [--parallel 8] [--max-minutes 8] [--list] [--retry-failed] [--force]
//   runs: themes  = state typical, iPad portrait, system×light, system×dark, parchment, frost, midnight, forest (OS light), hearth×dark OS
//         devices = state typical, iPhone PWA, iPad landscape, desktop (and TV where a screen lists it), system × light/dark
//         states  = every other state (empty, overflow, loading, offline, error) on iPad portrait, system × light/dark
//   A screen that does not list iPad portrait uses its first device in the themes and states runs (the TV board → tv).
//   Resumable: a job whose JSON exists is skipped (a failed one is retried once more unless it has failed twice;
//   --retry-failed retries every failed one, --force re-measures everything). --max-minutes stops taking new jobs.
//
// Local only: every lane runs its own lib/server.mjs (the repo + worker/src on in-memory SQLite, seeded demo household)
// and its own Playwright WebKit. Production is blocked in the browser; the Worker's outbound fetch is stubbed.
// Every job starts from a freshly reset database. Nothing here edits app code, capture.mjs, lib/, seed/ or areas/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEVICES, contextOptions } from '../lib/devices.mjs';
import { DEMO_TIME } from '../seed/story.mjs';
import { playwright } from '../lib/local.mjs';
import { m4lib } from './measure/page-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '..');
const ROOT = path.resolve(TOOLS, '..', '..');
const OUTROOT = path.join(ROOT, 'audits', 'evidence', 'p4', 'measure');
const HOME = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
const ASSETS = path.join(HOME, 'assets-v2');
const PROD_API = 'https://house-hub-api.catalystfarm1.workers.dev';

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const list = n => { const v = opt(n); return v ? v.split(',').map(s => s.trim()).filter(Boolean) : null; };
const F = { run: list('run') || ['themes'], area: list('area'), file: list('file'), screen: list('screen'), state: list('state'), device: list('device'), mode: list('mode'), theme: list('theme') };
const PARALLEL = +opt('parallel', 4);
const MAX_MIN = opt('max-minutes') ? +opt('max-minutes') : null;
const JOB_TIMEOUT = +opt('job-timeout', 150) * 1000;
const T0 = Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── the matrix ────────────────────────────────────────────────────────────────
const SYSTEM = [['system', 'light'], ['system', 'dark']];
const RUNS = {
  themes: { states: ['typical'], themes: [...SYSTEM, ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light'], ['hearth', 'dark']], devices: 'primary' },
  devices: { states: ['typical'], themes: SYSTEM, devices: 'others' },
  states: { states: ['empty', 'overflow', 'loading', 'offline', 'error'], themes: SYSTEM, devices: 'primary' },
};
const OTHER_DEVICES = ['iphone-pwa', 'ipad-landscape', 'desktop', 'tv'];
const primaryDevice = s => { const devs = s.devices || ['ipad-portrait']; return devs.includes('ipad-portrait') ? 'ipad-portrait' : devs[0]; };
const variantFor = (s, state) => (s.variant && s.variant[state]) || (['empty', 'typical', 'overflow'].includes(state) ? state : 'typical');

async function loadCatalog() {
  const dir = path.join(TOOLS, 'areas'); const out = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    for (const s of mod.screens || []) out.push({ area: mod.area || f.replace(/\.mjs$/, ''), file: f.replace(/\.mjs$/, ''), ...s });
  }
  return out;
}
function plan(catalog) {
  const jobs = [];
  for (const run of F.run) {
    const R = RUNS[run]; if (!R) throw new Error('unknown run ' + run);
    for (const s of catalog) {
      if (F.area && !F.area.includes(s.area)) continue;
      if (F.file && !F.file.includes(s.file)) continue;
      if (F.screen && !F.screen.includes(s.screen)) continue;
      const states = (s.states || ['typical']).filter(st => R.states.includes(st));
      for (const state of states) {
        if (F.state && !F.state.includes(state)) continue;
        const prim = primaryDevice(s);
        const devs = R.devices === 'primary' ? [prim] : (s.devices || ['ipad-portrait', 'ipad-landscape', 'iphone-pwa', 'iphone-safari', 'desktop']).filter(d => OTHER_DEVICES.includes(d) && d !== prim);
        for (const device of devs) {
          if (F.device && !F.device.includes(device)) continue;
          for (const [theme, mode] of R.themes) {
            if (s.modes && !s.modes.includes(mode)) continue;
            if (/^me-theme-/.test(s.screen) && theme !== 'system') continue;      // these screens pick a theme themselves
            if (F.mode && !F.mode.includes(mode)) continue;
            if (F.theme && !F.theme.includes(theme)) continue;
            const name = `${s.screen}-${state}-${device}-${mode}-${theme}`;
            jobs.push({ run, s, state, device, mode, theme, variant: variantFor(s, state), name,
              file: path.join(OUTROOT, 'raw', run, s.area, name + '.json'),
              shot: run === 'themes' && theme !== 'system' ? path.join(OUTROOT, 'shots', theme, s.area, `${s.screen}-${state}-${device}-${mode}.png`) : null });
          }
        }
      }
    }
  }
  return jobs;
}

// design.css custom properties (every name declared anywhere in the file)
const TOKEN_NAMES = [...new Set([...fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map(m => m[1]))];

// ── local instance (as capture.mjs) ──────────────────────────────────────────
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function startServer(variant = 'typical') {
  const [sitePort, apiPort] = [await freePort(), await freePort()];
  const child = spawn(process.execPath, [path.join(HERE, 'measure', 'server-guard.mjs'), '--site-port', sitePort, '--api-port', apiPort, '--variant', variant, '--demo-time', DEMO_TIME, '--assets', ASSETS], { stdio: ['pipe', 'pipe', 'pipe'] });   // stdin: closes when this process dies (server-guard.mjs)
  const errors = [];
  child.stderr.on('data', d => { const s = String(d); errors.push(s); if (errors.length > 50) errors.shift(); });
  const ready = await new Promise((ok, fail) => {
    let buf = '';
    child.stdout.on('data', d => { buf += d; const line = buf.split('\n').find(l => l.includes('"ready"')); if (line) ok(JSON.parse(line)); });
    child.on('exit', code => fail(new Error('server exited ' + code + '\n' + errors.join(''))));
    setTimeout(() => fail(new Error('server did not start\n' + errors.join(''))), 30000);
  });
  const rig = async (p, init) => { const r = await fetch(ready.api + p, init); if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`); return r.json(); };
  return { ...ready, child, errors, rig, stop: () => child.kill() };
}
async function sessionsFor(srv) {
  const info = await srv.rig('/__rig/info');
  const call = async (p, pt) => { const r = await fetch(srv.api + p, { headers: { 'X-Device-Token': info.device.token, ...(pt ? { 'X-Profile-Token': pt } : {}) } }); return r.json(); };
  const profiles = await call('/api/profiles');
  const sessions = {};
  for (const [id, token] of Object.entries(info.sessions)) { const me = await call('/api/me', token); if (me.profile) sessions[id] = { token, profile: me.profile }; }
  return { info, profiles: profiles.profiles || profiles, sessions };
}
// The theme is a person preference (app_data person/hub/theme); the server's row wins after the first pull
// (apps/hub.js:96-104), so every profile gets the row. The kiosk cannot write and keeps its local theme.
async function setThemeRows(srv, S, theme) {
  const res = { ok: [], failed: [] };
  if (theme === 'system') return res;
  for (const [id, sess] of Object.entries(S.sessions)) {
    if (sess.profile.kind === 'kiosk') continue;
    const r = await fetch(srv.api + '/api/data/hub/theme?scope=person', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: srv.site, 'X-Device-Token': S.info.device.token, 'X-Profile-Token': sess.token }, body: JSON.stringify({ value: theme }) });
    (r.ok ? res.ok : res.failed).push(r.ok ? id : `${id}:${r.status}`);
  }
  return res;
}

// ── one job ───────────────────────────────────────────────────────────────────
const HOLD = /\/api\/(data|activity|profiles|chat\/history|admin\/usage|dollywood\/waits)/;
const LIB = `(${m4lib.toString()})(${JSON.stringify(TOKEN_NAMES)})`;
const cssSeen = new Set();

async function runJob(browser, srv, S, job, themeRows) {
  const { s, state, device, mode, theme } = job;
  const dev = DEVICES[device];
  const ctx = await browser.newContext({ ...contextOptions(device, mode), serviceWorkers: s.sw ? 'allow' : 'block' });
  const t0 = Date.now();
  const logs = [];
  const pending = new Set(), heldReqs = new Set();
  let lastNet = Date.now();
  ctx.on('request', r => { if (!r.url().startsWith('data:')) { pending.add(r); lastNet = Date.now(); } });
  const done = r => { pending.delete(r); lastNet = Date.now(); };
  ctx.on('requestfinished', done); ctx.on('requestfailed', done);
  const busy = () => [...pending].some(r => !heldReqs.has(r));
  await ctx.route(PROD_API + '/**', r => r.abort());
  const held = [];
  const holdRoute = r => { held.push(r); heldReqs.add(r.request()); };
  if (state === 'loading') await ctx.route(u => HOLD.test(u.href) && u.href.startsWith(srv.api), holdRoute);
  const who = s.profile === undefined ? 'eli' : s.profile;
  const extra = { ...(s.localStorage || {}) };
  if (theme !== 'system') extra['hub.theme'] = JSON.stringify(theme);          // hub.js reads it with JSON.parse (apps/hub.js:32)
  const cfg = {
    site: srv.site, api: srv.api, dev: { platform: dev.platform, touchPoints: dev.touchPoints, standalone: dev.standalone },
    device: who === 'unpaired' ? null : S.info.device,
    session: who && who !== 'unpaired' ? S.sessions[who] : null,
    profiles: who === 'unpaired' ? null : S.profiles,
    last: s.lastProfile || (who && who !== 'unpaired' ? who : null),
    extra: Object.keys(extra).length ? extra : null,
  };
  if (who && who !== 'unpaired' && !cfg.session) throw new Error(`no session for profile ${who}`);
  await ctx.addInitScript(c => {
    try {
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
    async goto(hash = '') { await page.goto(srv.site + '/index.html' + hash, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id);
      await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      const f = await waitFrame(page, id);
      if (wait && !t.loading) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {});
      return f;
    },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async tapIn(frameOrLoc, selector, opts = {}) { const loc = selector ? frameOrLoc.locator(selector).first() : frameOrLoc; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async hold(match) { await ctx.route(matcher(match), holdRoute); },
    async answer(match, { status = 200, body = {}, contentType = 'application/json', headers = {} } = {}) {
      await ctx.route(matcher(match), r => r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({ status, contentType, headers: { ...cors, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
    },
    async failApi(match, { status = 500, error = 'internal', message = 'Something went wrong on the server.' } = {}) { await t.answer(match, { status, body: { error, message } }); },
    async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };

  const out = { v: RIG_V, run: job.run, area: s.area, screen: s.screen, state, device, mode, theme, variant: job.variant, profile: who, name: job.name, ok: true, error: null, goError: null, ms: 0, themeRows, console: [] };
  try {
    try {
      if (state === 'offline') {
        await s.go(t); await settle();
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
    } catch (e) { out.goError = String(e && e.message || e).split('\n')[0]; }     // measured anyway, as capture.mjs still shot it
    Object.assign(out, await measure(page, srv, job));
  } catch (e) {
    out.ok = false; out.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | ');
  }
  for (const r of held) r.abort().catch(() => {});
  await ctx.close().catch(() => {});
  out.ms = Date.now() - t0; out.console = logs.slice(0, 20);
  return out;
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

// ── measuring ─────────────────────────────────────────────────────────────────
const SHOT = { scale: 'css', animations: 'disabled', caret: 'hide', timeout: 20000 };
const MAX_STEPS_PER_SCROLLER = 10, MAX_STEPS = 24;
// rig version: 2 = text sampled only where an occlusion grid shows the text on top (cover recorded per text),
// nontext.graphics[] (rings, bars, dots, svg ring/dial strokes). A raw file of an older version counts as todo.
const RIG_V = 2;

async function documents(page, srv) {
  const docs = [];
  for (const f of page.frames()) {
    const url = f.url();
    if (f !== page.mainFrame() && !url.startsWith(srv.site)) continue;
    let off = { x: 0, y: 0, w: null, h: null, visible: true, scale: 1 }, top = null;
    if (f !== page.mainFrame()) {
      // offset = sum of iframe content-box offsets up to the page; visibility = the top-level iframe is on screen
      let x = 0, y = 0, cur = f, visible = true, w = null, h = null, scale = 1;
      while (cur.parentFrame()) {
        const el = await cur.frameElement().catch(() => null); if (!el) { visible = false; break; }
        const b = await el.evaluate(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); let vis = true; for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) vis = false; } return { x: r.left + e.clientLeft + parseFloat(s.paddingLeft), y: r.top + e.clientTop + parseFloat(s.paddingTop), w: e.clientWidth, h: e.clientHeight, rw: r.width, vis: vis && r.width > 1 && r.height > 1 }; }).catch(() => null);
        if (!b) { visible = false; break; }
        x += b.x; y += b.y; if (w == null) { w = b.w; h = b.h; scale = b.w ? +(b.rw / (b.w + 0.0001)).toFixed(3) : 1; } if (!b.vis) visible = false;
        if (!cur.parentFrame().parentFrame()) top = el;
        cur = cur.parentFrame();
      }
      off = { x: +x.toFixed(1), y: +y.toFixed(1), w, h, visible, scale };
    }
    const app = (/\/apps\/([^/.]+)\.html/.exec(url) || [])[1];
    docs.push({ frame: f, name: f === page.mainFrame() ? 'page' : 'frame:' + (app || url.split('/').pop()), url: url.replace(srv.site, ''), off, top });
  }
  return docs;
}

async function measure(page, srv, job) {
  let docs = await documents(page, srv);
  for (const d of docs) { try { await d.frame.evaluate(LIB); d.ok = true; } catch (e) { d.ok = false; d.err = String(e.message).slice(0, 200); } }
  docs = docs.filter(d => d.ok);
  for (const d of docs) await d.frame.evaluate(() => __m4.settleAnimations(1500)).catch(() => {});
  for (const d of docs) d.decl = await d.frame.evaluate(() => __m4.loadDecl()).catch(e => 'error: ' + e.message);
  const res = { docs: [], text: [], nontext: { icons: [], controls: [], graphics: [] }, sweep: null };
  // static inventories at the screen's own scroll position
  const statics = new Map();
  for (const d of docs) {
    const st = await d.frame.evaluate(() => __m4.staticAll());
    statics.set(d.name, st);
    // stylesheet-level motion is the same for every job of a document: kept once per process in raw/_css/
    const cssKey = d.url.split('#')[0].split('?')[0];
    const cssFile = path.join(OUTROOT, 'raw', '_css', cssKey.replace(/[\/\\:]+/g, '_').replace(/^_/, '') + '.json');
    if (!cssSeen.has(cssKey) && !fs.existsSync(cssFile)) { fs.mkdirSync(path.dirname(cssFile), { recursive: true }); fs.writeFileSync(cssFile, JSON.stringify({ url: cssKey, css: st.motion.css, keyframes: st.motion.keyframes }, null, 1)); }
    cssSeen.add(cssKey);
    const { inventory, motion, ...rest } = st;
    res.docs.push({ name: d.name, url: d.url, offset: d.off, declRules: d.decl, ...rest, motion: { transitions: motion.transitions, animations: motion.animations, keyframes: motion.keyframes } });
  }
  if (job.shot) { fs.mkdirSync(path.dirname(job.shot), { recursive: true }); await page.screenshot({ path: job.shot, ...SHOT }); }

  // ── sweep: every visible text / icon / control, across the scroll range of each document's scrollers ──
  const measured = new Map(), iconS = new Map(), ctlS = new Map(), gfxS = new Map(); const meta = new Map(); const doneT = {}, doneI = {}, doneC = {}, doneG = {};
  const bestCover = new Map();   // text never accepted (cover > 0.5 at every step): its lowest cover
  const visDocs = docs.filter(d => d.off.visible);
  for (const d of visDocs) { doneT[d.name] = []; doneI[d.name] = []; doneC[d.name] = []; doneG[d.name] = []; }
  const top = docs.find(d => d.name === 'page');
  let stepNo = 0;
  async function step(label) {
    const T = [], I = [], C = [], G = [];
    for (const d of visDocs) {
      const r = await d.frame.evaluate(([st, si, sc, sg]) => ({ t: __m4.visibleTexts(st), i: __m4.visibleOf(__m4.icons(), si), c: __m4.visibleOf(__m4.controls(), sc), g: __m4.visibleG(__m4.graphics(), sg) }), [doneT[d.name], doneI[d.name], doneC[d.name], doneG[d.name]]).catch(() => null);
      if (!r) continue;
      const dx = d.off.x, dy = d.off.y;
      const shift = o => ({ ...o, x: o.x + dx, y: o.y + dy });
      const shiftPts = P => Object.fromEntries(Object.entries(P || {}).map(([k, v]) => [k, v.map(([x, y]) => [x + dx, y + dy])]));
      let cands = r.t.map(it => ({ ...it, doc: d.name, key: d.name + '|' + it.id, rects: it.rects.map(shift), grid: { ...it.grid, ok: it.grid.ok.map(([ri, ci, x, y]) => [ri, ci, x + dx, y + dy]) } }));
      let icands = r.i.map(it => ({ ...it, doc: d.name, key: d.name + '|' + it.id, rect: shift(it.rect) }));
      let ccands = r.c.map(it => ({ ...it, doc: d.name, key: d.name + '|' + it.id, rect: shift(it.rect) }));
      let gcands = r.g.map(it => ({ ...it, doc: d.name, key: d.name + '|' + it.id, rect: shift(it.rect), pts: shiftPts(it.pts) }));
      if (d.name !== 'page' && d.top && top) {
        // the frame's content must also be what the page shows at that point (not under a shell sheet, pill or toast):
        // every uncovered text column is hit-tested in the page too; icons, controls and graphics at their centre
        const tp = cands.flatMap(c => c.grid.ok.map(o => [o[2], o[3]]));
        const pts = [...tp, ...icands.map(c => [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2]), ...ccands.map(c => [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2]), ...gcands.map(c => [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2])];
        const okPts = await page.evaluate(([el, pts]) => pts.map(([x, y]) => x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight && document.elementFromPoint(x, y) === el), [d.top, pts]).catch(() => pts.map(() => true));
        let k = 0;
        for (const c of cands) { const ok = c.grid.ok.filter(() => okPts[k++]); c.grid = { ...c.grid, ok, cover: c.grid.n ? +(1 - ok.length / c.grid.n).toFixed(3) : 1 }; }
        const a = tp.length, b = icands.length, cc = ccands.length;
        icands = icands.filter((_, i) => okPts[a + i]); ccands = ccands.filter((_, i) => okPts[a + b + i]); gcands = gcands.filter((_, i) => okPts[a + b + cc + i]);
      }
      // text: accepted when at most half of its in-viewport columns are covered; a fully uncovered one is done, a
      // partly covered one stays eligible and is re-measured if a later step shows more of it
      const acc = [];
      for (const c of cands) {
        const cov = c.grid.cover; const id = c.key.split('|')[1];
        if (cov > 0.5 || !c.grid.ok.length) { bestCover.set(c.key, Math.min(bestCover.has(c.key) ? bestCover.get(c.key) : 1, cov)); continue; }
        const prev = measured.get(c.key); if (prev && prev.s && prev.it.cover <= cov) { if (cov === 0) doneT[d.name].push(id); continue; }
        c.cover = cov; c.mask = cov > 0 ? { cs: c.grid.cs, ok: c.grid.ok.map(([ri, ci]) => [ri, ci]) } : null;
        if (cov === 0) doneT[d.name].push(id);
        meta.set(c.key, { step: stepNo, label }); acc.push(c);
      }
      for (const c of icands) doneI[d.name].push(c.key.split('|')[1]);
      for (const c of ccands) doneC[d.name].push(c.key.split('|')[1]);
      for (const c of gcands) doneG[d.name].push(c.key.split('|')[1]);
      T.push(...acc); I.push(...icands); C.push(...ccands); G.push(...gcands);
    }
    stepNo++;
    if (!T.length && !I.length && !C.length && !G.length) return;
    const shownPng = I.length || G.length ? await page.screenshot(SHOT) : null;
    for (const d of visDocs) await d.frame.evaluate(ids => { __m4.markIcons(ids); __m4.hide(true); }, I.filter(i => i.doc === d.name).map(i => i.key.split('|')[1])).catch(() => {});
    const hiddenPng = await page.screenshot(SHOT);
    for (const d of visDocs) await d.frame.evaluate(() => { __m4.hide(false); __m4.unmarkIcons(); }).catch(() => {});
    const strip = it => ({ key: it.key, rects: it.rects, rect: it.rect, color: it.color, op: it.op, bw: it.bw, bc: it.bc, mask: it.mask || null });
    const gstrip = g => ({ key: g.key, kind: g.kind, paint: g.paint, alpha: g.alpha, gradient: g.gradient, pts: g.pts, groups: g.groups, track: g.track || null });
    const s = await page.evaluate(([a, b, t, i, c, g]) => __m4.sample(a, b, t, i, c, g), [shownPng ? shownPng.toString('base64') : null, hiddenPng.toString('base64'), T.map(strip), I.map(strip), C.map(strip), G.map(gstrip)]);
    const byKey = arr => new Map(arr.map(x => [x.key, x]));
    const ts = byKey(s.texts), is = byKey(s.icons), cs = byKey(s.controls), gs = byKey(s.graphics || []);
    for (const it of T) { const sm = ts.get(it.key) || null; const prev = measured.get(it.key); if (!sm && prev && prev.s) continue; measured.set(it.key, { it, s: sm }); }
    for (const it of G) gfxS.set(it.key, { it, s: gs.get(it.key) || null });
    for (const it of I) iconS.set(it.key, { it, s: is.get(it.key) || null });
    for (const it of C) ctlS.set(it.key, { it, s: cs.get(it.key) || null });
  }
  await step('initial');
  const scrollInfo = [];
  let truncated = false;
  for (const d of visDocs) {
    const scs = await d.frame.evaluate(() => __m4.scrollers()).catch(() => []);
    for (const sc of scs) {
      const ys = []; for (let y = 0; y < sc.sh - sc.ch + Math.floor(sc.ch * 0.8); y += Math.max(40, Math.floor(sc.ch * 0.8))) ys.push(y);
      if (ys.length > MAX_STEPS_PER_SCROLLER) { truncated = true; ys.length = MAX_STEPS_PER_SCROLLER; }
      scrollInfo.push({ doc: d.name, sel: sc.sel, sh: sc.sh, ch: sc.ch, top: sc.top, steps: ys.length });
      for (const y of ys) {
        if (stepNo >= MAX_STEPS) { truncated = true; break; }
        await d.frame.evaluate(([id, y]) => __m4.scrollTo(id, y), [sc.id, y]);
        await sleep(140);
        await step(`${d.name} ${sc.sel} y=${y}`);
      }
      await d.frame.evaluate(([id, y]) => __m4.scrollTo(id, y), [sc.id, sc.top]).catch(() => {});
    }
  }
  res.sweep = { steps: stepNo, scrollers: scrollInfo, truncated, docsVisible: visDocs.map(d => d.name) };

  // ── records ──
  const r2 = v => Math.round(v * 10) / 10;
  const rect = r => r ? { x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) } : null;
  const seen = new Set();
  for (const [key, { it, s }] of measured) {
    seen.add(key);
    const req = it.large ? 3 : 4.5;
    const { rects, id, key: _k, grid, mask, cover, ...rest } = it;
    res.text.push({ doc: it.doc, ...rest, rect: rect(rects[0]), lines: rects.length, measured: !!s, step: (meta.get(key) || {}).step, cover: cover || 0, cols: grid ? grid.n : null,
      p10: s ? s.p10 : null, med: s ? s.med : null, bgP10: s ? s.bgP10 : null, bgMed: s ? s.bgMed : null, alpha: s ? s.alpha : null, req,
      aa: s ? s.p10 >= req : null, aaMed: s ? s.med >= req : null });
  }
  // text in the DOM that was never on screen and uncovered during the sweep (offscreen rows, under a sheet, a hidden frame)
  for (const d of docs) {
    const st = statics.get(d.name);
    for (const it of st.inventory) {
      const key = d.name + '|' + it.id; if (seen.has(key)) continue;
      const { id, ...rest } = it;
      const occ = bestCover.has(key) ? bestCover.get(key) : null;
      res.text.push({ doc: d.name, ...rest, rect: it.rect ? rect({ x: it.rect.x + d.off.x, y: it.rect.y + d.off.y, w: it.rect.w, h: it.rect.h }) : null, measured: false, ...(occ != null ? { occluded: true, cover: occ } : {}), req: it.large ? 3 : 4.5, p10: null, med: null, aa: null, aaMed: null });
    }
  }
  for (const [, { it, s }] of iconS) { const { id, key, rect: rr, ...rest } = it; res.nontext.icons.push({ doc: it.doc, ...rest, rect: rect(rr), ...(s || {}), key: undefined, pass: s && s.ratio != null ? s.ratio >= 3 : null }); }
  for (const [, { it, s }] of gfxS) { const { id, key, rect: rr, pts, groups, ...rest } = it; res.nontext.graphics.push({ doc: it.doc, ...rest, rect: rect(rr), ...(s || {}), key: undefined, pass: s && s.ratio != null ? s.ratio >= 3 : null }); }
  for (const [, { it, s }] of ctlS) { const { id, key, rect: rr, ...rest } = it; res.nontext.controls.push({ doc: it.doc, ...rest, rect: rect(rr), ...(s || {}), key: undefined, pass: s ? s.boundary >= 3 : null }); }
  // strip the stack from each text into a per-job table (it repeats)
  const stacks = []; for (const x of res.text) { if (x.stack == null) continue; let i = stacks.indexOf(x.stack); if (i < 0) { stacks.push(x.stack); i = stacks.length - 1; } x.stack = i; }
  res.stacks = stacks;
  return res;
}

// ── lanes ─────────────────────────────────────────────────────────────────────
async function lane(n, queue, pw, stats) {
  let srv = null, browser = null;
  const up = async () => { if (!srv) srv = await startServer('typical'); if (!browser || !browser.isConnected()) browser = await pw.webkit.launch(); };
  try {
    while (queue.length) {
      if (MAX_MIN && Date.now() - T0 > MAX_MIN * 60000) { stats.stopped = true; break; }
      const job = queue.shift();
      let out;
      try {
        await up();
        await srv.rig('/__rig/reset?variant=' + job.variant, { method: 'POST' });
        const S = await sessionsFor(srv);
        const themeRows = await setThemeRows(srv, S, job.theme);
        let timer;
        out = await Promise.race([runJob(browser, srv, S, job, themeRows), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('job timeout ' + JOB_TIMEOUT / 1000 + 's')), JOB_TIMEOUT); })]).finally(() => clearTimeout(timer));
      } catch (e) {
        out = { v: RIG_V, run: job.run, area: job.s.area, screen: job.s.screen, state: job.state, device: job.device, mode: job.mode, theme: job.theme, variant: job.variant, name: job.name, ok: false, error: String(e && e.message || e).split('\n')[0] };
        // a timeout or crash may leave the browser or server wedged: restart both
        try { await browser?.close(); } catch {} browser = null; try { srv?.stop(); } catch {} srv = null;
      }
      let prev = null; try { prev = JSON.parse(fs.readFileSync(job.file, 'utf8')); } catch {}
      out.attempts = (prev && !prev.ok && (prev.v || 1) >= RIG_V ? prev.attempts || 1 : 0) + 1;
      out.measuredAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      fs.writeFileSync(job.file, JSON.stringify(out));
      stats.n++; out.ok ? stats.ok++ : stats.failed.push(`${job.run}/${job.s.area}/${job.name}: ${out.error}`);
      const tx = out.text || []; const fails = tx.filter(x => x.aa === false).length;
      if (!out.ok || stats.n % 10 === 0 || stats.verbose) log(`[${n}] ${stats.n}/${stats.total} ${out.ok ? 'ok ' : 'ERR'} ${job.run}/${job.s.area}/${job.name} ${((out.ms || 0) / 1000).toFixed(1)}s texts=${tx.filter(x => x.measured).length}/${tx.length} belowAA=${fails}${out.goError ? ' goError=' + out.goError : ''}${out.error ? ' — ' + out.error : ''}`);
    }
  } finally {
    try { await browser?.close(); } catch {}
    try { srv?.stop(); } catch {}
  }
}

async function main() {
  const catalog = await loadCatalog();
  const all = plan(catalog);
  if (flag('plan-json')) { process.stdout.write(JSON.stringify(all.map(j => ({ run: j.run, area: j.s.area, name: j.name, file: path.relative(OUTROOT, j.file).split(path.sep).join('/') })))); return; }
  const status = j => { if (!fs.existsSync(j.file)) return 'todo'; if (flag('force')) return 'todo'; try { const o = JSON.parse(fs.readFileSync(j.file, 'utf8')); if ((o.v || 1) < RIG_V) return 'todo'; if (o.ok) return 'done'; if (flag('retry-failed') || (o.attempts || 1) < 2) return 'todo'; return 'failed'; } catch { return 'todo'; } };
  const st = all.map(j => [j, status(j)]);
  const todo = st.filter(([, s]) => s === 'todo').map(([j]) => j);
  const byRun = {}; for (const [j, s] of st) { const k = j.run; byRun[k] ||= { planned: 0, done: 0, failed: 0, todo: 0 }; byRun[k].planned++; byRun[k][s]++; }
  log(`planned ${all.length}: ` + Object.entries(byRun).map(([k, v]) => `${k} ${v.planned} (done ${v.done}, failed ${v.failed}, todo ${v.todo})`).join('; '));
  if (flag('list')) { for (const j of todo) console.log(path.relative(ROOT, j.file)); return; }
  if (!todo.length) { log('nothing left to measure'); return; }
  const pw = playwright();
  const stats = { n: 0, ok: 0, failed: [], total: todo.length, stopped: false, verbose: flag('verbose') };
  const queue = [...todo];
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, (_, i) => lane(i + 1, queue, pw, stats)));
  log(`this chunk: ${stats.n} measured, ${stats.ok} ok, ${stats.failed.length} failed; ${queue.length} left${stats.stopped ? ' (stopped at --max-minutes)' : ''}`);
  for (const f of stats.failed) log('  FAILED', f);
  if (!queue.length) log('nothing left to measure in this plan');
}
main().catch(e => { console.error(e); process.exit(1); });
