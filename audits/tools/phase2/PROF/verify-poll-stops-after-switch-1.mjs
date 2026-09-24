// PROF (audit Phase 2), skeptic #1 for finding "poll-stops-after-switch".
// Claim: after an in-page profile switch the shell's 30 s pull interval is gone (hub.reset() clears it, hub.ready()
// only recreates it inside `if (!wired)`), so the shared iPad / TV stops seeing other devices' changes.
//
//   node "audits/tools/phase2/PROF/verify-poll-stops-after-switch-1.mjs"     (about 5 minutes: four 65 s windows)
//
// Windows, each 65 s on the real clock, on the rig's Kitchen iPad (WebKit, ipad-portrait):
//   A  Eli after a fresh page load                       (baseline)
//   B  Ezra after Me -> Switch -> Ezra (in-page switch)  (the claim)
//   C  Ezra after a page reload (same person, fresh SDK) (control: is it the switch or the person?)
//   D  Downstairs TV after Me -> Switch -> TV            (does the TV board suffer too?)
// In B, C and D a second device (Mae's phone, its own device token) adds a family reminder 5 s into the window;
// the script records whether the iPad's shell cache / screen has it at the end of the window.
// It also counts live 30 s intervals in the shell (setInterval/clearInterval wrapped in the top window).
// Finally E: a visibilitychange on the TV (what waking the screen does) and whether that pull brings the reminder in.
// Evidence: audits/evidence/p2/PROF/verify-poll-stops-after-switch-1.json (+ one PNG of the TV at the end of D).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const WIN = 65000;
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v)); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const addReminder = async text => {
    const id = 'v' + Date.now().toString(36);
    const r = await L.apiAs('christian', `/api/data/reminders/item:${id}?scope=family`, {
      method: 'PUT', deviceToken: ph.device.token, profileToken: ph.sessions.christian,
      body: { value: { id, text, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() },
    });
    return { id, status: r.status };
  };

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = ipad;
  await ipad.ctx.addInitScript(() => {
    if (window.top !== window) return;
    const si = window.setInterval, ci = window.clearInterval;
    window.__iv30 = new Set();
    window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); if (ms === 30000) window.__iv30.add(id); return id; };
    window.clearInterval = function (id) { window.__iv30.delete(id); return ci.call(window, id); };
  });
  const reqs = [];
  page.on('request', r => { try { const u = new URL(r.url()); if (u.origin === L.api && r.frame() === page.mainFrame()) reqs.push({ t: Date.now(), m: r.method(), p: u.pathname }); } catch {} });
  const pulls = (a, b) => reqs.filter(r => r.m === 'GET' && r.p.startsWith('/api/data/') && r.t >= a && r.t < b);
  const rounds = list => { const out = []; for (const r of list) if (!out.length || r.t - out[out.length - 1] > 3000) out.push(r.t); return out.length; };
  const state = () => page.evaluate(() => ({ profile: hub.profile && hub.profile.id, kind: hub.profile && hub.profile.kind, live30sIntervals: window.__iv30.size, lastPull: hub.sync.lastPull, syncState: hub.sync.state }));
  const inCache = id => page.evaluate(i => !!hub.get('item:' + i, { app: 'reminders', scope: 'family' }), id);
  const waitShell = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 15000 });
  const waitPull = since => page.waitForFunction(s => window.hub && hub.sync.lastPull > s, since, { timeout: 20000 });
  const tap = sel => page.locator(sel).first().click();
  const switchTo = async id => {
    await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
    await page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 15000 });
    await tap(`#profiles .pcard[data-id="${id}"]`); await waitShell(id);
  };
  const window_ = async (label, remText) => {
    const s0 = await state(); const t0 = Date.now();
    let rem = null;
    if (remText) { await sleep(5000); rem = await addReminder(remText); }
    await sleep(WIN - (Date.now() - t0));
    const list = pulls(t0, t0 + WIN); const s1 = await state();
    log(`${label}: state at start`, s0);
    log(`${label}: main-frame GET /api/data in ${WIN / 1000} s`, `${list.length} requests in ${rounds(list)} pull rounds`);
    log(`${label}: state at end`, s1);
    if (rem) log(`${label}: Mae's phone reminder (PUT ${rem.status}) in the iPad shell cache after ${Math.round((WIN - 5000) / 1000)} s`, String(await inCache(rem.id)));
    return rem;
  };

  // A: fresh load as Eli
  await ipad.goto('#home'); await waitShell('eli'); await waitPull(0);
  await window_('A Eli fresh load', 'verify A: bring the chairs in');

  // B: in-page switch to Ezra
  await switchTo('ezra'); await tap('.tab[data-tab="home"]');
  await window_('B Ezra after in-page switch', 'verify B: library books due');

  // C: control — reload the page as Ezra (session persists in localStorage)
  await page.reload({ waitUntil: 'load' }); await waitShell('ezra'); await waitPull(0);
  await window_('C Ezra after page reload', 'verify C: swim bag by the door');

  // D: in-page switch Ezra -> Downstairs TV (kiosk)
  await switchTo('tv');
  await page.waitForFunction(() => document.documentElement.dataset.kind === 'kiosk' && document.querySelector('#tv'), null, { timeout: 15000 });
  await sleep(3000);
  const remD = await window_('D TV after in-page switch', 'verify D: pizza night 6pm');
  const tvRem = () => page.evaluate(t => { const c = document.getElementById('tv-rem-card'); const ul = document.getElementById('remlist'); return { cardHidden: c ? c.hidden : null, showsIt: !!ul && ul.textContent.includes(t) }; }, 'verify D: pizza night 6pm');
  log('D TV reminders pane at end of window', await tvRem());
  await page.screenshot({ path: path.join(OUT, 'verify-poll-stops-after-switch-1-tv.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // E: what waking the screen does (visibilitychange with document visible)
  const lp = (await state()).lastPull;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitPull(lp).catch(() => {}); await sleep(1500);
  log('E TV after a visibilitychange: reminder in cache', String(await inCache(remD.id)));
  log('E TV reminders pane after visibilitychange', await tvRem());
  log('E TV live 30 s intervals after visibilitychange', (await state()).live30sIntervals);
  log('page errors', ipad.logs.filter(l => /pageerror|error:/.test(l)).slice(-5));
  fs.writeFileSync(path.join(OUT, 'verify-poll-stops-after-switch-1.json'), JSON.stringify(R, null, 1));
  console.log('evidence: audits/evidence/p2/PROF/verify-poll-stops-after-switch-1.json, verify-poll-stops-after-switch-1-tv.png');
} finally { await L.close(); }
