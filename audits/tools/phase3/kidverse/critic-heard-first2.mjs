// Completeness critic: "I heard it" tapped during a stalled first load, when the kid already has heard days this week.
//   node "audits/tools/phase3/kidverse/critic-heard-first2.mjs"      (about 40 s)
// 1. The Kitchen iPad (Ezra, clock Thu 24 Sep 18:00 New York) taps "I heard it": story row { W39, days { 24 } }.
// 2. A new phone paired with Ezra (no cache, clock Fri 25 Sep 18:00) deep-links Kid Verse; every GET /api/data/* is held
//    10 s; at ~7 s Ezra taps "I heard it". Then the hold is released.
// Prints the server's story rows (person 'story', family 'story:ezra') and the stars row's credited story days.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';
const NY = s => Date.parse(s);
const storyRows = async L => ({ person: (await row(L, 'ezra', 'person', 'story'))?.value || null, family: (await row(L, 'eli', 'family', 'story:ezra'))?.value || null });
const starsRow = async L => { const v = (await row(L, 'ezra', 'person', 'stars'))?.value; return v && { total: v.total, earned: v.earned, count: v.count, creditedStory: Object.keys(v.credited?.story || {}).filter(k => k >= '2026-09-21').sort() }; };
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: NY('2026-09-24T18:00:00-04:00') });
  const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fi); await sleep(1500);
  await fi.click('#story-heard'); await sleep(800); await flushed(fi); await ipad.close();
  out.s1_afterThu = { story: await storyRows(L), stars: await starsRow(L) };
  const ph = await L.newDevice({ name: 'Ezra new phone (heard 2)', profiles: ['ezra'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: NY('2026-09-25T18:00:00-04:00'), as: ph });
  let hold = true; const t0 = Date.now();
  await phone.ctx.route(/\/api\/data\/[^/?]+\?/, async route => { if (route.request().method() === 'GET' && hold) await sleep(10000); route.continue().catch(() => {}); });
  const f = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
  await sleep(Math.max(0, 7000 - (Date.now() - t0)));
  out.atTap = { ms: Date.now() - t0, lastPull: await f.evaluate(() => hub.sync.lastPull), ui: await ui(f) };
  await f.click('#story-heard'); await sleep(600);
  hold = false; await sleep(11000); await flushed(f, 8000);
  out.s2_after = { story: await storyRows(L), stars: await starsRow(L) };
  out.phoneAfter = await ui(f);
  await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
  out.shot = await shot(phone.page, 'critic-heard-first2-phone-after.png');
  await phone.close();
} finally { await L.close(); }
const s = x => ({ storyDays: Object.keys(x.story.family?.days || {}).sort(), personDays: Object.keys(x.story.person?.days || {}).sort(), total: x.stars.total, creditedStory: x.stars.creditedStory });
log('after Thu heard (iPad)', JSON.stringify(s(out.s1_afterThu)));
log('at tap (phone, held first pull)', JSON.stringify({ ms: out.atTap.ms, lastPull: out.atTap.lastPull, heard: out.atTap.ui.heard, storySub: out.atTap.ui.storySub, who: out.atTap.ui.who }));
log('after Fri heard (phone) + pull', JSON.stringify(s(out.s2_after)));
log('phone shows', JSON.stringify({ heard: out.phoneAfter.heard, storySub: out.phoneAfter.storySub, rwTotal: out.phoneAfter.rwTotal }));
saveJson('critic-heard-first2.json', out);
