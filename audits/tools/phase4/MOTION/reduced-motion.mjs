// Phase 4 MOTION — prefers-reduced-motion per area, WebKit. Two arms per surface: no-preference and reduce (via
// page.emulateMedia before navigation). The shell is loaded at index.html#home (P2-STAB-01 predicts a blank page under
// reduce); every app is opened standalone by URL, because the shell cannot host it under reduce.
// Per arm: does it boot (visible text length, hub.sync.lastPull, page errors), running animations and the infinite ones
// (document.getAnimations()), how many buttons still carry a non-zero transition-duration, and whether the page asked
// matchMedia for reduced motion. Writes audits/evidence/p4/MOTION/reduced-motion.json.
//   node "audits/tools/phase4/MOTION/reduced-motion.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const SURF = [
  ['shell-home', 'ipad-portrait', 'eli', '#home'],
  ['tv-board', 'tv', 'tv', '#home'],
  ['f260', 'ipad-portrait', 'eli', 'apps/f260.html'],
  ['leftovers', 'ipad-portrait', 'eli', 'apps/leftovers.html'],
  ['prayer', 'ipad-portrait', 'eli', 'apps/prayer.html'],
  ['tally', 'ipad-portrait', 'eli', 'apps/tally.html'],
  ['timer', 'ipad-portrait', 'eli', 'apps/timer.html'],
  ['dollywood', 'ipad-portrait', 'eli', 'apps/dollywood.html'],
  ['dollywood-live', 'ipad-portrait', 'eli', 'apps/dollywood-live.html'],
  ['kidverse', 'ipad-portrait', 'ezra', 'apps/kidverse.html'],
  ['verses', 'ipad-portrait', 'eli', 'apps/verses.html'],
];
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const [name, device, profile, where] of SURF) {
    out[name] = {};
    for (const rm of ['no-preference', 'reduce']) {
      const d = await L.device({ device, profile });
      await d.ctx.addInitScript(() => { const mm = window.matchMedia; window.__rmAsked = 0; window.matchMedia = q => { if (/reduced-motion/.test(q)) window.__rmAsked++; return mm.call(window, q); }; });
      await d.page.emulateMedia({ reducedMotion: rm });
      if (where.startsWith('#')) await d.goto(where); else await d.page.goto(L.site + '/' + where, { waitUntil: 'load' });
      await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 12000 }).catch(() => {});
      await sleep(2500);
      const s = await d.page.evaluate(() => {
        const anims = document.getAnimations().filter(a => a.playState === 'running');
        const inf = anims.filter(a => a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => `${a.animationName || a.transitionProperty || 'anim'}@${(a.effect.target && (a.effect.target.id || a.effect.target.getAttribute('class') || a.effect.target.tagName) || '?').toString().slice(0, 30)}`);
        const btns = [...document.querySelectorAll('button, .tile, [role=button]')];
        const withTr = btns.filter(b => getComputedStyle(b).transitionDuration.split(',').some(x => parseFloat(x) > 0));
        const gate = document.getElementById('gate'), shell = document.getElementById('shell');
        return { textLen: (document.body.innerText || '').trim().length, lastPull: window.hub && hub.sync ? hub.sync.lastPull > 0 : null, running: anims.length, infinite: inf, buttons: btns.length, buttonsWithTransition: withTr.length, rmAsked: window.__rmAsked, sheenFrom: window.hub ? typeof hub.sheenFrom : null, gateHidden: gate ? gate.hidden : undefined, shellHidden: shell ? shell.hidden : undefined };
      });
      s.pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 160));
      s.boots = s.textLen > 20 && !(s.gateHidden && s.shellHidden);
      out[name][rm] = s;
      console.log(name.padEnd(15), rm.padEnd(13), `boots ${s.boots} text ${s.textLen} pulled ${s.lastPull} running ${s.running} infinite ${JSON.stringify(s.infinite)} btnTransitions ${s.buttonsWithTransition}/${s.buttons} rmAsked ${s.rmAsked} errors ${s.pageErrors.length ? s.pageErrors[0] : 0}`);
      await d.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(EV, 'reduced-motion.json'), JSON.stringify({ engine: 'webkit', out }, null, 1));
  await L.close();
}
