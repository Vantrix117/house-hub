// Completeness critic: "I heard it" (heard(), apps/kidverse.html:631-646) writes the story rows whole with no pull guard.
//   node "audits/tools/phase3/kidverse/critic-heard-races.mjs"            both scenarios (about 1.5 min)
//   node "audits/tools/phase3/kidverse/critic-heard-races.mjs" first|stale|control
// first:   a new phone paired with Ezra (no cache) deep-links Kid Verse; every GET /api/data/* is held 10 s; at ~7 s (after
//          hub.ready's 6 s race) Ezra taps "I heard it". Server story rows (person 'story', family 'story:ezra') before/after.
// stale:   Ezra's phone opens Kid Verse on Thu 24 Sep 18:00 (warm cache) and goes offline. The Kitchen iPad (Ezra) on
//          Fri 25 Sep 18:00 taps "I heard it" (story day + story star for Fri). The phone's clock runs on to Sat 26 Sep 18:00;
//          still offline, Ezra taps "I heard it" there, then the phone reconnects. The iPad pulls.
//          Question: is Friday's heard day, and its story star, gone for good (P3-KIDVERSE-02 says story credits come back)?
// control: the same as stale, but the phone stays online and pulls before its tap.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';

const NY = s => Date.parse(s);
const storyRows = async L => ({ person: (await row(L, 'ezra', 'person', 'story'))?.value || null, family: (await row(L, 'eli', 'family', 'story:ezra'))?.value || null });
const starsRow = async L => { const v = (await row(L, 'ezra', 'person', 'stars'))?.value; return v && { total: v.total, earned: v.earned, count: v.count, creditedStory: Object.keys(v.credited?.story || {}).filter(k => k >= '2026-09-21').sort(), days: v.days }; };

async function first() {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name: 'first' };
  try {
    out.before = { story: await storyRows(L), stars: await starsRow(L) };
    const ph = await L.newDevice({ name: 'Ezra new phone (heard)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    let hold = true; const t0 = Date.now();
    await phone.ctx.route(/\/api\/data\/[^/?]+\?/, async route => { if (route.request().method() === 'GET' && hold) await sleep(10000); route.continue().catch(() => {}); });
    const posts = [];
    phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(r.url())) { try { const b = JSON.parse(r.postData()); posts.push({ ms: Date.now() - t0, items: b.items.map(i => i.key + ' ' + JSON.stringify(i.value && i.value.days ? { days: i.value.days } : i.value && 'total' in i.value ? { total: i.value.total } : i.value)) }); } catch {} } });
    const f = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    out.atTap = { ms: Date.now() - t0, lastPull: await f.evaluate(() => hub.sync.lastPull), ui: await ui(f) };
    await f.click('#story-heard'); await sleep(600);
    out.shotAtTap = await shot(phone.page, 'critic-heard-first-phone-after-tap.png');
    hold = false; await sleep(11000); await flushed(f, 8000);
    out.posts = posts;
    out.after = { story: await storyRows(L), stars: await starsRow(L) };
    out.phoneAfter = await ui(f);
    await phone.close();
  } finally { await L.close(); }
  log('[first] before story', JSON.stringify(out.before.story), 'stars', JSON.stringify(out.before.stars));
  log('[first] at tap', JSON.stringify({ ms: out.atTap.ms, lastPull: out.atTap.lastPull, heard: out.atTap.ui.heard, storySub: out.atTap.ui.storySub, who: out.atTap.ui.who }));
  log('[first] POSTs', JSON.stringify(out.posts));
  log('[first] after story', JSON.stringify(out.after.story), 'stars', JSON.stringify(out.after.stars));
  log('[first] phone after', JSON.stringify({ heard: out.phoneAfter.heard, storySub: out.phoneAfter.storySub, storyTitle: out.phoneAfter.storyTitle }));
  return out;
}

async function stale(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name };
  try {
    out.s0 = { story: await storyRows(L), stars: await starsRow(L) };
    const ph = await L.newDevice({ name: 'Mom phone (Ezra) ' + name, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: NY('2026-09-24T18:00:00-04:00'), as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fp); await sleep(1500); await flushed(fp);
    out.phoneWarm = await ui(fp);
    if (name === 'stale') await phone.setOffline(true);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: NY('2026-09-25T18:00:00-04:00') });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(fi); await sleep(1500);
    await fi.click('#story-heard'); await sleep(800); await flushed(fi);
    out.s1_afterIpadFri = { story: await storyRows(L), stars: await starsRow(L), ipad: await ui(fi) };
    await phone.ctx.clock.fastForward(48 * 3600e3); await sleep(1200);   // Sat 26 Sep 18:00 on the phone
    if (name === 'control') { await fp.evaluate(() => hub.pull()); await sleep(1500); }
    out.phoneNow = await fp.evaluate(() => new Date().toString());
    await fp.click('#story-heard'); await sleep(800);
    if (name === 'stale') { await sleep(1000); await phone.setOffline(false); }
    await sleep(2500); await flushed(fp);
    out.s2_afterPhoneSat = { story: await storyRows(L), stars: await starsRow(L) };
    await fi.evaluate(() => hub.pull()); await sleep(2000); await flushed(fi);
    out.s3_afterIpadPull = { story: await storyRows(L), stars: await starsRow(L), ipad: await ui(fi) };
    await fi.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
    out.shot = await shot(ipad.page, `critic-heard-${name}-ipad-after-pull.png`);
    // a later reopen on the iPad (fresh reconcile) — does Friday's story star come back?
    await ipad.close();
    const ipad2 = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: NY('2026-09-26T19:00:00-04:00') });
    const f2 = await ipad2.openApp('kidverse', { wait: '#story-heard:not([hidden])' }); await pulled(f2); await sleep(1800); await flushed(f2);
    out.s4_reopen = { story: await storyRows(L), stars: await starsRow(L), ipad: await ui(f2) };
    await ipad2.close(); await phone.close();
  } finally { await L.close(); }
  const s = x => ({ storyDays: Object.keys(x.story.family?.days || {}).sort(), storyWeek: x.story.family?.week, total: x.stars.total, earned: x.stars.earned, creditedStory: x.stars.creditedStory });
  log(`[${name}] start          `, JSON.stringify(s(out.s0)));
  log(`[${name}] iPad Fri heard `, JSON.stringify(s(out.s1_afterIpadFri)), '| iPad', JSON.stringify({ heard: out.s1_afterIpadFri.ipad.heard, storySub: out.s1_afterIpadFri.ipad.storySub, rwTotal: out.s1_afterIpadFri.ipad.rwTotal }));
  log(`[${name}] phone now      `, out.phoneNow);
  log(`[${name}] phone Sat heard`, JSON.stringify(s(out.s2_afterPhoneSat)));
  log(`[${name}] iPad after pull`, JSON.stringify(s(out.s3_afterIpadPull)), '| iPad', JSON.stringify({ storySub: out.s3_afterIpadPull.ipad.storySub, rwTotal: out.s3_afterIpadPull.ipad.rwTotal, starCount: out.s3_afterIpadPull.ipad.starCount }));
  log(`[${name}] iPad reopen    `, JSON.stringify(s(out.s4_reopen)), '| iPad', JSON.stringify({ storySub: out.s4_reopen.ipad.storySub, rwTotal: out.s4_reopen.ipad.rwTotal }));
  return out;
}

const which = process.argv[2] ? [process.argv[2]] : ['first', 'stale', 'control'];
const res = {};
for (const w of which) res[w] = w === 'first' ? await first() : await stale(w);
saveJson('critic-heard-races' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json', res);
