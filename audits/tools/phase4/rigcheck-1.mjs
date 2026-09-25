// Phase 4 — independent RIG VERIFIER, round 1.
// Re-measures data points of the measurement rig (audits/tools/phase4/measure.mjs) WITHOUT its code: own navigation shim
// over lib/local.mjs, own element probes, own frame-offset maths, own PNG decoder and own per-pixel contrast, then compares
// with the rig's raw job files and its aggregates. Screen scripts from audits/tools/areas/*.mjs are imported read-only
// (they are the Phase 1 screen definitions both rigs must reproduce), everything else is written here.
//
//   node audits/tools/phase4/rigcheck-1.mjs [--only J1,J4] [--agg]      → audits/evidence/p4/RIGCHECK/rigcheck-1.json
//
// Text data point:  p10 / median of per-pixel WCAG ratio of (text colour × alpha × opacity chain) blended over the pixels of a
//                   text-hidden 1x CSS page screenshot under the text node's line boxes (page coordinates).
// Non-text point:   median colour of two small pixel patches (normal screenshot), or a computed colour against a patch.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { local, sleep, ROOT } from '../lib/local.mjs';
import { DEVICES } from '../lib/devices.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/RIGCHECK');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const AGG = path.join(ROOT, 'audits/evidence/p4/measure');
fs.mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const ONLY = opt('only') ? opt('only').split(',') : null;

// ── PNG decoder (8-bit RGB/RGBA, non-interlaced; what Playwright writes) ─────────────────────────────────────────────
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('png: unsupported depth/interlace'); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('png colour type ' + ct); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride); const cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * bpp]; out[(y * w + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 4 + 2] = cur[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    prev = Buffer.from(cur);
  }
  return { w, h, px: (x, y) => { x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y))); const i = (y * w + x) * 4; return [out[i], out[i + 1], out[i + 2]]; } };
}
const L8 = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * L8(r) + 0.7152 * L8(g) + 0.0722 * L8(b);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
const medC = cs => [0, 1, 2].map(i => q(cs.map(c => c[i]), 0.5));

