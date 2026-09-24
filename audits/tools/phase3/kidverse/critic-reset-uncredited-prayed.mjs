// Completeness critic: a prayed day that Kid Verse has not credited yet when a parent taps Reset week.
//   node "audits/tools/phase3/kidverse/critic-reset-uncredited-prayed.mjs"      (about 45 s; typical, real clock)
// 1. Kiara opens Kid Verse (any pending credits are taken in), then closes it.
// 2. Kiara taps Prayed on a family card in the Prayer app (kid view). She does not open Kid Verse.
// 3. Mom opens Home then Me and taps Reset week for Kiara (confirm accepted): "This week's N stars come off".
// 4. Kiara opens Kid Verse. Is today's prayed star (earned before the reset) credited after it?
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';
const pad = n => String(n).padStart(2, '0');
const today = (() => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })();
const st = async L => { const v = (await row(L, 'kiara', 'person', 'stars'))?.value; return v && { count: v.count, total: v.total, earned: v.earned, days: v.days, prayedToday: v.credited?.prayed?.[today] ?? null, earnedAtPrayedToday: v.earnedAt?.['prayed:' + today] ?? null }; };
const out = { today, dialogs: [] };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const openKV = async () => { const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false }); const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1800); await flushed(f); return { d, f }; };
  let k = await openKV(); await k.d.close();
  out.s0 = await st(L);
  const pd = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
  const pf = await pd.openApp('prayer', { wait: '[data-kpray]' }); await sleep(1500);
  const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(x => x.getAttribute('aria-pressed') !== 'true' && x.offsetParent); return b ? b.dataset.kpray : null; });
  await pf.click(`[data-kpray="${target}"]`); await sleep(1200); await flushed(pf);
  const pr = await row(L, 'mom', 'family', 'prayer:' + target, 'prayer');
  out.prayer = { key: 'prayer:' + target, prayedByToday: pr?.value?.prayedBy?.[today] };
  await pd.close();
  out.s1_afterPrayed = await st(L);
  const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  m.page.on('dialog', dl => { out.dialogs.push(dl.message()); dl.accept(); });
  await m.goto('#home'); await m.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(600);
  await m.page.click('#tabbar .tab[data-tab="me"]'); await m.page.waitForSelector('#rewards-body [data-resetweek="kiara"]', { timeout: 15000 }); await sleep(900);
  const line = () => m.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="kiara"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
  out.meBefore = await line();
  await m.page.click('#rewards-body [data-resetweek="kiara"]'); await sleep(900); await flushed(m.page);
  out.meAfter = await line();
  out.ledger = ((await L.apiAs('eli', '/api/data/kidverse?scope=family&prefix=ledger:kiara:')).body.items || []).map(i => ({ key: i.key, ...i.value })).sort((a, b) => a.at - b.at).pop();
  await m.close();
  k = await openKV();
  out.s2_afterKidVerse = await st(L);
  out.kid = await ui(k.f);
  await k.f.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
  out.shot = await shot(k.d.page, 'critic-reset-uncredited-prayed-kiara-after.png');
  await k.d.close();
} finally { await L.close(); }
log('start (Kiara, after a Kid Verse open)', JSON.stringify(out.s0));
log('Kiara prayed', JSON.stringify(out.prayer), '| stars row unchanged:', JSON.stringify(out.s1_afterPrayed));
log('Me before reset:', out.meBefore, '| after:', out.meAfter, '| dialog:', JSON.stringify(out.dialogs[0]));
log('reset row', JSON.stringify({ date: out.ledger.date, days: out.ledger.days, at: out.ledger.at }));
log('after Kiara opens Kid Verse', JSON.stringify(out.s2_afterKidVerse));
log('Kiara sees', JSON.stringify({ starCount: out.kid.starCount, mineSub: out.kid.mineSub, rwTotal: out.kid.rwTotal }));
saveJson('critic-reset-uncredited-prayed.json', out);
