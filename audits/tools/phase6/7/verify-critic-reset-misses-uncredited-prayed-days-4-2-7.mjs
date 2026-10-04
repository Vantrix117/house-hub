// BATCH 7 COPY of audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2.mjs (the phase-3 script is untouched).
// Why a copy: the original proves nothing today, before or after the batch. Reset week asks through the shared confirm sheet since
// batch 0i (not a native confirm()), so the original's click never confirmed, no reset row was ever written and it crashed reading
// the missing ledger row. The copy presses the sheet's button (answerSheet in _kv-7.mjs), keeps the REAL rig clock (a frozen demo
// Worker clock cannot tell a star earned after the reset from one before it: this scenario depends on that order) and so needs a day
// after Monday (an earlier day this week). The stars are read from the family mirror stars:<kid> (what Kid Verse writes since batch 0f;
// the person row 'stars' is a read-only base now); evidence goes to EVID7 (else audits/evidence/p6/7).
import { answerSheet } from './_kv-7.mjs';
// Skeptic #2 for critic-reset-misses-uncredited-prayed-days-4: does a parent's Reset week leave out prayed days that
// Kid Verse had not credited yet, so they come back as stars for the same week once the kid opens Kid Verse?
//   node "audits/tools/phase6/7/verify-critic-reset-misses-uncredited-prayed-days-4-2-7.mjs"   (typical, real clock, ~40 s)
// Two uncredited prayed days are tested in one run:
//   A (today, through the UI)  Kiara taps Prayed on a family card in the kid Prayer view (the ambiguous case: prayedBy
//     carries no time, so a same-day mark could also have come after the reset).
//   B (an earlier day this week, unambiguous)  a prayedBy[<earlier day>] = ['Kiara'] mark on another family card, written
//     as Kiara in the same shape apps/prayer.html:1598-1602 writes it (stands in for "Kiara prayed on Monday on the
//     Kitchen iPad and did not open Kid Verse afterwards").
// Then Mom taps Me → Kids' rewards → Reset week for Kiara (confirm accepted), and Kiara opens Kid Verse.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = process.env.EVID7 || path.join(ROOT, 'audits', 'evidence', 'p6', '7');
const NAME = 'verify-critic-reset-misses-uncredited-prayed-days-4-2-7';
fs.mkdirSync(EVID, { recursive: true });
const pad = n => String(n).padStart(2, '0');
const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = new Date(); const today = key(now);
const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const weekSoFar = []; for (let d = new Date(monday); key(d) < today; d.setDate(d.getDate() + 1)) weekSoFar.push(key(d));

