// VIS palette: the shell's actual colour tokens per theme (resolved by the browser), their contrast pairs, how vibrant
// they are next to the house-style pastels (OKLCH chroma), and whether the family's profile colours stay apart without
// hue (deuteranopia/protanopia simulation, OKLab distance). Also checks the "Hearth chosen on a dark OS" path at runtime.
//   node "audits/tools/phase2/VIS/palette.mjs"      → audits/evidence/p2/VIS/palette.json
import { local, sleep } from '../../lib/local.mjs';
import { save } from './lib-vis.mjs';

const HOUSE = { Bubblegum: ['#FFC8DD', '#A3134F'], Peach: ['#FFD6B8', '#9A3F0A'], Butter: ['#FFF1A8', '#735A00'], Mint: ['#B9F2D0', '#0E6B3B'], Aqua: ['#B5EEF0', '#0B6468'], Sky: ['#BFDDFF', '#1A4F9C'], Periwinkle: ['#CCD3FF', '#3440A8'], Lavender: ['#E0CCFF', '#5E2BAE'] };
// ── colour maths (Node) ──
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const oklab = c => { const [r, g, b] = c.map(lin); const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
const chroma = c => { const [, a, b] = oklab(c); return +Math.hypot(a, b).toFixed(3); };
const dE = (p, q) => { const a = oklab(p), b = oklab(q); return +(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100).toFixed(1); };
// Machado et al. 2009, severity 1.0, applied in linear RGB
const CVD = { deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]], protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] };
const unlin = v => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
const sim = (c, m) => { const l = c.map(lin); return m.map(row => unlin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])); };

