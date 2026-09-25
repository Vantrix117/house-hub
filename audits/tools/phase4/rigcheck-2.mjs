// Phase 4, independent rig check (round 2). Re-measures data points of the measurement rig (measure.mjs, rig v2)
// WITHOUT its code: its own navigation on lib/local.mjs, its own screenshot decoding (a small PNG decoder over zlib),
// its own text hiding, line-box location, pixel sampling and contrast maths, and its own frame offsets (the iframe's
// border box from Playwright plus clientLeft/Top, cross-checked against Playwright's main-frame bounding boxes).
// The rig's raw JSON is read only as data: to pick which texts to re-measure and to compare with.
//
//   node audits/tools/phase4/rigcheck-2.mjs measure [--only i,j]   → audits/evidence/p4/rigcheck/rigcheck-2-measure.json
//   node audits/tools/phase4/rigcheck-2.mjs agg                    → audits/evidence/p4/rigcheck/rigcheck-2-agg.json
//
// Nothing here writes app data except the theme rows (PUT /api/data/hub/theme as the profile) on a freshly reset local
// database, as the brief prescribes; one job taps Show in Verses. Production is never contacted (lib/local.mjs blocks it).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, sleep, ROOT } from '../lib/local.mjs';

const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const SUM = path.join(ROOT, 'audits/evidence/p4/measure');
const OUT = path.join(ROOT, 'audits/evidence/p4/rigcheck');
fs.mkdirSync(OUT, { recursive: true });

// ── colour maths ─────────────────────────────────────────────────────────────────────────────────────────────────
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { if (!a || !b) return NaN; const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const blend = (fg, a, bg) => [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1) + 0.5)))]; };
const medRgb = px => px.length ? [0, 1, 2].map(i => pct(px.map(p => p[i]), 0.5)) : null;
const r2 = x => x == null ? null : Math.round(x * 100) / 100;
function parseColor(s) {
  if (!s || s === 'transparent' || s === 'none') return null;
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  m = s.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  return 'unparsed:' + s;
}

// ── PNG decoding (8-bit, non-interlaced; what Playwright writes) ─────────────────────────────────────────────────
function decodePNG(buf) {
  let p = 8, w, h, bd, ct; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12]) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('bit depth ' + bd);
  const ch = { 6: 4, 2: 3, 0: 1, 4: 2 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++]; const line = Buffer.from(raw.subarray(q, q + stride)); q += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (ch >= 3) { out[o] = line[i]; out[o + 1] = line[i + 1]; out[o + 2] = line[i + 2]; } else { out[o] = out[o + 1] = out[o + 2] = line[i]; }
      out[o + 3] = 255;
    }
    prev = line;
  }
  return { w, h, at(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= w || y >= h) return null; const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2]]; } };
}
// pixels inside a rect (inset), every pixel centre
function region(img, r, inset = 1) {
  const px = [];
  for (let y = Math.ceil(r.y + inset); y < r.y + r.h - inset; y++) for (let x = Math.ceil(r.x + inset); x < r.x + r.w - inset; x++) { const c = img.at(x, y); if (c) px.push(c); }
  return px;
}
// a band of pixels d1..d2 px outside a rect (all four sides)
function outside(img, r, d1, d2) {
  const px = [];
  for (let d = d1; d <= d2; d++) {
    for (let x = Math.ceil(r.x); x < r.x + r.w; x++) { const a = img.at(x, r.y - d), b = img.at(x, r.y + r.h - 1 + d); if (a) px.push(a); if (b) px.push(b); }
    for (let y = Math.ceil(r.y); y < r.y + r.h; y++) { const a = img.at(r.x - d, y), b = img.at(r.x + r.w - 1 + d, y); if (a) px.push(a); if (b) px.push(b); }
  }
  return px;
}

async function shoot(page, name) {
  const buf = await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
  if (name) fs.writeFileSync(path.join(SCRATCH, name + '.png'), buf);
  return decodePNG(buf);
}
const SCRATCH = path.join(process.env.LOCALAPPDATA || '', 'Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/ead87424-01af-4f71-ad5e-f00aad581d0b/scratchpad/p4/rc2');
fs.mkdirSync(SCRATCH, { recursive: true });

// ── in-page helpers (evaluated in the page or a frame) ───────────────────────────────────────────────────────────
const HIDE_CSS = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}';
async function allFrames(page, fn, arg) { for (const f of page.frames()) await f.evaluate(fn, arg).catch(() => {}); }
const hideText = page => allFrames(page, css => { let s = document.getElementById('rc2-hide'); if (!s) { s = document.createElement('style'); s.id = 'rc2-hide'; (document.head || document.documentElement).appendChild(s); } s.textContent = css; }, HIDE_CSS);
const showText = page => allFrames(page, () => { const s = document.getElementById('rc2-hide'); if (s) s.remove(); });

// locate a text element: the rig's selector string (read as data) plus its text; returns its first text line box
function locateText({ sel, text, scroll }) {
  let els = [];
  try { els = [...document.querySelectorAll(sel)]; } catch (e) { return { err: 'bad selector' }; }
  const want = (text || '').replace(/\s+/g, ' ').trim();
  const own = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
  const cand = els.filter(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return (el.value || el.placeholder || '').startsWith(want.slice(0, 20));
    const t = own(el).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    return want ? t.startsWith(want.slice(0, Math.min(20, want.length))) : !!t;
  });
  const el = cand[0];
  if (!el) return { err: 'not found', n: els.length };
  if (scroll) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  let rect;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { const b = el.getBoundingClientRect(); rect = { x: b.x, y: b.y, w: b.width, h: b.height }; }
  else {
    const n = own(el)[0]; const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
    const r = rs[0]; rect = { x: r.x, y: r.y, w: r.width, h: r.height }; var allRects = rs.map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
  }
  const cs = getComputedStyle(el);
  let op = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity) || 0;
  // uncovered? hit-test 5 points across the line box
  let hits = 0, tot = 0;
  for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const x = rect.x + rect.w * fx, y = rect.y + rect.h * 0.5; tot++;
    const h = document.elementFromPoint(x, y); if (h && (h === el || el.contains(h) || h.contains(el))) hits++;
  }
  return { rect, allRects: typeof allRects === 'undefined' ? [rect] : allRects, color: cs.color, op, fs: parseFloat(cs.fontSize), fw: cs.fontWeight, hit: hits / tot, n: cand.length, scrollY: scrollY };
}
function docMeta() {
  const r = document.documentElement, cs = getComputedStyle(r);
  let ls = null; try { ls = localStorage.getItem('hub.theme'); } catch {}
  return { theme: r.dataset.theme || null, scheme: r.dataset.scheme || null, kind: r.dataset.kind || null, bg: cs.getPropertyValue('--bg').trim(), lsTheme: ls, hubTheme: window.hub && hub.theme ? hub.theme() : null };
}

