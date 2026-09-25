// Phase 4 ICON — skeptic #1 re-measure of "gold-icon-ink-hearth": --gold used as an icon ink on a gold tint in Hearth.
// Independent of measure.mjs: targets named by selector, computed ink colour, background from the pixels of the icon's
// box with the icon hidden (min / median / max contrast over that box), plus a colour-emoji test for text glyphs (does the
// glyph change when its `color` changes? if not, the ink is not what is drawn) and the analytic token contrast per theme.
//   node audits/tools/phase4/ICON/verify-gold-icon-ink-hearth-1.mjs
// → audits/evidence/p4/ICON/verify-gold-icon-ink-hearth-1.json (+ -tv.png crop)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/ICON');
const THEME = 'hearth';

// ── analytic: tokens from apps/design.css per theme ──
const css = fs.readFileSync('apps/design.css', 'utf8');
const block = sel => { const i = css.indexOf(sel); return css.slice(i, css.indexOf('\n}', i)); };
const tok = (b, n) => { const m = b.match(new RegExp('--' + n + ':\\s*(#[0-9A-Fa-f]{6})')); return m ? m[1] : null; };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
const BLOCKS = { hearth: ':root {', parchment: ':root[data-theme="parchment"]', frost: ':root[data-theme="frost"]', midnight: ':root[data-theme="midnight"]', forest: ':root[data-theme="forest"]' };
const analytic = {};
for (const [t, s] of Object.entries(BLOCKS)) {
  const b = block(s); const gold = hex(tok(b, 'gold')), soft = hex(tok(b, 'gold-soft')), ink = hex(tok(b, 'gold-ink')), surf = hex(tok(b, 'surface'));
  analytic[t] = { gold: tok(b, 'gold'), goldSoft: tok(b, 'gold-soft'), goldInk: tok(b, 'gold-ink'), surface: tok(b, 'surface'),
    goldOnSoft: ratio(gold, soft), goldOnAppIcon22: ratio(gold, mix(gold, surf, .22)), goldOnAppIcon14: ratio(gold, mix(gold, surf, .14)), goldOnAppIcon8: ratio(gold, mix(gold, surf, .08)),
    inkOnSoft: ratio(ink, soft), inkOnAppIcon22: ratio(ink, mix(gold, surf, .22)) };
}

const SAMPLE = async ([b64, box, fg]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(Math.floor(box.x), Math.floor(box.y), Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h))).data;
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  const r = px.map(p => ratio(fg, p)).sort((a, b) => a - b);
  const byL = px.slice().sort((a, b) => lum(a) - lum(b));
  return { n: px.length, bgMedian: byL[Math.floor(byL.length / 2)], min: +r[0].toFixed(2), median: +r[Math.floor(r.length / 2)].toFixed(2), max: +r[r.length - 1].toFixed(2) };
};
const DIFF = async ([a, b, box]) => {
  const ld = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); return cx.getImageData(Math.floor(box.x), Math.floor(box.y), Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h))).data; };
  const A = await ld(a), B = await ld(b); let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++; return n;
};

