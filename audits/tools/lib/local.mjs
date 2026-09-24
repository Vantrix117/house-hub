// Experiment harness (audit Phase 2+): drive one or more emulated devices against the rig's local instance.
// The capture rig (capture.mjs) is left untouched so the Phase 1 baseline stays reproducible; this reuses its pieces.
//
//   import { local } from '../lib/local.mjs';
//   const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
//   const phone = await L.device({ device: 'iphone-pwa', profile: 'eli' });
//   const ipad  = await L.device({ device: 'ipad-portrait', profile: 'eli' });
//   const f = await phone.openApp('f260');            // the app's Frame inside the shell viewer
//   await phone.setOffline(true);  …  await phone.setOffline(false);
//   await L.apiAs('eli', '/api/data/f260?scope=person');   // what the server holds
//   await L.close();
//
// local(opts): variant ('empty'|'typical'|'overflow'|'park'), clock ('demo' = the rig's slowed demo clock; 'real' = real
//   time, seeds relative to now), engine ('webkit' | 'chromium' — Chromium is the installed Chrome, for heap metrics via
//   CDP and service-worker tests WebKit cannot do), siteCacheControl, vapid (true = throwaway VAPID pair for push tests),
//   overlay (a folder under audits/ served over the repo).
// L.device(opts): device (lib/devices.mjs name), mode ('light'|'dark'), profile (id | null = signed out | 'unpaired'),
//   fixedTime (ms: freeze the browser clock there; false = real clock; default: the demo instant + 0.5 s in demo mode),
//   installClock (ms: a controllable clock — use d.ctx.clock.runFor / fastForward), sw (allow service workers),
//   localStorage (extra keys), deviceToken (another paired device's token: default the rig's Kitchen iPad).
// Everything stays local: production is blocked, the Worker's outbound fetch is stubbed (see lib/server.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DEVICES, contextOptions } from './devices.mjs';
import { DEMO_TIME } from '../seed/story.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..');
const HOME = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
const ASSETS = path.join(HOME, 'assets-v2');
const PROD_API = 'https://house-hub-api.catalystfarm1.workers.dev';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
export const DEMO = Date.parse(DEMO_TIME);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function playwright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(HOME, 'browsers');
  return createRequire(path.join(HOME, 'noop.js'))('playwright-core');
}

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

async function vapidPair() {
  const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.webcrypto.subtle.exportKey('jwk', k.privateKey);
  const raw = Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url');
  return { publicKey: raw, privateKey: jwk.d };
}

