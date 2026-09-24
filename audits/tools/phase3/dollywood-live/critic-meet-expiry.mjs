// Completeness critic: the meeting point's 2 h expiry and its "set by … N min ago" age are applied only in loadMeet (:1579),
// which runs at start and when another device changes a family row (:1256, :1483). The 30 s timer redraws only the family
// (:1484). So with the map left open and no family change, the pin and bar outlive the 2 h rule and the age never moves.
// Park seed (Mae set the meeting point 12 min ago), a Playwright clock so 2 h can pass, WebKit, Eli on iPhone PWA.
// Run: node "audits/tools/phase3/dollywood-live/critic-meet-expiry.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.goto('#home'); await sleep(1500);
  const f = await openMap(d, { settle: 2500 });
  const bar = () => f.evaluate(() => ({ barHidden: document.getElementById('lv-meet').hidden, name: document.getElementById('meet-name').textContent, meta: document.getElementById('meet-meta').textContent, pinDrawn: !!document.querySelector('.lv-meetpin'), meetAgeMin: MEET ? Math.round((Date.now() - MEET.at) / 60000) : null }));
  out.A_atOpen = await bar();
  await d.ctx.clock.fastForward('02:10:00');
  await sleep(40000);   // real time: past the 30 s family redraw and a hub pull
  out.B_after2h10 = await bar();
  out.B_serverMeetAt = await (async () => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'meet'); return it && it.value ? { name: it.value.name, at: it.value.at } : null; })();
  await shot(d, 'critic-meet-expiry-iphone.png');
  // control: the same page after a reload applies the 2 h rule
  await d.goto('#home'); await sleep(1200);
  const f2 = await openMap(d, { settle: 2500 });
  out.C_afterReopen = await f2.evaluate(() => ({ barHidden: document.getElementById('lv-meet').hidden, pinDrawn: !!document.querySelector('.lv-meetpin') }));
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-meet-expiry.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
