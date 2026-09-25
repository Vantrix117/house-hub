// Phase 4 ICON — rendered inventory of every icon on the shell's surfaces and in the nine apps, per theme.
// For each surface it sweeps the scroller top to bottom and records every visible icon:
//   svg     an inline or sprite (<use>) SVG between 6 and 160 px: rendered size, viewBox, stroke width in viewBox units
//           and in rendered px (sw × size / viewBox), paint (stroke / fill / stroke+fill), linecap, whether it carries a
//           duotone (.duo) and whether that duotone can render (inline only: `.ds .icon .duo` never matches inside a
//           <symbol>, see duo-sprite.mjs), the control it sits in (accessible name, size, icon-only or not)
//   glyph   a text node that is only 1-4 icon-like Unicode symbols (✓ × ★ ⚑ ◎ − …) or emoji, drawn as text
//   glyph-in-label  a text label that starts or ends with such a symbol ("Done ★", "Web ↗")
//   emoji-avatar    an .avatar holding an emoji (a face, counted but not an icon)
// Contrast (non-text, WCAG 1.4.11 3:1): every svg and glyph is hidden, the page is screenshot, and the background is
// the median pixel of the icon's box; `declared` = the computed paint colour (× opacity) over that background; `peak` =
// the most contrasting pixel inside the box in the normal screenshot (what anti-aliasing leaves of a thin stroke).
// Items whose centre is covered by another element (a fixed bar, the shell pill) are marked occluded and not sampled.
// Read-only: it navigates and scrolls; the theme is set as each profile's own person pref (PUT /api/data/hub/theme)
// plus localStorage, exactly as the Me tab would, on the local rig only.
//
//   node audits/tools/phase4/ICON/measure.mjs <theme> [surface,surface…]
//     theme: hearth | parchment | frost (OS light) · midnight | forest (OS dark)
// → audits/evidence/p4/ICON/measure-<theme>.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const THEME = process.argv[2] || 'hearth';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const MODE = ['midnight', 'forest'].includes(THEME) ? 'dark' : 'light';
const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });

