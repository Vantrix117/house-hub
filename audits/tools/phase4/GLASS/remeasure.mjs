// Phase 4 GLASS — independent RE-MEASUREMENT of the glass investigator's key numbers (written from scratch; does not
// import or copy perf.mjs / layers.mjs / glass-text-blur.mjs / prefs.mjs / opaque-blur.mjs).
//
//   node audits/tools/phase4/GLASS/remeasure.mjs perf  [--scenes a,b] [--window 5000]   → remeasure-perf-<scenes>.json
//   node audits/tools/phase4/GLASS/remeasure.mjs static                                  → remeasure-static.json
//   node audits/tools/phase4/GLASS/remeasure.mjs contrast [--cases id,id] [--positions N] → remeasure-contrast*.json
//   node audits/tools/phase4/GLASS/remeasure.mjs code                                    → remeasure-code.json
// Output: audits/evidence/p4/GLASS/remeasure-*.json. Everything runs on the local instance (lib/local.mjs).
//
// perf — Chromium (installed Chrome, headless). Arms applied in the same page state, in every document of the page:
//   A shipped · B `*{backdrop-filter:none!important}` · C the `--sheen-x` writes on <html> dropped (an own
//   `setProperty` wrapper on documentElement.style — instance-level, not the prototype) · order A B C A B C.
//   Cost: CDP SystemInfo.getProcessInfo summed over every process of this browser (cpu-seconds per wall second), plus
//   page CDP Performance.getMetrics (TaskDuration, RecalcStyleCount, RecalcStyleDuration) per second.
//   Scroll: a rAF loop in the scroller's document, 10 CSS px per frame, bouncing; frame intervals recorded.
//   Taps: page.mouse.click at the element centre every 450 ms (raw input); ltaps: Playwright locator.tap() every 450 ms. Idle: no input, no probe.
// static — per screen, both engines on request: every element with a computed backdrop-filter or a recipe class, its
//   visible fraction by an elementsFromPoint grid (7×7) inside its viewport-clipped rect (page elements under the app
//   iframe count as covered), background-color; then (Chromium) the same styles under emulated
//   prefers-reduced-transparency: reduce and prefers-contrast: more.
// contrast — Chromium: the label's line boxes (Range client rects), text made transparent, screenshot of those boxes
//   at CSS scale, WCAG ratio of each pixel against the computed ink; blur (shipped) vs noblur (arm B); at several
//   scroll positions of the content under the glass.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const MODE = process.argv[2] || 'perf';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WIN = +arg('window', 5000);
const EV = path.join(ROOT, 'audits/evidence/p4/GLASS');
const save = (name, obj) => { fs.writeFileSync(path.join(EV, name), JSON.stringify(obj, null, 1)); console.log('wrote', name); };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

// ── screens ───────────────────────────────────────────────────────────────────────────────────────────────────────
// open(d) returns { doc: the Frame or page where the scroller lives, scroller }
const app = (id, wait) => async d => { const f = await d.openApp(id, { wait }); await sleep(2500); return { doc: f, scroller: 'html' }; };
const shell = hash => async d => { await d.goto(hash); await sleep(2500); return { doc: d.page, scroller: '#views' }; };
const SCREENS = {
  home:        { device: 'ipad-portrait', profile: 'eli', open: shell('#home') },
  me:          { device: 'ipad-portrait', profile: 'eli', open: shell('#me') },
  'chat-phone':{ device: 'iphone-pwa', profile: 'eli', open: shell('#chat') },
  picker:      { device: 'ipad-portrait', profile: null, open: async d => { await d.goto('#home'); await sleep(2500); return { doc: d.page }; } },
  prayer:      { device: 'ipad-portrait', profile: 'eli', open: app('prayer', 'nav') },
  f260:        { device: 'ipad-portrait', profile: 'eli', open: app('f260', '#todayTitle:not(:empty)') },
  leftovers:   { device: 'iphone-pwa', profile: 'eli', open: app('leftovers', 'body') },
  kidverse:    { device: 'ipad-portrait', profile: 'ezra', open: app('kidverse', 'body') },
  verses:      { device: 'iphone-pwa', profile: 'eli', open: app('verses', '#trainer:not([hidden])') },
  tally:       { device: 'ipad-portrait', profile: 'ezra', open: app('tally', '#plus') },
  timer:       { device: 'ipad-portrait', profile: 'mom', open: app('timer', 'body') },
  tv:          { device: 'tv', profile: 'tv', open: async d => { await d.goto('#home'); await sleep(3500); return { doc: d.page }; } },
  dlive:       { device: 'ipad-portrait', profile: 'eli', variant: 'park', open: app('dollywood-live', 'body') },
  dguide:      { device: 'iphone-pwa', profile: 'eli', open: app('dollywood', 'body') },
};