// ── probes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// T: text probe. N: non-text probe: a/b are patch specs {x, y, w, h} as expressions over the element box (l t r b cx cy W H),
// or {computed: 'stroke'|'box-shadow'|'bg'} for the element's own computed colour.
const T = (doc, sel, o = {}) => ({ kind: 'text', doc, sel, ...o });
const N = (doc, sel, a, b, o = {}) => ({ kind: 'pair', doc, sel, a, b, ...o });
const HOME = [T('page', '.home-hero .hero-kicker'), T('page', '.home-hero .hero-title'), T('page', '.home-hero .hero-sub'), T('page', '#tabbar .tab.on'), T('page', '.glance .gcard .gsub'), T('page', '.rem-by')];
const JOBS = [
  { id: 'J1', file: 'shell', screen: 'home', device: 'ipad-portrait', mode: 'dark', theme: 'system', probes: HOME, known: ['P2-VIS-06 dark Home hero kicker 1.50-3.41:1'] },
  { id: 'J2', file: 'shell', screen: 'home', device: 'ipad-portrait', mode: 'light', theme: 'forest', probes: HOME },
  { id: 'J3', file: 'shell', screen: 'apps', device: 'ipad-portrait', mode: 'light', theme: 'parchment', probes: [T('page', '#grid .tile .tlabel', { max: 2 }), T('page', '#grid .tile .badge'), T('page', '#view-apps .view-title h1')] },
  { id: 'J4', file: 'f260', screen: 'today', device: 'ipad-portrait', mode: 'dark', theme: 'hearth', probes: [T('frame', '#todayDone'), T('frame', '#todayTitle'), T('frame', '#doneCount'), T('frame', '.wk-pad .day .lbl')], known: ['P2-VIS-03 F260 Done 2.02:1 Hearth on a dark OS'] },
  { id: 'J5', file: 'f260', screen: 'plan', device: 'ipad-portrait', mode: 'light', theme: 'midnight',
    probes: [T('frame', '#pct'), T('frame', '#jBooks'), N('frame', '#ygrid button:not(.done):not(.part):not(.cur)', { x: 'cx-2', y: 'cy-2', w: 4, h: 4 }, { x: 'r+1', y: 'cy-2', w: 2, h: 4 }, { label: 'ygrid empty cell vs gap' })],
    known: ['VIS-F260-2 empty progress cells 1.04:1 dark'] },
  { id: 'J6', file: 'verses', screen: 'revealed', device: 'ipad-portrait', mode: 'light', theme: 'system', probes: [T('frame', '[data-rate="got"] span'), T('frame', '[data-rate="almost"] span'), T('frame', '[data-rate="not"] span'), T('frame', '#ref'), T('frame', '#hint')], known: ['VIS-VERSES-3 Got it 4.4:1 Hearth'] },
  { id: 'J7', file: 'kidverse', screen: 'kid', device: 'ipad-portrait', mode: 'light', theme: 'system',
    probes: [T('frame', '.days span', { max: 2 }), T('frame', '#kick'), T('frame', '#also'), T('frame', '#done span'),
      N('frame', '.days span.today', { computed: 'box-shadow' }, { x: 'cx-2', y: 't-8', w: 4, h: 2 }, { label: 'today ring (computed --focus) vs card' }),
      N('frame', '.days span.today', { x: 'cx-1', y: 't-2.5', w: 2, h: 1 }, { x: 'cx-2', y: 't-8', w: 4, h: 2 }, { label: 'today ring pixels vs card' })],
    known: ['VIS-KIDVERSE-1 day letters 2.08-2.22:1 light', 'today ring 1.70:1 light'] },
  { id: 'J8', file: 'kidverse', screen: 'kid', device: 'ipad-portrait', mode: 'light', theme: 'frost', probes: [T('frame', '.days span', { max: 2 }), T('frame', '#also'), T('frame', '#done span')], known: ['day letters 2.08:1 Frost'] },
  { id: 'J9', file: 'leftovers', screen: 'main', device: 'ipad-portrait', mode: 'light', theme: 'system',
    probes: [T('frame', '.status', { max: 2 }), T('frame', '.info .nm'), T('frame', '#tally'), T('frame', 'section.group > h2 > small'),
      N('frame', '.bar > i', { x: 'r-5', y: 't+1', w: 3, h: 4 }, { x: 'r+6', y: 't+1', w: 3, h: 4 }, { label: 'freshness bar fill end vs track (2nd bar = first Aging row)', index: 1 })],
    known: ['VIS-LEFTOVERS-2 warn bar 2.69:1 Hearth'] },
  { id: 'J10', file: 'tally', screen: 'main', device: 'ipad-portrait', mode: 'dark', theme: 'system',
    probes: [T('frame', '#n'), T('frame', '#reset'), T('frame', '#minus'),
      N('frame', '#minus', { x: 'l+10', y: 'cy-2', w: 4, h: 4 }, { x: 'l-9', y: 'cy-2', w: 4, h: 4 }, { label: 'minus disc vs wash' }),
      N('frame', '#plus', { x: 'l+12', y: 'cy-2', w: 4, h: 4 }, { x: 'r+9', y: 'cy-2', w: 4, h: 4 }, { label: 'plus disc vs wash' })],
    known: ['VIS-TALLY-1 discs 1.13-1.62:1 dark', 'tally text >= 6.93:1'] },
  { id: 'J11', file: 'timer', screen: 'running', device: 'ipad-portrait', mode: 'light', theme: 'system',
    probes: [T('frame', '#t'), T('frame', '#presets .btn.on'), T('frame', '#presets .btn:not(.on)'),
      N('frame', '.dial .ring circle.bg', { computed: 'stroke' }, { x: 'cx-3', y: 't+0.30*H', w: 6, h: 4 }, { label: 'ring track (computed stroke) vs dial' })],
    known: ['VIS-TIMER-7 ring track 1.39:1 light', 'VIS-TIMER-3 selected chip 5.76-7.79:1'] },
  { id: 'J12', file: 'dollywood', screen: 'steps', device: 'ipad-portrait', mode: 'light', theme: 'system', probes: [T('frame', '#b-list .bitem.ok b', { max: 2 }), T('frame', '#b-count'), T('frame', '#b-sec')], known: ['VIS-DOLLYWOOD-1 done rows 2.18-2.31:1 light'] },
  { id: 'J13', file: 'dollywood-live', screen: 'waits', device: 'ipad-portrait', mode: 'light', theme: 'system', probes: [T('frame', '.wtile[data-w=short] small'), T('frame', '.wtile[data-w=mid] small'), T('frame', '#meet-meta'), T('frame', '#near-mode-near')], known: ['VIS-DOLLYWOOD-LIVE-8 MIN 4.38:1 green, 3.38:1 amber'] },
  { id: 'J14', file: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'light', theme: 'parchment', probes: [T('frame', '#todayDate'), T('frame', '#listSwitch button', { max: 2 }), T('frame', '#todayLine'), T('frame', '#startPray')] },
  { id: 'J15', file: 'tv', screen: 'board', device: 'tv', mode: 'light', theme: 'system', probes: [T('page', '#tv-date'), T('page', '#tv-greet'), T('page', '#tv-verse-hd'), T('page', '.tv-prayed h2')] },
  { id: 'J17', file: 'shell', screen: 'first-visit', device: 'ipad-portrait', mode: 'light', theme: 'parchment', preScroll: { sel: '#views', top: 944 }, probes: [T('page', 'span.ftxt', { text: 'Read week 38 day 3', noScroll: true })], note: 'rig p10 1.04 / med 6.75 at sweep step 2: partial occlusion?' },
  { id: 'J18', run: 'devices', file: 'f260', screen: 'today', device: 'desktop', mode: 'dark', theme: 'system', probes: [T('frame', '#todayDone'), T('frame', '#todayTitle'), T('frame', '#doneCount')] },
  { id: 'J19', run: 'devices', file: 'verses', screen: 'revealed', device: 'iphone-pwa', mode: 'light', theme: 'system', probes: [T('frame', '[data-rate="got"] span'), T('frame', '#ref'), T('frame', '#hint')] },
  { id: 'J20', run: 'devices', file: 'kidverse', screen: 'kid', device: 'ipad-landscape', mode: 'dark', theme: 'system', probes: [T('frame', '.days span.today'), T('frame', '#also'), T('frame', '#done span')] },
  { id: 'J21', run: 'devices', file: 'leftovers', screen: 'main', device: 'desktop', mode: 'light', theme: 'system', probes: [T('frame', '.status', { max: 2 }), T('frame', '#tally'), T('frame', '.info .nm')] },
  { id: 'J22', run: 'devices', file: 'shell', screen: 'home', device: 'iphone-pwa', mode: 'dark', theme: 'system', probes: [T('page', '.home-hero .hero-kicker'), T('page', '.home-hero .hero-sub'), T('page', '#tabbar .tab.on')] },
  { id: 'J16', file: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'dark', theme: 'system', probes: [T('frame', '#todayDate'), T('frame', '#listSwitch button', { max: 2 }), T('frame', '#todayLine')] },
];

