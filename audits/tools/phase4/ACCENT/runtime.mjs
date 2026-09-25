#!/usr/bin/env node
// Phase 4 ACCENT — runtime: sign in as EACH profile, in every theme key, run the Phase 1 screen scripts
// (audits/tools/areas/*.mjs, imported read-only, the same go() the capture rig uses) and, in the shell page and the app
// frame, find every painted element whose colour comes from the person's colour: the signed-in accent set
// (--accent, --accent-deep, --accent-soft, --accent-tint, resolved in that document) or the per-element person/app colour
// (--tint / --tint-ink set inline by index.html and kidverse). For each one: which CSS property carries it, and its
// rendered contrast — text: the computed ink over the pixels under the text with all text hidden (p10 and median);
// non-text (ring, border, fill, stroke, box-shadow): the paint against the nearest opaque declared background and
// against the pixels 3-5 px outside the element.
//
//   node audits/tools/phase4/ACCENT/runtime.mjs [--themes system-light,midnight] [--profiles eli,kiara] [--only shell:home]
//        [--parallel 4] [--park] [--force]
//   → audits/evidence/p4/ACCENT/runtime/<theme>/<profile>/<area>--<screen>.json (git-ignored scratch is not needed: each is small)
//   Resumable: an existing output is skipped unless --force. Local rig only (lib/local.mjs); production is blocked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { decodePng, at } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT', 'runtime');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = n => argv.includes('--' + n);
const THEME_KEYS = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], 'hearth-dark': ['hearth', 'dark'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'light'], forest: ['forest', 'light'] };
const themes = (opt('themes') || Object.keys(THEME_KEYS).join(',')).split(',');
const PARK = flag('park');
const ADULTS = ['eli', 'christian', 'mom', 'dad', 'niece'];
const KIDS = ['ezra', 'kiara'];
const profiles = (opt('profiles') || [...ADULTS, ...KIDS, 'tv', 'signed-out'].join(',')).split(',');
const ONLY = opt('only') ? opt('only').split(',') : null;
const PAR = +opt('parallel', 4);
const FORCE = flag('force');

const ADULT_SCREENS = PARK
  ? [['dollywood-live', 'map'], ['dollywood-live', 'family'], ['dollywood-live', 'nearby'], ['shell', 'home-park']]
  : [['shell', 'home'], ['shell', 'home-lower'], ['shell', 'apps'], ['shell-me', 'me'], ['shell-me', 'me-appearance'], ['shell-me', 'chat'],
     ['f260', 'today'], ['leftovers', 'main'], ['prayer', 'today'], ['prayer', 'kitchen'], ['prayer', 'today-family'], ['tally', 'main'],
     ['timer', 'running'], ['verses', 'trainer'], ['kidverse', 'adult'], ['dollywood', 'map'], ['timer', 'idle']];      // idle last: it clears timer.active first
const KID_SCREENS = PARK
  ? [['dollywood-live', 'kid'], ['shell', 'home-kid-park']]
  : [['shell', 'home-kid'], ['shell', 'apps-kid'], ['prayer', 'kid'], ['tally', 'kid'], ['timer', 'kid'], ['verses', 'kid'], ['kidverse', 'kid'], ['leftovers', 'kid']];
const SPECIAL = PARK ? {} : { tv: [['tv', 'board']], 'signed-out': [['shell', 'picker'], ['shell', 'pin-entry']] };

// ── area screens (read-only import) ─────────────────────────────────────────────────────────────────────────────────
const areaCache = {};
async function screenDef(area, screen) {
  if (!areaCache[area]) areaCache[area] = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', area + '.mjs')).href);
  const s = areaCache[area].screens.find(x => x.screen === screen);
  if (!s) throw new Error(`no screen ${area}:${screen}`);
  return s;
}

