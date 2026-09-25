// Phase 4 MOTION — independent RE-MEASUREMENT of the investigator's key numbers (MOTION.md draft).
// Written from scratch; it does not import or copy the investigator's MOTION/*.mjs scripts. Local rig only.
//   node "audits/tools/phase4/MOTION/remeasure.mjs" <part> [<part> …]
//   parts: curves static replay tiles viewer interrupt idle park press cls smooth rm
// Each part writes audits/evidence/p4/MOTION/remeasure-<part>.json and prints a one-line summary.
// Methods deliberately differ from the investigator's where possible:
//   press   — a real pointer press (mouse down held 450 ms) instead of CDP CSS.forcePseudoState
//   interrupt — the close is fired in-page by setTimeout at 120 ms and the viewer read synchronously before/after it
//   smooth  — F260's year-grid jump (apps/f260.html:1700) instead of the Reflect button
//   static  — own tokenizer over <style> blocks, counted per duration item and per declaration
//   tiles   — every animation frame after hub.pull(), counting tiles whose computed opacity < 0.05
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits', 'evidence', 'p4', 'MOTION'); fs.mkdirSync(EV, { recursive: true });
const save = (part, obj) => { fs.writeFileSync(path.join(EV, `remeasure-${part}.json`), JSON.stringify(obj, null, 1)); console.log(part, JSON.stringify(obj).slice(0, 1500)); };

// ── cubic-bezier maths ──────────────────────────────────────────────
function bez(x1, y1, x2, y2) {
  const B = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  const yAtX = x => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (B(m, x1, x2) < x) lo = m; else hi = m; } return B((lo + hi) / 2, y1, y2); };
  return yAtX;
}
function curveStats(c) {
  const f = bez(...c); let max = 0, t90 = null;
  for (let i = 0; i <= 10000; i++) { const x = i / 10000, y = f(x); if (y > max) max = y; if (t90 === null && y >= 0.9) t90 = x; }
  return { overshootPct: +((max - 1) * 100).toFixed(2), reach90AtFraction: +t90.toFixed(4) };
}