// ── in-document probe (runs in the page or in the app frame) ─────────────────────────────────────────────────────────
function docProbe(p) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
  const norm = s => { if (!s || s === 'transparent' || s === 'none') return null; g.clearRect(0, 0, 1, 1); g.fillStyle = 'rgba(0,0,0,0)'; g.fillStyle = s; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  let els = [...document.querySelectorAll(p.sel)].filter(e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (p.index != null) els = els.slice(p.index);
  if (p.text) els = els.filter(e => new RegExp(p.text).test(e.textContent));
  const out = [];
  for (const el of els.slice(0, p.max || 1)) {
    const r0 = el.getBoundingClientRect();
    if (!p.noScroll && (r0.top < 0 || r0.bottom > innerHeight || r0.left < 0 || r0.right > innerWidth)) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }
    const cs = getComputedStyle(el);
    let op = 1; for (let x = el; x && x.nodeType === 1; x = x.parentElement) op *= parseFloat(getComputedStyle(x).opacity);
    const rects = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; let text = '';
    while ((n = walk.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      // own text only (the text's parent is el itself, or el is the span that holds the text)
      if (n.parentElement !== el) continue;
      text += n.nodeValue.trim() + ' ';
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 2) rects.push({ x: q.left, y: q.top, w: q.width, h: q.height });
    }
    const b = el.getBoundingClientRect();
    let computed = null;
    if (p.a && p.a.computed === 'box-shadow') { const m = cs.boxShadow.match(/(rgba?\([^)]*\)|color\([^)]*\))/); computed = m ? norm(m[1]) : null; }
    if (p.a && p.a.computed === 'stroke') computed = norm(cs.stroke);
    if (p.a && p.a.computed === 'bg') computed = norm(cs.backgroundColor);
    out.push({ text: text.trim().slice(0, 60), fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10) || 400, color: norm(cs.color), op: +op.toFixed(3), rects,
      box: { l: b.left, t: b.top, r: b.right, b: b.bottom, W: b.width, H: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }, computed, cls: el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className });
  }
  return out;
}

