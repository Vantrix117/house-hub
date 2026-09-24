// KV: the stars row after about a year of use (overflow variant: a year of history, 30 cash-ins, a reset) —
// its size, what grows, the years behind the "Jul 28"-style dates, and the bytes one Done ★ uploads.
//   node "audits/tools/phase3/kidverse/rowsize.mjs"
import { local, sleep, log, saveJson, row, pulled, flushed, shot } from './_kv.mjs';

const out = {};
const L = await local({ variant: 'overflow', clock: 'real' });
try {
  const r = await row(L, 'ezra', 'person', 'stars'); const v = r.value;
  const years = o => [...new Set(Object.values(o).map(x => String(x).slice(0, 4)))];
  out.row = { bytes: JSON.stringify(v).length, keys: { days: Object.keys(v.days).length, story: Object.keys(v.credited.story).length, prayed: Object.keys(v.credited.prayed).length, earnedAt: Object.keys(v.earnedAt).length, applied: Object.keys(v.applied).length, payouts: v.payouts.length },
    creditedSpan: { storyFirst: Object.keys(v.credited.story).sort()[0], storyLast: Object.keys(v.credited.story).sort().pop(), prayedFirst: Object.keys(v.credited.prayed).sort()[0] },
    badges: v.badges, badgeYears: years(v.badges), lastPayout: v.payouts[v.payouts.length - 1], total: v.total, earned: v.earned, count: v.count };
  out.byteShare = { credited: JSON.stringify(v.credited).length, applied: JSON.stringify(v.applied).length, payouts: JSON.stringify(v.payouts).length, earnedAt: JSON.stringify(v.earnedAt).length };
  // what one tap uploads: Kiara (verse not yet done today in overflow? use whichever kid has Done ★ available)
  for (const kid of ['ezra', 'kiara']) {
    const d = await L.device({ device: 'iphone-pwa', profile: kid, fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1200);
    if (await f.evaluate(() => document.querySelector('#done').classList.contains('today'))) { out['ui_' + kid] = await f.evaluate(() => ({ badges: [...document.querySelectorAll('#rw-badges li small')].map(s => s.textContent), paid: (document.querySelector('#rw-paid') || {}).textContent })); await d.close(); continue; }
    const sizes = []; d.page.on('request', q => { if (q.method() === 'POST' && /kidverse\/batch/.test(q.url())) sizes.push(q.postData().length); });
    await f.click('#done'); await sleep(800); await flushed(f);
    out['tap_' + kid] = { postBytes: sizes };
    await d.close();
  }
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#rewards:not([hidden])' }); await pulled(f); await sleep(1200);
  out.ui_ezra = await f.evaluate(() => ({ badges: [...document.querySelectorAll('#rw-badges li small')].map(s => s.textContent), paid: (document.querySelector('#rw-paid') || {}).textContent, mineSub: document.querySelector('#mine .sub').textContent }));
  await f.evaluate(() => document.querySelector('#rewards').scrollIntoView({ block: 'center' }));
  out.shot = await shot(d.page, 'rowsize-overflow-ezra-rewards.png');
  await d.close();
} finally { await L.close(); }
log('row', JSON.stringify(out.row));
log('byte share', JSON.stringify(out.byteShare));
log('one tap uploads', JSON.stringify({ ezra: out.tap_ezra, kiara: out.tap_kiara }));
log('ui', JSON.stringify(out.ui_ezra));
saveJson('rowsize.json', out);