const PARTS = {
  async curves() {
    const out = {
      spring_design_css_108: curveStats([.34, 1.4, .64, 1]),
      f260_prayer_pop_3_1_6_5_1: curveStats([.3, 1.6, .5, 1]),
      ease_2_7_2_1: curveStats([.2, .7, .2, 1]),
      easeInOut_65_0_35_1: curveStats([.65, 0, .35, 1]),
      f260_3_9_3_1: curveStats([.3, .9, .3, 1]),
      prayer_22_9_3_1: curveStats([.22, .9, .3, 1]),
      dolly_2_8_2_1: curveStats([.2, .8, .2, 1]),
      css_ease: curveStats([.25, .1, .25, 1]),
    };
    const sp = bez(.34, 1.4, .64, 1);
    const y60 = sp(60 / 220);
    out.btnPressAfter60ms = { progress: +y60.toFixed(4), scale: +(1 - 0.04 * y60).toFixed(4), pctOfPress: +(y60 * 100).toFixed(1) };
    save('curves', out);
  },

  async static() {
    const files = {
      'design.css': 'apps/design.css', shell: 'index.html', f260: 'apps/f260.html', prayer: 'apps/prayer.html', tally: 'apps/tally.html',
      timer: 'apps/timer.html', verses: 'apps/verses.html', kidverse: 'apps/kidverse.html', leftovers: 'apps/leftovers.html',
      dollywood: 'apps/dollywood.html', 'dollywood-live': 'apps/dollywood-live.html',
    };
    const splitTop = s => { const r = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; };
    const out = {};
    for (const [k, rel] of Object.entries(files)) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const css = rel.endsWith('.css') ? src : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
      const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
      let decls = 0, declsAllToken = 0, items = 0, itemsToken = 0; const literals = new Set(); const easings = {};
      for (const m of noComments.matchAll(/(?:^|[;{\s])(transition|transition-duration|animation|animation-duration)\s*:\s*([^;{}]+)/g)) {
        const val = m[2].trim(); if (/^(none|initial|inherit|unset)\b/.test(val)) continue;
        let di = 0, dt = 0;
        for (const it of splitTop(val)) {
          const tok = it.match(/var\(--dur[\w-]*\)/); const lit = it.match(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/);
          if (!tok && !lit) continue;
          di++; items++;
          const tokFirst = tok && (!lit || it.indexOf(tok[0]) < it.indexOf(lit[0]));
          if (tokFirst) { dt++; itemsToken++; } else literals.add(lit[2] === 's' ? +lit[1] * 1000 : +lit[1]);
          const e = it.match(/cubic-bezier\([^)]*\)|var\(--(?:ease[\w-]*|spring)\)|\b(?:ease-in-out|ease-out|ease-in|ease|linear|steps\([^)]*\))\b/);
          const ek = e ? e[0].replace(/\s+/g, '') : 'default'; easings[ek] = (easings[ek] || 0) + 1;
        }
        if (di) { decls++; if (dt === di) declsAllToken++; }
      }
      out[k] = { decls, declsAllToken, items, itemsToken, distinctLiteralMs: [...literals].sort((a, b) => a - b), easings };
    }
    save('static', out);
  },

  // 65 s idle on Apps / Home (iPad, Eli) and the TV board, counting animationstart events (WebKit)
  async replay() {
    const L = await local({ engine: 'webkit', clock: 'real' });
    try {
      const arms = [['apps', 'ipad-portrait', 'eli', '#apps'], ['home', 'ipad-portrait', 'eli', '#home'], ['tv', 'tv', 'tv', '#home']];
      const devs = [];
      for (const [name, device, profile, hash] of arms) {
        const d = await L.device({ device, profile, fixedTime: false });
        await d.goto(hash);
        await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 20000 }).catch(() => {});
        await sleep(2500);
        await d.page.evaluate(() => { window.__ev = []; window.__t0 = performance.now(); document.addEventListener('animationstart', e => window.__ev.push({ n: e.animationName, c: String(e.target.className && e.target.className.baseVal !== undefined ? e.target.className.baseVal : e.target.className).split(' ')[0], t: Math.round((performance.now() - window.__t0) / 1000) }), true); });
        devs.push([name, d]);
      }
      await sleep(65000);
      const out = {};
      for (const [name, d] of devs) {
        const ev = await d.page.evaluate(() => window.__ev);
        const by = {}; for (const e of ev) { const k = e.n + ' on .' + e.c; (by[k] ||= new Set()).add(e.t); }
        const counts = {}; for (const e of ev) counts[e.n + ' on .' + e.c] = (counts[e.n + ' on .' + e.c] || 0) + 1;
        out[name] = { starts: ev.length, counts, secondsAfterListen: Object.fromEntries(Object.entries(by).map(([k, s]) => [k, [...s]])) , tiles: name === 'apps' ? await d.page.evaluate(() => document.querySelectorAll('#grid .tile').length) : undefined };
      }
      save('replay', out);
    } finally { await L.close(); }
  },

  // tile opacity every frame after a pull (Chromium)
  async tiles() {
    const L = await local({ engine: 'chromium', clock: 'real' });
    try {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      await d.goto('#apps');
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull, null, { timeout: 20000 });
      await sleep(2000);
      const r = await d.page.evaluate(() => new Promise(res => {
        const tiles = () => [...document.querySelectorAll('#grid .tile')];
        const before = tiles().map(t => +getComputedStyle(t).opacity);
        const frames = []; const t0 = performance.now();
        hub.pull();
        (function loop() {
          const o = tiles().map(t => +(+getComputedStyle(t).opacity).toFixed(3));
          frames.push({ t: Math.round(performance.now() - t0), n: o.length, below005: o.filter(x => x < 0.05).length, below09: o.filter(x => x < 0.9).length });
          if (performance.now() - t0 < 2500) requestAnimationFrame(loop);
          else res({ before, frames, after: tiles().map(t => +getComputedStyle(t).opacity) });
        })();
      }));
      const firstDip = r.frames.find(f => f.below09 > 0);
      const maxZero = Math.max(...r.frames.map(f => f.below005));
      save('tiles', { tileCount: r.before.length, before: r.before, after: r.after, firstFrameWithTileBelow09: firstDip, maxTilesBelow005InOneFrame: maxZero, framesWithDip: r.frames.filter(f => f.below09 > 0).length });
    } finally { await L.close(); }
  },

  // viewer exit dead zone: hash open 80 ms after close vs 400 ms after; tap hit-test; sheet exit (WebKit)
  async viewer() {
    const L = await local({ engine: 'webkit' });
    try {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
      const state = () => d.page.evaluate(() => { const v = document.getElementById('viewer'), f = document.getElementById('frame'); return { cls: v.className, display: getComputedStyle(v).display, frameSrc: f.getAttribute('src'), frameId: f.dataset.id || null, hash: location.hash }; });
      const openTally = async () => { await d.page.evaluate(() => document.querySelector('#grid .tile[data-id="tally"]').click()); await sleep(1500); };
      const out = {};
      await d.goto('#apps'); await d.page.waitForSelector('#grid .tile[data-id="tally"]'); await sleep(1500);
      for (const [arm, delay] of [['hashAt80ms', 80], ['hashAt400ms', 400]]) {
        await openTally();
        out[arm + '_openedBefore'] = await state();
        out[arm + '_hit'] = await d.page.evaluate(ms => new Promise(res => {
          document.getElementById('pill-home').click();
          setTimeout(() => {
            const t = document.querySelector('#grid .tile[data-id="leftovers"]'); const r = t.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            const hit = el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') : null;
            location.hash = '#timer';
            res(hit);
          }, ms);
        }), delay);
        await sleep(900);
        out[arm] = await state();
        await d.page.evaluate(() => document.getElementById('pill-home').click()); await sleep(700);
      }
      // sheet: Switch app sheet from the viewer pill, then a backdrop tap
      await openTally();
      await d.page.evaluate(() => document.getElementById('pill-name').click()); await sleep(80);
      out.sheetEntry = await d.page.evaluate(() => { const bd = document.querySelector('.sheet-backdrop'); const s = bd && bd.querySelector('.sheet'); const an = el => el ? el.getAnimations().map(a => ({ name: a.animationName, dur: a.effect.getComputedTiming().duration })) : null; return { backdrops: document.querySelectorAll('.sheet-backdrop').length, bd: an(bd), sheet: an(s) }; });
      await sleep(600);
      out.sheetExit = await d.page.evaluate(() => new Promise(res => {
        const bd = document.querySelector('.sheet-backdrop');
        bd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const sync = document.querySelectorAll('.sheet-backdrop').length;
        requestAnimationFrame(() => res({ syncAfterClick: sync, nextFrame: document.querySelectorAll('.sheet-backdrop').length, bdConnected: bd.isConnected }));
      }));
      save('viewer', out);
    } finally { await L.close(); }
  },

  // close 120 ms into the opening (Chromium): viewer opacity/scale just before and just after the close
  async interrupt() {
    const L = await local({ engine: 'chromium' });
    try {
      const out = {};
      for (const dev of ['ipad-portrait', 'desktop']) {
        const d = await L.device({ device: dev, profile: 'eli' });
        await d.goto('#apps'); await d.page.waitForSelector('#grid .tile[data-id="tally"]'); await sleep(1500);
        out[dev] = await d.page.evaluate(() => new Promise(res => {
          const v = document.getElementById('viewer'); let t0;
          const rd = () => { const cs = getComputedStyle(v); const m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : { a: 1 }; const a = v.getAnimations()[0]; return { t: Math.round(performance.now() - t0), o: +(+cs.opacity).toFixed(3), s: +m.a.toFixed(3), cls: v.className, anim: a ? a.animationName + '@' + Math.round(a.currentTime) : null }; };
          const samples = [];
          t0 = performance.now();
          document.querySelector('#grid .tile[data-id="tally"]').click();
          (function loop() { samples.push(rd()); if (performance.now() - t0 < 700) requestAnimationFrame(loop); })();
          setTimeout(() => {
            const before = rd();
            document.getElementById('pill-home').click();
            const after = rd();
            setTimeout(() => res({ before, after, jump: +(after.o - before.o).toFixed(3), samples: samples.slice(0, 40) }), 650);
          }, 120);
        }));
        await d.close();
      }
      save('interrupt', out);
    } finally { await L.close(); }
  },

  // main-thread cost over 10 s idle via CDP Performance metrics (Chromium)
  async idle() {
    const L = await local({ engine: 'chromium', clock: 'real' });
    const MS = +(process.env.IDLE_MS || 10000);
    try {
      const surf = [['shell-home', 'ipad-portrait', 'eli', '/index.html#home'], ['shell-apps', 'ipad-portrait', 'eli', '/index.html#apps'], ['tv', 'tv', 'tv', '/index.html#home'],
        ['dollywood', 'ipad-portrait', 'eli', '/apps/dollywood.html'], ['dollywood-live', 'ipad-portrait', 'eli', '/apps/dollywood-live.html'], ['f260', 'ipad-portrait', 'eli', '/apps/f260.html'],
        ['prayer', 'ipad-portrait', 'eli', '/apps/prayer.html'], ['kidverse', 'ipad-portrait', 'ezra', '/apps/kidverse.html']];
      const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
      const out = { idleMs: MS };
      for (const [name, device, profile, url] of surf) {
        if (only && !only.includes(name)) continue;
        const d = await L.device({ device, profile, fixedTime: false });
        await d.page.goto(L.site + url, { waitUntil: 'load' });
        await sleep(5000);
        const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
        const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
        const a = await m(); const w0 = Date.now(); await sleep(MS); const b = await m(); const sec = (Date.now() - w0) / 1000;
        const inf = await d.page.evaluate(() => document.getAnimations().filter(x => x.playState === 'running' && x.effect.getComputedTiming().iterations === Infinity).map(x => x.animationName || 'anon'));
        out[name] = { busyPct: +(((b.TaskDuration - a.TaskDuration) / sec) * 100).toFixed(2), recalcStylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / sec).toFixed(1), layoutPerSec: +((b.LayoutCount - a.LayoutCount) / sec).toFixed(1), infinite: inf };
        console.log(name, JSON.stringify(out[name]));
        await d.close();
      }
      save(only ? 'idle-' + only.join('-') + '-' + MS : 'idle', out);
    } finally { await L.close(); }
  },

  // park map located on a park day (Chromium, iPhone), no-preference vs reduce
  async park() {
    const L = await local({ variant: 'park', clock: 'real', engine: 'chromium' });
    try {
      const out = {};
      for (const rm of ['no-preference', 'reduce']) {
        const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
        await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
        await d.page.emulateMedia({ reducedMotion: rm });
        await d.page.goto(L.site + '/apps/dollywood-live.html', { waitUntil: 'load' });
        await d.page.waitForFunction(() => window.D && D.geo && window.hub && hub.sync.lastPull, null, { timeout: 25000 }).catch(() => {});
        // map metres (x east, y north) → lat/lon through the page's own frame
        const ll = await d.page.evaluate(() => ({ latitude: 842 / D.geo.my + D.geo.lat0, longitude: 762 / D.geo.mx + D.geo.lon0 }));
        await d.ctx.setGeolocation({ ...ll, accuracy: 5 });
        await sleep(1000);
        if (await d.page.evaluate(() => document.getElementById('loc-btn').dataset.gps) !== 'on') await d.page.tap('#loc-btn').catch(() => d.page.click('#loc-btn'));
        await sleep(5000);
        const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
        const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
        const a = await m(); const w0 = Date.now(); await sleep(10000); const b = await m(); const sec = (Date.now() - w0) / 1000;
        const st = await d.page.evaluate(() => { const run = document.getAnimations().filter(x => x.playState === 'running'); return { gps: document.getElementById('loc-btn').dataset.gps, running: run.length, infinite: run.filter(x => x.effect.getComputedTiming().iterations === Infinity).map(x => x.animationName) }; });
        out[rm] = { ...st, busyPct: +(((b.TaskDuration - a.TaskDuration) / sec) * 100).toFixed(2), recalcStylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / sec).toFixed(1) };
        console.log(rm, JSON.stringify(out[rm]));
        await d.close();
      }
      save('park', out);
    } finally { await L.close(); }
  },

  // real pointer press held 450 ms on every visible, hit-testable control (Chromium, iPad portrait)
  async press() {
    const L = await local({ engine: 'chromium' });
    try {
      const surf = [['shell-apps', 'eli', '/index.html#apps'], ['prayer', 'eli', '/apps/prayer.html'], ['dollywood', 'eli', '/apps/dollywood.html'],
        ['dollywood-live', 'eli', '/apps/dollywood-live.html'], ['tally', 'eli', '/apps/tally.html'], ['f260', 'eli', '/apps/f260.html'], ['leftovers', 'eli', '/apps/leftovers.html'], ['timer', 'eli', '/apps/timer.html']];
      const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
      const out = {};
      for (const [name, profile, url] of surf) {
        if (only && !only.includes(name)) continue;
        const d = await L.device({ device: 'ipad-portrait', profile });
        await d.page.goto(L.site + url, { waitUntil: 'load' }); await sleep(3500);
        const list = await d.page.evaluate(() => {
          const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button], [role=tab]')];
          const vis = [];
          els.forEach((el, i) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return; const h = document.elementFromPoint(cx, cy); if (!h || !(h === el || el.contains(h))) return; el.dataset.rmIdx = i; vis.push({ i, sig: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' in ' + (el.parentElement.id ? '#' + el.parentElement.id : el.parentElement.className && typeof el.parentElement.className === 'string' ? '.' + el.parentElement.className.split(' ')[0] : el.parentElement.tagName.toLowerCase()), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 30) }); });
          return vis;
        });
        const bySig = {}; for (const c of list) (bySig[c.sig] ||= []).push(c);
        const rows = [];
        for (const [sig, cs] of Object.entries(bySig)) {
          const c = cs[0];
          const read = () => d.page.evaluate(i => { const el = document.querySelector(`[data-rm-idx="${i}"]`); if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { transform: s.transform, filter: s.filter, bg: s.backgroundColor, bgi: s.backgroundImage.slice(0, 80), shadow: s.boxShadow, opacity: s.opacity, color: s.color, border: s.borderColor, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, c.i);
          const b = await read(); if (!b) continue;
          await d.page.mouse.move(b.x, b.y); await d.page.mouse.down(); await sleep(450);
          const p = await read();
          await d.page.mouse.move(2, innerHeightGuess(d)); await d.page.mouse.up(); await sleep(250);
          if (!p) continue;
          const change = [];
          if (p.transform !== b.transform) { const m = p.transform.match(/matrix\(([^)]+)\)/); change.push(m ? 'transform ' + m[1].split(',').map(v => +(+v).toFixed(3)).join(',') : p.transform); }
          for (const k of ['filter', 'bg', 'bgi', 'shadow', 'opacity', 'color', 'border']) if (p[k] !== b[k]) change.push(k + (k === 'filter' ? ' ' + p.filter : ''));
          rows.push({ sig, n: cs.length, label: c.label, change: change.length ? change : ['NONE'] });
        }
        const withFb = rows.filter(r => r.change[0] !== 'NONE').reduce((s, r) => s + r.n, 0);
        const scales = [...new Set(rows.flatMap(r => r.change.filter(x => x.startsWith('transform')).map(x => { const v = x.slice(10).split(','); return v.length === 6 ? +v[0] : x; })))];
        out[name] = { controls: list.length, withFeedback: withFb, scales, brightness: rows.filter(r => r.change.some(x => x.startsWith('filter'))).length, rows };
        console.log(name, list.length, withFb, JSON.stringify(scales));
        await d.close();
      }
      save(only ? 'press-' + only.join('-') : 'press', out);
    } finally { await L.close(); }
  },

  // cold-load CLS with the first data pull held 2.5 s or every API call delayed 150 ms (Chromium)
  async cls() {
    const L = await local({ engine: 'chromium' });
    try {
      const surf = [
        ['f260', 'eli', '/apps/f260.html', 'held', ['ipad-portrait', 'iphone-pwa'], 'Jump to current week'],
        ['f260', 'eli', '/apps/f260.html', 'lat150', ['ipad-portrait', 'iphone-pwa'], 'Jump to current week'],
        ['kidverse', 'ezra', '/apps/kidverse.html', 'lat150', ['ipad-portrait', 'iphone-pwa'], null],
        ['kidverse', 'ezra', '/apps/kidverse.html', 'held', ['ipad-portrait', 'iphone-pwa'], null],
        ['tv', 'tv', '/index.html#home', 'lat150', ['tv'], null],
        ['tv', 'tv', '/index.html#home', 'held', ['tv'], null],
        ['shell-home', 'eli', '/index.html#home', 'held', ['ipad-portrait', 'iphone-pwa'], 'Around the house'],
        ['shell-home', 'eli', '/index.html#home', 'lat150', ['ipad-portrait', 'iphone-pwa'], 'Around the house'],
        ['verses', 'eli', '/apps/verses.html', 'held', ['ipad-portrait'], null],
        ['prayer-kid', 'kiara', '/apps/prayer.html', 'held', ['ipad-portrait'], null],
        ['prayer', 'eli', '/apps/prayer.html', 'held', ['ipad-portrait'], null],
      ];
      const out = {};
      const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
      for (const [name, profile, url, arm, devs, key] of surf) {
        if (only && !only.includes(name)) continue;
        for (const dev of devs) {
          // REALCLOCK=1: the browser runs on the real clock (the investigator's setting); default: the rig's frozen demo instant
          const d = await L.device({ device: dev, profile, fixedTime: process.env.REALCLOCK ? false : undefined });
          await d.ctx.addInitScript(key => {
            window.__cls = 0; window.__track = [];
            try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; (window.__ent ||= []).push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources || []).map(x => (x.node && x.node.nodeType === 1 ? x.node.tagName.toLowerCase() + (x.node.id ? '#' + x.node.id : '') + (x.node.className && typeof x.node.className === 'string' ? '.' + x.node.className.split(' ')[0] : '') : '?') + ' ' + Math.round(x.previousRect.y) + '>' + Math.round(x.currentRect.y) + '/h' + Math.round(x.currentRect.height)) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch {}
            const t0 = performance.now();
            if (key) { const iv = setInterval(() => { const el = [...document.querySelectorAll('button, h2, label, [aria-label]')].find(e => (e.getAttribute('aria-label') || e.textContent || '').trim().startsWith(key)); if (el) { const r = el.getBoundingClientRect(); if (r.height) window.__track.push([Math.round(performance.now() - t0), Math.round(r.top + scrollY + (document.getElementById('views') ? document.getElementById('views').scrollTop : 0))]); } if (performance.now() - t0 > 9000) clearInterval(iv); }, 50); }
          }, key);
          await d.ctx.route(L.api + '/api/**', async r => {
            const u = r.request().url();
            if (arm === 'held') { if (r.request().method() === 'GET' && /\/api\/data\//.test(u)) await sleep(2500); }
            else await sleep(150);
            r.continue().catch(() => {});
          });
          await d.page.goto(L.site + url, { waitUntil: 'load' });
          await sleep(1200);
          const at1200 = await d.page.evaluate(() => ({ skeletons: document.querySelectorAll('.skeleton').length, textLen: (document.body.innerText || '').trim().length }));
          await sleep(7000);
          const r = await d.page.evaluate(() => ({ cls: +window.__cls.toFixed(4), track: window.__track, entries: window.__ent || [] }));
          const ys = r.track.map(x => x[1]);
          out[`${name}@${dev}@${arm}`] = { cls: r.cls, entries: r.entries, at1200, landmark: ys.length ? { first: ys[0], last: ys[ys.length - 1], move: ys[ys.length - 1] - ys[0] } : null };
          console.log(name, dev, arm, JSON.stringify(out[`${name}@${dev}@${arm}`]));
          await d.close();
        }
      }
      save('cls' + (only ? '-' + only.join('-') : '') + (process.env.REALCLOCK ? '-realclock' : ''), out);
    } finally { await L.close(); }
  },

  // F260 year-grid jump (scrollIntoView smooth) under reduce vs no-preference, both engines
  async smooth() {
    const out = {};
    for (const engine of ['chromium', 'webkit']) {
      const L = await local({ engine });
      try {
        for (const rm of ['no-preference', 'reduce']) {
          const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
          await d.page.emulateMedia({ reducedMotion: rm });
          await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' }); await sleep(3500);
          out[engine + '-' + rm] = await d.page.evaluate(() => new Promise(res => {
            scrollTo(0, 0);
            const b = document.querySelector('[data-ygo="20"]'); if (!b) return res({ err: 'no [data-ygo]' });
            const pos = []; const t0 = performance.now();
            const iv = setInterval(() => pos.push([Math.round(performance.now() - t0), Math.round(scrollY)]), 8);
            b.click();
            setTimeout(() => { clearInterval(iv); const fin = Math.round(scrollY); const mid = [...new Set(pos.map(p => p[1]).filter(y => y !== 0 && y !== fin))]; res({ final: fin, distinctIntermediatePositions: mid.length, firstSamples: pos.filter((p, i) => i % 6 === 0).slice(0, 8) }); }, 900);
          }));
          console.log(engine, rm, JSON.stringify(out[engine + '-' + rm]));
          await d.close();
        }
      } finally { await L.close(); }
    }
    save('smooth', out);
  },

  // Reduce Motion: shell/TV boot, and standalone apps' running animations and button transitions (WebKit)
  async rm() {
    const L = await local({ engine: 'webkit' });
    try {
      const out = {};
      const surf = [['shell-home', 'ipad-portrait', 'eli', '/index.html#home'], ['tv', 'tv', 'tv', '/index.html#home'], ['tally', 'ipad-portrait', 'eli', '/apps/tally.html'], ['prayer', 'ipad-portrait', 'eli', '/apps/prayer.html'],
        ['f260', 'ipad-portrait', 'eli', '/apps/f260.html'], ['dollywood', 'ipad-portrait', 'eli', '/apps/dollywood.html'], ['kidverse', 'ipad-portrait', 'ezra', '/apps/kidverse.html'], ['verses', 'ipad-portrait', 'eli', '/apps/verses.html'], ['timer', 'ipad-portrait', 'eli', '/apps/timer.html'], ['leftovers', 'ipad-portrait', 'eli', '/apps/leftovers.html'], ['dollywood-live', 'ipad-portrait', 'eli', '/apps/dollywood-live.html']];
      for (const [name, device, profile, url] of surf) {
        const d = await L.device({ device, profile });
        await d.page.emulateMedia({ reducedMotion: 'reduce' });
        await d.page.goto(L.site + url, { waitUntil: 'load' }); await sleep(3500);
        out[name] = await d.page.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const moving = btns.filter(b => { const s = getComputedStyle(b); return s.transitionDuration.split(',').some(v => parseFloat(v) > 0.001) && s.transitionProperty !== 'none'; }).length;
          const run = document.getAnimations().filter(a => a.playState === 'running');
          const views = document.getElementById('views');
          return { visibleTextLen: (document.body.innerText || '').trim().length, viewsTextLen: views ? views.innerText.trim().length : null, running: run.length, runningNames: run.map(a => a.animationName || 'anon').slice(0, 8), buttons: btns.length, buttonsWithTransition: moving };
        });
        out[name].pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 160));
        console.log(name, JSON.stringify(out[name]));
        await d.close();
      }
      save('rm', out);
    } finally { await L.close(); }
  },
};
function innerHeightGuess() { return 4; }

for (const p of process.argv.slice(2)) {
  if (!PARTS[p]) { console.error('unknown part', p); continue; }
  const t = Date.now();
  try { await PARTS[p](); } catch (e) { console.error(p, 'FAILED', e.stack || e); }
  console.log(`— ${p} ${((Date.now() - t) / 1000).toFixed(0)} s`);
}
