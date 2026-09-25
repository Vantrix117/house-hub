// Phase 4 GLASS skeptic #1: do Prayer's #fab, the park map's / build guide's #lv-north and the build guide's #build sheet
// carry a live backdrop-filter under a fill that hides it? Independent of opaque-blur.mjs (which reads the v2 raw files):
// opens each app on the local instance, reads the computed fill + backdrop-filter + the stylesheet rules that set the
// element's background, then screenshots the element (CSS scale) shipped, shipped again (noise arm) and with ONLY that
// element's backdrop-filter removed, and diffs the pixels in the page. A positive control (a translucent glass layer in
// the same page) shows the diff can see a blur when there is one.
//   node audits/tools/phase4/GLASS/verify-opaque-fill-under-blur-1.mjs [--engine webkit|chromium]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = arg('engine', 'webkit');
const SAVE = arg('save', null) ? new RegExp(arg('save')) : null;   // e.g. --save 'light dollywood-live ipad'
const ONLY = arg('only', null) ? new RegExp(arg('only')) : null;
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS', `verify-opaque-fill-under-blur-1-${ENGINE}${arg('only', null) ? '-subset' : ''}.json`);

const JOBS = [
  { app: 'prayer', device: 'iphone-pwa', wait: '#fab', targets: ['#fab'], control: 'nav' },
  { app: 'prayer', device: 'ipad-portrait', wait: '#fab', targets: ['#fab'], control: 'nav' },
  { app: 'dollywood-live', device: 'ipad-portrait', wait: '#lv-north', targets: ['#lv-north'], control: '#lv-fit' },
  { app: 'dollywood-live', device: 'iphone-pwa', wait: '#lv-north', targets: ['#lv-north'], control: '#lv-fit' },
  { app: 'dollywood', device: 'ipad-portrait', wait: '#chips button', targets: ['#lv-north'], control: null },
  { app: 'dollywood', device: 'iphone-pwa', wait: '#chips button', targets: ['#build', '#lv-north'], control: null, full: true },
];

const info = (f, sel) => f.evaluate(sel => {
  const e = document.querySelector(sel); if (!e) return { found: false };
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 40); const hit = document.elementFromPoint(cx, cy);
  const rules = [];
  const walk = (list, sheet) => {
    for (const ru of list) {
      if (ru.cssRules && !ru.selectorText) { walk(ru.cssRules, sheet); continue; }
      if (!ru.selectorText || !ru.style) continue;
      let m = false; try { m = e.matches(ru.selectorText); } catch {} if (!m) continue;
      const bg = ru.style.getPropertyValue('background') || ru.style.getPropertyValue('background-color');
      const bf = ru.style.getPropertyValue('backdrop-filter') || ru.style.getPropertyValue('-webkit-backdrop-filter');
      const g = ru.style.getPropertyValue('--g');
      if (bg || bf || g) rules.push({ sheet, sel: ru.selectorText.slice(0, 140), background: bg.slice(0, 160), bgPriority: ru.style.getPropertyPriority('background') || ru.style.getPropertyPriority('background-color'), backdrop: bf.slice(0, 80), g: g.slice(0, 80) });
    }
  };
  for (const sh of document.styleSheets) { let list; try { list = sh.cssRules; } catch { continue; } walk(list, (sh.href || 'inline').split('/').pop()); }
  return { found: true, display: s.display, visibility: s.visibility, opacity: s.opacity, bgColor: s.backgroundColor, bgImage: s.backgroundImage.slice(0, 200), backdrop: s.backdropFilter || s.webkitBackdropFilter,
    rect: [r.x, r.y, r.width, r.height].map(Math.round), onTop: !!hit && (hit === e || e.contains(hit)), flavor: document.documentElement.dataset.flavor || document.body.dataset.flavor || null,
    scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme, rules };
}, sel);

