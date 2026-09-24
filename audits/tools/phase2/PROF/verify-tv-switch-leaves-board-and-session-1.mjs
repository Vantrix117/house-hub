// PROF skeptic #1 — "The TV board's Switch leaves the hidden board running and the kiosk session valid".
// Independent re-run on a fresh local instance (own paired device, so the tokens are not shared with other contexts):
//   A. kiosk ("tv") on the TV at 1920×1080, real timers: tap the board's Switch, then watch the hidden #clock for 3.5 real
//      seconds with a MutationObserver (does the 1 Hz tick keep writing into a board nobody can see?).
//   B. same, controllable clock: tap Switch, run 6 simulated minutes at the picker, count API calls by path, check the
//      board's window.__tv state (lastFade / lastFeed advance?), then ask the server whether the kiosk token still works.
//   C. control: an adult (eli) on the same kind of device opens Home, then Me → Switch, 6 simulated minutes at the picker — which of
//      B's calls also happen there (hub.js's 30 s pull timer is not the board's), and is eli's token revoked?
//
//   node "audits/tools/phase2/PROF/verify-tv-switch-leaves-board-and-session-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v));
// advance the fake clock in 30 s slices with a short real pause, so each pull's fetch resolves before its 12 s abort timer fires
const sixMinutes = async d => { for (let i = 0; i < 12; i++) { await d.ctx.clock.runFor(30000); await sleep(400); } };
const byPath = arr => arr.reduce((m, c) => { const k = c.p.replace(/\/[0-9a-f]{16,}.*$/, '/<id>'); m[k] = (m[k] || 0) + 1; return m; }, {});

const L = await local({ variant: 'typical', clock: 'real' });
const results = {};
try {
  const dev = await L.newDevice({ name: 'Verify TV', profiles: ['tv', 'eli'] });

  // ── A: real timers ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false, as: dev });
    await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await sleep(1500);
    await tv.page.click('#kiosk-switch'); await sleep(800);
    const r = await tv.page.evaluate(async () => {
      const c = document.getElementById('clock'); let n = 0;
      const mo = new MutationObserver(ms => { n += ms.length; }); mo.observe(c, { childList: true, characterData: true, subtree: true });
      await new Promise(res => setTimeout(res, 3500)); mo.disconnect();
      return { gateShown: !document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden, tvConnected: document.getElementById('tv').isConnected,
        tvVisible: document.getElementById('tv').getBoundingClientRect().height > 0 && !!document.getElementById('tv').offsetParent, clockMutationsIn3500ms: n, hubSession: !!hub.session };
    });
    log('A real timers: after board Switch', r); results.A = r;
    await tv.close();
  }

  // ── B: controllable clock, 6 minutes at the picker after the board's Switch ─────────────────────────────────────────
  {
    const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now(), as: dev });
    const calls = [];
    tv.page.on('request', q => { const u = new URL(q.url()); if (u.origin === L.api) calls.push({ p: u.pathname, pt: !!q.headers()['x-profile-token'] }); });
    await tv.goto('#home'); await tv.page.waitForSelector('#kiosk-switch'); await tv.ctx.clock.runFor(3000);
    const token = await tv.page.evaluate(() => hub.session && hub.session.token);
    const meBefore = await L.apiAs(null, '/api/me', { deviceToken: dev.device.token, profileToken: token });
    await tv.page.click('#kiosk-switch'); await tv.ctx.clock.runFor(1500);
    const s0 = await tv.page.evaluate(() => ({ clock: document.getElementById('clock').textContent, tv: window.__tv && window.__tv.state(), lsSession: localStorage.getItem('hub.session'), hubProfile: hub.profile && hub.profile.id }));
    const c0 = calls.length;
    await sixMinutes(tv);
    const s1 = await tv.page.evaluate(() => ({ clock: document.getElementById('clock').textContent, tv: window.__tv && window.__tv.state(), gateShown: !document.getElementById('gate').hidden }));
    const after = calls.slice(c0);
    const meAfter = await L.apiAs(null, '/api/me', { deviceToken: dev.device.token, profileToken: token });
    const withProfileToken = after.filter(c => c.pt).length;
    log('B: /api/me with the kiosk token before Switch', `${meBefore.status} ${meBefore.body.profile ? meBefore.body.profile.id : meBefore.body.error}`);
    log('B: right after Switch (local session cleared?)', { lsSession: s0.lsSession, hubProfile: s0.hubProfile });
    log('B: hidden #clock before → after 6 min', `${s0.clock} → ${s1.clock}`);
    log('B: __tv.lastFade / lastFeed advance (ms)', { fade: s1.tv.lastFade - s0.tv.lastFade, feed: s1.tv.lastFeed - s0.tv.lastFeed, lastPaint: s1.tv.lastPaint - s0.tv.lastPaint });
    log('B: API calls in the 6 min at the picker', byPath(after));
    log('B: of which carried X-Profile-Token', withProfileToken);
    log('B: hub.sync at the picker after 6 min', await tv.page.evaluate(() => ({ ...hub.sync })));
    log('B: /api/me with the kiosk token after Switch + 6 min', `${meAfter.status} ${meAfter.body.profile ? 'still valid for ' + meAfter.body.profile.id : meAfter.body.error}`);
    log('B: same token from ANOTHER paired device (rig iPad)', await (async () => { const r = await L.apiAs(null, '/api/me', { profileToken: token }); return `${r.status} ${r.body.error || ''}`; })());
    await tv.page.screenshot({ path: path.join(OUT, 'verify-tv-switch-1-picker.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    results.B = { s0, s1, calls: byPath(after), meBefore: meBefore.status, meAfter: meAfter.status };
    await tv.close();
  }

  // ── C: control — adult Me → Switch on the same kind of device ──────────────────────────────────────────────────────
  {
    const d = await L.device({ device: 'tv', profile: 'eli', installClock: Date.now(), as: dev });
    const calls = [];
    d.page.on('request', q => { const u = new URL(q.url()); if (u.origin === L.api) calls.push({ p: u.pathname, pt: !!q.headers()['x-profile-token'] }); });
    await d.goto('#home'); await d.ctx.clock.runFor(3000);                 // Home first, so the shell declares the family channels Home uses
    await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#switch'); await d.ctx.clock.runFor(3000);
    const token = await d.page.evaluate(() => hub.session && hub.session.token);
    const c0 = calls.length;
    await d.page.click('#switch'); await d.ctx.clock.runFor(1500);
    const switchCalls = calls.slice(c0).map(c => c.p);
    const c1 = calls.length;
    await sixMinutes(d);
    const after = calls.slice(c1);
    const me = await L.apiAs(null, '/api/me', { deviceToken: dev.device.token, profileToken: token });
    log('C control: calls made by Me → Switch itself', switchCalls);
    log('C control: API calls in the 6 min at the picker', byPath(after));
    log('C control: hub.sync at the picker after 6 min', await d.page.evaluate(() => ({ ...hub.sync })));
    log('C control: /api/me with eli token after Me → Switch', `${me.status} ${me.body.error || (me.body.profile && me.body.profile.id)}`);
    results.C = { switchCalls, calls: byPath(after), me: me.status };
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'verify-tv-switch-leaves-board-and-session-1.json'), JSON.stringify(results, null, 2));
} finally { await L.close(); }
