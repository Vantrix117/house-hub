// Skeptic #1 for "critic-heard-stale-device-drops-heard-day-2": does a kid's second device with an older story row erase
// the other device's heard day when it taps "I heard it"? (heard(), apps/kidverse.html:631-646 writes the rows whole.)
//   node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-1.mjs"   (both arms, ~1 min)
// Unlike the investigator's script, no clock is fast-forwarded (that makes hub.js stamp writes ~48 h ahead, which the
// Worker clamps to now+5 min, an artefact): the phone boots with its clock already at Sat 26 Sep 18:00 NY, warms its
// cache, then (arm 'stale') goes offline. The Kitchen iPad, clock Fri 25 Sep 18:00 NY, taps "I heard it". Then the
// phone taps "I heard it" (offline in 'stale'; after a hub.pull() in 'control'), reconnects and flushes. Its write carries
// a real-time stamp (skew = server - device), so the order on the server is the real order of the taps.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';

const NY = s => Date.parse(s);
const days = v => Object.keys((v && v.days) || {}).sort();
async function server(L) {
  const p = await row(L, 'ezra', 'person', 'story'), f = await row(L, 'mom', 'family', 'story:ezra'), st = await row(L, 'ezra', 'person', 'stars');
  return { personStory: { week: p?.value?.week, days: days(p?.value), t: p?.updated_at }, familyStory: { week: f?.value?.week, days: days(f?.value), t: f?.updated_at },
    stars: st?.value && { total: st.value.total, earned: st.value.earned, creditedStory: Object.keys(st.value.credited?.story || {}).filter(k => k >= '2026-09-21').sort() } };
}

async function arm(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { arm: name };
  try {
    out.start = await server(L);
    const ph = await L.newDevice({ name: 'Ezra 2nd device ' + name, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: NY('2026-09-26T18:00:00-04:00'), as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fp); await sleep(1500); await flushed(fp);
    out.phoneWarm = { now: await fp.evaluate(() => new Date().toString()), story: await fp.evaluate(() => hub.get('story', { scope: 'person' })), ui: (await ui(fp)).storySub };
    if (name === 'stale') await phone.setOffline(true);

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: NY('2026-09-25T18:00:00-04:00') });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fi); await sleep(1500);
    await fi.click('#story-heard'); await sleep(800); await flushed(fi);
    out.afterIpadFri = { server: await server(L), ipadSub: (await ui(fi)).storySub };

    if (name === 'control') { await fp.evaluate(() => hub.pull()); await sleep(1500); }
    out.phoneBeforeTap = { online: name !== 'stale', cachedStory: await fp.evaluate(() => hub.get('story', { scope: 'person' })) };
    await fp.click('#story-heard'); await sleep(800);
    out.phoneAfterTapUi = (await ui(fp)).storySub;
    if (name === 'stale') await phone.setOffline(false);
    await sleep(2500); await flushed(fp);
    out.afterPhoneSat = { server: await server(L) };

    await fi.evaluate(() => hub.pull()); await sleep(2000); await flushed(fi);
    await fi.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
    out.afterIpadPull = { server: await server(L), ipad: await ui(fi) };
    out.shot = await shot(ipad.page, `verify-critic-heard-stale-device-drops-heard-day-2-1-${name}-ipad.png`);
    await ipad.close(); await phone.close();
  } finally { await L.close(); }
  const s = x => JSON.stringify({ person: x.personStory.days, family: x.familyStory.days, week: x.familyStory.week, stars: x.stars });
  log(`[${name}] start           `, s(out.start));
  log(`[${name}] phone warm      `, out.phoneWarm.now, JSON.stringify(out.phoneWarm.story), out.phoneWarm.ui);
  log(`[${name}] iPad Fri heard  `, s(out.afterIpadFri.server), '| iPad:', out.afterIpadFri.ipadSub);
  log(`[${name}] phone cache@tap `, JSON.stringify(out.phoneBeforeTap));
  log(`[${name}] phone Sat heard `, s(out.afterPhoneSat.server), '| phone:', out.phoneAfterTapUi);
  log(`[${name}] iPad after pull `, s(out.afterIpadPull.server), '| iPad:', out.afterIpadPull.ipad.storySub, 'rwTotal', out.afterIpadPull.ipad.rwTotal);
  return out;
}
const res = {};
for (const a of (process.argv[2] ? [process.argv[2]] : ['stale', 'control'])) res[a] = await arm(a);
saveJson('verify-critic-heard-stale-device-drops-heard-day-2-1.json', res);
