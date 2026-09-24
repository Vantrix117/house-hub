// STAB skeptic #2 for "timer-cleared-by-sleeping-device": a device that slept through a timer's end, then wakes more than
// 60 s later, clears timer.active silently (index.html:804-812). Is that a bug, by design, or worse than claimed?
//   node "audits/tools/phase2/STAB/verify3-timer-cleared-by-sleeping-device-2.mjs"        (about 7 minutes, real clock, WebKit)
//
// Three of Elizabeth's ('mom') devices, each its own paired device with its own session, all against the local Worker:
//   C  Kitchen iPad   real clock, Timer app open — starts every countdown through the UI (preset chip, Start)
//   A  Mom's phone    real clock, Home tab — the shell pill
//   B  Mom's iPad     installed Playwright clock; "sleeps" = document.hidden true + visibilitychange, clock paused
//                     (no timers, no pulls); "wakes" = clock.fastForward to real now (timers due fire once, the
//                     documented lid-closed analogue), resume, document.hidden false + visibilitychange.
// Instrumented in every frame: AudioContext constructions (= beeps), #hub-toast texts (MutationObserver, not clock-driven),
// and local notifications (Notification.permission reads 'granted', navigator.serviceWorker.getRegistration returns a
// stub whose showNotification records the call — the rig blocks service workers and is plain http).
//   Phase 1 — the candidate as written: C starts 1 min, A and B show the pill, B sleeps, the timer ends, B wakes 66 s later.
//   Phase 2 — the same, but Mom starts a NEW 3-minute timer on C 5 s after the first one ended, before B wakes: does B's
//             stale clear (stamped at wake time) overwrite the newer timer under last-write-wins (worker/src/data.js:60)?
// Output: audits/evidence/p2/STAB/verify3-timer-cleared-by-sleeping-device-2.json (+ 1x PNGs with the same prefix)
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
import { settle, shot1x, track } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const TAG = 'verify3-timer-cleared-by-sleeping-device-2';
fs.mkdirSync(OUT, { recursive: true });
const R = { engine: 'webkit', clock: 'real', steps: [] };
const T0 = Date.now();
const log = (k, v) => { const e = { t: ((Date.now() - T0) / 1000).toFixed(1), k, v }; R.steps.push(e); console.log(e.t.padStart(6), k.padEnd(52), JSON.stringify(v)); };
const until = async ms => { const w = ms - Date.now(); if (w > 0) await sleep(w); };

