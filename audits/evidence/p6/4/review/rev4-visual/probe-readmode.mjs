// rev4-visual round 4: F260 reading mode at 1024/1180/1440, light+dark, typical and overflow: does the side column cover the week header?
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe4/';
for (const variant of ['typical', 'overflow']) {
  const L = await local({ variant, clock: 'demo', engine: 'webkit' });
  try {
    for (const [w, h] of [[1024, 768], [1180, 820], [1440, 900]]) for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: w >= 1440 ? 'desktop' : 'ipad-landscape', mode, profile: 'eli' });
      await d.page.setViewportSize({ width: w, height: h });
      const f = await d.openApp('f260'); await f.waitForFunction(() => document.getElementById('todayTitle') && document.getElementById('todayTitle').textContent.trim(), null, { timeout: 20000 }); await sleep(600);
      await f.evaluate(() => { if (!document.querySelector('.planview.readmode')) document.getElementById('readBtn').click(); }); await sleep(900);
      const m = async () => f.evaluate(() => {
        const r = e => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
        const head = document.querySelector('.week.current .wk-head') || document.querySelector('.readmode .wk-head'), side = document.querySelector('.planview .side'), refl = document.getElementById('reflect'), bar = document.querySelector('.readbar');
        const hb = head && head.getBoundingClientRect(), sb = side && side.getBoundingClientRect();
        const overlap = hb && sb && !(sb.right <= hb.left || sb.left >= hb.right || sb.bottom <= hb.top || sb.top >= hb.bottom);
        const cs = side && getComputedStyle(side);
        return { side: r(side), sidePos: cs && cs.position, reflect: r(refl), head: r(head), readbar: r(bar), overlap: !!overlap, hs: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      const a = await m();
      await f.evaluate(() => window.scrollBy(0, 400)); await sleep(300);
      const b = await m();
      console.log(variant, w, mode, 'top', JSON.stringify(a), '| +400', JSON.stringify({ overlap: b.overlap, side: b.side, head: b.head, readbar: b.readbar }));
      await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
      await d.page.screenshot({ path: OUT + `readmode-${variant}-${w}-${mode}.png`, scale: 'css' });
      await f.evaluate(() => window.scrollBy(0, 400)); await sleep(300);
      await d.page.screenshot({ path: OUT + `readmode-${variant}-${w}-${mode}-scrolled.png`, scale: 'css' });
      await d.close();
    }
  } finally { await L.close(); }
}