async function shot(f, sel) { const b = await f.locator(sel).first().screenshot({ scale: 'css', animations: 'disabled', caret: 'hide', timeout: 8000 }); return b.toString('base64'); }
const setOff = (f, sel, on) => f.evaluate(([sel, on]) => {
  let st = document.getElementById('v1-bf-off');
  if (!on) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('style'); st.id = 'v1-bf-off'; document.head.appendChild(st); }
  st.textContent = sel + '{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
}, [sel, on]);
const diff = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]); const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
  const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
  const A = px(ia), B = px(ib); let n = 0, max = 0, sum = 0;
  for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); sum += d; if (d > max) max = d; if (d > 3) n++; }
  return { w, h, px: w * h, changedPx: n, changedPct: +(100 * n / (w * h)).toFixed(3), maxDiff: max, meanDiff: +(sum / (w * h)).toFixed(3) };
}, [a, b]);

async function measure(page, f, sel, tag = '') {
  const i = await info(f, sel); if (!i.found || i.display === 'none' || !(i.rect[2] > 0)) return { info: i };
  const s1 = await shot(f, sel); await sleep(400); const s2 = await shot(f, sel);
  await setOff(f, sel, true); await sleep(400);
  const bfOff = await f.evaluate(s => { const c = getComputedStyle(document.querySelector(s)); return c.backdropFilter || c.webkitBackdropFilter; }, sel);
  const s3 = await shot(f, sel); await setOff(f, sel, false); await sleep(200);
  if (SAVE && SAVE.test(tag + ' ' + sel)) { const base = path.join(ROOT, 'audits/evidence/p4/GLASS', 'verify-opaque-fill-under-blur-1-' + ENGINE + '-' + (tag + sel).replace(/[^a-z0-9]+/gi, '-')); fs.writeFileSync(base + '-shipped.png', Buffer.from(s1, 'base64')); fs.writeFileSync(base + '-noblur.png', Buffer.from(s3, 'base64')); }
  return { info: i, bfWhenOff: bfOff, noise: await diff(page, s1, s2), blurRemoved: await diff(page, s1, s3) };
}

const L = await local({ variant: 'typical', engine: ENGINE });
const out = { engine: ENGINE, runs: [] };
try {
  for (const mode of ['light', 'dark']) for (const j of JOBS) {
    if (ONLY && !ONLY.test(`${mode} ${j.app} ${j.device}`)) continue;
    const d = await L.device({ device: j.device, mode, profile: 'eli' });
    const run = { app: j.app, device: j.device, mode, targets: {}, control: null };
    try {
      await d.goto('#home');
      const f = await d.openApp(j.app, { wait: j.wait });
      await f.evaluate(() => Promise.race([window.hub && hub.ready({ optional: true }), new Promise(r => setTimeout(r, 4000))])).catch(() => {});
      await sleep(1500);
      if (j.full) {
        for (let k = 0; k < 2; k++) { await f.locator('#bh-handle').click({ force: true, timeout: 4000 }).catch(() => {}); await sleep(500); }
        run.buildState = await f.evaluate(() => { const b = document.getElementById('build'); return b && b.dataset.state; });
      }
      await d.page.mouse.move(1, 1).catch(() => {});
      for (const sel of j.targets) run.targets[sel] = await measure(d.page, f, sel, `${mode} ${j.app} ${j.device}`);
      if (j.control) run.control = { sel: j.control, ...(await measure(d.page, f, j.control)) };
    } catch (e) { run.error = String(e).slice(0, 300); }
    out.runs.push(run);
    const brief = Object.entries(run.targets).map(([k, v]) => `${k} bg=${v.info && v.info.bgColor} disp=${v.info && v.info.display} rect=${v.info && v.info.rect} top=${v.info && v.info.onTop} noise=${v.noise && v.noise.changedPx} off=${v.blurRemoved && v.blurRemoved.changedPx}/${v.blurRemoved && v.blurRemoved.px} max=${v.blurRemoved && v.blurRemoved.maxDiff}`).join(' | ');
    const c = run.control;
    console.log(mode, j.app, j.device, run.buildState || '', brief, c ? `CTRL ${c.sel} bg=${c.info && c.info.bgColor} off=${c.blurRemoved && c.blurRemoved.changedPx}/${c.blurRemoved && c.blurRemoved.px} max=${c.blurRemoved && c.blurRemoved.maxDiff}` : '', run.error || '');
    await d.ctx.close().catch(() => {});
  }
} finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