function instrument() {
  const top = window.top === window;
  const rec = () => { try { return window.top.__rec || (window.top.__rec = { beeps: [], toasts: [], notes: [] }); } catch { return null; } };
  const where = () => (top ? 'shell' : location.pathname.split('/').pop());
  try {
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { try { return !!window.top.__rigHidden; } catch { return false; } } });
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { try { return window.top.__rigHidden ? 'hidden' : 'visible'; } catch { return 'visible'; } } });
  } catch {}
  const AC = window.AudioContext || window.webkitAudioContext;
  const W = function (...a) { const r = rec(); if (r) r.beeps.push({ at: Date.now(), where: where() }); if (AC) return new AC(...a); throw new Error('no audio'); };
  if (AC) W.prototype = AC.prototype;
  window.AudioContext = W; window.webkitAudioContext = W;
  if (top) {
    try { if (!('Notification' in window)) window.Notification = function () {}; Object.defineProperty(window.Notification, 'permission', { configurable: true, get: () => 'granted' }); } catch {}
    try {
      const stubReg = { showNotification: async (title, o) => { const r = rec(); if (r) r.notes.push({ at: Date.now(), title, body: o && o.body }); } };
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration = async () => stubReg;
      else Object.defineProperty(Navigator.prototype, 'serviceWorker', { configurable: true, get: () => ({ register: () => new Promise(() => {}), getRegistration: async () => stubReg, addEventListener() {}, ready: new Promise(() => {}), controller: null }) });
    } catch {}
    let last = '';
    new MutationObserver(() => {
      const el = document.getElementById('hub-toast'); const txt = el && !el.hidden ? el.textContent : '';
      if (txt && txt !== last) { const r = rec(); if (r) r.toasts.push({ at: Date.now(), text: txt }); }
      last = txt;
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  }
}

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const mk = name => L.newDevice({ name, profiles: ['mom'] });
  const [dA, dB, dC, chk] = [await mk('Mom phone'), await mk('Mom iPad'), await mk('Kitchen iPad'), await mk('Checker')];
  const server = async () => {
    const r = await L.apiAs(null, '/api/data/timer?scope=person', { deviceToken: chk.device.token, profileToken: chk.sessions.mom });
    const it = (r.body.items || []).find(i => i.key === 'timer.active');
    return { now: r.body.now, value: it ? it.value : '(no row)', updated_at: it ? it.updated_at : null };
  };
  const A = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: dA });
  const C = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: dC });
  const B = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: Date.now(), as: dB });
  const writes = { A: [], B: [], C: [] };
  for (const [n, d] of Object.entries({ A, B, C })) {
    await d.ctx.addInitScript(instrument);
    track(d);
    d.page.on('request', r => { if (/\/api\/data\/timer\/batch/.test(r.url())) { try { writes[n].push({ at: Date.now(), items: JSON.parse(r.postData()).items }); } catch {} } });
    d.page.on('response', async r => { if (/\/api\/data\/timer\/batch/.test(r.url())) { try { const j = await r.json(); writes[n].push({ at: Date.now(), response: j.results }); } catch {} } });
  }
  await A.goto('#home'); await A.page.waitForSelector('#view-home .card');
  await B.goto('#home'); await B.page.waitForSelector('#view-home .card');
  const f = await C.openApp('timer', { wait: '#go' });
  await settle(A, { min: 800 }); await settle(B, { min: 800 }); await settle(C, { min: 800 });

  const pill = d => d.page.evaluate(() => { const p = document.getElementById('timer-pill'); return p.hidden ? null : document.getElementById('timer-pill-time').textContent; });
  const rec = d => d.page.evaluate(() => window.__rec || { beeps: [], toasts: [], notes: [] });
  const between = (arr, a, b) => arr.filter(x => x.at >= a && x.at <= b);
  const alerts = async (d, a, b) => { const r = await rec(d); return { beeps: between(r.beeps, a, b), toasts: between(r.toasts, a, b).map(x => x.text), notes: between(r.notes, a, b).map(x => x.body) }; };
  const appState = async () => ({ t: await f.evaluate(() => document.getElementById('t').textContent), go: await f.evaluate(() => document.getElementById('go').textContent), done: await f.evaluate(() => document.body.classList.contains('done')) });
  const glance = async d => { await d.page.evaluate(() => { window.__rigHidden = false; document.dispatchEvent(new Event('visibilitychange')); }); await settle(d, { min: 600 }); };
  const sleepB = async () => {
    await B.page.evaluate(() => { window.__rigHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    const bNow = await B.page.evaluate(() => Date.now());
    await B.ctx.clock.pauseAt(new Date(bNow + 400));
    return { bClockAtSleep: bNow, realAtSleep: Date.now(), skewS: await B.page.evaluate(() => Math.round((hub.skew || 0) / 1000)) };
  };
  const wakeB = async () => {
    const bNow = await B.page.evaluate(() => Date.now());
    const delta = Date.now() - bNow;
    await B.ctx.clock.fastForward(Math.max(1, delta));
    await B.ctx.clock.resume();
    await B.page.evaluate(() => { window.__rigHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(400); await settle(B, { min: 1500 });
    return { sleptForS: Math.round(delta / 1000), bClockNowMinusReal: (await B.page.evaluate(() => Date.now())) - Date.now() };
  };
  const startOnC = async preset => { await f.click(`[data-s="${preset}"]`); await f.click('#go'); await settle(C, { min: 800 }); const s = await server(); return s; };

  // ── Phase 1: the candidate as written ──────────────────────────────────────────────────────────
  const s1 = await startOnC(60); const E1 = s1.value.endAt;
  log('P1 C starts 1 min in the Timer app → server', { endAtInS: Math.round((E1 - s1.now) / 1000), updated_at: s1.updated_at });
  await glance(A); await glance(B);
  log('P1 A pill / B pill after a pull', { A: await pill(A), B: await pill(B) });
  log('P1 B sleeps', await sleepB());
  await until(E1 + 4000);
  log('P1 at end+4 s: A (Home) alerts', await alerts(A, E1 - 2000, E1 + 4000));
  log('P1 at end+4 s: C (Timer app) alerts', await alerts(C, E1 - 2000, E1 + 4000));
  log('P1 at end+4 s: server timer.active', await server());
  await until(E1 + 66000);
  const w1 = Date.now();
  log('P1 B wakes 66 s after the end', await wakeB());
  log('P1 B alerts on wake (beep / toast / notification)', await alerts(B, w1 - 1000, Date.now()));
  log('P1 B pill after wake', await pill(B));
  log('P1 B timer writes on wake', writes.B.filter(x => x.at >= w1));
  log('P1 server timer.active after B woke', await server());
  log('P1 A pill after B woke (already gone at end)', await pill(A));
  await shot1x(B, path.join(OUT, `${TAG}-p1-B-after-wake.png`));

  // ── Phase 2: a newer timer exists when B wakes ─────────────────────────────────────────────────
  const s2 = await startOnC(60); const E2 = s2.value.endAt;
  log('P2 C starts 1 min (T2) → server', { endAtInS: Math.round((E2 - s2.now) / 1000), updated_at: s2.updated_at });
  await glance(A); await glance(B);
  log('P2 A pill / B pill after a pull (B now holds T2 in its cache)', { A: await pill(A), B: await pill(B) });
  log('P2 B sleeps', await sleepB());
  await until(E2 + 4000);
  log('P2 T2 end+4 s: A alerts', await alerts(A, E2 - 2000, E2 + 4000));
  log('P2 T2 end+4 s: C alerts', await alerts(C, E2 - 2000, E2 + 4000));
  await until(E2 + 5000);
  const s3 = await startOnC(180); const E3 = s3.value.endAt;
  log('P2 T2 end+5 s: Mom starts a 3-min timer (T3) on C → server', { value: s3.value, updated_at: s3.updated_at, endAtInS: Math.round((E3 - s3.now) / 1000) });
  await glance(A);
  log('P2 A pill (T3) / C app', { A: await pill(A), C: await appState() });
  await shot1x(A, path.join(OUT, `${TAG}-p2-A-T3-pill-before-B-wakes.png`));
  await until(E2 + 66000);
  log('P2 server just before B wakes', await server());
  const w2 = Date.now();
  log('P2 B wakes 66 s after T2 ended (T3 still has ~2 min)', await wakeB());
  log('P2 B alerts on wake', await alerts(B, w2 - 1000, Date.now()));
  log('P2 B timer writes on wake (request + server results)', writes.B.filter(x => x.at >= w2));
  const sAfter = await server();
  log('P2 server after B woke', { ...sAfter, T3updated_at: s3.updated_at, T3msLeft: E3 - sAfter.now });
  log('P2 immediately after: A pill / C app', { A: await pill(A), C: await appState() });
  // A and C pick it up on their normal 30 s poll (no nudging)
  const w2p = Date.now();
  let seen = null;
  while (Date.now() < w2p + 34000) { await sleep(1000); const p = await pill(A), c = await appState(); if (!seen && (p === null || c.go === 'Start')) seen = { afterS: Math.round((Date.now() - w2p) / 1000), A: p, C: c }; }
  log('P2 within one poll: first moment A/C changed', seen);
  log('P2 A pill / C app after one poll', { A: await pill(A), C: await appState(), serverT3LeftS: Math.round((E3 - Date.now()) / 1000) });
  await shot1x(A, path.join(OUT, `${TAG}-p2-A-after-poll.png`));
  await shot1x(C, path.join(OUT, `${TAG}-p2-C-after-poll.png`));
  await until(E3 + 6000);
  log('P2 T3 end+6 s: A alerts in [T3 end−3 s, +6 s]', await alerts(A, E3 - 3000, E3 + 6000));
  log('P2 T3 end+6 s: B alerts', await alerts(B, E3 - 3000, E3 + 6000));
  log('P2 T3 end+6 s: C alerts', await alerts(C, E3 - 3000, E3 + 6000));
  log('P2 T3 end+6 s: server / A pill / C app', { server: await server(), A: await pill(A), C: await appState() });
  await shot1x(C, path.join(OUT, `${TAG}-p2-C-at-T3-end.png`));
  R.allWrites = writes;
  R.logs = Object.fromEntries(Object.entries({ A, B, C }).map(([n, d]) => [n, d.logs.filter(l => /error/i.test(l)).slice(0, 6)]));
  R.track = Object.fromEntries(Object.entries({ A, B, C }).map(([n, d]) => [n, { failed: d._track.failed, failedUrls: d._track.failedUrls }]));
} catch (e) { R.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
  await L.close();
}
