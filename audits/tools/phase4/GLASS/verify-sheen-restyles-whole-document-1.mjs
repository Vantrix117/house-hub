// Phase 4 GLASS skeptic #1: does hub.js's --sheen-x write on <html> re-style the whole document during scroll, and
// is that what costs F260 its frames? Independent of perf.mjs: own scroll driver, own arms, own metrics.
//   Arms (same page state; order A N B A N B R R):
//     B  glass off: backdrop-filter:none on every element in every document (sheen as shipped)
//     A  as shipped
//     N  sheen neutralised: an own-property setProperty on documentElement.style only (not the prototype) drops '--sheen-x'
//     R  writes kept, but --sheen-x registered as a NON-inherited custom property (CSS.registerProperty) - tests the
//        claimed root cause (inheritance fan-out) and the "expected" fix; irreversible, so run last
//   Metrics: CDP Performance (RecalcStyleCount/Duration, TaskDuration), a CDP trace of UpdateLayoutTree elementCount
//   for one A and one N window, rAF frame intervals, sheen writes counted, DOM size, visible backdrop-filter elements.
//   node audits/tools/phase4/GLASS/verify-sheen-restyles-whole-document-1.mjs [--scene f260,home,prayer] [--window 5000]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WIN = +arg('window', 5000);
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-sheen-restyles-whole-document-1' + (arg('tag', '') ? '-' + arg('tag') : '') + '.json');
const SC = {
  f260: { app: 'f260', ready: '#todayTitle:not(:empty)', device: 'ipad-portrait' },
  prayer: { app: 'prayer', ready: '#todayLine:not(:empty)', device: 'ipad-portrait' },
  home: { app: null, ready: '#view-home .glance .gcard', device: 'ipad-portrait', sel: '#views' },
};
const want = arg('scene', 'f260,home,prayer').split(',');

async function arm(frames, a) {
  for (const f of frames) await f.evaluate(a => {
    const st = document.documentElement.style;
    if (!window.__v1orig) window.__v1orig = CSSStyleDeclaration.prototype.setProperty;
    window.__v1writes ||= 0;
    if (a === 'N') st.setProperty = function (k, v, p) { if (k === '--sheen-x') { window.__v1writes++; return; } return window.__v1orig.call(this, k, v, p); };
    else st.setProperty = function (k, v, p) { if (k === '--sheen-x') window.__v1writes++; return window.__v1orig.call(this, k, v, p); };
    let g = document.getElementById('v1-glass-off'); if (a === 'B' && !g) { g = document.createElement('style'); g.id = 'v1-glass-off'; g.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.appendChild(g); } if (a !== 'B' && g) g.remove();
    if (a === 'R' && !window.__v1reg) { try { CSS.registerProperty({ name: '--sheen-x', syntax: '<percentage>', inherits: false, initialValue: '45%' }); window.__v1reg = 'ok'; } catch (e) { window.__v1reg = String(e); } }
  }, a).catch(() => {});
}
const writes = async frames => { let n = 0; for (const f of frames) n += await f.evaluate(() => window.__v1writes || 0).catch(() => 0); return n; };

function scroll(frame, sel, ms) {
  return frame.evaluate(([sel, ms]) => new Promise(res => {
    let el = sel ? document.querySelector(sel) : null;
    if (!el) el = document.scrollingElement;
    const range = el.scrollHeight - el.clientHeight; el.scrollTop = 0; let dir = 1; const ts = []; const t0 = performance.now();
    const step = now => { ts.push(now); let y = el.scrollTop + dir * 10; if (y >= range) { y = range; dir = -1; } if (y <= 0) { y = 0; dir = 1; } el.scrollTop = y;
      if (now - t0 < ms) requestAnimationFrame(step); else { const iv = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); const q = p => +iv[Math.floor(p * (iv.length - 1))].toFixed(1);
        res({ scroller: el.id || el.tagName, range, fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: q(.5), p95: q(.95), max: +iv.at(-1).toFixed(1), over20: +(iv.filter(x => x > 20).length / iv.length).toFixed(3) }); } };
    requestAnimationFrame(step);
  }), [sel, ms]);
}