async function frameOffset(page, frame) {
  if (frame === page.mainFrame()) return { x: 0, y: 0, scale: 1 };
  const el = await frame.frameElement();
  const box = await el.boundingBox();
  const ins = await el.evaluate(e => { const cs = getComputedStyle(e); return { l: e.clientLeft + parseFloat(cs.paddingLeft), t: e.clientTop + parseFloat(cs.paddingTop), cw: e.clientWidth, ow: e.offsetWidth }; });
  return { x: box.x + ins.l, y: box.y + ins.t, scale: ins.ow ? box.width / ins.ow : 1, box };
}

// ── rig raw lookup (data only) ───────────────────────────────────────────────────────────────────────────────────
function rigFile(run, area, screen, state, device, mode, theme) { return path.join(RAW, run, area, `${screen}-${state}-${device}-${mode}-${theme}.json`); }
function loadRig(job) { const f = rigFile(job.run || 'themes', job.area, job.screen, 'typical', job.device, job.mode, job.theme); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
// pick texts from the rig's own list: in the given doc, measured, fully uncovered; lowest p10 first, then a spread
function pickTexts(rig, doc, n, filter = () => true) {
  const all = rig.text.filter(t => t.doc === doc && t.measured && t.kind === 'text' && (t.cover || 0) === 0 && t.rect && t.rect.w > 4 && t.text && t.text.trim().length >= 1 && filter(t));
  const seen = new Set(); const uniq = all.filter(t => { const k = t.sel + '|' + t.text; if (seen.has(k)) return false; seen.add(k); return true; });
  const byP = [...uniq].sort((a, b) => a.p10 - b.p10);
  const pick = byP.slice(0, Math.ceil(n / 2));
  const rest = byP.slice(Math.ceil(n / 2)); const step = Math.max(1, Math.floor(rest.length / Math.max(1, n - pick.length)));
  for (let i = step - 1; pick.length < n && i < rest.length; i += step) pick.push(rest[i]);
  return pick;
}

// ── jobs ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const shellHome = async d => {
  await d.goto('#home');
  await d.page.waitForSelector('#view-home .home-hero', { timeout: 8000 }).catch(() => {});
  await d.page.waitForFunction(() => !!(window.hub && hub.sync && hub.sync.lastPull), null, { timeout: 8000 }).catch(() => {});
  await d.page.waitForFunction(() => { const f = document.querySelector('#feed'); return !f || (f.children.length && !f.querySelector('.skeleton')); }, null, { timeout: 5000 }).catch(() => {});
  await sleep(600);
};
const openApp = (id, wait, extra) => async d => {
  const f = await d.openApp(id, { wait });
  if (extra) await extra(d, f);
  await sleep(1500);
  return f;
};
const JOBS = [
  { area: 'shell', screen: 'home', profile: 'eli', mode: 'dark', theme: 'system', nav: shellHome, texts: { page: 6 }, known: [{ what: 'P2-VIS-06 dark Home hero kicker', text: 'hero-kicker', lo: 1.50, hi: 3.41, sel: 'div.hero-kicker' }], probes: [{ kind: 'icon', doc: 'page', sel: 'button.tab[data-tab="apps"] > svg.icon' }, { kind: 'stroke', doc: 'page', sel: 'span.ringwrap.lg > svg.ring.ring-lg > circle.bg', scroll: true }] },
  { area: 'shell', screen: 'home', profile: 'eli', mode: 'light', theme: 'parchment', nav: shellHome, texts: { page: 5 }, probes: [{ kind: 'icon', doc: 'page', sel: 'button.tab[data-tab="chat"] > svg.icon' }] },
  { area: 'shell', screen: 'home-kid', profile: 'ezra', mode: 'light', theme: 'forest', nav: shellHome, texts: { page: 4 } },
  { area: 'shell', screen: 'apps', profile: 'eli', mode: 'light', theme: 'frost', nav: async d => { await d.goto('#apps'); await d.page.waitForSelector('#grid .tile', { timeout: 6000 }).catch(() => {}); await sleep(900); }, texts: { page: 4 } },
  { area: 'f260', screen: 'today', profile: 'eli', mode: 'dark', theme: 'hearth', nav: openApp('f260', '#todayTitle:not(:empty)'), texts: { frame: 4 }, known: [{ what: 'P2-VIS-03 F260 Done, Hearth on a dark OS', exact: 2.02, textRe: /^Done/ }] },
  { area: 'f260', screen: 'today', profile: 'eli', mode: 'light', theme: 'midnight', nav: openApp('f260', '#todayTitle:not(:empty)'), texts: { frame: 4, page: 1 }, probes: [{ kind: 'box', doc: 'frame', sel: '.ygrid button:not(.done):not(.part):not(.cur)', rigSelEq: 'div#ygrid.ygrid > button', known: { what: 'VIS-F260-2 empty year cell, Midnight', exact: 1.04 }, scroll: true }] },
  { area: 'leftovers', screen: 'main', profile: 'eli', mode: 'light', theme: 'system', nav: openApp('leftovers', '#tally:not(:empty)', async (d, f) => { await f.waitForSelector('.item', { timeout: 6000 }).catch(() => {}); }), texts: { frame: 4 }, probes: [{ kind: 'bar', doc: 'frame', sel: '.bar > i', pickWarn: true, known: { what: 'VIS-LEFTOVERS-2 warn bar vs track, Hearth', exact: 2.69 } }] },
  { area: 'leftovers', screen: 'main', profile: 'eli', mode: 'dark', theme: 'system', nav: openApp('leftovers', '#tally:not(:empty)', async (d, f) => { await f.waitForSelector('.item', { timeout: 6000 }).catch(() => {}); }), texts: { frame: 4 }, probes: [{ kind: 'box', doc: 'frame', sel: '.status', known: { what: 'VIS-LEFTOVERS-3 dark chip fill vs card', lo: 1.01, hi: 1.08 } }], known: [{ what: 'P2/VIS-LEFTOVERS chip text dark 8.9-10.3', selRe: /chip/, lo: 8.9, hi: 10.35 }] },
  { area: 'prayer', screen: 'today', profile: 'eli', mode: 'light', theme: 'parchment', nav: openApp('prayer', '#todayLine:not(:empty)'), texts: { frame: 5 } },
  { area: 'tally', screen: 'main', profile: 'eli', mode: 'light', theme: 'midnight', nav: openApp('tally', '.dial', async (d, f) => { await f.waitForFunction(() => { const w = document.getElementById('who'); return w && w.textContent.trim(); }, null, { timeout: 6000 }).catch(() => {}); }), texts: { frame: 3 }, probes: [{ kind: 'box', doc: 'frame', sel: '#minus', inset: 4, known: { what: 'VIS-TALLY-1 minus disc vs wash, Midnight', lo: 1.13, hi: 1.45 } }, { kind: 'box', doc: 'frame', sel: '#plus', inset: 4, known: { what: 'VIS-TALLY-1 plus disc vs wash, dark', lo: 1.17, hi: 1.62 } }] },
  { area: 'timer', screen: 'idle', profile: 'eli', mode: 'light', theme: 'system', nav: openApp('timer', '#go'), texts: { frame: 3 }, probes: [{ kind: 'stroke', doc: 'frame', sel: '#dial .ring circle.bg', hideSel: '#dial .ring circle.fg', known: { what: 'VIS-TIMER-7 dial track, Hearth', exact: 1.39 } }] },
  { area: 'timer', screen: 'idle', profile: 'eli', mode: 'dark', theme: 'system', nav: openApp('timer', '#go'), texts: { frame: 3 }, probes: [{ kind: 'stroke', doc: 'frame', sel: '#dial .ring circle.bg', hideSel: '#dial .ring circle.fg', known: { what: 'VIS-TIMER-7 dial track, dark', exact: 1.2 } }] },
  { area: 'kidverse', screen: 'kid', profile: 'ezra', mode: 'light', theme: 'system', nav: openApp('kidverse', null, async (d, f) => { await f.waitForFunction(() => { const r = document.querySelector('#ref'); return r && r.textContent.trim() && r.textContent.trim() !== '…'; }, null, { timeout: 8000 }).catch(() => {}); await f.waitForSelector('#rewards:not([hidden])', { timeout: 5000 }).catch(() => {}); }), texts: { frame: 4 }, known: [{ what: 'VIS-KIDVERSE-1 day letters, Hearth', selRe: /div\.days > span/, lo: 2.08, hi: 2.30 }], probes: [{ kind: 'ring', doc: 'frame', sel: '.days span.today', scroll: true, known: { what: 'Kid Verse today ring, light', exact: 1.70 } }] },
  { area: 'kidverse', screen: 'kid', profile: 'ezra', mode: 'dark', theme: 'system', nav: openApp('kidverse', null, async (d, f) => { await f.waitForFunction(() => { const r = document.querySelector('#ref'); return r && r.textContent.trim() && r.textContent.trim() !== '…'; }, null, { timeout: 8000 }).catch(() => {}); await f.waitForSelector('#rewards:not([hidden])', { timeout: 5000 }).catch(() => {}); }), texts: { frame: 3 }, probes: [{ kind: 'ring', doc: 'frame', sel: '.days span.today', scroll: true, known: { what: 'Kid Verse today ring, dark', exact: 1.51 } }] },
  { area: 'verses', screen: 'revealed', profile: 'eli', mode: 'light', theme: 'system', nav: openApp('verses', null, async (d, f) => { await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 8000 }).catch(() => {}); if (await f.locator('#show').first().isVisible().catch(() => false)) await f.locator('#show').first().tap().catch(() => f.locator('#show').first().click()); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 }).catch(() => {}); }), texts: { frame: 4 }, known: [{ what: 'VIS-VERSES-3 Got it, Hearth', textRe: /^Got it/, exact: 4.4 }] },
  { area: 'dollywood', screen: 'map', profile: 'eli', mode: 'light', theme: 'forest', nav: openApp('dollywood', '#chips button', async (d, f) => { await f.waitForSelector('#map .mk', { state: 'attached', timeout: 12000 }).catch(() => {}); await sleep(1500); }), texts: { frame: 5 } },
  { area: 'dollywood-live', screen: 'map', profile: 'eli', mode: 'dark', theme: 'system', variant: 'park', nav: openApp('dollywood-live', null, async (d, f) => { await f.waitForSelector('#lv-pill[data-state]', { timeout: 12000 }).catch(() => {}); await f.waitForFunction(() => document.querySelectorAll('#fam .famk').length > 0 || !document.getElementById('lv-meet').hidden || document.querySelector('#kid-list .lv-kid'), null, { timeout: 5000 }).catch(() => {}); await sleep(1500); }), texts: { frame: 5 } },
  { run: 'devices', area: 'leftovers', screen: 'main', profile: 'eli', device: 'desktop', mode: 'light', theme: 'system', nav: openApp('leftovers', '#tally:not(:empty)', async (d, f) => { await f.waitForSelector('.item', { timeout: 6000 }).catch(() => {}); }), texts: { frame: 4, page: 1 } },
  { run: 'devices', area: 'f260', screen: 'today', profile: 'eli', device: 'iphone-pwa', mode: 'dark', theme: 'system', nav: openApp('f260', '#todayTitle:not(:empty)'), texts: { frame: 4, page: 1 } },
  { run: 'devices', area: 'prayer', screen: 'today', profile: 'eli', device: 'ipad-landscape', mode: 'dark', theme: 'system', nav: openApp('prayer', '#todayLine:not(:empty)'), texts: { frame: 4 } },
  { run: 'devices', area: 'shell', screen: 'home', profile: 'eli', device: 'iphone-pwa', mode: 'dark', theme: 'system', nav: shellHome, texts: { page: 3 } },
  { area: 'tv', screen: 'board', profile: 'tv', device: 'tv', mode: 'dark', theme: 'system', nav: async d => { await d.goto('#home'); await d.page.waitForSelector('#tv #clock:not(:empty)', { timeout: 8000 }).catch(() => {}); await sleep(2500); }, texts: { page: 5 } },
];

