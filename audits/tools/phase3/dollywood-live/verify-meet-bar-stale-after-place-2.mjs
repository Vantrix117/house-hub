// Skeptic #2 for finding "meet-bar-stale-after-place": after Set my spot (hand place) or a first GPS fix, does the
// meeting-point bar show the walk time and Go? And does it really "self-heal on the next 30 s sync" with no remote change?
//  A. Eli places a spot by hand (no GPS). Bar read at once, then after 40 s with no other device writing anything,
//     then after Mom's phone writes a loc: row through the API (a remote family change -> hub.onChange -> loadFam -> loadMeet).
//  B. A fresh Eli device with geolocation granted taps the locate button: bar after the first real GPS fix, and after 40 s.
// Run: node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, EV, openMap, putAt, grant, pill } from './_lib.mjs';
const P = 'verify-meet-bar-stale-after-place-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const bar = f => f.evaluate(() => { const b = document.getElementById('lv-meet'); return { hidden: b.hidden, name: document.getElementById('meet-name').textContent, meta: document.getElementById('meet-meta').textContent, goHidden: document.getElementById('meet-go').hidden, me: (typeof me !== 'undefined' && me) ? { src: me.src, x: Math.round(me.x), y: Math.round(me.y) } : null, sync: hub.sync.state }; });
const shot = async (d, n) => { const p = path.join(EV, `${P}-${n}.png`); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); console.log('shot', p); };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  out.A0_beforePlace = await bar(f);
  await f.click('#lv-family').catch(() => {});
  await f.click('#loc-near'); await sleep(300);
  await f.click('#loc-place'); await sleep(400);
  await f.click('#lv-act'); await sleep(1500);   // "I'm here"
  out.A1_pillAfterPlace = await pill(f);
  out.A1_barAfterPlace = await bar(f);
  await shot(d, 'A1-after-place');
  await sleep(40000);                            // > one 30 s pull cycle, nobody else writes
  out.A2_barAfter40sNoRemote = await bar(f);
  await shot(d, 'A2-after-40s-no-remote');
  // another family member's phone publishes its spot (what happens constantly on a real park day with sharing on)
  const r = await L.apiAs('mom', '/api/data/dollywood-live/batch?scope=family', { method: 'POST', body: { items: [{ key: 'loc:mom', value: { x: 700, y: 800, acc: 8, hdg: null, t: Date.now(), name: 'Elizabeth', emoji: '', color: '#888' }, updated_at: Date.now() }] } });
  out.A3_momWrite = { status: r && r.status, applied: r && r.body && r.body.results ? r.body.results.map(x => x.applied) : r };
  let healedAt = null; const t0 = Date.now();
  for (let i = 0; i < 45; i++) { await sleep(1000); const b = await bar(f); if (!b.goHidden) { healedAt = Math.round((Date.now() - t0) / 1000); break; } }
  out.A3_barAfterRemoteWrite = { ...(await bar(f)), healedAfterSeconds: healedAt };
  await shot(d, 'A3-after-remote-write');

  // B. GPS path on a fresh device
  const ph = await L.newDevice({ name: 'Eli phone 2', profiles: ['eli'] });
  const g = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await grant(g, L.site);
  await g.goto('#home'); await sleep(1200);
  const fg = await openMap(g, { settle: 2000 });
  await putAt(g, fg, 762, 842, 6);
  out.B0_barBeforeLocate = await bar(fg);
  const btn = await fg.$('#loc-btn'); if (btn) await btn.click().catch(() => {});
  await sleep(4000);
  out.B1_pill = await pill(fg);
  out.B1_barAfterGpsFix = await bar(fg);
  for (let i = 0; i < 10; i++) { await putAt(g, fg, 762 + i * 3, 842 + i * 3, 6); await sleep(4000); }   // 40 s of walking
  out.B2_barAfter40sWalking = await bar(fg);
  await shot(g, 'B2-gps-after-40s');
  out.code = {
    setMe_1245: 'drawMe();updLoc();renderNear();renderFam();publish(); -- no renderMeet',
    renderMeet_callers: 'only loadMeet :1579, setMeet :1587, clearMeet :1588',
    loadMeet_callers: 'liveInit :1483 and loadFam :1256 (loadFam runs on hub.onChange for family loc:/meet/kid rows, :1483)',
    onChange: 'hub.js emit :206 fires only for rows another device changed (pullScope :286-300)',
    interval_1484: 'setInterval(()=>{drawFam();renderFam()},30000) -- no loadMeet',
  };
} catch (e) { out.error = String(e && e.stack || e); console.error(e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
