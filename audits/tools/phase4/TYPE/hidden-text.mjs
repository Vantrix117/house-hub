// Phase 4 TYPE: the text the rig's type inventory cannot see — SVG <text>, ::before/::after content, and the
// rendered (not computed) size of HTML text under CSS zoom — measured on the Phase 1 screens that carry it.
// Effective size = computed font-size × the element's screen scale (SVG: sqrt|det(getScreenCTM())|; HTML: the ratio of
// the rendered line box to the layout size, which catches zoom and transforms).
// Usage: node audits/tools/phase4/TYPE/hidden-text.mjs [--only area,area] -> audits/evidence/p4/TYPE/hidden-text.json
// Local instance only (lib/local.mjs); WebKit; System theme, light.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OUTF = path.join(ROOT, 'audits/evidence/p4/TYPE/hidden-text.json');
const PLAN = {
  shell: { file: 'shell', screens: ['home', 'home-kid', 'apps'] },
  tv: { file: 'tv', screens: ['board'], devices: ['tv'] },
  f260: { file: 'f260', screens: ['today', 'plan', 'year', 'large-text'] },
  leftovers: { file: 'leftovers', screens: ['main'] },
  prayer: { file: 'prayer', screens: ['today', 'kid'] },
  tally: { file: 'tally', screens: ['main'] },
  timer: { file: 'timer', screens: ['running'] },
  kidverse: { file: 'kidverse', screens: ['kid', 'kid-rewards', 'adult'] },
  verses: { file: 'verses', screens: ['trainer'] },
  dollywood: { file: 'dollywood', screens: ['map', 'cross-section', 'steps'] },
  'dollywood-live': { file: 'dollywood-live', screens: ['map', 'whole-park', 'waits', 'family'] },
};
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const DEVS = ['iphone-pwa', 'ipad-portrait'];

// In-page probe: runs in each document (page and app frame).
function probe() {
  const vw = innerWidth, vh = innerHeight;
  const vis = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement || (e.ownerSVGElement)) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const selOf = el => { const p = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : (e.className && e.className.baseVal ? '.' + e.className.baseVal.trim().split(/\s+/).slice(0, 2).join('.') : ''))); return p.join(' > '); };
  const svg = [];
  for (const t of document.querySelectorAll('svg text')) {
    const txt = (t.textContent || '').trim(); if (!txt) continue;
    const r = t.getBoundingClientRect(); if (!vis(r) || !shown(t)) continue;
    const m = t.getScreenCTM(); if (!m) continue;
    const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    const fs = parseFloat(getComputedStyle(t).fontSize);
    svg.push({ sel: selOf(t), text: txt.slice(0, 24), fs, scale: +scale.toFixed(3), eff: +(fs * scale).toFixed(2), fw: getComputedStyle(t).fontWeight, h: +r.height.toFixed(1) });
  }
  const pseudo = [];
  for (const el of document.querySelectorAll('body *')) {
    for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which); const c = cs.content;
      if (!c || c === 'none' || c === 'normal' || c === '""' || c === "''") continue;
      let txt = c;
      if (/^attr\(/.test(c)) txt = el.getAttribute(c.slice(5, -1)) || '';
      else if (/^counter/.test(c)) txt = '#';
      else txt = c.replace(/^["']|["']$/g, '');
      if (!/[A-Za-z0-9]/.test(txt)) continue;                 // icons, bullets, quotes
      if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (!vis(r) || !shown(el)) continue;
      pseudo.push({ sel: selOf(el) + which, text: txt.slice(0, 24), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, tt: cs.textTransform, ls: cs.letterSpacing });
    }
  }
  // HTML text whose rendered size differs from its computed size (CSS zoom, transforms)
  const zoomed = [];
  const z = parseFloat(getComputedStyle(document.body).zoom || '1') || 1;
  let smallest = null;
  for (const el of document.querySelectorAll('body *')) {
    if (!el.firstChild || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!vis(r) || !shown(el)) continue;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    let zz = 1; for (let e = el; e; e = e.parentElement) zz *= parseFloat(getComputedStyle(e).zoom || '1') || 1;
    const eff = +(fs * zz).toFixed(2);
    if (!smallest || eff < smallest.eff) smallest = { sel: selOf(el), text: el.textContent.trim().slice(0, 24), fs, zoom: +zz.toFixed(3), eff };
    if (zz !== 1 && zoomed.length < 400) zoomed.push({ sel: selOf(el), fs, zoom: +zz.toFixed(3), eff });
  }
  return { url: location.pathname, bodyZoom: z, svg, pseudo, zoomedCount: zoomed.length, zoomedMin: zoomed.sort((a, b) => a.eff - b.eff).slice(0, 8), smallestHtml: smallest };
}

