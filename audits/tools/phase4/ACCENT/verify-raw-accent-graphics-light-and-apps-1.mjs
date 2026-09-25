#!/usr/bin/env node
// Phase 4 ACCENT — skeptic #1 for "raw-accent-graphics-light-and-apps". Independent re-measure on the local rig.
// Pixel method (device scale, iPad portrait DPR 2): for each target, find the painted pixels that match the expected
// person colour (inside an annulus for avatar rings), then walk outward from each one in 8 directions to the first clearly
// different pixel (+2 px past anti-aliasing) and take that as the adjacent colour. Report the ring's measured paint and the
// WCAG ratio of that paint against the adjacent colours (p10 / median / p90 and share below 3:1). Also token math
// (raw person colour vs --surface and --bg per palette) straight from apps/design.css + worker/seed.sql.
//   node audits/tools/phase4/ACCENT/verify-raw-accent-graphics-light-and-apps-1.mjs [--skip-park]
// → audits/evidence/p4/ACCENT/verify-raw-accent-graphics-light-and-apps-1.json (+ a few 1x crops)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const OUTJ = path.join(EV, 'verify-raw-accent-graphics-light-and-apps-1.json');
const SKIP_PARK = process.argv.includes('--skip-park');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const r2 = v => v == null ? null : +v.toFixed(2);

// ── token math ────────────────────────────────────────────────────────────────────────────────────────────────────────
function tokenMath() {
  const seed = fs.readFileSync(path.join(ROOT, 'worker/seed.sql'), 'utf8');
  const people = [...seed.matchAll(/\('(\w+)',\s*'[^']*',\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})'/g)].map(m => ({ id: m[1], color: m[2] }));
  const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
  const pal = {};
  const grab = (name, block) => { const s = block.match(/--surface:\s*(#[0-9A-Fa-f]{6})/), b = block.match(/--bg:\s*(#[0-9A-Fa-f]{6})/); pal[name] = { surface: s[1], bg: b[1] }; };
  grab('hearth', css.slice(css.indexOf(':root {'), css.indexOf(':root {') + 3000));
  for (const n of ['parchment', 'frost', 'midnight', 'forest']) { const i = css.indexOf(`:root[data-theme="${n}"]`); grab(n, css.slice(i, i + 1500)); }
  const rows = []; let failS = 0, failB = 0, n = 0;
  for (const p of people) for (const [th, t] of Object.entries(pal)) {
    const s = ratio(hex(p.color), hex(t.surface)), b = ratio(hex(p.color), hex(t.bg)); n++;
    if (s < 3) failS++; if (b < 3) failB++;
    rows.push({ person: p.id, color: p.color, theme: th, vsSurface: r2(s), vsBg: r2(b) });
  }
  return { palettes: pal, cells: n, failVsSurface: failS, failVsBg: failB, rows };
}

// ── pixel measurement ─────────────────────────────────────────────────────────────────────────────────────────────────
function measure(img, dpr, rect, paintExp, annulus) {
  const x0 = Math.max(0, Math.floor((rect.x - 8) * dpr)), y0 = Math.max(0, Math.floor((rect.y - 8) * dpr));
  const x1 = Math.min(img.w - 1, Math.ceil((rect.x + rect.w + 8) * dpr)), y1 = Math.min(img.h - 1, Math.ceil((rect.y + rect.h + 8) * dpr));
  const px = (x, y) => { const i = (y * img.w + x) * 4; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
  const cx = (rect.x + rect.w / 2) * dpr, cy = (rect.y + rect.h / 2) * dpr;
  const ring = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (annulus) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / dpr; if (d < annulus[0] || d > annulus[1]) continue; }
    const c = px(x, y); if (dist(c, paintExp) <= 22) ring.push([x, y, c]);
  }
  if (!ring.length) return { ringPx: 0 };
  const med = [0, 1, 2].map(i => q(ring.map(r => r[2][i]), 0.5));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const adj = []; const step = Math.max(1, Math.floor(ring.length / 1500));
  for (let i = 0; i < ring.length; i += step) {
    const [x, y] = ring[i];
    for (const [dx, dy] of dirs) {
      for (let k = 1; k <= 10; k++) {
        const X = x + dx * k, Y = y + dy * k; if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) break;
        const c = px(X, Y); if (dist(c, med) <= 70) continue;
        const X2 = X + dx * 2, Y2 = Y + dy * 2; if (X2 < 0 || Y2 < 0 || X2 >= img.w || Y2 >= img.h) break;
        const c2 = px(X2, Y2); if (dist(c2, med) > 70) adj.push(c2); break;
      }
    }
  }
  const rs = adj.map(a => ratio(med, a));
  // clusters of adjacent colours (rounded to 16 levels)
  const cl = {}; for (const a of adj) { const k = a.map(v => Math.round(v / 16) * 16).join(','); cl[k] = (cl[k] || 0) + 1; }
  const top = Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => { const c = k.split(',').map(Number); return { rgb: c, share: +(n / adj.length).toFixed(2), ratio: r2(ratio(med, c)) }; });
  return { ringPx: ring.length, paintMeasured: med, paintExpected: paintExp, adjSamples: adj.length, p10: r2(q(rs, 0.1)), median: r2(q(rs, 0.5)), p90: r2(q(rs, 0.9)), shareBelow3: +(rs.filter(v => v < 3).length / Math.max(1, rs.length)).toFixed(2), adjacentClusters: top };
}

