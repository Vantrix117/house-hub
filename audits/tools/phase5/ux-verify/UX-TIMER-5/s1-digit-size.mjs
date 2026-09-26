// UX-TIMER-5 skeptic s1: dial size, digit ink height and free space in the hub viewer on the rig iPad (portrait, landscape).
// Ink height is measured on the real glyphs of the rendered "#t" (canvas measureText with the computed font) and cross-checked
// against the uncapped dial size min(82vw, 52vh) the cap removes. Local rig only, WebKit, real clock.
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-5/s1-digit-size.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-TIMER-5', 's1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const device of ['ipad-portrait', 'ipad-landscape']) {
    const d = await L.device({ device, profile: 'mom', fixedTime: false });
    const f = await d.openApp('timer', { wait: '#go' });
    await f.waitForFunction(() => window.hub && hub.profile); await sleep(1200);
    out[device] = await f.evaluate(() => {
      const t = document.getElementById('t'), cs = getComputedStyle(t);
      const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = c.measureText(t.textContent), m0 = c.measureText('0');
      const dial = document.getElementById('dial').getBoundingClientRect();
      const main = document.querySelector('main').getBoundingClientRect();
      const acts = document.querySelector('.actions').getBoundingClientRect();
      return { text: t.textContent, font: cs.fontSize, family: cs.fontFamily.split(',')[0], weight: cs.fontWeight,
        inkH: +(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent).toFixed(1), zeroInkH: +(m0.actualBoundingBoxAscent + m0.actualBoundingBoxDescent).toFixed(1),
        inkW: +(m.actualBoundingBoxLeft + m.actualBoundingBoxRight).toFixed(1),
        frame: { w: innerWidth, h: innerHeight }, dial: { w: Math.round(dial.width), h: Math.round(dial.height) },
        uncappedDial: Math.round(Math.min(0.82 * innerWidth, 0.52 * innerHeight)),
        freeBelowActions: Math.round(innerHeight - acts.bottom), freeAboveMain: Math.round(main.top), freeBesideDial: Math.round((innerWidth - dial.width) / 2) };
    });
    await d.page.screenshot({ path: path.join(OUT, `idle-mom-${device}.png`), animations: 'disabled' });
    await d.close();
  }
} finally { await L.close(); }
// 11-inch iPad (the rig's 820x1180 viewport): 264 ppi at 2x = 132 CSS px per inch
for (const k of Object.keys(out)) { const o = out[k]; const mm = o.zeroInkH * 25.4 / 132; o.digitMm = +mm.toFixed(1);
  o.distM = { 'd/200 (comfortable)': +(mm * 0.2).toFixed(2), 'd/120 (ADA-style 1in per 10ft)': +(mm * 0.12).toFixed(2), 'd/400 (1in per ~33ft)': +(mm * 0.4).toFixed(2), '5 arcmin 20/20 threshold': +(mm / 1000 / Math.tan(5 / 60 * Math.PI / 180)).toFixed(2) }; }
fs.writeFileSync(path.join(OUT, 'digit-size.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
