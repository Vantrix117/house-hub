// Phase 2 VIS helpers: in-page measurement of text (type scale), rendered contrast, tap targets, radii nesting, glass
// layers and clipping, plus the navigation to each shell surface. Used by the other scripts in this folder.
// Nothing here writes app data except where a surface says so (none do): every surface only navigates and taps.
import fs from 'node:fs';
import path from 'node:path';
import { sleep } from '../../lib/local.mjs';

export const EVID = path.resolve('audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });

// ── in-page library (installed once per page as window.__vis) ───────────────────────────────────────────────────────
const PAGE_LIB = String.raw`
(() => {
  if (window.__vis) return;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  function rgba(s) {                       // any CSS colour → [r,g,b,a] (0-255, a 0-1), via the canvas
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], +(d[3] / 255).toFixed(3)];
  }
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (fg, a, bg) => [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
  const EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️⃣\s]+$/u;
  const GLASS = ['glass', 'glass-strong', 'btn-glass', 'pill', 'topbar', 'tabbar', 'sheet'];
  let seq = 0;
  function sel(el, depth = 3) {
    const parts = []; let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < depth; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id;
      const cl = [...e.classList].filter(c => !c.startsWith('vis-')).slice(0, 3); if (cl.length) s += '.' + cl.join('.');
      parts.unshift(s); if (e.id) break;
    }
    return parts.join(' > ');
  }
  function shown(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden) return false; } return true; }
  function opac(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; }
  function glassy(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if ((s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') || GLASS.some(c => e.classList.contains(c))) return true; } return false; }
  function family(ff) { const f = ff.split(',')[0].trim().replace(/"/g, ''); return f; }
  // every element that directly holds visible text, with its computed type and colour
  function texts(root = document.body) {
    const map = new Map(); const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|TITLE|OPTION|NOSCRIPT)$/.test(el.tagName) || el.closest('svg')) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter(q => q.width > 1 && q.height > 2);
      if (!rects.length || !shown(el)) continue;
      let it = map.get(el);
      if (!it) { it = { el, text: '', rects: [] }; map.set(el, it); }
      it.text += (it.text ? ' ' : '') + t; it.rects.push(...rects.map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height })));
    }
    const out = [];
    for (const it of map.values()) {
      if (EMOJI.test(it.text)) continue;
      const el = it.el, cs = getComputedStyle(el);
      if (!el.dataset.visId) el.dataset.visId = String(++seq);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      out.push({ id: el.dataset.visId, sel: sel(el), text: it.text.slice(0, 60), fs, fw, ff: family(cs.fontFamily), ffull: cs.fontFamily,
        lh: cs.lineHeight, ls: cs.letterSpacing, tt: cs.textTransform, color: rgba(cs.color), op: +opac(el).toFixed(3), glass: glassy(el),
        large: fs >= 24 || (fs >= 18.66 && fw >= 700), rects: it.rects });
    }
    return out;
  }
  // text items whose first line box is on screen and not covered by something else
  function onscreen(items) {
    const W = innerWidth, H = innerHeight;
    return items.filter(it => {
      const el = document.querySelector('[data-vis-id="' + it.id + '"]'); if (!el) return false;
      const r = it.rects[0]; if (r.x < 0 || r.y < 0 || r.x + r.w > W + 1 || r.y + r.h > H + 1) return false;
      const hit = document.elementFromPoint(r.x + Math.min(r.w, 40) / 2, r.y + r.h / 2);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    });
  }
  function refresh(items) {   // re-read rects after a scroll
    return items.map(it => { const el = document.querySelector('[data-vis-id="' + it.id + '"]'); if (!el) return it;
      const rects = []; for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { const r = document.createRange(); r.selectNodeContents(n); rects.push(...[...r.getClientRects()].filter(q => q.width > 1 && q.height > 2).map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height }))); }
      return rects.length ? { ...it, rects } : it; });
  }
  function hideText(on) {
    let s = document.getElementById('vis-hide');
    if (on && !s) { s = document.createElement('style'); s.id = 'vis-hide'; s.textContent = '*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}'; document.head.appendChild(s); }
    if (!on && s) s.remove();
  }
  // sample the text-hidden screenshot under each item's line boxes; contrast of the (opacity-composited) text colour
  async function sample(b64, items) {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const out = [];
    for (const it of items) {
      const cs = []; let bgs = [];
      for (const r of it.rects) {
        const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(c.width, Math.ceil(r.x + r.w)), y1 = Math.min(c.height, Math.ceil(r.y + r.h));
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const step = Math.max(1, Math.floor(Math.sqrt((x1 - x0) * (y1 - y0) / 400)));
        for (let y = 0; y < y1 - y0; y += step) for (let x = 0; x < x1 - x0; x += step) { const i = (y * (x1 - x0) + x) * 4; bgs.push([d[i], d[i + 1], d[i + 2]]); }
      }
      if (!bgs.length) continue;
      const a = it.color[3] * it.op;
      for (const bg of bgs) cs.push(ratio(blend(it.color, a, bg), bg));
      const order = cs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
      const p10 = order[Math.floor(order.length * 0.1)], med = order[Math.floor(order.length * 0.5)];
      out.push({ id: it.id, p10: +p10[0].toFixed(2), med: +med[0].toFixed(2), bgAtP10: bgs[p10[1]], bgMed: bgs[med[1]], alpha: +a.toFixed(3) });
    }
    return out;
  }
  function targets(kidMin) {
    const q = 'button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, [role=button], [role=switch], [data-open], [data-open-tab], label[for]';
    const out = []; const seen = new Set();
    for (const el of document.querySelectorAll(q)) {
      if (seen.has(el) || !shown(el)) continue; seen.add(el);
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      let w = r.width, h = r.height; const b = getComputedStyle(el, '::before');
      if (b && b.content && b.content !== 'none' && b.position === 'absolute' && el.classList.contains('switch')) h = Math.max(h, h + 12);   // .switch::before inset -6px 0
      out.push({ sel: sel(el), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 40), w: Math.round(w), h: Math.round(h), disabled: !!el.disabled });
    }
    return out;
  }
  function px(v) { return parseFloat(v) || 0; }
  function radii() {
    const out = []; const seen = new Set();
    const all = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') && shown(e));
    const painted = s => (rgba(s.backgroundColor)[3] > 0.05) || s.backgroundImage !== 'none' || px(s.borderTopWidth) > 0 || s.boxShadow !== 'none';
    for (const el of all) {
      const s = getComputedStyle(el); const r = px(s.borderTopLeftRadius); if (!r) continue;
      const b = el.getBoundingClientRect(); if (b.width < 8 || b.height < 8) continue;
      if (r >= Math.min(b.width, b.height) / 2 - 1) continue;              // circles and pills: their own rule
      if (!painted(s) && el.tagName !== 'IMG') continue;
      let a = el.parentElement, A = null;
      while (a && a !== document.body) { const as = getComputedStyle(a); if (px(as.borderTopLeftRadius) > 0 && painted(as)) { A = a; break; } a = a.parentElement; }
      if (!A) continue;
      const ab = A.getBoundingClientRect(), R = px(getComputedStyle(A).borderTopLeftRadius);
      if (R >= Math.min(ab.width, ab.height) / 2 - 1) continue;
      // the corner of the child nearest to a corner of the parent: insets on both axes
      const corners = [[b.left - ab.left, b.top - ab.top], [ab.right - b.right, b.top - ab.top], [b.left - ab.left, ab.bottom - b.bottom], [ab.right - b.right, ab.bottom - b.bottom]];
      const [dx, dy] = corners.reduce((m, c) => Math.max(c[0], c[1]) < Math.max(m[0], m[1]) ? c : m);
      if (dx < -0.5 || dy < -0.5 || Math.max(dx, dy) >= R) continue;   // only corners that sit inside the parent's curve
      const d = Math.max(dx, dy), want = Math.max(0, R - d);
      const key = sel(A, 2) + '|' + sel(el, 2); if (seen.has(key)) continue; seen.add(key);
      out.push({ outer: sel(A, 2), R, inner: sel(el, 2), r, inset: Math.round(d), want: Math.round(want), off: Math.round(r - want), ok: Math.abs(r - want) <= Math.max(3, R * 0.25) });
    }
    return out;
  }
  function glass() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || !shown(el)) continue;
      const s = getComputedStyle(el); const bf = (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' ? s.webkitBackdropFilter : null);
      const recipe = GLASS.some(c => el.classList.contains(c));
      if (!bf && !recipe) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      let pos = s.position; for (let e = el.parentElement; e && e !== document.body && pos === 'static'; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') pos = p + '(ancestor)'; }
      out.push({ sel: sel(el, 2), recipe, backdrop: bf, position: pos, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  }
  function clipped() {
    const out = []; const seen = new Set();
    // (1) text cut by its own ellipsis / line clamp
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || !shown(el)) continue;
      const s = getComputedStyle(el);
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      if (!own) continue;
      const cut = (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (s.webkitLineClamp && s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2);
      if (cut) { seen.add(el); out.push({ how: 'ellipsis/clamp', sel: sel(el, 3), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight }); }
    }
    // (2) text that runs past an ancestor that hides overflow
    for (const it of texts()) {
      const el = document.querySelector('[data-vis-id="' + it.id + '"]'); if (!el || seen.has(el)) continue;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        if (s.overflowY === 'auto' || s.overflowY === 'scroll') break;   // a scroller: the text is reachable
        const ab = a.getBoundingClientRect();
        const past = it.rects.some(r => r.x + r.w > ab.right + 1 || r.x < ab.left - 1 || r.y + r.h > ab.bottom + 1);
        if (past) { out.push({ how: 'cut by ' + sel(a, 1), sel: it.sel, text: it.text, textRight: Math.round(Math.max(...it.rects.map(r => r.x + r.w))), boxRight: Math.round(ab.right) }); break; }
      }
    }
    return out;
  }
  window.__vis = { rgba, lum, ratio, texts, onscreen, refresh, hideText, sample, targets, radii, glass, clipped };
})();
`;

export async function install(page) { await page.evaluate(PAGE_LIB); }

/** Rendered contrast of every visible text item, sweeping a scroller top to bottom. Returns [{...item, p10, med, bgMed}]. */
export async function contrastSweep(page, scroller) {
  await install(page);
  const all = await page.evaluate(() => __vis.texts().map(({ el, ...x }) => x));
  const done = new Map();
  const H = await page.evaluate(s => { const e = s && document.querySelector(s); return e ? { top: e.scrollTop, sh: e.scrollHeight, ch: e.clientHeight } : null; }, scroller);
  const steps = [];
  if (H && H.sh > H.ch + 4) for (let y = 0; y < H.sh; y += Math.floor(H.ch * 0.8)) steps.push(y); else steps.push(null);
  for (const y of steps) {
    if (y != null) { await page.evaluate(([s, y]) => { document.querySelector(s).scrollTop = y; }, [scroller, y]); await sleep(120); }
    const vis = await page.evaluate(ids => { __vis.texts(); const cur = __vis.texts().map(({ el, ...x }) => x).filter(x => !ids.includes(x.id)); return __vis.onscreen(cur); }, [...done.keys()]);
    if (!vis.length) continue;
    await page.evaluate(() => __vis.hideText(true));
    const png = await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    await page.evaluate(() => __vis.hideText(false));
    const res = await page.evaluate(([b64, items]) => __vis.sample(b64, items), [png.toString('base64'), vis]);
    for (const r of res) { const it = vis.find(v => v.id === r.id); done.set(r.id, { ...it, ...r, rects: undefined }); }
  }
  if (H && steps.length > 1) await page.evaluate(([s, y]) => { document.querySelector(s).scrollTop = y; }, [scroller, H.top]);
  return { all: all.map(({ rects, ...x }) => x), measured: [...done.values()] };
}

export const DT = [['Large Title', 34], ['Title 1', 28], ['Title 2', 22], ['Title 3', 20], ['Headline/Body', 17], ['Callout', 16], ['Subheadline', 15], ['Footnote', 13], ['Caption 1', 12], ['Caption 2', 11]];
export const nearestDT = fs => DT.reduce((b, d) => Math.abs(d[1] - fs) < Math.abs(b[1] - fs) ? d : b);

// ── surfaces: each returns { d, scroller } with the surface on screen ─────────────────────────────────────────────
const waitFn = (d, fn, arg, timeout = 8000) => d.page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
async function settleHome(d) {
  await d.page.waitForSelector('#view-home .home-hero, #view-home #tv', { timeout: 10000 });
  await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull));
  await waitFn(d, () => { const f = document.querySelector('#feed'); return !f || (f.children.length && !f.querySelector('.skeleton')); });
  await sleep(400);
}
async function tabVia(d, t) { await d.page.click(`#tabbar .tab[data-tab="${t}"]`); await sleep(500); }

