// KV: the star rules of CLAUDE.md "Stars & badges", at runtime, through the shipped UI (typical variant, real clock).
//   node "audits/tools/phase3/kidverse/star-rules.mjs"      (about 2 min)
// R1 verse ★: Ezra taps Done ★ twice — one star, person row == family mirror, earnedAt stamped on the server clock, feed line.
// R2 story:   Ezra taps "I heard it" twice — one credited story star.
// R3 prayed:  Kiara taps a card on the family prayer list (Prayer app, kid mode), then opens Kid Verse — one credited star;
//             a second open credits nothing more.
// R4 14-day look-back + R5 badge: fixture — Mom's API write adds "Kiara" to prayedBy on days -1, -3, -5, -13 and -15 of one
//             family prayer row (the Prayer app writes these lists; the write only stands in for past taps). Kiara reopens.
//             Expected: -1/-3/-5/-13 credited, -15 not; Prayer warrior (5 prayed days) awarded once, with toast + feed line.
// R6 name match: a guest named "Kiara" (added by Mom through POST /api/profiles, as Me → Add a guest does) taps Prayed on
//             the family list today... measured on a fresh instance: does Kid Verse credit the real Kiara for it?
// R7 kiosk:   the TV opens Kid Verse standalone: no Done ★ / I heard it; window.kidverse.award() refused; nothing written.
import { local, sleep, log, stars, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';

const pad = n => String(n).padStart(2, '0');
const dk = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const feed = async L => { const r = await L.apiAs('eli', '/api/activity?limit=30'); return (r.body.activity || []).map(a => a.name + ': ' + a.text); };
const out = {};

async function openKV(L, profile, device = 'iphone-pwa', as) {
  const d = await L.device({ device, profile, fixedTime: false, ...(as ? { as } : {}) });
  const f = await d.openApp('kidverse', { wait: '#story' }); await pulled(f); await sleep(1500);
  await f.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(String(m)); return o.call(hub, m, ms); }; });
  return { d, f };
}

