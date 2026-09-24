// Skeptic #1 for "all-time-label": does the kid's stars card print the cash-in balance (s.total) as "N all time"?
// Overflow household: read Ezra's #mine .sub and the rewards bank, then a parent cashes in from Me -> Kids' rewards
// (the shipped UI, confirm() accepted), then Ezra reopens Kid Verse and we read both again.
//   node "audits/tools/phase3/kidverse/verify-all-time-label-1.mjs"
import { local, sleep, log, saveJson, row, pulled, flushed, shot, ui } from './_kv.mjs';

const out = { script: 'audits/tools/phase3/kidverse/verify-all-time-label-1.mjs' };
const L = await local({ variant: 'overflow', clock: 'real' });
try {
  const r0 = await row(L, 'ezra', 'person', 'stars');
  out.rowBefore = { count: r0.value.count, total: r0.value.total, earned: r0.value.earned, payouts: r0.value.payouts.length };
  let d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  let f = await d.openApp('kidverse', { wait: '#rewards:not([hidden])' }); await pulled(f); await sleep(1200);
  const u0 = await ui(f); out.before = { mineSub: u0.mineSub, rwTotal: u0.rwTotal, rwWeek: u0.rwWeek, rwEarned: u0.rwEarned };
  out.shotBefore = await shot(d.page, 'verify-all-time-label-1-before-ipad.png');
  await d.close();

  // a parent cashes in through the shipped Me -> Kids' rewards card
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  mom.page.on('dialog', dl => { out.confirmText = dl.message(); dl.accept(); });
  await mom.goto('#home'); await sleep(6000); await mom.page.evaluate(() => { location.hash = '#me'; });const m0 = await row(L, 'mom', 'family', 'stars:ezra'); out.mirrorBefore = m0 && { count: m0.value.count, total: m0.value.total, earned: m0.value.earned }; log('mirror before', JSON.stringify(out.mirrorBefore));
  await mom.page.waitForSelector('.reward-kid[data-kid="ezra"]', { timeout: 30000 }); await sleep(3000);
  out.momCard = await mom.page.$eval('.reward-kid[data-kid="ezra"]', e => e.textContent.replace(/\s+/g, ' ').trim()); log('mom card', out.momCard);
  await mom.page.waitForSelector('[data-cashin="ezra"]:not([disabled])', { timeout: 30000 });
  await mom.page.click('[data-cashin="ezra"]'); await sleep(1500);
  const until = Date.now() + 15000; while (Date.now() < until) { const q = await L.apiAs('mom', '/api/data/kidverse?scope=family'); const items = (q.body && q.body.items) || []; out.ledgerRows = items.filter(i => /^ledger:ezra:/.test(i.key)).length; if (out.ledgerRows > 0 && items.some(i => /^ledger:ezra:/.test(i.key) && i.value && i.value.date === new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))) break; await sleep(500); }
  await mom.close();

  d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  f = await d.openApp('kidverse', { wait: '#rewards:not([hidden])' }); await pulled(f); await sleep(2500); await flushed(f);
  const u1 = await ui(f); out.after = { mineSub: u1.mineSub, rwTotal: u1.rwTotal, rwWeek: u1.rwWeek, rwEarned: u1.rwEarned, paid: u1.paid };
  out.shotAfter = await shot(d.page, 'verify-all-time-label-1-after-cashin-ipad.png');
  await d.close();
  const r1 = await row(L, 'ezra', 'person', 'stars');
  out.rowAfter = { count: r1.value.count, total: r1.value.total, earned: r1.value.earned, payouts: r1.value.payouts.length };
} finally { await L.close(); }
log('row before', JSON.stringify(out.rowBefore));
log('ui before', JSON.stringify(out.before));
log('mirror before', JSON.stringify(out.mirrorBefore)); log('mom card', out.momCard); log('confirm', out.confirmText);
log('ui after cash-in', JSON.stringify(out.after));
log('row after', JSON.stringify(out.rowAfter));
saveJson('verify-all-time-label-1.json', out);
