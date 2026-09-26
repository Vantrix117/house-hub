// UX-PRAYER-2 skeptic s1: kid cards, prayed vs not prayed. Reads the rendered button fill, label, icon and title colour
// for an undone and a done card (Ezra and Kiara, light and dark), taps an undone card twice, and computes the
// luminance ratio between the two fills plus the colour difference (CIE76 dE) under normal vision and simulated
// protanopia / deuteranopia (Machado 2009, severity 1).
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-2/s1-kid-states.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-PRAYER-2/s1';
fs.mkdirSync(OUT, { recursive: true });
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = rgb => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = L(a), y = L(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const M = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]] };
const sim = (rgb, m) => { const l = rgb.map(lin); const o = m.map(r => r[0] * l[0] + r[1] * l[1] + r[2] * l[2]).map(v => Math.min(1, Math.max(0, v)));
  return o.map(v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
const lab = rgb => { const [r, g, b] = rgb.map(lin); let X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116); [X, Y, Z] = [f(X), f(Y), f(Z)]; return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return +Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]).toFixed(1); };
const parse = s => { let m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (m) return m.slice(1, 4).map(Number);
  m = s.match(/rgba?\((\d+), (\d+), (\d+)/); return m.slice(1, 4).map(v => v / 255); };
const L0 = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
const read = f => f.evaluate(() => [...document.querySelectorAll('.kid')].map(k => { const b = k.querySelector('.prayed'); const cs = getComputedStyle(b);
  return { title: k.querySelector('.kt').textContent, done: k.classList.contains('done'), label: b.textContent.trim(), icon: !!b.querySelector('svg'), pressed: b.getAttribute('aria-pressed'),
    bg: cs.backgroundColor, titleColor: getComputedStyle(k.querySelector('.kt')).color, whoFaces: k.querySelectorAll('.kwho .avatar, .kwho .init').length }; }));
try {
  for (const profile of ['ezra', 'kiara']) for (const mode of ['light', 'dark']) {
    const d = await L0.device({ device: 'ipad-portrait', profile, mode });
    const f = await d.openApp('prayer', { wait: '.kid' });
    await f.waitForSelector('.kid .prayed'); await sleep(800);
    const cards = await read(f);
    const u = cards.find(c => !c.done), dn = cards.find(c => c.done);
    const row = { profile, mode, cards: cards.length, undone: u, done: dn };
    if (u && dn) {
      const a = parse(u.bg), b = parse(dn.bg);
      row.fillLuminanceRatio = ratio(a, b);
      row.dE = { normal: dE(a, b), protan: dE(sim(a, M.protan), sim(b, M.protan)), deutan: dE(sim(a, M.deutan), sim(b, M.deutan)) };
    }
    if (mode === 'light' && u) {
      // tap an undone card twice: does the second tap undo, and what changes?
      const t = u.title;
      const idx = cards.findIndex(c => c.title === t);
      await f.locator('.kid .prayed').nth(idx).click(); await sleep(500);
      const after1 = (await read(f)).find(c => c.title === t);
      await f.locator('.kid .prayed').nth((await read(f)).findIndex(c => c.title === t)).click(); await sleep(500);
      const after2 = (await read(f)).find(c => c.title === t);
      row.tap = { before: u, after1, after2 };
      await d.shot(`${OUT}/${profile}-${mode}-after-tap.png`);
    } else await d.shot(`${OUT}/${profile}-${mode}.png`);
    rows.push(row); console.log(JSON.stringify(row));
    await d.close();
  }
} catch (e) { console.error(e); rows.push({ error: String(e.stack || e) }); }
finally { fs.writeFileSync(`${OUT}/kid-states.json`, JSON.stringify(rows, null, 1)); await L0.close(); }