// ── arms ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function arm(d, which) {
  for (const f of d.page.frames()) await f.evaluate(w => {
    document.getElementById('rm-arm-b')?.remove();
    const st = document.documentElement.style;
    if (Object.prototype.hasOwnProperty.call(st, 'setProperty')) delete st.setProperty;
    if (w === 'B') { const s = document.createElement('style'); s.id = 'rm-arm-b'; s.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.appendChild(s); }
    if (w === 'C') { const orig = CSSStyleDeclaration.prototype.setProperty; window.__rmDrop = 0; st.setProperty = function (p, ...rest) { if (p === '--sheen-x') { window.__rmDrop++; return; } return orig.call(this, p, ...rest); }; }
  }, which).catch(() => {});
  await sleep(800);
}
const drops = async d => { let n = 0; for (const f of d.page.frames()) n += await f.evaluate(() => window.__rmDrop || 0).catch(() => 0); return n; };

// ── cost probes ───────────────────────────────────────────────────────────────────────────────────────────────────
async function probes(L, d) {
  const b = await L.browser.newBrowserCDPSession();
  const p = await d.ctx.newCDPSession(d.page); await p.send('Performance.enable');
  const snap = async () => {
    const pi = (await b.send('SystemInfo.getProcessInfo')).processInfo; const cpu = {};
    for (const x of pi) cpu[x.type] = (cpu[x.type] || 0) + x.cpuTime;
    const m = Object.fromEntries((await p.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    return { t: Date.now(), cpu, m };
  };
  const diff = (a, z) => {
    const s = (z.t - a.t) / 1000; const cpu = {};
    for (const k of Object.keys(z.cpu)) cpu[k] = r3(((z.cpu[k] || 0) - (a.cpu[k] || 0)) / s);
    const total = r3(Object.values(cpu).reduce((x, y) => x + y, 0));
    const dm = k => ((z.m[k] || 0) - (a.m[k] || 0)) / s;
    return { secs: r3(s), cpuTotal: total, renderer: cpu.renderer, gpu: cpu.GPU, main: r3(dm('TaskDuration')), stylePerSec: r3(dm('RecalcStyleCount')), styleMsPerSec: r3(dm('RecalcStyleDuration') * 1000) };
  };
  return { snap, diff };
}
const SCROLL_FN = ([sel, ms]) => new Promise(res => {
  const el = sel === 'html' ? document.scrollingElement : document.querySelector(sel);
  if (!el) return res({ error: 'no scroller ' + sel });
  const max = el.scrollHeight - el.clientHeight; let dir = 1, last = 0; const iv = []; const t0 = performance.now();
  const f = t => { if (last) iv.push(t - last); last = t; let y = el.scrollTop + dir * 10; if (y >= max) { y = max; dir = -1; } if (y <= 0) { y = 0; dir = 1; } el.scrollTop = y; if (t - t0 < ms) requestAnimationFrame(f); else res({ max, iv }); };
  requestAnimationFrame(f);
});
const frameStats = iv => ({ frames: iv.length, fps: r3(1000 * iv.length / iv.reduce((a, b) => a + b, 0)), p95: r3(pct(iv, 0.95)), over20: r3(iv.filter(x => x > 20).length / iv.length) });

async function centre(d, doc, sel) {
  const bb = await doc.locator(sel).first().boundingBox();
  return bb && { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
}

const PERF = {
  home: ['scroll', 'idle'], me: ['scroll'], 'chat-phone': ['scroll'], prayer: ['scroll'], f260: ['scroll'], leftovers: ['scroll'],
  kidverse: ['scroll'], verses: ['scroll'], tally: ['taps', 'ltaps', 'idle'], picker: ['idle'], tv: ['still', 'fade'], dlive: ['idle'],
};

async function perfScene(L, name) {
  const S = SCREENS[name];
  const d = await L.device({ device: S.device, profile: S.profile, mode: 'light' });
  const out = { name, device: S.device, profile: S.profile, actions: {} };
  try {
    const { doc, scroller } = await S.open(d);
    const P = await probes(L, d);
    for (const act of PERF[name]) {
      const arms = act === 'scroll' ? ['A', 'B', 'C', 'A', 'B', 'C'] : ['A', 'B', 'A', 'B'];
      const res = {};
      for (const a of arms) {
        await arm(d, a);
        let extra = {};
        if (act === 'fade' || act === 'still') { await d.page.evaluate(() => window.__tv && window.__tv.crossfade()); if (act === 'still') await sleep(3200); }
        const s0 = await P.snap();
        if (act === 'scroll') { const r = await doc.evaluate(SCROLL_FN, [scroller, WIN]); extra = r.error ? r : { range: r.max, ...frameStats(r.iv) }; }
        else if (act === 'taps') { const c = await centre(d, doc, '#plus'); const end = Date.now() + WIN; let n = 0; while (Date.now() < end) { await d.page.mouse.click(c.x, c.y); n++; await sleep(450); } extra = { taps: n }; }
        else if (act === 'ltaps') { const loc = doc.locator('#plus'); const end = Date.now() + WIN; let n = 0; while (Date.now() < end) { await loc.tap().catch(() => {}); n++; await sleep(450); } extra = { taps: n, via: 'locator.tap (Playwright actionability checks)' }; }
        else await sleep(act === 'fade' ? 12000 : WIN);
        const s1 = await P.snap();
        const run = { ...P.diff(s0, s1), ...extra };
        if (a === 'C') run.sheenDropped = await drops(d);
        (res[a] ||= []).push(run);
        console.log(name, act, a, JSON.stringify(run));
      }
      const m = {};
      for (const [a, runs] of Object.entries(res)) { m[a] = {}; for (const k of ['cpuTotal', 'gpu', 'main', 'stylePerSec', 'styleMsPerSec', 'fps', 'p95', 'over20']) { const v = runs.map(r => r[k]).filter(x => x != null); m[a][k] = v.length ? r3(mean(v)) : null; } }
      out.actions[act] = { runs: res, mean: m };
    }
  } catch (e) { out.error = String(e.stack || e).slice(0, 600); console.log(name, 'ERROR', out.error); }
  await d.close();
  return out;
}

// ── static glass inventory ────────────────────────────────────────────────────────────────────────────────────────
const INV_FN = () => {
  const RECIPE = ['glass', 'glass-strong', 'btn-glass', 'pill', 'topbar', 'tabbar', 'sheet', 'glass-lite'];
  const vw = innerWidth, vh = innerHeight, out = [];
  const name = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 3); if (c.length) s += '.' + c.join('.'); return s; };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); const bf = cs.backdropFilter && cs.backdropFilter !== 'none' ? cs.backdropFilter : (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none' ? cs.webkitBackdropFilter : 'none');
    const recipe = RECIPE.filter(c => el.classList.contains(c));
    if (bf === 'none' && !recipe.length) continue;
    const r = el.getBoundingClientRect();
    let op = 1, hidden = false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); op *= +s.opacity; if (s.display === 'none' || s.visibility === 'hidden') hidden = true; }
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom);
    let vis = 0, n = 0;
    if (!hidden && op > 0.02 && x1 > x0 && y1 > y0) {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        const x = x0 + (x1 - x0) * (i + 0.5) / 7, y = y0 + (y1 - y0) * (j + 0.5) / 7; n++;
        const stack = document.elementsFromPoint(x, y); const top = stack[0];
        if (top && (top === el || el.contains(top))) vis++;
        else if (cs.pointerEvents === 'none' && stack.length && !stack.includes(el)) { /* not hit-testable: judge by the stack below */ const idx = stack.findIndex(s => s.contains(el) || s === document.body); if (idx === 0 || (top && top.contains(el))) vis++; }
      }
    }
    const visFrac = n ? vis / n : 0;
    out.push({ el: name(el), recipe, bf, bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), visFrac: Math.round(visFrac * 100) / 100, visArea: Math.round((x1 > x0 && y1 > y0 ? (x1 - x0) * (y1 - y0) : 0) * visFrac),
      style: { bf, bg: cs.backgroundColor, bgi: cs.backgroundImage.slice(0, 300), border: cs.borderTopColor + ' ' + cs.borderTopWidth, shadow: cs.boxShadow.slice(0, 300), op: cs.opacity } });
  }
  return { vw, vh, mq: ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)'].map(q => ({ q, parsed: matchMedia(q).media !== 'not all', matches: matchMedia(q).matches })), items: out };
};
async function inventory(d) {
  const docs = [];
  for (const f of d.page.frames()) { const u = f.url(); if (!u.startsWith('http')) continue; const r = await f.evaluate(INV_FN).catch(e => ({ error: String(e) })); docs.push({ doc: f === d.page.mainFrame() ? 'page' : u.replace(/^.*\/apps\//, 'frame:'), ...r }); }
  // page elements under the app iframe: the iframe covers them (elementsFromPoint returns the iframe) — already handled
  return docs;
}
const alpha = s => {
  let m = /rgba?\(([^)]+)\)/.exec(s || ''); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; }
  m = /color\([a-z0-9-]+ ([^)]+)\)/.exec(s || ''); if (m) { const q = m[1].split('/'); return q[1] ? +q[1].trim() : 1; }   // color(srgb r g b / a) from color-mix
  return null;
};

async function staticPass() {
  const out = { note: 'live = computed backdrop-filter != none and visFrac > 0 (7x7 elementsFromPoint grid). engines: webkit (the dataset engine) and chromium; prefs = chromium emulated media, styles compared per glass element.', screens: {} };
  for (const engine of ['webkit', 'chromium']) {
    const byVariant = {};
    for (const [n, S] of Object.entries(SCREENS)) (byVariant[S.variant || 'typical'] ||= []).push(n);
    for (const [variant, names] of Object.entries(byVariant)) {
      const L = await local({ engine, variant });
      try {
        for (const n of names) {
          const S = SCREENS[n];
          const d = await L.device({ device: S.device, profile: S.profile, mode: 'light' });
          const rec = (out.screens[n] ||= { device: S.device, profile: S.profile });
          try {
            await S.open(d);
            const docs = await inventory(d);
            const live = []; const all = [];
            for (const doc of docs) for (const it of doc.items || []) { const x = { doc: doc.doc, el: it.el, w: it.w, h: it.h, visFrac: it.visFrac, visArea: it.visArea, bf: it.bf, bgAlpha: alpha(it.bg) }; all.push(x); if (it.bf !== 'none' && it.visFrac > 0) live.push(x); }
            rec[engine] = { liveCount: live.length, live, coveredLive: all.filter(x => x.bf !== 'none' && x.visFrac === 0 && x.w > 0).map(x => `${x.doc} ${x.el} ${x.w}x${x.h}`), mq: docs.map(x => ({ doc: x.doc, mq: x.mq })) };
            if (engine === 'chromium') {
              const cdp = await d.ctx.newCDPSession(d.page);
              const key = docs => { const m = {}; for (const doc of docs) for (const it of doc.items || []) if (it.bf !== 'none' || it.recipe.length) m[doc.doc + ' ' + it.el + ' ' + it.w + 'x' + it.h] = JSON.stringify(it.style); return m; };
              const base = key(docs); const prefs = {};
              for (const [label, features] of [['reducedTransparency', [{ name: 'prefers-reduced-transparency', value: 'reduce' }]], ['contrastMore', [{ name: 'prefers-contrast', value: 'more' }]]]) {
                await cdp.send('Emulation.setEmulatedMedia', { features }); await sleep(600);
                const docs2 = await inventory(d); const k2 = key(docs2);
                const changed = Object.keys(base).filter(k => k in k2 && k2[k] !== base[k]);
                prefs[label] = { glassElements: Object.keys(base).length, compared: Object.keys(base).filter(k => k in k2).length, changed: changed.length, changedList: changed.slice(0, 10), mq: docs2.map(x => ({ doc: x.doc, mq: x.mq })) };
                await cdp.send('Emulation.setEmulatedMedia', { features: [] }); await sleep(300);
              }
              rec.prefs = prefs;
            }
            console.log(engine, n, rec[engine].liveCount, rec[engine].live.map(x => x.el + ' ' + x.w + 'x' + x.h + ' a' + x.bgAlpha).join(' | '));
          } catch (e) { rec[engine] = { error: String(e.stack || e).slice(0, 500) }; console.log(engine, n, 'ERROR', e.message); }
          await d.close();
        }
      } finally { await L.close(); }
    }
  }
  save('remeasure-static.json', out);
}

// ── contrast on glass with a real blur ────────────────────────────────────────────────────────────────────────────
function decodePng(buf) {
  let p = 8, w, h, ct, bd; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12]) throw new Error('interlaced'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break; p += 12 + len; }
  if (bd !== 8) throw new Error('bit depth ' + bd);
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : null; if (!bpp) throw new Error('colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)]; const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0; let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255; } }
  return { w, h, bpp, px };
}
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// label: { doc: 'page'|'frame', find: fn(text) in-page returning the element, scroller }
const FIND_FN = ([sel, text]) => {
  const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().replace(/\s+/g, ' ') === text || e.textContent.trim().startsWith(text));
  if (!el) return null;
  const rects = []; const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const b of r.getClientRects()) rects.push({ x: b.left, y: b.top, w: b.width, h: b.height }); }
  el.setAttribute('data-rm-label', '1');
  return { rects, color: getComputedStyle(el).color, font: getComputedStyle(el).fontSize + ' ' + getComputedStyle(el).fontWeight };
};
async function sampleLabel(d, doc, sel, text) {
  const info = await doc.evaluate(FIND_FN, [sel, text]);
  if (!info || !info.rects.length) return { error: 'label not found ' + sel + ' ' + text };
  let off = { x: 0, y: 0 };
  if (doc !== d.page) { const bb = await (await doc.frameElement()).boundingBox(); off = { x: bb.x, y: bb.y }; }
  const ink = /rgba?\(([^)]+)\)/.exec(info.color)[1].split(/[ ,/]+/).map(Number);
  await doc.evaluate(() => { const s = document.createElement('style'); s.id = 'rm-hide'; s.textContent = '[data-rm-label],[data-rm-label] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}'; document.head.appendChild(s); });
  await sleep(250);
  const vals = [];
  for (const r of info.rects) {
    const clip = { x: Math.round(r.x + off.x), y: Math.round(r.y + off.y), width: Math.max(1, Math.round(r.w)), height: Math.max(1, Math.round(r.h)) };
    const png = decodePng(await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' }));
    const Li = lum(ink[0], ink[1], ink[2]);
    for (let i = 0; i < png.w * png.h; i++) { const o = i * png.bpp; vals.push(ratio(Li, lum(png.px[o], png.px[o + 1], png.px[o + 2]))); }
  }
  await doc.evaluate(() => { document.getElementById('rm-hide')?.remove(); document.querySelector('[data-rm-label]')?.removeAttribute('data-rm-label'); });
  return { ink: info.color, font: info.font, px: vals.length, p10: r3(pct(vals, 0.10)), med: r3(pct(vals, 0.5)), min: r3(Math.min(...vals)) };
}
async function scrollTo(doc, scroller, frac) { return doc.evaluate(([s, f]) => { const el = s === 'html' ? document.scrollingElement : document.querySelector(s); const max = el.scrollHeight - el.clientHeight; el.scrollTop = Math.round(max * f); return { max, top: el.scrollTop }; }, [scroller, frac]); }

