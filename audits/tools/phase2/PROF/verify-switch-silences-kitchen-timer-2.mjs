// PROF skeptic #2: does switching people on the shared Kitchen iPad hide a running kitchen timer so it never rings?
//
//   node "audits/tools/phase2/PROF/verify-switch-silences-kitchen-timer-2.mjs"      (about 4 minutes, real clock)
//
// Local rig only (typical seed, WebKit, real clock). Every timer is started through the real UI (Apps → Kitchen timer →
// 1 min → Start → Home). Beeps are counted as AudioContext constructions in the top window (the shell's timerBeep,
// index.html:788-796); toasts by polling #hub-toast every 200 ms; the pill by polling #timer-pill every 250 ms.
//   Phase 1  Kitchen iPad: Eli starts 1 min, Me → Switch → Ezra (the claim).
//            Control iPad (same moment, a second paired iPad): David starts 1 min and stays signed in — proves the
//            beep/toast counters work in this engine.
//            Then, 65 s after Eli's timer ended, Eli signs back in on the Kitchen iPad with his PIN (the "silent clear").
//   Phase 2  Mitigation check: Eli's phone has the hub open on Home (foreground) while the Kitchen iPad starts a 1 min
//            timer for Eli and switches to Ezra. Does the phone ring instead?
// Eli's PIN is reset by the admin and re-created through the real /api/profiles/eli/pin route at the start so the
// script knows it (the reset also revokes the rig's Eli session, so the iPad gets the fresh token from that route).
// Evidence: audits/evidence/p2/PROF/verify-switch-timer-2*.png and verify-switch-timer-2.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [], evidence: {} };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k.padEnd(62), typeof v === 'string' ? v : JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); R.evidence[name] = path.relative(ROOT, f); return f; };
const PIN = '2468';
const L = await local({ variant: 'typical', clock: 'real' });

const instrument = ctx => ctx.addInitScript(() => {
  if (window.top !== window) return;
  window.__beeps = 0; window.__toasts = []; window.__pill = [];
  // count every attempt to build an AudioContext (the shell's timerBeep), before the real constructor runs — it may be
  // missing or throw in the rig's WebKit; if missing, a silent stub with the calls timerBeep makes stands in
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
    const who = window.hub && hub.profile ? hub.profile.id : null;
    const key = vis + '|' + who;
    if (key !== lastPill) { window.__pill.push({ at: Date.now(), visible: vis, who, text: vis ? p.textContent.trim() : '' }); lastPill = key; }
  }, 200);
});
const state = d => d.page.evaluate(() => ({ profile: window.hub && hub.profile && hub.profile.id, beeps: window.__beeps, audioNative: window.__audioNative, toasts: window.__toasts.map(t => t.text), pillVisible: !document.getElementById('timer-pill').hidden }));

async function startOneMinute(d) {
  const { page } = d;
  await page.locator('.tab[data-tab="apps"]').first().click();
  await page.waitForSelector('#grid .tile[data-id="timer"]');
  await page.locator('#grid .tile[data-id="timer"]').first().click();
  let f; for (let i = 0; i < 100 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForSelector('#presets [data-s="60"]'); await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(800);
  await f.click('#presets [data-s="60"]'); await f.click('#go'); await sleep(500);
  await page.locator('#pill-home').first().click(); await sleep(600);
  return page.evaluate(() => (hub.get('timer.active', { app: 'timer', scope: 'person' }) || {}).endAt);
}
const waitShell = (d, id) => d.page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 20000 });
async function switchTo(d, id, pin) {
  const { page } = d;
  await page.locator('.tab[data-tab="me"]').first().click(); await page.waitForSelector('#switch'); await page.locator('#switch').click();
  await page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 15000 });
  await page.locator(`#profiles .pcard[data-id="${id}"]`).click();
  if (pin) { await page.waitForSelector('#pad'); for (const c of pin) await page.locator(`#pad [data-d="${c}"]`).click(); await page.locator('#pingo').click(); }
  await waitShell(d, id);
}
const until = async t => { const w = t - Date.now(); if (w > 0) await sleep(w); };

