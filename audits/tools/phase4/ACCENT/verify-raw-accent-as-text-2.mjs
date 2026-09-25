// Phase 4 ACCENT — skeptic #2 for "raw-accent-as-text". Independent re-measure on the local rig (WebKit, iPad portrait).
// For each profile × theme: open a screen with the Phase 1 area script (read-only import), then for every target element
// read its computed colour, size and the value of --accent where it paints, hide its text, screenshot, and take the
// median background pixel inside its box (so glass and color-mix chips are measured as painted, not by token math).
//   node audits/tools/phase4/ACCENT/verify-raw-accent-as-text-2.mjs prayer [themes] [profiles]
//   node audits/tools/phase4/ACCENT/verify-raw-accent-as-text-2.mjs park   [themes] [profiles]
// → audits/evidence/p4/ACCENT/verify-raw-accent-as-text-2-<mode>.json (+ one PNG per mode with --shot)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const [MODE = 'prayer', TH = '', PR = '', SHOT = ''] = process.argv.slice(2);
const KEYS = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], midnight: ['midnight', 'dark'], parchment: ['parchment', 'light'], forest: ['forest', 'dark'], frost: ['frost', 'light'] };
const themes = (TH || (MODE === 'park' ? 'system-light,system-dark' : 'system-light,system-dark,midnight,parchment')).split(',');
const profiles = (PR || 'eli,mom,dad,christian').split(',');
const JOBS = MODE === 'park'
  ? [['dollywood-live', 'nearby', '.lv-item .d small'], ['dollywood-live', 'ride-card', '.lv-from b']]
  : [['prayer', 'kitchen', '#kitchen .k-cat'], ['prayer', 'kitchen-family', '#kitchen .k-cat'], ['prayer', 'today-family', '.who .init, .asker .init']];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const areas = {};
const def = async (a, s) => { areas[a] ||= await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', a + '.mjs')).href); return areas[a].screens.find(x => x.screen === s); };

function makeT(L, d, variant, mode) {
  const page = d.page;
  const t = {
    page, ctx: d.ctx, state: 'typical', device: 'ipad-portrait', mode, variant, profile: d.profile, site: L.site, api: L.api, dev: { hasTouch: true },
    loading: false, offline: false, error: false, touch: true, sleep,
    frame: () => page.frameLocator('#frame'),
    async goto(h = '') { await page.goto(L.site + '/index.html' + h, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) {
      await t.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {});
      let f = null; const until = Date.now() + 10000;
      while (Date.now() < until && !(f = page.frames().find(fr => fr.url().includes(`/apps/${id}.html`)))) await sleep(100);
      if (!f) throw new Error('no frame ' + id);
      if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {});
      return f;
    },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, o = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; await loc.tap(o).catch(async () => loc.click(o)); },
    async tapIn(fl, s, o = {}) { const loc = s ? fl.locator(s).first() : fl; await loc.tap(o).catch(async () => loc.click(o)); },
    async hold() {}, async answer() {}, async failApi() {},
    async scroll(s = '#views', y = 'bottom', where = page) { await where.evaluate(([s, y]) => { const e = document.querySelector(s) || document.scrollingElement; e.scrollTop = y === 'bottom' ? e.scrollHeight : y; }, [s, y]); await sleep(300); },
  };
  return t;
}