async function contrastPass() {
  const only = arg('cases'); const NPOS = +arg('positions', 5);
  const L = await local({ engine: 'chromium' });
  const out = { note: 'p10/med = 10th percentile / median of per-pixel WCAG ratio (ink vs the glass pixels inside the label line boxes, text hidden). blur = shipped; noblur = backdrop-filter none everywhere. positions = scroll fraction of the content under the glass.', cases: [] };
  const setTheme = async (profile, theme) => { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } }); return r.status; };
  const CASES = [
    { id: 'tabbar-apps-ipad-light', device: 'ipad-portrait', mode: 'light', theme: 'system', open: shell('#home'), label: ['#tabbar .tab', 'Apps'] },
    { id: 'tabbar-apps-ipad-dark', device: 'ipad-portrait', mode: 'dark', theme: 'system', open: shell('#home'), label: ['#tabbar .tab', 'Apps'] },
    { id: 'tabbar-apps-iphone-light', device: 'iphone-pwa', mode: 'light', theme: 'system', open: shell('#home'), label: ['#tabbar .tab', 'Apps'] },
    { id: 'prayer-list-light', device: 'ipad-portrait', mode: 'light', theme: 'system', open: app('prayer', 'nav'), label: ['nav button, nav a', 'List'] },
    { id: 'prayer-list-dark', device: 'ipad-portrait', mode: 'dark', theme: 'system', open: app('prayer', 'nav'), label: ['nav button, nav a', 'List'] },
    { id: 'prayer-list-midnight', device: 'ipad-portrait', mode: 'light', theme: 'midnight', open: app('prayer', 'nav'), label: ['nav button, nav a', 'List'] },
    { id: 'prayer-list-forest', device: 'ipad-portrait', mode: 'light', theme: 'forest', open: app('prayer', 'nav'), label: ['nav button, nav a', 'List'] },
  ];
  try {
    for (const c of CASES.filter(c => !only || only.split(',').includes(c.id))) {
      const st = await setTheme('eli', c.theme);
      const d = await L.device({ device: c.device, mode: c.mode, profile: 'eli', localStorage: c.theme === 'system' ? null : { 'hub.theme': JSON.stringify(c.theme) } });
      const rec = { id: c.id, device: c.device, mode: c.mode, theme: c.theme, putStatus: st, positions: [] };
      try {
        const { doc, scroller } = await c.open(d);
        rec.applied = await doc.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme || null }));
        for (const f of Array.from({ length: NPOS }, (_, i) => i / (NPOS - 1))) {
          const pos = await scrollTo(doc, scroller, f); await sleep(400);
          await arm(d, 'A'); const blur = await sampleLabel(d, doc, ...c.label);
          await arm(d, 'B'); const noblur = await sampleLabel(d, doc, ...c.label);
          await arm(d, 'A');
          rec.positions.push({ frac: f, top: pos.top, max: pos.max, blur, noblur });
          console.log(c.id, f, JSON.stringify(blur), JSON.stringify(noblur));
        }
        const bl = rec.positions.map(p => p.blur.p10).filter(x => x != null), nb = rec.positions.map(p => p.noblur.p10).filter(x => x != null);
        rec.summary = { blurP10min: Math.min(...bl), blurP10max: Math.max(...bl), noblurP10min: Math.min(...nb), noblurP10max: Math.max(...nb) };
      } catch (e) { rec.error = String(e.stack || e).slice(0, 500); console.log(c.id, 'ERROR', e.message); }
      out.cases.push(rec);
      await d.close();
    }
    await setTheme('eli', 'system');
  } finally { await L.close(); }
  save(only ? 'remeasure-contrast-' + only.replace(/,/g, '_') + '-' + NPOS + 'pos.json' : 'remeasure-contrast.json', out);
}