async function measureText(page, frame, off, t, scroll) {
  const loc = await frame.evaluate(locateText, { sel: t.sel, text: t.text, scroll });
  if (!loc || loc.err) return { err: loc && loc.err };
  if (scroll) await sleep(250);
  const again = scroll ? await frame.evaluate(locateText, { sel: t.sel, text: t.text, scroll: false }) : loc;
  const r = { x: again.rect.x * off.scale + off.x, y: again.rect.y * off.scale + off.y, w: again.rect.w * off.scale, h: again.rect.h * off.scale };
  return { ...again, pageRect: r };
}
function contrastFromImg(img, r, color, op) {
  const fg = parseColor(color); if (!Array.isArray(fg)) return { err: 'color ' + color };
  const a = fg[3] * op;
  const bg = region(img, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, 1);
  if (!bg.length) return { err: 'no pixels' };
  const rs = bg.map(p => ratio(blend(fg, a, p), p));
  const full = region(img, r, 0).map(p => ratio(blend(fg, a, p), p));
  return { p10: r2(pct(rs, 0.1)), med: r2(pct(rs, 0.5)), n: bg.length, bgMed: medRgb(bg).map(Math.round), p10Full: r2(pct(full, 0.1)) };
}

async function runJob(L, job, idx) {
  const device = job.device || 'ipad-portrait';
  const rec = { idx, run: job.run || 'themes', area: job.area, screen: job.screen, device, mode: job.mode, theme: job.theme, profile: job.profile, texts: [], probes: [], known: [] };
  await L.reset(job.variant || 'typical');
  if (job.theme !== 'system' && job.profile !== 'tv') {
    const r = await L.apiAs(job.profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: job.theme } });
    rec.themeRow = r.status;
  }
  const d = await L.device({ device, mode: job.mode, profile: job.profile, localStorage: job.theme !== 'system' ? { 'hub.theme': JSON.stringify(job.theme) } : null });
  try {
    const f = await job.nav(d);
    const page = d.page;
    const frame = f || null;
    rec.meta = { page: await page.evaluate(docMeta) };
    if (frame) rec.meta.frame = await frame.evaluate(docMeta);
    const off = frame ? await frameOffset(page, frame) : null;
    rec.frameOffset = off;
    const rig = loadRig({ ...job, device });
    rec.rigFile = rig ? path.relative(ROOT, rigFile(job.run || 'themes', job.area, job.screen, 'typical', device, job.mode, job.theme)).replace(/\\/g, '/') : null;
    if (!rig) { rec.err = 'no rig file'; return rec; }
    const rigDocs = {}; for (const dd of rig.docs) rigDocs[dd.meta && dd.meta.url && dd.meta.url.includes('/apps/') ? 'frame' : 'page'] = dd;
    rec.rigMeta = { page: rigDocs.page && pickMeta(rigDocs.page.meta), frame: rigDocs.frame && pickMeta(rigDocs.frame.meta), frameOffset: rigDocs.frame && rigDocs.frame.offset };
    const frameDoc = rig.text.find(t => t.doc.startsWith('frame:'))?.doc || ('frame:' + job.area);
    // choose texts
    const chosen = [];
    if (job.texts.page) for (const t of pickTexts(rig, 'page', job.texts.page)) chosen.push({ where: 'page', t });
    if (job.texts.frame) for (const t of pickTexts(rig, frameDoc, job.texts.frame)) chosen.push({ where: 'frame', t });
    // known-value texts
    for (const k of job.known || []) {
      const doc = k.sel ? 'page' : frameDoc;
      const c = rig.text.filter(t => t.measured && (k.textRe ? k.textRe.test(t.text) : true) && (k.selRe ? k.selRe.test(t.sel) : true) && (k.sel ? t.sel.endsWith(k.sel) : true) && (k.sel ? t.doc === 'page' : true));
      for (const t of c.slice(0, 2)) { const ex = chosen.find(x => x.t === t); if (ex) ex.known = k; else chosen.push({ where: t.doc === 'page' ? 'page' : 'frame', t, known: k }); }
    }
    // step 0 texts are measured in place first (one hidden-text screenshot); scrolled ones one by one after
    const s0 = chosen.filter(c => (c.t.step || 0) === 0), sN = chosen.filter(c => (c.t.step || 0) !== 0);
    const locs = [];
    for (const c of s0) { const fr = c.where === 'page' ? page.mainFrame() : frame; const o = c.where === 'page' ? { x: 0, y: 0, scale: 1 } : off; locs.push({ c, loc: fr ? await measureText(page, fr, o, c.t, false) : { err: 'no frame' } }); }
    // Playwright's own main-frame box for the element, as an independent frame-offset check
    for (const l of locs) if (l.c.where === 'frame' && !l.loc.err) {
      const pb = await frame.evaluate(({ sel, text }) => { const els = [...document.querySelectorAll(sel)]; const i = els.findIndex(e => e.textContent.replace(/\s+/g, ' ').trim().startsWith((text || '').trim().slice(0, 12))); return i; }, { sel: l.c.t.sel, text: l.c.t.text }).catch(() => -1);
      if (pb >= 0) { const bb = await frame.locator(l.c.t.sel).nth(pb).boundingBox().catch(() => null); l.pwBox = bb; }
    }
    await hideText(page); await sleep(120);
    const img0 = await shoot(page, `job${idx}-s0-hidden`);
    await showText(page);
    for (const { c, loc, pwBox } of locs) rec.texts.push(textRow(c, loc, loc.err ? null : contrastFromImg(img0, loc.pageRect, loc.color, loc.op), pwBox));
    for (const c of sN) {
      const fr = c.where === 'page' ? page.mainFrame() : frame; const o = c.where === 'page' ? { x: 0, y: 0, scale: 1 } : off;
      const loc = await measureText(page, fr, o, c.t, true);
      let m = null;
      if (!loc.err) { await hideText(page); await sleep(120); const img = await shoot(page); await showText(page); m = contrastFromImg(img, loc.pageRect, loc.color, loc.op); }
      rec.texts.push(textRow(c, loc, m, null));
    }
    // graphics / icons / boxes
    for (const p of job.probes || []) rec.probes.push(await probe(page, p.doc === 'page' ? page.mainFrame() : frame, p.doc === 'page' ? { x: 0, y: 0, scale: 1 } : off, p, rig, p.doc === 'page' ? 'page' : frameDoc));
  } catch (e) { rec.err = String(e && e.stack || e).slice(0, 600); }
  finally { await d.close(); }
  return rec;
}
const pickMeta = m => m && ({ theme: m.theme, scheme: m.scheme, kind: m.kind, hubTheme: m.hubTheme, lsTheme: m.lsTheme, profile: m.profile && m.profile.id });
function textRow(c, loc, m, pwBox) {
  const t = c.t;
  const row = { where: c.where, sel: t.sel.slice(-90), text: t.text.slice(0, 40), rigStep: t.step, rig: { p10: t.p10, med: t.med, aa: t.aa, rect: t.rect, color: t.color, alpha: t.alpha, bgMed: t.bgMed }, known: c.known ? c.known.what : undefined };
  if (loc.err) { row.err = loc.err; return row; }
  row.mine = { p10: m && m.p10, med: m && m.med, p10Full: m && m.p10Full, rect: roundRect(loc.pageRect), color: loc.color, op: r2(loc.op), hit: loc.hit, bgMed: m && m.bgMed, err: m && m.err };
  row.req = (loc.fs >= 24 || (loc.fs >= 18.66 && +loc.fw >= 700)) ? 3 : 4.5;
  row.mine.aa = m && m.p10 != null ? m.p10 >= row.req : null;
  row.dP10 = m && m.p10 != null && t.p10 != null ? r2(m.p10 - t.p10) : null;
  row.dMed = m && m.med != null && t.med != null ? r2(m.med - t.med) : null;
  if ((t.step || 0) === 0 && t.rect) row.dRect = { x: r2(loc.pageRect.x - t.rect.x), y: r2(loc.pageRect.y - t.rect.y), w: r2(loc.pageRect.w - t.rect.w) };
  if (pwBox) row.pwBox = roundRect({ x: pwBox.x, y: pwBox.y, w: pwBox.width, h: pwBox.height });
  if (c.known) row.knownRange = c.known.exact != null ? [c.known.exact] : [c.known.lo, c.known.hi];
  return row;
}
const roundRect = r => r && ({ x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) });

