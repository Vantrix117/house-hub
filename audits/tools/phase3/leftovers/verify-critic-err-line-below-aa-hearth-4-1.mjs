// Skeptic #1 for "critic-err-line-below-aa-hearth-4": is the add bar's .err line (12 px, var(--danger),
// apps/leftovers.html:62) really below WCAG AA 4.5:1 in Hearth? Independent of the investigator's token math, this
// measures the RENDERED background pixels behind the error line (glass bar with its real backdrop blur, sheen and
// accent pickup, over whatever list content is under it) and the computed text colour, per palette, on iPhone PWA.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const P = 'verify-critic-err-line-below-aa-hearth-4-1';
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { device: 'iphone-pwa', profile: 'eli', seed: 'typical', themes: {} };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done', { timeout: 20000 }); await sleep(800);
  out.initialTheme = await f.evaluate(() => document.documentElement.dataset.theme || '(none)');
  out.voiceSupported = await f.evaluate(() => hub.voiceSupported);
  const frameEl = await f.frameElement(); const fb = await frameEl.boundingBox();
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
    const info = await f.evaluate(t => {
      document.documentElement.dataset.theme = t;
      const err = document.getElementById('err'); err.hidden = false; err.textContent = "Couldn't hear that — try again or type it.";
      const r = err.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(err); const tr = range.getBoundingClientRect();
      const cs = getComputedStyle(err);
      return { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, box: { x: r.x, y: r.y, w: r.width, h: r.height }, textRight: tr.right,
        dangerInk: (() => { const e = document.createElement('i'); e.style.color = 'var(--danger-ink)'; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; })() };
    }, theme);
    await sleep(500);
    // screenshot a background strip inside the err line box, right of the text, and decode pixels in the page
    const x0 = fb.x + info.textRight + 8, x1 = fb.x + info.box.x + info.box.w - 4;
    const clip = { x: x0, y: fb.y + info.box.y + 2, width: Math.max(4, x1 - x0), height: Math.max(2, info.box.h - 4) };
    const buf = await d.page.screenshot({ clip, scale: 'css' });
    const px = await d.page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data; const all = [];
      for (let i = 0; i < data.length; i += 4) all.push([data[i], data[i + 1], data[i + 2]]);
      return all;
    }, buf.toString('base64'));
    const lums = px.map(p => lum(p)).sort((a, b) => a - b);
    const byL = [...px].sort((a, b) => lum(a) - lum(b));
    const median = byL[Math.floor(byL.length / 2)], lightest = byL[byL.length - 1], darkest = byL[0];
    const fg = info.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const ink = info.dangerInk.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    out.themes[theme] = { text: info.color, fontSize: info.fontSize, fontWeight: info.fontWeight, samples: px.length, bgMedian: median, bgLightest: lightest, bgDarkest: darkest,
      contrastVsMedianBg: cr(fg, median), contrastVsLightestBg: cr(fg, lightest), contrastVsDarkestBg: cr(fg, darkest), dangerInkVsMedianBg: cr(ink, median) };
    console.log(theme, JSON.stringify({ fontSize: info.fontSize, text: info.color, bgMedian: median, vsMedian: cr(fg, median), vsLightest: cr(fg, lightest), vsDarkest: cr(fg, darkest), dangerInk: cr(ink, median) }));
    if (theme === 'hearth') {
      const b = { x: fb.x + info.box.x - 8, y: fb.y + info.box.y - 70, width: Math.min(info.box.w + 16, 420), height: info.box.h + 80 };
      await d.page.screenshot({ path: path.join(EV, P + '-hearth-bar.png'), clip: b, scale: 'css' });
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
console.log('initialTheme', out.initialTheme, 'voiceSupported', out.voiceSupported);
console.log('saved audits/evidence/p3/leftovers/' + P + '.json');
