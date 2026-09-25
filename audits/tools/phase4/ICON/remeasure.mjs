// Phase 4 ICON — independent RE-MEASURER. Written from scratch; imports only the shared harness (lib/local.mjs).
// It does NOT reuse the investigator's measure/report/duo-sprite/facets scripts.
//
// Method (deliberately different from the investigator's "hide icons, median pixel" sampler):
//   ink    = the computed paint of the icon (stroke, or fill for filled shapes; text colour for glyphs), composited
//            with the product of ancestor opacities over the background below
//   bgRing = mean of the rendered pixels in the icon's container (chip / button / ring) OUTSIDE the icon box, taken only
//            from the four "plus" bands through the icon's centre (avoids rounded corners), device-pixel screenshot
//   bgMode = mean of the most populous 3-bit colour bin inside the icon box (icon visible; strokes are the minority)
//   decl   = contrast(ink∘opacity over bg, bg) with bg = bgRing when there is one, else bgMode
//   pix    = contrast(most contrasting pixel inside the icon box, bg)  — what actually lands on the screen
// Also a DOM sweep of every icon SVG (size, viewBox, COMPUTED stroke-width on the drawn shape, duotone, control name)
// and a pixel test of whether a sprite (<use>) duotone paints.
//
//   node audits/tools/phase4/ICON/remeasure.mjs <theme>     theme: hearth|parchment|frost|midnight|forest
// → audits/evidence/p4/ICON/remeasure-<theme>.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const THEME = process.argv[2] || 'hearth';
const MODE = ['midnight', 'forest'].includes(THEME) ? 'dark' : 'light';
const OUTDIR = path.join(ROOT, 'audits/evidence/p4/ICON');
const FULL = THEME === 'hearth';               // sweeps, facets and the duotone pixel test run once (theme-independent)

