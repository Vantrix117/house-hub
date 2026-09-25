// Phase 4 GLASS — what the glass costs, in Chromium (which paints backdrop-filter), glass on versus glass off.
//
// Method (relative numbers, named here so a skeptic can rerun it):
//   * The local instance (lib/local.mjs, engine 'chromium' = the installed Chrome, headless), light mode, System theme.
//   * Each scene is a Phase 1 screen definition from audits/tools/areas/*.mjs, driven by its own go() through a small
//     adapter of the rig's `t` API, on the named device (iPad portrait 820x1180 @2x unless noted).
//   * Arms, applied in the SAME page state by injecting / removing one <style> in every document (page + app iframe):
//       A  as shipped
//       B  glass off:   *,*::before,*::after { backdrop-filter:none!important; -webkit-backdrop-filter:none!important }
//       C  sheen off:   glass on, but hub.js's --sheen-x writes are dropped (CSSStyleDeclaration.setProperty patched in
//                       every document for '--sheen-x' only) — isolates the per-scroll-frame custom-property change
//       P  photo blur off (TV only): .tv-bg-img { filter:none!important }
//     Order A B [C] A B [C]: each arm is measured twice and both values are kept.
//   * Actions per window (default 5 s):
//       scroll  a requestAnimationFrame loop in the scrolling document moves the scroller 10 CSS px a frame, bouncing
//               at the ends; the same loop records frame intervals
//       idle    nobody touches the page; no rAF loop (so the probe itself adds nothing)
//       fade    TV: window.__tv.crossfade() at the start of a 12 s window (one 2.5 s opacity crossfade + 9.5 s still)
//   * Cost: CPU seconds per wall second from CDP SystemInfo.getProcessInfo (browser-level), split by process type
//     (renderer = main + raster threads of the page and its same-site iframe; GPU = the display compositor, where a
//     software backdrop-filter is drawn); plus CDP Performance.getMetrics on the page (main-thread TaskDuration,
//     RecalcStyleCount, LayoutCount, style/layout durations).
//   * Frames (scroll only): intervals between rAF callbacks: fps, p50, p95, and the share of intervals > 20 ms (a
//     missed 60 Hz frame).
//   Limits: headless Chrome on a Windows desktop (the GPU line is recorded in env.gpu); the iPad's WebKit/Core
//   Animation backdrop path is different and faster in absolute terms. Only the ratios between arms are claimed.
//
//   node audits/tools/phase4/GLASS/perf.mjs [--scene a,b] [--window 5000] [--out file.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WIN = +arg('window', 5000);
const OUTF = path.resolve(ROOT, arg('out', 'audits/evidence/p4/GLASS/perf.json'));

// scene: area module, screen, device, action(s), where the scroller is ('page' or 'app'), and an optional selector
export const SCENES = [
  { id: 'shell-home', mod: 'shell', screen: 'home', device: 'ipad-portrait', actions: ['scroll', 'idle'], doc: 'page', sel: '#views' },
  { id: 'shell-chat', mod: 'shell-me', screen: 'chat', device: 'ipad-portrait', actions: ['scroll', 'idle'], doc: 'page', sel: 'auto' },
  { id: 'shell-chat-phone', mod: 'shell-me', screen: 'chat', device: 'iphone-pwa', actions: ['scroll'], doc: 'page', sel: 'auto' },
  { id: 'shell-me', mod: 'shell-me', screen: 'me', device: 'ipad-portrait', actions: ['scroll'], doc: 'page', sel: '#views' },
  { id: 'shell-picker', mod: 'shell', screen: 'picker', device: 'ipad-portrait', actions: ['idle'], doc: 'page' },
  { id: 'tv-board', mod: 'tv', screen: 'board', device: 'tv', actions: ['still', 'fade'], doc: 'page', realClock: true },
  { id: 'tv-board-ipad', mod: 'tv', screen: 'board-ipad', device: 'ipad-landscape', actions: ['fade'], doc: 'page', realClock: true },
  { id: 'prayer-today', mod: 'prayer', screen: 'today', device: 'ipad-portrait', actions: ['scroll'], doc: 'app', sel: 'auto' },
  { id: 'prayer-detail', mod: 'prayer', screen: 'detail', device: 'ipad-portrait', actions: ['scroll', 'idle'], doc: 'app', sel: '#sheet' },
  { id: 'dlive-ride-card', mod: 'dollywood-live', screen: 'ride-card', device: 'ipad-portrait', actions: ['idle'], doc: 'app' },
  { id: 'dlive-map', mod: 'dollywood-live', screen: 'map', device: 'ipad-portrait', actions: ['idle'], doc: 'app' },
  { id: 'dguide-listing-phone', mod: 'dollywood', screen: 'listing', device: 'iphone-pwa', actions: ['scroll', 'idle'], doc: 'app', sel: 'auto' },
  { id: 'tally-kid', mod: 'tally', screen: 'kid', device: 'ipad-portrait', actions: ['idle', 'taps'], doc: 'app' },
  { id: 'timer-running', mod: 'timer', screen: 'running', device: 'ipad-portrait', actions: ['idle'], doc: 'app', realClock: true },
  { id: 'verses-trainer', mod: 'verses', screen: 'trainer', device: 'iphone-pwa', actions: ['scroll'], doc: 'app', sel: 'auto' },
  { id: 'kidverse-kid', mod: 'kidverse', screen: 'kid', device: 'ipad-portrait', actions: ['scroll'], doc: 'app', sel: 'auto' },
  { id: 'leftovers-main', mod: 'leftovers', screen: 'main', device: 'iphone-pwa', actions: ['scroll'], doc: 'app', sel: 'auto' },
  { id: 'f260-today', mod: 'f260', screen: 'today', device: 'ipad-portrait', actions: ['scroll'], doc: 'app', sel: 'auto' },
];

