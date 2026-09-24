// Skeptic 2 for "critic-heard-first-load-overwrites-story-row-3": does "I heard it", tapped while a new device's first
// kidverse pull is stalled, overwrite the week's story rows and drop an earlier heard day?
//   node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2.mjs"   (about 60 s)
// Realistic clocks (no future timestamps): server = real time; the Kitchen iPad's browser clock is set one day back
// (same ISO week), the new phones run on the real clock.
//   Arm A (bug):     iPad Ezra hears "yesterday"; a new phone paired with Ezra opens Kid Verse with every GET
//                    /api/data/* held 10 s; Ezra taps "I heard it" as soon as the button shows (after hub.ready's 6 s race).
//   Arm B (control): the same for Kiara, but no hold: she taps after the first pull lands.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';
const P = 'verify-critic-heard-first-load-overwrites-story-row-3-2';
const storyRows = async (L, kid) => ({ person: (await row(L, kid, 'person', 'story'))?.value || null, family: (await row(L, 'eli', 'family', 'story:' + kid))?.value || null });
const days = r => ({ person: Object.keys(r.person?.days || {}).sort(), family: Object.keys(r.family?.days || {}).sort(), week: r.family?.week });
const starsSum = async (L, kid) => { const v = (await row(L, kid, 'person', 'stars'))?.value; return v && { total: v.total, earned: v.earned, creditedStory: Object.keys(v.credited?.story || {}).sort().slice(-4) }; };
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const yesterday = Date.now() - 86400000;
  out.familyWeekRow = (await row(L, 'eli', 'family', 'week'))?.value ?? null;
  for (const kid of ['ezra', 'kiara']) {
    const ipad = await L.device({ device: 'ipad-portrait', profile: kid, installClock: yesterday });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fi); await sleep(1200);
    out[kid + '_ipadUi'] = await ui(fi);
    await fi.click('#story-heard'); await sleep(800); await flushed(fi); await ipad.close();
    out[kid + '_afterIpad'] = { story: days(await storyRows(L, kid)), stars: await starsSum(L, kid) };
    log(kid, 'after iPad heard (yesterday)', JSON.stringify(out[kid + '_afterIpad']));
  }
  // Arm A: stalled first load on a new phone
  {
    const nd = await L.newDevice({ name: 'Ezra new phone (skeptic 2)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: nd });
    let hold = true; const t0 = Date.now(); const posts = [];
    await phone.ctx.route(/\/api\/data\//, async route => {
      const r = route.request();
      if (r.method() === 'GET' && hold) await sleep(10000);
      if (r.method() !== 'GET') posts.push({ ms: Date.now() - t0, method: r.method(), body: (r.postData() || '').slice(0, 300) });
      route.continue().catch(() => {});
    });
    const f = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])', timeout: 20000 });
    out.A_atTap = { ms: Date.now() - t0, lastPull: await f.evaluate(() => hub.sync.lastPull || 0), ui: await ui(f) };
    log('A at tap', JSON.stringify({ ms: out.A_atTap.ms, lastPull: out.A_atTap.lastPull, who: out.A_atTap.ui.who, title: out.A_atTap.ui.storyTitle, span: out.A_atTap.ui.storySpan, heard: out.A_atTap.ui.heard, sub: out.A_atTap.ui.storySub }));
    await f.click('#story-heard'); await sleep(600);
    hold = false; await sleep(12000); await flushed(f, 10000);
    out.A_after = { story: days(await storyRows(L, 'ezra')), stars: await starsSum(L, 'ezra') };
    out.A_phoneUi = await ui(f); out.A_posts = posts;
    log('A after tap + pull', JSON.stringify(out.A_after));
    log('A phone shows', JSON.stringify({ title: out.A_phoneUi.storyTitle, span: out.A_phoneUi.storySpan, sub: out.A_phoneUi.storySub }));
    await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
    out.A_shot = await shot(phone.page, P + '-A-phone-after.png');
    await phone.close();
  }
  // Arm B: control, no hold
  {
    const nd = await L.newDevice({ name: 'Kiara new phone (skeptic 2)', profiles: ['kiara'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false, as: nd });
    const f = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(f); await sleep(1500);
    out.B_atTap = { lastPull: await f.evaluate(() => hub.sync.lastPull || 0), ui: await ui(f) };
    await f.click('#story-heard'); await sleep(800); await flushed(f); await sleep(1000);
    out.B_after = { story: days(await storyRows(L, 'kiara')), stars: await starsSum(L, 'kiara') };
    log('B (control) after', JSON.stringify(out.B_after), 'sub', (await ui(f)).storySub);
    await phone.close();
  }
} finally { await L.close(); }
saveJson(P + '.json', out);