const PAGE_LIB = String.raw`
(() => {
  if (window.__icon) return;
  const GL = '←-⇿⌀-⏿■-◿☀-⛿✀-➿⬀-⯿⊕-⊟−×‹›«»⋯⋮±…';
  const ONLYGLYPH = new RegExp('^(?:[' + GL + ']|\\p{Extended_Pictographic})(?:[\\uFE0F\\u200D]|\\p{Extended_Pictographic}|[' + GL + '])*$', 'u');
  const EDGE = new RegExp('^(?:[' + GL.replace('…', '') + ']|\\p{Extended_Pictographic})\\uFE0F?\\s|\\s(?:[' + GL.replace('…', '') + ']|\\p{Extended_Pictographic})\\uFE0F?$', 'u');
  let seq = 0;
  function shown(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden) return false; } return true; }
  function opac(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; }
  function sel(el, depth = 3) { const parts = []; let e = el; for (let i = 0; e && e.nodeType === 1 && i < depth; i++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const cl = [...e.classList].slice(0, 3); if (cl.length) s += '.' + cl.join('.'); parts.unshift(s); if (e.id) break; } return parts.join(' > '); }
  function control(el) { const c = el.closest('button, a, [role=button], label, summary, [role=tab]'); if (!c) return null; const r = c.getBoundingClientRect(); const txt = (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim(); return { sel: sel(c, 2), name: (c.getAttribute('aria-label') || c.getAttribute('title') || txt).slice(0, 60), text: txt.slice(0, 60), w: Math.round(r.width), h: Math.round(r.height) }; }
  const rectOf = r => ({ x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  function onTop(el, r) { const cx = r.x + r.width / 2, cy = r.y + r.height / 2; if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) return false; const h = document.elementFromPoint(cx, cy); return !!h && (h === el || el.contains(h) || h.contains(el)); }
  function collect() {
    const out = [];
    for (const svg of document.querySelectorAll('svg')) {
      if (svg.closest('symbol, defs')) continue;
      const r = svg.getBoundingClientRect();
      if (r.width < 6 || r.height < 6 || r.width > 160 || r.height > 160) continue;
      if (!shown(svg)) continue;
      const use = svg.querySelector('use');
      const href = use && (use.getAttribute('href') || use.getAttribute('xlink:href') || '');
      const ref = href && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
      const vbEl = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg : (ref && ref.viewBox && ref.viewBox.baseVal && ref.viewBox.baseVal.width ? ref : null);
      const vb = vbEl ? vbEl.viewBox.baseVal : null;
      const root = ref || svg;
      const shapes = [...root.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse')];
      const main = shapes.filter(s => !s.classList.contains('duo'));
      const duoEl = shapes.find(s => s.classList.contains('duo'));
      const tgt = use || main[0] || svg;
      const cs = getComputedStyle(tgt);
      const attrSw = main[0] && main[0].getAttribute('stroke-width');
      const sw = parseFloat(attrSw || cs.strokeWidth) || 0;
      const stroke = (main[0] && main[0].getAttribute('stroke') === 'none') ? 'none' : cs.stroke;
      const fillAttr = main[0] && main[0].getAttribute('fill');
      const fill = fillAttr === 'none' ? 'none' : (fillAttr && fillAttr !== 'currentColor' ? fillAttr : cs.fill);
      const paint = stroke !== 'none' && sw > 0 ? (fill !== 'none' ? 'stroke+fill' : 'stroke') : (fill !== 'none' ? 'fill' : 'none');
      const cls = svg.getAttribute('class') || '';
      if (!svg.dataset.icId) svg.dataset.icId = 'i' + (++seq);
      const duoCs = duoEl && !use ? getComputedStyle(duoEl) : null;
      out.push({ id: svg.dataset.icId, kind: /\bring\b/.test(cls) ? 'ring' : 'svg', sel: sel(svg), cls, sprite: ref ? ref.id : null,
        rect: rectOf(r), vb: vb ? [vb.x, vb.y, vb.width, vb.height] : null, sw, swPx: vb ? +(sw * r.width / vb.width).toFixed(2) : null,
        paint, stroke, fill, cap: cs.strokeLinecap, join: cs.strokeLinejoin, opacity: +opac(svg).toFixed(3),
        duo: !!duoEl, duoRendered: !!(duoCs && duoCs.fill !== 'none' && parseFloat(duoCs.fillOpacity) < 1 && duoCs.stroke === 'none'),
        fg: paint.startsWith('stroke') ? stroke : fill, ctl: control(svg), visible: onTop(svg, r) });
    }
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|TITLE|OPTION|NOSCRIPT|TEXTAREA)$/.test(el.tagName)) continue;
      const only = t === '+' || t.length <= 8 &&ONLYGLYPH.test(t.replace(/\s/g, ''));
      const edge = !only && t.length <= 80 && EDGE.test(t);
      if (!only && !edge) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const rr = [...rg.getClientRects()].filter(q => q.width > 1 && q.height > 2);
      if (!rr.length || !shown(el)) continue;
      const r = rr[0]; const cs = getComputedStyle(el);
      const avatar = el.closest('.avatar, .face, .pk, .puck');
      if (!el.dataset.icId) el.dataset.icId = 'g' + (++seq);
      const alone = only && el.textContent.replace(/\s+/g, '').trim() === t.replace(/\s/g, '');
      out.push({ id: el.dataset.icId, kind: avatar && only ? 'emoji-avatar' : only ? (el.closest('svg') ? 'map-glyph' : 'glyph') : 'glyph-in-label', text: t.slice(0, 40), sel: sel(el),
        rect: rectOf(r), fontSize: parseFloat(cs.fontSize), fontWeight: cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(), fg: el.closest('svg') ? cs.fill : cs.color, opacity: +opac(el).toFixed(3),
        hideable: alone, ctl: control(el), visible: onTop(el, r) });
    }
    return out;
  }
  const saved = new Map();
  function hide(on, ids) {
    for (const id of ids) {
      const el = document.querySelector('[data-ic-id="' + id + '"]'); if (!el) continue;
      if (on) { saved.set(id, el.getAttribute('style')); if (el.tagName.toLowerCase() === 'svg' || el.closest('svg')) el.style.setProperty('visibility', 'hidden', 'important'); else { el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); el.style.setProperty('text-shadow', 'none', 'important'); } }
      else { const s = saved.get(id); if (s == null) el.removeAttribute('style'); else el.setAttribute('style', s); }
    }
  }
  window.__icon = { collect, hide };
})();
`;