const GLASS_OFF = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
const PHOTO_OFF = '.tv-bg-img{filter:none!important}';

async function styleAll(page, id, css) {
  for (const f of page.frames()) await f.evaluate(([id, css]) => { let s = document.getElementById(id); if (css == null) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = id; (document.head || document.documentElement).appendChild(s); } s.textContent = css; }, [id, css]).catch(() => {});
}
async function sheen(page, on) {
  for (const f of page.frames()) await f.evaluate(on => {
    const P = CSSStyleDeclaration.prototype;
    if (!P.__m4orig) P.__m4orig = P.setProperty;
    P.setProperty = on ? P.__m4orig : function (k, v, p) { if (k === '--sheen-x') { window.__m4sheenDropped = (window.__m4sheenDropped || 0) + 1; return; } return P.__m4orig.call(this, k, v, p); };
  }, on).catch(() => {});
}
async function sheenWrites(page) { let n = 0; for (const f of page.frames()) n += await f.evaluate(() => window.__m4sheenDropped || 0).catch(() => 0); return n; }

function mkT(L, d, s, dev) {
  const page = d.page, ctx = d.ctx;
  const t = {
    page, ctx, state: 'typical', device: d.device, mode: 'light', variant: s.variant || 'typical', profile: d.profile, site: L.site, api: L.api, dev,
    loading: false, offline: false, error: false, reopened: false, touch: dev.hasTouch, sleep,
    async settle() { await sleep(1200); },
    frame: () => page.frameLocator('#frame'),
    async goto(hash = '') { await page.goto(L.site + '/index.html' + hash, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      const until = Date.now() + 10000; let f;
      while (Date.now() < until && !(f = page.frames().find(f => f.url().includes(`/apps/${id}.html`)))) await sleep(100);
      if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {}); }
      return f;
    },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async tapIn(frameOrLoc, selector, opts = {}) { const loc = selector ? frameOrLoc.locator(selector).first() : frameOrLoc; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async hold() {}, async answer() {}, async failApi() {},
    async clockTo(when) { if (!s.realClock) await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };
  return t;
}

// in the scrolling document: find the scroller, run a bouncing rAF scroll for ms, return frame stats
async function scrollRun(frame, sel, ms) {
  return frame.evaluate(([sel, ms]) => new Promise(res => {
    const cands = [];
    if (sel && sel !== 'auto') { const e = document.querySelector(sel); if (e) cands.push(e); }
    if (!cands.length) {
      for (const e of [document.scrollingElement, ...document.querySelectorAll('*')]) {
        if (!e) continue; const s = getComputedStyle(e); const can = e === document.scrollingElement || /auto|scroll/.test(s.overflowY);
        if (can && e.scrollHeight - e.clientHeight > 40 && e.getBoundingClientRect().height > 100) cands.push(e);
      }
      cands.sort((a, b) => (b.scrollHeight - b.clientHeight) * Math.min(1, b.clientHeight / 300) - (a.scrollHeight - a.clientHeight) * Math.min(1, a.clientHeight / 300));
    }
    const el = cands[0]; if (!el) return res({ scroller: null });
    const range = el.scrollHeight - el.clientHeight; let dir = 1; const ts = []; const t0 = performance.now(); el.scrollTop = 0;
    const step = now => { ts.push(now); let y = el.scrollTop + dir * 10; if (y >= range) { y = range; dir = -1; } if (y <= 0) { y = 0; dir = 1; } el.scrollTop = y; if (now - t0 < ms) requestAnimationFrame(step); else fin(); };
    const fin = () => { const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]); iv.sort((a, b) => a - b); const q = p => iv.length ? +iv[Math.min(iv.length - 1, Math.floor(p * (iv.length - 1)))].toFixed(1) : null;
      res({ scroller: (el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''), range, frames: ts.length, fps: +((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000)).toFixed(1), p50: q(.5), p95: q(.95), over20: +(iv.filter(x => x > 20).length / Math.max(1, iv.length)).toFixed(3) }); };
    requestAnimationFrame(step);
  }), [sel, ms]);
}