{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    // R1 + R2
    out.R0 = (await stars(L, 'ezra')).person;
    const { d, f } = await openKV(L, 'ezra');
    await f.click('#done'); await sleep(700); await f.click('#done'); await sleep(700); await flushed(f);
    const r1 = await stars(L, 'ezra');
    const raw = await row(L, 'ezra', 'person', 'stars');
    const srvNow = (await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week')).body.now;
    out.R1 = { person: r1.person, mirrorEqualsPerson: JSON.stringify((await row(L, 'eli', 'family', 'stars:ezra')).value) === JSON.stringify(raw.value), earnedAtToday: raw.value.earnedAt['verse:' + dk(0)], serverNow: srvNow, toasts: await f.evaluate(() => window.__toasts), ui: await ui(f) };
    await f.evaluate(() => { window.__toasts = []; });
    await f.click('#story-heard'); await sleep(700); await f.click('#story-heard'); await sleep(700); await flushed(f);
    out.R2 = { person: (await stars(L, 'ezra')).person, storyRow: (await row(L, 'ezra', 'person', 'story')).value, toasts: await f.evaluate(() => window.__toasts), ui: await ui(f) };
    out.R2shot = await shot(d.page, 'star-rules-R2-ezra-after-story.png');
    await d.close();
    out.feedAfterEzra = await feed(L);

    // R3 — Kiara prays on the family list in the Prayer app
    out.R3_0 = (await stars(L, 'kiara')).person;
    const kp = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const pf = await kp.openApp('prayer', { wait: '[data-kpray]' }); await sleep(1500);
    const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(x => x.getAttribute('aria-pressed') !== 'true'); return b ? b.dataset.kpray : null; });
    await pf.click(`[data-kpray="${target}"]`); await sleep(1000); await flushed(pf);
    out.R3_prayerRow = (await row(L, 'kiara', 'family', 'prayer:' + target, 'prayer'));
    out.R3_prayerRow = out.R3_prayerRow && { key: out.R3_prayerRow.key, prayedByToday: out.R3_prayerRow.value.prayedBy && out.R3_prayerRow.value.prayedBy[dk(0)] };
    await kp.close();
    let k = await openKV(L, 'kiara'); await flushed(k.f);
    out.R3_1 = (await stars(L, 'kiara')).person; out.R3_1toasts = await k.f.evaluate(() => window.__toasts);
    await k.d.close();
    k = await openKV(L, 'kiara'); await flushed(k.f);
    out.R3_2 = (await stars(L, 'kiara')).person;
    await k.d.close();

    // R4 + R5 — fixture: past prayedBy days for Kiara on one family prayer row
    const pr = await row(L, 'mom', 'family', 'prayer:' + target, 'prayer');
    const v = pr.value; v.prayedBy = v.prayedBy || {};
    for (const o of [-1, -3, -5, -13, -15]) v.prayedBy[dk(o)] = [...new Set([...(v.prayedBy[dk(o)] || []), 'Kiara'])];
    const put = await L.apiAs('mom', '/api/data/prayer/' + encodeURIComponent('prayer:' + target) + '?scope=family', { method: 'PUT', body: { value: v, updated_at: Date.now() } });
    out.R4_fixture = { status: put.status, days: [-1, -3, -5, -13, -15].map(dk) };
    k = await openKV(L, 'kiara'); await sleep(1500); await flushed(k.f);
    const kr = await row(L, 'kiara', 'person', 'stars');
    out.R4 = { credited: Object.keys(kr.value.credited.prayed).sort(), has13: !!kr.value.credited.prayed[dk(-13)], has15: !!kr.value.credited.prayed[dk(-15)], badges: kr.value.badges, total: kr.value.total, earned: kr.value.earned, toasts: await k.f.evaluate(() => window.__toasts) };
    await k.f.evaluate(() => document.querySelector('#rewards').scrollIntoView({ block: 'center' }));
    out.R4shot = await shot(k.d.page, 'star-rules-R5-kiara-prayer-warrior.png');
    await k.d.close();
    k = await openKV(L, 'kiara'); await sleep(1000);
    out.R5_second = { toasts: await k.f.evaluate(() => window.__toasts), person: (await stars(L, 'kiara')).person };
    await k.d.close();
    out.feedAfterKiara = await feed(L);

    // R7 — kiosk
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.page.goto(L.site + '/apps/kidverse.html', { waitUntil: 'load' }); await sleep(2500);
    const before = JSON.stringify((await stars(L, 'ezra')).person);
    out.R7 = await tv.page.evaluate(() => ({ kind: document.documentElement.dataset.kind, doneHidden: document.querySelector('#done').hidden, heardHidden: document.querySelector('#story-heard').hidden, stepper: !!document.querySelector('#week-up'), grownHidden: document.querySelector('#grown').hidden, kids: [...document.querySelectorAll('#kids li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()), award: window.kidverse && window.kidverse.award(), heard: window.kidverse && window.kidverse.heard(), canWrite: hub.canWrite }));
    await sleep(1500);
    out.R7.unchanged = before === JSON.stringify((await stars(L, 'ezra')).person);
    out.R7shot = await shot(tv.page, 'star-rules-R7-tv-standalone.png');
    await tv.close();
  } finally { await L.close(); }
}
// R6 — a guest with a kid's name
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    out.R6_0 = (await stars(L, 'kiara')).person;
    const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Kiara', emoji: '🌷', color: '#8A6A4B' } });
    const gid = g.body.profile.id;
    const lg = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: gid } });
    const as = { device: L.S.info.device, sessions: { [gid]: lg.body.profile_token } };
    const gd = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false, as });
    const pf = await gd.openApp('prayer', { wait: '[data-list="shared"]' }); await sleep(1200);
    await pf.click('[data-list="shared"]'); await sleep(800);
    const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-pray]')].find(x => x.getAttribute('aria-pressed') !== 'true' && x.offsetParent); return b ? b.dataset.pray : null; });
    await pf.click(`[data-pray="${target}"]`); await sleep(1200); await flushed(pf);
    const pr = await row(L, 'mom', 'family', 'prayer:' + target, 'prayer');
    out.R6_prayedByToday = pr && pr.value.prayedBy && pr.value.prayedBy[dk(0)];
    out.R6_guest = { id: gid, name: g.body.profile.name, loginStatus: lg.status };
    await gd.close();
    const { d, f } = await openKV(L, 'kiara'); await flushed(f);
    const kr = await row(L, 'kiara', 'person', 'stars');
    out.R6 = { before: out.R6_0, after: (await stars(L, 'kiara')).person, prayedToday: kr.value.credited.prayed[dk(0)] || null };
    await d.close();
  } finally { await L.close(); }
}
log('R1 verse ★ x2   ', JSON.stringify({ before: { total: out.R0.total, earned: out.R0.earned, count: out.R0.count }, after: { total: out.R1.person.total, earned: out.R1.person.earned, count: out.R1.person.count }, mirrorEqualsPerson: out.R1.mirrorEqualsPerson, earnedAtToday: out.R1.earnedAtToday, serverNow: out.R1.serverNow, toasts: out.R1.toasts, button: out.R1.ui.done }));
log('R2 story x2     ', JSON.stringify({ total: out.R2.person.total, earned: out.R2.person.earned, count: out.R2.person.count, storyCredited: out.R2.person.storyCredited, storyRow: out.R2.storyRow, toasts: out.R2.toasts, heard: out.R2.ui.heard, sub: out.R2.ui.storySub, starCount: out.R2.ui.starCount, litDots: out.R2.ui.litDots }));
log('feed after Ezra ', JSON.stringify(out.feedAfterEzra.slice(0, 4)));
log('R3 Kiara prayed ', JSON.stringify({ prayerRow: out.R3_prayerRow, before: { total: out.R3_0.total, prayed: out.R3_0.prayedCredited }, open1: { total: out.R3_1.total, prayed: out.R3_1.prayedCredited, count: out.R3_1.count }, open2: { total: out.R3_2.total, prayed: out.R3_2.prayedCredited }, toasts: out.R3_1toasts }));
log('R4/R5 look-back ', JSON.stringify(out.R4));
log('R5 second open  ', JSON.stringify({ toasts: out.R5_second.toasts, total: out.R5_second.person.total, badges: out.R5_second.person.badges }));
log('feed after Kiara', JSON.stringify(out.feedAfterKiara.slice(0, 4)));
log('R6 guest "Kiara"', JSON.stringify({ guest: out.R6_guest, prayedByToday: out.R6_prayedByToday, kiaraBefore: { total: out.R6.before.total, prayed: out.R6.before.prayedCredited }, kiaraAfter: { total: out.R6.after.total, prayed: out.R6.after.prayedCredited }, creditedToday: out.R6.prayedToday }));
log('R7 kiosk        ', JSON.stringify(out.R7));
saveJson('star-rules.json', out);
