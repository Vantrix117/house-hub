// Skeptic #2 for finding "all-time-label": does Kid Verse's stars card (#mine .sub, apps/kidverse.html:361) print the
// cash-in balance (s.total) as "N all time", while the rewards card (#rw-bank, :497) prints s.earned as "N ever"?
// And does the "all time" figure fall when a parent cashes in (proving it is a balance, not an all-time count)?
//   node "audits/tools/phase3/kidverse/verify-all-time-label-2.mjs"     (overflow variant, real clock, about 1 min)
// A: Ezra opens Kid Verse -> read both lines + the server row.
// B: Mom cashes in Ezra through the shipped Me -> Kids' rewards UI (confirm accepted); Ezra reopens Kid Verse -> read again.
import { local, sleep, log, saveJson, row, pulled, flushed, shot } from './_kv.mjs';

const out = { dialogs: [] };
const txt = f => f.evaluate(() => ({
  mineSub: (document.querySelector('#mine .sub') || {}).textContent || null,
  bank: ((document.querySelector('#rw-bank') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  earnedSpan: (document.querySelector('#rw-earned') || {}).textContent || null,
}));
const rowSum = async L => { const r = await row(L, 'ezra', 'person', 'stars'); const v = r && r.value; return v ? { count: v.count, total: v.total, earned: v.earned, payouts: (v.payouts || []).length } : null; };
async function kv(L) {
  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#rewards:not([hidden])' }); await pulled(f); await sleep(1500); await flushed(f);
  return { d, f };
}
const L = await local({ variant: 'overflow', clock: 'real' });
try {
  let k = await kv(L);
  out.A = { row: await rowSum(L), ui: await txt(k.f) };
  await k.f.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'start' }));
  out.A.shot = await shot(k.d.page, 'verify-all-time-label-2-A-before-cashin.png');
  await k.d.close();

  const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  m.page.on('dialog', dl => { out.dialogs.push(dl.message()); dl.accept(); });
  await m.goto('#home'); await m.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(500);
  await m.page.click('#tabbar .tab[data-tab="me"]');
  await m.page.waitForSelector('#rewards-body [data-cashin="ezra"]:not([disabled])', { timeout: 15000 }); await sleep(800);
  out.meBefore = await m.page.evaluate(() => (document.querySelector('#rewards-body [data-kid="ezra"]') || {}).textContent?.replace(/\s+/g, ' ').trim());
  await m.page.click('#rewards-body [data-cashin="ezra"]'); await sleep(900); await flushed(m.page);
  out.meAfter = await m.page.evaluate(() => (document.querySelector('#rewards-body [data-kid="ezra"]') || {}).textContent?.replace(/\s+/g, ' ').trim());
  await m.close();

  k = await kv(L);
  out.B = { row: await rowSum(L), ui: await txt(k.f) };
  await k.f.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'start' }));
  out.B.shot = await shot(k.d.page, 'verify-all-time-label-2-B-after-cashin.png');
  await k.d.close();
} finally { await L.close(); }
log('A row', JSON.stringify(out.A.row)); log('A ui', JSON.stringify(out.A.ui));
log('dialogs', JSON.stringify(out.dialogs)); log('Me before/after', out.meBefore, '|', out.meAfter);
log('B row', JSON.stringify(out.B.row)); log('B ui', JSON.stringify(out.B.ui));
saveJson('verify-all-time-label-2.json', out);
