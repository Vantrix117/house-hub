// Batch 6, Worker A: the Timer's logic, data and words on the local rig (typical household, real clock). WebKit (the
// iPhone's engine) for the screens; Chromium for what WebKit on Windows cannot do here (AudioContext, wake lock). Claims:
// the contract (timer:<id> rows in server time, the family mirror), a preset never replaces silently (UX-TIMER-1), a second
// and third timer, custom times in h:mm:ss, +1 min, labels and recents (GAP-TIMER-3, VIS-TIMER-4), Pause stored and shown
// on another device (UX-TIMER-2), "Time's up" in words with the bell and Pause/Stop as the primary (UX-TIMER-4, VIS-TIMER-1),
// a timer that ended unseen and the 10-minute rule (UX-TIMER-3), aria-live and aria-pressed (UX-TIMER-10), a device whose
// clock is 90 s fast (P2-STAB-08), the clear rule (P2-STAB-13), the migration from timer.active (the seeded Elizabeth),
// Say it end to end with a stand-in recogniser and the parser (IMP-TIMER-I2), Notify me (GAP-TIMER-1), a kid's own timer and
// its mirror; in Chromium the alert every 15 s on one AudioContext until Stop (GAP-TIMER-2, P3-TIMER-03), the notification
// when hidden with the Timer open (P3-TIMER-04), the digits rounding up and the ring at endAt (P3-TIMER-05) and the app's
// own wake lock (P2-STAB-09).
//   node "audits/tools/phase6/6/timer-a-6.mjs"      -> audits/evidence/p6/6/timer-a-6.json (+ PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { timerRows, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so

const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '6'); fs.mkdirSync(EV, { recursive: true });
let pass = 0, fail = 0; const out = {};
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } out[n] = { pass: !!c, ...(x === undefined ? {} : { got: x }) }; };
const shot = (d, n) => d.page.screenshot({ path: path.join(EV, 'timer-a-' + n + '.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
const until = async (read, pred, label, ms = 15000) => { const t0 = Date.now(); let v; for (;;) { v = await read(); if (pred(v)) return v; if (Date.now() - t0 > ms) { console.log('  … timed out waiting for', label); return v; } await sleep(250); } };
const P = { app: 'timer', scope: 'person' };
const st = f => f.evaluate(() => {
  const q = id => document.getElementById(id), g = q('go');
  return { t: q('t').textContent, go: g.textContent.trim(), goState: g.dataset.state, primary: g.classList.contains('btn-primary'),
    state: q('tstate').hidden ? '' : q('tstate').textContent.trim(), bell: !!document.querySelector('#tstate use[href$="#i-bell"]'), label: q('tlabel').hidden ? '' : q('tlabel').textContent.trim(),
    done: document.body.classList.contains('done'), ask: q('ask').hidden ? null : q('ask-text').textContent,
    below: ['presets', 'ask', 'custom', 'recents', 'say', 'tsettings-btn', 'tsettings'].filter(id => q(id) && q(id).getClientRects().length > 0).concat(document.querySelector('.lab').getClientRects().length ? ['lab'] : []),
    resetVis: getComputedStyle(q('reset')).visibility === 'visible', ended: document.getElementById('ended') ? 'present' : null, list: [...document.querySelectorAll('#list .tm')].length, live: q('live').textContent,
    liveAttr: q('live').getAttribute('aria-live'), pressed: [...document.querySelectorAll('#presets [aria-pressed="true"]')].map(b => b.dataset.s || b.id),
    presetsWithPressed: [...document.querySelectorAll('#presets [data-s]')].filter(b => b.hasAttribute('aria-pressed')).length,
    rows: hub.timers.list(), recents: hub.timers.recents(), audio: window.__audio ? { ...window.__audio } : null, wl: window.__wl || 0, notes: window.__notes || [] };
});
const isLive = f => f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 20000 });
const openTimer = async d => { const f = await d.openApp('timer', { wait: '#go' }); await isLive(f); await sleep(300); return f; };
const flush = f => f.evaluate(async () => { for (let i = 0; i < 40; i++) { try { await hub.flush(); } catch {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 250)); } return false; });
// a stand-in speech recogniser: start() hears whatever window.__say holds
const fakeVoice = ctx => ctx.addInitScript(() => {
  class SR { start() { setTimeout(() => { const t = window.__say || ''; this.onresult && this.onresult({ results: [[{ transcript: t }]] }); this.onend && this.onend(); }, 50); } stop() {} abort() {} }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
});
const notifyAsk = ctx => ctx.addInitScript(() => {
  window.__asked = 0; let perm = 'default';
  try { if (!('Notification' in window)) window.Notification = function () {}; Object.defineProperty(window.Notification, 'permission', { get: () => perm, configurable: true }); window.Notification.requestPermission = () => { window.__asked++; perm = 'granted'; return Promise.resolve('granted'); }; } catch {}
});

