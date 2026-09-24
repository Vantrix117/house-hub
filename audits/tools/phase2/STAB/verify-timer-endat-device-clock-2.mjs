// STAB skeptic #2 for "timer-endat-device-clock": does a shared timer count down against each device's own clock, and
// what happens on the device that started it when another device's clock is fast?
//   node "audits/tools/phase2/STAB/verify-timer-endat-device-clock-2.mjs"
// Real clock mode (the Worker uses real time, so hub.skew is measured against a clock that moves normally).
// Kitchen iPad (Eli, correct clock) starts a 3-minute timer in the Timer app. A control phone (Eli, correct clock) and a
// fast phone (Eli's own paired phone, clock 90 s ahead) sit on Home and show the shell pill after a pull.
// Then the fast phone's clock runs until ITS pill reaches 0 (the shell's finishTimer removes timer.active), and the iPad
// pulls once: does its running countdown survive?
// Output: audits/evidence/p2/STAB/verify-timer-endat-device-clock-2.json (+ two 1x PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
import { advance, settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const FAST = 90000;
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const r = { fastBy: FAST / 1000 };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
  const ctl = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  const fast = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() + FAST, as: ph });

  const pill = d => d.page.evaluate(() => { const p = document.getElementById('timer-pill'); return p.hidden ? null : document.getElementById('timer-pill-time').textContent; });
  const clockOf = (d, fr) => (fr || d.page).evaluate(() => new Date().toTimeString().slice(0, 8));
  const skewOf = (fr) => fr.evaluate(() => Math.round((window.hub && hub.skew || 0) / 1000));
  const server = async () => { const x = await L.apiAs('eli', '/api/data/timer?scope=person'); const it = (x.body.items || []).find(i => i.key === 'timer.active'); return { now: x.body.now, active: it ? it.value : '(no row)', updated_at: it && it.updated_at }; };

  // 1) iPad starts a 3-minute timer
  const f = await ipad.openApp('timer', { wait: '#go' });
  await f.click('[data-s="180"]'); await f.click('#go');
  await ipad.ctx.clock.runFor(1500); await settle(ipad, { min: 600 });
  const s1 = await server();
  r.afterStart = { serverActive: s1.active, serverNowMinusEndAt: s1.active && s1.active.endAt ? Math.round((s1.active.endAt - s1.now) / 1000) : null };

  // 2) both phones open Home (pull on open) and show the pill
  for (const d of [ctl, fast]) { await d.goto('#home'); await d.page.waitForSelector('#view-home .card'); await d.ctx.clock.runFor(1500); await settle(d, { min: 600 }); }
  await sleep(200);
  r.sameMoment = {
    ipad: { clock: await clockOf(ipad, f), app: await f.evaluate(() => document.getElementById('t').textContent), skewS: await skewOf(f) },
    controlPhone: { clock: await clockOf(ctl), pill: await pill(ctl), skewS: await skewOf(ctl.page) },
    fastPhone: { clock: await clockOf(fast), pill: await pill(fast), skewS: await skewOf(fast.page) },
  };
  await shot1x(fast, path.join(OUT, 'verify-timer-skew-fastphone-pill.png'));

  // 3) the fast phone's clock runs until its pill reaches 0
  let finished = null;
  for (let i = 0; i < 12 && !finished; i++) {
    await advance(fast, 10000);
    const p = await pill(fast);
    if (p === null) finished = { afterS: (i + 1) * 10, toast: await fast.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }) };
  }
  await settle(fast, { min: 800 });
  const s2 = await server();
  r.fastPhoneHitZero = { ...finished, fastClock: await clockOf(fast), serverActiveAfter: s2.active, ipadAppAtThatMoment: await f.evaluate(() => document.getElementById('t').textContent), realSecondsLeftOnServerClock: s1.active && s1.active.endAt ? Math.round((s1.active.endAt - s2.now) / 1000) : null };

  // 4) the iPad pulls once (30 s poll): what happens to its running countdown?
  await advance(ipad, 31000);
  r.ipadAfterPull = {
    clock: await clockOf(ipad, f),
    app: await f.evaluate(() => document.getElementById('t').textContent),
    button: await f.evaluate(() => document.getElementById('go').textContent),
    doneClass: await f.evaluate(() => document.body.classList.contains('done')),
    shouldStillHaveS: s1.active && s1.active.endAt ? Math.round((s1.active.endAt - (await f.evaluate(() => Date.now()))) / 1000) : null,
  };
  await shot1x(ipad, path.join(OUT, 'verify-timer-skew-ipad-after-pull.png'));
  r.logs = { fast: fast.logs.filter(l => /error/i.test(l)).slice(0, 5), ipad: ipad.logs.filter(l => /error/i.test(l)).slice(0, 5) };
  console.log(JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-timer-endat-device-clock-2.json'), JSON.stringify(r, null, 1));
} finally { await L.close(); }
