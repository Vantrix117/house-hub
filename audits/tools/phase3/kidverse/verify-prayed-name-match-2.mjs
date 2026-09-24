// Skeptic 2 for "prayed-name-match": Kid Verse credits a prayed star when the kid's DISPLAY NAME is in a family prayer
// row's prayedBy[today] (apps/kidverse.html:427-434, 474). Prayer writes hub.profile.name (apps/prayer.html:1596-1603).
//   node "audits/tools/phase3/kidverse/verify-prayed-name-match-2.mjs"
// Case A (fresh instance): Mom adds a guest named "Kiara" (the same POST body Me -> Add a guest sends, index.html:1418);
//   the guest signs in on tap, opens Prayer, switches to the family list and taps one Prayed. The real Kiara never prays.
//   Then the real Kiara opens Kid Verse. Does she get a prayed star for today?
//   Control inside A: before the guest's tap, Kiara opens Kid Verse once: no prayed credit for today.
// Case B (fresh instance): the admin renames Kiara to "Kiki" (PUT /api/admin/profiles/kiara, what Me -> Admin -> Edit
//   calls). Kiara (now Kiki) taps Prayed in the Prayer app, then opens Kid Verse. Is today still credited?
//   (tests the finding's side claim "Renaming a kid breaks the match for future days").
import { local, sleep, log, stars, saveJson, row, pulled, flushed } from './_kv.mjs';

const pad = n => String(n).padStart(2, '0');
const dk = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const out = { today: dk(0) };

async function openKV(L, profile) {
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#story' }); await pulled(f); await sleep(2000); await flushed(f);
  const who = await f.evaluate(() => hub.profile && hub.profile.name);
  await d.close();
  const r = await row(L, profile, 'person', 'stars');
  return { who, total: r && r.value.total, earned: r && r.value.earned, prayedToday: r ? (r.value.credited.prayed[dk(0)] || null) : null };
}
async function prayedByToday(L) {
  const r = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const items = (r.body.items || []).filter(i => i.key.startsWith('prayer:') && i.value && i.value.prayedBy);
  return items.map(i => ({ key: i.key, today: i.value.prayedBy[dk(0)] || null })).filter(x => x.today);
}

// Case A
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    out.A_prayedByTodayAtStart = await prayedByToday(L);
    out.A_control = await openKV(L, 'kiara');
    const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Kiara', emoji: '🌷', color: '#8A6A4B', expires_at: null } });
    const gid = g.body.profile.id;
    const lg = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: gid } });
    out.A_guest = { status: g.status, id: gid, name: g.body.profile.name, kind: g.body.profile.kind, loginStatus: lg.status };
    const gd = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false, as: { device: L.S.info.device, sessions: { [gid]: lg.body.profile_token } } });
    const pf = await gd.openApp('prayer', { wait: '[data-list="shared"]' }); await sleep(1500);
    out.A_guestHubName = await pf.evaluate(() => hub.profile.name + ' / ' + hub.profile.id);
    await pf.click('[data-list="shared"]'); await sleep(900);
    const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-pray]')].find(x => x.getAttribute('aria-pressed') !== 'true' && x.offsetParent); return b ? b.dataset.pray : null; });
    await pf.click(`[data-pray="${target}"]`); await sleep(1500); await flushed(pf);
    await gd.close();
    out.A_prayedByTodayAfterGuestTap = await prayedByToday(L);
    out.A_after = await openKV(L, 'kiara');
    const fam = await row(L, 'eli', 'family', 'stars:kiara');
    out.A_mirrorPrayedToday = fam ? (fam.value.credited.prayed[dk(0)] || null) : null;
  } finally { await L.close(); }
}
// Case B
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ren = await L.apiAs('eli', '/api/admin/profiles/kiara', { method: 'PUT', body: { name: 'Kiki' } });
    out.B_rename = { status: ren.status };
    out.B_before = await openKV(L, 'kiara');
    const kd = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const pf = await kd.openApp('prayer', { wait: '[data-kpray]' }); await sleep(1500);
    const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(x => x.getAttribute('aria-pressed') !== 'true'); return b ? b.dataset.kpray : null; });
    await pf.click(`[data-kpray="${target}"]`); await sleep(1200); await flushed(pf);
    await kd.close();
    out.B_prayedByToday = await prayedByToday(L);
    out.B_after = await openKV(L, 'kiara');
  } finally { await L.close(); }
}
log('A start prayedBy[today]', JSON.stringify(out.A_prayedByTodayAtStart));
log('A control (Kiara opens KV before guest)', JSON.stringify(out.A_control));
log('A guest', JSON.stringify(out.A_guest), out.A_guestHubName);
log('A prayedBy[today] after guest tap', JSON.stringify(out.A_prayedByTodayAfterGuestTap));
log('A Kiara after', JSON.stringify(out.A_after), 'mirror prayed today', out.A_mirrorPrayedToday);
log('B rename', JSON.stringify(out.B_rename), 'before', JSON.stringify(out.B_before));
log('B prayedBy[today]', JSON.stringify(out.B_prayedByToday));
log('B Kiki after', JSON.stringify(out.B_after));
saveJson('verify-prayed-name-match-2.json', out);
