// KV: the parent ledger (Me → Kids' rewards: Cash in / Reset week) as Kid Verse applies it, through the shipped UI.
//   node "audits/tools/phase3/kidverse/ledger-rules.mjs"      (about 2 min; typical variant, real clock)
// L1 cash-in (Ezra): Mom's Me shows Ezra's balance; she taps Cash in (confirm accepted). Kid Verse (Ezra) applies it once:
//    total → 0, payout appended, applied[key]; a second open applies nothing.
// L2 cash-in in flight (Kiara): Mom's Me is loaded (balance N). Kiara then earns a verse star on the iPad (N+1). Mom, not
//    yet pulled, taps Cash in (amount N). Expected: Kiara ends with 1 to cash in.
// L3 reset in flight (Ezra): Mom taps Reset week; Ezra's iPad, not yet pulled, then taps Done ★ (earnedAt after the
//    reset's at). Expected: earlier stars this week are reset, today's verse ★ stays; a second Done ★ today is refused.
// L4 reset after today's star: Mom resets again; Kid Verse marks today 'reset'; Done ★ refuses a second star today
//    ("the day stays spent") — and what the kid sees on screen.
import { local, sleep, log, stars, saveJson, shot, ui, pulled, flushed, row } from './_kv.mjs';

const out = { dialogs: [] };
async function me(L, kid = 'ezra', sel = 'data-cashin') {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  d.page.on('dialog', dl => { out.dialogs.push(dl.message()); dl.accept(); });
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(500);
  await d.page.click('#tabbar .tab[data-tab="me"]');   // Home first, then Me: Me paints once on entry (P2-VIS-07)
  await d.page.waitForSelector(`#rewards-body [${sel}="${kid}"]:not([disabled])`, { timeout: 15000 }); await sleep(800);
  return d;
}
const meLine = (d, kid = 'ezra') => d.page.evaluate(k => { const e = document.querySelector(`#rewards-body [data-kid="${k}"]`); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, kid);
async function kv(L, who = 'ezra', dev = 'ipad-portrait') {
  const d = await L.device({ device: dev, profile: who, fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1500);
  await f.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(String(m)); return o.call(hub, m, ms); }; });
  return { d, f };
}
const ledger = async (L, kid = 'ezra') => ((await L.apiAs('eli', `/api/data/kidverse?scope=family&prefix=ledger:${kid}:`)).body.items || []).filter(i => i.value).map(i => ({ key: i.key, ...i.value })).sort((a, b) => a.at - b.at);