// ── pixels ──────────────────────────────────────────────────────────────────────────────────────────────────
function png(buf) {
  let p = 8, w, h, ct; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1; const stride = w * bpp;
  const px = new Uint8Array(w * h * 3); let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) px[(y * w + x) * 3 + k] = bpp >= 3 ? cur[x * bpp + k] : cur[x * bpp];
    prev = cur;
  }
  return { w, h, at: (x, y) => { const i = (y * w + x) * 3; return [px[i], px[i + 1], px[i + 2]]; } };
}
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
function parseColor(s) {
  if (!s) return null; s = s.trim(); let m;
  if ((m = s.match(/^rgba?\(([^)]+)\)/))) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  if ((m = s.match(/^color\(srgb ([^)]+)\)/))) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
  if ((m = s.match(/^#([0-9a-f]{6})$/i))) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  return null;
}

// ── measure one icon ────────────────────────────────────────────────────────────────────────────────────────
async function measureIcon(page, handle, { ctxSel, inkSel, label, glyph, bgFrom } = {}) {
  const info = await handle.evaluate((el, { ctxSel, inkSel, glyph }) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    let t = el;
    if (inkSel) t = el.querySelector(inkSel) || el;
    else if (!glyph) { const use = el.querySelector('use'); t = use ? el : ([...el.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')].find(s => !s.classList.contains('duo')) || el); }
    const cs = getComputedStyle(t);
    let paint;
    if (glyph) paint = cs.color;
    else if (inkSel) paint = cs.fill !== 'none' ? cs.fill : cs.stroke;
    else paint = (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) ? cs.stroke : cs.fill;
    let op = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (t !== el && t.getAttribute && t.getAttribute('opacity')) op *= parseFloat(t.getAttribute('opacity'));
    return { paint, op, text: glyph ? el.textContent.trim() : null };
  }, { ctxSel, inkSel, glyph: !!glyph });
  const ctx = await handle.evaluateHandle((el, s) => (s && el.closest(s)) || el.parentElement, ctxSel || null);
  await sleep(120);
  const b = await handle.boundingBox(), c = await ctx.asElement().boundingBox();
  if (!b || !c || b.width < 2) return { label, error: 'no box' };
  const clip = { x: Math.max(0, Math.floor(Math.min(b.x, c.x))), y: Math.max(0, Math.floor(Math.min(b.y, c.y))) };
  clip.width = Math.ceil(Math.max(b.x + b.width, c.x + c.width)) - clip.x; clip.height = Math.ceil(Math.max(b.y + b.height, c.y + c.height)) - clip.y;
  const img = png(await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
  const s = img.w / clip.width;
  const X = v => Math.round((v - clip.x) * s), Y = v => Math.round((v - clip.y) * s);
  const ix0 = X(b.x), iy0 = Y(b.y), ix1 = X(b.x + b.width), iy1 = Y(b.y + b.height);
  const cx0 = X(c.x), cy0 = Y(c.y), cx1 = X(c.x + c.width), cy1 = Y(c.y + c.height);
  // bgMode: most populous 3-bit bin inside the icon box
  const bins = new Map(); const inside = [];
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue; const p = img.at(x, y); inside.push(p); const k = (p[0] >> 5) * 64 + (p[1] >> 5) * 8 + (p[2] >> 5); const e = bins.get(k) || { n: 0, s: [0, 0, 0] }; e.n++; e.s[0] += p[0]; e.s[1] += p[1]; e.s[2] += p[2]; bins.set(k, e); }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  const bgMode = top ? top.s.map(v => v / top.n) : null;
  // bgRing: plus-shaped bands through the icon centre, outside the icon box (+1 device px gap), inside the container (−2 px)
  const gap = Math.ceil(s), pad = Math.ceil(2 * s);
  const midX0 = Math.round(ix0 + (ix1 - ix0) / 3), midX1 = Math.round(ix0 + 2 * (ix1 - ix0) / 3), midY0 = Math.round(iy0 + (iy1 - iy0) / 3), midY1 = Math.round(iy0 + 2 * (iy1 - iy0) / 3);
  const ring = [];
  const add = (x, y) => { if (x >= cx0 + pad && x < cx1 - pad && y >= cy0 + pad && y < cy1 - pad && x >= 0 && y >= 0 && x < img.w && y < img.h) ring.push(img.at(x, y)); };
  for (let y = midY0; y < midY1; y++) { for (let x = cx0; x < ix0 - gap; x++) add(x, y); for (let x = ix1 + gap; x < cx1; x++) add(x, y); }
  for (let x = midX0; x < midX1; x++) { for (let y = cy0; y < iy0 - gap; y++) add(x, y); for (let y = iy1 + gap; y < cy1; y++) add(x, y); }
  const bgRing = ring.length >= 8 ? [0, 1, 2].map(k => ring.reduce((a, p) => a + p[k], 0) / ring.length) : null;
  const bg = bgFrom === 'mode' ? bgMode : (bgRing || bgMode);
  const ink = parseColor(info.paint);
  let decl = null;
  if (ink && bg) { const a = ink[3] * info.op; const f = [0, 1, 2].map(k => ink[k] * a + bg[k] * (1 - a)); decl = ratio(f, bg); }
  let pix = 1, peak = null; for (const p of inside) { const r = ratio(p, bg); if (r > pix) { pix = r; peak = p; } }
  return { label, bgFrom: bgFrom === 'mode' || !bgRing ? 'mode' : 'ring', text: info.text || undefined, paint: info.paint, op: r2(info.op), size: r2(b.width), bgRing: bgRing && bgRing.map(Math.round), bgMode: bgMode && bgMode.map(Math.round), ringPx: ring.length,
    decl: r2(decl), declVsMode: ink && bgMode ? r2(ratio([0, 1, 2].map(k => ink[k] * ink[3] * info.op + bgMode[k] * (1 - ink[3] * info.op)), bgMode)) : null, pix: r2(pix), peak };
}
async function measureAll(page, frame, sel, opts = {}) {
  const hs = await frame.$$(sel); const out = [];
  for (const h of hs) {
    const vis = await h.evaluate(el => { const r = el.getBoundingClientRect(); if (r.width < 2) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; });
    if (!vis) continue;
    const label = opts.labelFn ? await h.evaluate(opts.labelFn) : null;
    out.push(await measureIcon(page, h, { ...opts, label }));
  }
  return out;
}

// ── DOM sweep ───────────────────────────────────────────────────────────────────────────────────────────────
const SWEEP = (only) => {
  const out = [];
  const root = only ? document.querySelectorAll(only) : [document];
  const svgs = new Set(); for (const r of root) for (const s of (r.querySelectorAll ? r.querySelectorAll('svg') : [])) svgs.add(s);
  for (const svg of svgs) {
    if (svg.closest('symbol, defs')) continue;
    const rc = svg.getBoundingClientRect(); if (rc.width < 6 || rc.height < 6 || rc.width > 160 || rc.height > 160) continue;
    let hidden = false; for (let e = svg; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') { hidden = true; break; } } if (hidden) continue;
    const cls = svg.getAttribute('class') || '';
    const isRing = svg.parentElement && svg.parentElement.classList.contains('ring') || /\bring\b/.test(cls) || !!svg.closest('#mini');
    const use = svg.querySelector('use'); const href = use && (use.getAttribute('href') || '');
    const sym = href && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
    const vbSrc = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) ? svg : sym;
    const vbW = vbSrc && vbSrc.viewBox && vbSrc.viewBox.baseVal ? vbSrc.viewBox.baseVal.width : null;
    const shapes = sym ? [...sym.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')] : [...svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')];
    const duoEls = shapes.filter(s => s.classList.contains('duo'));
    // computed stroke widths of the shapes actually drawn: inline shapes → their own computed style; sprite → the <use>'s
    const sws = new Set(); const attrSws = new Set(); let stroked = 0, filled = 0;
    if (sym) { const cs = getComputedStyle(use); if (cs.stroke !== 'none') { sws.add(parseFloat(cs.strokeWidth)); stroked++; } for (const s of shapes) if (s.getAttribute('stroke-width')) attrSws.add(s.getAttribute('stroke-width')); }
    else for (const s of shapes) { if (s.classList.contains('duo')) continue; const cs = getComputedStyle(s); if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) { sws.add(parseFloat(cs.strokeWidth)); stroked++; } if (cs.fill !== 'none') filled++; const a = s.getAttribute('stroke-width') || svg.getAttribute('stroke-width'); if (a) attrSws.add(a); }
    const duoInlineRendered = !sym && duoEls.length ? duoEls.some(e => { const cs = getComputedStyle(e); return cs.fill !== 'none' && parseFloat(cs.fillOpacity) < 1 && cs.stroke === 'none'; }) : false;
    const ctl = svg.closest('button, a[href], [role=button], [role=tab], summary');
    let ctlInfo = null;
    if (ctl) { const txt = (ctl.innerText || '').replace(/\s+/g, '').trim(); const lb = ctl.getAttribute('aria-labelledby'); const name = ctl.getAttribute('aria-label') || ctl.getAttribute('title') || (lb && (document.getElementById(lb) || {}).textContent) || ''; ctlInfo = { iconOnly: !txt, name: (name || '').trim().slice(0, 50), w: Math.round(ctl.getBoundingClientRect().width), h: Math.round(ctl.getBoundingClientRect().height) }; }
    out.push({ w: +rc.width.toFixed(1), vbW, sprite: sym ? sym.id : null, ring: isRing, sws: [...sws], attrSws: [...attrSws], stroked, filled, duo: duoEls.length > 0, duoInlineRendered, ctl: ctlInfo, cls: cls.slice(0, 30), parent: (svg.parentElement.className && String(svg.parentElement.className).slice(0, 30)) || svg.parentElement.tagName });
  }
  return out;
};

const FACETS = () => [...document.querySelectorAll('svg.icon')].map(svg => {
  const shapes = [...svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')];
  return { where: (svg.closest('[id]') || {}).id || '', parent: String(svg.parentElement.className || svg.parentElement.tagName).slice(0, 30),
    svgSwAttr: svg.getAttribute('stroke-width'), svgFillAttr: svg.getAttribute('fill'),
    shapes: shapes.map(s => ({ swAttr: s.getAttribute('stroke-width'), fillAttr: s.getAttribute('fill'), sw: getComputedStyle(s).strokeWidth, fill: getComputedStyle(s).fill, stroke: getComputedStyle(s).stroke })) };
});

// ── run ─────────────────────────────────────────────────────────────────────────────────────────────────────
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const R = { theme: THEME, mode: MODE, engine: 'webkit', method: 'remeasure (ring/mode sampling, device px)', at: new Date().toISOString(), contrast: {}, sweep: {}, facets: null, duoPixel: null, applied: {} };
const waitFn = (p, fn, t = 12000) => p.waitForFunction(fn, null, { timeout: t }).then(() => true, () => false);
try {
  for (const p of ['eli', 'ezra']) {
    const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: THEME, updated_at: Date.now() } });
    if (r.status >= 300) throw new Error('theme PUT ' + p + ' ' + r.status);
  }
  const ls = { 'hub.theme': JSON.stringify(THEME) };
  const open = async (device, profile, hash) => {
    const d = await L.device({ device, mode: MODE, profile, localStorage: ls });
    await d.goto(hash);
    await waitFn(d.page, () => window.hub && hub.sync && hub.sync.lastPull);
    await sleep(1500);
    return d;
  };
  const applied = async (name, frame) => { R.applied[name] = await frame.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'hearth(default)', scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind })); };
  const tileLabel = el => (el.closest('button') || {}).getAttribute ? el.closest('button').getAttribute('aria-label') || el.closest('button').innerText.trim() : null;
  const headLabel = el => { const h = el.closest('h2'); return h ? h.textContent.trim().slice(0, 30) + (el.querySelector('use') ? ' #' + el.querySelector('use').getAttribute('href').slice(1) : ' (inline)') : null; };

  // 1. Home (adult, iPad): card heads + tab bar + sweep
  { const d = await open('ipad-portrait', 'eli', '#home');
    await d.page.waitForSelector('#view-home h2 .app-icon', { timeout: 15000 }).catch(() => {});
    await applied('shell-home', d.page);
    R.contrast['home-heads'] = await measureAll(d.page, d.page, '#view-home h2 > .app-icon > svg', { ctxSel: '.app-icon', labelFn: headLabel });
    R.contrast['tabbar'] = await measureAll(d.page, d.page, '#tabbar .tab > svg', { ctxSel: '.tab', bgFrom: 'mode', labelFn: el => el.closest('.tab').dataset.tab + (el.closest('.tab').classList.contains('on') || el.closest('.tab').getAttribute('aria-current') ? ' (current)' : '') });
    if (FULL) {
      R.sweep['shell-home'] = await d.page.evaluate(SWEEP, null);
      // duotone pixel test: the same #i-home symbol through <use> and inline, 120 px, inside .ds
      R.duoPixel = await d.page.evaluate(async () => {
        const sym = document.getElementById('i-home');
        const box = document.createElement('div'); box.id = 'rm-duo';
        box.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;display:flex;gap:10px;padding:10px;background:#FFFFFF;color:#20304A;--tint:#D04010';
        box.innerHTML = `<svg class="icon" id="rm-use" style="width:120px;height:120px"><use href="#i-home"/></svg><svg class="icon" id="rm-inl" viewBox="0 0 24 24" style="width:120px;height:120px">${sym.innerHTML}</svg>`;
        document.body.appendChild(box); await new Promise(r => setTimeout(r, 200));
        const u = document.querySelector('#rm-use').getBoundingClientRect(), i = document.querySelector('#rm-inl').getBoundingClientRect();
        return { use: { x: u.x, y: u.y }, inl: { x: i.x, y: i.y }, size: 120, symbolDuoPaths: sym.querySelectorAll('.duo').length, symbolsWithDuo: [...document.querySelectorAll('symbol')].filter(s => s.querySelector('.duo')).length, symbols: document.querySelectorAll('symbol').length };
      });
      const shot = png(await d.page.screenshot({ clip: { x: 0, y: 0, width: 280, height: 150 } }));
      const sc = shot.w / 280;
      const at = (o, vx, vy) => shot.at(Math.round((o.x + vx * 5) * sc), Math.round((o.y + vy * 5) * sc));   // 120/24 = 5 px per unit
      // interior of the house body, away from the outline and the door: (7, 15) and (17, 13) in the 24-grid
      const pts = [[7, 15], [17, 13], [12, 9]];
      R.duoPixel.usePixels = pts.map(([x, y]) => at(R.duoPixel.use, x, y));
      R.duoPixel.inlinePixels = pts.map(([x, y]) => at(R.duoPixel.inl, x, y));
      R.duoPixel.bgPixel = shot.at(Math.round(275 * sc), Math.round(145 * sc));
      R.duoPixel.duoRendersViaUse = R.duoPixel.usePixels.some(p => ratio(p, [255, 255, 255]) > 1.1);
      R.duoPixel.duoRendersInline = R.duoPixel.inlinePixels.some(p => ratio(p, [255, 255, 255]) > 1.1);
      await d.page.evaluate(() => document.getElementById('rm-duo').remove());
    }
    await d.close(); }

  // 2. Apps grid (adult, iPad)
  { const d = await open('ipad-portrait', 'eli', '#apps');
    await d.page.waitForSelector('#grid .tile', { timeout: 15000 }); await sleep(900);
    await applied('shell-apps', d.page);
    R.contrast['tiles-adult'] = await measureAll(d.page, d.page, '#grid .tile .ticon > svg', { ctxSel: '.ticon', labelFn: tileLabel });
    if (FULL) R.sweep['shell-apps'] = await d.page.evaluate(SWEEP, null);
    await d.close(); }

  // 3. Apps grid (kid Ezra, iPad) — dark themes + parchment + hearth
  { const d = await open('ipad-portrait', 'ezra', '#apps');
    await d.page.waitForSelector('#grid .tile', { timeout: 15000 }); await sleep(900);
    await applied('shell-kid-apps', d.page);
    R.contrast['tiles-kid'] = await measureAll(d.page, d.page, '#grid .tile .ticon > svg', { ctxSel: '.ticon', labelFn: tileLabel });
    if (FULL) R.sweep['shell-kid-apps'] = await d.page.evaluate(SWEEP, null);
    await d.close(); }

  // 4. TV board heads
  { const d = await L.device({ device: 'tv', mode: MODE, profile: 'tv', localStorage: ls });
    await d.goto('#home'); await d.page.waitForSelector('#tv', { timeout: 15000 }).catch(() => {});
    await waitFn(d.page, () => window.hub && hub.sync && hub.sync.lastPull); await sleep(2000);
    await applied('shell-tv', d.page);
    R.contrast['tv-heads'] = await measureAll(d.page, d.page, '#tv h2 > .app-icon > svg', { ctxSel: '.app-icon', labelFn: headLabel });
    if (FULL) R.sweep['shell-tv'] = await d.page.evaluate(SWEEP, null);
    await d.close(); }

  // 5. Park map compass (iPhone PWA, Eli)
  { const d = await open('iphone-pwa', 'eli', '#home');
    const f = await d.openApp('dollywood-live'); await sleep(6000);
    await applied('dollywood-live', f);
    R.contrast['compass'] = await measureAll(d.page, f, '#lv-north > svg', { ctxSel: '#lv-north', bgFrom: 'mode', inkSel: 'path[fill="#FF6B4A"]', labelFn: () => 'north needle' });
    if (FULL) R.sweep['dollywood-live'] = await f.evaluate(SWEEP, null);
    await d.close(); }

  // 6. F260 (iPad, Eli): week-done ticks, milestone glyphs; sweep
  { const d = await open('ipad-portrait', 'eli', '#home');
    const f = await d.openApp('f260'); await sleep(3000);
    await applied('f260', f);
    R.contrast['f260-week-ticks'] = await measureAll(d.page, f, '.week.complete .ring .rc > svg', { ctxSel: '.ring', labelFn: el => el.closest('.week') ? (el.closest('.week').id || '') : '' });
    R.contrast['f260-miles-on'] = await measureAll(d.page, f, '#miles .mile.on .mi', { glyph: true, ctxSel: '.mi', bgFrom: 'mode', labelFn: el => el.textContent.trim() });
    if (FULL) R.sweep['f260'] = await f.evaluate(SWEEP, null);
    await d.close(); }

  if (FULL || THEME === 'parchment') {
    // 7. Me (star head) and kid Home (bell, stars)
    { const d = await open('ipad-portrait', 'eli', '#me');
      await sleep(1200); await applied('shell-me', d.page);
      R.contrast['me-heads'] = await measureAll(d.page, d.page, '#view-me h2 > .app-icon > svg', { ctxSel: '.app-icon', labelFn: headLabel });
      if (FULL) R.sweep['shell-me'] = await d.page.evaluate(SWEEP, null);
      await d.close(); }
    { const d = await open('ipad-portrait', 'ezra', '#home');
      await sleep(800); await applied('shell-kid-home', d.page);
      R.contrast['kid-home-heads'] = await measureAll(d.page, d.page, '#view-home h2 > .app-icon > svg', { ctxSel: '.app-icon', labelFn: headLabel });
      if (FULL) R.sweep['shell-kid-home'] = await d.page.evaluate(SWEEP, null);
      await d.close(); }
    // 8. Kid Verse as Ezra (iPhone): week-strip stars; facets
    { const d = await open('iphone-pwa', 'ezra', '#home');
      const f = await d.openApp('kidverse'); await sleep(3000);
      await applied('kid-kidverse', f);
      R.contrast['kidverse-week-star'] = await measureAll(d.page, f, '.days span.on > svg', { ctxSel: 'span.on', labelFn: el => el.parentElement.title });
      if (FULL) { R.sweep['kid-kidverse'] = await f.evaluate(SWEEP, null); R.facets = { 'kid-kidverse': await f.evaluate(FACETS) }; }
      await d.close(); }
  }

  if (FULL) {
    // remaining shell surfaces + apps for the sweep only
    { const d = await open('iphone-pwa', 'eli', '#apps'); await d.page.waitForSelector('#grid .tile').catch(() => {}); await sleep(800); R.sweep['shell-apps-phone'] = await d.page.evaluate(SWEEP, null); await d.close(); }
    { const d = await open('ipad-portrait', 'eli', '#chat'); await sleep(1000); R.sweep['shell-chat'] = await d.page.evaluate(SWEEP, null); await d.close(); }
    { const d = await L.device({ device: 'ipad-portrait', mode: MODE, profile: null, localStorage: ls }); await d.goto(''); await d.page.waitForSelector('#profiles .pcard', { timeout: 15000 }).catch(() => {}); await sleep(1500); R.sweep['shell-picker'] = await d.page.evaluate(SWEEP, null); await d.close(); }
    { const d = await open('ipad-portrait', 'eli', '#home'); await d.openApp('tally'); await sleep(2000); R.sweep['shell-viewer-pill'] = await d.page.evaluate(SWEEP, '#pill'); await d.close(); }
    for (const [id, dev, prof] of [['leftovers', 'ipad-portrait', 'eli'], ['prayer', 'ipad-portrait', 'eli'], ['tally', 'ipad-portrait', 'eli'], ['timer', 'ipad-portrait', 'eli'], ['kidverse', 'ipad-portrait', 'eli'], ['verses', 'ipad-portrait', 'eli'], ['verses', 'iphone-pwa', 'ezra'], ['dollywood', 'ipad-portrait', 'eli']]) {
      const d = await open(dev, prof, '#home'); const f = await d.openApp(id); await sleep(id.startsWith('dollywood') ? 6000 : 3000);
      R.sweep[(prof === 'ezra' ? 'kid-' : '') + id] = await f.evaluate(SWEEP, null);
      if (id === 'verses' || id === 'kidverse') R.facets[(prof === 'ezra' ? 'kid-' : '') + id] = await f.evaluate(FACETS);
      await d.close();
    }
  }
} catch (e) { R.error = String(e && e.stack || e).slice(0, 800); console.error(e); }
finally { await L.close(); }
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, `remeasure-${THEME}.json`), JSON.stringify(R, null, 1));
console.log('wrote remeasure-' + THEME + '.json', Object.fromEntries(Object.entries(R.contrast).map(([k, v]) => [k, v.length])), Object.fromEntries(Object.entries(R.sweep).map(([k, v]) => [k, v.length])), R.applied);
