// VIS skeptic #1 — candidate "dark-hero-contrast": is the Home hero kicker / title / sub-line below WCAG contrast in dark?
// Method (independent of the investigator's token maths):
//   1. Load Home on the local instance (WebKit) for each case: OS scheme x chosen theme x profile x time of day x device.
//   2. Read each hero text element's computed colour, its effective opacity (element -> .hero) and its line boxes
//      (Range.getClientRects on the text).
//   3. Screenshot the viewport at 1x CSS scale with the text visible (evidence) and again with the hero text made
//      transparent, so the second image is exactly the rendered background behind the glyphs (gradient + ::before
//      time-of-day soft-light + ::after sheen, as painted).
//   4. For every background pixel inside each line box: effective fg = alpha*text + (1-alpha)*bg, WCAG ratio vs bg.
//      Report min / p10 / median / max and the share of pixels under the element's threshold (4.5, or 3 for large text).
//   5. Cross-check from tokens: text vs the three gradient stops, resolved by the browser.
//   node "audits/tools/phase2/VIS/verify3-dark-hero-contrast-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { local, sleep, ROOT, DEMO } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'VIS');
// --chromium: same cases in the installed Chrome (engine cross-check); --only <prefix>: run only cases whose label starts with it
const ENGINE = process.argv.includes('--chromium') ? 'chromium' : 'webkit';
const ONLY = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--only'));
const PFX = 'verify3-dark-hero-contrast-1' + (ENGINE === 'chromium' ? '-chromium' : '');
fs.mkdirSync(EVID, { recursive: true });
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

// ── PNG decode (8-bit RGB/RGBA, non-interlaced — what Playwright writes) ──
function decodePNG(buf) {
  let pos = 8, w, h, bd, ct, il; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bd !== 8 || il || (ct !== 6 && ct !== 2)) throw new Error(`unsupported PNG bd=${bd} ct=${ct} il=${il}`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2]; out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, data: out };
}
// ── WCAG maths ──
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexOf = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const r2 = x => Math.round(x * 100) / 100;
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];

const at = hhmm => { const d = new Date(DEMO); const [hh, mm] = hhmm.split(':').map(Number); return Date.parse(`2026-09-22T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-04:00`); };
const TIMES = { morning: DEMO + 500, afternoon: at('14:30'), evening: at('21:00') };

const HIDE = `.home-hero .hero-kicker, .home-hero .hero-kicker *, .home-hero .hero-title, .home-hero .hero-title *, .home-hero .hero-sub, .home-hero .hero-sub * {
  color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }`;

