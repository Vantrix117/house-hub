// PROF skeptic #1 — finding "switch-silences-kitchen-timer": re-run from scratch on a fresh local instance.
//   node "audits/tools/phase2/PROF/verify-switch-silences-kitchen-timer-1.mjs" [chromium]     (about 5 minutes, real clock; default WebKit)
//
// Kitchen iPad (WebKit, ipad-portrait), Eli signed in. Three phases, all driven through the UI (Timer app: 1 min → Start):
//   P1 control  — Eli stays signed in: does the shell beep + toast at 0 and clear the row?  (proves the counters work here)
//   P2 claim    — Eli starts a timer, Me → Switch → Ezra. Pill? beeps/toasts at 0? server row? Then, > 60 s after the end,
//                 Ezra → Switch → Eli (PIN pad): does Eli get any beep/toast, and is the row cleared silently?
//   P3 nuance   — same, but Eli comes back within 60 s of the end: does it ring late?
// Beeps = AudioContext constructions in the top frame; toasts = #hub-toast text seen by a 100 ms poll.
// Server state is read through a separate checker device with its own Eli session (the iPad's logout cannot revoke it).
// Evidence: audits/evidence/p2/PROF/verify-switch-timer-1-<engine>.json (+ two PNGs).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [] };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v)); };
const PIN = '4826';
const ENGINE = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
console.log('engine', ENGINE);
try {
  // Give Eli a PIN this script knows (admin reset with the rig session, then create it through the real route).
  const rs = await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} });
  const cp = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: PIN } });
  log('setup: Eli PIN reset / created', `${rs.status} / ${cp.status}`);
  const ipadAs = { device: L.S.info.device, sessions: { eli: cp.body.profile_token } };
  const checker = await L.newDevice({ name: 'Checker', profiles: ['eli'] });
  const serverTimer = async () => {
    const r = await L.apiAs(null, '/api/data/timer?scope=person&key=timer.active', { deviceToken: checker.device.token, profileToken: checker.sessions.eli });
    const it = r.body && r.body.item; return { status: r.status, set: !!(it && it.value), value: it ? it.value : null };
  };

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: ipadAs });
  const { page } = ipad;
  await ipad.ctx.addInitScript(() => {
    if (window.top !== window) return;
    window.__hasAudio = !!(window.AudioContext || window.webkitAudioContext);
    window.__beeps = []; window.__toasts = [];
    // WebKit on Windows has no AudioContext: stand in a silent one so a beep attempt is still counted
    const A = window.AudioContext || window.webkitAudioContext || class { constructor() { this.currentTime = 0; this.destination = {}; } createOscillator() { return { connect() {}, frequency: {}, start() {}, stop() {} }; } createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; } };
    if (A) { const W = class extends A { constructor(...a) { super(...a); window.__beeps.push(Date.now()); } }; window.AudioContext = W; window.webkitAudioContext = W; }
    let last = '';
    setInterval(() => { const t = document.getElementById('hub-toast'); const s = t && !t.hidden ? t.textContent : ''; if (s && s !== last) window.__toasts.push({ at: Date.now(), text: s }); last = s; }, 100);
  });
  const counters = () => page.evaluate(() => ({ hasAudio: window.__hasAudio, beeps: window.__beeps.length, toasts: window.__toasts.map(t => t.text) }));
  const who = () => page.evaluate(() => window.hub && hub.profile && hub.profile.id);
  const pill = () => page.locator('#timer-pill').isVisible();
  const tap = sel => page.locator(sel).first().click();
  const waitShell = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 20000 });
  const localTimer = pid => page.evaluate(p => { try { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.' + p)); const it = c && c.items && c.items['timer.active']; return it ? (it.v == null ? 'tombstone' : it.v) : null; } catch (e) { return 'err ' + e.message; } }, pid);

  async function startTimer() {
    await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="timer"]');
    await tap('#grid .tile[data-id="timer"]');
    let f; for (let i = 0; i < 80 && !(f = ipad.frame('timer')); i++) await sleep(100);
    await f.waitForSelector('#presets [data-s="60"]'); await sleep(800);
    await f.click('#presets [data-s="60"]'); await f.click('#go'); await sleep(500);
    await tap('#pill-home'); await sleep(600);                 // leave the app (viewer closes, iframe → about:blank)
    await tap('.tab[data-tab="home"]'); await sleep(300);
    const a = await page.evaluate(() => hub.get('timer.active', { app: 'timer', scope: 'person' }));
    return a;
  }
  async function switchTo(id) {
    await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
    await page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 20000 });
    await tap(`#profiles .pcard[data-id="${id}"]`);
    if (id === 'eli') { await page.waitForSelector('#pad'); for (const d of PIN) await tap(`#pad [data-d="${d}"]`); await tap('#pingo'); }
    await waitShell(id);
  }
  const shot1x = async n => { const f = path.join(OUT, n); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return f; };
  const untilPast = async (t, extra) => { const w = t + extra - Date.now(); if (w > 0) await sleep(w); };

  await ipad.goto('#home');
  await waitShell('eli'); await page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 });
  log('iPad signed in as', await who());
  log('AudioContext available in this engine', String((await counters()).hasAudio));

  // ── P1 control: Eli stays signed in ──
  let c0 = await counters();
  const a1 = await startTimer();
  log('P1 Eli timer started (endAt, total)', `${new Date(a1.endAt).toISOString()} ${a1.total}s  pill=${await pill()}`);
  log('P1 server row after start', await serverTimer());
  await untilPast(a1.endAt, 6000);
  let c1 = await counters();
  log('P1 at end+6 s: beeps / toasts since start', { beeps: c1.beeps - c0.beeps, toasts: c1.toasts.slice(c0.toasts.length) });
  log('P1 pill visible after the end', String(await pill()));
  await sleep(2500);
  log('P1 server row after the end', await serverTimer());

  // ── P2 claim: Eli starts a timer, switches to Ezra, returns > 60 s after the end ──
  c0 = await counters();
  const a2 = await startTimer();
  log('P2 Eli timer started (endAt)', `${new Date(a2.endAt).toISOString()}  pill=${await pill()}`);
  await sleep(2500);
  log('P2 server row after start (flushed?)', await serverTimer());
  await switchTo('ezra');
  log('P2 now signed in as / pill visible', `${await who()} / ${await pill()}`);
  log('P2 Ezra: hub.get timer.active in the shell', await page.evaluate(() => hub.get('timer.active', { app: 'timer', scope: 'person' }) || null));
  log('P2 localStorage: Eli cache still holds timer.active', await localTimer('eli'));
  await untilPast(a2.endAt, 8000);
  c1 = await counters();
  log('P2 at end+8 s under Ezra: beeps / toasts since start', { beeps: c1.beeps - c0.beeps, toasts: c1.toasts.slice(c0.toasts.length) });
  log('P2 at end+8 s: pill visible', String(await pill()));
  log('P2 at end+8 s: server row (Eli timer.active)', await serverTimer());
  R.evidence = { ezraAfterEnd: path.relative(ROOT, await shot1x('verify-switch-timer-1-' + ENGINE + '-ezra-after-end.png')) };
  await untilPast(a2.endAt, 66000);
  const cBack = await counters();
  await switchTo('eli');
  log('P2 Eli back at end+' + Math.round((Date.now() - a2.endAt) / 1000) + ' s, signed in as', await who());
  await sleep(4000);
  const c2 = await counters();
  log('P2 Eli back (>60 s): beeps / toasts since his return', { beeps: c2.beeps - cBack.beeps, toasts: c2.toasts.slice(cBack.toasts.length) });
  log('P2 Eli back: pill visible', String(await pill()));
  log('P2 Eli back: server row', await serverTimer());
  R.evidence.eliBack = path.relative(ROOT, await shot1x('verify-switch-timer-1-' + ENGINE + '-eli-back.png'));

  // ── P3 nuance: Eli returns within 60 s of the end ──
  c0 = await counters();
  const a3 = await startTimer();
  log('P3 Eli timer started (endAt)', new Date(a3.endAt).toISOString());
  await sleep(2000);
  await switchTo('ezra');
  await untilPast(a3.endAt, 8000);
  c1 = await counters();
  log('P3 at end+8 s under Ezra: beeps / toasts since start', { beeps: c1.beeps - c0.beeps, toasts: c1.toasts.slice(c0.toasts.length) });
  await switchTo('eli');
  const late = Math.round((Date.now() - a3.endAt) / 1000);
  await sleep(4000);
  const c3 = await counters();
  log('P3 Eli back at end+' + late + ' s: beeps / toasts since Ezra', { beeps: c3.beeps - c1.beeps, toasts: c3.toasts.slice(c1.toasts.length) });
  log('P3 server row', await serverTimer());
  R.logs = ipad.logs.filter(l => /error/i.test(l)).slice(-15);
  fs.writeFileSync(path.join(OUT, 'verify-switch-timer-1-' + ENGINE + '.json'), JSON.stringify(R, null, 1));
  console.log('evidence:', R.evidence, 'errors:', R.logs);
} finally { await L.close(); }
