// Phase 4 COLOR, completeness follow-up: text contrast in the non-resting states (hover, press, keyboard focus) and in
// pseudo-element text, which the rig (resting states only) did not measure. Desktop 1440×900, Chromium, one theme key per run.
//
// Method. In every document (the shell page and the app frame) every author rule whose selector uses :hover, :active,
// :focus or :focus-visible is cloned with the pseudo-class replaced by a class (.__fh / .__fa / .__ff / .__fv), inserted
// right after the original so specificity and cascade order are unchanged (same-origin sheets; Prayer's Google Fonts
// sheet is cross-origin and has no state rules). The targets of each cloned rule are the elements that match its
// selector with the state removed. A state is applied the way the browser applies it: hover and active on the target and
// all its ancestors, focus on the target only. Transitions and animations are switched off for the sweep. A target is
// kept only if applying the state changes a text colour, an opacity or a background under its text. For each kept
// target, resting and in-state: every text node's line boxes are sampled with all text hidden (1x CSS screenshot), the
// computed text colour (opacity chain included) is blended over each background pixel, and p10 / median WCAG ratios are
// reported; the verdict uses the median against 4.5 (3.0 for large text: 24 px, or 18.66 px bold).
// Pseudo-element text: every ::before / ::after whose content is a string or attr() is listed with its colour, size and
// background, and its ratio is computed against its own background composited over the element's resolved background.
//
// Usage: node audits/tools/phase4/COLOR/states-sweep.mjs <theme>:<os> [areas] [profile]   e.g. system:light, hearth:dark, midnight:light
//        (profile: run every area as that person, e.g. kiara; the output file then ends in -<profile>)
//        → audits/evidence/p4/COLOR/states/<theme>-<os>.json ; summarise with node audits/tools/phase4/COLOR/states-summary.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const [theme, os] = (process.argv[2] || 'system:light').split(':');
const WHO = process.argv[4] || null;
const AREAS = (process.argv[3] || 'shell-home,shell-apps,shell-me,shell-picker,tally,timer,kidverse,verses,f260,prayer,leftovers,dollywood,dollywood-live').split(',');
const OUT = path.join(ROOT, 'audits/evidence/p4/COLOR/states'); fs.mkdirSync(OUT, { recursive: true });