async function measure(L, { label, device = 'ipad-portrait', mode, theme = null, profile, tod, shots = false, expect }) {
  const d = await L.device({ device, mode, profile, fixedTime: TIMES[tod] });
  try {
    await d.goto('#home');
    await d.page.waitForSelector('#view-home .home-hero .hero-title', { timeout: 15000 });
    await sleep(900);
    if (theme) { await d.page.evaluate(t => hub.setTheme(t), theme); await sleep(400); }
    await d.page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const info = await d.page.evaluate(() => {
      const root = document.documentElement, hero = document.querySelector('#view-home .home-hero');
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgba = s => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = s; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data]; };
      const probe = document.createElement('div'); hero.appendChild(probe);
      const tok = v => { probe.style.color = ''; probe.style.color = v; return rgba(getComputedStyle(probe).color); };
      const stops = { light: tok('color-mix(in srgb, var(--accent) 70%, white)'), mid: tok('var(--accent)'), deep: tok('var(--accent-deep)'), text: tok('var(--text)'), onAccent: tok('var(--on-accent)') };
      probe.remove();
      const els = {};
      for (const k of ['hero-kicker', 'hero-title', 'hero-sub']) {
        const el = hero.querySelector('.' + k); if (!el) continue;
        const cs = getComputedStyle(el);
        let op = 1; for (let n = el; n && n !== hero.parentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        const rg = document.createRange(); rg.selectNodeContents(el);
        const rects = [...rg.getClientRects()].filter(r => r.width > 2 && r.height > 2).map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
        const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400;
        els[k] = { text: el.textContent.trim().slice(0, 80), color: rgba(cs.color), colorCss: cs.color, opacity: op, fontSize: fs, fontWeight: fw, textShadow: cs.textShadow,
          large: fs >= 24 || (fs >= 18.66 && fw >= 700), rects };
      }
      const hr = hero.getBoundingClientRect();
      return { theme: root.dataset.theme || '(none)', scheme: root.dataset.scheme, kind: root.dataset.kind, accent: getComputedStyle(root).getPropertyValue('--accent').trim(),
        classes: hero.className, heroRect: { x: hr.left, y: hr.top, w: hr.width, h: hr.height }, heroColor: getComputedStyle(hero).color, bgImage: getComputedStyle(hero).backgroundImage.slice(0, 300), stops, els };
    });
    const clip = { x: Math.max(0, info.heroRect.x), y: Math.max(0, info.heroRect.y), width: info.heroRect.w, height: info.heroRect.h };
    const safe = label.replace(/[^a-z0-9-]+/gi, '-');
    let shotWith = null, shotBg = null;
    if (shots) {
      shotWith = path.join(EVID, `${PFX}-${safe}-hero.png`);
      await d.page.screenshot({ path: shotWith, scale: 'css', clip, animations: 'disabled', caret: 'hide' });
    }
    await d.page.addStyleTag({ content: HIDE }); await sleep(150);
    const bgBuf = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    if (shots) { shotBg = path.join(EVID, `${PFX}-${safe}-hero-bg-only.png`); await d.page.screenshot({ path: shotBg, scale: 'css', clip, animations: 'disabled', caret: 'hide' }); }
    const img = decodePNG(bgBuf);
    const vw = await d.page.evaluate(() => innerWidth);
    if (img.w !== vw) throw new Error(`screenshot not 1x css: ${img.w} vs ${vw}`);
    const res = {};
    for (const [k, e] of Object.entries(info.els)) {
      const fg = e.color, a = (fg[3] / 255) * e.opacity, thr = e.large ? 3 : 4.5;
      const vals = []; let bgMin = null, bgMax = null, lMin = 9, lMax = -1, sumBg = [0, 0, 0];
      for (const r of e.rects) {
        for (let y = Math.ceil(r.y + 1); y < Math.floor(r.y + r.h - 1); y++) for (let x = Math.ceil(r.x + 1); x < Math.floor(r.x + r.w - 1); x++) {
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const o = (y * img.w + x) * 4, bg = [img.data[o], img.data[o + 1], img.data[o + 2]];
          const eff = [0, 1, 2].map(i => a * fg[i] + (1 - a) * bg[i]);
          vals.push(ratio(eff, bg));
          const l = lum(bg); if (l < lMin) { lMin = l; bgMin = bg; } if (l > lMax) { lMax = l; bgMax = bg; }
          sumBg[0] += bg[0]; sumBg[1] += bg[1]; sumBg[2] += bg[2];
        }
      }
      vals.sort((p, q) => p - q);
      const n = vals.length, under = vals.filter(v => v < thr).length;
      res[k] = { text: e.text, fg: hexOf(fg), alpha: r2(a), fontSize: e.fontSize, fontWeight: e.fontWeight, large: e.large, threshold: thr, textShadow: e.textShadow,
        pixels: n, min: r2(vals[0]), p10: r2(pct(vals, 0.1)), median: r2(pct(vals, 0.5)), max: r2(vals[n - 1]), shareUnderThreshold: r2(under / n),
        darkestBg: hexOf(bgMin), lightestBg: hexOf(bgMax), meanBg: hexOf(sumBg.map(v => v / n)) };
    }
    const tfg = info.els['hero-title'] ? info.els['hero-title'].color : info.stops.text;
    const tokenCheck = { 'text vs light stop (70% accent + white)': r2(ratio(tfg, info.stops.light)), 'text vs mid stop (accent)': r2(ratio(tfg, info.stops.mid)), 'text vs far stop (accent-deep)': r2(ratio(tfg, info.stops.deep)),
      stops: { light: hexOf(info.stops.light), mid: hexOf(info.stops.mid), deep: hexOf(info.stops.deep) } };
    const ok = !expect || (expect.scheme === info.scheme && expect.theme === info.theme);
    if (!ok) throw new Error(`state mismatch: expected ${JSON.stringify(expect)}, got scheme=${info.scheme} theme=${info.theme}`);
    return { label, device, mode, themeRequested: theme || 'system', profile, tod, resolved: { theme: info.theme, scheme: info.scheme, kind: info.kind, accent: info.accent, heroClasses: info.classes, heroColor: info.heroColor },
      elements: res, tokenCheck, shots: shotWith ? { withText: rel(shotWith), bgOnly: rel(shotBg) } : null, pageErrors: d.logs.filter(l => l.startsWith('pageerror')) };
  } finally {
    if (theme) {   // hub.setTheme writes the person's preference to the (local) server: put it back to System so later cases start clean
      await d.page.evaluate(async () => { hub.setTheme('system'); for (let i = 0; i < 50 && hub.sync.pending; i++) await new Promise(r => setTimeout(r, 100)); }).catch(() => {});
      await sleep(300);
    }
    await d.close();
  }
}

const L = await local({ variant: 'typical', engine: ENGINE });
const out = { method: 'see header', engine: ENGINE, only: ONLY, sessions: Object.keys(L.S.sessions), cases: [] };
const line = c => { const e = c.elements; const f = k => e[k] ? `${e[k].min}-${e[k].median}-${e[k].max} (<${e[k].threshold}: ${Math.round(e[k].shareUnderThreshold * 100)}%)` : '—';
  return `${c.label.padEnd(48)} scheme=${c.resolved.scheme} theme=${c.resolved.theme} | kicker ${f('hero-kicker')} | title ${f('hero-title')} | sub ${f('hero-sub')}`; };
