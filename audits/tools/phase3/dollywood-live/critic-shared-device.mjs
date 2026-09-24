// Completeness critic: on one shared device, the park map's last fix and the family trails are device-wide, not per person.
//  1. Mom (Share my spot OFF: "Only you see your dot") taps Find me on a family phone at the Great Tree Swing.
//  2. Me -> Switch -> Kiara (kids open on tap; her beacon is off, so she is view-only and never locates). Kiara opens the park map on the same phone.
//  What does Kiara's map show as "you"? (LIVE_KEY 'dollywood.live.last' at :1162 is not keyed by profile; restored at :1478.)
//  Also dumps the device-wide trails key (TRAIL_KEY, :1591-1593): other people's recent positions kept in localStorage.
// Park seed (Mom's Share is switched off first through the app's own switch). Real clock, WebKit. Local instance only.
// Run: node "audits/tools/phase3/dollywood-live/critic-shared-device.mjs"
import { local, sleep, save, shot, openMap, latLon, pill } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  // Mom's share is ON in the park seed; switch it off first through the app's own switch so "only you see your dot" applies.
  const nd = await L.newDevice({ name: 'Family phone', profiles: ['mom', 'kiara'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.goto('#home'); await sleep(1500);
  let f = await openMap(d, { settle: 2500 });
  await d.ctx.setGeolocation({ ...(await latLon(f, 842, 858)), accuracy: 6 });
  await f.click('#lv-family').catch(() => {}); await sleep(800);
  const shareWasOn = await f.evaluate(() => shareOn());
  if (shareWasOn) { await f.evaluate(() => { const c = document.getElementById('lv-share'); c.click(); }); await sleep(1500); }
  out.A_momShareOn = await f.evaluate(() => shareOn());
  await f.evaluate(() => document.getElementById('loc-btn').click());
  await sleep(5000);
  out.A_momPill = await pill(f);
  out.A_serverLocMom = await (async () => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'loc:mom'); return it ? (it.value == null ? 'tombstone' : { x: it.value.x, y: it.value.y }) : 'absent'; })();
  out.A_liveKey = await f.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('dollywood.live.last')); return { x: Math.round(l.x), y: Math.round(l.y), src: l.src }; } catch { return null; } });
  out.A_trailsKeyPeople = await f.evaluate(() => { try { const t = JSON.parse(localStorage.getItem('dollywood.live.trails') || '{}'); return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { points: v.length, oldestAgeMin: Math.round((Date.now() - Math.min(...v.map(p => p[2]))) / 60000) }])); } catch { return null; } });

  // 2. Switch to Kiara through the shell (Me -> Switch -> tap Kiara)
  await d.goto('#me'); await sleep(1500);
  await d.page.click('#switch'); await sleep(1500);
  await d.page.click('.pcard[data-id="kiara"]'); await sleep(2500);
  out.B_signedInAs = await d.page.evaluate(() => hub.profile && hub.profile.id);
  f = await openMap(d, { settle: 3000 });
  out.B_kiaraView = await f.evaluate(() => ({ profile: hub.profile.id, viewOnly: VIEW_ONLY(), me: me ? { x: Math.round(me.x), y: Math.round(me.y), src: me.src, stale: !!me.stale } : null, youDotDrawn: !!document.querySelector('.me-dot') }));
  out.B_kiaraPill = await pill(f);
  out.B_kiaraNearbyFirst = await f.evaluate(() => { const b = document.querySelector('#near-list .lv-item'); return b ? b.innerText.replace(/\s+/g, ' ').trim().slice(0, 120) : document.getElementById('near-list').innerText.slice(0, 160); });
  await shot(d, 'critic-shared-device-kiara-iphone.png');
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-shared-device.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
