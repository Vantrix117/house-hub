// BATCH 7 COPY of audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-1.mjs (the phase-3 script is untouched).
// Why a copy: the original proves nothing today, before or after the batch. Reset week asks through the shared confirm sheet since
// batch 0i (not a native confirm()), so the original's click never confirmed, no reset row was ever written and it crashed reading
// the missing ledger row. The copy presses the sheet's button (answerSheet in _kv-7.mjs), keeps the REAL rig clock (a frozen demo
// Worker clock cannot tell a star earned after the reset from one before it: this scenario depends on that order) and so needs a day
// after Monday (an earlier day this week). The stars are read from the family mirror stars:<kid> (what Kid Verse writes since batch 0f;
// the person row 'stars' is a read-only base now); evidence goes to EVID7 (else audits/evidence/p6/7).
// Skeptic #1 for critic-reset-misses-uncredited-prayed-days-4: does a prayed day that happened BEFORE a parent's Reset week,
// but that Kid Verse had not credited yet, get credited AFTER the reset?
//   node "audits/tools/phase6/7/verify-critic-reset-misses-uncredited-prayed-days-4-1-7.mjs"   (typical, real clock, ~40 s)
// A: Kiara taps Prayed today in the kid Prayer view (UI). B: a prayed mark for Kiara on an EARLIER day of this week
//    (Tuesday) is placed on another family prayer row via the batch API as setup, standing in for a Tuesday tap
//    (unambiguously before the reset). Kid Verse is not opened in between. Mom resets Kiara's week through Me (UI).
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row, answerSheet } from './_kv-7.mjs';
const pad = n => String(n).padStart(2, '0');
const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = new Date(); const today = key(now);
const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const tue = new Date(mon); tue.setDate(mon.getDate() + 1); const tuesday = key(tue);
const P = 'verify-critic-reset-misses-uncredited-prayed-days-4-1-7';
const st = async L => { const v = (await row(L, 'eli', 'family', 'stars:kiara'))?.value; return v && { count: v.count, total: v.total, earned: v.earned, days: v.days, prayed: v.credited?.prayed, earnedAtPrayed: Object.fromEntries(Object.entries(v.earnedAt || {}).filter(([k]) => k.startsWith('prayed:'))) }; };
const out = { today, tuesday, dialogs: [] };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const openKV = async () => { const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false }); const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1800); await flushed(f); return { d, f }; };
  let k = await openKV(); await k.d.close();
  out.s0 = await st(L);
  // A: UI tap today
  const pd = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
  const pf = await pd.openApp('prayer', { wait: '[data-kpray]' }); await sleep(1500);
  const btns = await pf.evaluate(() => [...document.querySelectorAll('[data-kpray]')].filter(x => x.offsetParent).map(x => ({ id: x.dataset.kpray, pressed: x.getAttribute('aria-pressed') })));
  const target = btns.find(b => b.pressed !== 'true')?.id;
  await pf.click(`[data-kpray="${target}"]`); await sleep(1200); await flushed(pf);
  await pd.close();
  const prA = await row(L, 'mom', 'family', 'prayer:' + target, 'prayer');
  out.A = { key: 'prayer:' + target, prayedByToday: prA?.value?.prayedBy?.[today] };
  // B: an earlier-day mark on another row (setup)
  const other = btns.find(b => b.id !== target)?.id;
  const prB = await row(L, 'kiara', 'family', 'prayer:' + other, 'prayer');
  let wroteB = null;
  if (prB && tuesday < today && !out.s0?.prayed?.[tuesday]) {
    const v = JSON.parse(JSON.stringify(prB.value)); v.prayedBy = v.prayedBy || {}; v.prayedBy[tuesday] = [...new Set([...(v.prayedBy[tuesday] || []), 'Kiara'])];
    const r = await L.apiAs('kiara', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'prayer:' + other, value: v, updated_at: Date.now() }] } });
    wroteB = r.status; out.B = { key: 'prayer:' + other, status: r.status, prayedByTuesday: (await row(L, 'kiara', 'family', 'prayer:' + other, 'prayer'))?.value?.prayedBy?.[tuesday] };
  } else out.B = { skipped: true, reason: 'no second row, or Tuesday not before today, or Tuesday already credited', s0prayed: out.s0?.prayed };
  out.s1 = await st(L);
  // Mom resets through Me
  const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  m.page.on('dialog', dl => { out.dialogs.push(dl.message()); dl.accept(); });
  await m.goto('#home'); await m.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(800);
  await m.page.click('#tabbar .tab[data-tab="me"]'); await m.page.waitForSelector('#rewards-body [data-resetweek="kiara"]', { timeout: 15000 }); await sleep(900);
  const line = () => m.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="kiara"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
  out.meBefore = await line();
  await m.page.click('#rewards-body [data-resetweek="kiara"]'); await answerSheet(m.page); await sleep(900); await flushed(m.page);
  out.meAfter = await line();
  out.ledger = ((await L.apiAs('eli', '/api/data/kidverse?scope=family&prefix=ledger:kiara:')).body.items || []).map(i => ({ key: i.key, ...i.value })).sort((a, b) => a.at - b.at).pop();
  await m.close();
  k = await openKV();
  out.s2 = await st(L);
  out.kid = await ui(k.f);
  await k.f.evaluate(() => document.querySelector('#rewards')?.scrollIntoView({ block: 'center' }));
  out.shot = await shot(k.d.page, P + '-kiara-after.png');
  await k.d.close();
  // Mom's view once the kid has applied everything
  const m2 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  await m2.goto('#home'); await m2.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(800);
  await m2.page.click('#tabbar .tab[data-tab="me"]'); await m2.page.waitForSelector('#rewards-body [data-kid="kiara"]', { timeout: 15000 }); await sleep(900);
  out.meLater = await m2.page.evaluate(() => document.querySelector('#rewards-body [data-kid="kiara"]').textContent.replace(/\s+/g, ' ').trim());
  await m2.close();
} finally { await L.close(); }
log('today', today, 'tuesday', tuesday);
log('s0 (after first Kid Verse open)', JSON.stringify(out.s0));
log('A (UI tap today)', JSON.stringify(out.A)); log('B (Tuesday mark setup)', JSON.stringify(out.B));
log('s1 (before reset; stars row untouched?)', JSON.stringify(out.s1));
log('dialog', JSON.stringify(out.dialogs)); log('Me before', out.meBefore); log('Me after', out.meAfter);
log('reset row', JSON.stringify(out.ledger));
log('s2 (after Kiara reopens Kid Verse)', JSON.stringify(out.s2));
log('Kiara UI', JSON.stringify({ starCount: out.kid.starCount, mineSub: out.kid.mineSub, rwTotal: out.kid.rwTotal, rwWeek: out.kid.rwWeek }));
log('Me later', out.meLater);
saveJson(P + '.json', out);