// ── in-page scan ────────────────────────────────────────────────────────────────────────────────────────────────────
function scanDoc(opts) {
  const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  (document.body || document.documentElement).appendChild(probe);
  const num = s => { const m = String(s).match(/-?[\d.]+(?:e-?\d+)?%?/g) || []; return m.map(v => v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)); };
  const parseAll = str => {
    const out = []; if (!str || str === 'none') return out;
    const re = /rgba?\(([^)]*)\)|color\(srgb ([^)]*)\)/g; let m;
    while ((m = re.exec(str))) {
      if (m[1] != null) { const n = num(m[1]); out.push([n[0], n[1], n[2], n[3] == null ? 1 : n[3]]); }
      else { const parts = m[2].split('/'); const n = num(parts[0]); out.push([n[0] * 255, n[1] * 255, n[2] * 255, parts[1] ? num(parts[1])[0] : 1]); }
    }
    return out;
  };
  const resolve = v => { probe.style.color = ''; probe.style.color = v; const c = parseAll(getComputedStyle(probe).color)[0]; return c || null; };
  const rootTok = n => resolve(`var(${n})`);
  const S = { accent: rootTok('--accent'), deep: rootTok('--accent-deep'), soft: rootTok('--accent-soft'), tint: rootTok('--accent-tint'), on: rootTok('--on-accent'), surface: rootTok('--surface'), bg: rootTok('--bg'), text: rootTok('--text') };
  const near = (a, b, tol = 2.6) => a && b && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
  const cache = new Map();
  const tintSet = (el) => {                      // the nearest inline --tint / --tint-ink (a person or app colour)
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const t = e.style && e.style.getPropertyValue('--tint');
      if (t) {
        const key = t + '|' + (e.style.getPropertyValue('--tint-ink') || '');
        if (!cache.has(key)) {
          const tc = resolve(t.trim()); const ti = e.style.getPropertyValue('--tint-ink') ? resolve(e.style.getPropertyValue('--tint-ink').trim().replace(/var\(--text\)/, getComputedStyle(document.documentElement).getPropertyValue('--text').trim())) : null;
          const hex = tc ? '#' + tc.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
          cache.set(key, { raw: t.trim(), hex, tint: tc, ink: ti, soft: tc ? tc.slice(0, 3).map((v, i) => v * 0.14 + S.surface[i] * 0.86) : null, ring18: tc ? tc.slice(0, 3).map((v, i) => v * 0.18) : null });
        }
        return { host: e, ...cache.get(key) };
      }
    }
    return null;
  };
  const vw = innerWidth, vh = innerHeight;
  const sel = el => { const p = []; let e = el; for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const cl = [...(e.classList || [])].slice(0, 2); if (cl.length) s += '.' + cl.join('.'); p.unshift(s); if (e.id) break; } return p.join(' > '); };
  const opac = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const declBg = el => {                         // nearest opaque declared background (composited), and whether a gradient/image intervened
    const layers = []; let img = null;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !img) img = sel(e);
      const c = parseAll(cs.backgroundColor)[0];
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    let base = S.bg ? S.bg.slice(0, 3) : [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = base.map((v, k) => c[k] * c[3] + v * (1 - c[3])); }
    return { c: base, img };
  };
  const recs = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (recs.length > 600) break;
    if (el === probe || el.closest('script,style,template,noscript')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const op = opac(el); if (op < 0.05) continue;
    const isSvg = el instanceof SVGElement;
    const props = {
      color: cs.color, 'background-color': cs.backgroundColor, 'background-image': cs.backgroundImage,
      border: parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 ? `${cs.borderTopColor} ${cs.borderLeftColor}` : '',
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineColor : '',
      'box-shadow': cs.boxShadow,
      fill: isSvg ? cs.fill : '', stroke: isSvg && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 ? cs.stroke : '',
    };
    const ts = tintSet(el);
    const directText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const hasText = !!directText;
    const emojiOnly = hasText && /^[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️\s★·•+]+$/u.test(directText);
    const matches = [];
    for (const [p, v] of Object.entries(props)) {
      if (!v || v === 'none') continue;
      if (p === 'color' && !hasText) continue;                    // ink only matters where text is (svg ink shows up as stroke/fill)
      for (const c of parseAll(v)) {
        if (c[3] <= 0.01) continue;
        let tok = null;
        for (const k of ['accent', 'deep', 'soft', 'tint']) if (near(c, S[k])) { tok = k; break; }
        if (!tok && ts && ts.tint && ts.hex && !near(ts.tint, S.accent)) {
          if (near(c, ts.tint)) tok = 'person-raw'; else if (ts.ink && near(c, ts.ink)) tok = 'person-ink'; else if (ts.soft && near(c, ts.soft, 3)) tok = 'person-soft';
        }
        if (!tok && ts && ts.tint && near(c, ts.tint) && near(ts.tint, S.accent)) tok = 'accent';
        if (tok) { matches.push({ prop: p, tok, rgba: c.map(v => Math.round(v * 1000) / 1000) }); break; }
      }
    }
    let anc = null;
    if (!matches.length && hasText) {                          // text sitting on an accent/person-coloured ancestor paint
      for (let e = el.parentElement; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
        const ec = getComputedStyle(e);
        const paints = [...parseAll(ec.backgroundColor).filter(c => c[3] > 0.01), ...(ec.backgroundImage !== 'none' ? parseAll(ec.backgroundImage) : [])];
        if (!paints.length) continue;
        const ets = tintSet(e);
        for (const c of paints) {
          let tok = null;
          for (const k of ['accent', 'deep', 'soft', 'tint']) if (near(c, S[k])) { tok = k; break; }
          if (!tok && ets && ets.tint && near(c, ets.tint) && !near(ets.tint, S.accent)) tok = 'person-raw';
          if (tok && c[3] >= 0.5) { anc = { sel: sel(e), tok, rgba: c }; break; }
        }
        break;                                                   // only the first painted ancestor counts
      }
      if (anc) matches.push({ prop: 'ancestor-bg', tok: anc.tok, rgba: anc.rgba.map(v => Math.round(v * 1000) / 1000), anc: anc.sel });
    }
    if (!matches.length) continue;
    const textRects = [];
    if (hasText) {
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1 && q.bottom > 0 && q.top < vh) textRects.push([q.left, q.top, q.width, q.height]);
      }
    }
    const db = declBg(hasText ? el : (el.parentElement || el));
    const ins = Math.min(4, r.width / 4, r.height / 4);
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + ins, r.top + r.height / 2], [r.right - ins, r.top + r.height / 2], [r.left + r.width / 2, r.top + ins], [r.left + r.width / 2, r.bottom - ins]];
    const unrelated = ([x, y]) => { const h = document.elementFromPoint(Math.min(vw - 1, Math.max(0, x)), Math.min(vh - 1, Math.max(0, y))); return !!(h && h !== el && !el.contains(h) && !h.contains(el)); };
    recs.push({
      sel: sel(el), tag: el.tagName.toLowerCase(), text: hasText ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) : null,
      fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight) || 400, op: +op.toFixed(3), color: parseAll(cs.color)[0],
      rect: [r.left, r.top, r.width, r.height], textRects, matches, covered: pts.every(unrelated),
      tint: ts ? { hex: ts.hex, raw: ts.raw, host: sel(ts.host) } : null,
      declBg: db.c.map(v => Math.round(v)), bgImage: db.img, parBg: declBg(el.parentElement || el).c.map(v => Math.round(v)),
      ownBg: parseAll(cs.backgroundColor)[0] || null, emojiOnly, fillOp: isSvg ? parseFloat(cs.fillOpacity) : 1, strokeOp: isSvg ? parseFloat(cs.strokeOpacity) : 1, borderW: parseFloat(cs.borderTopWidth) || 0, sw: isSvg ? parseFloat(cs.strokeWidth) || 0 : 0,
    });
  }
  probe.remove();
  const meta = { url: location.pathname + location.hash, theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme || null, kind: document.documentElement.dataset.kind || null, profile: window.hub && hub.profile ? hub.profile.id : null, vw, vh, S: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v && v.map(x => Math.round(x * 100) / 100)])) };
  return { meta, recs };
}
const HIDE = `*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}`;