async function probe(page, frame, off, p, rig, rigDoc) {
  const out = { kind: p.kind, sel: p.sel, known: p.known };
  if (!frame) return { ...out, err: 'no frame' };
  const info = await frame.evaluate(({ sel, scroll, pickWarn }) => {
    let els = [...document.querySelectorAll(sel)].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
    if (pickWarn) { // the amber (warn / "use it up soon") bar: pick the bar whose tint differs from the first and last
      const tints = els.map(e => getComputedStyle(e).getPropertyValue('--tint').trim() || getComputedStyle(e.closest('[style]') || e).getPropertyValue('--tint').trim());
      const withT = els.map((e, i) => ({ e, t: tints[i], w: e.getBoundingClientRect().width }));
      const warn = withT.find(x => /gold|warn/.test(x.t)) || withT.find(x => x.w > 20 && x.w < 180) || withT[0];
      els = warn ? [warn.e] : els;
    }
    const el = els[0]; if (!el) return null;
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const par = el.parentElement.getBoundingClientRect();
    let sw = null, R = null, cx = null, cy = null;
    if (el.tagName.toLowerCase() === 'circle') { const m = el.getScreenCTM(); const sc = Math.hypot(m.a, m.b); sw = parseFloat(cs.strokeWidth) * sc; R = el.r.baseVal.value * sc; cx = b.x + b.width / 2; cy = b.y + b.height / 2; }
    return { rect: { x: b.x, y: b.y, w: b.width, h: b.height }, parent: { x: par.x, y: par.y, w: par.width, h: par.height }, bg: cs.backgroundColor, bgImg: cs.backgroundImage, stroke: cs.stroke, shadow: cs.boxShadow, sw, R, cx, cy, cls: el.className && el.className.baseVal != null ? el.className.baseVal : el.className, tint: cs.getPropertyValue('--tint').trim() };
  }, { sel: p.sel, scroll: p.scroll, pickWarn: p.pickWarn });
  if (!info) return { ...out, err: 'not found' };
  await sleep(200);
  const tr = r => ({ x: r.x * off.scale + off.x, y: r.y * off.scale + off.y, w: r.w * off.scale, h: r.h * off.scale });
  const R = tr(info.rect);
  out.rect = roundRect(R); out.paint = { bg: info.bg, stroke: info.stroke, shadow: info.shadow, bgImg: info.bgImg && info.bgImg.slice(0, 80) };
  if (p.kind === 'icon') {
    const shown = await shoot(page);
    await frame.evaluate(sel => { const e = document.querySelector(sel); if (e) e.style.visibility = 'hidden'; }, p.sel);
    await sleep(100); const hidden = await shoot(page);
    await frame.evaluate(sel => { const e = document.querySelector(sel); if (e) e.style.visibility = ''; }, p.sel);
    const rs = [], ink = []; let tot = 0;
    for (let y = Math.ceil(R.y); y < R.y + R.h; y++) for (let x = Math.ceil(R.x); x < R.x + R.w; x++) { const a = shown.at(x, y), b = hidden.at(x, y); if (!a || !b) continue; tot++; if (Math.max(...[0, 1, 2].map(i => Math.abs(a[i] - b[i]))) > 24) { ink.push(a); rs.push(ratio(a, b)); } }
    out.mine = { p90: r2(pct(rs, 0.9)), med: r2(pct(rs, 0.5)), ink: r2(ink.length / Math.max(1, tot)) };
  } else {
    const img = await (async () => { if (p.hideSel) await frame.evaluate(s => { const e = document.querySelector(s); if (e) e.style.visibility = 'hidden'; }, p.hideSel); await sleep(100); const i = await shoot(page); if (p.hideSel) await frame.evaluate(s => { const e = document.querySelector(s); if (e) e.style.visibility = ''; }, p.hideSel); return i; })();
    if (p.kind === 'box') {
      const inner = medRgb(region(img, R, p.inset || 3)); const ring3 = medRgb(outside(img, R, 3, 4)); const ring6 = medRgb(outside(img, R, 6, 7));
      out.mine = { inner, out3: ring3, out6: ring6, ratio3: r2(ratio(inner, ring3)), ratio6: r2(ratio(inner, ring6)) };
    } else if (p.kind === 'ring') {
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2, rr = Math.min(R.w, R.h) / 2;
      const circ = rad => { const px = []; for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * Math.PI; const c = img.at(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); if (c) px.push(c); } return px; };
      const band = medRgb(circ(rr + 1.5)); const out5 = medRgb(circ(rr + 6)); const inner = medRgb(circ(rr - 4));
      out.mine = { band, out5, inner, ratio: r2(ratio(band, out5)), ratioInside: r2(ratio(band, inner)), innerVsOut: r2(ratio(inner, out5)) };
    } else if (p.kind === 'bar') {
      const all = await frame.evaluate(sel => [...document.querySelectorAll(sel)].map(e => { const b = e.getBoundingClientRect(), q = e.parentElement.getBoundingClientRect(); return { r: { x: b.x, y: b.y, w: b.width, h: b.height }, p: { x: q.x, y: q.y, w: q.width, h: q.height } }; }).filter(o => o.r.w > 0 && o.r.y > 0 && o.r.y < innerHeight), p.sel);
      out.bars = all.map(o => { const Rb = tr(o.r), Pb = tr(o.p); const fill = region(img, Rb, 1); const track = region(img, { x: Rb.x + Rb.w + 1, y: Pb.y, w: Math.max(0, Pb.x + Pb.w - (Rb.x + Rb.w) - 4), h: Pb.h }, 1); const tm = medRgb(track); const per = tm ? fill.map(px => ratio(px, tm)) : []; const fl = region(img, { x: Rb.x + Rb.w - 4, y: Rb.y, w: 3, h: Rb.h }, 1); return { rect: roundRect(Rb), trackMed: tm, medOverPixels: r2(pct(per, 0.5)), best: r2(pct(per, 1)), fillEnd: tm && fl.length ? r2(ratio(medRgb(fl), tm)) : null }; });
      const P = tr(info.parent); const fill = region(img, R, 1);
      const track = region(img, { x: R.x + R.w + 1, y: P.y, w: Math.max(0, P.x + P.w - (R.x + R.w) - 4), h: P.h }, 1);
      const trackMed = medRgb(track); const fillMed = medRgb(fill);
      const per = trackMed ? fill.map(px => ratio(px, trackMed)) : [];
      out.mine = { fillMed, trackMed, ratioMedians: trackMed && fillMed ? r2(ratio(fillMed, trackMed)) : null, ratioMedOverPixels: r2(pct(per, 0.5)), ratioBest: r2(pct(per, 1)), tint: info.tint, fillW: r2(R.w), trackW: r2(P.w), trackVsSurround: trackMed ? r2(ratio(trackMed, medRgb(outside(img, P, 3, 4)))) : null };
    } else if (p.kind === 'stroke') {
      const pts = (rad, n = 24) => { const px = []; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; const x = (info.cx + Math.cos(a) * rad) * off.scale + off.x, y = (info.cy + Math.sin(a) * rad) * off.scale + off.y; const c = img.at(x, y); if (c) px.push(c); } return px; };
      const band = medRgb(pts(info.R)); const o3 = medRgb(pts(info.R + info.sw / 2 + 3)); const o8 = medRgb(pts(info.R + info.sw / 2 + 8)); const i3 = medRgb(pts(info.R - info.sw / 2 - 3)); const i8 = medRgb(pts(info.R - info.sw / 2 - 8));
      const strokeC = parseColor(info.stroke);
      out.mine = { sw: r2(info.sw), R: r2(info.R), band, outer3: o3, outer8: o8, inner3: i3, inner8: i8, vsOuter3: r2(ratio(band, o3)), vsOuter8: r2(ratio(band, o8)), vsInner3: r2(ratio(band, i3)), vsInner8: r2(ratio(band, i8)), computedStroke: strokeC, computedVsInner8: Array.isArray(strokeC) ? r2(ratio(strokeC, i8)) : null };
    }
  }
  // the rig's record for the same element (data)
  const pools = [...(rig.nontext.graphics || []).map(g => ({ ...g, pool: 'graphics' })), ...(rig.nontext.controls || []).map(g => ({ ...g, pool: 'controls' })), ...(rig.nontext.icons || []).map(g => ({ ...g, pool: 'icons' }))];
  const tail = p.rigSel || p.sel.replace(/^#dial /, '').replace(/\[data-tab="(\w+)"\]/, '');
  const key = tail.split(/\s|>/).filter(Boolean).pop().replace(/:not\([^)]*\)/g, '');
  const cand = pools.filter(g => g.doc === rigDoc && g.sel && g.sel.includes(key.replace(/^\./, '').split('.')[0]));
  const near = cand.map(g => ({ g, dist: Math.hypot((g.rect?.x || 0) - R.x, (g.rect?.y || 0) - R.y) })).sort((a, b) => a.dist - b.dist).slice(0, 3);
  if (p.rigSelEq) out.rigAll = pools.filter(g => g.doc === rigDoc && g.sel === p.rigSelEq).map(g => ({ pool: g.pool, kind: g.kind, ratio: g.ratio, ratioMin: g.ratioMin, fillRatio: g.fillRatio, boundary: g.boundary, paint: g.paint, rect: g.rect })).slice(0, 4);
  if (p.kind === 'bar') out.rigBars = pools.filter(g => g.doc === rigDoc && g.kind === 'bar').map(g => ({ rect: g.rect, ratio: g.ratio, ratioBest: g.ratioBest, paintDark: g.paintDark, paintLight: g.paintLight }));
  out.rig = near.map(({ g, dist }) => ({ pool: g.pool, kind: g.kind, sel: g.sel.slice(-80), dist: r2(dist), ratio: g.ratio, ratioMin: g.ratioMin, ratioInside: g.ratioInside, vsTrack: g.vsTrack, trackVsSurround: g.trackVsSurround, fillRatio: g.fillRatio, boundary: g.boundary, per: g.per && Object.fromEntries(Object.entries(g.per).map(([k, v]) => [k, v.ratio])), paint: g.paint, rect: g.rect }));
  return out;
}