// ── navigation shim over lib/local.mjs (own copy of the t API the screen scripts use) ──────────────────────────────
function makeT(L, d, job, s) {
  const dev = DEVICES[job.device]; const page = d.page, ctx = d.ctx;
  const pending = new Set(); let lastNet = Date.now();
  ctx.on('request', r => { if (!r.url().startsWith('data:')) { pending.add(r); lastNet = Date.now(); } });
  const done = r => { pending.delete(r); lastNet = Date.now(); }; ctx.on('requestfinished', done); ctx.on('requestfailed', done);
  const matcher = m => typeof m === 'function' ? m : m instanceof RegExp ? (u => m.test(u.href)) : (u => u.href.startsWith(L.api + m));
  const cors = { 'Access-Control-Allow-Origin': L.site, 'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', Vary: 'Origin' };
  const t = {
    page, ctx, state: 'typical', device: job.device, mode: job.mode, variant: job.variant, profile: job.profile, site: L.site, api: L.api, dev,
    loading: false, offline: false, error: false, reopened: false, touch: dev.hasTouch, sleep,
    async settle(max = 8000) { const until = Date.now() + max; while (Date.now() < until && (pending.size || Date.now() - lastNet < 400)) await sleep(100); for (const f of page.frames()) await f.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}); await sleep(s.settle || 350); },
    frame: () => page.frameLocator('#frame'),
    async goto(h = '') { await page.goto(L.site + '/index.html' + h, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      let f = null; const until = Date.now() + 10000;
      while (!f && Date.now() < until) { f = page.frames().find(x => x.url().includes(`/apps/${id}.html`)); if (!f) await sleep(100); }
      if (!f) throw new Error('no frame ' + id); await f.waitForLoadState('domcontentloaded').catch(() => {});
      if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {}); return f;
    },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, o = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(o); else await loc.click(o); },
    async tapIn(fr, sel, o = {}) { const loc = sel ? fr.locator(sel).first() : fr; if (dev.hasTouch) await loc.tap(o); else await loc.click(o); },
    async hold(m) { await ctx.route(matcher(m), () => {}); },
    async answer(m, { status = 200, body = {}, contentType = 'application/json', headers = {} } = {}) { await ctx.route(matcher(m), r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status, contentType, headers: { ...cors, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })); },
    async failApi(m, { status = 500, error = 'internal', message = 'x' } = {}) { await t.answer(m, { status, body: { error, message } }); },
    async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };
  return t;
}