async function measure(d, app, selector) {
  const f = d.page.frames().find(fr => fr.url().includes(`/apps/${app}.html`));
  if (!f) return { error: 'no frame' };
  const off = await d.page.evaluate(() => { const e = document.querySelector('#frame'); const r = e.getBoundingClientRect(); return { x: r.left + e.clientLeft, y: r.top + e.clientTop }; });
  const info = await f.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight; });
    const html = getComputedStyle(document.documentElement);
    return {
      htmlAccent: html.getPropertyValue('--accent').trim(), theme: document.documentElement.dataset.theme || 'hearth/system', scheme: document.documentElement.dataset.scheme,
      bodyShared: document.body.classList.contains('shared'), total: document.querySelectorAll(sel).length,
      items: els.slice(0, 14).map((e, i) => { e.dataset.v2 = i; const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        return { i, text: e.textContent.trim().slice(0, 40), color: cs.color, accentHere: cs.getPropertyValue('--accent').trim(), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, op: +op.toFixed(2), r: { x: r.left, y: r.top, w: r.width, h: r.height } }; }),
    };
  }, selector);
  const shown = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
  await f.evaluate(() => { const s = document.createElement('style'); s.id = '__v2'; s.textContent = '[data-v2]{color:transparent!important;text-shadow:none!important}'; document.head.appendChild(s); });
  await sleep(200);
  const hidden = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
  await f.evaluate(() => document.getElementById('__v2').remove());
  for (const it of info.items) {
    const px = img => { const out = []; for (let y = Math.ceil(it.r.y + off.y + 1); y < it.r.y + off.y + it.r.h - 1; y++) for (let x = Math.ceil(it.r.x + off.x + 1); x < it.r.x + off.x + it.r.w - 1; x++) { const i = (Math.round(y) * img.w + Math.round(x)) * 4; out.push([img.px[i], img.px[i + 1], img.px[i + 2]]); } return out; };
    const bgs = px(hidden), ink = px(shown);
    const med = a => { const s = [...a].sort((p, q) => lum(p) - lum(q)); return s[s.length >> 1] || [0, 0, 0]; };
    const bg = med(bgs);
    // painted ink: the shown pixel furthest in luminance from the background (anti-aliasing only reduces contrast)
    const far = ink.reduce((b, p) => Math.abs(lum(p) - lum(bg)) > Math.abs(lum(b) - lum(bg)) ? p : b, bg);
    it.bg = bg; it.inkPainted = far;
    it.crComputed = cr(rgb(it.color), bg);              // computed colour vs painted background (opacity 1 cases)
    it.crPainted = cr(far, bg);
    it.pass = (it.fs >= 18.66 || (it.fs >= 14 && +it.fw >= 700)) ? it.crComputed >= 3 : it.crComputed >= 4.5;
  }
  return info;
}

const L = await local({ variant: MODE === 'park' ? 'park' : 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  for (const theme of themes) {
    const [th, mode] = KEYS[theme];
    await L.reset(MODE === 'park' ? 'park' : 'typical');   // each theme starts from the seeded household (activeList etc.)
    for (const p of profiles) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }).catch(e => console.log('theme put', p, e.message));
    for (const p of profiles) for (const [area, screen, selector] of JOBS) {
      const s = await def(area, screen);
      const d = await L.device({ device: 'ipad-portrait', mode, profile: p, localStorage: { 'hub.theme': JSON.stringify(th), ...(s.localStorage || {}) } });
      const row = { theme, profile: p, area, screen, selector };
      try {
        const t = makeT(L, d, MODE === 'park' ? 'park' : 'typical', mode);
        try { await s.go(t); } catch (e) { row.goError = String(e.message).split('\n')[0]; }
        await sleep(1200);
        Object.assign(row, await measure(d, area, selector));
        if (SHOT && row.items && row.items.length && !fs.existsSync(path.join(EVID, `verify-raw-accent-as-text-2-${screen}-${p}-${theme}.png`)) && SHOT.split(',').includes(`${screen}:${p}:${theme}`))
          await d.page.screenshot({ path: path.join(EVID, `verify-raw-accent-as-text-2-${screen}-${p}-${theme}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      } catch (e) { row.error = String(e.message).split('\n')[0]; }
      await d.close();
      rows.push(row);
      const its = row.items || [];
      console.log(theme, p, screen, 'accent', row.htmlAccent, 'shared', row.bodyShared, 'n', its.length, 'cr', its.map(x => x.crComputed).join(' '), its[0] ? `"${its[0].text}" ${its[0].color} fs${its[0].fs} op${its[0].op}` : (row.goError || row.error || ''));
    }
  }
} finally { await L.close(); }
const summary = {};
for (const r of rows) for (const it of r.items || []) {
  const k = r.screen; summary[k] ||= { n: 0, fail: 0, min: 99, max: 0, byProfileTheme: {} };
  const s = summary[k]; s.n++; if (!it.pass) s.fail++; s.min = Math.min(s.min, it.crComputed); s.max = Math.max(s.max, it.crComputed);
  const kk = `${r.profile}/${r.theme}`; s.byProfileTheme[kk] ||= []; if (!s.byProfileTheme[kk].includes(it.crComputed)) s.byProfileTheme[kk].push(it.crComputed);
}
const out = path.join(EVID, `verify-raw-accent-as-text-2-${MODE}.json`);
fs.writeFileSync(out, JSON.stringify({ script: 'audits/tools/phase4/ACCENT/verify-raw-accent-as-text-2.mjs', engine: 'webkit', device: 'ipad-portrait', summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('wrote', path.relative(ROOT, out));
