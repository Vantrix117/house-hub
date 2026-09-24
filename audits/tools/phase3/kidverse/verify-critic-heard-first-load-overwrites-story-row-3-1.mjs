// Skeptic #1 for "critic-heard-first-load-overwrites-story-row-3": does "I heard it" tapped during a stalled first load
// (no kidverse cache on the device, first pull held > 6 s) overwrite the week's story rows and drop an earlier heard day?
//   node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-1.mjs"   (two arms, ~1.5 min)
// Differences from the investigator's script: no future clocks. The Kitchen iPad (Ezra) runs one day behind real time and
// taps "I heard it" ("yesterday"); the new phone runs on real time, so its write stamp is the true order of the taps and
// the Worker's now+5 min clamp never applies. Arm 'held': every GET /api/data/* on the phone is held 10 s, the tap lands
// at ~7 s (after hub.ready's 6 s race). Arm 'control': the same phone taps only after its first pull has landed.
// Prints the server's person 'story' and family 'story:ezra' rows and the stars row before and after.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';

const days = v => Object.keys((v && v.days) || {}).sort();
async function server(L) {
  const p = await row(L, 'ezra', 'person', 'story'), f = await row(L, 'mom', 'family', 'story:ezra'), st = await row(L, 'ezra', 'person', 'stars');
  return { person: { week: p?.value?.week, days: days(p?.value), t: p?.updated_at }, family: { week: f?.value?.week, days: days(f?.value), t: f?.updated_at },
    stars: st?.value && { total: st.value.total, earned: st.value.earned, creditedStory: Object.keys(st.value.credited?.story || {}).sort().slice(-4) } };
}

async function arm(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { arm: name };
  try {
    out.start = await server(L);
    const now = Date.now();
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: now - 24 * 3600e3 });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fi); await sleep(1500);
    out.ipadNow = await fi.evaluate(() => new Date().toString());
    await fi.click('#story-heard'); await sleep(800); out.ipadFlushed = await flushed(fi); await ipad.close();
    out.afterIpad = await server(L);

    const ph = await L.newDevice({ name: 'Ezra new phone ' + name, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: Date.now(), as: ph });
    let hold = name === 'held'; const t0 = Date.now(); const reqs = [];
    await phone.ctx.route(/\/api\/data\//, async route => {
      const r = route.request(); const m = r.method(); const u = r.url().replace(/^.*\/api\/data\//, '');
      if (m === 'GET' && hold) await sleep(10000);
      reqs.push({ ms: Date.now() - t0, m, u: u.slice(0, 80) }); route.continue().catch(() => {});
    });
    const f = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    if (name === 'held') await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    else { await pulled(f); await sleep(1500); }
    out.atTap = { ms: Date.now() - t0, lastPull: await f.evaluate(() => hub.sync.lastPull || 0), phoneNow: await f.evaluate(() => new Date().toString()),
      cacheStory: await f.evaluate(() => hub.get('story', { scope: 'person' })), ui: await ui(f) };
    out.tapResult = await f.evaluate(() => window.kidverse.heard ? null : null);
    await f.click('#story-heard'); await sleep(600);
    out.rightAfterTap = await f.evaluate(() => hub.get('story', { scope: 'person' }));
    hold = false; await sleep(11000); out.phoneFlushed = await flushed(f, 10000);
    await f.evaluate(() => hub.pull()); await sleep(1500);
    out.after = await server(L);
    out.phoneAfter = await ui(f);
    out.requests = reqs.filter(r => /kidverse/.test(r.u));
    if (name === 'held') { await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' })); out.shot = await shot(phone.page, 'verify-critic-heard-first-load-overwrites-story-row-3-1-phone-after.png'); }
    await phone.close();
  } finally { await L.close(); }
  log(name, 'start       ', JSON.stringify({ p: out.start.person.days, f: out.start.family.days }));
  log(name, 'after iPad  ', JSON.stringify({ ipadNow: out.ipadNow, p: out.afterIpad.person.days, f: out.afterIpad.family.days, stars: out.afterIpad.stars }));
  log(name, 'at tap      ', JSON.stringify({ ms: out.atTap.ms, lastPull: out.atTap.lastPull, who: out.atTap.ui.who, storySpan: out.atTap.ui.storySpan, heard: out.atTap.ui.heard, storySub: out.atTap.ui.storySub, cache: out.atTap.cacheStory }));
  log(name, 'after phone ', JSON.stringify({ p: out.after.person.days, pT: out.after.person.t, f: out.after.family.days, stars: out.after.stars }));
  log(name, 'phone shows ', JSON.stringify({ storySub: out.phoneAfter.storySub, storySpan: out.phoneAfter.storySpan }));
  log(name, 'kidverse req', JSON.stringify(out.requests));
  return out;
}

const res = { held: await arm('held'), control: await arm('control') };
saveJson('verify-critic-heard-first-load-overwrites-story-row-3-1.json', res);
