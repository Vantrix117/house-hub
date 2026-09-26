// s1 (skeptic) for VIS-DOLLYWOOD-LIVE-1: measure family marker/label overlaps on the park map, with the household's real
// (short) names (variant typical->park) and with the overflow seed's long names, on iPad portrait and iPhone PWA, at the
// default zoom and after zooming in 1.4x three times about Mom (zoomAt, the "+" key's own call). Also: can each person's marker be hit at its centre?
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-LIVE-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const results = [];

async function measure(f) {
  return f.evaluate(() => {
    const gs = [...document.querySelectorAll('#fam g.famk')].filter(g => !g.classList.contains('lv-edge'));
    const items = gs.map(g => {
      const pick = g.dataset.pick;
      const c = g.querySelector('circle').getBoundingClientRect();
      const r = g.querySelector('rect'); const rr = r ? r.getBoundingClientRect() : null;
      const lab = g.querySelector('text.famlab');
      return { pick, name: lab ? lab.textContent : '', marker: [c.x, c.y, c.width, c.height].map(Math.round), label: rr ? [rr.x, rr.y, rr.width, rr.height].map(Math.round) : null, g };
    });
    const ov = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const out = items.map((it, i) => {
      // later siblings paint on top: fraction of this label covered by any later marker or label
      let cov = 0;
      const later = items.slice(i + 1);
      const W = innerWidth, H = innerHeight;
      // sample the label at a grid of points and ask what is on top
      let hidden = 0, total = 0, off = 0;
      if (it.label) {
        const [x, y, w, h] = it.label;
        for (let sx = 0; sx < 12; sx++) for (let sy = 0; sy < 3; sy++) {
          const px = x + (sx + 0.5) * w / 12, py = y + (sy + 0.5) * h / 3; total++;
          if (px < 0 || py < 0 || px > W || py > H) { off++; continue; }
          const e = document.elementFromPoint(px, py); const top = e && e.closest('g.famk');
          if (top && top !== it.g) hidden++;
        }
      }
      const cx = it.marker[0] + it.marker[2] / 2, cy = it.marker[1] + it.marker[3] / 2;
      const e = document.elementFromPoint(cx, cy); const topAtCentre = e && e.closest('g.famk');
      return { pick: it.pick, name: it.name, marker: it.marker, label: it.label, labelHiddenPct: total ? Math.round(100 * hidden / total) : null, labelOffscreenPct: total ? Math.round(100 * off / total) : null,
        markerCentreHitsSelf: topAtCentre === it.g, markerCentreHits: topAtCentre ? topAtCentre.dataset.pick : (e ? e.tagName : null) };
    });
    const k = typeof mpp === 'function' ? mpp() : null;
    const edges = [...document.querySelectorAll('#fam g.lv-edge')].map(g => g.querySelector('text.lab')?.textContent);
    return { mpp: k, viewport: [innerWidth, innerHeight], people: out, edges };
  });
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const variant of ['park', 'overflow']) {
    await L.reset(variant);
    for (const device of ['ipad-portrait', 'iphone-pwa']) {
      const d = await L.device({ device, profile: 'eli' });
      const f = await d.openApp('dollywood-live');
      await f.waitForSelector('#lv-pill[data-state]', { timeout: 12000 });
      await f.waitForFunction(() => document.querySelectorAll('#fam .famk').length > 0, null, { timeout: 8000, polling: 100 }).catch(() => {});
      await sleep(800);
      const base = await measure(f);
      await d.shot(path.join(OUT, `${variant}-${device}-default.png`));
      const zoomed = [];
      for (let z = 1; z <= 3; z++) {
        await f.evaluate(() => { const m = FAM.mom || FAM.ezra; const x = m.x, y = Y(m.y); zoomAt(1/1.4, x, y); if (typeof drawMe === 'function') drawMe(); }); await sleep(700);
        const m = await measure(f); zoomed.push({ plus: z, ...m });
        if (z === 2) await d.shot(path.join(OUT, `${variant}-${device}-plus2.png`));
      }
      results.push({ variant, device, default: base, zoomed });
      await d.close();
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'label-overlap.json'), JSON.stringify(results, null, 1));
for (const r of results) {
  console.log(`\n== ${r.variant} ${r.device} (mpp ${r.default.mpp?.toFixed(3)})`);
  for (const p of r.default.people) console.log(`  ${p.name.padEnd(28)} labelHidden ${p.labelHiddenPct}% off ${p.labelOffscreenPct}% markerHitsSelf ${p.markerCentreHitsSelf} (${p.markerCentreHits})`);
  console.log('  edges:', r.default.edges);
  for (const z of r.zoomed) console.log(`  +${z.plus} mpp ${z.mpp?.toFixed(3)}: ` + z.people.map(p => `${p.name.split(' ')[0]} ${p.labelHiddenPct}%/${p.markerCentreHitsSelf ? 'hit' : 'MISS'}`).join(', '));
}