// L1 + L2
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    let k = await kv(L); await k.f.click('#done'); await sleep(600); await flushed(k.f); await k.d.close();   // a balance to cash in
    out.L1_0 = (await stars(L, 'ezra')).person;
    const m = await me(L); out.L1_meBefore = await meLine(m);
    await m.page.click('#rewards-body [data-cashin="ezra"]'); await sleep(900);
    out.L1_meAfter = await meLine(m); await flushed(m.page);
    out.L1_ledger = await ledger(L);
    k = await kv(L); await flushed(k.f);
    out.L1_1 = (await stars(L, 'ezra')).person; out.L1_toasts = await k.f.evaluate(() => window.__toasts); out.L1_ui = await ui(k.f);
    await k.d.close();
    k = await kv(L); out.L1_2 = (await stars(L, 'ezra')).person; await k.d.close();
    await m.close();

    out.L2_0 = (await stars(L, 'kiara')).person;
    const m2 = await me(L, 'kiara'); out.L2_meBefore = await meLine(m2, 'kiara');
    k = await kv(L, 'kiara'); await k.f.click('#done'); await sleep(700); await flushed(k.f);
    out.L2_afterStar = (await stars(L, 'kiara')).person;
    await m2.page.click('#rewards-body [data-cashin="kiara"]'); await sleep(900); await flushed(m2.page);
    out.L2_ledgerLast = (await ledger(L, 'kiara')).pop();
    await k.f.evaluate(() => hub.pull()); await sleep(1500); await flushed(k.f);
    out.L2_1 = (await stars(L, 'kiara')).person; out.L2_toasts = await k.f.evaluate(() => window.__toasts); out.L2_ui = await ui(k.f);
    await k.d.close(); await m2.close();
  } finally { await L.close(); }
}
// L3 + L4
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    out.L3_0 = (await stars(L, 'ezra')).person;
    const k = await kv(L);                            // Ezra's iPad loaded and pulled
    const m = await me(L, 'ezra', 'data-resetweek'); out.L3_meBefore = await meLine(m);
    await m.page.click('#rewards-body [data-resetweek="ezra"]'); await sleep(900); await flushed(m.page);
    out.L3_ledger = (await ledger(L)).pop();
    await k.f.click('#done'); await sleep(700);        // before the iPad has pulled the reset
    await flushed(k.f);
    await k.f.evaluate(() => hub.pull()); await sleep(1500); await flushed(k.f);
    const raw = await row(L, 'ezra', 'person', 'stars');
    out.L3_1 = { ...(await stars(L, 'ezra')).person, earnedAt: raw.value.earnedAt, days: raw.value.days, credited: raw.value.credited };
    out.L3_ui = await ui(k.f); out.L3_toasts = await k.f.evaluate(() => window.__toasts);
    await k.f.click('#done'); await sleep(700);
    out.L3_secondTap = { toasts: await k.f.evaluate(() => window.__toasts), person: (await stars(L, 'ezra')).person };
    await k.f.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
    out.L3_shot = await shot(k.d.page, 'ledger-L3-after-reset-in-flight.png');
    await m.page.click('#tabbar .tab[data-tab="home"]'); await sleep(800); await m.page.evaluate(() => hub.pull()); await sleep(1200); await m.page.click('#tabbar .tab[data-tab="me"]'); await m.page.waitForSelector('#rewards-body [data-resetweek="ezra"]:not([disabled])', { timeout: 15000 }); await sleep(1200);
    out.L4_meBefore = await meLine(m);
    await m.page.click('#rewards-body [data-resetweek="ezra"]'); await sleep(900); await flushed(m.page);
    out.L4_meAfter = await meLine(m);
    await k.f.evaluate(() => { window.__toasts = []; hub.pull(); }); await sleep(1800); await flushed(k.f);
    const raw4 = await row(L, 'ezra', 'person', 'stars');
    out.L4_1 = { ...(await stars(L, 'ezra')).person, days: raw4.value.days };
    out.L4_ui = await ui(k.f); out.L4_toastsOnApply = await k.f.evaluate(() => window.__toasts);
    await k.f.evaluate(() => { window.__toasts = []; });
    await k.f.click('#done'); await sleep(700);
    out.L4_tap = { toasts: await k.f.evaluate(() => window.__toasts), person: (await stars(L, 'ezra')).person };
    await k.f.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'start' }));
    out.L4_shot = await shot(k.d.page, 'ledger-L4-after-reset-today-spent.png');
    await k.d.close(); await m.close();
  } finally { await L.close(); }
}
const s = x => x && { total: x.total, earned: x.earned, count: x.count, payouts: x.payouts, applied: x.applied };
log('dialogs', JSON.stringify(out.dialogs));
log('L1 before', JSON.stringify(s(out.L1_0)), '| Me before:', out.L1_meBefore, '| Me after tap:', out.L1_meAfter);
log('L1 ledger', JSON.stringify(out.L1_ledger.map(l => ({ kind: l.kind, amount: l.amount, by: l.by }))));
log('L1 kid open 1', JSON.stringify(s(out.L1_1)), 'toasts', JSON.stringify(out.L1_toasts), '| paid line:', out.L1_ui.paid, '| rwTotal', out.L1_ui.rwTotal);
log('L1 kid open 2', JSON.stringify(s(out.L1_2)));
log('L2 Kiara before', JSON.stringify(s(out.L2_0)), '| Me before', out.L2_meBefore, '| after her verse star', JSON.stringify(s(out.L2_afterStar)), '| ledger', JSON.stringify({ kind: out.L2_ledgerLast.kind, amount: out.L2_ledgerLast.amount }));
log('L2 Kiara after pull', JSON.stringify(s(out.L2_1)), 'toasts', JSON.stringify(out.L2_toasts), '| rwTotal', out.L2_ui.rwTotal);
log('L3 before', JSON.stringify(s(out.L3_0)), '| Me', out.L3_meBefore, '| reset row', JSON.stringify({ date: out.L3_ledger.date, days: out.L3_ledger.days, at: out.L3_ledger.at }));
log('L3 after (star tapped before pulling the reset)', JSON.stringify({ ...s(out.L3_1), days: out.L3_1.days, earnedAt: out.L3_1.earnedAt, story: out.L3_1.credited.story }));
log('L3 ui', JSON.stringify({ done: out.L3_ui.done, starCount: out.L3_ui.starCount, mineSub: out.L3_ui.mineSub, toasts: out.L3_toasts }), '| second tap', JSON.stringify(out.L3_secondTap.toasts), 'total', out.L3_secondTap.person.total);
log('L4 Me before', out.L4_meBefore, '| after', out.L4_meAfter);
log('L4 after', JSON.stringify({ ...s(out.L4_1), days: out.L4_1.days }), '| ui', JSON.stringify({ done: out.L4_ui.done, doneToday: out.L4_ui.doneToday, starCount: out.L4_ui.starCount, mineSub: out.L4_ui.mineSub, heard: out.L4_ui.heard, storySub: out.L4_ui.storySub, toasts: out.L4_toastsOnApply }));
log('L4 tap Done', JSON.stringify(out.L4_tap.toasts), 'total', out.L4_tap.person.total);
saveJson('ledger-rules.json', out);