async function main() {
  const want = (arg('scene', '') || '').split(',').filter(Boolean);
  const scenes = SCENES.filter(s => !want.length || want.includes(s.id));
  const prev = fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : { scenes: {} };
  const out = { note: 'See the header of audits/tools/phase4/GLASS/perf.mjs for the method. cpu = CPU seconds per wall second (1.0 = one core busy) by process type, from CDP SystemInfo.getProcessInfo deltas; main = page main-thread TaskDuration per second (CDP Performance); frames = rAF intervals during the scroll loop. Arms: A shipped, B glass off (backdrop-filter:none on every element), C sheen off (--sheen-x writes dropped), P TV photo blur off, PB both. Each arm is run twice (runs[]).', env: prev.env || null, scenes: prev.scenes || {} };
  const L = await local({ variant: 'typical', engine: 'chromium' });
  let bcdp;
  try {
    bcdp = await L.browser.newBrowserCDPSession();
    const info = await bcdp.send('SystemInfo.getInfo').catch(e => ({ error: String(e) }));
    const ver = await bcdp.send('Browser.getVersion').catch(() => ({}));
    out.env = { product: ver.product, headless: true, gpu: info.gpu ? { featureStatus: info.gpu.featureStatus, devices: (info.gpu.devices || []).map(g => g.deviceString || g.vendorString), driverBugWorkarounds: undefined } : info, machine: process.env.PROCESSOR_IDENTIFIER || null, cores: (await import('node:os')).cpus().length };
    const cpu = async () => { const r = await bcdp.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
    let curVariant = 'typical';
    for (const s of scenes) {
      const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', s.mod + '.mjs')));
      const scr = mod.screens.find(x => x.screen === s.screen && (!x.devices || x.devices.includes(s.device)) && (!x.states || x.states.includes('typical')));
      if (!scr) { out.scenes[s.id] = { error: 'screen not found' }; continue; }
      const variant = typeof scr.variant === 'object' ? (scr.variant.typical || 'typical') : (scr.variant || 'typical');
      if (variant !== curVariant) { await L.reset(variant); curVariant = variant; }
      else await L.reset(variant);
      const profile = scr.profile === undefined ? 'eli' : scr.profile;
      const d = await L.device({ device: s.device, mode: 'light', profile, fixedTime: s.realClock ? false : undefined, localStorage: scr.localStorage || null });
      const dev = DEVICES[s.device];
      const t = mkT(L, d, { ...s, variant }, dev);
      const rec = { area: mod.area, screen: s.screen, device: s.device, profile, variant, window: WIN, goError: null, arms: {} };
      try { await scr.go(t); if (scr.after) await scr.after(t); } catch (e) { rec.goError = String(e && e.message || e).split('\n')[0]; }
      await sleep(2500);
      const pcdp = await d.ctx.newCDPSession(d.page); await pcdp.send('Performance.enable');
      const pm = async () => Object.fromEntries((await pcdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
      const app = d.page.frames().find(f => /\/apps\/[^/]+\.html/.test(f.url()));
      const target = s.doc === 'app' ? (app || d.page.mainFrame()) : d.page.mainFrame();
      rec.layers = [];
      for (const f of d.page.frames()) rec.layers.push(...await f.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const bf = s.backdropFilter && s.backdropFilter !== 'none' ? s.backdropFilter : (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' ? s.webkitBackdropFilter : null); if (!bf) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none'; }).map(e => { const r = e.getBoundingClientRect(); return (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); })).catch(() => []));
      const arms = s.id.startsWith('tv') ? ['A', 'B', 'P', 'PB', 'A', 'B', 'P', 'PB'] : (s.actions.includes('scroll') ? ['A', 'B', 'C', 'A', 'B', 'C'] : ['A', 'B', 'A', 'B']);
      const set = async arm => {
        await styleAll(d.page, 'm4-glass-off', arm === 'B' || arm === 'PB' ? GLASS_OFF : null);
        await styleAll(d.page, 'm4-photo-off', arm === 'P' || arm === 'PB' ? PHOTO_OFF : null);
        await sheen(d.page, arm !== 'C');
      };
      for (const action of s.actions) {
        const res = rec.arms[action] = {};
        for (const arm of arms) {
          if (action === 'scroll' && (arm === 'P' || arm === 'PB')) continue;
          if (action !== 'scroll' && arm === 'C') continue;
          await set(arm); await sleep(1200);
          if (action === 'scroll') await target.evaluate(sel => { const e = sel && sel !== 'auto' ? document.querySelector(sel) : null; (e || document.scrollingElement).scrollTop = 0; }, s.sel).catch(() => {});
          await sleep(300);
          // TV still: start the window right after a crossfade has finished, so the board's own 45 s crossfade cannot land in it
          if (action === 'still') { await d.page.evaluate(() => window.__tv && window.__tv.crossfade()); await sleep(3200); }
          const dropped0 = await sheenWrites(d.page);
          const c0 = await cpu(), m0 = await pm(), w0 = Date.now();
          let frames = null;
          if (action === 'scroll') { frames = await scrollRun(target, s.sel, WIN); if (!frames.scroller) { res.invalid = 'nothing to scroll in this document'; console.log(s.id, action, 'no scroller'); break; } }
          else if (action === 'fade') { await d.page.evaluate(() => window.__tv && window.__tv.crossfade()); await sleep(12000); }
          else if (action === 'taps') { const plus = target.locator('#plus'); const until = Date.now() + WIN; while (Date.now() < until) { await plus.tap().catch(() => {}); await sleep(450); } }
          else await sleep(action === 'still' ? 8000 : WIN);
          const secs = (Date.now() - w0) / 1000;
          const c1 = await cpu(), m1 = await pm();
          const cpuD = {}; for (const k of Object.keys(c1)) cpuD[k] = +(((c1[k] || 0) - (c0[k] || 0)) / secs).toFixed(3);
          const r = { secs: +secs.toFixed(2), cpu: cpuD, cpuTotal: +Object.values(cpuD).reduce((a, b) => a + b, 0).toFixed(3),
            main: +((m1.TaskDuration - m0.TaskDuration) / secs).toFixed(3), stylePerSec: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / secs).toFixed(1), styleMsPerSec: +(1000 * (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / secs).toFixed(1), layoutPerSec: +((m1.LayoutCount - m0.LayoutCount) / secs).toFixed(1),
            sheenDropped: (await sheenWrites(d.page)) - dropped0, frames };
          (res[arm] ||= { runs: [] }).runs.push(r);
          console.log(s.id, action, arm, JSON.stringify({ cpu: r.cpuTotal, rend: r.cpu.renderer, gpu: r.cpu.GPU, main: r.main, style: r.stylePerSec, fps: frames && frames.fps, p95: frames && frames.p95, over20: frames && frames.over20, scroller: frames && frames.scroller }));
        }
        for (const v of Object.values(res)) { if (!v || !v.runs) continue; const avg = k => +(v.runs.reduce((a, r) => a + (typeof k === 'function' ? k(r) : r[k]), 0) / v.runs.length).toFixed(3); v.mean = { cpuTotal: avg('cpuTotal'), renderer: avg(r => r.cpu.renderer || 0), gpu: avg(r => r.cpu.GPU || 0), main: avg('main'), fps: v.runs[0].frames ? avg(r => r.frames.fps || 0) : null, p95: v.runs[0].frames ? avg(r => r.frames.p95 || 0) : null, over20: v.runs[0].frames ? avg(r => r.frames.over20 || 0) : null }; }
        if (res.A && res.B) res.ratioAB = +(res.A.mean.cpuTotal / Math.max(0.001, res.B.mean.cpuTotal)).toFixed(2);
      }
      await set('A');
      rec.consoleErrors = d.logs.filter(l => /error/.test(l)).slice(0, 5);
      out.scenes[s.id] = rec;
      await d.close();
      fs.mkdirSync(path.dirname(OUTF), { recursive: true }); fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
    }
  } finally {
    fs.mkdirSync(path.dirname(OUTF), { recursive: true }); fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
    await L.close();
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