const L = await local({ variant: 'typical' });
const out = { house: {}, themes: {}, family: {}, hearthOnDarkOS: null };
try {
  for (const [n, [f, i]] of Object.entries(HOUSE)) out.house[n] = { fill: f, ink: i, contrast: ratio(hex(f), hex(i)), fillChroma: chroma(hex(f)) };
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
  await d.goto('#home'); await d.page.waitForSelector('#view-home .home-hero'); await sleep(800);
  const profiles = await d.page.evaluate(() => hub.people().map(p => ({ id: p.id, name: p.name, color: p.color, kind: p.kind })));
  const THEMES = ['hearth', 'parchment', 'frost', 'midnight', 'forest'];
  for (const th of THEMES) {
    const t = await d.page.evaluate(async ([th, fam]) => {
      const root = document.documentElement;
      if (th === 'hearth') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', th);
      const probe = document.createElement('div'); probe.className = 'ds'; document.body.appendChild(probe);
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const col = v => { probe.style.color = ''; probe.style.color = v; const s = getComputedStyle(probe).color; cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = s; cv.fillRect(0, 0, 1, 1); const x = cv.getImageData(0, 0, 1, 1).data; return [x[0], x[1], x[2]]; };
      const names = ['--bg', '--surface', '--surface-2', '--text', '--text-2', '--muted', '--muted-decor', '--line', '--on-accent', '--glass-strong'];
      for (const h of ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate']) names.push('--' + h, '--' + h + '-soft', '--' + h + '-ink');
      const tok = {}; for (const n of names) tok[n] = col(`var(${n})`);
      const acc = {};
      for (const p of fam) { root.style.setProperty('--accent', p.color); acc[p.id] = { accent: col('var(--accent)'), deep: col('var(--accent-deep)'), soft: col('var(--accent-soft)'), tint: col('var(--accent-tint)'), on: col('var(--on-accent)'), bg: col('var(--bg)'), surface: col('var(--surface)'),
        heroTop: col('color-mix(in srgb, var(--accent) 70%, white)') }; }
      root.style.setProperty('--accent', fam[0].color);
      probe.remove(); return { tok, acc, scheme: root.dataset.scheme };
    }, [th, profiles]);
    const T = t.tok; const pairs = {};
    pairs['text/bg'] = ratio(T['--text'], T['--bg']); pairs['text-2/bg'] = ratio(T['--text-2'], T['--bg']); pairs['muted/bg'] = ratio(T['--muted'], T['--bg']);
    pairs['muted/surface'] = ratio(T['--muted'], T['--surface']); pairs['muted/surface-2'] = ratio(T['--muted'], T['--surface-2']);
    pairs['placeholder muted-decor/surface'] = ratio(T['--muted-decor'], T['--surface']);
    pairs['card surface vs bg (separation)'] = ratio(T['--surface'], T['--bg']); pairs['skeleton surface-2 vs bg'] = ratio(T['--surface-2'], T['--bg']); pairs['skeleton surface-2 vs surface'] = ratio(T['--surface-2'], T['--surface']);
    for (const h of ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate']) pairs[`chip ${h}-ink/${h}-soft`] = ratio(T[`--${h}-ink`], T[`--${h}-soft`]);
    pairs['badge #fff/terra(danger)'] = ratio([255, 255, 255], T['--terra']);
    const fam = {};
    for (const p of profiles) { const a = t.acc[p.id]; fam[p.name] = { color: p.color, 'btn-primary on-accent/accent-deep': ratio(a.on, a.deep), 'btn-soft/tab.on accent-deep/accent-soft': ratio(a.deep, a.soft), 'accent-deep/bg': ratio(a.deep, a.bg),
      'hero text/hero light end': ratio(t.scheme === 'dark' || th === 'midnight' || th === 'forest' ? T['--text'] : a.on, a.heroTop), 'ring accent/surface (graphic 3:1)': ratio(a.accent, a.surface) }; }
    const chromaOf = {}; for (const h of ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate']) chromaOf[h] = { base: chroma(T['--' + h]), soft: chroma(T['--' + h + '-soft']), ink: chroma(T['--' + h + '-ink']) };
    out.themes[th] = { tokens: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, '#' + v.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()])), pairs, family: fam, chroma: chromaOf };
    console.log(`\n== ${th}`); console.table(pairs); console.table(fam); console.log('chroma', JSON.stringify(chromaOf));
  }
  // family colours apart without hue
  const hh = profiles.filter(p => !/^guest/.test(p.id) || true);
  const rows = [];
  for (let i = 0; i < hh.length; i++) for (let j = i + 1; j < hh.length; j++) { const a = hex(hh[i].color), b = hex(hh[j].color);
    rows.push({ pair: hh[i].name + ' / ' + hh[j].name, normal: dE(a, b), deuteranopia: dE(sim(a, CVD.deuteranopia), sim(b, CVD.deuteranopia)), protanopia: dE(sim(a, CVD.protanopia), sim(b, CVD.protanopia)) }); }
  rows.sort((p, q) => p.deuteranopia - q.deuteranopia);
  out.family = { profiles, closestPairs: rows.slice(0, 8), pastelChromaHouse: Object.fromEntries(Object.entries(HOUSE).map(([n, [f]]) => [n, chroma(hex(f))])), profileColourChroma: Object.fromEntries(profiles.map(p => [p.name, chroma(hex(p.color))])) };
  console.log('\n== closest profile-colour pairs (OKLab ΔE×100; < 10 is hard to tell apart at a glance)'); console.table(rows.slice(0, 8));
  console.log('house pastel chroma', JSON.stringify(out.family.pastelChromaHouse)); console.log('profile colour chroma', JSON.stringify(out.family.profileColourChroma));
  await d.close();
  // "Hearth" chosen explicitly on a dark OS
  const d2 = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'mom' });
  await d2.goto('#home'); await d2.page.waitForSelector('#view-home .home-hero'); await sleep(800);
  await d2.page.evaluate(() => hub.setTheme('hearth')); await sleep(500);
  out.hearthOnDarkOS = await d2.page.evaluate(() => ({ dataTheme: document.documentElement.getAttribute('data-theme'), dataScheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color, stored: localStorage.getItem('hub.theme') }));
  const fs = await import('node:fs'); await d2.page.screenshot({ path: 'audits/evidence/p2/VIS/hearth-on-dark-os-ipad.png', scale: 'css' });
  console.log('\n== Hearth chosen on a dark OS (Elizabeth, iPad):', JSON.stringify(out.hearthOnDarkOS), '→ audits/evidence/p2/VIS/hearth-on-dark-os-ipad.png');
  await d2.close();
} finally { await L.close(); }
console.log('\nwrote', save('palette.json', out));
