// KV: the adult "set the family week" flow.
//   node "audits/tools/phase3/kidverse/adult-week.mjs"      all scenarios (about 1.5 min)
// A stepper: Eli taps + once. Does the verse move? Does the story card below move? (the story card repaints only on
//   hub.onChange, which hub.js fires for remote changes only.) A reload shows what the page should have shown.
// B guest: Grandma Jo (a guest: kind 'adult' on the server) opens Kid Verse and taps +. What does the server hold?
// C stalled: Eli on a new phone (no cache) deep-links #kidverse with every GET /api/data/* held 10 s; at ~7 s he sees the
//   stepper and taps +. What does the family week row hold afterwards?
// D kid: Ezra's Kid Verse has no stepper; setWeek() as a kid is refused (kioskNudge).
import { local, sleep, log, saveJson, shot, row, pulled, flushed } from './_kv.mjs';

const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
const snap = f => f.evaluate(() => ({ ref: document.querySelector('#ref').textContent, weekNow: (document.querySelector('#week-now') || {}).textContent || null,
  who: document.querySelector('#who').textContent.trim(), storyTitle: document.querySelector('#story-title').textContent, storySpan: document.querySelector('#story-span').textContent,
  art: document.querySelector('#art').dataset.scene, storyArt: document.querySelector('#story-art').dataset.scene, stepper: !!document.querySelector('#week-up') }));
try {
  out.sessions = Object.keys(L.S.sessions);
  out.week0 = await row(L, 'eli', 'family', 'week');
  // A — stepper and the story card
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#week-up' }); await pulled(f); await sleep(800);
    out.A_before = await snap(f);
    await f.click('#week-up'); await sleep(900); await flushed(f);
    out.A_after = await snap(f);
    await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
    out.A_shot = await shot(d.page, 'adult-week-A-after-plus-story-card.png');
    out.A_server = await row(L, 'eli', 'family', 'week');
    await f.evaluate(() => location.reload()); await sleep(2500);
    const f2 = d.frame('kidverse'); await pulled(f2); await sleep(600);
    out.A_afterReload = await snap(f2);
    // step back so B starts from 38
    await f2.click('#week-down'); await sleep(900); await flushed(f2);
    await d.close();
  }
  // B — guest
  {
    const gid = out.sessions.find(s => s.startsWith('guest-grandmajo')) || out.sessions.find(s => s.startsWith('guest-'));
    out.B_guest = gid;
    const d = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#kids' }); await pulled(f); await sleep(800);
    out.B_before = await snap(f);
    out.B_kidsCard = await f.evaluate(() => [...document.querySelectorAll('#kids li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()));
    if (out.B_before.stepper) { await f.click('#week-up'); await sleep(900); await flushed(f); }
    out.B_server = await row(L, 'eli', 'family', 'week');
    await f.evaluate(() => document.querySelector('#grown').scrollIntoView({ block: 'center' }));
    out.B_shot = await shot(d.page, 'adult-week-B-guest-stepper.png');
    await d.close();
  }
  // reset the week to 38 as Eli for C
  await L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: 38, by: 'eli', at: Date.now() }, updated_at: Date.now() } });
  out.C_week0 = await row(L, 'eli', 'family', 'week');
  // C — stalled first pull on a new phone
  {
    const ph = await L.newDevice({ name: 'Eli new phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let hold = true; const t0 = Date.now();
    await d.ctx.route(/\/api\/data\/[^/?]+\?/, async r => { if (r.request().method() === 'GET' && hold) await sleep(10000); r.continue().catch(() => {}); });
    const f = await d.openApp('kidverse', { wait: '#week-up' });
    await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    out.C_atTap = { ms: Date.now() - t0, ...(await snap(f)) };
    await f.evaluate(() => document.querySelector('#grown').scrollIntoView({ block: 'center' }));
    out.C_shot = await shot(d.page, 'adult-week-C-stalled-stepper.png');
    await f.click('#week-up'); out.C_tapMs = Date.now() - t0;
    hold = false; await sleep(12000); await flushed(f, 5000);
    out.C_server = await row(L, 'eli', 'family', 'week');
    out.C_after = await snap(f);
    await d.close();
  }
  // D — kid
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(600);
    out.D_kid = await snap(f);
    out.D_kidGrownHidden = await f.evaluate(() => document.querySelector('#grown').hidden);
    await d.close();
  }
} finally { await L.close(); }
log('sessions', out.sessions.join(','));
log('week row at start', JSON.stringify(out.week0 && out.week0.value));
log('A before +', JSON.stringify(out.A_before));
log('A after  +', JSON.stringify(out.A_after));
log('A server   ', JSON.stringify(out.A_server && out.A_server.value));
log('A reload   ', JSON.stringify(out.A_afterReload));
log('B guest', out.B_guest, 'before', JSON.stringify({ stepper: out.B_before.stepper, weekNow: out.B_before.weekNow }), 'kids card', JSON.stringify(out.B_kidsCard));
log('B server after guest +', JSON.stringify(out.B_server && out.B_server.value));
log('C week row before', JSON.stringify(out.C_week0 && out.C_week0.value));
log('C at tap', JSON.stringify(out.C_atTap));
log('C server after', JSON.stringify(out.C_server && out.C_server.value), 'phone shows', JSON.stringify({ ref: out.C_after.ref, weekNow: out.C_after.weekNow }));
log('D kid', JSON.stringify({ stepper: out.D_kid.stepper, grownHidden: out.D_kidGrownHidden }));
saveJson('adult-week.json', out);