async function shotAndMeasure(d, targets, cropName) {
  const page = d.page;
  for (const t of targets) if (t.scroll) { const fr = t.frame ? page.frames().find(f => f.url().includes(`/apps/${t.frame}.html`)) : page; await fr.evaluate(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: 'center' }); }, t.sel).catch(() => {}); await sleep(600); }
  const png = decodePng(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' }));
  const dpr = png.w / 820;
  const out = [];
  for (const t of targets) {
    const frame = t.frame ? page.frames().find(f => f.url().includes(`/apps/${t.frame}.html`)) : page;
    let off = { x: 0, y: 0 };
    if (t.frame) off = await page.evaluate(() => { const e = document.querySelector('#frame'); const r = e.getBoundingClientRect(); return { x: r.left + e.clientLeft, y: r.top + e.clientTop }; });
    const info = await frame.evaluate(({ sel, kind }) => {
      const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; });
      return els.slice(0, 4).map(e => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        const tint = (cs.getPropertyValue('--tint') || '').trim(), acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        const paint = kind === 'stroke' ? cs.stroke : kind === 'fill' ? cs.fill : kind === 'color' ? cs.color : null;
        return { x: r.left, y: r.top, w: r.width, h: r.height, tint, accent: acc, paint, theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, text: (e.closest('[data-kid],li,.kid-chip,.pill,button') || e).textContent.trim().slice(0, 40) };
      });
    }, { sel: t.sel, kind: t.kind });
    for (const e of info) {
      const rgbStr = e.paint && e.paint.match(/rgb\((\d+), (\d+), (\d+)\)/);
      const exp = t.kind === 'ring' ? hex(e.tint.toUpperCase().startsWith('#') ? e.tint : '#000000') : rgbStr ? rgbStr.slice(1, 4).map(Number) : null;
      if (!exp) { out.push({ ...t, el: e, error: 'no paint ' + e.paint + ' tint ' + e.tint }); continue; }
      const rect = { x: e.x + off.x, y: e.y + off.y, w: e.w, h: e.h };
      const ann = t.kind === 'ring' ? [e.w / 2 + t.ring[0], e.w / 2 + t.ring[1]] : null;
      const m = measure(png, dpr, rect, exp, ann);
      out.push({ label: t.label, sel: t.sel, frame: t.frame || 'page', theme: e.theme, scheme: e.scheme, tint: e.tint, accent: e.accent, text: e.text, rect, ...m });
    }
    if (!info.length) out.push({ label: t.label, sel: t.sel, error: 'not found on screen' });
  }
  if (cropName) {
    const r = out.find(o => o.rect && o.ringPx);
    if (r) await page.screenshot({ path: path.join(EV, `verify-raw-accent-graphics-light-and-apps-1-${cropName}.png`), clip: { x: Math.max(0, r.rect.x - 60), y: Math.max(0, r.rect.y - 30), width: Math.min(420, 820 - Math.max(0, r.rect.x - 60)), height: Math.max(90, r.rect.h + 60) }, scale: 'css', animations: 'disabled' });
  }
  return out;
}