// ── contrast maths (node) ────────────────────────────────────────────────────────────────────────────────────────────
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };

function measureRecs(recs, off, shown, hidden) {
  for (const r of recs) {
    const main = r.matches[0];
    if (r.text && !r.emojiOnly && !r.covered && r.textRects.length && r.color) {
      const fgA = (r.color[3] == null ? 1 : r.color[3]) * r.op;
      const vals = [];
      for (const [x, y, w, h] of r.textRects) {
        const stepX = Math.max(1, w / 24), stepY = Math.max(1, h / 6);
        for (let yy = y + 1; yy < y + h - 1; yy += stepY) for (let xx = x + 1; xx < x + w - 1; xx += stepX) {
          const bg = at(hidden, xx + off.x, yy + off.y); vals.push(ratio(over(r.color, fgA, bg), bg));
        }
      }
      const large = r.fs >= 24 || (r.fs >= 18.66 && r.fw >= 700);
      r.kind = 'text'; r.req = large ? 3 : 4.5; r.p10 = q(vals, 0.1); r.med = q(vals, 0.5); r.pass = r.p10 != null && r.p10 >= r.req; r.passMed = r.med != null && r.med >= r.req;
      r.declRatio = +ratio(over(r.color, fgA, r.declBg), r.declBg).toFixed(2);
    }
    const nt = r.covered ? null : r.matches.find(m => ['border', 'outline', 'stroke', 'fill', 'background-color'].includes(m.prop) && m.rgba[3] * (m.prop === 'fill' ? r.fillOp : m.prop === 'stroke' ? r.strokeOp : 1) >= 0.3) || r.matches.find(m => m.prop === 'box-shadow' && m.rgba[3] >= 0.99);
    if (nt) {
      const [x, y, w, h] = r.rect;
      const ring = [];
      for (const d of [3, 4, 5]) for (let k = 0; k <= 12; k++) {
        const fx = x + (w * k) / 12, fy = y + (h * k) / 12;
        ring.push(at(hidden, fx + off.x, y - d + off.y), at(hidden, fx + off.x, y + h + d + off.y), at(hidden, x - d + off.x, fy + off.y), at(hidden, x + w + d + off.x, fy + off.y));
      }
      const med = [0, 1, 2].map(i => { const s = ring.map(p => p[i]).sort((a, b) => a - b); return s[s.length >> 1]; });
      const a = Math.min(1, nt.rgba[3] * r.op * (nt.prop === 'fill' ? r.fillOp : nt.prop === 'stroke' ? r.strokeOp : 1));
      const pb = r.parBg || r.declBg; const paint = over(nt.rgba, a, pb);
      r.nontext = { prop: nt.prop, tok: nt.tok, paint: paint.map(Math.round), vsDecl: +ratio(paint, pb).toFixed(2), vsOutside: +ratio(over(nt.rgba, a, med), med).toFixed(2), alpha: +a.toFixed(2), outside: med, pass: ratio(paint, pb) >= 3 };
    }
    delete r.textRects;
  }
  return recs;
}

