// STAB (7): re-confirm the Phase 0 finding in WebKit — with prefers-reduced-motion: reduce the shell never boots.
//   node "audits/tools/phase2/STAB/reduced-motion.mjs"
// For each case: a WebKit page with emulateMedia({ reducedMotion }) set BEFORE the first load, then what is on screen.
// Cases: Eli signed in on ipad-portrait, the TV kiosk on 'tv', and a signed-out device (the picker), each with 'reduce' and
// the control 'no-preference'. Screenshots → audits/evidence/p2/STAB/reduced-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const results = [];
try {
  for (const [device, profile] of [['ipad-portrait', 'eli'], ['tv', 'tv'], ['iphone-pwa', null]]) {
    for (const rm of ['reduce', 'no-preference']) {
      const d = await L.device({ device, profile });
      await d.page.emulateMedia({ reducedMotion: rm });
      await d.goto('#home');
      await sleep(2500);
      const s = await d.page.evaluate(() => ({
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        gateHidden: document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden,
        sheenFrom: typeof (window.hub && hub.sheenFrom),
        visibleText: document.body.innerText.trim().slice(0, 80),
      }));
      const errors = d.logs.filter(l => /error/i.test(l)).slice(0, 3);
      const file = path.join(OUT, `reduced-${rm === 'reduce' ? 'on' : 'off'}-${device}.png`);
      await shot1x(d, file);
      const r = { device, profile, reducedMotion: rm, ...s, errors, screenshot: path.relative(ROOT, file).replace(/\\/g, '/') };
      results.push(r); console.log(JSON.stringify(r));
      await d.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'reduced-motion.json'), JSON.stringify(results, null, 1));
} finally { await L.close(); }
