// Skeptic #1 for "prayed-name-match": does a guest named like a kid earn that kid a prayed star?
//   node "audits/tools/phase3/kidverse/verify-prayed-name-match-1.mjs"
// Control first: Kiara opens Kid Verse so any already-pending prayed credits are consumed. Then Mom adds a guest
// "Kiara" with the same POST the Me -> Add a guest sheet sends (index.html:1418), the guest taps Prayed on one
// family card in the Prayer app, and the real Kiara reopens Kid Verse. Kiara herself never touches Prayer.
import fs from 'node:fs'; import path from 'node:path';
import { local, sleep, row, stars, flushed, pulled, EVID, log } from './_kv.mjs';
const pad = n => String(n).padStart(2, '0');
const today = (() => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })();
const out = { today };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const openKV = async () => { const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false }); const f = await d.openApp('kidverse', { wait: '#story' }); await pulled(f); await sleep(1500); await flushed(f); return d; };
  let d = await openKV(); await d.close();
  const c0 = await row(L, 'kiara', 'person', 'stars');
  out.control = { total: c0.value.total, earned: c0.value.earned, prayedToday: c0.value.credited.prayed[today] || null };
  // what lists name Kiara today before the guest acts
  const pl0 = await L.apiAs('mom', '/api/data/prayer?scope=family');
  out.kiaraInPrayedByBefore = (pl0.body.items || []).filter(r => r.key.startsWith('prayer:') && r.value && r.value.prayedBy && (r.value.prayedBy[today] || []).includes('Kiara')).map(r => r.key);
  const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Kiara', emoji: '🌷', color: '#8A6A4B' } });
  const gid = g.body.profile.id; out.guest = { status: g.status, id: gid, name: g.body.profile.name, kind: g.body.profile.kind };
  const lg = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: gid } });
  const gd = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false, as: { device: L.S.info.device, sessions: { [gid]: lg.body.profile_token } } });
  const pf = await gd.openApp('prayer', { wait: '[data-list="shared"]' }); await sleep(1200);
  await pf.click('[data-list="shared"]'); await sleep(800);
  const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-pray]')].find(x => x.getAttribute('aria-pressed') !== 'true' && x.offsetParent); return b ? b.dataset.pray : null; });
  out.guestWho = await pf.evaluate(() => hub.profile && { id: hub.profile.id, name: hub.profile.name, kind: hub.profile.kind });
  await pf.click(`[data-pray="${target}"]`); await sleep(1200); out.guestFlushed = await flushed(pf);
  const pr = await row(L, 'mom', 'family', 'prayer:' + target, 'prayer');
  out.prayerRow = { key: 'prayer:' + target, prayedByToday: pr && pr.value.prayedBy && pr.value.prayedBy[today] };
  await gd.close();
  d = await openKV();
  const c1 = await row(L, 'kiara', 'person', 'stars');
  out.after = { total: c1.value.total, earned: c1.value.earned, prayedToday: c1.value.credited.prayed[today] || null, earnedAtPrayed: c1.value.earnedAt['prayed:' + today] || null };
  out.mirrorAfter = (await stars(L, 'kiara')).mirror;
  const f = path.join(EVID, 'verify-prayed-name-match-1-kiara-after.png'); await d.page.screenshot({ path: f, scale: 'css' }); out.shot = f;
  await d.close();
} finally { await L.close(); }
log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(EVID, 'verify-prayed-name-match-1.json'), JSON.stringify(out, null, 1));
