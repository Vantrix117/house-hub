#!/usr/bin/env node
// Phase 4 ACCENT skeptic #2 — "park map north-up pressed: the 9 px red N sits on the person's accent-deep fill".
// For each profile x theme: sign in (theme = server row + localStorage), open dollywood-live in the shell, tap #lv-north,
// read the computed background of the button and colour of its <b>N</b> (token ratio), then pixel-check: screenshot with
// the <b> hidden and take the median of the pixels under the glyph box (what the N really sits on), and the fraction of
// the glyph box that lies inside the 44 px circle. Also the svg north arrow fill (#FF6B4A) against the same fill.
//   node audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-2.mjs [--profiles=a,b] [--themes=x,y] [--append]
// -> audits/evidence/p4/ACCENT/verify-park-north-n-on-accent-2.json (+ 1x crops)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const NAME = 'verify-park-north-n-on-accent-2';
const lum = ([r, g, b]) => { const c = [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const parseRgb = s => { const c = String(s).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (c) return [1, 2, 3].map(i => Math.round(+c[i] * 255)); const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); };
const THEMES = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'light'], forest: ['forest', 'light'] };
const argv = process.argv.slice(2);
const PROFILES = (argv.find(a => a.startsWith('--profiles=')) || '--profiles=eli,christian,mom,dad,niece,ezra,kiara').slice(11).split(',');
const THS = (argv.find(a => a.startsWith('--themes=')) || '--themes=' + Object.keys(THEMES).join(',')).slice(9).split(',');

function median(img, box) {
  const R = [], G = [], B = [];
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(img.h, Math.ceil(box.y + box.height)); y++)
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(img.w, Math.ceil(box.x + box.width)); x++) {
      const i = (y * img.w + x) * 4; R.push(img.px[i]); G.push(img.px[i + 1]); B.push(img.px[i + 2]);
    }
  const m = a => a.sort((p, q) => p - q)[a.length >> 1];
  return [m(R), m(G), m(B)];
}

const results = [];
async function main() {
  const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
  try {
    await L.reset('park');
    for (const profile of PROFILES) for (const theme of THS) {
      const [th, mode] = THEMES[theme];
      await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }).catch(() => null);
      const d = await L.device({ device: 'iphone-pwa', mode, profile, localStorage: { 'hub.theme': JSON.stringify(th) } });
      const rec = { profile, theme };
      try {
        const f = await d.openApp('dollywood-live'); await sleep(3500);
        const btn = f.locator('#lv-north');
        if (!(await btn.count())) { rec.missing = 'no #lv-north'; results.push(rec); await d.close(); continue; }
        rec.visibleBefore = await btn.isVisible();
        await btn.click({ timeout: 5000 }).catch(e => { rec.clickErr = String(e).slice(0, 200); });
        await sleep(1200);
        const info = await btn.evaluate(el => {
          const b = el.querySelector('b'); const cs = getComputedStyle(el), bs = getComputedStyle(b);
          const arrow = el.querySelector('svg path');
          const r = el.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const root = getComputedStyle(document.documentElement);
          return { pressed: el.getAttribute('aria-pressed'), bg: cs.backgroundColor, bgImage: cs.backgroundImage.slice(0, 80), btnColor: cs.color, transform: el.style.transform,
            nColor: bs.color, nSize: bs.fontSize, nWeight: bs.fontWeight, arrowFill: arrow && arrow.getAttribute('fill'),
            accent: root.getPropertyValue('--accent').trim(), accentDeep: root.getPropertyValue('--accent-deep').trim(), danger: root.getPropertyValue('--danger').trim(),
            theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme || null, flavor: document.documentElement.dataset.flavor || null,
            btnBox: [r.x, r.y, r.width, r.height].map(Math.round), nBox: [rb.x, rb.y, rb.width, rb.height].map(v => +v.toFixed(1)) };
        });
        Object.assign(rec, info);
        rec.tokenRatioN = cr(parseRgb(info.nColor), parseRgb(info.bg));
        rec.tokenRatioArrow = cr([0xFF, 0x6B, 0x4A], parseRgb(info.bg));
        const nb = await f.locator('#lv-north b').boundingBox();   // page coordinates
        const bb = await btn.boundingBox();
        await f.locator('#lv-north b').evaluate(el => { el.style.visibility = 'hidden'; });
        await sleep(200);
        const img = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
        await f.locator('#lv-north b').evaluate(el => { el.style.visibility = ''; });
        rec.pixelUnderN = median(img, nb);
        rec.pixelRatioN = cr(parseRgb(info.nColor), rec.pixelUnderN);
        const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, rad = bb.width / 2; let inside = 0, tot = 0;
        for (let y = nb.y; y < nb.y + nb.height; y += 0.5) for (let x = nb.x; x < nb.x + nb.width; x += 0.5) { tot++; if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) inside++; }
        rec.nInsideCircle = +(inside / tot).toFixed(2);
        if ((profile === 'eli' && (theme === 'system-light' || theme === 'system-dark')) || (profile === 'dad' && theme === 'system-light')) {
          const file = `${NAME}-${profile}-${theme}.png`;
          await d.page.screenshot({ path: path.join(OUT, file), clip: { x: Math.max(0, bb.x - 30), y: Math.max(0, bb.y - 30), width: 160, height: 110 }, scale: 'css', animations: 'disabled' });
          rec.shot = 'audits/evidence/p4/ACCENT/' + file;
        }
      } catch (e) { rec.error = String(e).slice(0, 300); }
      results.push(rec);
      console.log(JSON.stringify({ profile, theme, pressed: rec.pressed, bg: rec.bg, n: rec.nColor, tok: rec.tokenRatioN, px: rec.pixelRatioN, under: rec.pixelUnderN, arrow: rec.tokenRatioArrow, inside: rec.nInsideCircle, err: rec.error || rec.clickErr }));
      await d.close();
    }
  } finally { await L.close(); }
  let all = results;
  const file = path.join(OUT, NAME + '.json');
  if (argv.includes('--append') && fs.existsSync(file)) all = JSON.parse(fs.readFileSync(file, 'utf8')).results.concat(results);
  const px = all.filter(r => r.pixelRatioN != null);
  const out = { script: 'audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-2.mjs', device: 'iphone-pwa (430x932), WebKit, park seed, demo clock', n: all.length,
    below3: px.filter(r => r.pixelRatioN < 3).length, below45: px.filter(r => r.pixelRatioN < 4.5).length,
    minPx: Math.min(...px.map(r => r.pixelRatioN)), maxPx: Math.max(...px.map(r => r.pixelRatioN)), results: all };
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log('summary', out.n, 'below3', out.below3, 'below4.5', out.below45, 'min', out.minPx, 'max', out.maxPx);
}
main().catch(e => { console.error(e); process.exit(1); });
