// Skeptic s2, UX-HOME-1: independently measure every visible text run on the adult iPad Home (portrait + landscape)
// and on the kid Home, and find the largest cap heights. mm per CSS px on an iPad Air 11": 25.4/132 = 0.1924.
//   node "audits/tools/phase5/ux-verify/UX-HOME-1/s2-ipad-home-sizes.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const MM = 25.4 / 132;
const H2 = { 2: 2000 / 344, 3: 3000 / 344 }, H1 = { 2: 2000 / 200, 3: 3000 / 200 };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  for (const [label, device, profile] of [['adult-portrait', 'ipad-portrait', 'eli'], ['adult-landscape', 'ipad-landscape', 'eli'], ['kid-portrait', 'ipad-portrait', 'ezra']]) {
    const d = await L.device({ device, profile });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 }).catch(() => {});
    await sleep(1500);
    const runs = await d.page.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d');
      const out = [];
      const walker = document.createTreeWalker(document.querySelector('#view-home'), NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
        const el = n.parentElement; const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const cap = c.measureText('H').actualBoundingBoxAscent;
        out.push({ text: t.slice(0, 50), cls: el.className && String(el.className).slice(0, 40), tag: el.tagName, fontPx: parseFloat(cs.fontSize), capPx: +cap.toFixed(1), top: Math.round(r.top + scrollY), inFold: r.top < innerHeight });
      }
      return { vw: innerWidth, vh: innerHeight, runs: out };
    });
    const tp = await d.page.evaluate(() => ({ kind: document.documentElement.dataset.kind, fsXl: getComputedStyle(document.documentElement).getPropertyValue('--fs-xl').trim(), fsXs: getComputedStyle(document.documentElement).getPropertyValue('--fs-xs').trim() }));
    for (const r of runs.runs) { r.capMm = +(r.capPx * MM).toFixed(2); r.h2at2m = r.capMm >= H2[2]; r.h1at2m = r.capMm >= H1[2]; r.h2at3m = r.capMm >= H2[3]; }
    const sorted = [...runs.runs].sort((a, b) => b.capMm - a.capMm);
    res[label] = { viewport: { vw: runs.vw, vh: runs.vh }, tokens: tp, count: runs.runs.length, top10: sorted.slice(0, 10), passH2at2m: runs.runs.filter(r => r.h2at2m).map(r => r.text), passH1at2m: runs.runs.filter(r => r.h1at2m).map(r => r.text), passH2at3m: runs.runs.filter(r => r.h2at3m).map(r => r.text), fontHistogram: runs.runs.reduce((h, r) => (h[r.fontPx] = (h[r.fontPx] || 0) + 1, h), {}) };
    console.log(`\n[${label}] ${runs.runs.length} text runs; tokens ${JSON.stringify(tp)}; font px histogram ${JSON.stringify(res[label].fontHistogram)}`);
    console.log('  largest:', sorted.slice(0, 8).map(r => `"${r.text.slice(0, 24)}" ${r.fontPx}px cap ${r.capMm}mm`).join(' | '));
    console.log('  H2@2m:', res[label].passH2at2m, ' H1@2m:', res[label].passH1at2m, ' H2@3m:', res[label].passH2at3m);
    await d.page.screenshot({ path: path.join(OUT, `s2-home-${label}.png`), animations: 'disabled', caret: 'hide' });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 's2-ipad-home-sizes.json'), JSON.stringify({ mmPerPx: MM, thresholdsMm: { H2, H1 }, res }, null, 1));
  await L.close();
}
