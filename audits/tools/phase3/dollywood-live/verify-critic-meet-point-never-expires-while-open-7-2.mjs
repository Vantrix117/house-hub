// Skeptic #2 for critic-meet-point-never-expires-while-open-7: does the meeting-point bar (#lv-meet) keep a >2 h old meet
// and a frozen "N min ago" while the map stays open? And is it mitigated when another family device changes a row?
// loadMeet (apps/dollywood-live.html:1579) applies the 2 h rule; it is called from loadFam (:1256) and at start (:1483);
// the 30 s timer (:1484) runs drawFam/renderFam only. hub.onChange fires only for other devices' rows (hub.js:206-209, 298).
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const P = 'verify-critic-meet-point-never-expires-while-open-7-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.goto('#home'); await sleep(1500);
  const f = await openMap(d, { settle: 2500 });
  const bar = () => f.evaluate(() => ({ barHidden: document.getElementById('lv-meet').hidden, name: document.getElementById('meet-name').textContent,
    meta: document.getElementById('meet-meta').textContent, pinDrawn: !!document.querySelector('.lv-meetpin'),
    realAgeMin: MEET ? Math.round((Date.now() - MEET.at) / 60000) : null, syncState: hub.sync && hub.sync.state }));
  out.A_atOpen = await bar();
  // 1) 45 min later: the age should read ~57 min ago
  await d.ctx.clock.fastForward('00:45:00'); await sleep(35000);
  out.B_after45min = await bar();
  // 2) 2 h 10 min after open: past the 2 h expiry
  await d.ctx.clock.fastForward('01:25:00'); await sleep(35000);
  out.C_after2h10 = await bar();
  await shot(d, P + '-iphone.png');
  // 3) mitigation: another family member's loc row changes (what a sharing phone does every few seconds at the park)
  const now = Date.now();
  const w = await L.apiAs('christian', '/api/data/dollywood-live/loc:christian?scope=family', { method: 'PUT',
    body: { value: { x: 700, y: 1000, acc: 8, hdg: null, t: now, name: 'Mae', emoji: '🌻', color: '#8A6A4B' }, updated_at: now } });
  out.D_maeLocWrite = { status: w.status, applied: w.body && w.body.applied };
  await sleep(40000);   // one 30 s pull
  out.D_afterOtherDeviceLocChange = await bar();
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(P + '.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