// ── WebKit: the screens ────────────────────────────────────────────────────────────────────────────────────────────
let L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  await L.reset('typical');
  console.log('\n## Eli, iPhone: the contract, the calm running screen, New timer, three timers (rescore 6, UX-TIMER-1, GAP-TIMER-3, VIS-TIMER-1)');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await fakeVoice(d.ctx); await notifyAsk(d.ctx);
  let f = await openTimer(d);
  let s = await st(f);
  ok(s.goState === 'start' && s.t === '10:00' && s.pressed.includes('600'), 'idle: the last length (Eli\'s 10 min) is on the dial and pressed', { t: s.t, pressed: s.pressed });
  ok(s.presetsWithPressed === 6 && s.liveAttr === 'polite', 'every preset carries aria-pressed; the countdown has an aria-live region (UX-TIMER-10)', { n: s.presetsWithPressed, live: s.liveAttr });
  const goTop0 = await f.evaluate(() => Math.round(document.getElementById('go').getBoundingClientRect().top));
  await f.click('#go'); await flush(f);
  s = await st(f);
  const r1 = s.rows[0];
  const offer = await f.evaluate(() => ({ shown: document.getElementById('notify-offer').getClientRects().length > 0, goTop: Math.round(document.getElementById('go').getBoundingClientRect().top) }));
  ok(offer.shown && offer.goTop === goTop0, 'the first Start offers "Notify me when it ends" inline (permission undecided), below the list: Start/Pause did not move', { offer, goTop0 });
  await f.click('#notify-offer-no');
  ok(!(await f.isVisible('#notify-offer')), '"Not now" puts it away (it is offered once per device)');
  const srv = await timerRows(L, 'eli');
  const mirror = ((await L.apiAs('eli', '/api/data/timer?scope=family')).body.items || []).find(i => i.key === 'run:eli:' + (r1 && r1.id));
  ok(r1 && r1.total === 600000 && srv.length === 1 && srv[0].key === 'timer:' + r1.id && srv[0].value.endAt === r1.endAt && Math.abs(r1.endAt - Date.now() - 600000) < 5000, 'Start stores timer:<id> {total 600000 ms, endAt in server ms}', srv.map(x => x.value));
  ok(mirror && mirror.value && mirror.value.endAt === r1.endAt, 'the family mirror run:eli:<id> follows (for the Kitchen and the TV)', mirror && mirror.value);
  ok(s.goState === 'pause' && s.primary, 'running: Pause is the primary button (VIS-TIMER-1)', s.go);
  ok(s.below.length === 0 && s.resetVis, `running: nothing below the actions but the list; no preset to tap, so none can replace it (below: ${s.below.join(', ') || 'nothing'})`, s.below);
  await shot(d, 'calm-running-iphone');
  await f.click('#add');
  s = await st(f);
  ok(s.below.includes('presets') && s.goState === 'start' && s.rows.length === 1, 'New timer opens the picker in place; the first keeps running', s.below);
  await f.click('[data-s="180"]'); await f.click('#go');
  s = await st(f);
  ok(s.rows.length === 2 && s.list === 2 && s.below.length === 0, 'Start runs 3:00 beside 10:00; calm again with both in the list', s.rows.map(r => r.total));
  await f.click('#add'); await f.fill('#label', 'pasta'); await f.click('[data-s="900"]'); await f.click('#go');
  s = await st(f);
  ok(s.rows.length === 3 && s.label === 'pasta' && !(await f.isVisible('#add')), 'a third, labelled "pasta"; at three New timer goes', { n: s.rows.length, label: s.label });
  await shot(d, 'three-timers-iphone');
  await f.click('#plus1');
  s = await st(f);
  const pasta = s.rows.find(r => r.label === 'pasta');
  ok(pasta && pasta.total === 960000, '+1 min adds a minute to the timer on the dial', pasta && pasta.total);
  ok(s.recents.length === 3 && new Set(s.recents.map(r => r.total)).size === 3 && s.recents[0].label === 'pasta', 'recents: the last three distinct lengths, newest first, with labels', s.recents);

  console.log('\n## Pause is stored and seen on another device; a device 90 s fast agrees (UX-TIMER-2, P2-STAB-08)');
  await f.click('#go'); await flush(f);
  s = await st(f);
  const paused = s.rows.find(r => r.label === 'pasta');
  const pausedSrv = (await timerRows(L, 'eli')).find(x => x.value.label === 'pasta');
  ok(paused.state === 'paused' && pausedSrv && pausedSrv.value.pausedAt > 0 && pausedSrv.value.endAt === null && pausedSrv.value.remaining > 900000 && /Paused/.test(s.state) && s.goState === 'resume', 'Pause stores {pausedAt, remaining, endAt null}; the dial says Paused; Resume', pausedSrv && pausedSrv.value);
  const fast = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() + 90000 });
  await fast.goto('#home'); await fast.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 20000 });
  const onFast = await until(() => fast.page.evaluate(() => ({ skew: hub.skew, rows: hub.timers.list().map(r => ({ label: r.label, state: r.state, left: r.left })) })), v => v.rows.length === 3, 'iPad rows');
  const p2 = onFast.rows.find(r => r.label === 'pasta'), here = await f.evaluate(() => hub.timers.list().filter(r => r.state === 'running').map(r => r.left));
  const there = onFast.rows.filter(r => r.state === 'running').map(r => r.left);
  ok(p2 && p2.state === 'paused', 'the iPad shows pasta paused, not gone', p2);
  ok(onFast.skew < -85000 && here.length === 2 && there.length === 2 && here.every((x, i) => Math.abs(x - there[i]) < 3000), `the iPad's clock runs 90 s fast (skew ${Math.round(onFast.skew / 1000)} s) and both count the same time left`, { here, there });
  await fast.close();

  console.log('\n## the clear rule (P2-STAB-13)');
  const r3 = s.rows.find(r => r.total === 180000);
  await f.evaluate(([id]) => { const r = hub.timers.get(id); const n = hub.serverNow(); hub.timers.put({ ...r, startedAt: n, endAt: n + 240000, total: 240000 }); }, [r3.id]); await flush(f);
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await B.goto('#home'); await B.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 20000 });
  const refused = await B.page.evaluate(([id, s0]) => hub.timers.clear(id, s0), [r3.id, r3.startedAt]);
  await sleep(600);
  ok(refused === false && (await timerRows(L, 'eli')).some(x => x.key === 'timer:' + r3.id && x.value.total === 240000), 'a device asked to clear the start it saw leaves the newer start alone', refused);
  await B.close();

  console.log('\n## custom time in hours, Say it, Notify me (VIS-TIMER-4, IMP-TIMER-I2, GAP-TIMER-1)');
  { const before = await st(f); const onDial = before.rows.find(r => r.state === 'paused');
    await f.click('#reset');
    const tst = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.trim() : null; });
    await f.click('#hub-toast .toast-act'); await flush(f);
    const after = await st(f), srv = await timerRows(L, 'eli');
    ok(/^pasta timer reset\s*Undo$/i.test(tst || '') && after.rows.some(r => r.id === onDial.id && r.state === 'paused' && r.remaining === onDial.remaining) && srv.some(x => x.key === 'timer:' + onDial.id && x.value.pausedAt > 0) && await f.evaluate(() => document.activeElement.id === 'go'),
      `Reset toasts "${tst}"; Undo puts the paused pasta timer back as it was (on the server too), focus on Resume`, { tst, after: after.rows });
  }
  for (let i = 0; i < 3; i++) { await f.click('#reset'); await sleep(200); }
  await f.click('#custom-btn'); await f.fill('#cm', '125'); await f.fill('#cs', '30'); await f.press('#cs', 'Enter');
  s = await st(f);
  ok(s.t === '2:05:30' && s.goState === 'start', 'custom 125 min 30 s reads 2:05:30 (h:mm:ss)', s.t);
  ok(!(await f.isVisible('#notify')) && await f.isVisible('#tsettings-btn'), 'Sound and Notify me sit in one closed "Timer settings"');
  await f.click('#tsettings-btn');
  ok(await f.isVisible('#notify'), 'Notify me when it ends is offered (in Timer settings) while the browser has not been asked');
  await f.click('#notify'); await sleep(300);
  ok(await f.evaluate(() => window.__asked) === 1 && !(await f.isVisible('#notify')), 'one tap asks the browser once, in context; then it goes');
  await f.click('#tsettings-btn');
  const sayVisible = await f.isVisible('#say');
  ok(sayVisible, 'Say it shows where speech recognition exists');
  await f.evaluate(() => { window.__say = 'pasta 12 minutes'; }); await f.click('#say');
  s = await until(() => st(f), v => !!v.ask, 'voice ask');
  ok(s.ask === 'Start 12:00 for pasta?' && s.rows.length === 0, `"pasta 12 minutes" asks "${s.ask}" before anything starts`, s.ask);
  await f.click('#ask-yes');
  s = await st(f);
  ok(s.rows.length === 1 && s.rows[0].total === 720000 && s.rows[0].label === 'pasta', 'Start: 12:00 labelled pasta', s.rows[0]);
  ok(!(await f.isVisible('#say')), 'Say it is not on the calm running screen');
  await f.click('#add');                     // New timer: the picker (and Say it) again
  await f.evaluate(() => { window.__say = 'add a minute'; }); await f.click('#say');
  s = await until(() => st(f), v => v.rows[0] && v.rows[0].total === 780000, 'add a minute');
  ok(s.rows[0].total === 780000, '"add a minute" adds one minute (no question)', s.rows[0].total);
  const parsed = await f.evaluate(() => ['ten minutes', '1 hour 5 minutes', '90 seconds', 'an hour and a half', 'eggs for 7 minutes', 'what time is it'].map(t => __timer.parse(t)));
  ok(parsed[0].total === 600000 && parsed[1].total === 3900000 && parsed[2].total === 90000 && parsed[3].total === 5400000 && parsed[4].label === 'eggs' && parsed[5] === null, 'the parser: ten minutes, 1 hour 5 minutes, 90 seconds, an hour and a half, eggs for 7 minutes, and no time', parsed);
  await f.click('#list .tm'); await f.click('#reset'); await flush(f);

  console.log('\n## time\'s up in words; a timer that ended unseen; the 10-minute rule (UX-TIMER-4, UX-TIMER-3)');
  const now = Date.now();
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [
    { key: 'timer:bread', value: { id: 'bread', label: 'bread', total: 600000, startedAt: now - 780000, endAt: now - 180000, pausedAt: null, remaining: null, by: 'eli', ackAt: null }, updated_at: now },
    { key: 'timer:tea', value: { id: 'tea', label: 'tea', total: 300000, startedAt: now - 960000, endAt: now - 660000, pausedAt: null, remaining: null, by: 'eli', ackAt: null }, updated_at: now }] } });
  await d.goto('#home'); f = await openTimer(d);
  s = await until(() => st(f), v => v.done, 'unseen done');
  ok(s.done && /^Ended \d{1,2}:\d\d/.test(s.state) && s.bell && s.goState === 'ok' && s.go === 'OK' && s.primary && !s.resetVis && s.ended === null,
    `ended unseen 3 min ago: said once, on the dial ("${s.state}" with the bell), the main button OK; no separate line, no Reset`, s);
  ok(s.below.length === 0, 'ringing: nothing below the actions but the list', s.below);
  await shot(d, 'ended-unseen-iphone');
  const tea = await until(() => timerRows(L, 'eli'), v => !v.some(x => x.key === 'timer:tea'), 'tea swept');
  ok(!tea.some(x => x.key === 'timer:tea') && tea.some(x => x.key === 'timer:bread'), 'the one ended 11 min ago is cleared (10-minute rule); the 3-minute one stays until Stop', tea.map(x => x.key));
  await f.click('#go'); await sleep(800);
  ok((await timerRows(L, 'eli')).length === 0 && !(await st(f)).done, 'OK clears it in the house');
  await d.close();

  console.log('\n## the migration (the park variant keeps Elizabeth\'s old timer.active) and a kid\'s own timer');
  await L.reset('park');   // seed/timer.mjs: park is the variant that still seeds timer.active
  const before = ((await L.apiAs('mom', '/api/data/timer?scope=person')).body.items || []).find(i => i.key === 'timer.active');
  const m = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  const fm = await openTimer(m); await flush(fm); await sleep(500);
  const momRows = await timerRows(L, 'mom'), momLegacy = ((await L.apiAs('mom', '/api/data/timer?scope=person')).body.items || []).find(i => i.key === 'timer.active');
  ok(before && before.value && momRows.length === 1 && momRows[0].value.id === 'm' + Math.round(before.value.startedAt) && momRows[0].value.total === before.value.total * 1000 && (!momLegacy || momLegacy.value === null),
    'the seeded timer.active becomes timer:m<startedAt> (total in ms) and timer.active is removed', { before: before && before.value, after: momRows.map(x => x.value) });
  await m.close();
  // the deploy window (review round 1): an old device writes timer.active while a timer: row already runs; the app still moves it
  const n2 = Date.now(), legacy2 = { endAt: n2 + 300000, total: 420, startedAt: n2 - 120000 };
  await L.apiAs('mom', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: legacy2, updated_at: n2 }] } });
  const m2 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  const fm2 = await openTimer(m2); await flush(fm2); await sleep(500);
  const both = await timerRows(L, 'mom'), legacyLeft = ((await L.apiAs('mom', '/api/data/timer?scope=person')).body.items || []).find(i => i.key === 'timer.active');
  const shown2 = await fm2.evaluate(() => hub.timers.list().map(r => r.id));
  ok(both.length === 2 && both.some(x => x.value.id === 'm' + legacy2.startedAt && x.value.total === 420000) && (!legacyLeft || legacyLeft.value === null) && shown2.includes('m' + legacy2.startedAt),
    'a timer.active written beside a running timer: row is still moved (timer:m<startedAt>) and shows', { rows: both.map(x => x.value.id), shown: shown2 });
  await m2.close();
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false }); await fakeVoice(k.ctx);   // speech exists, so a hidden Say it is the kid rule
  const fk = await openTimer(k);
  const kidIdle = { say: await fk.isVisible('#say'), settings: await fk.isVisible('#tsettings-btn') };
  await fk.click('[data-s="60"]'); await fk.click('#go'); await flush(fk); await sleep(300);
  ok(!kidIdle.say && !kidIdle.settings && !(await fk.isVisible('#add')) && !(await fk.isVisible('#notify-offer')), 'a kid gets no Say it, no Timer settings, no New timer and no inline Notify me', kidIdle);
  const kRows = await timerRows(L, 'ezra'), kMirror = ((await L.apiAs('ezra', '/api/data/timer?scope=family')).body.items || []).filter(i => /^run:ezra:/.test(i.key) && i.value);
  ok(kRows.length === 1 && kMirror.length === 1 && kMirror[0].value.endAt === kRows[0].value.endAt, 'Ezra starts his own timer; its mirror run:ezra:<id> is accepted', { rows: kRows.length, mirror: kMirror.length });
  await k.close();
} catch (e) { ok(false, 'WebKit part ran to the end', String(e && e.stack || e).slice(0, 600)); }
finally { await closeRig(L); }

