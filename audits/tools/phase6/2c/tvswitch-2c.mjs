// PATCHED COPY (batch 2c): the TV's Switch now opens a menu (Switch profile / Screen look); this copy taps "Switch profile" after it. Run from the repo root.
// STAB (lead check, TV section of 01-leads.md): after the board's Switch, does the hidden board keep running behind the
// picker, and does the kiosk stay signed in on the server? (index.html:1133 Switch → showPicker only; clockTimer is cleared
// only in renderHome, :976; showPicker → hub.setSession(null) clears the local copy but never calls /api/logout.)
//   node "audits/tools/phase2/STAB/tvswitch.mjs"
// WebKit, TV device, installed clock advanced 6 simulated minutes with the picker on screen.
// Output: audits/evidence/p2/STAB/tvswitch.json + tvswitch-picker.png
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';
import { advance, settle, track, shot1x } from '../../phase2/STAB/advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = {};
try {
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  const T = track(tv);
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await advance(tv, 10000);
  await tv.page.click('#kiosk-switch'); await tv.page.click('.sheet [data-act="switch"]'); await tv.page.waitForSelector('#profiles .pcard[data-id="tv"]'); await tv.ctx.clock.runFor(500); await settle(tv);
  const s0 = await tv.page.evaluate(() => ({ gateVisible: !document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden, tvConnected: !!document.querySelector('#tv') && document.querySelector('#tv').isConnected, clock: document.getElementById('clock').textContent, lastPaint: window.__tv.state().lastPaint, lastFade: window.__tv.state().lastFade, localSession: localStorage.getItem('hub.session') }));
  const act0 = T.byKind.activity || 0, data0 = T.byKind.data || 0;
  await advance(tv, 6 * 60000);
  const s1 = await tv.page.evaluate(() => ({ gateVisible: !document.getElementById('gate').hidden, clock: document.getElementById('clock').textContent, lastPaint: window.__tv.state().lastPaint, lastFade: window.__tv.state().lastFade }));
  R.hiddenBoard = { atSwitch: s0, after6min: s1, clockKeptTicking: s1.clock !== s0.clock, repainted: s1.lastPaint > s0.lastPaint, crossfaded: s1.lastFade > s0.lastFade,
    activityFetchesWhileHidden: (T.byKind.activity || 0) - act0, dataRequestsWhileHidden: (T.byKind.data || 0) - data0 };
  const me = await L.apiAs('tv', '/api/me');
  R.kioskSessionOnServer = { status: me.status, profile: me.body && me.body.profile && me.body.profile.id };
  await shot1x(tv, path.join(OUT, 'tvswitch-picker.png'));
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'tvswitch.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
