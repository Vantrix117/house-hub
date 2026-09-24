// Skeptic #1 for STAB finding "timer-endat-device-clock": a shared timer counts down against each device's own clock.
//   node "audits/tools/phase2/STAB/verify-timer-endat-device-clock-1.mjs"
// Independent of skew.mjs: runs the Worker on the REAL clock (clock:'real'), so the demo clock's 1 ms-per-second pull
// cursor cannot hide or reorder a write; each browser gets an installed clock = real now + a known offset.
//   A  (the claim): Eli's phone runs OFFSET s fast and starts a 10-min timer; the Kitchen iPad (correct clock) pulls and
//      shows the pill. If endAt is compared against each device's own Date.now(), the two differ by ~OFFSET s.
//   B  (consequence): the iPad (correct clock) starts a 3-min timer in the Timer app; the fast phone sits on Home (pill).
//      Both clocks advance in step. Does the phone's shell "finish" the timer OFFSET s early, clear timer.active for
//      everyone, and does the iPad's running Timer app then stop without its done state / beep?
// Output: audits/evidence/p2/STAB/verify-timer-endat-device-clock-1.json (+ two 1x PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
import { settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const TAG = 'verify-timer-endat-device-clock-1';
const OFFSET = 90000;                                   // phone clock ahead of the iPad by 90 s
const r = { offsetS: OFFSET / 1000 };
const clockOf = fr => fr.evaluate(() => Date.now());
const hms = ms => new Date(ms).toTimeString().slice(0, 8);
async function step(devs, ms) { for (const d of devs) await d.ctx.clock.runFor(ms); for (const d of devs) await settle(d); }

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  // ── A ─────────────────────────────────────────────────────────────────────────────
  {
    const ph = await L.newDevice({ name: 'Eli phone A', profiles: ['eli'] });
    const now = Date.now();
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: now + OFFSET, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: now });
    await ipad.goto('#home'); await ipad.page.waitForSelector('#view-home .card');
    const f = await phone.openApp('timer', { wait: '#go' });
    await f.click('[data-s="600"]'); await f.click('#go');
    await step([phone], 1000); await settle(phone, { min: 500 });
    const server = await L.apiAs('eli', '/api/data/timer?scope=person');
    const row = ((server.body && server.body.items) || []).find(i => i.key === 'timer.active');
    for (let i = 0; i < 4; i++) await step([ipad, phone], 10000);                  // 40 s: at least one 30 s pull on the iPad
    const pClock = await clockOf(f), iClock = await clockOf(ipad.page);
    r.A = {
      serverRow: row && row.value,
      phone: { clock: hms(pClock), timerShows: await f.evaluate(() => document.getElementById('t').textContent), skewS: Math.round(await f.evaluate(() => hub.skew) / 1000) },
      ipad: { clock: hms(iClock), pill: await ipad.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent), skewS: Math.round(await ipad.page.evaluate(() => hub.skew) / 1000) },
      endAtMinusPhoneClockS: row && Math.round((row.value.endAt - pClock) / 1000),
      endAtMinusIpadClockS: row && Math.round((row.value.endAt - iClock) / 1000),
    };
    await shot1x(ipad, path.join(OUT, TAG + '-A-ipad-pill.png'));
    await f.click('#reset'); await step([phone], 1000);                            // clear for B
    await phone.close(); await ipad.close();
  }
  // ── B ─────────────────────────────────────────────────────────────────────────────
  {
    const ph = await L.newDevice({ name: 'Eli phone B', profiles: ['eli'] });
    const now = Date.now();
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: now + OFFSET, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: now });
    await phone.goto('#home'); await phone.page.waitForSelector('#view-home .card');
    const f = await ipad.openApp('timer', { wait: '#go' });
    await f.evaluate(() => { window.__beeps = 0; const A = window.AudioContext || window.webkitAudioContext; if (A) { const o = A.prototype.createOscillator; A.prototype.createOscillator = function () { window.__beeps++; return o.call(this); }; } });
    await phone.page.evaluate(() => { window.__beeps = 0; const A = window.AudioContext || window.webkitAudioContext; if (A) { const o = A.prototype.createOscillator; A.prototype.createOscillator = function () { window.__beeps++; return o.call(this); }; } });
    await phone.page.evaluate(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !window.__toasts.some(x => x.startsWith(t.textContent))) window.__toasts.push(t.textContent + ' @phoneClock ' + new Date().toTimeString().slice(0, 8)); }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); });
    await f.click('[data-s="180"]'); await f.click('#go');
    const startIpad = await clockOf(f);
    await step([ipad, phone], 1000);
    const timeline = [];
    let phoneFinishedAt = null, ipadStoppedAt = null;
    for (let s = 0; s < 200; s += 5) {                                             // 200 s of simulated time, both clocks in step
      await step([ipad, phone], 5000);
      const el = Math.round((await clockOf(f) - startIpad) / 1000);
      const snap = {
        elapsedS: el,
        ipadTimer: await f.evaluate(() => document.getElementById('t').textContent),
        ipadGo: await f.evaluate(() => document.getElementById('go').textContent),
        ipadDone: await f.evaluate(() => document.body.classList.contains('done')),
        ipadBeeps: await f.evaluate(() => window.__beeps),
        phonePill: await phone.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent),
        phoneToasts: await phone.page.evaluate(() => window.__toasts.slice()),
        phoneBeeps: await phone.page.evaluate(() => window.__beeps),
      };
      timeline.push(snap);
      if (phoneFinishedAt == null && snap.phoneToasts.some(t => /Timer done/.test(t))) phoneFinishedAt = el;
      if (ipadStoppedAt == null && snap.ipadGo === 'Start') { ipadStoppedAt = el; await shot1x(ipad, path.join(OUT, TAG + '-B-ipad-after.png')); }
      if (el > 185) break;
    }
    const server = await L.apiAs('eli', '/api/data/timer?scope=person');
    r.B = { timerS: 180, phoneFinishedAtElapsedS: phoneFinishedAt, ipadStoppedAtElapsedS: ipadStoppedAt,
      serverTimerActive: (((server.body && server.body.items) || []).find(i => i.key === 'timer.active') || {}).value ?? null, timeline };
    await phone.close(); await ipad.close();
  }
  console.log(JSON.stringify({ offsetS: r.offsetS, A: r.A, B: { ...r.B, timeline: undefined } }, null, 1));
  for (const x of r.B.timeline) console.log(`B t+${String(x.elapsedS).padStart(3)}s  iPad app ${x.ipadTimer.padStart(5)} [${x.ipadGo}${x.ipadDone ? ', done' : ''}] beeps ${x.ipadBeeps} | phone pill ${String(x.phonePill).padStart(5)} toasts ${JSON.stringify(x.phoneToasts)} beeps ${x.phoneBeeps}`);
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(r, null, 1));
} finally { await L.close(); }
