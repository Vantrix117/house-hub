// Skeptic s2, GAP-HOME-1: with Elizabeth's (mom) kitchen timer running (typical seed: timer.active in her person scope),
// which surfaces show it? TV board, the iPad as Eli, the iPad as a kid (Ezra), the iPad as Elizabeth (pill size), and
// Elizabeth with the Timer app open (the countdown's size, as the in-app workaround). Also: can the kiosk see any family timer row?
//   node "audits/tools/phase5/ux-verify/GAP-HOME-1/s2-timer-surfaces.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-HOME-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const MM = 25.4 / 132;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { surfaces: {} };
try {
  out.server = {
    mom: (await L.apiAs('mom', '/api/data/timer?scope=person')).body,
    eli: (await L.apiAs('eli', '/api/data/timer?scope=person')).body,
    tvFamily: (await L.apiAs('tv', '/api/data/timer?scope=family')),
  };
  const probe = () => {
    const p = document.querySelector('#timer-pill'); const t = document.querySelector('#timer-pill-time');
    const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(t); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const home = (document.querySelector('#view-home') || {}).innerText || '';
    return { who: hub.profile && hub.profile.id, kind: document.documentElement.dataset.kind, pillHidden: p.hidden, pillText: p.hidden ? null : t.textContent, pillFontPx: parseFloat(cs.fontSize), pillCapPx: +c.measureText('H').actualBoundingBoxAscent.toFixed(1), pillRect: p.hidden ? null : (r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))(p.getBoundingClientRect()), homeMentionsTimer: /timer|\d+:\d\d(?!\s*(AM|PM))/i.test(home.replace(/\d+:\d\d\s*(AM|PM)/gi, '')), tvPanes: [...document.querySelectorAll('#tv .tv-pane h2')].map(h => h.textContent.trim()), timerCache: localStorage.getItem('hub.cache.timer.person') ? 'present' : 'none' };
  };
  for (const [dev, who] of [['tv', 'tv'], ['ipad-portrait', 'eli'], ['ipad-portrait', 'ezra'], ['ipad-portrait', 'mom'], ['ipad-landscape', 'mom']]) {
    const d = await L.device({ device: dev, profile: who });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
    await sleep(1500);
    const r = await d.page.evaluate(probe);
    if (r.pillCapPx) r.pillCapMm = +(r.pillCapPx * (dev === 'tv' ? 0.6342 : MM)).toFixed(2);
    out.surfaces[`${dev}:${who}`] = r;
    await d.page.screenshot({ path: path.join(OUT, `s2-${dev}-${who}.png`), animations: 'disabled', caret: 'hide' });
    if (who === 'mom' && dev === 'ipad-portrait') {
      const f = await d.openApp('timer'); await sleep(1500);
      out.timerAppOpen = await f.evaluate(() => { const el = document.querySelector('.time'); const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return { text: el.textContent.trim(), fontPx: parseFloat(cs.fontSize), capPx: +c.measureText('8').actualBoundingBoxAscent.toFixed(1) }; });
      out.timerAppOpen.digitMm = +(out.timerAppOpen.capPx * MM).toFixed(2);
      await d.page.screenshot({ path: path.join(OUT, 's2-timer-app-open-mom.png'), animations: 'disabled', caret: 'hide' });
    }
    await d.close();
  }
  for (const [k, v] of Object.entries(out.surfaces)) console.log(`${k}: pill ${v.pillHidden ? 'hidden' : v.pillText + ' ' + v.pillFontPx + 'px cap ' + v.pillCapMm + 'mm'}; home mentions timer ${v.homeMentionsTimer}; tv panes ${v.tvPanes.join('/') || '-'}`);
  console.log('timer app open (mom):', JSON.stringify(out.timerAppOpen));
  console.log('server mom timer rows:', JSON.stringify(out.server.mom).slice(0, 300));
  console.log('server eli timer rows:', JSON.stringify(out.server.eli).slice(0, 200));
  console.log('tv family timer rows:', JSON.stringify(out.server.tvFamily).slice(0, 200));
} finally {
  fs.writeFileSync(path.join(OUT, 's2-timer-surfaces.json'), JSON.stringify(out, null, 1));
  await L.close();
}