// the app frame's content-box origin in page coordinates, computed here from the iframe element
async function frameOrigin(page) {
  return page.evaluate(() => {
    const f = document.querySelector('#frame'); if (!f) return null; const r = f.getBoundingClientRect(); const cs = getComputedStyle(f);
    let op = 1; for (let x = f; x && x.nodeType === 1; x = x.parentElement) op *= parseFloat(getComputedStyle(x).opacity);
    const sx = f.offsetWidth ? r.width / f.offsetWidth : 1;
    return { x: r.left + (f.clientLeft + parseFloat(cs.paddingLeft)) * sx, y: r.top + (f.clientTop + parseFloat(cs.paddingTop)) * sx, sx, op: +op.toFixed(3), w: r.width, h: r.height };
  });
}
const hideCss = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}';
async function setHidden(page, on) {
  for (const f of page.frames()) await f.evaluate(([on, css]) => { let s = document.getElementById('rc1-hide'); if (on && !s) { s = document.createElement('style'); s.id = 'rc1-hide'; s.textContent = css; (document.head || document.documentElement).appendChild(s); } if (!on && s) s.remove(); }, [on, hideCss]).catch(() => {});
  await sleep(120);
}
function evalExpr(e, box) { if (typeof e === 'number') return e; return Function(...Object.keys(box), 'return (' + e + ')')(...Object.values(box)); }
function patch(img, spec, box, off) {
  const x0 = evalExpr(spec.x, box) * off.sx + off.x, y0 = evalExpr(spec.y, box) * off.sx + off.y; const cs = [];
  for (let y = 0; y < (spec.h || 1); y++) for (let x = 0; x < (spec.w || 1); x++) cs.push(img.px(x0 + x, y0 + y));
  return medC(cs);
}

