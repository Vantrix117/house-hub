// KV: date logic — ISO-week rollover at midnight, the DST change on 2026-11-01 (New York), a device in another time zone.
//   node "audits/tools/phase3/kidverse/dates.mjs"      (about 1.5 min; typical variant, real server clock, browser clocks installed)
// W  ISO week: Ezra's iPad clock at Sun 2026-09-27 23:58:30 New York. Done ★ (Sunday). Clock runs past midnight (no reload):
//    what the open page shows, then Done ★ again (Monday) and a reload. Server row: week, days, count, total.
// D  DST: the clock at Sun 2026-11-01 23:50 EST (the day the clocks went back). The seven day dots (their titles), Done ★,
//    then Mon 00:10 and a reload: next week's dots, week W45.
// Z  time zone: at the same instant (Thu 2026-09-24 01:30 New York = Wed 22:30 Los Angeles) Ezra taps Done ★ on a phone
//    set to America/Los_Angeles, then on the New York iPad.
import { local, sleep, log, saveJson, shot, row, pulled, flushed } from './_kv.mjs';

const out = {};
const dots = f => f.evaluate(() => [...document.querySelectorAll('#mine .days span')].map(s => s.title + (s.classList.contains('on') ? '★' : '') + (s.classList.contains('today') ? '(today)' : '')));
const st = async L => { const r = await row(L, 'ezra', 'person', 'stars'); const v = r.value; return { week: v.week, count: v.count, total: v.total, earned: v.earned, days: v.days }; };
async function open(L, at, device = 'ipad-portrait', tz) {
  let restore = null;
  if (tz) { const orig = L.browser.newContext.bind(L.browser); L.browser.newContext = o => orig({ ...o, timezoneId: tz }); restore = () => { L.browser.newContext = orig; }; }
  const d = await L.device({ device, profile: 'ezra', installClock: at });
  if (restore) restore();
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1500);
  return { d, f };
}
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    // W
    let { d, f } = await open(L, Date.parse('2026-09-27T23:58:30-04:00'));
    out.W_dotsSun = await dots(f);
    await f.click('#done'); await sleep(600); await flushed(f);
    out.W_afterSun = await st(L);
    await d.ctx.clock.fastForward('03:00'); await sleep(1500);   // now Mon 00:01:30
    out.W_openAfterMidnight = { now: await f.evaluate(() => new Date().toString()), done: await f.textContent('#done'), count: await f.textContent('#star-count'), sub: await f.textContent('#mine .sub'), dots: await dots(f) };
    await f.click('#done'); await sleep(600); await flushed(f);
    out.W_afterMon = await st(L);
    await f.evaluate(() => location.reload()); await sleep(2500); f = d.frame('kidverse'); await pulled(f); await sleep(800);
    out.W_reload = { done: await f.textContent('#done'), count: await f.textContent('#star-count'), dots: await dots(f) };
    await d.close();
    // D
    ({ d, f } = await open(L, Date.parse('2026-11-01T23:50:00-05:00')));
    out.D_sun = { now: await f.evaluate(() => new Date().toString()), dots: await dots(f) };
    await f.click('#done'); await sleep(600); await flushed(f);
    out.D_afterSun = await st(L);
    await d.ctx.clock.fastForward('20:00'); await f.evaluate(() => location.reload()); await sleep(2500); f = d.frame('kidverse'); await pulled(f); await sleep(800);
    out.D_mon = { now: await f.evaluate(() => new Date().toString()), dots: await dots(f), count: await f.textContent('#star-count') };
    await f.click('#done'); await sleep(600); await flushed(f);
    out.D_afterMon = await st(L);
    await d.close();
  } finally { await L.close(); }
}
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const at = Date.parse('2026-09-24T01:30:00-04:00');
    out.Z_0 = await st(L);
    const ph = await L.newDevice({ name: 'Ezra phone in LA', profiles: ['ezra'] });
    const la = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: at, as: ph });
    // time zone for this context only
    await la.close();
    let restoreCtx; { const orig = L.browser.newContext.bind(L.browser); L.browser.newContext = o => orig({ ...o, timezoneId: 'America/Los_Angeles' }); restoreCtx = () => { L.browser.newContext = orig; }; }
    const la2 = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: at, as: ph }); restoreCtx();
    const fl = await la2.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(fl); await sleep(1500);
    out.Z_la = { now: await fl.evaluate(() => new Date().toString()), dots: await dots(fl) };
    await fl.click('#done'); await sleep(600); await flushed(fl);
    out.Z_afterLA = await st(L);
    await la2.close();
    const ny = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at + 60000 });
    const fn = await ny.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(fn); await sleep(1500);
    out.Z_ny = { now: await fn.evaluate(() => new Date().toString()), done: await fn.textContent('#done'), dots: await dots(fn) };
    await fn.click('#done'); await sleep(600); await flushed(fn);
    out.Z_afterNY = await st(L);
    out.Z_shot = await shot(ny.page, 'dates-Z-ny-ipad-after-second-star.png');
    await ny.close();
  } finally { await L.close(); }
}
log('W Sun dots', JSON.stringify(out.W_dotsSun));
log('W after Sun Done', JSON.stringify(out.W_afterSun));
log('W open page after midnight (no reload)', JSON.stringify(out.W_openAfterMidnight));
log('W after Mon Done', JSON.stringify(out.W_afterMon));
log('W after reload', JSON.stringify(out.W_reload));
log('D Sun (DST day)', JSON.stringify(out.D_sun));
log('D after Sun Done', JSON.stringify(out.D_afterSun));
log('D Mon after reload', JSON.stringify(out.D_mon));
log('D after Mon Done', JSON.stringify(out.D_afterMon));
log('Z start', JSON.stringify(out.Z_0));
log('Z LA phone', JSON.stringify(out.Z_la));
log('Z after LA Done', JSON.stringify(out.Z_afterLA));
log('Z NY iPad one minute later', JSON.stringify(out.Z_ny));
log('Z after NY Done', JSON.stringify(out.Z_afterNY));
saveJson('dates.json', out);