const out = { method: 'see header of audits/tools/phase4/GLASS/verify-sheen-restyles-whole-document-1.mjs', window: WIN, scenes: {} };
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const id of want) {
    const s = SC[id]; await L.reset('typical');
    const d = await L.device({ device: s.device, mode: 'light', profile: 'eli' });
    let target;
    if (s.app) target = await d.openApp(s.app, { wait: s.ready }); else { await d.goto('#home'); await d.page.waitForSelector(s.ready, { timeout: 10000 }).catch(() => {}); target = d.page.mainFrame(); }
    await sleep(3000);
    const frames = d.page.frames();
    const rec = { device: s.device, arms: {} };
    rec.dom = await target.evaluate(() => ({ elements: document.querySelectorAll('*').length, rootSheen: document.documentElement.style.getPropertyValue('--sheen-x'), rulesUsingSheen: [...document.styleSheets].reduce((n, ss) => { try { return n + [...ss.cssRules].filter(r => r.cssText.includes('--sheen-x')).length; } catch { return n; } }, 0) }));
    rec.visibleBackdrop = [];
    for (const f of frames) rec.visibleBackdrop.push(...await f.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); const bf = c.backdropFilter; const r = e.getBoundingClientRect(); return bf && bf !== 'none' && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && c.display !== 'none' && c.visibility !== 'hidden'; }).map(e => location.pathname.split('/').pop() + ':' + (e.id ? '#' + e.id : e.tagName + '.' + e.className))).catch(() => []));
    const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
    const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    for (const a of ['A', 'N', 'B', 'A', 'N', 'B', 'R', 'R']) {
      await arm(frames, a); await sleep(800);
      const trace = !(rec.arms[a] && rec.arms[a].some(r => r.trace));
      const events = [];
      const onData = e => events.push(...e.value);
      if (trace) { cdp.on('Tracing.dataCollected', onData); await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink', transferMode: 'ReportEvents' }); }
      const w0 = await writes(frames), m0 = await pm(), t0 = Date.now();
      const fr = await scroll(target, s.sel, WIN);
      const secs = (Date.now() - t0) / 1000, m1 = await pm(), w1 = await writes(frames);
      const r = { fr, sheenWrites: w1 - w0, recalcPerSec: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / secs).toFixed(1), styleMsPerSec: +(1000 * (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / secs).toFixed(1), mainMsPerSec: +(1000 * (m1.TaskDuration - m0.TaskDuration) / secs).toFixed(1), layoutMsPerSec: +(1000 * (m1.LayoutDuration - m0.LayoutDuration) / secs).toFixed(1) };
      if (trace) {
        const done = new Promise(res => cdp.once('Tracing.tracingComplete', res)); await cdp.send('Tracing.end'); await done; cdp.off('Tracing.dataCollected', onData);
        const ult = events.filter(e => e.name === 'UpdateLayoutTree' && e.ph === 'X');
        const counts = ult.map(e => e.args && (e.args.elementCount ?? (e.args.data && e.args.data.elementCount))).filter(x => x != null).sort((a, b) => b - a);
        r.trace = { updateLayoutTree: ult.length, withCount: counts.length, elementCountTop5: counts.slice(0, 5), over500: counts.filter(c => c > 500).length, maxDurMs: +(Math.max(0, ...ult.map(e => e.dur || 0)) / 1000).toFixed(1), durOver10ms: ult.filter(e => (e.dur || 0) > 10000).length };
      }
      if (a === 'R') r.registered = await target.evaluate(() => window.__v1reg);
      (rec.arms[a] ||= []).push(r);
      console.log(id, a, JSON.stringify(r));
    }
    out.scenes[id] = rec; await d.close();
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
} finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