const SAMPLER = String.raw`
async ([hid, vis, items]) => {
  const load = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0); return cx.getImageData(0, 0, img.width, img.height); };
  const A = await load(hid), B = await load(vis);
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c1 = cv.getContext('2d', { willReadFrequently: true });
  const rgba = s => { if (!s || s === 'none' || s === 'transparent') return null; c1.clearRect(0, 0, 1, 1); c1.fillStyle = '#000'; c1.fillStyle = s; c1.fillRect(0, 0, 1, 1); const d = c1.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return items.map(it => {
    const x0 = Math.max(0, Math.floor(it.px.x)), y0 = Math.max(0, Math.floor(it.px.y)), x1 = Math.min(A.width, Math.ceil(it.px.x + it.px.w)), y1 = Math.min(A.height, Math.ceil(it.px.y + it.px.h));
    if (x1 - x0 < 2 || y1 - y0 < 2) return { id: it.id, err: 'offscreen' };
    const bgs = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.width + x) * 4; bgs.push([A.data[i], A.data[i + 1], A.data[i + 2]]); }
    const L = bgs.map(lum); const idx = L.map((v, i) => i).sort((a, b) => L[a] - L[b]); const bg = bgs[idx[Math.floor(idx.length / 2)]];
    let peak = 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * B.width + x) * 4; const r = ratio([B.data[i], B.data[i + 1], B.data[i + 2]], bg); if (r > peak) peak = r; }
    const f = rgba(it.fg); let declared = null, fgRgb = null;
    if (f) { const a = f[3] * (it.opacity == null ? 1 : it.opacity); fgRgb = [0, 1, 2].map(k => f[k] * a + bg[k] * (1 - a)); declared = +ratio(fgRgb, bg).toFixed(2); }
    return { id: it.id, bg, fgRgb: fgRgb && fgRgb.map(Math.round), declared, peak: +peak.toFixed(2) };
  });
}`;

const SAMPLE_FN = eval('(' + SAMPLER + ')');