const THEMES = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], parchment: ['parchment', 'light'], frost: ['frost', 'light'] };

async function setup(L, who, theme, { timer = false } = {}) {
  const [th] = THEMES[theme];
  await L.apiAs(who, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } });
  if (timer) await L.apiAs(who, '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: DEMO + 380000, total: 600, startedAt: DEMO - 220000 } } });
}
async function dev(L, who, theme) {
  const [th, mode] = THEMES[theme];
  return L.device({ device: 'ipad-portrait', mode, profile: who, localStorage: { 'hub.theme': JSON.stringify(th) } });
}

const CASES = [
  // [profile, theme, area, targets, crop]
  ...['parchment', 'system-light', 'frost', 'system-dark'].map(th => ['eli', th, 'home', [{ label: 'kid-chip avatar ring (Kiara)', sel: '.kid-chip[style*="B4861B"] .avatar', kind: 'ring', ring: [2, 3.5] }, { label: 'kid-chip avatar ring (Ezra, control)', sel: '.kid-chip[style*="137F77"] .avatar', kind: 'ring', ring: [2, 3.5] }], th === 'parchment' ? 'kidchip-kiara-parchment' : null]),
  ['dad', 'system-dark', 'timer', [{ label: 'timer dial fg (David)', sel: '.dial .ring .fg', kind: 'stroke', frame: 'timer' }], 'timer-dad-dark'],
  ['eli', 'system-dark', 'timer', [{ label: 'timer dial fg (Eli)', sel: '.dial .ring .fg', kind: 'stroke', frame: 'timer' }], null],
  ['kiara', 'parchment', 'timer', [{ label: 'timer dial fg (Kiara)', sel: '.dial .ring .fg', kind: 'stroke', frame: 'timer' }], null],
  ['kiara', 'parchment', 'home', [{ label: 'shell timer-pill ring fg (Kiara)', sel: '#timer-pill-ring .fg', kind: 'stroke' }], null],
  ['kiara', 'system-light', 'kidverse', [{ label: 'Kid Verse earned day star (Kiara)', sel: '#mine .days span.on svg.icon', kind: 'fill', frame: 'kidverse', scroll: true }, { label: 'Kid Verse who-pill avatar ring (Kiara)', sel: '#who .avatar', kind: 'ring', ring: [2, 3.5], frame: 'kidverse' }], null],
  ['ezra', 'system-light', 'kidverse', [{ label: 'Kid Verse earned day star (Ezra, control)', sel: '#mine .days span.on svg.icon', kind: 'fill', frame: 'kidverse', scroll: true }], null],
  ['kiara', 'parchment', 'kidverse', [{ label: 'Kid Verse earned day star (Kiara)', sel: '#mine .days span.on svg.icon', kind: 'fill', frame: 'kidverse', scroll: true }, { label: 'Kid Verse who-pill avatar ring (Kiara)', sel: '#who .avatar', kind: 'ring', ring: [2, 3.5], frame: 'kidverse' }], null],
  ['dad', 'system-dark', 'verses', [{ label: 'Verses who-pill avatar ring (David)', sel: '#who .avatar', kind: 'ring', ring: [2.5, 5], frame: 'verses' }], null],
  ['ezra', 'system-dark', 'prayer', [{ label: 'Prayer kid card asker ring (Eli)', sel: '.kid .kby .avatar[style*="4F5D8C"]', kind: 'ring', ring: [2.5, 5], frame: 'prayer' }], 'prayer-kid-eli-dark'],
];

