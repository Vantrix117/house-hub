// Skeptic #1 for KV finding "device-local-day": does Kid Verse's "today" follow each device's own time zone?
//   node "audits/tools/phase3/kidverse/verify-device-local-day-1.mjs"
// Fresh local instance (typical, real server clock). Same instant on both devices' browser clocks:
//   Thu 2026-09-24 01:30 New York (= Wed 22:30 Los Angeles).
//   A: Ezra's second device with timezoneId America/Los_Angeles -> Done ★. Server stars row: days.
//   B: one minute later, the rig's Kitchen iPad (America/New_York) as Ezra -> what #done says, dayKey(), Done ★ again.
//   C: what the Worker thinks "today" is (chat.js today() = New York) is read from code, not run.
import { local, sleep, log, saveJson, shot, row, pulled, flushed, ui } from './_kv.mjs';

const out = {};
const starsRow = async L => { const r = await row(L, 'ezra', 'person', 'stars'); const v = r && r.value; return v ? { week: v.week, count: v.count, total: v.total, earned: v.earned, days: v.days, earnedAt: v.earnedAt } : null; };
const mirror = async L => { const r = await row(L, 'eli', 'family', 'stars:ezra'); const v = r && r.value; return v ? { count: v.count, total: v.total, days: v.days } : null; };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const at = Date.parse('2026-09-24T01:30:00-04:00');
  out.before = await starsRow(L);
  // A: a second paired device whose browser context is in Los Angeles
  const ph = await L.newDevice({ name: 'Ezra travel phone', profiles: ['ezra'] });
  const orig = L.browser.newContext.bind(L.browser);
  L.browser.newContext = o => orig({ ...o, timezoneId: 'America/Los_Angeles' });
  let la;
  try { la = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: at, as: ph }); } finally { L.browser.newContext = orig; }
  const fa = await la.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(fa); await sleep(1500);
  out.A_env = await fa.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toString() }));
  out.A_ui_before = await ui(fa);
  await fa.click('#done'); await sleep(700); out.A_flushed = await flushed(fa);
  out.A_ui_after = await ui(fa);
  out.A_row = await starsRow(L);
  await shot(la.page, 'verify-device-local-day-1-A-la-phone-after.png');
  await la.close();
  // B: the Kitchen iPad in New York, one minute later
  const ny = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at + 60000 });
  const fb = await ny.openApp('kidverse', { wait: '#done:not([hidden])' }); const didPull = await pulled(fb); await sleep(1500);
  out.B_env = await fb.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toString() }));
  out.B_pulled = didPull;
  out.B_ui_before = await ui(fb);
  await fb.click('#done'); await sleep(700); out.B_flushed = await flushed(fb);
  out.B_ui_after = await ui(fb);
  out.B_row = await starsRow(L);
  out.B_mirror = await mirror(L);
  await shot(ny.page, 'verify-device-local-day-1-B-ny-ipad-after.png');
  await ny.close();
  // Both new day keys (vs. before) and the gap between their earnedAt stamps
  const newDays = Object.keys(out.B_row.days || {}).filter(k => !(out.before && out.before.days && out.before.days[k]));
  const stamps = newDays.map(k => (out.B_row.earnedAt || {})['verse:' + k]);
  out.summary = { newDays, earnedAtGapSec: stamps.length === 2 && stamps.every(Number.isFinite) ? Math.round(Math.abs(stamps[1] - stamps[0]) / 1000) : null,
    totalBefore: out.before && out.before.total, totalAfter: out.B_row.total, earnedBefore: out.before && out.before.earned, earnedAfter: out.B_row.earned };
} finally { await L.close(); }
for (const k of ['before', 'A_env', 'A_row', 'B_env', 'B_pulled', 'B_ui_before', 'B_ui_after', 'B_row', 'B_mirror', 'summary']) log(k, JSON.stringify(out[k] && out[k].earnedAt ? { ...out[k], earnedAt: undefined } : out[k]));
log('A done before/after', JSON.stringify(out.A_ui_before.done), JSON.stringify(out.A_ui_after.done));
saveJson('verify-device-local-day-1.json', out);