// ── the t API the area screens expect (as in phase4/measure.mjs; no holds: state is always typical) ─────────────────
function makeT(L, d, variant) {
  const page = d.page, ctx = d.ctx;
  const dev = { hasTouch: true };
  const t = {
    page, ctx, state: 'typical', device: 'ipad-portrait', mode: d.mode, variant, profile: d.profile, site: L.site, api: L.api, dev,
    loading: false, offline: false, error: false, touch: true, sleep,
    async settle(max = 6000) { await sleep(900); try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {} await sleep(350); },
    frame: () => page.frameLocator('#frame'),
    async goto(hash = '') { await page.goto(L.site + '/index.html' + hash, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id);
      await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      let f = null; const until = Date.now() + 10000;
      while (Date.now() < until && !(f = page.frames().find(fr => fr.url().includes(`/apps/${id}.html`)))) await sleep(100);
      if (!f) throw new Error('no frame ' + id);
      await f.waitForLoadState('domcontentloaded').catch(() => {});
      if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {});
      return f;
    },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; await loc.tap(opts).catch(async () => loc.click(opts)); },
    async tapIn(frameOrLoc, selector, opts = {}) { const loc = selector ? frameOrLoc.locator(selector).first() : frameOrLoc; await loc.tap(opts).catch(async () => loc.click(opts)); },
    async hold() {}, async answer() {}, async failApi() {},
    async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };
  return t;
}

