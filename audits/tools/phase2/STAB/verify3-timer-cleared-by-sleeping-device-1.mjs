// STAB skeptic #1: "A device that wakes after a timer ended clears it silently … which also removes the pill on the
// person's other devices." Does it really happen as described, and what does the silent clear actually break?
//
//   node "audits/tools/phase2/STAB/verify3-timer-cleared-by-sleeping-device-1.mjs"     (about 7 minutes, real clock)
//
// Local rig only (typical seed, WebKit, real clock). Two (then three) paired devices signed in as Elizabeth (mom):
//   A  = Mom's iPad, awake on Home the whole time (real clock).
//   B  = Mom's iPhone (Home Screen app) with a Playwright-installed clock so it can be "slept" like iOS freezes a
//        backgrounded PWA: document.hidden = true + visibilitychange, then the clock is paused (no timers run).
//        Wake = clock set to the real now, hidden = false + visibilitychange, clock resumed.
//   C  = Mom's laptop (phase 3), whose page is closed and later reopened (cold start of the hub) instead of slept.
// Every timer is started through the real UI on A (Apps → Kitchen timer → preset → Start → Home).
// Beeps = AudioContext constructions in the top window (the shell's timerBeep, index.html:788-796); toasts = #hub-toast
// polled every 200 ms; pill = #timer-pill polled every 200 ms. Server = GET /api/data/timer?scope=person&key=timer.active.
//   Phase 1  the candidate as written: timer ends while B sleeps, A stays open; B wakes 70 s after the end.
//   Phase 2  same, but A has started a NEW 10 min timer before B wakes (e.g. pasta done → sauce timer).
//   Phase 3  same as phase 2, with C cold-reopened instead of B woken.
// Evidence: audits/evidence/p2/STAB/verify3-timer-cleared-by-sleeping-device-1*.png and …-1.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const NAME = 'verify3-timer-cleared-by-sleeping-device-1';
const R = { steps: [], evidence: {} };
const t0 = Date.now();
const log = (k, v) => { R.steps.push({ s: Math.round((Date.now() - t0) / 1000), k, v }); console.log(String(Math.round((Date.now() - t0) / 1000)).padStart(4), k.padEnd(70), typeof v === 'string' ? v : JSON.stringify(v)); };
const shot = async (page, name) => { const f = path.join(OUT, `${NAME}-${name}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); R.evidence[name] = path.relative(ROOT, f); return f; };
const until = async t => { const w = t - Date.now(); if (w > 0) await sleep(w); };
const L = await local({ variant: 'typical', clock: 'real' });

const instrument = ctx => ctx.addInitScript(() => {
  // a controllable page-visibility state (the rig cannot background a WebKit page)
  Object.defineProperty(Document.prototype, 'hidden', { get() { return !!window.__rigHidden; }, configurable: true });
  Object.defineProperty(Document.prototype, 'visibilityState', { get() { return window.__rigHidden ? 'hidden' : 'visible'; }, configurable: true });
  if (window.top !== window) return;
  window.__beeps = 0; window.__toasts = []; window.__pill = []; window.__removes = [];
  const A = window.AudioContext || window.webkitAudioContext;
  window.__audioNative = typeof A;
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  const W = A ? class extends A { constructor(...a) { window.__beeps++; super(...a); } }
              : class { constructor() { window.__beeps++; this.currentTime = 0; this.destination = {}; } createOscillator() { return node(); } createGain() { return node(); } };
  window.AudioContext = W; window.webkitAudioContext = W;
  let last = '', lastPill = null;
  setInterval(() => {
    const t = document.getElementById('hub-toast'); const s = t && !t.hidden ? t.textContent : '';
    if (s && s !== last) window.__toasts.push({ at: Date.now(), text: s }); last = s;
    const p = document.getElementById('timer-pill'); const vis = !!(p && !p.hidden);
    const key = vis + '|' + (vis ? p.textContent.trim().slice(0, 1) : '');
    if (key !== lastPill) { window.__pill.push({ at: new Date(Date.now()).toISOString().slice(11, 19), visible: vis, text: vis ? p.textContent.trim() : '' }); lastPill = key; }
  }, 200);
  // record every write of timer.active made by this window (who cleared what, stamped when)
  const wrap = () => {
    if (!window.hub || !hub.set || hub.__wrapped) return;
    const set = hub.set; hub.__wrapped = true;
    hub.set = (k, v, o) => {
      let prev = null; try { prev = hub.get(k, o); } catch {}
      const r = set(k, v, o);
      if (k === 'timer.active') window.__removes.push({ at: Date.now(), value: v, prevEndAt: prev && prev.endAt, visible: !document.hidden });
      return r;
    };
  };
  const iv = setInterval(() => { wrap(); if (window.hub && hub.__wrapped) clearInterval(iv); }, 5);
});
const state = page => page.evaluate(() => ({
  beeps: window.__beeps, toasts: window.__toasts.map(t => t.text), pillVisible: !document.getElementById('timer-pill').hidden,
  pillText: document.getElementById('timer-pill').hidden ? '' : document.getElementById('timer-pill').textContent.trim(),
  localTimer: (window.hub && hub.get('timer.active', { app: 'timer', scope: 'person' })) || null,
  writes: window.__removes.map(w => ({ at: new Date(w.at).toISOString().slice(11, 23), value: w.value, prevEndAt: w.prevEndAt })),
}));

async function startTimer(d, secs) {
  const { page } = d;
  await page.locator('.tab[data-tab="apps"]').first().click();
  await page.waitForSelector('#grid .tile[data-id="timer"]');
  await page.locator('#grid .tile[data-id="timer"]').first().click();
  let f; for (let i = 0; i < 100 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForSelector(`#presets [data-s="${secs}"]`); await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(800);
  await f.click(`#presets [data-s="${secs}"]`); await f.click('#go'); await sleep(500);
  await page.locator('#pill-home').first().click(); await sleep(400);
  await page.locator('.tab[data-tab="home"]').first().click(); await sleep(600);
  await page.evaluate(() => hub.flush());
  return page.evaluate(() => (hub.get('timer.active', { app: 'timer', scope: 'person' }) || {}).endAt);
}
const waitShell = page => page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'mom', null, { timeout: 20000 });