// measure every element matching `q` inside `fr` (page or frame); `glyph` = a text glyph (hide via color)
async function measure(d, fr, label, q, { glyph = false } = {}) {
  const page = d.page;
  let off = { x: 0, y: 0 };
  if (fr !== page) { const bb = await (await fr.frameElement()).boundingBox(); off = { x: bb.x, y: bb.y }; }
  const n = await fr.evaluate(q => document.querySelectorAll(q).length, q);
  const res = [];
  for (let i = 0; i < n; i++) {
    const info = await fr.evaluate(([q, i]) => {
      const el = document.querySelectorAll(q)[i]; el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const svgUse = el.querySelector && el.querySelector('use');
      const holder = el.closest('.app-icon, .mi, span.on');
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const top = document.elementFromPoint(cx, cy);
      return { text: el.tagName === 'svg' || el.tagName === 'SVG' ? null : el.textContent.trim(), sprite: svgUse ? svgUse.getAttribute('href') : null,
        color: cs.color, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, heading: (el.closest('h2') || {}).textContent?.trim().slice(0, 40) || null,
        holderBg: holder ? getComputedStyle(holder).backgroundImage + ' | ' + getComputedStyle(holder).backgroundColor : null, onTop: !!top && (top === el || el.contains(top) || top.contains(el)), fontFamily: cs.fontFamily.slice(0, 60) };
    }, [q, i]);
    await sleep(200);
    const info2 = await fr.evaluate(([q, i]) => { const r = document.querySelectorAll(q)[i].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, [q, i]);
    const box = { x: off.x + info2.x, y: off.y + info2.y, w: info2.w, h: info2.h };
    const fgArr = info.color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const setStyle = (st) => fr.evaluate(([q, i, st]) => { const el = document.querySelectorAll(q)[i]; if (st == null) el.removeAttribute('data-vstyle'), el.style.cssText = el.dataset.vorig || ''; else { if (el.dataset.vorig == null) el.dataset.vorig = el.style.cssText; el.style.cssText = el.dataset.vorig + ';' + st; } }, [q, i, st]);
    const shot = async () => (await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' })).toString('base64');
    const vis = await shot();
    await setStyle(glyph ? 'color:transparent!important;-webkit-text-fill-color:transparent!important' : 'visibility:hidden!important'); await sleep(80);
    const hid = await shot();
    const bg = await page.evaluate(SAMPLE, [hid, box, fgArr]);
    const peakVis = await page.evaluate(SAMPLE, [vis, box, bg.bgMedian]);
    let emoji = null;
    if (glyph) { // does changing the ink change the pixels? colour emoji ignore `color`
      await setStyle('color:rgb(255,0,0)!important'); await sleep(60); const red = await shot();
      await setStyle('color:rgb(0,0,255)!important'); await sleep(60); const blue = await shot();
      const changed = await page.evaluate(DIFF, [red, blue, box]);
      const hiddenDiff = await page.evaluate(DIFF, [vis, hid, box]);
      emoji = { pixelsChangedRedVsBlue: changed, pixelsChangedVisVsTransparent: hiddenDiff, inkApplies: changed > 3 };
    }
    await setStyle(null);
    res.push({ label, i, ...info, box: Object.fromEntries(Object.entries(box).map(([k, v]) => [k, +v.toFixed(1)])), ink: fgArr,
      contrastOverBox: { min: bg.min, median: bg.median, max: bg.max }, bgMedian: bg.bgMedian, bgPixels: bg.n, peakPixelVsBg: peakVis.max, emoji });
  }
  return res;
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { theme: THEME, engine: 'webkit', variant: 'typical', analytic, surfaces: {} };
const waitFn = (d, fn, t = 10000) => d.page.waitForFunction(fn, null, { timeout: t }).then(() => true, () => false);
const settle = async d => { await d.page.waitForSelector('#view-home .home-hero, #view-home #tv', { timeout: 15000 }); await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull)); await sleep(1200); };
try {
  for (const p of ['eli', 'ezra']) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: THEME, updated_at: Date.now() } });
  const ls = { 'hub.theme': JSON.stringify(THEME) };
  const applied = fr => fr.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind }));
  const GOLDISH = 'h2 .app-icon svg.icon';
  // Home (adult)
  { const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli', localStorage: ls }); await d.goto('#home'); await settle(d);
    out.surfaces['home-adult'] = { applied: await applied(d.page), items: await measure(d, d.page, 'home-adult', '#view-home ' + GOLDISH) }; await d.close(); }
  // Home (kid)
  { const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'ezra', localStorage: ls }); await d.goto('#home'); await settle(d);
    out.surfaces['home-kid'] = { applied: await applied(d.page), items: await measure(d, d.page, 'home-kid', '#view-home ' + GOLDISH) }; await d.close(); }
  // Me (adult)
  { const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli', localStorage: ls }); await d.goto('#home'); await settle(d);
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(1500);
    out.surfaces['me-adult'] = { applied: await applied(d.page), items: await measure(d, d.page, 'me-adult', '#view-me ' + GOLDISH) }; await d.close(); }
  // TV
  { const d = await L.device({ device: 'tv', mode: 'light', profile: 'tv', localStorage: ls }); await d.goto('#home'); await d.page.waitForSelector('#tv', { timeout: 15000 }); await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull)); await sleep(2500);
    out.surfaces['tv'] = { applied: await applied(d.page), items: await measure(d, d.page, 'tv', '#tv ' + GOLDISH) };
    await d.page.screenshot({ path: path.join(OUT, 'verify-gold-icon-ink-hearth-1-tv.png'), scale: 'css', animations: 'disabled', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    await d.close(); }
  // Kid Verse (kid, phone) and (adult, iPad)
  for (const [name, dev, prof] of [['kidverse-kid', 'iphone-pwa', 'ezra'], ['kidverse-adult', 'ipad-portrait', 'eli']]) {
    const d = await L.device({ device: dev, mode: 'light', profile: prof, localStorage: ls }); const f = await d.openApp('kidverse'); await sleep(2500);
    out.surfaces[name] = { applied: await applied(f), items: await measure(d, f, name, '.days span.on svg.icon') }; await d.close();
  }
  // F260 milestones
  { const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli', localStorage: ls }); const f = await d.openApp('f260'); await sleep(3000);
    out.surfaces['f260'] = { applied: await applied(f), items: await measure(d, f, 'f260', '#miles .mile.on .mi', { glyph: true }) }; await d.close(); }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-gold-icon-ink-hearth-1.json'), JSON.stringify(out, null, 1));
for (const [s, v] of Object.entries(out.surfaces)) { console.log('==', s, JSON.stringify(v.applied)); for (const it of v.items || []) console.log(' ', it.heading || it.text, it.sprite || '', 'ink', it.ink.join(','), 'bg', (it.bgMedian || []).join(','), 'min/med/max', it.contrastOverBox.min, it.contrastOverBox.median, it.contrastOverBox.max, 'onTop', it.onTop, it.emoji ? JSON.stringify(it.emoji) : ''); }
console.log(JSON.stringify(analytic, null, 0));
