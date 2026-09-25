// Skeptic #2: re-measure the build guide's SVG map labels (seclab, onum, clab, mlbl) at the default view and after
// zooming in (+ button x N, and a section chip), plus the profile axis labels. eff = computed font-size x sqrt|det CTM|.
// Local instance only. -> audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-2.json (+ .png crops)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-2');
function measure() {
  const vw = innerWidth, vh = innerHeight, res = {};
  const k = window.MK;
  for (const t of document.querySelectorAll('svg text')) {
    const r = t.getBoundingClientRect(); if (!(r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw)) continue;
    let hidden = false; for (let e = t; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } }
    if (hidden || !(t.textContent || '').trim()) continue;
    const m = t.getScreenCTM(); if (!m) continue;
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); const fs = parseFloat(getComputedStyle(t).fontSize);
    const cls = (t.getAttribute('class') || (t.closest('#prof,svg.prof,.profwrap') ? 'profile' : t.parentElement?.id || 'other'));
    const key = cls + (t.closest('.profwrap') ? '@profile' : '');
    const e = +(fs * sc).toFixed(2);
    (res[key] ||= { n: 0, fs, min: e, max: e, glyphH: +r.height.toFixed(1), sample: t.textContent.trim().slice(0, 20) });
    const o = res[key]; o.n++; o.min = Math.min(o.min, e); o.max = Math.max(o.max, e);
  }
  const svg = document.querySelector('#map svg, svg#map, #mapstage svg') || document.querySelector('svg');
  return { mk: k, svgW: svg && svg.clientWidth, labels: res, seclabToggle: document.getElementById('l-seclab')?.checked };
}
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = { note: 'eff px = computed font-size x screen scale of the text CTM; MK = metres per CSS px (template.html:788)', runs: [] };
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device, mode: 'light', profile: 'eli' });
    const f = await d.openApp('dollywood'); await sleep(2500);
    const rec = { device, steps: [] };
    rec.steps.push({ step: 'default', ...(await f.evaluate(measure)) });
    // screenshots dropped: rig DPR >1 exceeds the evidence size rule; the JSON carries the measurement
    for (let i = 1; i <= 4; i++) {
      await f.evaluate(() => document.getElementById('z-in')?.click()); await sleep(900);
      rec.steps.push({ step: 'zoom-in x' + i, ...(await f.evaluate(measure)) });
    }

    // tap the first section chip (zoom to a section)
    const chip = await f.evaluate(() => { const b = document.querySelector('.chips button:nth-child(2)'); if (b) { b.click(); return b.textContent.trim(); } return null; }); await sleep(1400);
    rec.steps.push({ step: 'section chip: ' + chip, ...(await f.evaluate(measure)) });
    out.runs.push(rec);
    for (const s of rec.steps) console.log(device.padEnd(14), s.step.padEnd(28), 'MK', s.mk && s.mk.toFixed(3), Object.entries(s.labels).map(([k, v]) => `${k}:${v.min}-${v.max}(n${v.n})`).join(' '));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(OUT + '.json', JSON.stringify(out, null, 1));
console.log('->', OUT + '.json');
