// BATCH 7 PINNED COPY of audits/tools/phase3/kidverse/critic-reset-crossweek.mjs (the phase-3 script is untouched).
// Why a copy: the original is date-dependent and proves nothing today, before or after the batch. It was written on the evening of
// Sun 27 Sep 2026 / that week against the rig's REAL clock, so its fixture ("this week" stars, the Reset week button) only exists
// that week; on any other date Me's Reset week button is disabled (this week's count is 0) and the script times out or reads undefined.
// What is pinned here: the rig runs in demo-clock mode, its Worker clock is moved to 2026-09-27T19:00:00-04:00 (L.clock) and the database re-seeded
// there (L.reset), and every browser context starts at that instant (installClock) — so the fixture week is the week the script
// was written for, on any day it is run. The scenario times it hard-codes (Sun 27 Sep 20:00 .. Mon 28 Sep 07:30) are kept as they are.
// Also changed: Reset week asks through the shared confirm sheet since batch 0i (not a native confirm(): the original never confirmed, so no
// reset row was ever written); the copy presses the sheet's button (answerSheet in _kv-7.mjs). The stars are read from the family mirror stars:<kid> (what Kid Verse writes since batch 0f; the person row
// 'stars' is only a read-only base now), and the evidence folder is EVID7 (else audits/evidence/p6/7).
// Completeness critic: a parent's Reset week that Kid Verse applies only after the ISO week has rolled over.
//   node "audits/tools/phase6/7/critic-reset-crossweek-7.mjs"          both arms (about 1.5 min)
//   node "audits/tools/phase6/7/critic-reset-crossweek-7.mjs" same|next
// Overflow variant (Ezra has a large balance, so the max(0, …) floor cannot hide a difference), real server clock.
// 1. Mom opens Home then Me (clock Sun 27 Sep 2026 20:00 New York) and taps Reset week for Ezra (confirm accepted).
// 2. same: Ezra opens Kid Verse on the Kitchen iPad the same evening (Sun 27 Sep 20:30).
//    next: Ezra does not open Kid Verse until Mon 28 Sep 07:30. Before that, Mom's Me is read again at Mon 07:00.
// Prints Me's line for Ezra, the reset ledger row, and the server stars row after Kid Verse applies the reset.
import { local, sleep, log, saveJson, shot, ui, pulled, flushed, row, answerSheet } from './_kv-7.mjs';

const PIN_ISO = '2026-09-27T19:00:00-04:00', PIN = Date.parse(PIN_ISO);
// the rig in demo-clock mode, its Worker clock moved to the pin and the data seeded there
async function pinned(variant) { const L = await local({ variant, clock: 'demo' }); await L.clock(PIN_ISO); await L.reset(variant); return L; }

const NY = s => Date.parse(s);
const stars = async L => { const v = (await row(L, 'eli', 'family', 'stars:ezra'))?.value; return v && { week: v.week, count: v.count, total: v.total, earned: v.earned, days: v.days, applied: Object.keys(v.applied || {}).length,
  creditedThisWeek: { story: Object.fromEntries(Object.entries(v.credited?.story || {}).filter(([k]) => k >= '2026-09-21' && k <= '2026-09-27')), prayed: Object.fromEntries(Object.entries(v.credited?.prayed || {}).filter(([k]) => k >= '2026-09-21' && k <= '2026-09-27')) } }; };
async function me(L, at, dialogs) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: at });
  d.page.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(600);
  await d.page.click('#tabbar .tab[data-tab="me"]');
  await d.page.waitForSelector('#rewards-body [data-resetweek="ezra"]', { timeout: 15000 }); await sleep(900);
  return d;
}
const meLine = d => d.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="ezra"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
async function arm(name) {
  const L = await pinned('overflow');
  const out = { name, dialogs: [] };
  try {
    out.s0 = await stars(L);
    const m = await me(L, NY('2026-09-27T20:00:00-04:00'), out.dialogs);
    out.meBefore = await meLine(m);
    await m.page.click('#rewards-body [data-resetweek="ezra"]'); await answerSheet(m.page); await sleep(900); await flushed(m.page);
    out.meAfter = await meLine(m);
    await m.close();
    out.ledger = ((await L.apiAs('eli', '/api/data/kidverse?scope=family&prefix=ledger:ezra:')).body.items || []).map(i => ({ key: i.key, ...i.value })).sort((a, b) => a.at - b.at).pop();
    if (name === 'next') {
      const m2 = await me(L, NY('2026-09-28T07:00:00-04:00'), out.dialogs);
      out.meMonday = await meLine(m2); await m2.close();
    }
    const at = name === 'same' ? NY('2026-09-27T20:30:00-04:00') : NY('2026-09-28T07:30:00-04:00');
    const k = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at });
    const f = await k.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(2000); await flushed(f);
    out.kid = await ui(f);
    out.s1 = await stars(L);
    await f.evaluate(() => document.querySelector('#rewards').scrollIntoView({ block: 'start' }));
    out.shot = await shot(k.page, `critic-reset-crossweek-${name}-kid-after.png`);
    await k.close();
    if (name === 'next') { const m3 = await me(L, NY('2026-09-28T08:00:00-04:00'), out.dialogs); out.meAfterKid = await meLine(m3); await m3.close(); }
  } finally { await L.close(); }
  log(`[${name}] before`, JSON.stringify(out.s0));
  log(`[${name}] Me before reset:`, out.meBefore, '| after:', out.meAfter, '| dialog:', JSON.stringify(out.dialogs[0]));
  log(`[${name}] ledger row`, JSON.stringify({ kind: out.ledger.kind, date: out.ledger.date, days: out.ledger.days }));
  if (out.meMonday) log(`[${name}] Me on Monday before Kid Verse opens:`, out.meMonday);
  log(`[${name}] after Kid Verse applies`, JSON.stringify(out.s1));
  log(`[${name}] kid sees`, JSON.stringify({ starCount: out.kid.starCount, mineSub: out.kid.mineSub, rwTotal: out.kid.rwTotal, rwEarned: out.kid.rwEarned }));
  if (out.meAfterKid) log(`[${name}] Me after Kid Verse applied:`, out.meAfterKid);
  return out;
}
const which = process.argv[2] ? [process.argv[2]] : ['same', 'next'];
const res = {}; for (const w of which) res[w] = await arm(w);
saveJson('critic-reset-crossweek' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json', res);