// ── Chromium: sound, notification, rounding, wake lock ─────────────────────────────────────────────────────────────
L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  console.log('\n## Chromium: the alert repeats every 15 s on one AudioContext until Stop (GAP-TIMER-2, P3-TIMER-03)');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(() => {
    window.__audio = { made: 0, osc: 0 }; const R = window.AudioContext;
    if (R) window.AudioContext = window.webkitAudioContext = class extends R { constructor(...a) { super(...a); window.__audio.made++; } createOscillator(...a) { window.__audio.osc++; return super.createOscillator(...a); } };
    window.__wl = 0; try { if (navigator.wakeLock) { const q = navigator.wakeLock.request.bind(navigator.wakeLock); navigator.wakeLock.request = (...a) => { window.__wl++; return q(...a); }; } } catch {}
    window.__notes = [];
    try { Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true }); const reg = { showNotification: (t, o) => { window.__notes.push(t + ' / ' + (o && o.body)); return Promise.resolve(); } }; navigator.serviceWorker.getRegistration = () => Promise.resolve(reg); } catch {}
  });
  const f = await openTimer(d);
  await f.click('[data-s="60"]');
  const t0 = Date.now(); await f.click('#go');
  await sleep(Math.max(0, 600 - (Date.now() - t0)));
  ok((await st(f)).t === '1:00', '0.6 s after Start it still reads 1:00 (Math.ceil, P3-TIMER-05)');
  ok((await st(f)).wl >= 1, 'the Timer asked for the screen wake lock itself (P2-STAB-09)', (await st(f)).wl);
  // bring the end near and hide the page through it (the Timer open, as on a desktop with the tab in the background)
  const endAt = await f.evaluate(() => { const r = hub.timers.list()[0]; const e = hub.serverNow() + 4000; hub.timers.put({ ...r, endAt: e, total: 4000 }); return e; });
  for (const fr of d.page.frames()) await fr.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
  const done = await until(() => f.evaluate(() => ({ done: document.body.classList.contains('done'), at: hub.serverNow(), osc: window.__audio.osc, made: window.__audio.made, notes: window.__notes.length })), v => v.done, 'done', 12000);
  ok(done.done && done.at >= endAt, `time's up at or after endAt, never before (${done.at - endAt} ms after)`, done);
  const shellNotes = await d.page.evaluate(() => window.__notes.length);
  ok(done.notes + shellNotes === 1, 'hidden at 0 with the Timer open: one "Timer done" notification (P3-TIMER-04)', { app: done.notes, shell: shellNotes });
  for (const fr of d.page.frames()) await fr.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
  const a1 = await f.evaluate(() => ({ ...window.__audio }));
  await sleep(16000);
  const a2 = await f.evaluate(() => ({ ...window.__audio }));
  ok(a1.osc > 0 && a2.osc > a1.osc && a2.made === 1, `it rings, and again 15 s later, on one AudioContext (notes ${a1.osc} → ${a2.osc}, contexts ${a2.made})`, { a1, a2 });
  await f.click('#go');
  const a3 = await f.evaluate(() => window.__audio.osc); await sleep(16000);
  ok(await f.evaluate(() => window.__audio.osc) === a3 && !(await st(f)).done, 'Stop: no more rings');
  await d.close();
} catch (e) { ok(false, 'Chromium part ran to the end', String(e && e.stack || e).slice(0, 600)); }
finally { await closeRig(L); }

fs.writeFileSync(path.join(EV, 'timer-a-6.json'), JSON.stringify({ pass, fail, out }, null, 1));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
