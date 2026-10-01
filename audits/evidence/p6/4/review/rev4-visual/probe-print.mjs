// rev4-visual: computed print styles of a ticked / unticked reading box and memory box, WebKit + Chromium; a PDF from Chromium
import { local, sleep, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe/';
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: 'desktop', mode, profile: 'eli' });
      const f = await d.openApp('f260'); await ready(f);
      await d.page.emulateMedia({ media: 'print' }); await sleep(400);
      const s = await f.evaluate(() => {
        const st = e => { if (!e) return null; const c = getComputedStyle(e), sv = e.querySelector('svg'), cs = sv && getComputedStyle(sv); return { bg: c.backgroundColor, border: c.borderTopColor + ' ' + c.borderTopWidth, color: c.color, adjust: c.webkitPrintColorAdjust || c.printColorAdjust, svgOpacity: cs && cs.opacity, svgStroke: cs && cs.stroke }; };
        return { doneMark: st(document.querySelector('.day.done .mark')), openMark: st(document.querySelector('.day:not(.done) .mark')), memd: st(document.querySelector('.mv.memd .mkm')), mem: st(document.querySelector('.mv:not(.memd) .mkm')), doneRef: getComputedStyle(document.querySelector('.day.done .refs a')).color, openRef: getComputedStyle(document.querySelector('.day:not(.done) .refs a')).color, memWrap: (() => { const e = document.querySelector('.mv'); return e ? getComputedStyle(e).whiteSpace : null; })() };
      });
      console.log(engine, mode, JSON.stringify(s));
      if (engine === 'chromium' && mode === 'dark') { const fr = await d.page.frameLocator('iframe').first(); }
      await d.close();
    }
  } finally { await L.close(); }
}
