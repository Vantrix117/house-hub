// Two of Eli's devices, both with the Kitchen timer open (local rig, WebKit, typical seed, real clock, the app's own 30 s pull).
//  S1 start on the phone -> how long until the iPad shows it
//  S2 pause on the phone at ~T-? -> what the iPad shows (the paused time, or the full preset?)
//  S3 resume/start on the iPad, Reset on the phone -> what the iPad shows (any notice?)
// Run: node "audits/tools/phase3/timer/sync2.mjs"   (about 2.5 min)   Output: audits/evidence/p3/timer/sync2.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, serverTimer } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const until = async (fn, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return { v, ms: Date.now() - t0 }; await sleep(250); } return { v: null, ms: null }; };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('timer', { wait: '#go' }); const fp = await phone.openApp('timer', { wait: '#go' });
  await sleep(2500);
  out.initial = { ipad: await appState(fi), phone: await appState(fp) };
  // S1
  await fp.click('[data-s="600"]'); await fp.click('#go'); const t1 = Date.now();
  const seen = await until(async () => { const s = await appState(fi); return s.go === 'Pause' ? s : null; }, 40000);
  out.S1 = { ipadSawStartAfterMs: seen.ms, ipad: seen.v, phone: await appState(fp) };
  // S2 — pause on the phone
  await sleep(4000);
  await fp.click('#go'); const pausedAt = await appState(fp);
  const seen2 = await until(async () => { const s = await appState(fi); return s.go === 'Start' ? s : null; }, 40000);
  out.S2 = { phonePaused: pausedAt, ipadAfterMs: seen2.ms, ipad: seen2.v, server: await serverTimer(L, 'eli') };
  out.S2.shots = [await shot(phone.page, 'sync2-phone-paused.png'), await shot(ipad.page, 'sync2-ipad-after-phone-pause.png')];
  // S3 — start on the iPad, Reset on the phone
  await fi.click('#go'); await sleep(1500);
  const seen3 = await until(async () => { const s = await appState(fp); return s.go === 'Pause' ? s : null; }, 40000);
  await sleep(2000);
  const before = { ipad: await appState(fi), phone: await appState(fp) };
  await fp.click('#reset');
  const seen4 = await until(async () => { const s = await appState(fi); return s.go === 'Start' ? s : null; }, 40000);
  out.S3 = { phoneSawIpadStartMs: seen3.ms, before, ipadAfterPhoneResetMs: seen4.ms, ipad: seen4.v,
    ipadToast: await ipad.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }), server: await serverTimer(L, 'eli') };
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('sync2.json', out));