async function runJob(L, job) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', job.file + '.mjs')).href);
  const s = mod.screens.find(x => x.screen === job.screen); if (!s) throw new Error('no screen ' + job.screen);
  job.profile = s.profile === undefined ? 'eli' : s.profile;
  job.variant = (s.variant && s.variant.typical) || 'typical';
  job.area = mod.area;
  await L.reset(job.variant);
  let themeRow = null;
  if (job.theme !== 'system' && job.profile && job.profile !== 'tv') {
    const r = await L.apiAs(job.profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: job.theme } });
    themeRow = r.status;
  }
  const d = await L.device({ device: job.device, mode: job.mode, profile: job.profile, localStorage: job.theme !== 'system' ? { 'hub.theme': JSON.stringify(job.theme) } : null, ...(s.localStorage ? { localStorage: { ...(s.localStorage || {}), ...(job.theme !== 'system' ? { 'hub.theme': JSON.stringify(job.theme) } : {}) } } : {}) });
  const t = makeT(L, d, job, s);
  const res = { id: job.id, run: job.run || 'themes', area: job.area, screen: job.screen, device: job.device, mode: job.mode, theme: job.theme, profile: job.profile, variant: job.variant, themeRow, points: [], known: job.known || [] };
  try {
    await s.go(t); await t.settle(); if (s.after) await s.after(t);
    await sleep(500);
    if (job.preScroll) { await d.page.evaluate(([s, y]) => { document.querySelector(s).scrollTop = y; }, [job.preScroll.sel, job.preScroll.top]); await sleep(400); }
    const page = d.page; const app = page.frames().find(f => /\/apps\/[^/]+\.html/.test(f.url()) && f !== page.mainFrame());
    res.meta = { page: await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() })) };
    if (app) res.meta.frame = await app.evaluate(() => ({ url: location.pathname, theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() })).catch(e => ({ err: e.message }));
    for (const p of job.probes) {
      const doc = p.doc === 'page' ? page.mainFrame() : app;
      if (!doc) { res.points.push({ probe: p.sel, error: 'no frame' }); continue; }
      const items = await doc.evaluate(docProbe, p).catch(e => [{ error: e.message }]);
      await sleep(250);
      const again = await doc.evaluate(docProbe, p).catch(() => items);   // after any scrollIntoView
      const off = p.doc === 'page' ? { x: 0, y: 0, sx: 1, op: 1 } : await frameOrigin(page);
      if (!again.length) { res.points.push({ probe: p.sel, doc: p.doc, error: 'not found' }); continue; }
      if (p.kind === 'text') {
        await setHidden(page, true);
        const img = decodePNG(await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
        await setHidden(page, false);
        for (const it of again) {
          if (it.error) { res.points.push({ probe: p.sel, error: it.error }); continue; }
          const a = it.color[3] * it.op; const ratios = []; const bgs = [];
          for (const r of it.rects) for (let y = Math.floor(r.y * off.sx + off.y); y < Math.ceil((r.y + r.h) * off.sx + off.y); y++) for (let x = Math.floor(r.x * off.sx + off.x); x < Math.ceil((r.x + r.w) * off.sx + off.x); x++) {
            if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
            const bg = img.px(x, y); const fg = [0, 1, 2].map(i => it.color[i] * a + bg[i] * (1 - a)); ratios.push(cr(fg, bg)); bgs.push(bg);
          }
          // hit test: the page's topmost element at the text centre must be the iframe (frame text) or the element's own subtree
          const r0 = it.rects[0];
          const hit = r0 ? await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id ? e.tagName.toLowerCase() + '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.')) : null; }, [r0.x * off.sx + off.x + Math.min(r0.w, 20) / 2, r0.y * off.sx + off.y + r0.h / 2]) : null;
          const hits = []; for (const r of it.rects) for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) hits.push(await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '') : null; }, [r.x * off.sx + off.x + r.w * fx, r.y * off.sx + off.y + r.h / 2]));
          const large = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700);
          res.points.push({ kind: 'text', probe: p.sel, doc: p.doc, text: it.text, fs: it.fs, fw: it.fw, color: hex(it.color), alpha: +a.toFixed(3), frameOp: off.op,
            pageRect: r0 ? { x: +(r0.x * off.sx + off.x).toFixed(1), y: +(r0.y * off.sx + off.y).toFixed(1), w: +r0.w.toFixed(1), h: +r0.h.toFixed(1) } : null, off,
            n: ratios.length, p10: ratios.length ? +q(ratios, 0.1).toFixed(2) : null, med: ratios.length ? +q(ratios, 0.5).toFixed(2) : null, bgMed: bgs.length ? hex(medC(bgs)) : null,
            req: large ? 3 : 4.5, hit, hits: [...new Set(hits)] });
        }
      } else {
        const img = decodePNG(await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
        for (const it of again) {
          if (it.error) { res.points.push({ probe: p.sel, error: it.error }); continue; }
          const A = p.a.computed ? (it.computed ? (() => { const bgB = patch(img, p.b, it.box, off); const al = it.computed[3]; return [0, 1, 2].map(i => it.computed[i] * al + bgB[i] * (1 - al)); })() : null) : patch(img, p.a, it.box, off);
          const B = patch(img, p.b, it.box, off);
          res.points.push({ kind: 'nontext', probe: p.sel, label: p.label, doc: p.doc, cls: String(it.cls), a: A && hex(A), b: hex(B), computed: it.computed, ratio: A ? +cr(A, B).toFixed(2) : null,
            box: { x: +(it.box.l * off.sx + off.x).toFixed(1), y: +(it.box.t * off.sx + off.y).toFixed(1), w: +it.box.W.toFixed(1), h: +it.box.H.toFixed(1) } });
        }
      }
    }
    await d.page.screenshot({ path: path.join(OUT, `rigcheck-1-${job.id}.png`), scale: 'css', animations: 'disabled', caret: 'hide' }).catch(() => {});
  } catch (e) { res.error = String(e.message || e).split('\n')[0]; }
  await d.close();
  return res;
}

