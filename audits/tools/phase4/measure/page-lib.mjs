// Phase 4 measurement rig: the in-page library. m4lib(tokenNames) is serialised with Function.prototype.toString and
// installed once per document (the shell page and the app iframe) as window.__m4. Everything here only READS the page,
// except three reversible helpers used while sampling: hide(on) (text + icons transparent), scrollTo(id, y) and
// the data-m4-* marker attributes it puts on elements so Node can refer back to them.
// Rects are in the document's own viewport coordinates; measure.mjs adds the iframe's offset.
// Derived from audits/tools/phase2/VIS/lib-vis.mjs (read-only; not imported because it is page-only and this runs in
// frames too).
export function m4lib(TOKEN_NAMES) {
  if (window.__m4) return;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const fcv = document.createElement('canvas'); const fcx = fcv.getContext('2d');
  // any computed CSS colour → [r,g,b,a] (0-255, a 0-1)
  function rgba(s) {
    if (!s || s === 'transparent' || s === 'none') return [0, 0, 0, 0];
    let m = /^rgba?\(([^)]+)\)$/.exec(s.trim());
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(v => v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
      return [Math.round(p[0]), Math.round(p[1]), Math.round(p[2]), p.length > 3 ? +(+p[3]).toFixed(3) : 1];
    }
    m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)$/.exec(s.trim());
    if (m) return [Math.round(m[1] * 255), Math.round(m[2] * 255), Math.round(m[3] * 255), m[4] != null ? +(+m[4]).toFixed(3) : 1];
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], +(d[3] / 255).toFixed(3)];
  }
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (fg, a, bg) => [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
  const EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️⃣\s]+$/u;
  const HAS_EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
  const GLASS = ['glass', 'glass-strong', 'btn-glass', 'pill', 'topbar', 'tabbar', 'sheet'];
  const IA = 'button, a[href], input:not([type=hidden]), select, textarea, summary, label[for], [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio], [role=link], [role=menuitem], [role=option], [data-open], [data-open-tab], [onclick], [tabindex]:not([tabindex="-1"])';
  let seq = 0;
  const px = v => parseFloat(v) || 0;
  const r1 = v => Math.round(v * 10) / 10;
  function sel(el, depth = 3) {
    const parts = []; let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < depth; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id;
      const cl = [...e.classList].filter(c => !/^(vis-|m4-)/.test(c)).slice(0, 3); if (cl.length) s += '.' + cl.join('.');
      parts.unshift(s); if (e.id) break;
    }
    return parts.join(' > ');
  }
  const idOf = el => { if (!el.dataset.m4Id) el.dataset.m4Id = String(++seq); return el.dataset.m4Id; };
  function shown(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || e.hidden) return false; const p = e.parentElement; if (p && p.tagName === 'DETAILS' && !p.open && e.tagName !== 'SUMMARY') return false; } return true; }
  // declared (not computed) values of properties this WebKit build does not expose in computed style
  // (-webkit-tap-highlight-color, -webkit-touch-callout): the last matching rule on the element or, as both inherit,
  // its nearest ancestor with one. !important wins. Approximate cascade (document order, no specificity).
  // This WebKit build drops both properties at parse time (they never reach the CSSOM), so the rules are read from the
  // stylesheet SOURCE text: linked sheets are fetched (same origin), inline <style> is read as text. loadDecl() runs first.
  let DECL = { '-webkit-tap-highlight-color': [], '-webkit-touch-callout': [], 'overscroll-behavior': [], 'overscroll-behavior-x': [], 'overscroll-behavior-y': [] };
  function parseCss(text, file, out) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const walk = (t) => {
      let i = 0;
      while (i < t.length) {
        const open = t.indexOf('{', i); if (open < 0) break;
        const prelude = t.slice(i, open).trim(); let depth = 1, j = open + 1;
        while (j < t.length && depth) { if (t[j] === '{') depth++; else if (t[j] === '}') depth--; j++; }
        const body = t.slice(open + 1, j - 1);
        if (/^@(media|supports|layer|container)/.test(prelude)) walk(body);
        else if (!prelude.startsWith('@')) for (const p of Object.keys(out)) { const re = new RegExp('(?:^|;)\\s*' + p.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+)', 'g'); let m; while ((m = re.exec(body))) out[p].push({ sel: prelude.replace(/\s+/g, ' '), v: m[1].replace(/!important/, '').trim(), imp: /!important/.test(m[1]), file }); }
        i = j;
      }
    };
    walk(text);
  }
  async function loadDecl() {
    const out = { '-webkit-tap-highlight-color': [], '-webkit-touch-callout': [], 'overscroll-behavior': [], 'overscroll-behavior-x': [], 'overscroll-behavior-y': [] };
    for (const n of document.querySelectorAll('link[rel=stylesheet], style')) {
      try { if (n.tagName === 'STYLE') parseCss(n.textContent, 'inline', out); else if (n.href && n.href.startsWith(location.origin)) parseCss(await (await fetch(n.href)).text(), n.href.split('/').pop(), out); } catch {}
    }
    DECL = out; return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
  }
  const declRules = () => DECL;
  function declared(el, prop) {
    const rules = declRules()[prop];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      let best = null; for (const r of rules) { let m = false; try { m = e.matches(r.sel.replace(/:(hover|active|focus-visible|focus)/g, '')); } catch {} if (m && (!best || r.imp || !best.imp)) best = r; }
      if (best) return { v: best.v, at: e === el ? 'self' : 'ancestor', sel: best.sel.slice(0, 60) };
    }
    return { v: prop === '-webkit-tap-highlight-color' ? '(UA default)' : '(UA default)', at: null, sel: null };
  }
  // overscroll-behavior is not computed by this build either: declared on the element itself (not inherited)
  function overscroll(el) {
    const s = getComputedStyle(el);
    if (s.overscrollBehaviorX !== undefined) return { x: s.overscrollBehaviorX, y: s.overscrollBehaviorY, src: 'computed' };
    const own = prop => { let best = null; for (const r of declRules()[prop]) { let m = false; try { m = el.matches(r.sel); } catch {} if (m && (!best || r.imp || !best.imp)) best = r; } return best; };
    const sh = own('overscroll-behavior'), bx = own('overscroll-behavior-x'), by = own('overscroll-behavior-y');
    const parts = sh ? sh.v.split(/\s+/) : [];
    return { x: bx ? bx.v : parts[0] || 'auto', y: by ? by.v : parts[1] || parts[0] || 'auto', src: sh || bx || by ? 'declared' : 'default' };
  }
  function opac(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; }
  const bfOf = s => (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' ? s.webkitBackdropFilter : null);
  function glassy(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (bfOf(s) || GLASS.some(c => e.classList.contains(c))) return true; } return false; }
  function splitStack(ff) {
    const out = []; let cur = '', q = null;
    for (const ch of ff) { if (q) { cur += ch; if (ch === q) q = null; } else if (ch === '"' || ch === "'") { q = ch; cur += ch; } else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim()); return out;
  }
  // first family of a stack that this browser actually has (canvas width test against two different fallbacks)
  const famCache = new Map();
  function available(f) {
    if (famCache.has(f)) return famCache.get(f);
    const probe = 'mmmmmmmmmmlli1WQ@#g', test = fb => {
      fcx.font = '10px serif'; const before = fcx.font; fcx.font = `64px ${f}, ${fb}`;
      if (fcx.font === before) return null;                   // unparseable
      const w1 = fcx.measureText(probe).width; fcx.font = `64px ${fb}`; const w2 = fcx.measureText(probe).width; return w1 !== w2;
    };
    const a = test('monospace'), b = test('serif');
    const ok = a === null && b === null ? false : !!(a || b);
    famCache.set(f, ok); return ok;
  }
  const resolvedCache = new Map();
  function resolvedFamily(stack) {
    if (resolvedCache.has(stack)) return resolvedCache.get(stack);
    const fams = splitStack(stack); let r = null;
    for (const f of fams) { if (/^(serif|sans-serif|monospace|cursive|fantasy)$/i.test(f)) { r = f; break; } if (available(f)) { r = f.replace(/["']/g, ''); break; } }
    r = r || '(fallback)'; resolvedCache.set(stack, r); return r;
  }
  function interactiveOf(el) { const a = el.closest(IA); if (a) return a; for (let e = el; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) if (getComputedStyle(e).cursor === 'pointer') return e; return null; }

  // ── design tokens: resolve every design.css custom property on :root (and the doc's own custom properties) ──
  function localTokenNames() {
    const names = new Set();
    for (const sh of document.styleSheets) {
      let href = sh.href || ''; if (/design\.css/.test(href)) continue;
      let rules; try { rules = sh.cssRules; } catch { continue; }
      const walk = rs => { for (const r of rs) { if (r.style) for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--')) names.add(p); } if (r.cssRules) walk(r.cssRules); } };
      walk(rules);
    }
    return [...names].filter(n => !TOKEN_NAMES.includes(n));
  }
  function resolveTokens(names) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;width:100px;visibility:hidden;color:rgb(1, 2, 3);pointer-events:none';
    (document.body || document.documentElement).appendChild(host);
    const probes = names.map(n => { const d = document.createElement('div'); d.style.color = `var(${n})`; d.style.marginLeft = `var(${n})`; d.style.transitionDuration = `var(${n})`; host.appendChild(d); return d; });
    const rootCs = getComputedStyle(document.documentElement); const out = {};
    names.forEach((n, i) => {
      const raw = rootCs.getPropertyValue(n).trim(); const cs = getComputedStyle(probes[i]); const o = { raw: raw.length > 160 ? raw.slice(0, 160) + '…' : raw };
      if (raw) {
        const c = cs.color; if (c !== 'rgb(1, 2, 3)') o.rgba = rgba(c);
        const ml = cs.marginLeft; if (/px$/.test(ml) && (ml !== '0px' || /^0(px)?$/.test(raw))) o.px = r1(px(ml));
        const td = cs.transitionDuration; if (td && td !== '0s' && /^[\d.]+m?s$/.test(td)) o.ms = td.endsWith('ms') ? px(td) : px(td) * 1000;
      }
      out[n] = o;
    });
    host.remove(); return out;
  }
  let TOK = null, LOCAL = null, colourIndex = null;
  function tokens() {
    if (!TOK) {
      TOK = resolveTokens(TOKEN_NAMES); LOCAL = resolveTokens(localTokenNames());
      colourIndex = new Map();
      for (const [src, map] of [['', TOK], ['local:', LOCAL]]) for (const [n, o] of Object.entries(map)) if (o.rgba && o.rgba[3] > 0) { const k = o.rgba.join(','); if (!colourIndex.has(k)) colourIndex.set(k, []); colourIndex.get(k).push(src + n); }
    }
    return { design: TOK, local: LOCAL };
  }
  const tokFor = c => { if (!colourIndex) tokens(); return (colourIndex.get(c.join(',')) || []).slice(0, 6); };
  function bgDecl(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = getComputedStyle(e); const c = rgba(s.backgroundColor);
      if (s.backgroundImage && s.backgroundImage !== 'none') return { img: s.backgroundImage.slice(0, 60), c: c[3] > 0.05 ? c : null, sel: sel(e, 1) };
      if (c[3] > 0.05) return { c, tok: tokFor(c), sel: sel(e, 1) };
    }
    const hs = getComputedStyle(document.documentElement); const c = rgba(hs.backgroundColor);
    return { c, tok: tokFor(c), sel: 'html', canvas: true };
  }

  // ── text ──
  function lineRects(n) { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].filter(q => q.width > 1 && q.height > 2).map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height })); }
  function texts() {
    const map = new Map(); const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|TITLE|OPTION|NOSCRIPT|TEMPLATE)$/.test(el.tagName) || el.closest('svg')) continue;
      const rects = lineRects(n); if (!rects.length || !shown(el)) continue;
      let it = map.get(el); if (!it) { it = { el, text: '', rects: [], kind: 'text' }; map.set(el, it); }
      it.text += (it.text ? ' ' : '') + t; it.rects.push(...rects);
    }
    // form fields: the value or the placeholder is text too
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), textarea, select')) {
      if (!shown(el)) continue; const b = el.getBoundingClientRect(); if (b.width < 4 || b.height < 4) continue;
      let text = '', kind = 'value';
      if (el.tagName === 'SELECT') text = (el.selectedOptions[0] || {}).textContent || ''; else { text = el.value; if (!text && el.placeholder) { text = el.placeholder; kind = 'placeholder'; } }
      text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) continue;
      const cs = getComputedStyle(el); const pl = px(cs.paddingLeft) + px(cs.borderLeftWidth), pr = px(cs.paddingRight) + px(cs.borderRightWidth);
      const fs = px(cs.fontSize), lh = Math.min(b.height - 2, fs * 1.3);
      const tw = Math.min(b.width - pl - pr, Math.max(fs, text.length * fs * 0.5));
      map.set(el, { el, text, kind, rects: [{ x: b.x + pl, y: b.y + (b.height - lh) / 2, w: Math.max(4, tw), h: lh }] });
    }
    const out = [];
    for (const it of map.values()) {
      const el = it.el; if (it.kind === 'text' && EMOJI.test(it.text)) continue;
      let cs = getComputedStyle(el);
      let color = rgba(cs.color);
      if (it.kind === 'placeholder') { try { const ps = getComputedStyle(el, '::placeholder'); if (ps && ps.color) color = rgba(ps.color); } catch {} }
      const op = opac(el); if (op < 0.05 || color[3] === 0) continue;
      const fs = px(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      const ia = interactiveOf(el);
      const roleEl = el.closest('[role]');
      out.push({ id: idOf(el), kind: it.kind, sel: sel(el), text: it.text.slice(0, 60), tag: el.tagName.toLowerCase(), role: roleEl ? roleEl.getAttribute('role') : null,
        ia: !!ia, iaSel: ia ? sel(ia, 1) : null, ff: splitStack(cs.fontFamily)[0].replace(/["']/g, ''), ffr: resolvedFamily(cs.fontFamily), stack: cs.fontFamily,
        fs: r1(fs), fw, lh: cs.lineHeight === 'normal' ? 'normal' : r1(px(cs.lineHeight)), ls: cs.letterSpacing === 'normal' ? 0 : r1(px(cs.letterSpacing)), tt: cs.textTransform, fvn: cs.fontVariantNumeric,
        color, op: +op.toFixed(3), tok: tokFor(color), bg: bgDecl(el), glass: glassy(el), large: fs >= 24 || (fs >= 18.66 && fw >= 700), rects: it.rects });
    }
    return out;
  }
  function onscreenRect(r) { return r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= innerWidth + 1 && r.y + r.h <= innerHeight + 1; }
  function hitOk(el, r) {
    const pts = [[r.x + Math.min(r.w, 40) / 2, r.y + r.h / 2], [r.x + r.w / 2, r.y + r.h / 2]];
    return pts.some(([x, y]) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit) || hit.contains(el) || (hit.tagName === 'LABEL' && hit.control === el)); });
  }
  // v2 occlusion grid: every line box is hit-tested in columns (≤ 64 per item, ≥ 4 px wide) at 30 % and 70 % of its
  // height; a column is uncovered when both hits are the text element, a descendant, an ancestor or its <label>.
  // Only uncovered columns are sampled (sample() masks the rest), cover = covered share of the in-viewport columns.
  const hitIs = (el, x, y) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit) || hit.contains(el) || (hit.tagName === 'LABEL' && hit.control === el)); };
  function coverGrid(el, rects) {
    const inV = rects.map(r => ({ x0: Math.max(0, r.x), x1: Math.min(innerWidth, r.x + r.w), y0: r.y, y1: r.y + r.h }));
    const total = inV.reduce((s, q, i) => s + (q.y0 >= -0.5 && q.y1 <= innerHeight + 0.5 && q.x1 > q.x0 ? q.x1 - q.x0 : 0), 0);
    const cs = Math.max(4, Math.ceil(total / 64));
    const ok = []; let n = 0;
    rects.forEach((r, ri) => {
      const q = inV[ri]; if (!(q.y0 >= -0.5 && q.y1 <= innerHeight + 0.5 && q.x1 > q.x0)) return;   // a line outside the viewport is neither sampled nor counted
      const cols = Math.max(1, Math.ceil(r.w / cs));
      for (let ci = 0; ci < cols; ci++) {
        const x = Math.min(r.x + r.w - 0.5, r.x + (ci + 0.5) * cs); if (x < 0 || x > innerWidth) continue;
        n++;
        if (hitIs(el, x, r.y + r.h * 0.3) && hitIs(el, x, r.y + r.h * 0.7)) ok.push([ri, ci, +x.toFixed(1), +(r.y + r.h / 2).toFixed(1)]);
      }
    });
    return { cs, n, ok, cover: n ? +(1 - ok.length / n).toFixed(3) : 1 };
  }
  // the text items (fresh rects) whose first line box is inside this viewport, with their occlusion grid; measure.mjs
  // accepts an item when cover <= 0.5 (and re-measures a partly covered one when a later step shows more of it)
  function visibleTexts(skip) {
    const S = new Set(skip || []);
    const out = [];
    for (const it of texts()) {
      if (S.has(it.id)) continue; const el = document.querySelector('[data-m4-id="' + it.id + '"]'); const r = it.rects[0];
      if (!el || !onscreenRect(r)) continue;
      const g = coverGrid(el, it.rects); if (!g.n) continue;
      it.grid = g; out.push(it);
    }
    return out;
  }

  // ── non-text: icons and control boundaries ──
  function icons() {
    const out = [];
    const push = (el, kind, extra = {}) => { const b = el.getBoundingClientRect(); if (b.width < 6 || b.height < 6) return; const ia = interactiveOf(el); out.push({ id: idOf(el), kind, sel: sel(el), w: r1(b.width), h: r1(b.height), inControl: !!ia, ctlSel: ia ? sel(ia, 1) : null, label: ia ? (ia.getAttribute('aria-label') || ia.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : null, rect: { x: b.x, y: b.y, w: b.width, h: b.height }, ...extra }); };
    for (const el of document.querySelectorAll('svg')) {
      if (el.parentElement && el.parentElement.closest('svg')) continue; if (!shown(el) || opac(el) < 0.05) continue;
      const b = el.getBoundingClientRect(); const ia = interactiveOf(el);
      if (Math.max(b.width, b.height) > 64 && !(ia && Math.max(b.width, b.height) <= 96)) continue;   // illustrations, maps
      push(el, 'svg', { color: rgba(getComputedStyle(el).color) });
    }
    for (const el of document.querySelectorAll('img')) {
      if (!shown(el) || opac(el) < 0.05) continue; const b = el.getBoundingClientRect(); const ia = interactiveOf(el);
      if (!(ia || /icon/i.test(el.className + ' ' + (el.getAttribute('src') || '')))) continue; if (Math.max(b.width, b.height) > 96) continue;
      push(el, 'img', { src: (el.getAttribute('src') || '').slice(0, 50) });
    }
    // emoji used as an icon: an element whose own text is only emoji, inside a control (or a tile/chip)
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT); let n; const seen = new Set();
    while ((n = w.nextNode())) {
      const t = n.nodeValue.trim(); if (!t || !HAS_EMOJI.test(t)) continue; const el = n.parentElement; if (!el || seen.has(el) || el.closest('svg')) continue;
      const own = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.nodeValue).join('').trim();
      if (!EMOJI.test(own)) continue; if (!shown(el) || opac(el) < 0.05) continue; seen.add(el);
      const ia = interactiveOf(el); if (!ia && !/tile|chip|icon|badge|pill|tab|avatar|emoji/i.test(el.className + ' ' + (el.parentElement ? el.parentElement.className : ''))) continue;
      push(el, 'emoji', { text: own.slice(0, 8) });
    }
    return out;
  }
  function controls() {
    const out = []; const seen = new Set();
    const q = 'button, [role=button], [role=switch], [role=tab], [role=checkbox], input:not([type=hidden]):not([type=file]), select, textarea, .switch, .toggle, [class*="chip"], [class*="pill"], [class*="tag"]:not(svg *), .btn';
    for (const el of document.querySelectorAll(q)) {
      if (seen.has(el) || el.closest('svg') || !shown(el) || opac(el) < 0.05) continue; seen.add(el);
      const b = el.getBoundingClientRect(); if (b.width < 8 || b.height < 8) continue;
      const s = getComputedStyle(el);
      const bw = Math.max(px(s.borderTopWidth), px(s.borderBottomWidth), px(s.borderLeftWidth), px(s.borderRightWidth));
      const bc = rgba(s.borderTopColor), fill = rgba(s.backgroundColor);
      const hasText = [...el.querySelectorAll('*'), el].some(e => [...e.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim() && !EMOJI.test(c.nodeValue.trim())));
      const kind = el.matches('input[type=checkbox], input[type=radio], [role=switch], .switch, .toggle') ? 'toggle' : el.matches('input, select, textarea') ? 'field' : el.matches('[class*="chip"], [class*="pill"], [class*="tag"]') && !el.matches('button, .btn') ? 'chip' : 'button';
      out.push({ id: idOf(el), kind, sel: sel(el), w: r1(b.width), h: r1(b.height), bw, bc, op: +opac(el).toFixed(3), fill, img: s.backgroundImage !== 'none', shadow: s.boxShadow !== 'none', radius: px(s.borderTopLeftRadius), hasText, rect: { x: b.x, y: b.y, w: b.width, h: b.height } });
    }
    return out;
  }
  // ── v2: information-bearing graphics (WCAG 1.4.11) that are not icons or control boundaries ──
  // kinds: ring (a solid spread box-shadow / outline is the state cue: .days span.today, .ygrid .cur, .heat .today),
  //        bar (a fill inside a painted track: .bar > i, .jbar i; compared against the visible track),
  //        dot (small painted shapes: day dots, grid cells, heat squares, status stripes, --p columns),
  //        stroke (svg circles/paths with a stroke inside a ring / dial / progress / role=img graphic: track and arc).
  // Each item carries sample points in document viewport coordinates: pts.paint (for gradient paints, read from the
  // screenshot), and one or more adjacent groups (pts.top/right/bottom/left 3 px outside, pts.track, pts.outer/inner);
  // sample() compares the computed paint (alpha-composited) or the paint pixels with the median pixel of each group.
  const HINT = /dot|day|cell|stripe|bar\b|track|fill|meter|progress|ring|step|pip|seg|heat|swatch|legend|status|today|cur\b|level|gauge|spark|col\b/i;
  const SVGHINT = /ring|dial|gauge|progress|meter|chart|donut|spark/i;
  function parseRing(bs) {
    if (!bs || bs === 'none') return null;
    const parts = bs.split(/,(?![^(]*\))/).map(x => x.trim());
    for (const p of parts) {
      if (/inset/.test(p)) continue;
      const cm = /(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8})/i.exec(p); const c = cm ? rgba(cm[1]) : null;
      const nums = p.replace(cm ? cm[1] : '', '').match(/-?[\d.]+px|\b0\b/g) || [];
      const [ox, oy, blur, spread] = nums.map(v => parseFloat(v) || 0);
      if (c && c[3] > 0.05 && Math.abs(ox || 0) < 0.5 && Math.abs(oy || 0) < 0.5 && (blur || 0) < 0.5 && (spread || 0) >= 1.5) return { c, spread };
    }
    return null;
  }
  function around(b, off, n = 3) {   // points `off` px outside each side of a box, n per side
    const P = { top: [], right: [], bottom: [], left: [] };
    for (let i = 0; i < n; i++) { const f = (i + 1) / (n + 1); const x = b.left + b.width * f, y = b.top + b.height * f; P.top.push([x, b.top - off]); P.bottom.push([x, b.bottom - 1 + off]); P.left.push([b.left - off, y]); P.right.push([b.right - 1 + off, y]); }
    return P;
  }
  const innerPts = (b, off) => [[b.left + b.width / 2, b.top + off], [b.left + b.width / 2, b.bottom - 1 - off], [b.left + off, b.top + b.height / 2], [b.right - 1 - off, b.top + b.height / 2]];
  const centreRow = (b, n = 7, inset = 1) => Array.from({ length: n }, (_, i) => [b.left + inset + (b.width - 2 * inset) * (i + 0.5) / n, b.top + b.height / 2]);
  const centreCol = (b, n = 5, inset = 1) => Array.from({ length: n }, (_, i) => [b.left + b.width / 2, b.top + inset + (b.height - 2 * inset) * (i + 0.5) / n]);
  const ownText = el => (el.textContent || '').replace(/\s+/g, '').length;
  function paintOf(el, s) {
    const bg = rgba(s.backgroundColor), img = s.backgroundImage && s.backgroundImage !== 'none' ? s.backgroundImage : null;
    if (img && /gradient/.test(img)) return { gradient: true, img: img.slice(0, 80) };
    if (img) return null;                                            // a url() image is a picture, not a state colour
    if (bg[3] > 0.05) return { c: bg };
    const bw = Math.max(px(s.borderTopWidth), px(s.borderLeftWidth)); const bc = rgba(s.borderTopColor);
    if (bw >= 1 && bc[3] > 0.05) return { c: bc, border: bw };
    return null;
  }
  function graphics() {
    const out = []; const seen = new Set(); const svgOk = new Map();
    const push = (el, g) => { if (out.length >= 600) return; const eid = idOf(el); out.push({ id: eid + ':' + g.kind, eid, sel: sel(el), ...g }); };   // one element can be a dot and a ring
    for (const el of document.querySelectorAll('body *')) {
      if (seen.has(el)) continue;
      if (el.closest('svg')) {
        if (!/^(circle|ellipse|path|line|polyline|polygon|rect)$/.test(el.tagName)) continue;
        const svg = el.ownerSVGElement || el.closest('svg'); if (!svg) continue;
        if (!svgOk.has(svg)) {
          let hinted = false; for (let a = svg, i = 0; a && a.nodeType === 1 && i < 4; a = a.parentElement, i++) { const cn = typeof a.className === 'string' ? a.className : (a.className && a.className.baseVal) || ''; if (SVGHINT.test(cn + ' ' + (a.id || '')) || /^(img|progressbar|meter)$/.test(a.getAttribute('role') || '')) { hinted = true; break; } }
          const sb = svg.getBoundingClientRect();
          // a map or an illustration is not a ring/dial/progress graphic
          svgOk.set(svg, hinted && !(Math.min(sb.width, sb.height) > 420 || svg.querySelectorAll('circle, ellipse, path, line, polyline, polygon, rect').length > 60) ? Math.max(sb.width, sb.height) : 0);
        }
        if (!svgOk.get(svg) || !shown(el)) continue;
        const s = getComputedStyle(el); const op = opac(el); if (op < 0.05) continue;
        const st = s.stroke && s.stroke !== 'none' && !/url\(/.test(s.stroke) ? rgba(s.stroke) : null; if (!st || st[3] < 0.05) continue;
        const so = parseFloat(s.strokeOpacity || '1'); const m = el.getScreenCTM ? el.getScreenCTM() : null; const k = m ? Math.hypot(m.a, m.b) : 1;
        const sw = px(s.strokeWidth) * k; if (sw < 1.5) continue;
        const b = el.getBoundingClientRect(); if (b.width < 4 || b.height < 4) continue;
        if (el.tagName !== 'circle' && el.tagName !== 'ellipse' && svgOk.get(svg) < 40) continue;   // a check mark or glyph inside a small ring is an icon
        const fill = s.fill && s.fill !== 'none' && !/url\(/.test(s.fill) ? rgba(s.fill) : null;
        const g = { kind: 'stroke', tag: el.tagName, paint: st, alpha: +(st[3] * so * op).toFixed(3), sw: r1(sw), fill: fill && fill[3] > 0.05 ? fill : null, rect: { x: b.x, y: b.y, w: b.width, h: b.height }, svgSel: sel(svg, 2) };
        if (el.tagName === 'circle') {
          const r = parseFloat(el.getAttribute('r')) || 0; const R = r * k; const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
          const outer = [], inner = []; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; outer.push([cx + Math.cos(a) * (R + sw / 2 + 3), cy + Math.sin(a) * (R + sw / 2 + 3)]); if (R - sw / 2 - 3 > 1) inner.push([cx + Math.cos(a) * (R - sw / 2 - 3), cy + Math.sin(a) * (R - sw / 2 - 3)]); }
          g.pts = inner.length && !g.fill ? { outer, inner } : { outer }; g.R = r1(R);
          const L = 2 * Math.PI * r; const da = parseFloat(s.strokeDasharray) || 0, doff = parseFloat(s.strokeDashoffset) || 0;
          g.drawn = da > 0 && Math.abs(da - L) / L < 0.1 ? +Math.max(0, Math.min(1, 1 - doff / da)).toFixed(3) : 1;
          // an earlier sibling circle with the same centre and radius is this arc's track
          for (const sib of svg.querySelectorAll('circle')) { if (sib === el) break; const ss = getComputedStyle(sib); if (sib.getAttribute('cx') === el.getAttribute('cx') && sib.getAttribute('cy') === el.getAttribute('cy') && sib.getAttribute('r') === el.getAttribute('r') && ss.stroke && ss.stroke !== 'none') { const tc = rgba(ss.stroke); g.track = { paint: tc, alpha: +(tc[3] * parseFloat(ss.strokeOpacity || '1') * opac(sib)).toFixed(3), sel: sel(sib, 1) }; } }
        } else g.pts = around(b, 3);
        seen.add(el); push(el, g); continue;
      }
      if (!shown(el)) continue;
      const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
      if (GLASS.some(c => el.classList.contains(c))) continue;
      const s = getComputedStyle(el); const op = opac(el); if (op < 0.05) continue;
      if (el.querySelector('img, video, canvas, iframe')) continue;
      const cls = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
      const par = el.parentElement; const pcls = par ? (typeof par.className === 'string' ? par.className : '') + ' ' + (par.id || '') : '';
      const txt = ownText(el);
      const hinted = HINT.test(cls) || HINT.test(pcls) || /--p\b/.test((el.getAttribute('style') || '') + ' ' + (par && par.getAttribute('style') || '')) || /^(img|progressbar|meter)$/.test(el.getAttribute('role') || '');
      const sibs = par ? [...par.children].filter(c => c.tagName === el.tagName).length : 0;
      // ring: a solid spread box-shadow (or an outline) on a small element is a state cue
      const ring = parseRing(s.boxShadow) || (s.outlineStyle && s.outlineStyle !== 'none' && px(s.outlineWidth) >= 1.5 && rgba(s.outlineColor)[3] > 0.05 ? { c: rgba(s.outlineColor), spread: px(s.outlineWidth) + Math.max(0, px(s.outlineOffset)), outline: true } : null);
      if (ring && Math.max(b.width, b.height) <= 160 && txt <= 3 && (hinted || sibs >= 5)) {
        const off = ring.spread + 3; const sides = around(b, off);
        push(el, { kind: 'ring', paint: ring.c, alpha: +(ring.c[3] * op).toFixed(3), spread: ring.spread, outline: !!ring.outline, rect: { x: b.x - ring.spread, y: b.y - ring.spread, w: b.width + 2 * ring.spread, h: b.height + 2 * ring.spread }, pts: { ...sides, inside: innerPts(b, 3) }, groups: ['top', 'right', 'bottom', 'left'] });
      }
      const paint = paintOf(el, s); if (!paint) continue;
      if (txt > 3) continue;
      if (el.querySelector('svg') && Math.max(b.width, b.height) > 44) continue;
      const ps = par ? getComputedStyle(par) : null; const pPaint = ps ? rgba(ps.backgroundColor) : [0, 0, 0, 0];
      const pb = par ? par.getBoundingClientRect() : null;
      const small = Math.max(b.width, b.height) <= 64 || (Math.min(b.width, b.height) <= 8 && hinted);
      // bar fill: inside a painted track that is thin on one axis
      const inTrack = pb && pPaint[3] > 0.05 && !paint.border && b.left >= pb.left - 1 && b.right <= pb.right + 1 && b.top >= pb.top - 1 && b.bottom <= pb.bottom + 1 && Math.min(pb.width, pb.height) <= 24 && txt === 0 && (!paint.c || paint.c.join() !== pPaint.join());
      if (inTrack) {
        const horiz = pb.width >= pb.height; const pts = { paint: horiz ? centreRow(b) : centreCol(b) };
        const t = []; if (horiz) { const cy = pb.top + pb.height / 2; for (const [a0, a1] of [[pb.left + 2, b.left - 2], [b.right + 2, pb.right - 2]]) if (a1 - a0 >= 3) for (let i = 0; i < 4; i++) t.push([a0 + (a1 - a0) * (i + 0.5) / 4, cy]); }
        else { const cx = pb.left + pb.width / 2; for (const [a0, a1] of [[pb.top + 2, b.top - 2], [b.bottom + 2, pb.bottom - 2]]) if (a1 - a0 >= 3) for (let i = 0; i < 4; i++) t.push([cx, a0 + (a1 - a0) * (i + 0.5) / 4]); }
        const aroundTrack = around(pb, 3);
        if (t.length) { pts.track = t; }
        pts.trackOut = [...aroundTrack.top, ...aroundTrack.bottom, ...aroundTrack.left, ...aroundTrack.right];
        push(el, { kind: 'bar', paint: paint.c || null, gradient: !!paint.gradient, img: paint.img || null, alpha: paint.c ? +(paint.c[3] * op).toFixed(3) : +op.toFixed(3), trackPaint: pPaint, trackSel: sel(par, 1), fillShare: +(horiz ? b.width / pb.width : b.height / pb.height).toFixed(3), rect: { x: b.x, y: b.y, w: b.width, h: b.height }, pts, groups: t.length ? ['track'] : [] });
        continue;
      }
      if (!small || !(hinted || sibs >= 5)) continue;
      if ([...el.children].some(c => { const cs2 = getComputedStyle(c); return rgba(cs2.backgroundColor)[3] > 0.05 || /gradient/.test(cs2.backgroundImage || ''); })) continue;
      if (Math.max(b.width, b.height) > 400) continue;
      if (paint.c && pPaint[3] > 0.99 && paint.c.join() === pPaint.join()) continue;   // same colour as its parent: no shape
      const pts = { ...around(b, 3) }; if (paint.gradient) pts.paint = b.width >= b.height ? centreRow(b) : centreCol(b);
      push(el, { kind: 'dot', shadow: s.boxShadow !== 'none' ? s.boxShadow.slice(0, 90) : null, paint: paint.c || null, gradient: !!paint.gradient, img: paint.img || null, border: paint.border || 0, alpha: paint.c ? +(paint.c[3] * op).toFixed(3) : +op.toFixed(3), text: txt ? (el.textContent || '').trim().slice(0, 3) : null, ia: !!interactiveOf(el), sibs, rect: { x: b.x, y: b.y, w: b.width, h: b.height }, pts, groups: ['top', 'right', 'bottom', 'left'] });
    }
    return out;
  }
  // graphics on screen and at the top at their centre (an svg shape counts when the hit is inside its svg)
  function visibleG(list, skip) {
    const S = new Set(skip || []);
    return list.filter(g => !S.has(g.id)).filter(g => {
      const r = g.rect; const cx = r.x + r.w / 2, cy = r.y + r.h / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
      if (r.x < -r.w * 0.5 || r.y < -r.h * 0.5 || r.x + r.w > innerWidth + r.w * 0.5 || r.y + r.h > innerHeight + r.h * 0.5) return false;
      const el = document.querySelector('[data-m4-id="' + g.eid + '"]'); if (!el) return false;
      if (g.kind === 'stroke') {
        const svg = el.ownerSVGElement || el.closest('svg'); const wrap = svg && svg.parentElement; const inSvg = h => !!h && (h === el || (svg && (svg.contains(h) || h.contains(svg) || (wrap && wrap !== document.body && wrap.contains(h)))));   // an overlay inside the ring's own wrapper (a count, a check) still shows the ring
        const pts = g.R ? Array.from({ length: 8 }, (_, i) => [cx + Math.cos(i * Math.PI / 4) * g.R, cy + Math.sin(i * Math.PI / 4) * g.R]) : [[cx, cy]];
        return pts.some(([x, y]) => x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight && inSvg(document.elementFromPoint(x, y)));
      }
      const hit = document.elementFromPoint(cx, cy); if (!hit) return false;
      return hit === el || el.contains(hit) || hit.contains(el);
    });
  }
  function visibleOf(list, skip) {
    const S = new Set(skip || []);
    return list.filter(it => !S.has(it.id)).filter(it => { const r = it.rect; if (!(r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= innerWidth + 1 && r.y + r.h <= innerHeight + 1)) return false; const el = document.querySelector('[data-m4-id="' + it.id + '"]'); const hit = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2); return !!hit && !!el && (hit === el || el.contains(hit) || hit.contains(el) || (hit.closest && hit.closest('svg') && el.contains(hit.closest('svg')))); });
  }
  function hide(on) {
    let s = document.getElementById('m4-hide');
    if (on && !s) { s = document.createElement('style'); s.id = 'm4-hide'; s.textContent = '*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}[data-m4-icon]{opacity:0!important}'; (document.head || document.documentElement).appendChild(s); }
    if (!on && s) s.remove();
  }
  function markIcons(ids) { for (const id of ids) { const el = document.querySelector('[data-m4-id="' + id + '"]'); if (el) el.setAttribute('data-m4-icon', ''); } }
  function unmarkIcons() { for (const el of document.querySelectorAll('[data-m4-icon]')) el.removeAttribute('data-m4-icon'); }

  // ── scrollers ──
  function scrollers() {
    const out = [];
    const se = document.scrollingElement || document.documentElement;
    const cand = [se, ...document.querySelectorAll('body *')];
    for (const el of cand) {
      if (el !== se) { const s = getComputedStyle(el); if (!/(auto|scroll)/.test(s.overflowY)) continue; if (!shown(el)) continue; }
      if (el.scrollHeight <= el.clientHeight + 4) continue;
      const b = el === se ? { width: innerWidth, height: innerHeight } : el.getBoundingClientRect();
      if (b.width * b.height < innerWidth * innerHeight * 0.2) continue;
      if (el !== se) { const cxp = Math.max(0, b.left) + (Math.min(innerWidth, b.right) - Math.max(0, b.left)) / 2, cyp = Math.max(0, b.top) + (Math.min(innerHeight, b.bottom) - Math.max(0, b.top)) / 2; const hit = document.elementFromPoint(cxp, cyp); if (!hit || !(el === hit || el.contains(hit))) continue; }   // covered (e.g. #views under the app viewer)
      if (el !== se && (b.width < 1 || b.height < 1)) continue;
      out.push({ id: el === se ? 'root' : idOf(el), sel: el === se ? 'scrollingElement' : sel(el, 2), top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight, area: Math.round(b.width * b.height) });
    }
    return out.sort((a, b) => b.area - a.area).slice(0, 3);
  }
  function scrollTo(id, y) { const el = id === 'root' ? (document.scrollingElement || document.documentElement) : document.querySelector('[data-m4-id="' + id + '"]'); if (el) el.scrollTop = y; return el ? el.scrollTop : null; }

  // ── static inventories ──
  function visibleEls() { return [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') || e.tagName === 'svg').filter(e => { const b = e.getBoundingClientRect(); return b.width >= 1 && b.height >= 1 && shown(e); }); }
  function painted(s) { return (rgba(s.backgroundColor)[3] > 0.05) || s.backgroundImage !== 'none' || px(s.borderTopWidth) > 0 || px(s.borderLeftWidth) > 0 || s.boxShadow !== 'none'; }
  function boxes(els) {
    const radii = new Map(), shadows = new Map(), spacing = {}, conc = new Map();
    const add = (prop, v, el) => { if (!v) return; const k = prop + '|' + v; const o = spacing[k] || (spacing[k] = { prop, v, n: 0, ex: [] }); o.n++; if (o.ex.length < 3) { const s = sel(el, 2); if (!o.ex.includes(s)) o.ex.push(s); } };
    for (const el of els) {
      if (el.closest('svg')) continue;
      const s = getComputedStyle(el); const b = el.getBoundingClientRect();
      const rs = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(px);
      const r = Math.max(...rs);
      if (r > 0 && (painted(s) || el.tagName === 'IMG' || el.tagName === 'IFRAME') && b.width >= 4 && b.height >= 4) {
        const pill = r >= Math.min(b.width, b.height) / 2 - 1;
        const k = sel(el, 2) + '|' + rs.join(',');
        let o = radii.get(k);
        if (!o) {
          let a = el.parentElement, A = null;
          while (a && a !== document.body) { const as = getComputedStyle(a); if (px(as.borderTopLeftRadius) > 0 && painted(as)) { A = a; break; } a = a.parentElement; }
          const as = A ? getComputedStyle(A) : null;
          o = { sel: sel(el, 2), r: rs.every(v => v === rs[0]) ? rs[0] : rs, pill, w: r1(b.width), h: r1(b.height), pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px),
            parent: A ? { sel: sel(A, 2), r: px(as.borderTopLeftRadius), pad: [as.paddingTop, as.paddingRight, as.paddingBottom, as.paddingLeft].map(px) } : null, n: 0 };
          radii.set(k, o);
          // concentricity: the child corner nearest a parent corner, when it sits inside the parent's curve
          if (A && !pill) {
            const ab = A.getBoundingClientRect(), R = px(as.borderTopLeftRadius);
            if (R < Math.min(ab.width, ab.height) / 2 - 1) {
              const corners = [[b.left - ab.left, b.top - ab.top], [ab.right - b.right, b.top - ab.top], [b.left - ab.left, ab.bottom - b.bottom], [ab.right - b.right, ab.bottom - b.bottom]];
              const [dx, dy] = corners.reduce((m, c) => Math.max(c[0], c[1]) < Math.max(m[0], m[1]) ? c : m);
              if (dx >= -0.5 && dy >= -0.5 && Math.max(dx, dy) < R) {
                const d = Math.max(dx, dy), want = Math.max(0, R - d), rr = rs[0];
                const ck = sel(A, 2) + '|' + sel(el, 2);
                if (!conc.has(ck)) conc.set(ck, { outer: sel(A, 2), R, inner: sel(el, 2), r: rr, inset: Math.round(d), want: Math.round(want), off: Math.round(rr - want), ok: Math.abs(rr - want) <= Math.max(3, R * 0.25) });
              }
            }
          }
        }
        o.n++;
      }
      if (s.boxShadow && s.boxShadow !== 'none') { const o = shadows.get(s.boxShadow) || { v: s.boxShadow, n: 0, ex: [] }; o.n++; if (o.ex.length < 4) { const q = sel(el, 2); if (!o.ex.includes(q)) o.ex.push(q); } shadows.set(s.boxShadow, o); }
      const kids = [...el.children].some(c => !c.closest('svg') && c.getBoundingClientRect().width > 0);
      if (kids && !/^inline$/.test(s.display)) {
        for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) add(p.replace('padding', 'padding-').toLowerCase(), r1(px(s[p])), el);
        if (/flex|grid/.test(s.display)) { add('row-gap', s.rowGap === 'normal' ? 0 : r1(px(s.rowGap)), el); add('column-gap', s.columnGap === 'normal' ? 0 : r1(px(s.columnGap)), el); }
      }
      for (const p of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']) { const v = r1(px(s[p])); if (v && (Math.abs(v) < 200 || !/Left|Right/.test(p))) add(p.replace('margin', 'margin-').toLowerCase(), v, el); }
    }
    return { radii: [...radii.values()].sort((a, b) => b.n - a.n).slice(0, 250), concentric: [...conc.values()].slice(0, 200), shadows: [...shadows.values()].sort((a, b) => b.n - a.n).slice(0, 60), spacing: Object.values(spacing).sort((a, b) => b.n - a.n).slice(0, 300) };
  }
  // side margins: the leftmost / rightmost painted-or-text content that is not full-bleed
  // is any part of el actually painted on top at 5 sample points (not under the app viewer, a sheet or a fixed bar)?
  // An element with pointer-events: none is skipped by elementFromPoint, so a hit on one of its ancestors also counts.
  function unoccluded(el) {
    const b = el.getBoundingClientRect(); const x0 = Math.max(0, b.left), y0 = Math.max(0, b.top), x1 = Math.min(innerWidth, b.right), y1 = Math.min(innerHeight, b.bottom);
    if (x1 - x0 < 1 || y1 - y0 < 1) return false;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const hit = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy); if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return true; }
    return false;
  }
  function margins(items, els) {
    const W = innerWidth; let L = Infinity, R = -Infinity; let Lsel = null, Rsel = null;
    const take = (x0, x1, s) => { if (x1 - x0 >= W - 1) return; if (x0 < 0 || x1 > W + 1) return; if (x0 < L) { L = x0; Lsel = s; } if (x1 > R) { R = x1; Rsel = s; } };
    for (const it of items) { const el = document.querySelector('[data-m4-id="' + it.id + '"]'); for (const r of it.rects) if (r.y + r.h > 0 && r.y < innerHeight && el && hitOk(el, { x: Math.max(0, r.x), y: Math.max(0, r.y), w: r.w, h: Math.min(r.h, innerHeight - Math.max(0, r.y)) })) take(r.x, r.x + r.w, it.sel); }
    for (const el of els) { const s = getComputedStyle(el); if (!painted(s)) continue; const b = el.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight || b.width < 24 || b.height < 16) continue; if (s.position === 'fixed' && (b.width > W * 0.8)) continue; if (!unoccluded(el)) continue; take(b.left, b.right, sel(el, 2)); }
    return { vw: W, left: L === Infinity ? null : r1(L), right: R === -Infinity ? null : r1(W - R), leftSel: Lsel, rightSel: Rsel };
  }
  const CHROME_RX = /tabbar|topbar|toolbar|sheet|pill|nav|header|fab|dock|bar\b|menu|popover|dialog|modal|toast|switcher|composer|floating|float|controls/i;
  function glass(els) {
    const out = [];
    for (const el of els) {
      if (el.closest('svg') && el.tagName !== 'svg') continue;
      const s = getComputedStyle(el); const bf = bfOf(s); const recipe = GLASS.some(c => el.classList.contains(c));
      if (!bf && !recipe) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      let pos = s.position; for (let e = el.parentElement; e && e !== document.body && !/fixed|sticky/.test(pos); e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') pos = p + '(ancestor)'; }
      const role = (el.closest('[role]') || {}).getAttribute ? el.closest('[role]').getAttribute('role') : null;
      const why = [];
      if (/fixed|sticky/.test(pos)) why.push(pos);
      if (CHROME_RX.test(el.id + ' ' + el.className)) why.push('name');
      if (/^(NAV|HEADER|FOOTER|DIALOG)$/.test(el.tagName)) why.push(el.tagName.toLowerCase());
      if (role && /dialog|navigation|toolbar|tablist|menu/.test(role)) why.push('role=' + role);
      const vx0 = Math.max(0, r.left), vy0 = Math.max(0, r.top), vx1 = Math.min(innerWidth, r.right), vy1 = Math.min(innerHeight, r.bottom);
      out.push({ sel: sel(el, 2), recipe, bf, position: pos, chrome: why.length > 0, why, w: Math.round(r.width), h: Math.round(r.height), area: Math.round(r.width * r.height), occluded: !unoccluded(el), visArea: unoccluded(el) ? Math.max(0, Math.round((vx1 - vx0) * (vy1 - vy0))) : 0, bg: rgba(s.backgroundColor), op: +opac(el).toFixed(3) });
    }
    return out;
  }
  function motion(els) {
    const tr = new Map(), an = new Map();
    for (const el of els) {
      const s = getComputedStyle(el);
      if (s.transitionDuration && s.transitionDuration.split(',').some(d => px(d) > 0)) {
        const k = [s.transitionProperty, s.transitionDuration, s.transitionTimingFunction, s.transitionDelay].join(' | ');
        const o = tr.get(k) || { prop: s.transitionProperty, dur: s.transitionDuration, ease: s.transitionTimingFunction, delay: s.transitionDelay, n: 0, ex: [] }; o.n++; if (o.ex.length < 3) { const q = sel(el, 2); if (!o.ex.includes(q)) o.ex.push(q); } tr.set(k, o);
      }
      if (s.animationName && s.animationName !== 'none') {
        const k = [s.animationName, s.animationDuration, s.animationTimingFunction, s.animationIterationCount].join(' | ');
        const o = an.get(k) || { name: s.animationName, dur: s.animationDuration, ease: s.animationTimingFunction, iter: s.animationIterationCount, delay: s.animationDelay, n: 0, ex: [] }; o.n++; if (o.ex.length < 3) { const q = sel(el, 2); if (!o.ex.includes(q)) o.ex.push(q); } an.set(k, o);
      }
    }
    // the declared transitions/animations in this document's stylesheets (covers :active/:hover states computed style cannot see)
    const css = []; const kf = new Set();
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      const file = (sh.href || 'inline').split('/').pop();
      const walk = (rs, media) => { for (const r of rs) {
        if (r.type === 7 || (r.constructor && r.constructor.name === 'CSSKeyframesRule')) { kf.add(r.name); continue; }
        if (r.style && r.selectorText) for (const p of ['transition', 'transition-duration', 'animation', 'animation-duration', 'transform']) { const v = r.style.getPropertyValue(p); if (v && (p !== 'transform' || /:active|:hover|pressed/.test(r.selectorText))) css.push({ file, sel: r.selectorText.slice(0, 80), prop: p, v: v.slice(0, 120), media: media || null }); }
        if (r.cssRules) walk(r.cssRules, r.conditionText || r.media && r.media.mediaText || media);
      } };
      walk(rules, null);
    }
    return { transitions: [...tr.values()].sort((a, b) => b.n - a.n), animations: [...an.values()].sort((a, b) => b.n - a.n), css: css.slice(0, 400), keyframes: [...kf] };
  }
  function targets(els) {
    const out = []; const seen = new Set();
    const q = IA + ', .switch, .tile, .pcard';
    for (const el of document.querySelectorAll(q)) {
      if (seen.has(el) || !shown(el) || el.closest('svg') && el.tagName !== 'svg') continue; seen.add(el);
      if (el.tagName === 'LABEL' && el.control && seen.has(el.control)) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (opac(el) < 0.05) continue;
      let w = r.width, h = r.height;
      for (const pe of ['::before', '::after']) { const b = getComputedStyle(el, pe); if (b && b.content && b.content !== 'none' && b.position === 'absolute') { const t = px(b.top), bo = px(b.bottom), l = px(b.left), ri = px(b.right); if (b.top !== 'auto' && b.bottom !== 'auto') h = Math.max(h, r.height - t - bo); if (b.left !== 'auto' && b.right !== 'auto') w = Math.max(w, r.width - l - ri); } }
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
      const s = getComputedStyle(el);
      out.push({ sel: sel(el), tag: el.tagName.toLowerCase(), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), effW: Math.round(w), effH: Math.round(h), small: Math.min(w, h) < 44, inline, disabled: !!el.disabled, onscreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, visible: unoccluded(el), cursor: s.cursor });
    }
    return out;
  }
  function tells(els) {
    const ia = [...document.querySelectorAll(IA + ', .tile, .pcard, .card')].filter(shown);
    const hist = { tapHighlight: {}, userSelect: {}, touchCallout: {}, touchAction: {} }; const offenders = { tapHighlight: [], userSelect: [], touchCallout: [] };
    for (const el of ia) {
      const s = getComputedStyle(el);
      const thc0 = s.webkitTapHighlightColor || s.getPropertyValue('-webkit-tap-highlight-color'); const thd = thc0 ? null : declared(el, '-webkit-tap-highlight-color'); const th = thc0 || 'declared:' + thd.v;
      const us = s.webkitUserSelect || s.userSelect || s.getPropertyValue('-webkit-user-select') || '(unsupported)';
      const tc0 = s.webkitTouchCallout || s.getPropertyValue('-webkit-touch-callout'); const tcd = tc0 ? null : declared(el, '-webkit-touch-callout'); const tc = tc0 || 'declared:' + tcd.v;
      hist.tapHighlight[th] = (hist.tapHighlight[th] || 0) + 1; hist.userSelect[us] = (hist.userSelect[us] || 0) + 1; hist.touchCallout[tc] = (hist.touchCallout[tc] || 0) + 1; hist.touchAction[s.touchAction] = (hist.touchAction[s.touchAction] || 0) + 1;
      const thv = th.replace(/^declared:/, ''); const thc = thv === '(UA default)' ? [0, 0, 0, 1] : rgba(thv); if (thc[3] > 0 && offenders.tapHighlight.length < 12) offenders.tapHighlight.push({ sel: sel(el, 2), v: th, rule: thd && thd.sel });
      if (!/none/.test(us) && offenders.userSelect.length < 12 && !el.matches('input, textarea, [contenteditable]')) offenders.userSelect.push({ sel: sel(el, 2), v: us });
      if (tc.replace(/^declared:/, '') !== 'none' && offenders.touchCallout.length < 12) offenders.touchCallout.push({ sel: sel(el, 2), v: tc, rule: tcd && tcd.sel });
    }
    const cs = e => getComputedStyle(e);
    const bgOf = e => { const s = cs(e); return { c: rgba(s.backgroundColor), img: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 80) : null }; };
    const ovs = e => { const o = overscroll(e); return { overscrollX: o.x, overscrollY: o.y, overscrollSrc: o.src }; };
    const root = { html: { ...ovs(document.documentElement), ...bgOf(document.documentElement), colorScheme: cs(document.documentElement).colorScheme }, body: document.body ? { ...ovs(document.body), position: cs(document.body).position, ...bgOf(document.body), userSelect: cs(document.body).webkitUserSelect || cs(document.body).userSelect, touchCallout: cs(document.body).webkitTouchCallout || null } : null };
    const sc = [];
    const se = document.scrollingElement || document.documentElement;
    for (const el of [se, ...els]) {
      const s = cs(el); const isSe = el === se;
      const y = isSe ? el.scrollHeight > el.clientHeight + 1 : (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1);
      const x = isSe ? el.scrollWidth > el.clientWidth + 1 : (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
      if (!y && !x) continue;
      const vbar = isSe ? innerWidth - document.documentElement.clientWidth : el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth);
      const hbar = isSe ? innerHeight - document.documentElement.clientHeight : el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth);
      sc.push({ sel: isSe ? 'scrollingElement' : sel(el, 2), y, x, ...ovs(el), scrollbarWidth: s.scrollbarWidth || null, vbar: Math.round(vbar), hbar: Math.round(hbar), ...bgOf(el), sw: el.scrollWidth, cw: el.clientWidth });
      if (sc.length >= 20) break;
    }
    let scrollbarCss = false; for (const sh of document.styleSheets) { try { if ([...sh.cssRules].some(r => /scrollbar/.test(r.cssText))) { scrollbarCss = true; break; } } catch {} }
    const forms = [];
    for (const el of document.querySelectorAll('select, input[type=checkbox], input[type=radio], input[type=range], input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week], input[type=color], input[type=number], input[type=search], input[type=file], progress, meter')) {
      if (!shown(el)) continue; const b = el.getBoundingClientRect(); const s = cs(el);
      const ap = s.appearance || s.webkitAppearance || s.getPropertyValue('-webkit-appearance');
      forms.push({ sel: sel(el, 2), type: el.type || el.tagName.toLowerCase(), appearance: ap, native: ap !== 'none', w: Math.round(b.width), h: Math.round(b.height), visible: b.width > 1 && b.height > 1 && opac(el) > 0.05 });
    }
    const links = [];
    for (const a of document.querySelectorAll('a[href]')) {
      if (!shown(a)) continue; const s = cs(a); const c = rgba(s.color); const deco = s.textDecorationLine;
      const blue = c[2] > 150 && c[2] > c[0] + 60 && c[2] > c[1] + 20;
      links.push({ sel: sel(a, 2), text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), color: c, underline: /underline/.test(deco), blue, tell: blue && /underline/.test(deco) });
    }
    return { interactive: ia.length, hist, offenders, root, scrollers: sc, scrollbarCss, forms, links: links.slice(0, 40) };
  }
  function meta() {
    const d = document.documentElement.dataset;
    let hubTheme = null, hubScheme = null, profile = null, canWrite = null; try { hubTheme = window.hub && hub.theme && hub.theme(); hubScheme = window.hub && hub.scheme && hub.scheme(); profile = window.hub && hub.profile ? { id: hub.profile.id, kind: hub.profile.kind, color: hub.profile.color } : null; canWrite = window.hub ? !!hub.canWrite : null; } catch {}
    let ls = null; try { ls = localStorage.getItem('hub.theme'); } catch {}
    return { url: location.pathname + location.hash, theme: d.theme || null, scheme: d.scheme || null, kind: d.kind || null, hubTheme, hubScheme, lsTheme: ls, profile, canWrite, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), vw: innerWidth, vh: innerHeight, dsBody: !!(document.body && document.body.classList.contains('ds')), prefersDark: matchMedia('(prefers-color-scheme: dark)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
  }
  function staticAll() {
    const els = visibleEls();
    const tx = texts();
    return { meta: meta(), tokens: tokens(), boxes: boxes(els), margins: margins(tx, els), glass: glass(els), motion: motion(els), targets: targets(els), tells: tells(els), inventory: tx.map(({ rects, ...x }) => ({ ...x, rect: rects[0] })) };
  }
  async function settleAnimations(ms = 1500) {
    const list = (document.getAnimations ? document.getAnimations() : []).filter(a => { const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming(); return t && t.iterations !== Infinity && a.playState === 'running'; });
    await Promise.race([Promise.all(list.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, ms))]);
    return list.length;
  }
  // ── sampling (runs in the top page): shown + hidden screenshots, page-coordinate rects ──
  async function decode(b64) { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; }
  const pix = (I, x, y) => { x = Math.max(0, Math.min(I.w - 1, Math.round(x))); y = Math.max(0, Math.min(I.h - 1, Math.round(y))); const i = (y * I.w + x) * 4; return [I.d[i], I.d[i + 1], I.d[i + 2]]; };
  const medianBy = (arr, f) => { if (!arr.length) return null; const s = arr.map(v => [f(v), v]).sort((a, b) => a[0] - b[0]); return s[Math.floor(s.length / 2)][1]; };
  async function sample(shownB64, hiddenB64, items, icons, ctls, gfx) {
    const H = await decode(hiddenB64); const S = shownB64 ? await decode(shownB64) : null;
    const tOut = [];
    for (const it of items) {
      const cs = [], bgs = [];
      // v2: only the columns of the occlusion grid whose topmost element is the text (it.mask null = all uncovered)
      const M = it.mask ? new Set(it.mask.ok.map(([ri, ci]) => ri * 4096 + ci)) : null; const cw = it.mask ? it.mask.cs : 1;
      it.rects.forEach((r, ri) => {
        const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(H.w, Math.ceil(r.x + r.w)), y1 = Math.min(H.h, Math.ceil(r.y + r.h));
        if (x1 - x0 < 1 || y1 - y0 < 1) return;
        const step = Math.max(1, Math.floor(Math.sqrt((x1 - x0) * (y1 - y0) / 400)));
        for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { if (M && !M.has(ri * 4096 + Math.max(0, Math.floor((x + 0.5 - r.x) / cw)))) continue; const i = (y * H.w + x) * 4; bgs.push([H.d[i], H.d[i + 1], H.d[i + 2]]); }
      });
      if (!bgs.length) continue;
      const a = it.color[3] * it.op;
      for (const bg of bgs) cs.push(ratio(blend(it.color, a, bg), bg));
      const order = cs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
      const p10 = order[Math.floor(order.length * 0.1)], med = order[Math.floor(order.length * 0.5)];
      tOut.push({ key: it.key, p10: +p10[0].toFixed(2), med: +med[0].toFixed(2), bgP10: bgs[p10[1]], bgMed: bgs[med[1]], alpha: +a.toFixed(3), n: bgs.length });
    }
    const iOut = [];
    if (S) for (const ic of icons) {
      const r = ic.rect; const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(H.w, Math.ceil(r.x + r.w)), y1 = Math.min(H.h, Math.ceil(r.y + r.h));
      const step = Math.max(1, Math.floor(Math.sqrt((x1 - x0) * (y1 - y0) / 2500)));
      const fg = [], bg = [];
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const i = (y * H.w + x) * 4; const h = [H.d[i], H.d[i + 1], H.d[i + 2]], s = [S.d[i], S.d[i + 1], S.d[i + 2]]; bg.push(h); const diff = Math.max(Math.abs(h[0] - s[0]), Math.abs(h[1] - s[1]), Math.abs(h[2] - s[2])); if (diff > 24) fg.push({ s, h, c: ratio(s, h) }); }
      if (!bg.length) continue;
      const bgMed = medianBy(bg, lum);
      if (fg.length < 3) { iOut.push({ key: ic.key, ink: 0, ratio: null, bgMed }); continue; }
      fg.sort((a, b) => a.c - b.c);
      const p90 = fg[Math.floor(fg.length * 0.9)], med = fg[Math.floor(fg.length * 0.5)];
      iOut.push({ key: ic.key, ink: +(fg.length / bg.length).toFixed(3), ratio: +p90.c.toFixed(2), ratioMed: +med.c.toFixed(2), inkRgb: p90.s, bgMed });
    }
    const cOut = [];
    for (const c of ctls) {
      const r = c.rect; const inset = Math.max(2, c.bw + 2), out = 3; const inner = [], outer = [], border = [];
      for (const f of [0.3, 0.5, 0.7]) {
        const xs = r.x + r.w * f, ys = r.y + r.h * f;
        inner.push(pix(H, xs, r.y + inset), pix(H, xs, r.y + r.h - 1 - inset), pix(H, r.x + inset, ys), pix(H, r.x + r.w - 1 - inset, ys));
        outer.push(pix(H, xs, r.y - out), pix(H, xs, r.y + r.h - 1 + out), pix(H, r.x - out, ys), pix(H, r.x + r.w - 1 + out, ys));
        if (c.bw >= 1) border.push(pix(H, xs, r.y + c.bw / 2 - 0.5), pix(H, r.x + c.bw / 2 - 0.5, ys));
      }
      const iM = medianBy(inner, lum), oM = medianBy(outer, lum);
      const fillRatio = +ratio(iM, oM).toFixed(2);
      let borderRatio = null, borderRendered = null;
      if (c.bw >= 1 && c.bc[3] > 0) { borderRatio = +ratio(blend(c.bc, c.bc[3] * c.op, oM), oM).toFixed(2); const bM = medianBy(border, lum); borderRendered = +ratio(bM, oM).toFixed(2); }
      cOut.push({ key: c.key, fillRatio, borderRatio, borderRendered, boundary: Math.max(fillRatio, borderRatio || 0, borderRendered || 0), innerMed: iM, outerMed: oM });
    }
    // v2 graphics: computed paint (alpha-composited over each adjacent group's median pixel) or, for gradients, the
    // paint pixels, against that median; ratio = best group (the shape is told apart from at least one neighbour),
    // ratioMin = worst group. A bar compares its fill with the visible track (or with the surround when it is full).
    const gOut = [];
    if (S) for (const g of gfx || []) {
      const med = pts => { const v = (pts || []).filter(([x, y]) => x >= 0 && y >= 0 && x < S.w && y < S.h).map(([x, y]) => pix(S, x, y)); return v.length ? medianBy(v, lum) : null; };
      const paintPx = g.pts.paint ? g.pts.paint.filter(([x, y]) => x >= 0 && y >= 0 && x < S.w && y < S.h).map(([x, y]) => pix(S, x, y)) : [];
      let groups = g.groups && g.groups.length ? g.groups : Object.keys(g.pts).filter(k => !['paint', 'trackOut', 'inside'].includes(k));
      if (g.kind === 'bar' && !(g.groups && g.groups.length)) groups = ['trackOut'];
      const per = {};
      for (const k of groups) {
        const a = med(g.pts[k]); if (!a) continue;
        let r, best = null, worst = null;
        if (g.paint && !g.gradient) r = ratio(blend(g.paint, g.alpha, a), a);
        else if (paintPx.length) { const rs = paintPx.map(p => ratio(p, a)).sort((x, y) => x - y); r = rs[Math.floor(rs.length / 2)]; best = +rs[rs.length - 1].toFixed(2); worst = +rs[0].toFixed(2); }
        else continue;
        per[k] = { adj: a, ratio: +r.toFixed(2), ...(best != null ? { best, worst } : {}) };
      }
      const vals = Object.values(per).map(v => v.ratio);
      const o = { key: g.key, per, ratio: vals.length ? Math.max(...vals) : null, ratioMin: vals.length ? Math.min(...vals) : null };
      if (paintPx.length) { const bs = Object.values(per).filter(v => v.best != null); if (bs.length) o.ratioBest = Math.max(...bs.map(v => v.best)); const ls = [...paintPx].sort((x, y) => lum(x) - lum(y)); o.paintLight = ls[ls.length - 1]; o.paintDark = ls[0]; }
      if (g.kind === 'ring' && g.pts.inside) { const a = med(g.pts.inside); if (a) { o.inside = a; o.ratioInside = +ratio(blend(g.paint, g.alpha, a), a).toFixed(2); } }
      if (g.kind === 'bar') { const t = med(g.pts.track), u = med(g.pts.trackOut); if (t && u) o.trackVsSurround = +ratio(t, u).toFixed(2); if (u) o.surround = u; if (t) o.trackPx = t; }
      if (g.kind === 'stroke' && g.track) { const a = per.outer ? per.outer.adj : med(g.pts.outer); if (a) { const tc = blend(g.track.paint, g.track.alpha, a); o.vsTrack = +ratio(blend(g.paint, g.alpha, tc), tc).toFixed(2); } }
      gOut.push(o);
    }
    return { texts: tOut, icons: iOut, controls: cOut, graphics: gOut };
  }
  window.__m4 = { loadDecl, rgba, ratio, lum, texts, visibleTexts, icons, controls, graphics, visibleG, visibleOf, hide, markIcons, unmarkIcons, scrollers, scrollTo, staticAll, tokens, meta, settleAnimations, sample };
}
