// Skeptic s2, UX-HOME-2: independently measure every visible text run on the kiosk TV board at 1920x1080 and grade it
// at 3 m for 43/55/65" panels (mm per CSS px = panel width in mm / 1920). Also records the board's height and last content edge.
//   node "audits/tools/phase5/ux-verify/UX-HOME-2/s2-tv-sizes.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-2/s2');
fs.mkdirSync(OUT, { recursive: true });
const panelMm = inch => inch * 25.4 * 16 / Math.hypot(16, 9);
const MM = { 43: panelMm(43) / 1920, 55: panelMm(55) / 1920, 65: panelMm(65) / 1920 };
const H2at3 = 3000 / 344, H1at3 = 3000 / 200, acuity2020at3 = 3000 * Math.tan((5 / 60) * Math.PI / 180);
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
let out;
try {
  const d = await L.device({ device: 'tv', profile: 'tv' });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#tv-feed li'), null, { timeout: 15000 }).catch(() => {});
  await sleep(2000);
  const m = await d.page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const runs = [];
    const w = document.createTreeWalker(document.querySelector('#tv'), NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (el.closest('[hidden]')) continue; const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const pane = el.closest('.tv-pane'); const paneCls = pane ? [...pane.classList].find(x => x.startsWith('tv-') && x !== 'tv-pane') : '';
      runs.push({ pane: paneCls, cls: String(el.className || el.tagName).slice(0, 30), text: t.slice(0, 40), fontPx: parseFloat(cs.fontSize), capPx: +c.measureText('H').actualBoundingBoxAscent.toFixed(1), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    }
    const last = Math.max(...[...document.querySelectorAll('#tv .tv-pane')].filter(p => !p.hidden).map(p => p.getBoundingClientRect().bottom));
    return { vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight, lastPaneBottom: Math.round(last), remRows: document.querySelectorAll('#tv-rem-card .rem-row').length, feedRows: document.querySelectorAll('#tv-feed li').length, runs };
  });
  for (const r of m.runs) { for (const s of [43, 55, 65]) { const mm = r.capPx * MM[s]; r['mm' + s] = +mm.toFixed(1); r['g' + s] = mm >= H1at3 ? 'H1' : mm >= H2at3 ? 'H2' : mm >= acuity2020at3 ? '20/20 only' : 'below 20/20'; } }
  const fails55 = m.runs.filter(r => r.mm55 < H2at3);
  out = { mmPerPx: MM, thresholdsMm: { H2at3, H1at3, acuity2020at3 }, ...m, fails55 };
  console.log(`viewport ${m.vw}x${m.vh}, scrollH ${m.scrollH}, last pane bottom ${m.lastPaneBottom}, reminders ${m.remRows}, feed rows ${m.feedRows}`);
  console.log('thresholds @3m: H2', H2at3.toFixed(2), 'H1', H1at3.toFixed(1), '20/20', acuity2020at3.toFixed(2));
  const seen = new Set();
  for (const r of m.runs) { const k = r.pane + r.cls + r.fontPx; if (seen.has(k)) continue; seen.add(k); console.log(`  ${r.pane.padEnd(9)} ${r.cls.padEnd(22)} "${r.text.slice(0, 22)}" ${r.fontPx}px cap ${r.capPx}px  43":${r.mm43}(${r.g43}) 55":${r.mm55}(${r.g55}) 65":${r.mm65}(${r.g65})`); }
  await d.page.screenshot({ path: path.join(OUT, 's2-tv-board.png'), animations: 'disabled', caret: 'hide' });
  await d.close();
} finally {
  if (out) fs.writeFileSync(path.join(OUT, 's2-tv-sizes.json'), JSON.stringify(out, null, 1));
  await L.close();
}