// ── surfaces ────────────────────────────────────────────────────────────────────────────────────────────────────
const waitFn = (d, fn, arg, timeout = 10000) => d.page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
async function settleHome(d) {
  await d.page.waitForSelector('#view-home .home-hero, #view-home #tv', { timeout: 15000 });
  await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull));
  await waitFn(d, () => { const f = document.querySelector('#feed'); return !f || (f.children.length && !f.querySelector('.skeleton')); });
  await sleep(600);
}
const tab = async (d, t) => { await d.page.click(`#tabbar .tab[data-tab="${t}"]`); await sleep(700); };
const shell = (device, profile, go) => ({ device, profile, async open(d) { await d.goto(profile === 'tv' ? '#home' : (profile ? '#home' : '')); if (profile) await settleHome(d); else await d.page.waitForSelector('#profiles .pcard:not(.skeleton)', { timeout: 15000 }); if (go) await go(d); await sleep(500); return { frame: null, scroller: profile ? '#views' : '#gate' }; } });
const app = (id, device, profile, wait) => ({ device, profile, async open(d) { const f = await d.openApp(id, { wait }); await sleep(id.startsWith('dollywood') ? 5000 : 2500); return { frame: f, scroller: null, app: id }; } });
const SURF = {
  'shell-home': shell('ipad-portrait', 'eli'),
  'shell-apps': shell('ipad-portrait', 'eli', async d => { await tab(d, 'apps'); await d.page.waitForSelector('#grid .tile'); await sleep(800); }),
  'shell-apps-phone': shell('iphone-pwa', 'eli', async d => { await tab(d, 'apps'); await d.page.waitForSelector('#grid .tile'); await sleep(800); }),
  'shell-chat': shell('ipad-portrait', 'eli', async d => { await tab(d, 'chat'); await sleep(800); }),
  'shell-me': shell('ipad-portrait', 'eli', async d => { await tab(d, 'me'); await waitFn(d, () => !document.querySelector('#view-me .skeleton')); await sleep(800); }),
  'shell-kid-home': shell('ipad-portrait', 'ezra'),
  'shell-kid-apps': shell('ipad-portrait', 'ezra', async d => { await tab(d, 'apps'); await d.page.waitForSelector('#grid .tile'); await sleep(800); }),
  'shell-tv': { device: 'tv', profile: 'tv', async open(d) { await d.goto('#home'); await d.page.waitForSelector('#tv', { timeout: 15000 }); await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull)); await sleep(2000); return { frame: null, scroller: null }; } },
  'shell-picker': shell('ipad-portrait', null),
  'shell-viewer': { device: 'ipad-portrait', profile: 'eli', async open(d) { await d.openApp('tally'); await sleep(2000); return { frame: null, scroller: null, only: '#pill, #pill *' }; } },
  'f260': app('f260', 'ipad-portrait', 'eli'),
  'f260-phone': app('f260', 'iphone-pwa', 'eli'),
  'leftovers': app('leftovers', 'ipad-portrait', 'eli'),
  'prayer': app('prayer', 'ipad-portrait', 'eli'),
  'tally': app('tally', 'ipad-portrait', 'eli'),
  'timer': app('timer', 'ipad-portrait', 'eli'),
  'kidverse': app('kidverse', 'ipad-portrait', 'eli'),
  'verses': app('verses', 'ipad-portrait', 'eli'),
  'dollywood': app('dollywood', 'ipad-portrait', 'eli'),
  'dollywood-phone': app('dollywood', 'iphone-pwa', 'eli'),
  'dollywood-live': app('dollywood-live', 'iphone-pwa', 'eli'),
  'kid-kidverse': app('kidverse', 'iphone-pwa', 'ezra'),
  'kid-verses': app('verses', 'iphone-pwa', 'ezra'),
  'kid-prayer': app('prayer', 'iphone-pwa', 'ezra'),
  'kid-tally': app('tally', 'iphone-pwa', 'ezra'),
  'kid-timer': app('timer', 'iphone-pwa', 'ezra'),
  'kid-leftovers': app('leftovers', 'iphone-pwa', 'ezra'),
  'kid-dollywood-live': app('dollywood-live', 'iphone-pwa', 'ezra'),
};