async function oneJob(L, theme, prof, area, screen, variant) {
  const file = path.join(OUT, (PARK ? 'park-' : '') + theme, prof, `${area}--${screen}.json`);
  if (!FORCE && fs.existsSync(file)) return 'skip';
  const [th, mode] = THEME_KEYS[theme];
  const s = await screenDef(area, screen);
  const who = prof === 'signed-out' ? null : prof;
  const ls = { 'hub.theme': JSON.stringify(th) };
  if (prof === 'signed-out') ls['hub.lastProfile'] = JSON.stringify('eli');
  Object.assign(ls, s.localStorage || {});
  const d = await L.device({ device: 'ipad-portrait', mode, profile: who, localStorage: ls });
  d.mode = mode;
  const out = { theme, profile: prof, area, screen, variant, ok: true, error: null, docs: [] };
  try {
    if (area === 'timer' && screen === 'idle' && who) await L.apiAs(who, '/api/data/timer/timer.active?scope=person', { method: 'DELETE' });
    const t = makeT(L, d, variant);
    try { await s.go(t); } catch (e) { out.goError = String(e.message).split('\n')[0]; }
    await t.settle();
    if (s.after) { try { await s.after(t); } catch (e) { out.afterError = String(e.message).split('\n')[0]; } }
    await sleep(600);
    const frames = [{ name: 'page', f: d.page, off: { x: 0, y: 0 } }];
    const fr = d.page.frames().find(f => /\/apps\/[^/]+\.html/.test(f.url()));
    if (fr) {
      const box = await d.page.evaluate(() => { const e = document.querySelector('#frame'); if (!e) return null; const r = e.getBoundingClientRect(); if (Math.abs(r.width - e.offsetWidth) > 1) return { x: r.left, y: r.top, w: r.width, vis: false, scaled: true }; const v = document.querySelector('#viewer'); return { x: r.left + e.clientLeft, y: r.top + e.clientTop, w: r.width, vis: !!(v && v.classList.contains('on')) }; }).catch(() => null);
      if (box && box.vis) frames.push({ name: 'frame:' + fr.url().match(/apps\/([^/.]+)\.html/)[1], f: fr, off: { x: box.x, y: box.y } });
    }
    const scans = [];
    for (const x of frames) { const sc = await x.f.evaluate(scanDoc, {}).catch(e => ({ error: e.message })); scans.push({ ...x, sc }); }
    const shown = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
    for (const x of frames) await x.f.evaluate(css => { const st = document.createElement('style'); st.id = '__acc_hide'; st.textContent = css; document.head.appendChild(st); }, HIDE).catch(() => {});
    await sleep(250);
    const hidden = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
    for (const x of frames) await x.f.evaluate(() => { const st = document.getElementById('__acc_hide'); if (st) st.remove(); }).catch(() => {});
    for (const x of scans) {
      if (x.sc.error) { out.docs.push({ doc: x.name, error: x.sc.error }); continue; }
      // in a frame, drop records outside the iframe's own viewport area on the page
      const recs = measureRecs(x.sc.recs, x.off, shown, hidden);
      out.docs.push({ doc: x.name, off: x.off, meta: x.sc.meta, recs });
    }
    const shotDir = path.join(OUT, '..', 'runtime-shots', (PARK ? 'park-' : '') + theme, prof);
    if (flag('shots')) { fs.mkdirSync(shotDir, { recursive: true }); await d.page.screenshot({ path: path.join(shotDir, `${area}--${screen}.png`), animations: 'disabled', caret: 'hide', scale: 'css' }); }
  } catch (e) { out.ok = false; out.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  await d.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  return out.ok ? 'ok' : 'fail';
}

async function main() {
  const L = await local({ variant: PARK ? 'park' : 'typical', clock: 'demo', engine: 'webkit' });
  const t0 = Date.now();
  const stats = { ok: 0, skip: 0, fail: 0 };
  try {
    for (const theme of themes) {
      const [th] = THEME_KEYS[theme];
      await L.reset(PARK ? 'park' : 'typical');
      for (const id of [...ADULTS, ...KIDS]) {
        await L.apiAs(id, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } });
        if (!PARK) await L.apiAs(id, '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: DEMO + 380000, total: 600, startedAt: DEMO - 220000 } } });
      }
      const queues = profiles.map(p => {
        const list = SPECIAL[p] || (KIDS.includes(p) ? KID_SCREENS : ADULTS.includes(p) ? ADULT_SCREENS : []);
        return list.filter(([a, s]) => !ONLY || ONLY.includes(`${a}:${s}`)).map(([a, s]) => ({ p, a, s }));
      }).filter(q => q.length);
      let idx = 0;
      const lanes = Array.from({ length: Math.min(PAR, queues.length) }, async () => {
        while (idx < queues.length) {
          const qu = queues[idx++];
          for (const j of qu) {                                    // one profile's screens in order (timer idle last)
            const r = await oneJob(L, theme, j.p, j.a, j.s, PARK ? 'park' : 'typical').catch(e => { console.log('ERR', j, e.message); return 'fail'; });
            stats[r]++;
            if (r !== 'skip') console.log(new Date().toISOString().slice(11, 19), theme, j.p, `${j.a}:${j.s}`, r);
          }
        }
      });
      await Promise.all(lanes);
      if (opt('max-minutes') && Date.now() - t0 > +opt('max-minutes') * 60000) { console.log('time budget reached after theme', theme); break; }
    }
  } finally { await L.close(); }
  console.log('done', stats, Math.round((Date.now() - t0) / 1000) + 's');
}
main().catch(e => { console.error(e); process.exit(1); });