async function sleepB(B) {
  await B.page.evaluate(() => { window.__rigHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  const now = await B.page.evaluate(() => Date.now());
  await B.ctx.clock.pauseAt(now + 50);
}
async function wakeB(B) {
  await B.ctx.clock.setSystemTime(Date.now());
  await B.page.evaluate(() => { window.__rigHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await B.ctx.clock.resume();
}

try {
  const reader = await L.newDevice({ name: 'Reader (API only)', profiles: ['mom'] });
  const devA = await L.newDevice({ name: "Mom's iPad", profiles: ['mom'] });
  const devB = await L.newDevice({ name: "Mom's iPhone", profiles: ['mom'] });
  const devC = await L.newDevice({ name: "Mom's laptop", profiles: ['mom'] });
  const server = async () => { const r = await L.apiAs(null, '/api/data/timer?scope=person&key=timer.active', { deviceToken: reader.device.token, profileToken: reader.sessions.mom }); const it = r.body && r.body.item; return it ? { value: it.value, updated_at: it.updated_at } : null; };

  const A = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: devA });
  const B = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: Date.now(), as: devB });
  const C = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false, as: devC });
  for (const d of [A, B, C]) await instrument(d.ctx);
  for (const d of [A, B, C]) { await d.goto('#home'); await waitShell(d.page); }
  await sleep(1500);
  const b0 = await B.page.evaluate(() => Date.now()); await sleep(2000); const b1 = await B.page.evaluate(() => Date.now());
  log('rig: B installed clock flows naturally before sleep (ms over 2 s)', b1 - b0);
  log('rig: AudioContext native in engine (A / B)', [await A.page.evaluate(() => window.__audioNative), await B.page.evaluate(() => window.__audioNative)]);

  // ── Phase 1: the candidate as written ──
  const end1 = await startTimer(A, 60);
  await B.page.evaluate(() => hub.pull()); await sleep(800);
  log('P1 timer1 (1 min) started on A; ends', new Date(end1).toISOString());
  log('P1 B pill after pull (before sleep)', (await state(B.page)).pillText);
  await sleepB(B);
  log('P1 B asleep (hidden + clock paused)', true);
  await until(end1 + 4000);
  log('P1 A at end+4 s: beeps / toasts / pill', await state(A.page));
  log('P1 server at end+4 s', await server());
  await until(end1 + 70000);
  const srvBeforeWake1 = await server();
  log('P1 server just before B wakes (end+70 s)', srvBeforeWake1);
  await wakeB(B);
  await sleep(4000);
  log('P1 B after waking at end+70 s: beeps / toasts / pill / writes', await state(B.page));
  log('P1 server after B woke', await server());
  log('P1 A after B woke (no pill to lose; no new alert)', await state(A.page));
  await shot(B.page, 'p1-B-after-wake');

  // ── Phase 2: a newer timer exists when B wakes ──
  await sleep(2000);
  const end1b = await startTimer(A, 60);
  await B.page.evaluate(() => hub.pull()); await sleep(800);
  log('P2 timer1b (1 min) started on A; ends', new Date(end1b).toISOString());
  log('P2 B pill after pull (before sleep)', (await state(B.page)).pillText);
  await sleepB(B);
  await until(end1b + 4000);
  const aAtEnd = await state(A.page);
  log('P2 A at end+4 s: beeps / toasts (A alerted and cleared timer1b)', { beeps: aAtEnd.beeps, toasts: aAtEnd.toasts, pill: aAtEnd.pillVisible });
  const end2 = await startTimer(A, 600);
  log('P2 A starts timer2 (10 min) at end1b+' + Math.round((Date.now() - end1b) / 1000) + ' s; ends', new Date(end2).toISOString());
  log('P2 server after timer2 started', await server());
  await until(end1b + 70000);
  log('P2 A just before B wakes (timer2 running)', (await state(A.page)).pillText);
  await shot(A.page, 'p2-A-before-B-wakes');
  log('P2 server just before B wakes', await server());
  const beepsA = (await state(A.page)).beeps, toastsA = (await state(A.page)).toasts.length;
  await wakeB(B);
  await sleep(4000);
  const bAfter = await state(B.page);
  log('P2 B after waking: beeps / toasts / pill / writes', bAfter);
  log('P2 server 4 s after B woke', await server());
  await shot(B.page, 'p2-B-after-wake');
  let aGone = null;
  for (let i = 0; i < 70; i++) { const s = await state(A.page); if (!s.pillVisible) { aGone = Math.round((Date.now() - end1b) / 1000); break; } await sleep(500); }
  const aAfter = await state(A.page);
  log('P2 A: timer2 pill gone at end1b+N s (null = still there after 35 s)', aGone);
  log('P2 A after: pill / local timer.active / new beeps / new toasts', { pill: aAfter.pillVisible, localTimer: aAfter.localTimer, newBeeps: aAfter.beeps - beepsA, newToasts: aAfter.toasts.slice(toastsA) });
  log('P2 A pill log', await A.page.evaluate(() => window.__pill.slice(-6)));
  log('P2 timer2 seconds still to run when it vanished', Math.round((end2 - Date.now()) / 1000));
  await shot(A.page, 'p2-A-after-B-wakes');

  // ── Phase 3: cold reopen (laptop page closed during timer, reopened after a newer timer started) ──
  await sleep(1500);
  const end3 = await startTimer(A, 60);
  await C.page.evaluate(() => hub.pull()); await sleep(800);
  log('P3 timer3 (1 min) started on A; ends / C pill before close', [new Date(end3).toISOString(), (await state(C.page)).pillText]);
  await C.page.close();
  await until(end3 + 4000);
  const end4 = await startTimer(A, 600);
  log('P3 A starts timer4 (10 min) at end3+' + Math.round((Date.now() - end3) / 1000) + ' s; server', await server());
  await until(end3 + 70000);
  const beepsA3 = (await state(A.page)).beeps;
  const cp = await C.ctx.newPage();
  await cp.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await waitShell(cp);
  await sleep(4000);
  log('P3 C reopened at end3+70 s: beeps / toasts / pill / writes', await state(cp));
  log('P3 server 4 s after C reopened', await server());
  let aGone3 = null;
  for (let i = 0; i < 70; i++) { const s = await state(A.page); if (!s.pillVisible) { aGone3 = Math.round((Date.now() - end3) / 1000); break; } await sleep(500); }
  const a3 = await state(A.page);
  log('P3 A: timer4 pill gone at end3+N s (null = still there)', aGone3);
  log('P3 A after: pill / new beeps / timer4 seconds left', { pill: a3.pillVisible, newBeeps: a3.beeps - beepsA3, secondsLeft: Math.round((end4 - Date.now()) / 1000) });
  await shot(A.page, 'p3-A-after-C-reopens');
  R.logsA = A.logs.slice(-10); R.logsB = B.logs.slice(-10);
} catch (e) {
  log('ERROR', String(e && e.stack || e));
} finally {
  fs.writeFileSync(path.join(OUT, NAME + '.json'), JSON.stringify(R, null, 1));
  await L.close();
}