async function sweep(d, target) {
  const page = d.page, fr = target.frame || page;
  await fr.evaluate(PAGE_LIB);
  let off = { x: 0, y: 0, s: 1 }, feEl = null;
  if (target.frame) { feEl = await target.frame.frameElement(); const bb = await feEl.boundingBox(); const iw = await target.frame.evaluate(() => innerWidth); off = { x: bb.x, y: bb.y, s: bb.width / iw }; }
  const H = await fr.evaluate(s => { const e = s ? document.querySelector(s) : document.scrollingElement; return e ? { sh: e.scrollHeight, ch: s ? e.clientHeight : innerHeight } : null; }, target.scroller);
  const steps = [0]; if (H && H.sh > H.ch + 8) for (let y = Math.floor(H.ch * 0.8); y < H.sh && steps.length < 7; y += Math.floor(H.ch * 0.8)) steps.push(y);
  const done = new Map();
  for (const y of steps) {
    await fr.evaluate(([s, y]) => { const e = s ? document.querySelector(s) : document.scrollingElement; if (e) e.scrollTop = y; }, [target.scroller, y]); await sleep(250);
    let items = await fr.evaluate(() => __icon.collect());
    if (target.only) items = await fr.evaluate(([its, q]) => its.filter(it => { const el = document.querySelector('[data-ic-id="' + it.id + '"]'); return el && el.matches(q); }), [items, target.only]);
    for (const it of items) it.px = { x: off.x + it.rect.x * off.s, y: off.y + it.rect.y * off.s, w: it.rect.w * off.s, h: it.rect.h * off.s };
    if (target.frame) { // is the frame itself on top at each centre (not under the shell pill)?
      const tops = await page.evaluate(([pts]) => { const fe = document.querySelector('iframe.on, #viewer iframe, iframe'); return pts.map(p => { const h = document.elementFromPoint(p[0], p[1]); return !!h && h.tagName === 'IFRAME'; }); }, [items.map(it => [it.px.x + it.px.w / 2, it.px.y + it.px.h / 2])]);
      items.forEach((it, i) => { if (!tops[i]) it.visible = false; });
    }
    const fresh = items.filter(it => !done.has(it.id));
    const inView = fresh.filter(it => it.visible && it.px.y >= 0 && it.px.y + it.px.h <= (page.viewportSize().height) && it.px.x >= 0 && it.px.x + it.px.w <= page.viewportSize().width);
    for (const it of fresh.filter(it => !inView.includes(it))) if (y === steps[steps.length - 1]) done.set(it.id, { ...it, occluded: true });
    const hideIds = inView.filter(it => it.kind !== 'glyph-in-label' && it.kind !== 'emoji-avatar' && (it.kind !== 'glyph' || it.hideable)).map(it => it.id);
    if (!inView.length) continue;
    const vis = await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    await fr.evaluate(ids => __icon.hide(true, ids), hideIds); await sleep(60);
    const hid = await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    await fr.evaluate(ids => __icon.hide(false, ids), hideIds);
    const args = [hid.toString('base64'), vis.toString('base64'), inView.filter(it => hideIds.includes(it.id)).map(({ id, px, fg, opacity }) => ({ id, px, fg, opacity }))];
    const res = await page.evaluate(SAMPLE_FN, args);
    for (const it of inView) { const r = res.find(q => q.id === it.id); done.set(it.id, { ...it, ...(r || {}), scrollY: y }); }
  }
  await fr.evaluate(s => { const e = s ? document.querySelector(s) : document.scrollingElement; if (e) e.scrollTop = 0; }, target.scroller);
  return [...done.values()];
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { theme: THEME, mode: MODE, engine: 'webkit', variant: 'typical', surfaces: {} };
const file = path.join(OUT, `measure-${THEME}.json`);
if (fs.existsSync(file) && ONLY) Object.assign(out.surfaces, JSON.parse(fs.readFileSync(file, 'utf8')).surfaces || {});
try {
  for (const p of ['eli', 'ezra']) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: THEME, updated_at: Date.now() } });
  for (const [name, s] of Object.entries(SURF)) {
    if (ONLY && !ONLY.includes(name)) continue;
    const t0 = Date.now();
    const d = await L.device({ device: s.device, mode: MODE, profile: s.profile, localStorage: { 'hub.theme': JSON.stringify(THEME) } });
    try {
      const target = await s.open(d);
      const applied = await (target.frame || d.page).evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind }));
      const items = await sweep(d, target);
      out.surfaces[name] = { device: s.device, profile: s.profile, applied, ms: Date.now() - t0, items };
      console.log(name, THEME, applied.theme, applied.scheme, items.length, 'items', Date.now() - t0, 'ms');
    } catch (e) { out.surfaces[name] = { error: String(e && e.message || e) }; console.log(name, 'ERROR', String(e && e.message || e).slice(0, 200)); }
    await d.close();
    fs.writeFileSync(file, JSON.stringify(out, null, 0));
  }
} finally { await L.close(); }
fs.writeFileSync(file, JSON.stringify(out, null, 0));
console.log('wrote', path.relative(process.cwd(), file));
