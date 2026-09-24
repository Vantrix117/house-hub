// Skeptic #2 for "arrow keys never scroll the page" (Dollywood build guide).
//   node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2.mjs" [webkit|chromium]
// Desktop 1440x900, Eli, guide in the shell viewer. Scroll the build card into view, focus (a) plain card text,
// (b) a button in the card, press ArrowDown x5, read scrollY, the map view and whether the event was defaultPrevented
// (a window bubble listener, which runs after the app's document listener). Controls: PageDown and Space.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'webkit';
const EV = path.resolve('audits/evidence/p3/dollywood');
const L = await local({ variant: 'typical', engine });
const out = { engine };
try {
  const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 }); await sleep(800);
  await f.evaluate(() => { window.__kd = []; window.addEventListener('keydown', e => window.__kd.push({ key: e.key, prevented: e.defaultPrevented, target: e.target.tagName + (e.target.id ? '#' + e.target.id : '') })); });
  const st = () => f.evaluate(() => { const m = document.getElementById('map').getBoundingClientRect(), c = document.getElementById('b-now').getBoundingClientRect();
    return { scrollY: Math.round(scrollY), viewY: Math.round(view[1]), mapTop: Math.round(m.top), mapBottom: Math.round(m.bottom), cardTop: Math.round(c.top), vh: innerHeight, frameW: innerWidth, active: document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '') }; });
  const center = async () => { await f.evaluate(() => document.getElementById('b-now').scrollIntoView({ block: 'center' })); await sleep(400); };
  const press = async (k, n) => { for (let i = 0; i < n; i++) { await d.page.keyboard.press(k); await sleep(150); } await sleep(300); };
  // A: plain text in the card
  await center();
  const h = await f.$('#b-now h3'); const b = await h.boundingBox(); await d.page.mouse.click(b.x + 4, b.y + b.height / 2);
  const a0 = await st(); await press('ArrowDown', 5); const a1 = await st();
  out.textFocus = { before: a0, afterArrowDown5: a1 };
  // B: a button inside the card focused
  await center();
  const btnSel = await f.evaluate(() => { const btn = document.querySelector('#b-now button, .build button'); if (!btn) return null; btn.focus(); return btn.id || btn.textContent.trim().slice(0, 30); });
  const b0 = await st(); await press('ArrowDown', 5); const b1 = await st();
  out.buttonFocus = { button: btnSel, before: b0, afterArrowDown5: b1 };
  // Controls: PageDown and Space from plain text
  await center(); await d.page.mouse.click(b.x + 4, b.y + b.height / 2);
  const c0 = await st(); await press('PageDown', 1); const c1 = await st();
  out.pageDownControl = { before: c0, after: c1 };
  out.keydownLog = await f.evaluate(() => window.__kd.slice(0, 20));
  console.log(JSON.stringify(out, null, 1));
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, `verify-critic-critic-arrow-keys-block-page-scroll-3-2-${engine}.json`), JSON.stringify(out, null, 1));
  await L.close();
}