async function measureMain(only) {
  const results = [];
  const byVariant = {};
  JOBS.forEach((j, i) => { if (only && !only.includes(i)) return; (byVariant[j.variant || 'typical'] ||= []).push([j, i]); });
  for (const [variant, list] of Object.entries(byVariant)) {
    const L = await local({ variant, clock: 'demo', engine: 'webkit' });
    try {
      for (const [j, i] of list) { const t0 = Date.now(); const r = await runJob(L, j, i); r.ms = Date.now() - t0; results.push(r); console.log(`job ${i} ${j.area}/${j.screen} ${j.mode} ${j.theme}: texts ${r.texts.length} probes ${r.probes.length}${r.err ? ' ERR ' + r.err.slice(0, 200) : ''}`); }
    } finally { await L.close(); }
  }
  results.sort((a, b) => a.idx - b.idx);
  const file = path.join(OUT, only ? `rigcheck-2-measure-part-${only.join('_')}.json` : 'rigcheck-2-measure.json');
  fs.writeFileSync(file, JSON.stringify({ note: 'Independent re-measurement (rigcheck-2.mjs). texts[].mine = this script (p10/median of per-pixel ratio of the computed text colour × ancestor opacity blended over the hidden-text 1x screenshot, over the first own-text line box inset 1 px); rig = the raw file value. dRect = mine − rig (page coordinates). probes: box = rendered inner median vs 3-4 px / 6-7 px outside; ring = 1-2 px outside band vs 5-6 px outside; bar = fill pixels vs track median; stroke = 24 points on the circle band vs 3 px / 8 px outside and inside, track only (arc hidden); icon = p90 of ink pixels vs the same pixels with the icon hidden.', generatedAt: new Date().toISOString(), results }, null, 1));
  console.log('wrote', path.relative(ROOT, file));
}