// ── code counts + re-aggregation of the v2 raw dataset ────────────────────────────────────────────────────────────
function codePass() {
  const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
  const spec = {}, lite = {}, mq = {};
  for (const f of files) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const n = (s.match(/var\(--glass-spec\)/g) || []).length; if (n) spec[f] = n;
    const l = (s.match(/glass-lite/g) || []).length; if (l) lite[f] = l;
    const m = (s.match(/prefers-reduced-transparency|prefers-contrast|forced-colors/g) || []).length; if (m) mq[f] = m; }
  for (const f of ['apps/design.css', 'apps/hub.js']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); mq[f] = (s.match(/prefers-reduced-transparency|prefers-contrast|forced-colors/g) || []).length; spec[f] = (s.match(/var\(--glass-spec\)/g) || []).length; }
  // raw dataset (audits/evidence/p4/measure/raw/<run>/<area>/*.json, v:2): my own aggregation
  const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw'); const A = {};
  for (const run of ['themes', 'devices', 'states']) for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(RAW, run, area, f), 'utf8')); } catch { continue; }
    if (j.v !== 2) continue;
    const a = A[area] ||= { jobs: 0, live: [], contentJobs: 0 };
    a.jobs++; let live = 0, content = false;
    for (const d of j.docs || []) for (const g of d.glass || []) { if (!g.bf || g.bf === 'none' || !(g.visArea > 0)) continue; live++; if (g.chrome === false) content = true; }
    a.live.push(live); if (content) a.contentJobs++;
  }
  const agg = {}; for (const [k, a] of Object.entries(A)) agg[k] = { jobs: a.jobs, liveMedian: pct(a.live, 0.5), liveMax: Math.max(...a.live), contentShare: r3(a.contentJobs / a.jobs) };
  save('remeasure-code.json', { specCopies: spec, glassLiteUses: lite, prefsMediaQueries: mq, rawAggregate: agg });
  console.log(JSON.stringify({ spec, lite, mq, agg }, null, 1));
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (MODE === 'perf') {
  const names = (arg('scenes', Object.keys(PERF).join(','))).split(',');
  const out = { note: 'See the header of remeasure.mjs. Means of the runs per arm.', window: WIN, scenes: {} };
  const byVariant = {}; for (const n of names) (byVariant[SCREENS[n].variant || 'typical'] ||= []).push(n);
  for (const [variant, list] of Object.entries(byVariant)) {
    const L = await local({ engine: 'chromium', variant });
    try { out.env = out.env || { product: (await (await L.browser.newBrowserCDPSession()).send('Browser.getVersion')).product }; for (const n of list) out.scenes[n] = await perfScene(L, n); }
    finally { await L.close(); }
  }
  save('remeasure-perf-' + names.join('_').slice(0, 60) + '.json', out);
} else if (MODE === 'static') await staticPass();
else if (MODE === 'contrast') await contrastPass();
else if (MODE === 'code') codePass();