export async function local({ variant = 'typical', clock = 'demo', engine = 'webkit', siteCacheControl, vapid = false, overlay, headless = true } = {}) {
  const pw = playwright();
  const [sitePort, apiPort] = [await freePort(), await freePort()];
  const env = { ...process.env };
  if (vapid) { const v = await vapidPair(); env.HUB_RIG_VAPID_PUBLIC = v.publicKey; env.HUB_RIG_VAPID_PRIVATE = v.privateKey; }
  const args = [path.join(HERE, 'server.mjs'), '--site-port', sitePort, '--api-port', apiPort, '--variant', variant, '--demo-time', DEMO_TIME, '--assets', ASSETS, '--clock', clock];
  if (siteCacheControl) args.push('--site-cache-control', siteCacheControl);
  if (overlay) args.push('--overlay', path.resolve(ROOT, overlay));
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
  const serverLog = [];
  child.stderr.on('data', d => serverLog.push(String(d)));
  const ready = await new Promise((ok, fail) => {
    let buf = '';
    child.stdout.on('data', d => { buf += d; const line = buf.split('\n').find(l => l.includes('"ready"')); if (line) ok(JSON.parse(line)); });
    child.on('exit', code => fail(new Error('server exited ' + code + '\n' + serverLog.join(''))));
    setTimeout(() => fail(new Error('server did not start\n' + serverLog.join(''))), 30000);
  });
  const rig = async (p, init) => { const r = await fetch(ready.api + p, init); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`${p} → ${r.status} ${t}`); return j; };
  const browser = engine === 'chromium'
    ? await pw.chromium.launch({ executablePath: CHROME, headless })
    : await pw.webkit.launch({ headless });

  let S = null;
  const sessions = async () => {
    const info = await rig('/__rig/info');
    const call = async (p, pt) => (await fetch(ready.api + p, { headers: { 'X-Device-Token': info.device.token, ...(pt ? { 'X-Profile-Token': pt } : {}) } })).json();
    const profiles = await call('/api/profiles');
    const sess = {};
    for (const [id, token] of Object.entries(info.sessions)) { const me = await call('/api/me', token); if (me.profile) sess[id] = { token, profile: me.profile }; }
    S = { info, profiles: profiles.profiles || profiles, sessions: sess };
    return S;
  };
  await sessions();

  /** Call the local API as a profile (on the rig's device unless deviceToken is given). Returns { status, body }. */
  async function apiAs(profile, p, { method = 'GET', body, deviceToken, profileToken } = {}) {
    const h = { 'Content-Type': 'application/json', Origin: ready.site };
    const dt = deviceToken === undefined ? S.info.device.token : deviceToken;
    if (dt) h['X-Device-Token'] = dt;
    const pt = profileToken !== undefined ? profileToken : (profile ? S.info.sessions[profile] : null);
    if (pt) h['X-Profile-Token'] = pt;
    const r = await fetch(ready.api + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j, headers: Object.fromEntries(r.headers) };
  }

  const devices = [];
  /** A second paired device with sessions for the given profiles: { device: {id, token, name}, sessions: {pid: token} }. */
  async function newDevice({ name = 'Rig phone', profiles = ['eli'] } = {}) { return rig('/__rig/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, profiles }) }); }

  async function device({ device = 'ipad-portrait', mode = 'light', profile = 'eli', fixedTime, installClock, sw = false, localStorage: extra = null, deviceToken, as } = {}) {
    const dev = DEVICES[device];
    const ctx = await browser.newContext({ ...contextOptions(device, mode), serviceWorkers: sw ? 'allow' : 'block', ...(engine === 'chromium' ? {} : {}) });
    const logs = [];
    await ctx.route(PROD_API + '/**', r => r.abort());
    // as: a newDevice() result — this context is that device, signed in with its session
    let devRec = deviceToken ? { ...S.info.device, token: deviceToken } : S.info.device;
    let session = profile && profile !== 'unpaired' ? S.sessions[profile] : null;
    if (as) {
      devRec = as.device;
      const pt = as.sessions[profile];
      if (profile && profile !== 'unpaired') { const me = await (await fetch(ready.api + '/api/me', { headers: { 'X-Device-Token': as.device.token, 'X-Profile-Token': pt } })).json(); session = { token: pt, profile: me.profile }; }
    }
    const cfg = {
      site: ready.site, api: ready.api, dev: { platform: dev.platform, touchPoints: dev.touchPoints, standalone: dev.standalone },
      device: profile === 'unpaired' ? null : devRec,
      session,
      profiles: profile === 'unpaired' ? null : S.profiles,
      last: profile && profile !== 'unpaired' ? profile : null, extra,
    };
    await ctx.addInitScript(c => {
      try {
        if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
          window.webkitSpeechRecognition = class extends EventTarget { constructor() { super(); this.lang = 'en-US'; } start() {} stop() { setTimeout(() => { const e = new Event('end'); if (this.onend) this.onend(e); this.dispatchEvent(e); }, 0); } abort() { this.stop(); } };
        }
        const def = (k, v) => Object.defineProperty(Navigator.prototype, k, { get: v, configurable: true });
        def('platform', () => c.dev.platform); def('maxTouchPoints', () => c.dev.touchPoints); if (c.dev.standalone) def('standalone', () => true);
        // navigator.onLine follows the harness's offline switch (sessionStorage is shared by the page and its same-origin iframes)
        def('onLine', () => { try { return sessionStorage.getItem('rig.offline') !== '1'; } catch { return true; } });
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
    if (installClock != null) await ctx.clock.install({ time: new Date(installClock) });
    else if (fixedTime !== false) await ctx.clock.setFixedTime(new Date(fixedTime != null ? fixedTime : (clock === 'demo' ? DEMO + 500 : Date.now())));
    const page = await ctx.newPage();
    page.on('console', m => { if (!/registration blocked by Playwright/.test(m.text())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 400)); });
    page.on('pageerror', e => logs.push(`pageerror: ${e.message}`.slice(0, 400)));
    let offRoute = null;
    const d = {
      ctx, page, logs, device, profile,
      async goto(hash = '') { await page.goto(ready.site + '/index.html' + hash, { waitUntil: 'load' }); },
      async openApp(id, { wait } = {}) {
        await d.goto('#' + id);
        const until = Date.now() + 10000;
        while (Date.now() < until) { const f = page.frames().find(f => f.url().includes(`/apps/${id}.html`)); if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {}); return f; } await sleep(100); }
        throw new Error('app frame did not load: ' + id);
      },
      frame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
      /** Go offline (API + every other host unreachable, navigator.onLine false, 'offline' fired) or back online. */
      async setOffline(off) {
        if (off && !offRoute) { offRoute = u => !u.href.startsWith(ready.site) && !u.href.startsWith('data:') && !u.href.startsWith('blob:'); await ctx.route(offRoute, r => r.abort('internetdisconnected')); }
        if (!off && offRoute) { await ctx.unroute(offRoute); offRoute = null; }
        for (const f of page.frames()) await f.evaluate(o => { try { sessionStorage.setItem('rig.offline', o ? '1' : '0'); } catch {} dispatchEvent(new Event(o ? 'offline' : 'online')); }, off).catch(() => {});
      },
      /** The hub.js state in the shell (or an app frame). */
      async hub(frame = page) { return frame.evaluate(() => ({ sync: window.hub && { ...hub.sync }, profile: window.hub && hub.profile && hub.profile.id, skew: window.hub && hub.skew, queue: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, JSON.parse(localStorage.getItem(k))])) })); },
      async shot(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' }); return file; },
      async close() { await ctx.close().catch(() => {}); },
    };
    devices.push(d);
    return d;
  }

  return {
    pw, browser, engine, site: ready.site, api: ready.api, child, serverLog,
    get S() { return S; },
    sessions, apiAs, device, newDevice,
    async setPairingCode(code) { return rig('/__rig/pairing-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }); },
    async reset(v = variant) { await rig('/__rig/reset?variant=' + v, { method: 'POST' }); return sessions(); },
    async clock(iso) { return rig('/__rig/clock?at=' + encodeURIComponent(iso), { method: 'POST' }); },
    async anthropic(script) { return rig('/__rig/anthropic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script }) }); },
    async anthropicLog({ clear = false } = {}) { return rig('/__rig/anthropic/log', { method: clear ? 'DELETE' : 'GET' }); },
    async overlay(dir) { return rig('/__rig/overlay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) }); },
    /** Pair another device through the real /api/pair (needs the pairing code, which the rig never knows): not offered.
     *  Use deviceToken with a row inserted by a reset instead, or call the admin/API routes directly. */
    async close() { for (const d of devices) await d.close(); await browser.close().catch(() => {}); child.kill(); },
  };
}