// ── compare with the rig's raw file for the same job ────────────────────────────────────────────────────────────────
function rawFor(job) {
  const mode = job.theme === 'hearth' ? 'dark' : job.mode;
  const f = path.join(RAW, job.run || 'themes', job.area, `${job.screen}-typical-${job.device}-${mode}-${job.theme}.json`);
  return fs.existsSync(f) ? { file: path.relative(ROOT, f).replace(/\\/g, '/'), j: JSON.parse(fs.readFileSync(f, 'utf8')) } : null;
}
function compare(res) {
  const raw = rawFor(res); if (!raw) return { rawFile: null };
  const j = raw.j; const docName = p => p.doc === 'page' ? 'page' : 'frame:' + res.area.replace(/^shell$/, 'x');
  const out = { rawFile: raw.file, rawMeta: j.docs.map(d => ({ doc: d.name || d.doc, theme: d.meta.theme, scheme: d.meta.scheme, bg: d.tokens && d.tokens.design && d.tokens.design['--bg'] && d.tokens.design['--bg'].raw, offset: d.offset })), rows: [] };
  for (const p of res.points) {
    if (p.kind === 'text') {
      const want = p.doc === 'page' ? 'page' : 'frame:';
      const cands = j.text.filter(t => (p.doc === 'page' ? t.doc === 'page' : t.doc.startsWith('frame:')) && t.text && p.text && t.text.slice(0, 25) === p.text.slice(0, 25) && Math.abs(t.fs - p.fs) < 0.6);
      const m = cands.filter(t => t.measured);
      const best = m.length ? m.reduce((a, b) => (Math.abs(a.p10 - p.p10) < Math.abs(b.p10 - p.p10) ? a : b)) : null;
      const worst = m.length ? Math.min(...m.map(t => t.p10)) : null;
      out.rows.push({ kind: 'text', text: p.text, doc: p.doc, fs: p.fs, mine: { p10: p.p10, med: p.med, bg: p.bgMed, color: p.color, alpha: p.alpha, rect: p.pageRect, hit: p.hit },
        rig: best ? { p10: best.p10, med: best.med, bgMed: best.bgMed && hex(best.bgMed), color: hex(best.color), alpha: best.alpha, rect: best.rect, step: best.step, sel: best.sel, nCand: m.length, minP10: worst, aa: best.aa } : (cands.length ? { unmeasured: cands.length } : null),
        dP10: best ? +(p.p10 - best.p10).toFixed(2) : null, dMed: best ? +(p.med - best.med).toFixed(2) : null,
        dRect: best && p.pageRect && best.step === 0 ? { dx: +(p.pageRect.x - best.rect.x).toFixed(1), dy: +(p.pageRect.y - best.rect.y).toFixed(1) } : null });
    } else if (p.kind === 'nontext') {
      const selKey = p.probe.split(' ').pop().replace(/:not\([^)]*\)/g, '').replace(/\[.*?\]/g, '');
      const ctl = (j.nontext.controls || []).filter(c => c.doc.startsWith('frame:') && c.sel.includes(selKey.split('.')[0].replace(/^#/, '#')));
      const near = ctl.filter(c => p.box && Math.abs(c.rect.x - p.box.x) < 3 && Math.abs(c.rect.y - p.box.y) < 3);
      out.rows.push({ kind: 'nontext', label: p.label, mine: { ratio: p.ratio, a: p.a, b: p.b, box: p.box }, rig: near.length ? near.map(c => ({ sel: c.sel, fillRatio: c.fillRatio, boundary: c.boundary, borderRatio: c.borderRatio, innerMed: hex(c.innerMed), outerMed: hex(c.outerMed), rect: c.rect, hasText: c.hasText })) : (ctl.length ? { sameSelNotSameBox: ctl.length, first: { sel: ctl[0].sel, fillRatio: ctl[0].fillRatio, rect: ctl[0].rect } } : 'NOT IN DATASET') });
    }
  }
  return out;
}

// ── aggregate checks (recount from raw) ──────────────────────────────────────────────────────────────────────────────
function aggCheck() {
  const out = { files: {}, recount: {} };
  const cov = JSON.parse(fs.readFileSync(path.join(AGG, 'coverage.json'), 'utf8'));
  for (const run of ['themes', 'devices', 'states']) {
    out.files[run] = {};
    for (const a of fs.readdirSync(path.join(RAW, run))) out.files[run][a] = { onDisk: fs.readdirSync(path.join(RAW, run, a)).filter(f => f.endsWith('.json')).length, coverageOk: cov.runs[run].byArea[a] && cov.runs[run].byArea[a].ok };
  }
  // recompute pairs/<area>.json totals and failing-pairs totals for three small areas, all runs
  const keyOf = j => j.theme === 'system' ? 'system-' + j.mode : j.theme === 'hearth' ? 'hearth-dark' : j.theme;
  const own = (area, doc) => (area === 'shell' || area === 'tv') ? doc === 'page' : doc.startsWith('frame:');
  for (const area of ['tally', 'kidverse', 'verses', 'timer']) {
    const pairs = JSON.parse(fs.readFileSync(path.join(AGG, 'pairs', area + '.json'), 'utf8'));
    const agg = {}; const fails = {};
    for (const run of ['themes', 'devices', 'states']) {
      const dir = path.join(RAW, run, area); if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); const k = keyOf(j);
        for (const t of j.text) { if (!t.measured || t.p10 == null) continue; agg[k] = agg[k] || { occ: 0, occAll: 0, fail: 0, failOwn: 0, min: 99 }; agg[k].occAll++; if (own(area, t.doc)) agg[k].occ++; if (!t.aa) { agg[k].fail++; if (own(area, t.doc)) agg[k].failOwn++; } agg[k].min = Math.min(agg[k].min, t.p10); }
      }
    }
    out.recount[area] = {};
    for (const k of Object.keys(agg)) {
      const rows = pairs[k] || []; const n = rows.reduce((s, r) => s + r.n, 0), fl = rows.reduce((s, r) => s + r.fail, 0), mn = Math.min(...rows.map(r => r.minP10));
      out.recount[area][k] = { raw: agg[k], pairsFile: { n, fail: fl, minP10: mn } };
    }
  }
  return out;
}