export const SURFACES = {
  async home(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.goto('#home'); await settleHome(d); return { d, scroller: '#views' }; },
  async apps(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.goto('#home'); await settleHome(d); await tabVia(d, 'apps'); await d.page.waitForSelector('#grid .tile'); await sleep(600); return { d, scroller: '#views' }; },
  async chat(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.goto('#home'); await settleHome(d); await tabVia(d, 'chat'); await waitFn(d, () => document.querySelector('#chat-log .mrow, #chat-log .chat-note')); await sleep(600); return { d, scroller: '#views' }; },
  async me(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.goto('#home'); await settleHome(d); await tabVia(d, 'me'); await waitFn(d, () => !document.querySelector('#view-me .skeleton')); await sleep(800); return { d, scroller: '#views' }; },
  async picker(L, o) { const d = await L.device({ ...o, profile: null }); await d.goto(''); await d.page.waitForSelector('#profiles .pcard:not(.skeleton)'); await sleep(700); return { d, scroller: '#gate' }; },
  async pin(L, o) { const r = await SURFACES.picker(L, o); await r.d.page.click('#profiles .pcard[data-id="christian"]'); await r.d.page.waitForSelector('#pad'); await sleep(600); return r; },
  async guestSheet(L, o) { const r = await SURFACES.me(L, o); await r.d.page.click('#guest-add'); await r.d.page.waitForSelector('.sheet'); await sleep(600); await r.d.page.evaluate(() => document.activeElement && document.activeElement.blur()); return { d: r.d, scroller: '.sheet' }; },
  async switchSheet(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.openApp('tally'); await sleep(900); await d.page.click('#pill-name'); await d.page.waitForSelector('.sheet'); await sleep(600); return { d, scroller: '.sheet' }; },
  async viewer(L, o) { const d = await L.device({ ...o, profile: o.profile || 'eli' }); await d.openApp('f260'); await sleep(1500); return { d, scroller: null, only: '#pill' }; },
  async tv(L, o) { const d = await L.device({ ...o, device: 'tv', profile: 'tv' }); await d.goto('#home'); await d.page.waitForSelector('#tv'); await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull)); await sleep(1500); return { d, scroller: '#views' }; },
};
export const save = (name, obj) => { const f = path.join(EVID, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
export const shotCss = async (page, name, opts = {}) => { const f = path.join(EVID, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
