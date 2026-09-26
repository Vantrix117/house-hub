// s1 skeptic for VIS-TALLY-1: in Midnight and Forest (and System on a dark OS) measure, from the rendered pixels,
// (a) the disc fill of − and + against the wash beside them (the investigator's number), (b) the strongest pixel of the
// button's rim/ring/shadow band against the wash (does anything on the edge reach 3:1?), (c) the glyph against the disc,
// (d) the dial fill against the wash. Standalone apps/tally.html, iPad portrait, WebKit (no backdrop-filter blur painted).
// Run: node audits/tools/phase5/ux-verify/VIS-TALLY-1/s1-edges.mjs -> audits/evidence/p5/ux-verify/VIS-TALLY-1/s1/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/VIS-TALLY-1/s1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const CASES = [['midnight', 'light'], ['forest', 'light'], ['system', 'dark']];
const PROFILES = ['eli', 'dad', 'kiara', 'ezra'];
const rows = [];
try {
  for (const [theme, mode] of CASES) for (const profile of PROFILES) {
    const d = await L.device({ device: 'ipad-portrait', profile, mode, localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
    await d.page.goto(L.site + '/apps/tally.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    await sleep(400);
    const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    if (profile === 'eli' || profile === 'ezra') fs.writeFileSync(`${OUT}/${theme}-${mode}os-${profile}.png`, png);
    const m = await d.page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const Lu = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
      const cr = (a, b) => { const x = Lu(a), y = Lu(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const one = id => {
        const r = document.getElementById(id).getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2, R = r.width / 2;
        const wash = px(r.x - 30, cy);
        const fill = px(cx, r.y + r.height * 0.78), fillMid = px(cx - R * 0.55, cy);
        // ring band: sample along 16 radii from R-6 to R+10
        let best = 0, bestPx = null;
        for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; for (let t = -6; t <= 10; t++) { const p = px(cx + Math.cos(a) * (R + t), cy + Math.sin(a) * (R + t)); const v = cr(p, wash); if (v > best) { best = v; bestPx = p; } } }
        // glyph: brightest pixel in the central box vs the fill
        let gl = 0; for (let x = -18; x <= 18; x += 2) for (let y = -18; y <= 18; y += 2) { const v = cr(px(cx + x, cy + y), fillMid); if (v > gl) gl = v; }
        return { w: Math.round(r.width), wash, fill, fillVsWash: cr(fill, wash), fillMidVsWash: cr(fillMid, wash), edgeMaxVsWash: best, edgePx: bestPx, glyphVsFill: gl };
      };
      const dr = document.querySelector('.dial').getBoundingClientRect();
      const dialFill = px(dr.x + dr.width * 0.25, dr.y + dr.height * 0.5), dialWash = px(dr.x - 20, dr.y + dr.height / 2);
      return { scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme, minus: one('minus'), plus: one('plus'), dial: { fill: dialFill, wash: dialWash, vs: cr(dialFill, dialWash) } };
    }, png.toString('base64'));
    rows.push({ theme, os: mode, profile, ...m });
    console.log(theme, mode, profile, m.scheme, '− fill/wash', m.minus.fillVsWash, 'edge', m.minus.edgeMaxVsWash, 'glyph', m.minus.glyphVsFill, '| + fill/wash', m.plus.fillVsWash, 'edge', m.plus.edgeMaxVsWash, 'glyph', m.plus.glyphVsFill, '| dial', m.dial.vs);
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/edges.json`, JSON.stringify(rows, null, 1));
  await L.close();
}
