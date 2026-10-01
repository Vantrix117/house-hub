// rev4-visual round 2: Me → Add a guest's face grid at 390 (and 320) per text size, on any tree: node probe-guest.mjs <root> <tag>
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT = process.argv[2], TAG = process.argv[3] || 'x';
const { local, sleep } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe2/';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [w, size] of [[390, 'm'], [390, 'xl'], [390, 'xxl'], [320, 'xl']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', localStorage: { 'hub.prefs': JSON.stringify({ textSize: size }) } });
    await d.page.setViewportSize({ width: w, height: 844 });
    await d.goto('#me'); await sleep(1500);
    await d.page.evaluate(s => window.hub && hub.setTextSize && hub.setTextSize(s === 'm' ? null : s), size).catch(() => {}); await sleep(600);
    await d.page.evaluate(() => { const b = document.getElementById('guest-add'); b && b.click(); }); await sleep(900);
    const m = await d.page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && /\p{Extended_Pictographic}/u.test(b.textContent) && b.textContent.trim().length <= 4);
      const grid = btns[0] && btns[0].parentElement, gr = grid && grid.getBoundingClientRect();
      const sheet = grid && grid.closest('.sheet, [role=dialog], dialog, .modal') ; const sr = sheet && sheet.getBoundingClientRect();
      const cs = grid && getComputedStyle(grid);
      return { ts: document.documentElement.dataset.textSize || '', vw: innerWidth, grid: grid && { cls: grid.className, w: Math.round(gr.width), sw: grid.scrollWidth, cw: grid.clientWidth, cols: cs.gridTemplateColumns, display: cs.display, overflowX: cs.overflowX },
        btn: btns[0] && [Math.round(btns[0].getBoundingClientRect().width), Math.round(btns[0].getBoundingClientRect().height)], n: btns.length,
        rightmost: Math.round(Math.max(...btns.map(b => b.getBoundingClientRect().right))), sheetRight: sr && Math.round(sr.right), clippedButtons: btns.filter(b => b.getBoundingClientRect().right > (sr ? sr.right : innerWidth) + 1).length };
    });
    console.log(TAG, w, size, JSON.stringify(m));
    await d.page.screenshot({ path: OUT + `guest-${TAG}-${w}-${size}.png`, scale: 'css' });
    await d.close();
  }
} finally { await L.close(); }
