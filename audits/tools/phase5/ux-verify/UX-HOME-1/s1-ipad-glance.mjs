// UX-HOME-1, skeptic s1: independent re-measure of the adult iPad Home's key text sizes.
// Method differs from phase2 glance.mjs on purpose: it takes the computed font-size of each element and converts it to a
// cap height with SF Pro's published cap ratio (0.705 em) instead of canvas-measuring the rig's fallback font, then to mm
// at 0.1924 mm per CSS px (iPad Air 11", 264 ppi, 2x). Local rig only (production blocked by lib/local.mjs).
//   node "audits/tools/phase5/ux-verify/UX-HOME-1/s1-ipad-glance.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const MM = 0.1924, CAP = 0.705;
const SPECS = [
  ['date kicker', '#view-home .home-hero .hero-kicker'],
  ['greeting', '#view-home .home-hero .hero-title'],
  ['hero summary', '#view-home .home-hero .hero-sub'],
  ['F260 ring label', '#view-home .ringwrap.lg .ring-lbl'],
  ['card big lines (.gbig)', '#view-home .gcard .gbig'],
  ['fridge item rows', '#view-home .fresh .fl span'],
  ['kids chip', '#view-home .kid-chip'],
  ['reminder text', '#remlist .rem-text'],
  ['feed text', '#feed .ftxt'],
  ['timer pill time', '#timer-pill .tp-time'],
];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { method: 'computed font-size x 0.705 (SF Pro cap ratio) x 0.1924 mm/px', thresholds: { '5 arcmin (20/20 limit) @2m': 2.9, '10 arcmin (20/40) @2m': 5.8, '10 arcmin @3m': 8.7 }, runs: {} };
try {
  for (const [device, profile] of [['ipad-portrait', 'eli'], ['ipad-landscape', 'eli'], ['ipad-landscape', 'mom']]) {
    const d = await L.device({ device, profile });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 15000 }).catch(() => {});
    await sleep(800);
    const rows = await d.page.evaluate(specs => specs.map(([name, sel]) => {
      const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().height > 0);
      if (!els.length) return { name, missing: true };
      const px = els.map(e => parseFloat(getComputedStyle(e).fontSize));
      const e0 = els[px.indexOf(Math.min(...px))];
      return { name, n: els.length, minPx: Math.min(...px), maxPx: Math.max(...px), sample: (e0.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), top: Math.round(e0.getBoundingClientRect().top), fold: innerHeight };
    }), SPECS);
    for (const r of rows) if (!r.missing) { r.capMmMin = +(r.minPx * CAP * MM).toFixed(2); r.capMmMax = +(r.maxPx * CAP * MM).toFixed(2); r.arcminAt2m = +((r.capMmMax / 2000) * (180 / Math.PI) * 60).toFixed(1); }
    const scale = await d.page.evaluate(() => ({ kind: document.documentElement.dataset.kind || null, fsMd: getComputedStyle(document.documentElement).getPropertyValue('--fs-md').trim(), fsXl: getComputedStyle(document.documentElement).getPropertyValue('--fs-xl').trim(), fsXs: getComputedStyle(document.documentElement).getPropertyValue('--fs-xs').trim() }));
    out.runs[`${device}:${profile}`] = { scale, rows };
    await d.page.screenshot({ path: path.join(OUT, `s1-${device}-${profile}.png`), animations: 'disabled', caret: 'hide' });
    console.log(`\n== ${device} ${profile}`, JSON.stringify(scale)); console.table(rows);
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 's1-ipad-glance.json'), JSON.stringify(out, null, 1));
  await L.close();
}