try {
  // ── setup ──
  const rp = await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} });
  const cp = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: PIN } });
  log('setup: Eli PIN reset / re-created via real routes', `${rp.status} / ${cp.status}`);
  const eliSession = { token: cp.body.profile_token, profile: cp.body.profile };
  const reader = await L.newDevice({ name: 'Reader (API only)', profiles: ['eli', 'dad'] });
  const ctrlDev = await L.newDevice({ name: 'Control iPad', profiles: ['dad'] });
  const serverTimer = async pid => { const r = await L.apiAs(null, '/api/data/timer?scope=person&key=timer.active', { deviceToken: reader.device.token, profileToken: reader.sessions[pid] }); const it = r.body && r.body.item; return it && it.value ? it.value : null; };

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'hub.session': eliSession } });
  const ctrl = await L.device({ device: 'ipad-portrait', profile: 'dad', fixedTime: false, as: ctrlDev });
  await instrument(ipad.ctx); await instrument(ctrl.ctx);
  await ipad.goto('#home'); await ctrl.goto('#home');
  await waitShell(ipad, 'eli'); await waitShell(ctrl, 'dad');
  await sleep(1500);

  // ── Phase 1 ──
  const eliEnd = await startOneMinute(ipad);
  const dadEnd = await startOneMinute(ctrl);
  log('P1 Kitchen iPad (Eli) timer ends / pill visible', `${new Date(eliEnd).toISOString()} / ${(await state(ipad)).pillVisible}`);
  log('P1 Control iPad (David) timer ends / pill visible', `${new Date(dadEnd).toISOString()} / ${(await state(ctrl)).pillVisible}`);
  await sleep(1500);
  log('P1 server: Eli timer.active / David timer.active', { eli: await serverTimer('eli'), dad: await serverTimer('dad') });

  await switchTo(ipad, 'ezra');
  await sleep(1500);
  const afterSwitch = await ipad.page.evaluate(() => ({
    profile: hub.profile.id, kind: document.documentElement.dataset.kind, tab: document.documentElement.dataset.tab,
    pillVisible: !document.getElementById('timer-pill').hidden,
    shellSeesTimer: hub.get('timer.active', { app: 'timer', scope: 'person' }) || null,
    eliCacheStillHasTimer: (() => { try { return !!JSON.parse(localStorage.getItem('hub.cache.timer.person.eli')).items['timer.active']; } catch (e) { return 'unreadable: ' + e.message; } })(),
  }));
  log('P1 Kitchen iPad after Me → Switch → Ezra', { ...afterSwitch, eliSecondsLeft: Math.round((eliEnd - Date.now()) / 1000) });
  await ipad.page.locator('.tab[data-tab="home"]').first().click(); await sleep(800);
  await shot(ipad, 'verify-switch-timer-2-a-ezra-home-while-eli-timer-runs.png');
  log('P1 Kitchen iPad (Ezra, Home) pill visible, Eli seconds left', `${(await state(ipad)).pillVisible}, ${Math.round((eliEnd - Date.now()) / 1000)} s`);

  await until(dadEnd + 1200);
  await shot(ctrl, 'verify-switch-timer-2-b-control-david-at-zero.png');
  await until(eliEnd + 1200);
  await shot(ipad, 'verify-switch-timer-2-c-kitchen-ezra-at-eli-zero.png');
  await until(Math.max(eliEnd, dadEnd) + 6000);
  const k1 = await state(ipad), c1 = await state(ctrl);
  log('P1 CONTROL David iPad at 0 (+6 s): beeps / toasts', { beeps: c1.beeps, toasts: c1.toasts, audioContextInEngine: c1.audioNative });
  log('P1 CLAIM Kitchen iPad (Ezra) at Eli 0 (+6 s): beeps / toasts', { beeps: k1.beeps, toasts: k1.toasts, pillVisible: k1.pillVisible });
  log('P1 Kitchen iPad pill log', await ipad.page.evaluate(() => window.__pill.map(p => ({ t: new Date(p.at).toISOString().slice(11, 19), ...p, at: undefined }))));
  log('P1 server after 0: Eli timer.active / David timer.active', { eli: await serverTimer('eli'), dad: await serverTimer('dad') });

  // Eli comes back 65 s after his timer ended
  await until(eliEnd + 65000);
  const beepsBefore = (await state(ipad)).beeps, toastsBefore = (await state(ipad)).toasts.length;
  await switchTo(ipad, 'eli', PIN);
  await sleep(3000);
  const back = await state(ipad);
  log('P1 Eli back on the Kitchen iPad (+65 s after 0)', { secondsSinceEnd: Math.round((Date.now() - eliEnd) / 1000), newBeeps: back.beeps - beepsBefore, newToasts: back.toasts.slice(toastsBefore), pillVisible: back.pillVisible });
  await sleep(1500);
  log('P1 server after Eli returns: Eli timer.active', await serverTimer('eli'));
  await ipad.page.locator('.tab[data-tab="home"]').first().click(); await sleep(600);
  await shot(ipad, 'verify-switch-timer-2-d-eli-back-no-sign.png');
  await ctrl.close();

  // ── Phase 2: Eli's phone open in the foreground ──
  const phDev = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev });
  await instrument(phone.ctx);
  await phone.goto('#home'); await waitShell(phone, 'eli'); await sleep(1500);
  const end2 = await startOneMinute(ipad);
  log('P2 Kitchen iPad (Eli) second 1 min timer ends', new Date(end2).toISOString());
  await switchTo(ipad, 'ezra');
  await until(end2 - 5000);
  log('P2 phone pill 5 s before 0 (after its 30 s pulls)', (await state(phone)).pillVisible);
  await until(end2 + 6000);
  const p2 = await state(phone), k2 = await state(ipad);
  log('P2 Eli phone (foreground Home) at 0 (+6 s): beeps / toasts', { beeps: p2.beeps, toasts: p2.toasts });
  log('P2 Kitchen iPad (Ezra) at 0 (+6 s): beeps / toasts since load', { beeps: k2.beeps, toasts: k2.toasts });
  await sleep(1500);
  log('P2 server: Eli timer.active', await serverTimer('eli'));
  R.logs = { ipad: ipad.logs.slice(-15), phone: phone.logs.slice(-10) };
  fs.writeFileSync(path.join(OUT, 'verify-switch-timer-2.json'), JSON.stringify(R, null, 1));
  console.log('evidence:', R.evidence);
} finally { await L.close(); }