const getRow = async (L, who, app, scope, k) => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(k)}`); return r.body && r.body.item ? r.body.item : null; };
const stars = async L => { const v = (await getRow(L, 'eli', 'kidverse', 'family', 'stars:kiara'))?.value; return v && { count: v.count, total: v.total, earned: v.earned, prayed: v.credited?.prayed, earnedAtPrayed: Object.fromEntries(Object.entries(v.earnedAt || {}).filter(([k]) => k.startsWith('prayed:'))), days: v.days }; };
const waitFor = async (fn, ms = 15000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn().catch(() => false)) return true; await sleep(150); } return false; };
const synced = f => waitFor(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0 && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)));
const out = { today, weekSoFar, dialogs: [] };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const openKV = async () => {
    const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' });
    await synced(f); await sleep(1500); await synced(f);
    return { d, f };
  };
  // 0. Kiara opens Kid Verse once so everything already on the prayer list is credited, then closes it.
  let k = await openKV(); await k.d.close();
  out.s0 = await stars(L);

  // B. pick an earlier day this week that Kiara has no prayed credit for, and a family card she has not prayed on that day.
  const rows = ((await L.apiAs('kiara', '/api/data/prayer?scope=family&prefix=prayer:')).body.items || []).filter(i => i.value && !i.deleted);
  const dayB = weekSoFar.find(d => !(out.s0.prayed || {})[d]);
  out.dayB = dayB || null;
  if (dayB) {
    const card = rows.find(i => !((i.value.prayedBy || {})[dayB] || []).includes('Kiara'));
    const v = JSON.parse(JSON.stringify(card.value)); v.prayedBy = v.prayedBy || {}; v.prayedBy[dayB] = [...(v.prayedBy[dayB] || []), 'Kiara'];
    const put = await L.apiAs('kiara', '/api/data/prayer/' + encodeURIComponent(card.key) + '?scope=family', { method: 'PUT', body: { value: v, updated_at: Date.now() } });
    out.markB = { key: card.key, day: dayB, status: put.status };
  }

  // A. Kiara taps Prayed today in the kid Prayer view (UI).
  const pd = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
  const pf = await pd.openApp('prayer', { wait: '[data-kpray]' }); await sleep(1500);
  const target = await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(x => x.getAttribute('aria-pressed') !== 'true' && x.offsetParent); return b ? b.dataset.kpray : null; });
  await pf.click(`[data-kpray="${target}"]`); await sleep(1200); await synced(pf);
  const pr = await getRow(L, 'mom', 'prayer', 'family', 'prayer:' + target);
  out.markA = { key: 'prayer:' + target, prayedByToday: pr?.value?.prayedBy?.[today] };
  await pd.close();
  out.s1 = await stars(L);   // unchanged: nothing credits a prayed day except Kid Verse

  // Mom resets Kiara's week from Me.
  const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  m.page.on('dialog', dl => { out.dialogs.push(dl.message()); dl.accept(); });
  await m.goto('#home'); await m.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(600);
  await m.page.click('#tabbar .tab[data-tab="me"]'); await m.page.waitForSelector('#rewards-body [data-resetweek="kiara"]', { timeout: 15000 }); await sleep(900);
  const line = () => m.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="kiara"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
  out.meBefore = await line();
  await m.page.click('#rewards-body [data-resetweek="kiara"]'); await answerSheet(m.page); await sleep(900); await synced(m.page);
  out.meAfter = await line();
  const led = ((await L.apiAs('eli', '/api/data/kidverse?scope=family&prefix=ledger:kiara:')).body.items || []).map(i => ({ key: i.key, ...i.value })).sort((a, b) => a.at - b.at).pop();
  out.reset = { date: led.date, days: led.days, at: led.at };
  await m.close();

  // Kiara opens Kid Verse again.
  k = await openKV();
  out.s2 = await stars(L);
  out.kidUi = await k.f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { starCount: t('#star-count'), mineSub: t('#mine .sub'), rwTotal: t('#rw-total'), rwWeek: t('#rw-week') }; });
  await k.f.evaluate(() => document.querySelector('#rewards')?.scrollIntoView({ block: 'center' }));
  await k.d.page.screenshot({ path: path.join(EVID, NAME + '-kiara-after.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // The Me line for Kiara as a parent sees it now.
  const m2 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  await m2.goto('#home'); await m2.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(600);
  await m2.page.click('#tabbar .tab[data-tab="me"]'); await m2.page.waitForSelector('#rewards-body [data-kid="kiara"]', { timeout: 15000 }); await sleep(900);
  out.meLater = await m2.page.evaluate(() => document.querySelector('#rewards-body [data-kid="kiara"]').textContent.replace(/\s+/g, ' ').trim());
  await m2.close();
} finally { await L.close(); }

const fmt = s => s && JSON.stringify({ count: s.count, total: s.total, earned: s.earned, prayed: s.prayed, earnedAtPrayed: s.earnedAtPrayed });
console.log('today', today, '| week so far', JSON.stringify(weekSoFar));
console.log('s0 after first Kid Verse open', fmt(out.s0));
console.log('mark B (earlier day, as Kiara via API)', JSON.stringify(out.markB));
console.log('mark A (today, Prayer UI)', JSON.stringify(out.markA));
console.log('s1 before reset', fmt(out.s1));
console.log('Me before', JSON.stringify(out.meBefore), '| dialog', JSON.stringify(out.dialogs[0]), '| Me after', JSON.stringify(out.meAfter));
console.log('reset row', JSON.stringify(out.reset));
console.log('s2 after Kiara reopens Kid Verse', fmt(out.s2));
console.log('Kiara sees', JSON.stringify(out.kidUi));
console.log('Me later', JSON.stringify(out.meLater));
fs.writeFileSync(path.join(EVID, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/kidverse/' + NAME + '.json and ' + NAME + '-kiara-after.png');
