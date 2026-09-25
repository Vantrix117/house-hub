// Phase 4 ACCENT — skeptic #1 re-measure of "raw-accent-as-text": text painted in the raw profile hex (--accent).
// Independent of runtime.mjs/matrix.mjs: signs in as a profile with a theme (API row + localStorage), opens the screen via
// the Phase 1 area scripts (read-only import), then for every target element: fg = computed color; bg = the median pixel
// inside the element's box with the target text made transparent (so glass/blur/gradients are what is really behind).
//   node audits/tools/phase4/ACCENT/verify-raw-accent-as-text-1.mjs [--group prayer|park]
//   -> audits/evidence/p4/ACCENT/verify-raw-accent-as-text-1-<group>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const argv = process.argv.slice(2);
const GROUP = argv.includes('--group') ? argv[argv.indexOf('--group') + 1] : 'all';
const SHOTS = argv.includes('--shots');
// theme key -> [hub theme id, OS mode]
const TK = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'light'], forest: ['forest', 'light'] };

const JOBS = { prayer: { variant: 'typical', jobs: [] }, park: { variant: 'park', jobs: [] } };
for (const th of ['system-light', 'system-dark', 'parchment', 'midnight']) for (const p of ['eli', 'mom', 'christian'])
  JOBS.prayer.jobs.push({ th, p, area: 'prayer', screen: 'kitchen', sel: '#kitchen .k-cat' });
for (const th of ['system-light', 'system-dark']) for (const p of ['eli', 'mom', 'christian'])
  JOBS.prayer.jobs.push({ th, p, area: 'prayer', screen: 'today-family', sel: '.who .init, .asker .init' });
for (const th of ['system-light', 'system-dark', 'midnight']) for (const p of ['eli', 'dad', 'christian', 'niece'])
  JOBS.park.jobs.push({ th, p, area: 'dollywood-live', screen: 'nearby', sel: '.lv-item .d small' });
for (const th of ['system-light', 'system-dark']) for (const p of ['eli', 'christian'])
  JOBS.park.jobs.push({ th, p, area: 'dollywood-live', screen: 'ride-card', sel: '.lv-from b' });

