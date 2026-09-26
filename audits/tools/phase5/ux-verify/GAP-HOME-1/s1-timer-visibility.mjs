// GAP-HOME-1, skeptic s1: with Elizabeth's (mom) kitchen timer running (typical seed, 6:20 left at the demo instant),
// which shared surfaces show it? TV kiosk board, the iPad signed in as Eli / Ezra / Elizabeth, Dad's iPhone.
// Also: does anything in the feed or on the board mention the timer, and what can another adult read of it over the API.
// Local rig only.
//   node "audits/tools/phase5/ux-verify/GAP-HOME-1/s1-timer-visibility.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-HOME-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { surfaces: {}, api: {} };
try {
  for (const [label, device, profile] of [['tv', 'tv', 'tv'], ['ipad-eli', 'ipad-landscape', 'eli'], ['ipad-ezra', 'ipad-landscape', 'ezra'], ['ipad-mom', 'ipad-landscape', 'mom'], ['iphone-dad', 'iphone-pwa', 'dad']]) {
    const d = await L.device({ device, profile });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    const s = await d.page.evaluate(() => {
      const p = document.querySelector('#timer-pill'), t = document.querySelector('#timer-pill-time');
      const vis = !!p && !p.hidden && p.getBoundingClientRect().height > 0;
      const body = document.body.innerText;
      let own = null; try { own = hub.get('timer.active', { app: 'timer', scope: 'person' }); } catch (e) { own = 'err:' + e.message; }
      return { kind: document.documentElement.dataset.kind, pillVisible: vis, pillText: vis ? t.textContent : null, pillFontPx: vis ? parseFloat(getComputedStyle(t).fontSize) : null,
        pillRect: vis ? (r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))(p.getBoundingClientRect()) : null,
        pageMentionsTimer: /\btimer\b/i.test(body.replace(/Kitchen timer/g, '')), pageMentions620: /6:2\d/.test(body), ownTimerActive: own };
    });
    out.surfaces[label] = { device, profile, ...s };
    await d.page.screenshot({ path: path.join(OUT, `s1-${label}.png`), animations: 'disabled', caret: 'hide' });
    console.log(label, JSON.stringify(out.surfaces[label]));
    await d.close();
  }
  for (const who of ['mom', 'eli']) {
    try { const r = await L.apiAs(who, '/api/data/timer?scope=person'); out.api[who] = JSON.stringify(r).slice(0, 400); } catch (e) { out.api[who] = 'error: ' + e.message.slice(0, 200); }
  }
  try { const r = await L.apiAs('eli', '/api/data/timer?scope=family'); out.api['eli-family'] = JSON.stringify(r).slice(0, 300); } catch (e) { out.api['eli-family'] = 'error: ' + e.message.slice(0, 200); }
  console.log(JSON.stringify(out.api, null, 1));
} finally {
  fs.writeFileSync(path.join(OUT, 's1-timer-visibility.json'), JSON.stringify(out, null, 1));
  await L.close();
}
