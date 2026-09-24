// Skeptic #1 for finding 'plot-card-stale' (apps/dollywood.html:1074 gameLine, :1077 renderStep, :1049-1052 updScale,
// :1108-1112 adopt). Independent re-run: does the first step card ignore the saved person-scope 'plot' after load?
//   node "audits/tools/phase3/dollywood/verify-plot-card-stale-1.mjs"
// Arms: typical seed (plot '400') and overflow seed (plot '12500'), iPad portrait, WebKit, signed in as Eli in the shell.
// Reads the card right after load, again after 35 s (a periodic 30 s pull has run), and after Next+Prev.
// Writes audits/evidence/p3/dollywood/verify-plot-card-stale-1.json and -<variant>.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const variant of ['typical', 'overflow']) {
    if (variant !== 'typical') await L.reset(variant);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await f.evaluate(() => { window.__ev = []; hub.onChange(e => window.__ev.push({ key: e.key, bulk: !!e.bulk })); });
    await sleep(1500);
    const card = () => f.evaluate(() => {
      const g = document.querySelector('#b-now .meas.game');
      let ls = null; try { ls = localStorage.getItem('dw-plot'); } catch (e) {}
      return { step: stepsOf(curSec)[curIdx].id, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim() : null,
        plotInput: document.getElementById('sc-plot').value, scaleFac: scale.fac, hubPlot: hub.get('plot'), lsDwPlot: ls, events: window.__ev.slice() };
    });
    const afterLoad = await card();
    await sleep(35000);
    const after35s = await card();
    const shotPath = path.join(EV, `verify-plot-card-stale-1-${variant}.png`);
    await d.page.screenshot({ path: shotPath, scale: 'css', animations: 'disabled', caret: 'hide' });
    await f.evaluate(() => { document.getElementById('b-next').click(); document.getElementById('b-prev').click(); }); await sleep(500);
    const afterNextPrev = await card();
    out[variant] = { afterLoad, after35s, afterNextPrev, png: path.relative(process.cwd(), shotPath).split(path.sep).join('/') };
    console.log(variant, JSON.stringify(out[variant], null, 1));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'verify-plot-card-stale-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