const areaCache = {};
async function screenDef(area, screen) {
  if (!areaCache[area]) areaCache[area] = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', area + '.mjs')).href);
  return areaCache[area].screens.find(x => x.screen === screen);
}
function makeT(L, d, variant, mode, profile) {
  const page = d.page, ctx = d.ctx;
  const t = {
    page, ctx, state: 'typical', device: 'ipad-portrait', mode, variant, profile, site: L.site, api: L.api, dev: { hasTouch: true },
    loading: false, offline: false, error: false, touch: true, sleep,
    async settle() { await sleep(900); try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {} await sleep(350); },
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
    async tapIn(fl, s, opts = {}) { const loc = s ? fl.locator(s).first() : fl; await loc.tap(opts).catch(async () => loc.click(opts)); },
    async hold() {}, async answer() {}, async failApi() {},
    async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([s, y]) => { const el = document.querySelector(s) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };
  return t;
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

async function oneJob(L, variant, j) {
  const [theme, mode] = TK[j.th];
  await L.apiAs(j.p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
  const s = await screenDef(j.area, j.screen);
  const ls = { 'hub.theme': JSON.stringify(theme), ...(s.localStorage || {}) };
  const d = await L.device({ device: 'ipad-portrait', mode, profile: j.p, localStorage: ls });
  const res = { theme: j.th, profile: j.p, screen: `${j.area}:${j.screen}`, sel: j.sel, items: [] };
  try {
    const t = makeT(L, d, variant, mode, j.p);
    try { await s.go(t); } catch (e) { res.goError = String(e.message).split('\n')[0]; }
    await t.settle(); await sleep(500);
    const fr = d.page.frames().find(f => /\/apps\/[^/]+\.html/.test(f.url()));
    const off = await d.page.evaluate(() => { const e = document.querySelector('#frame'); const r = e.getBoundingClientRect(); return { x: r.left + e.clientLeft, y: r.top + e.clientTop }; });
    const info = await fr.evaluate(sel => {
      const de = document.documentElement, cs = getComputedStyle(de);
      const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; });
      return { theme: de.dataset.theme || null, scheme: de.dataset.scheme, accentVar: cs.getPropertyValue('--accent').trim(), profile: window.hub && hub.profile && hub.profile.id,
        els: els.slice(0, 8).map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { text: e.textContent.trim().slice(0, 30), color: c.color, fs: c.fontSize, fw: c.fontWeight, r: { x: r.left, y: r.top, w: r.width, h: r.height } }; }) };
    }, j.sel);
    Object.assign(res, { dataTheme: info.theme, scheme: info.scheme, accentVar: info.accentVar, hubProfile: info.profile, found: info.els.length });
    const shown = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
    await fr.evaluate(sel => { const st = document.createElement('style'); st.id = '__v1'; st.textContent = sel.split(',').map(x => x + '{color:transparent!important;text-shadow:none!important}').join(''); document.head.appendChild(st); }, j.sel);
    await sleep(300);
    const hidden = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
    await fr.evaluate(() => document.getElementById('__v1').remove());
    for (const e of info.els) {
      const fg = e.color.match(/[\d.]+/g).map(Number).slice(0, 3);
      const x0 = Math.round(e.r.x + off.x), y0 = Math.round(e.r.y + off.y), x1 = Math.round(x0 + e.r.w), y1 = Math.round(y0 + e.r.h);
      const bgs = [], diffs = [];
      for (let y = Math.max(0, y0); y < Math.min(hidden.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(hidden.w, x1); x++) {
        const i = (y * hidden.w + x) * 4; const b = [hidden.px[i], hidden.px[i + 1], hidden.px[i + 2]]; bgs.push(b);
        const sv = [shown.px[i], shown.px[i + 1], shown.px[i + 2]]; diffs.push({ sv, d: Math.abs(sv[0] - b[0]) + Math.abs(sv[1] - b[1]) + Math.abs(sv[2] - b[2]) });
      }
      if (!bgs.length) continue;
      const med = k => { const a = bgs.map(b => b[k]).sort((p, q) => p - q); return a[a.length >> 1]; };
      const bg = [med(0), med(1), med(2)];
      diffs.sort((p, q) => q.d - p.d); const ink = diffs[0].sv;   // the most text-like rendered pixel
      res.items.push({ text: e.text, fs: e.fs, fw: e.fw, fg: hex(fg), bg: hex(bg), ratio: cr(fg, bg), renderedInk: hex(ink), renderedRatio: cr(ink, bg) });
    }
    if (SHOTS) await d.page.screenshot({ path: path.join(OUT, `verify-raw-accent-as-text-1-${j.area}-${j.screen}-${j.p}-${j.th}.png`), animations: 'disabled', caret: 'hide', scale: 'css' });
  } catch (e) { res.error = String(e && e.message || e).split('\n')[0]; }
  await d.close();
  return res;
}

for (const g of GROUP === 'all' ? Object.keys(JOBS) : [GROUP]) {
  const { variant, jobs } = JOBS[g];
  const L = await local({ variant, clock: 'demo', engine: 'webkit' });
  const out = [];
  try {
    for (const j of jobs) {
      await L.reset(variant);
      const r = await oneJob(L, variant, j);
      const rs = r.items.map(i => i.ratio);
      console.log(r.theme, r.profile, r.screen, 'accent', r.accentVar, 'scheme', r.scheme, 'n', r.found,
        rs.length ? `min ${Math.min(...rs)} max ${Math.max(...rs)} fail ${rs.filter(x => x < 4.5).length}/${rs.length}` : '',
        r.error || r.goError || '', r.items[0] ? `| "${r.items[0].text}" ${r.items[0].fs} fg ${r.items[0].fg} bg ${r.items[0].bg} rendered ${r.items[0].renderedRatio}` : '');
      out.push(r);
    }
  } finally { await L.close(); }
  fs.writeFileSync(path.join(OUT, `verify-raw-accent-as-text-1-${g}.json`), JSON.stringify(out, null, 1));
}