async function runCase(L, [who, theme, area, targets, crop]) {
  await setup(L, who, theme, { timer: area === 'timer' || (area === 'home' && who === 'kiara') });
  const d = await dev(L, who, theme);
  try {
    if (area === 'home') await d.goto('#home');
    else await d.openApp(area, { wait: area === 'kidverse' ? '#rewards:not([hidden])' : area === 'prayer' ? '.kby' : area === 'timer' ? '.dial' : '#who' });
    await sleep(2200);
    const res = await shotAndMeasure(d, targets, crop);
    return res.map(r => ({ profile: who, themeKey: theme, area, ...r }));
  } catch (e) { return [{ profile: who, themeKey: theme, area, error: String(e.message).split('\n')[0] }]; }
  finally { await d.close(); }
}

async function main() {
  const result = { script: 'audits/tools/phase4/ACCENT/verify-raw-accent-graphics-light-and-apps-1.mjs', device: 'ipad-portrait webkit DPR2', tokens: tokenMath(), runtime: [], park: [] };
  let L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    await L.reset('typical');
    for (const c of CASES.filter(c => !ONLY || c[2] === ONLY)) { const r = await runCase(L, c); result.runtime.push(...r); for (const x of r) console.log(x.profile, x.themeKey, x.label || '', x.error || '', 'ring', x.ringPx, 'paint', JSON.stringify(x.paintMeasured), 'p10', x.p10, 'med', x.median, 'p90', x.p90, 'below3', x.shareBelow3, JSON.stringify(x.adjacentClusters)); }
  } finally { await L.close(); }
  if (!SKIP_PARK) {
    L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
    try {
      await L.reset('park');
      for (const [who, theme] of [['dad', 'system-dark'], ['eli', 'system-dark'], ['christian', 'system-dark'], ['kiara', 'parchment'], ['kiara', 'system-light']]) {
        await setup(L, who, theme);
        const d = await dev(L, who, theme);
        try {
          const f = await d.openApp('dollywood-live', { wait: '#lv-pill[data-state]' });
          await sleep(1500);
          const tab = await f.$('#lv-family') ? '#lv-family' : '#loc-near';
          await f.locator(tab).first().click({ timeout: 5000 }).catch(() => {});
          await sleep(1200);
          const pressed = await f.evaluate(() => [...document.querySelectorAll('.lv-tabs button[aria-pressed=true]')].map(b => b.id));
          const r = await shotAndMeasure(d, [{ label: 'park selected sheet-tab icon', sel: '.lv-tabs button[aria-pressed=true] svg', kind: 'stroke', frame: 'dollywood-live' }], who === 'dad' ? 'park-tab-dad-dark' : who === 'eli' ? 'park-tab-eli-dark' : null);
          for (const x of r) { const row = { profile: who, themeKey: theme, pressed, ...x }; result.park.push(row); console.log('park', who, theme, pressed, x.error || '', 'ring', x.ringPx, 'paint', JSON.stringify(x.paintMeasured), 'p10', x.p10, 'med', x.median, JSON.stringify(x.adjacentClusters)); }
        } catch (e) { result.park.push({ profile: who, themeKey: theme, error: String(e.message).split('\n')[0] }); console.log('park err', who, e.message); }
        finally { await d.close(); }
      }
    } finally { await L.close(); }
  }
  fs.writeFileSync(ONLY ? OUTJ.replace('.json', '-' + ONLY + '.json') : OUTJ, JSON.stringify(result, null, 1));
  console.log('tokens: cells', result.tokens.cells, 'fail vs surface', result.tokens.failVsSurface, 'fail vs bg', result.tokens.failVsBg);
}
main().catch(e => { console.error(e); process.exit(1); });