const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// ── in-page helpers (installed once per document) ─────────────────────────────
const INSTALL = () => {
  if (window.__ss) return window.__ss.cloned;
  const MAP = [['hover', /:hover(?![-\w])/g, '.__fh'], ['active', /:active(?![-\w])/g, '.__fa'], ['focus', /:focus-visible(?![-\w])/g, '.__fv'], ['focus', /:focus(?![-\w])/g, '.__ff']];
  const rules = []; let cloned = 0;
  const walk = (list, parent) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r instanceof CSSStyleRule) {
        if (!/:(hover|active|focus)/.test(r.selectorText)) continue;
        let sel = r.selectorText; const states = new Set();
        for (const [st, re, c] of MAP) if (re.test(sel)) { states.add(st); sel = sel.replace(re, c); }
        if (!states.size) continue;
        try { parent.insertRule(sel + '{' + r.style.cssText + '}', i + 1); cloned++; rules.push({ sel, states: [...states] }); } catch {}
      } else if (r.cssRules) { try { walk(r.cssRules, r); } catch {} }
    }
  };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, sh); } catch {} }
  const st = document.createElement('style'); st.id = '__ss_nt';
  st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.append(st);
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const path = e => { const p = []; for (let n = e; n && n.nodeType === 1 && p.length < 4; n = n.parentElement) p.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).filter(c => !c.startsWith('__f')).slice(0, 3).join('.') : '')); return p.join(' > '); };
  const targets = { hover: new Set(), active: new Set(), focus: new Set() };
  const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';
  for (const { sel, states } of rules) {
    const bare = sel.replace(/\.__f[hafv]/g, '').replace(/(^|[\s>+~,(])(?=[\s>+~,)]|$)/g, '$1*').trim();
    let els = []; try { els = [...document.querySelectorAll(bare || '*')]; } catch { continue; }
    for (const st of states) for (const e of els) { if (st === 'focus' && !e.matches(FOCUSABLE)) continue; if (targets[st].size < 2500) targets[st].add(e); }
  }
  const CLS = { hover: '__fh', active: '__fa', focus: ['__ff', '__fv'] };
  const apply = (e, st, on) => {
    const cls = [].concat(CLS[st]);
    if (st === 'focus') { for (const c of cls) e.classList.toggle(c, on); return; }
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) for (const c of cls) n.classList.toggle(c, on);
  };
  const carriers = e => { const out = []; const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) { if (!t.data.trim()) continue; const p = t.parentElement; if (!p || !vis(p)) continue; out.push(t); if (out.length > 12) break; } return out; };
  const snap = (e, texts) => {
    const s = []; for (const t of texts) { const p = t.parentElement, cs = getComputedStyle(p); let op = 1; for (let n = p; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity; s.push(cs.color + '|' + op.toFixed(3) + '|' + cs.webkitTextFillColor); }
    for (let n = texts[0] ? texts[0].parentElement : e; n; n = n.parentElement) { const cs = getComputedStyle(n); s.push(cs.backgroundColor + cs.backgroundImage + cs.opacity + cs.filter); if (n === e) break; }
    const cs = getComputedStyle(e); s.push(cs.backgroundColor + cs.backgroundImage + cs.opacity + cs.filter); return s.join('~');
  };
  const read = texts => texts.map(t => {
    const p = t.parentElement, cs = getComputedStyle(p); let op = 1; for (let n = p; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    const r = document.createRange(); r.selectNodeContents(t);
    const rects = [...r.getClientRects()].filter(b => b.width > 1 && b.height > 1).slice(0, 4).map(b => [b.x, b.y + b.height * .2, b.width, b.height * .6]);
    return { text: t.data.trim().slice(0, 32), color: cs.color, opacity: +op.toFixed(3), fs: parseFloat(cs.fontSize), fw: +cs.fontWeight || 400, rects };
  });
  window.__ss = { cloned, targets, apply, carriers, snap, read, vis, path };
  return cloned;
};

async function sweepDoc(d, doc, area, res) {
  const off = doc === d.page ? [0, 0] : await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
  const cloned = await doc.evaluate(INSTALL);
  const counts = await doc.evaluate(() => Object.fromEntries(Object.entries(window.__ss.targets).map(([k, v]) => [k, v.size])));
  const R = { area, cloned, targets: counts, changed: [], pseudo: [] };
  for (const st of ['hover', 'active', 'focus']) {
    const n = counts[st];
    for (let i = 0; i < n; i++) {
      // 1. does the state change anything under this target's text?
      const pre = await doc.evaluate(({ st, i }) => {
        const S = window.__ss, e = [...S.targets[st]][i];
        if (!e || !e.isConnected || !S.vis(e)) return null;
        e.scrollIntoView({ block: 'center', inline: 'nearest' });
        const texts = S.carriers(e); if (!texts.length) return null;
        const a = S.snap(e, texts); S.apply(e, st, true); const b = S.snap(e, texts); S.apply(e, st, false);
        return a === b ? null : { path: S.path(e) };
      }, { st, i }).catch(() => null);
      if (!pre) continue;
      const one = { state: st, path: pre.path };
      for (const phase of ['rest', st]) {
        const info = await doc.evaluate(({ st, i, on }) => {
          const S = window.__ss, e = [...S.targets[st]][i]; S.apply(e, st, on);
          const texts = S.carriers(e); const r = S.read(texts); const b = e.getBoundingClientRect();
          const h = document.createElement('style'); h.id = '__ss_hide'; h.textContent = '*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}'; document.head.append(h);
          return { r, box: [b.x, b.y, b.width, b.height] };
        }, { st, i, on: phase !== 'rest' });
        await sleep(40);
        const [bx, by, bw, bh] = info.box;
        const clip = { x: Math.max(0, bx + off[0] - 2), y: Math.max(0, by + off[1] - 2), width: Math.max(4, Math.min(1440 - Math.max(0, bx + off[0] - 2), bw + 4)), height: Math.max(4, Math.min(900 - Math.max(0, by + off[1] - 2), bh + 4)) };
        let buf = null; if (clip.y < 900 && clip.x < 1440) { try { buf = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' }); } catch {} }
        const img = buf ? png(buf) : null;
        await doc.evaluate(({ st, i }) => { document.getElementById('__ss_hide')?.remove(); const S = window.__ss, e = [...S.targets[st]][i]; S.apply(e, st, false); }, { st, i });
        const texts = [];
        for (const t of info.r) {
          const m = t.color.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m || !img) continue;
          const srgb = /^color\(srgb/.test(t.color), c = m.map(Number), fg = c.slice(0, 3).map(v => srgb ? v * 255 : v), a = (c.length > 3 ? c[3] : 1) * t.opacity;
          if (a < .05) continue;
          const rs = [], bgs = [];
          for (const [x, y, w, h] of t.rects) for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) {
            const px = Math.round(xx + off[0] - clip.x), py = Math.round(yy + off[1] - clip.y); if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
            const bg = img.at(px, py), tc = fg.map((v, k) => v * a + bg[k] * (1 - a)); rs.push(ratio(tc, bg)); bgs.push(bg);
          }
          if (!rs.length) continue;
          rs.sort((p, q) => p - q); bgs.sort((p, q) => lum(p) - lum(q));
          const large = t.fs >= 24 || (t.fs >= 18.66 && t.fw >= 700);
          const med = rs[rs.length >> 1];
          texts.push({ text: t.text, fs: t.fs, fw: t.fw, large, color: t.color, alpha: +a.toFixed(3), bg: hex(bgs[bgs.length >> 1]), p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +med.toFixed(2), fail: med < (large ? 3 : 4.5) });
        }
        one[phase === 'rest' ? 'rest' : 'inState'] = texts;
      }
      // keep only texts whose in-state pair differs from rest
      const restBy = Object.fromEntries((one.rest || []).map(t => [t.text + t.fs, t]));
      one.inState = (one.inState || []).map(t => ({ ...t, restMedian: restBy[t.text + t.fs] ? restBy[t.text + t.fs].median : null }));
      one.newFail = one.inState.some(t => t.fail && !(restBy[t.text + t.fs] && restBy[t.text + t.fs].fail));
      delete one.rest;
      if (one.inState.length) R.changed.push(one);
    }
  }
  // 2. pseudo-element text
  R.pseudo = await doc.evaluate(() => {
    const out = []; const S = window.__ss;
    const parse = c => { const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m) return [0, 0, 0, 0]; const v = m.map(Number); const s = /^color\(srgb/.test(c); return [...v.slice(0, 3).map(x => s ? x * 255 : x), v.length > 3 ? v[3] : 1]; };
    const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(k => top[k] * a + under[k] * (1 - a)).concat(1); };
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
    const base = e => { const chain = []; for (let n = e; n; n = n.parentElement) chain.unshift(n); let c = parse(getComputedStyle(document.documentElement).backgroundColor); if (c[3] < 1) c = over(c, [255, 255, 255, 1]); for (const n of chain) { const b = parse(getComputedStyle(n).backgroundColor); if (b[3] > 0) c = over(b, c); } return c; };
    for (const e of document.querySelectorAll('body *')) {
      if (!S.vis(e)) continue;
      for (const which of ['::before', '::after']) {
        const cs = getComputedStyle(e, which); const ct = cs.content;
        if (!ct || ct === 'none' || ct === 'normal' || ct === '""' || !/[A-Za-z0-9]/.test(ct.replace(/^"|"$/g, '')) && !/attr\(/.test(ct)) continue;
        if (cs.display === 'none') continue;
        let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        const under = over(parse(cs.backgroundColor), base(e)); const fg = parse(cs.color); fg[3] *= op * (+cs.opacity || 1);
        const r = ratio(over(fg, under), under); const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400; const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        out.push({ path: S.path(e) + which, content: ct.slice(0, 30), fs, fw, color: cs.color, bg: cs.backgroundColor, ratio: +r.toFixed(2), fail: r < (large ? 3 : 4.5) });
        if (out.length > 60) return out;
      }
    }
    return out;
  });
  res.push(R);
  console.log(`${theme}:${os} ${area}: cloned ${cloned}, targets ${JSON.stringify(counts)}, changed ${R.changed.length} (new fails ${R.changed.filter(c => c.newFail).length}), pseudo ${R.pseudo.length}`);
}

const L = await local({ variant: 'typical', engine: 'chromium' });
const res = [];
try {
  if (theme !== 'system') for (const p of WHO ? [WHO] : ['eli', 'ezra']) { const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme PUT ' + r.status); }
  const ls = theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {};
  for (const area of AREAS) {
    const profile = area === 'shell-picker' ? null : WHO || (area === 'kidverse' ? 'ezra' : 'eli');
    const d = await L.device({ device: 'desktop', mode: os, profile, localStorage: ls });
    try {
      if (area.startsWith('shell-')) {
        await d.goto(area === 'shell-picker' ? '' : '#' + area.slice(6)); await sleep(2500);
        await sweepDoc(d, d.page, area, res);
      } else {
        const f = await d.openApp(area); await sleep(area.startsWith('dollywood') ? 9000 : 3500);
        await sweepDoc(d, f, area, res);
      }
      const applied = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme }));
      res[res.length - 1].applied = applied;
    } catch (e) { res.push({ area, error: String(e).slice(0, 300) }); console.log(area, 'error', String(e).slice(0, 200)); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `${theme}-${os}${WHO ? '-' + WHO : ''}.json`), JSON.stringify({ theme, os, profile: WHO || 'eli (kidverse: ezra)', device: 'desktop', engine: 'chromium', at: new Date().toISOString(), areas: res }, null, 1));