async function main() {
  const report = { script: 'audits/tools/phase4/rigcheck-1.mjs', at: new Date().toISOString(), jobs: [] };
  if (argv.includes('--agg')) { report.agg = aggCheck(); }
  const jobs = JOBS.filter(j => !ONLY || ONLY.includes(j.id));
  if (jobs.length && !argv.includes('--agg-only')) {
    const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
    try {
      for (const job of jobs) {
        const t0 = Date.now();
        const res = await runJob(L, job);
        res.ms = Date.now() - t0; res.cmp = compare(res);
        report.jobs.push(res);
        console.log(`${job.id} ${job.file}/${job.screen} ${job.theme}-${job.mode}: ${res.error || 'ok'} ${res.points.length} points ${res.ms} ms`);
        for (const r of res.cmp.rows || []) console.log('   ', r.kind === 'text' ? `${(r.text || '').slice(0, 26).padEnd(26)} mine ${r.mine.p10}/${r.mine.med} rig ${r.rig ? (r.rig.p10 ?? JSON.stringify(r.rig)) + '/' + (r.rig.med ?? '') : 'none'} d=${r.dP10} rect ${JSON.stringify(r.dRect)} hit ${r.mine.hit}` : `${r.label}: mine ${r.mine.ratio} (${r.mine.a} vs ${r.mine.b}) rig ${JSON.stringify(r.rig).slice(0, 200)}`);
      }
    } finally { await L.close(); }
  }
  const f = path.join(OUT, ONLY ? `rigcheck-1-${ONLY.join('_')}.json` : 'rigcheck-1.json');
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  console.log('wrote', path.relative(ROOT, f));
}
main().catch(e => { console.error(e); process.exit(1); });
