// Batch 6 copy of audits/tools/phase3/timer/basics.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6; E writes its 4 s timer as a timer: row. Since the rescore 6 redesign the presets are not on screen
// while a timer is on the dial (that is the UX-TIMER-1 protection now: nothing to tap, so nothing replaces a timer), so C
// asserts that, then opens New timer and adds 3:00 beside the running 10:00 (both rows on the server); D pauses the 3:00
// timer on the dial. The copy asserts what it measures (exit 1 on a failed check) and keeps the original measurements.
//   node "audits/tools/phase6/6/basics-6.mjs"
// Timer basics on the local rig (WebKit, real clock, typical seed), driven through the real UI:
//  A taps from Home to a running timer (adult), B DOM measurements (type, targets, thumb zone), C a preset tap while running,
//  D pause -> leave -> come back, E the done state's dial shape, F accent per profile.
// Run: node "audits/tools/phase6/6/basics-6.mjs"   Output: audits/evidence/p3/timer/basics.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { shot, appState, pillState, audioProbe } from '../../phase3/timer/_util.mjs';
import { save6 as save, serverTimers as serverTimer, putTimer, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const out = { checks: [] };
const check = (c, name, got) => { out.checks.push({ pass: !!c, name, got }); console.log(c ? '  ✓' : '  ✗', name, c ? '' : JSON.stringify(got)); };
const rowsOf = srv => Object.values(srv).filter(v => v && v.id);
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await audioProbe(d.ctx);
  const page = d.page;
  await d.goto('#home'); await sleep(1500);
  // A. Home has no timer card; count taps
  out.homeTimerControls = await page.evaluate(() => [...document.querySelectorAll('#view-home [data-open="timer"], #view-home [data-id="timer"]')].length);
  let taps = 0;
  await page.click('.tab[data-tab="apps"]'); taps++;
  await page.click('.tile[data-id="timer"]'); taps++;
  let f; for (let i = 0; i < 50 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go'));
  await sleep(800);
  out.A_opened = await appState(f);
  // B. measurements (iPhone 430x932)
  out.B_measure = await f.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const cs = el => getComputedStyle(el);
    const q = s => document.querySelector(s);
    const btns = [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), ...box(b), fontSize: cs(b).fontSize, weight: cs(b).fontWeight }));
    return { viewport: [innerWidth, innerHeight], time: { ...box(q('#t')), fontSize: cs(q('#t')).fontSize, weight: cs(q('#t')).fontWeight, family: cs(q('#t')).fontFamily },
      h1: { ...box(q('.hd h1')), fontSize: cs(q('.hd h1')).fontSize, family: cs(q('.hd h1')).fontFamily, display: cs(q('.hd')).display },
      dial: box(q('#dial')), ringStroke: cs(q('.ring .fg')).strokeWidth, btns,
      ariaLive: document.querySelectorAll('[aria-live]').length, ariaPressed: document.querySelectorAll('[aria-pressed]').length };
  });
  out.B_measure.frameTop = await page.evaluate(() => Math.round(document.getElementById('frame').getBoundingClientRect().y));
  await shot(page, 'basics-idle-iphone-light.png');
  // start the last preset
  await f.click('#go'); taps++;
  out.A_tapsToRunningLastPreset = taps;   // Apps + tile + Start
  await sleep(2200);
  out.A_running = await appState(f); await page.evaluate(() => 0);
  await sleep(600); out.A_server = await serverTimer(L, 'eli');
  // C. while the countdown runs no preset is on screen (nothing can replace it); New timer opens the picker and adds a second
  const beforeC = await appState(f);
  out.C_presetsWhileRunning = { before: beforeC, presetVisible: await f.isVisible('[data-s="180"]'), addVisible: await f.isVisible('#add') };
  check(!out.C_presetsWhileRunning.presetVisible && out.C_presetsWhileRunning.addVisible && /Pause/.test(beforeC.go), 'C: running, the presets are not on screen (nothing can replace the timer); New timer is', out.C_presetsWhileRunning);
  await f.click('#add');
  out.C_picker = { presetVisible: await f.isVisible('[data-s="180"]'), go: (await appState(f)).go };
  check(out.C_picker.presetVisible && /Start/.test(out.C_picker.go), 'C: New timer opens the picker in place', out.C_picker);
  await f.click('[data-s="180"]'); await f.click('#go');
  await sleep(1500);
  out.C_afterAdd = { after: await appState(f), server: await serverTimer(L, 'eli') };
  const totalsC = rowsOf(out.C_afterAdd.server).map(r => r.total).sort((a, b) => a - b);
  check(totalsC.length === 2 && totalsC.includes(180000) && totalsC.includes(600000) && rowsOf(out.C_afterAdd.server).every(r => r.endAt > 0 && !r.pausedAt), 'C: a preset there adds 3:00 while the 10:00 keeps running: both rows on the server', totalsC);
  // D. the 3 min timer (on the dial) runs ~3 s, Pause, leave to Home, come back
  await sleep(3200); await f.click('#go');
  out.D_paused = await appState(f); await sleep(1200); out.D_serverAfterPause = await serverTimer(L, 'eli');
  const pausedRow = rowsOf(out.D_serverAfterPause).find(r => r.total === 180000);
  check(pausedRow && pausedRow.pausedAt > 0 && pausedRow.endAt === null && pausedRow.remaining > 170000 && /Resume/.test(out.D_paused.go), 'D: Pause is stored on the server {pausedAt, remaining, endAt null}', pausedRow);
  await shot(page, 'basics-paused-iphone-light.png');
  await page.click('#pill-home'); await sleep(600);
  await page.click('.tab[data-tab="home"]'); await sleep(800);
  out.D_homePill = await pillState(page);
  await page.click('.tab[data-tab="apps"]'); await page.click('.tile[data-id="timer"]'); await sleep(300);
  f = d.frame('timer'); await f.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(800);
  out.D_reopened = await appState(f);
  // the running 10:00 comes to the front on reopen; the 3:00 stays paused, in the list with its time
  out.D_reopenedPaused = await f.evaluate(() => { const r = hub.timers.list().find(x => x.total === 180000); const chip = [...document.querySelectorAll('#list .tm')].map(b => b.textContent.trim()).find(t => /Paused/.test(t)); return { state: r && r.state, left: r && r.left, chip }; });
  check(out.D_reopenedPaused.state === 'paused' && /Paused · 2:5[0-9]/.test(out.D_reopenedPaused.chip || ''), `D: reopened, the 3:00 timer is still paused (${out.D_reopenedPaused.chip})`, out.D_reopenedPaused);
  // E. done state: a 4 s timer written as Eli (same shape the app writes), app open
  const now = Date.now();
  await putTimer(L, 'eli', { endAt: now + 5000, total: 60, startedAt: now - 55000 });
  await page.evaluate(() => hub.pull()); await f.evaluate(() => hub.pull()); await sleep(1200);
  out.E_runningDial = { state: await appState(f), dial: await f.evaluate(() => { const r = document.getElementById('dial').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), padding: getComputedStyle(document.getElementById('dial')).padding }; }) };
  await sleep(6000);
  out.E_done = { state: await appState(f), dial: await f.evaluate(() => { const el = document.getElementById('dial'); const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), padding: getComputedStyle(el).padding, classes: el.className, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) }; }), server: await serverTimer(L, 'eli'), shellToast: await page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }) };
  await shot(page, 'basics-done-iphone-light.png');
  // the layout box (offsetWidth/Height): the done pulse scales the dial, which getBoundingClientRect includes
  out.E_done.dialLayout = await f.evaluate(() => { const el = document.getElementById('dial'); return { w: el.offsetWidth, h: el.offsetHeight }; });
  check(out.E_done.state.done && out.E_done.dialLayout.w === out.E_done.dialLayout.h && Math.abs(out.E_done.dialLayout.w - out.E_runningDial.dial.w) <= 2 && /Time's up/.test(out.E_done.dial.text) && /Stop/.test(out.E_done.state.go),
    `E: at 0 the dial stays round (${out.E_done.dialLayout.w}x${out.E_done.dialLayout.h}, as running) and says "Time's up"; Stop`, { running: out.E_runningDial.dial, done: out.E_done.dial, go: out.E_done.state.go });
  // F. accent per profile (frame computed tokens), and the dial time colour
  const acc = async pid => { const dd = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false }); const ff = await dd.openApp('timer', { wait: '#go' }); await sleep(1200);
    const r = await ff.evaluate(() => { const s = getComputedStyle(document.documentElement); return { accent: s.getPropertyValue('--accent').trim(), accentStrong: s.getPropertyValue('--accent-strong').trim(), kind: document.documentElement.dataset.kind || null, timeColor: getComputedStyle(document.getElementById('t')).color, profile: hub.profile && hub.profile.name }; });
    r.state = await appState(ff); await dd.close(); return r; };
  out.F_accent = { eli: await acc('eli'), mom: await acc('mom'), ezra: await acc('ezra') };
} catch (e) { check(false, "the script ran to the end", String(e && e.stack || e).slice(0, 400)); } finally { await closeRig(L); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('basics-6.json', out));

const failed = out.checks.filter(c => !c.pass).length;
console.log(`\n${out.checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