const out = { note: 'Text the rig type inventory does not cover. svg: every visible SVG <text> with its computed font-size (user units), the screen scale of its CTM and the effective CSS px (eff). pseudo: visible ::before/::after with alphanumeric content. zoomed: HTML text under CSS zoom, with the effective size fs × zoom. smallestHtml: the smallest effective HTML text on screen. System theme, light, WebKit, local instance.', runs: [] };
const areas = Object.entries(PLAN).filter(([a]) => !only || only.includes(a));
for (const [area, P] of areas) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', P.file + '.mjs')).href);
  for (const screen of P.screens) {
    const s = mod.screens.find(x => x.screen === screen);
    if (!s) { out.runs.push({ area, screen, error: 'no such screen' }); continue; }
    const variant = (s.variant && s.variant.typical) || 'typical';
    const devs = P.devices || (s.devices ? s.devices.filter(d => DEVS.includes(d) || d === 'tv') : DEVS);
    const L = await local({ variant, engine: 'webkit' });
    try {
      for (const device of devs.length ? devs : DEVS) {
        const who = s.profile === undefined ? 'eli' : s.profile;
        const d = await L.device({ device, mode: 'light', profile: who, localStorage: s.localStorage || {} });
        const dev = DEVICES[device];
        const page = d.page;
        const t = {
          page, ctx: d.ctx, state: 'typical', device, mode: 'light', variant, profile: who, dev, touch: dev.hasTouch,
          loading: false, offline: false, error: false, sleep,
          settle: async () => { await sleep(900); },
          frame: () => page.frameLocator('#frame'),
          goto: h => d.goto(h),
          async openApp(id, { wait } = {}) { const f = await d.openApp(id, { wait }); await sleep(700); return f; },
          appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
          async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async tapIn(fl, sel, opts = {}) { const loc = sel ? fl.locator(sel).first() : fl; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
          async clockTo(when) { await d.ctx.clock.setFixedTime(new Date(when)); },
        };
        const rec = { area, screen, device, variant, profile: who };
        try { await s.go(t); await sleep(1200); if (s.after) await s.after(t); } catch (e) { rec.goError = String(e.message || e).split('\n')[0]; }
        rec.docs = [];
        for (const f of page.frames()) {
          try { const r = await f.evaluate(probe); rec.docs.push({ doc: f === page.mainFrame() ? 'page' : 'frame', ...r }); } catch (e) { rec.docs.push({ doc: f.url(), error: String(e.message).slice(0, 120) }); }
        }
        out.runs.push(rec);
        const svgMin = Math.min(...rec.docs.flatMap(x => (x.svg || []).map(s => s.eff)), Infinity);
        const psMin = Math.min(...rec.docs.flatMap(x => (x.pseudo || []).map(s => s.fs)), Infinity);
        console.log(area.padEnd(15), screen.padEnd(14), device.padEnd(14), 'svg', rec.docs.reduce((n, x) => n + (x.svg || []).length, 0), 'min eff', svgMin, '| pseudo', rec.docs.reduce((n, x) => n + (x.pseudo || []).length, 0), 'min', psMin, rec.goError ? 'goError: ' + rec.goError : '');
        await d.close();
      }
    } finally { await L.close(); }
  }
}
let prev = null; try { prev = JSON.parse(fs.readFileSync(OUTF, 'utf8')); } catch {}
if (prev && only) { out.runs = [...prev.runs.filter(r => !only.includes(r.area)), ...out.runs]; }
fs.mkdirSync(path.dirname(OUTF), { recursive: true });
fs.writeFileSync(OUTF, JSON.stringify(out));
console.log('->', OUTF, (fs.statSync(OUTF).size / 1024).toFixed(0), 'KB');