// ── aggregate check: recount from raw and compare with the committed summaries ───────────────────────────────────
function aggMain() {
  const out = { note: "Recount from raw/ (rigcheck-2.mjs agg) compared with coverage.json, nontext.json and failing-pairs.json. Theme key: system-<mode>, hearth-dark, or the named theme." };
  const cov = JSON.parse(fs.readFileSync(path.join(SUM, "coverage.json"), "utf8"));
  const nt = JSON.parse(fs.readFileSync(path.join(SUM, "nontext.json"), "utf8"));
  const fp = JSON.parse(fs.readFileSync(path.join(SUM, "failing-pairs.json"), "utf8"));
  const counts = {}, stale = [], bad = [], theme = {}, failT = {}, nt2 = {}, mism = [];
  let files = 0;
  for (const run of fs.readdirSync(RAW).filter(r => !r.startsWith("_"))) for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) {
    if (!f.endsWith(".json")) continue; files++;
    const j = JSON.parse(fs.readFileSync(path.join(RAW, run, area, f), "utf8"));
    ((counts[run] ||= {})[area] ||= { files: 0, ok: 0 }).files++; if (j.ok) counts[run][area].ok++;
    if (j.v !== 2) stale.push(run + "/" + area + "/" + f); if (!j.ok) bad.push(run + "/" + area + "/" + f);
    const tk = j.theme === "system" ? "system-" + j.mode : j.theme === "hearth" ? "hearth-dark" : j.theme;
    const T = theme[tk] ||= { jobs: 0, pageOk: 0, frameOk: 0, frames: 0, bad: [] };
    T.jobs++;
    const want = j.theme === "system" || j.theme === "hearth" ? null : j.theme;
    const wantScheme = j.theme === "system" ? j.mode : j.theme === "hearth" ? "light" : ["midnight", "forest"].includes(j.theme) ? "dark" : "light";
    for (const d of j.docs || []) { const m = d.meta || {}; const isF = m.url && m.url.includes("/apps/"); const ok = (m.theme || null) === want && m.scheme === wantScheme && (m.hubTheme === (j.theme === "system" ? "system" : j.theme)); if (isF) { T.frames++; if (ok) T.frameOk++; } else if (ok) T.pageOk++; if (!ok && !/me-theme/.test(f)) T.bad.push(run + "/" + area + "/" + f + (isF ? " frame " : " page ") + JSON.stringify([m.theme, m.scheme, m.hubTheme])); }
    const FT = ((failT[area] ||= {})[tk] ||= { occurrences: 0, selectors: new Set(), measured: 0 });
    for (const t of j.text || []) if (t.measured) { FT.measured++; if (t.aa === false) { FT.occurrences++; FT.selectors.add(t.doc + "|" + t.sel + "|" + (t.color || []).slice(0, 3).join(",")); } }
    const N = nt2[area] ||= { icons: 0, iconFailSvg: 0, iconFailAll: 0, graphics: 0, graphicFail: 0, byKind: {}, failByKind: {}, controls: 0 };
    for (const g of (j.nontext && j.nontext.icons) || []) { N.icons++; if (g.pass === false) { N.iconFailAll++; if (g.kind === "svg") N.iconFailSvg++; } }
    for (const g of (j.nontext && j.nontext.graphics) || []) { N.graphics++; N.byKind[g.kind] = (N.byKind[g.kind] || 0) + 1; if (g.pass === false) { N.graphicFail++; N.failByKind[g.kind] = (N.failByKind[g.kind] || 0) + 1; } }
    N.controls += ((j.nontext && j.nontext.controls) || []).length;
  }
  out.files = files; out.stale = stale.length; out.notOk = bad;
  out.coverageVsRaw = {};
  for (const [r, v] of Object.entries(cov.runs)) for (const [a, x] of Object.entries(v.byArea)) { const raw = counts[r]?.[a] || { files: 0, ok: 0 }; out.coverageVsRaw[r + "/" + a] = { planned: x.planned, ok: x.ok, rawFiles: raw.files, rawOk: raw.ok }; if (x.ok !== raw.ok || x.planned !== raw.files) mism.push("coverage " + r + "/" + a); }
  out.themeApplied = Object.fromEntries(Object.entries(theme).map(([k, v]) => [k, { jobs: v.jobs, pageOk: v.pageOk, frames: v.frames, frameOk: v.frameOk, badNonMeTheme: v.bad.slice(0, 10), badCount: v.bad.length }]));
  out.failingText = {};
  for (const [a, byT] of Object.entries(failT)) for (const [tk, v] of Object.entries(byT)) {
    const s = fp.totals[a] && fp.totals[a][tk];
    out.failingText[a + "/" + tk] = { rawOccurrences: v.occurrences, sumOccurrences: s ? s.occurrences : 0, rawSelColour: v.selectors.size, sumSelectors: s ? s.selectors : 0, measured: v.measured };
    if ((s ? s.occurrences : 0) !== v.occurrences) mism.push("failing text " + a + "/" + tk + " raw " + v.occurrences + " vs summary " + (s ? s.occurrences : 0));
  }
  out.nontext = {};
  for (const [a, v] of Object.entries(nt2)) { const c = nt.areas[a] && nt.areas[a].counts || {}; out.nontext[a] = { raw: v, summary: { icons: c.icons, iconFail: c.iconFail, controls: c.controls, graphics: c.graphics, graphicFail: c.graphicFail, graphicsByKind: c.graphicsByKind, graphicFailByKind: c.graphicFailByKind } };
    for (const k of ["icons", "controls", "graphics", "graphicFail"]) if (c[k] !== v[k]) mism.push("nontext " + a + " " + k + " raw " + v[k] + " vs summary " + c[k]);
    if (c.iconFail !== v.iconFailSvg && c.iconFail !== v.iconFailAll) mism.push("nontext " + a + " iconFail raw svg " + v.iconFailSvg + " all " + v.iconFailAll + " vs summary " + c.iconFail); }
  out.mismatches = mism;
  fs.writeFileSync(path.join(OUT, "rigcheck-2-agg.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ files, stale: stale.length, notOk: bad.length, mismatches: mism }, null, 1));
}

// ── hero experiment: why the dark hero summary line's median differs from the rig's (time, art, hiding) ──────────
async function heroMain() {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const res = [];
  try {
    for (const device of ['ipad-portrait', 'iphone-pwa']) {
      await L.reset('typical');
      const d = await L.device({ device, mode: 'dark', profile: 'eli' });
      await shellHome(d);
      const page = d.page;
      const loc = await page.evaluate(locateText, { sel: 'div.hero-sub', text: 'a reading waiting' });
      const art = await page.evaluate(() => { const i = document.querySelector('.home-hero .hero-art img'); const b = i && i.getBoundingClientRect(); return i && { complete: i.complete, nw: i.naturalWidth, rect: { x: b.x, y: b.y, w: b.width, h: b.height } }; });
      const row = { device, rect: loc.rect, allRects: loc.allRects, art, samples: [] };
      for (const [label, fn] of [['hidden t0', null], ['hidden +2s', 2000], ['hidden +2s art hidden', 'art'], ['shown (text not hidden)', 'shown'], ['hidden, sub line hidden via visibility only', 'vis']]) {
        if (typeof fn === 'number') await sleep(fn);
        if (fn === 'art') await page.evaluate(() => { const i = document.querySelector('.home-hero .hero-art'); if (i) i.style.visibility = 'hidden'; });
        if (fn === 'shown') await page.evaluate(() => { const i = document.querySelector('.home-hero .hero-art'); if (i) i.style.visibility = ''; });
        if (fn === 'vis') { await page.evaluate(() => { document.querySelectorAll('.home-hero > div').forEach(e => { if (!e.classList.contains('hero-art')) e.style.visibility = 'hidden'; }); }); }
        if (fn !== 'shown' && fn !== 'vis') await hideText(page);
        await sleep(100);
        const img = await shoot(page, `hero-${device}-${label.replace(/\W+/g, '_')}`);
        await showText(page);
        const m = contrastFromImg(img, loc.rect, loc.color, loc.op);
        const all = loc.allRects.map(r => contrastFromImg(img, r, loc.color, loc.op));
        row.samples.push({ label, ...m, perLine: all.map(a => [a.p10, a.med]) });
      }
      res.push(row);
      await d.close();
    }
  } finally { await L.close(); }
  fs.writeFileSync(path.join(OUT, 'rigcheck-2-hero.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
}

const [cmd, ...rest] = process.argv.slice(2);
const oi = rest.indexOf('--only'); const only = oi >= 0 ? rest[oi + 1].split(',').map(Number) : null;
if (cmd === 'agg') aggMain();
else if (cmd === 'hero') await heroMain();
else await measureMain(only);