try {
  console.log('sessions:', out.sessions.join(', '));
  const guest = out.sessions.find(s => s.startsWith('guest-'));
  const adults = ['eli', 'christian', 'mom', 'dad', 'niece', ...(guest ? [guest] : [])];
  const cases = [];
  const DARK = { scheme: 'dark', theme: '(none)' }, LIGHT = { scheme: 'light', theme: '(none)' };
  // A. OS dark, theme = System (what the rig's "dark" captures show; System = Midnight at night)
  for (const p of adults) for (const tod of Object.keys(TIMES)) cases.push({ label: `A-darkOS-system-${p}-${tod}`, mode: 'dark', profile: p, tod, shots: p === 'eli' || tod === 'evening', expect: DARK });
  // D. light mode control: System on a light OS (Hearth), every adult
  for (const p of adults) for (const tod of Object.keys(TIMES)) cases.push({ label: `D-lightOS-system-${p}-${tod}`, mode: 'light', profile: p, tod, shots: p === 'eli', expect: LIGHT });
  // E. a kid (hero-soft) in dark — control
  for (const tod of ['morning', 'evening']) cases.push({ label: `E-darkOS-system-ezra-kid-${tod}`, mode: 'dark', profile: 'ezra', tod, shots: true, expect: DARK });
  // F. other devices, Eli, OS dark
  for (const dev of ['iphone-pwa', 'iphone-safari', 'desktop', 'ipad-landscape']) for (const tod of ['morning', 'evening']) cases.push({ label: `F-${dev}-darkOS-system-eli-${tod}`, device: dev, mode: 'dark', profile: 'eli', tod, shots: dev === 'iphone-pwa' || dev === 'desktop', expect: DARK });
  // B. Midnight and Forest picked explicitly on a light OS (Eli) — these write the preference; restored after each case
  for (const th of ['midnight', 'forest']) for (const tod of Object.keys(TIMES)) cases.push({ label: `B-lightOS-${th}-eli-${tod}`, mode: 'light', theme: th, profile: 'eli', tod, shots: tod !== 'afternoon', expect: { scheme: 'dark', theme: th } });
  // G. Hearth explicitly chosen on a dark OS (data-scheme=light but Midnight tokens) — control
  for (const tod of ['morning', 'evening']) cases.push({ label: `G-darkOS-hearth-eli-${tod}`, mode: 'dark', theme: 'hearth', profile: 'eli', tod, shots: true, expect: LIGHT });
  // H. after every theme write: Eli, dark OS, System again — proves the restore worked and nothing leaked
  cases.push({ label: 'H-darkOS-system-eli-morning-recheck', mode: 'dark', profile: 'eli', tod: 'morning', expect: DARK });
  for (const c of cases) {
    if (ONLY && !ONLY.split(',').some(o => c.label.startsWith(o))) continue;
    try { const r = await measure(L, c); out.cases.push(r); console.log(line(r)); }
    catch (e) { out.cases.push({ label: c.label, error: String(e.message || e).slice(0, 300) }); console.log(c.label, 'ERROR', e.message); }
  }
  // Summary by group: worst (min) and median of medians per element
  const groups = {};
  for (const c of out.cases) { if (c.error) continue; const g = c.label.split('-').slice(0, 3).join('-');
    for (const [k, e] of Object.entries(c.elements)) { (groups[g] ||= {})[k] ||= { mins: [], medians: [], under: [] }; groups[g][k].mins.push(e.min); groups[g][k].medians.push(e.median); groups[g][k].under.push(e.shareUnderThreshold); } }
  out.summary = {};
  for (const [g, els] of Object.entries(groups)) { out.summary[g] = {}; for (const [k, v] of Object.entries(els)) out.summary[g][k] = { worstMin: Math.min(...v.mins), medianRange: [Math.min(...v.medians), Math.max(...v.medians)], shareUnderRange: [Math.min(...v.under), Math.max(...v.under)] }; }
  console.log('\nSUMMARY'); console.log(JSON.stringify(out.summary, null, 1));
  // one full viewport shot at 1x for context
  const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', fixedTime: TIMES.evening });
  await d.goto('#home'); await d.page.waitForSelector('#view-home .home-hero .hero-title'); await sleep(900);
  const f = path.join(EVID, `${PFX}-A-ipad-portrait-darkOS-eli-evening-full.png`);
  await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); out.fullShot = rel(f); await d.close();
} finally {
  fs.writeFileSync(path.join(EVID, `${PFX}.json`), JSON.stringify(out, null, 1));
  console.log('\nwrote', rel(path.join(EVID, `${PFX}.json`)));
  await L.close();
}
