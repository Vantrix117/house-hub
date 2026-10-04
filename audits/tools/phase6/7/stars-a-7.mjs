// Batch 7, Worker A: the stars and the week logic of Kid Verse (apps/kidverse.html, index.html's Kids' rewards) on the local rig
// (real server clock, Chromium, a controllable browser clock where a scenario needs one). Claims:
//   1  P3-KIDVERSE-12   a Reset week made on Sunday and applied on Monday (the ISO week has rolled over) clears the listed days'
//                       verse stars: on the grown-ups' side at once (Me, from the mirror) and, when Ezra's device opens, in his rows
//   2  P3-KIDVERSE-13   a story / prayed day that was heard / prayed but not yet credited when the reset was made is spent with a
//                       reset marker and never credited afterwards; a day the reset does not list is still credited
//   3  in-flight        a star earned after the reset's `at` stays whichever order the star and the reset arrive in; one earned
//                       before it is taken; "Your star for today was reset" instead of a second star
//   4  two devices      Ezra's phone and iPad that both apply the same reset end with the same rows and the same mirror, and the
//                       mirror is not rewritten by either afterwards
//   5  P3-KIDVERSE-09   a year (and two years) of facts: the mirror is bounded and equal in total/earned/badges/payouts to the
//                       exact derivation, and to an independent replay in this script; one star writes the mirror once
//   6  P3-KIDVERSE-04   the week's day marks (verse / story / prayed per day) add up to the week's count
//   7  GAP-KIDVERSE-1   the Move offer's window: Sunday 4:59 pm no, 5:00 pm yes, week set 3 days ago no, Not now remembered per
//                       adult, week 52 nothing, winter (EST) too; Move changes the week and posts the feed line
//   8  P3-KIDVERSE-05   a week change repaints the story card and its speaker at once (title and spoken text)
//   9  UX-KIDVERSE-5    no week set: no verse star, no story star, no crash on Kid Verse, the TV or Home; an adult can pick one
//  10  UX-KIDVERSE-9    an earlier year shows its year (Kid Verse's formatter, and Me's "last cash-in")
//   node "audits/tools/phase6/7/stars-a-7.mjs" [only=1,2,...]    -> audits/evidence/p6/7/stars-a-7.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '7'); fs.mkdirSync(EV, { recursive: true });
const ONLY = (process.argv.find(a => a.startsWith('only=')) || '').slice(5).split(',').filter(Boolean).map(Number);
const want = n => !ONLY.length || ONLY.includes(n);
let pass = 0, fail = 0; const out = {};
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } out[n] = { pass: !!c, ...(x === undefined ? {} : { got: x }) }; };
const head = s => console.log('\n## ' + s);

// ── the household's calendar (America/New_York), as the app counts it ─────────────────────────────────────────────
const NYF = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const NYH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
const nyDay = t => NYF.format(new Date(t));
const addDays = (d, n) => new Date(Date.UTC(...d.split('-').map((x, i) => i === 1 ? +x - 1 : +x), 0) + n * 86400000).toISOString().slice(0, 10);
const monIdx = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
const weekOf = d => { const m = addDays(d, -monIdx(d)); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); };
const nyAt = (day, hh, mm = 0) => { const [y, m, d] = day.split('-').map(Number); for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hh + off, mm); if (nyDay(t) === day && Number(NYH.format(new Date(t))) === hh) return t; } throw new Error('no NY instant ' + day); };
const isoWeek = day => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd); const yy = t.getUTCFullYear(); return yy + '-W' + String(Math.ceil(((t - Date.UTC(yy, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0'); };
const TODAY = nyDay(Date.now()), THIS_WEEK = weekOf(TODAY), NEXT_MON = addDays(THIS_WEEK[0], 7);

// ── the rig's API, as a profile ───────────────────────────────────────────────────────────────────────────────────
const path_ = (app, key, scope) => `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`;
const put = (L, who, scope, key, value, app = 'kidverse', at = Date.now()) => L.apiAs(who, path_(app, key, scope), { method: 'PUT', body: { value, updated_at: at } });
const del = (L, who, scope, key, app = 'kidverse') => L.apiAs(who, path_(app, key, scope), { method: 'DELETE' });
const items = async (L, who, scope, app = 'kidverse') => ((await L.apiAs(who, `/api/data/${app}?scope=${scope}`)).body.items || []).filter(i => i.value != null);
const rowOf = async (L, who, scope, key, app = 'kidverse') => (await items(L, who, scope, app)).find(i => i.key === key) || null;
async function batch(L, who, scope, rows, app = 'kidverse') {
  for (let i = 0; i < rows.length; i += 190) { const r = await L.apiAs(who, `/api/data/${app}/batch?scope=${scope}`, { method: 'POST', body: { items: rows.slice(i, i + 190).map(([key, value]) => ({ key, value, updated_at: Date.now() })) } }); if (r.status !== 200) throw new Error('batch ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200)); }
}
async function clearAll(L) {
  for (const k of ['ezra', 'kiara']) {
    for (const i of await items(L, k, 'person')) await del(L, k, 'person', i.key);
    for (const key of ['stars:' + k, 'story:' + k]) await del(L, k, 'family', key);
  }
  for (const i of await items(L, 'eli', 'family')) if (/^(ledger:|week$)/.test(i.key)) await del(L, 'eli', 'family', i.key);
  for (const i of await items(L, 'eli', 'family', 'prayer')) await del(L, 'eli', 'family', i.key, 'prayer');
  for (const w of ['eli', 'mom']) for (const i of await items(L, w, 'person')) if (/^(moveoffer:)/.test(i.key)) await del(L, w, 'person', i.key);
  await sleep(30);
}
const ledgerKey = (kid, t = Date.now()) => 'ledger:' + kid + ':' + t.toString(36) + '-' + Math.random().toString(36).slice(2, 6);

// ── pages ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const synced = (f, ms = 15000) => f.waitForFunction(() => window.hub && hub.sync.state === 'synced' && hub.sync.lastPull > 0 && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length), null, { timeout: ms }).catch(() => {});
async function openKV(L, profile, { clock, device = 'iphone-pwa', mode = 'light' } = {}) {
  const d = await L.device({ device, profile, mode, ...(clock ? { installClock: clock } : { fixedTime: false }) });
  const f = await d.openApp('kidverse', { wait: '#who' });
  await f.waitForFunction(() => window.kidverse && window.hub && hub.isLoaded() && (hub.profile.kind !== 'kid' || (window.kidverse.rewards && window.kidverse.rewards.deriveStars)), null, { timeout: 25000 });
  await sleep(700); await synced(f);
  await f.evaluate(() => { if (window.__w) return; window.__w = { toasts: [], sets: [], spoken: [] }; const t = hub.toast; hub.toast = (m, ms, o) => { window.__w.toasts.push(String(m)); return t.call(hub, m, ms, o); }; const s = hub.set; hub.set = function (k, v, o) { window.__w.sets.push(k); return s.apply(this, arguments); }; try { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__w.spoken.push(String(u.text)); try { return sp(u); } catch {} }; } catch {} });
  return { d, f };
}
const pull = f => f.evaluate(async () => { await hub.pull(); }).catch(() => {});
const state = f => f.evaluate(() => { const R = window.kidverse.rewards, id = hub.profile.id; return { s: R.deriveStars(), x: R.deriveStars(false), mirror: hub.get('stars:' + id, { scope: 'family' }) }; });
const keysOf = async (L, who, prefix) => (await items(L, who, 'person')).filter(i => i.key.startsWith(prefix)).map(i => i.key).sort();
const mirrorOf = async (L, kid) => (await rowOf(L, 'eli', 'family', 'stars:' + kid)) || null;
const logsBad = d => d.logs.filter(l => /^pageerror|Uncaught|TypeError|ReferenceError/.test(l));
const meLine = async (d, kid = 'ezra') => { await d.page.click('#tabbar .tab[data-tab="me"]'); await d.page.waitForSelector('#rewards-body [data-kid="' + kid + '"]', { timeout: 20000 }); await sleep(600); return d.page.evaluate(k => document.querySelector('#rewards-body [data-kid="' + k + '"]').textContent.replace(/\s+/g, ' ').trim(), kid); };
const markCount = s => { let n = 0; for (const d of weekOf(TODAY)) { if (s.days[d] === true) n++; if (s.credited.story[d] === true) n++; if (s.credited.prayed[d] === true) n++; } return n; };

const L = await local({ variant: 'empty', clock: 'real', engine: 'chromium' });
try {
  // ══ 1 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(1)) {
    head('1 · a Reset week made Sunday, applied Monday: the verse stars go (P3-KIDVERSE-12)');
    await L.reset('empty'); await clearAll(L);
    const wk = THIS_WEEK, base = Date.now() - 3 * 3600e3;
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: base - 6 * 86400000 });
    await batch(L, 'ezra', 'person', wk.slice(1, 5).map((d, i) => ['star:verse:' + d, { at: base + i * 1000 }]));   // Tue-Fri of this ISO week
    // Ezra opens on Sunday evening: his mirror carries the four verse days
    let k = await openKV(L, 'ezra', { clock: nyAt(wk[6], 20, 0) });
    let st = await state(k.f);
    ok(st.s.total === 4 && st.s.earned === 4 && wk.slice(1, 5).every(d => st.s.days[d] === true), 'before the reset: 4 verse stars, balance 4', { total: st.s.total, days: Object.keys(st.s.days) });
    await synced(k.f); await k.d.close();
    const m0 = await mirrorOf(L, 'ezra');
    ok(m0 && m0.value.total === 4 && wk.slice(1, 5).every(d => m0.value.days[d] === true), 'the mirror holds the days', m0 && m0.value.days);
    // Mom (the parent) resets on Sunday evening; the row lists this week's days up to that day
    const key = ledgerKey('ezra'), at = Date.now();
    await put(L, 'eli', 'family', key, { kind: 'reset', date: wk[6], days: wk, by: 'eli', at });
    // ... and reads Me on Monday morning, before Ezra's device has opened Kid Verse
    const mon = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: nyAt(NEXT_MON, 7, 0) });
    await mon.goto('#home'); await mon.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(700);
    const line = await meLine(mon);
    ok(/Ezra ★0 to cash in · 0 this week/.test(line), 'Monday, before Ezra opens Kid Verse: Me already shows ★0 to cash in (the display applies the reset to last week\'s days)', line);
    await mon.close();
    // Ezra opens on Monday
    k = await openKV(L, 'ezra', { clock: nyAt(NEXT_MON, 7, 30) });
    st = await state(k.f); await synced(k.f);
    const resets = await keysOf(L, 'ezra', 'reset:'), applied = await keysOf(L, 'ezra', 'applied:');
    ok(st.s.total === 0 && st.x.total === 0 && st.s.earned === 4, 'Ezra\'s own derivation: balance 0, earned 4 (nothing is un-earned)', { total: st.s.total, earned: st.s.earned });
    ok(JSON.stringify(resets) === JSON.stringify(wk.slice(1, 5).map(d => 'reset:verse:' + d).sort()) && applied.length === 1, 'one reset marker per cleared verse day and the reset applied once', { resets, applied });
    const mrow = await rowOf(L, 'ezra', 'person', 'reset:verse:' + wk[1]);
    ok(mrow && mrow.value.at === at && mrow.value.by === key, 'the reset marker carries the ledger row\'s own time (at) and key (by)', mrow && mrow.value);
    const m1 = await mirrorOf(L, 'ezra');
    ok(m1 && m1.value.total === 0 && wk.slice(1, 5).every(d => m1.value.days[d] === 'reset') && m1.value.count === 0, 'the mirror agrees: total 0, the four days read reset, 0 this week', m1 && { total: m1.value.total, days: m1.value.days });
    await k.d.close();
  }

  // ══ 2 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(2)) {
    head('2 · a story / prayed day not yet credited when the reset is made is spent, never credited afterwards (P3-KIDVERSE-13)');
    await L.reset('empty'); await clearAll(L);
    const wk = THIS_WEEK, lastSun = addDays(wk[0], -1);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    await put(L, 'ezra', 'person', 'heard:' + isoWeek(TODAY) + ':' + TODAY, true);                                   // heard today, not credited yet (the app was not open)
    await put(L, 'eli', 'family', 'prayer:a7-p1', { id: 'a7-p1', title: 'A', text: 'A', updates: [], prayedBy: { [TODAY]: ['ezra'], [lastSun]: ['ezra'] }, by: 'eli', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, 'prayer');
    const key = ledgerKey('ezra'); const at = Date.now();
    await put(L, 'eli', 'family', key, { kind: 'reset', date: TODAY, days: wk.filter(d => d <= TODAY), by: 'eli', at });
    let k = await openKV(L, 'ezra');
    let st = await state(k.f); await synced(k.f);
    const stars = await keysOf(L, 'ezra', 'star:'), resets = await keysOf(L, 'ezra', 'reset:');
    ok(resets.includes('reset:story:' + TODAY) && resets.includes('reset:prayed:' + TODAY), 'the heard day and the prayed day (listed, uncredited) are spent with reset markers', { resets });
    ok(!stars.includes('star:story:' + TODAY) && !stars.includes('star:prayed:' + TODAY), 'and no star row was written for them', { stars });
    ok(lastSun >= wk[0] || stars.includes('star:prayed:' + lastSun), 'a prayed day the reset does not list (last Sunday) is credited as usual', { stars, lastSun });
    ok(st.s.credited.story[TODAY] === 'reset' && st.s.credited.prayed[TODAY] === 'reset' && st.s.count === 0, 'the stars object shows both days as reset, 0 this week', { story: st.s.credited.story, prayed: st.s.credited.prayed, count: st.s.count });
    const total1 = st.s.total, earned1 = st.s.earned;
    await k.d.close();
    // opened again later (a fresh page, a pull): still not credited, the balance never goes back up
    k = await openKV(L, 'ezra'); await pull(k.f); await sleep(800); st = await state(k.f); await synced(k.f);
    ok(!(await keysOf(L, 'ezra', 'star:')).some(x => x.endsWith(TODAY) && /story|prayed/.test(x)) && st.s.total === total1 && st.s.earned === earned1 && st.s.count === 0, 'reopened: still no story / prayed star for today, balance and earned unchanged', { total: st.s.total, total1 });
    // the story speaker's line and the stars card agree (B draws it): after the reset the grown-ups' view of the mirror
    const m = await mirrorOf(L, 'ezra');
    ok(m.value.credited.story[TODAY] === 'reset' && m.value.credited.prayed[TODAY] === 'reset', 'the mirror carries the spent days as reset', m.value.credited);
    out.badgeStoryHint = await k.f.evaluate(() => hub.profile && window.kidverse.rewards.creditedCount(window.kidverse.rewards.deriveStars(), 'story'));
    await k.d.close();
  }

  // ══ 3 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(3)) {
    head('3 · a star earned while the reset is in flight stays; one earned before it goes (both arrival orders)');
    await L.reset('empty'); await clearAll(L);
    const d1 = addDays(TODAY, -1);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    await put(L, 'ezra', 'person', 'star:verse:' + d1, { at: Date.now() - 3 * 3600e3 });
    // (a) the reset is already there, then the star: Ezra opens (yesterday's star is taken), then taps Done
    const keyA = ledgerKey('ezra'), atA = Date.now();
    await put(L, 'eli', 'family', keyA, { kind: 'reset', date: TODAY, days: [d1, TODAY], by: 'eli', at: atA });
    let k = await openKV(L, 'ezra');
    let st = await state(k.f);
    ok(st.s.days[d1] === 'reset' && st.s.total === 0, '(a) yesterday\'s star was earned before the reset: taken (balance 0)', { days: st.s.days, total: st.s.total });
    await sleep(50);
    const okA = await k.f.evaluate(() => window.kidverse.award());
    await sleep(500); st = await state(k.f); await synced(k.f);
    ok(okA === true && st.s.days[TODAY] === true && st.s.total === 1 && st.s.count >= 1, '(a) today\'s star, earned after the reset\'s `at`, stays: balance 1', { okA, days: st.s.days, total: st.s.total });
    const toastBefore = (await k.f.evaluate(() => window.__w.toasts)).length;
    const again = await k.f.evaluate(() => window.kidverse.award()); const tt = await k.f.evaluate(() => window.__w.toasts.slice());
    ok(again === false && /already/i.test(tt[tt.length - 1] || '') && tt.length > toastBefore, '(a) a second tap is the usual "already have today\'s star"', tt.slice(-2));
    const mA = await mirrorOf(L, 'ezra');
    ok(mA.value.total === 1 && mA.value.days[TODAY] === true && mA.value.days[d1] === 'reset', '(a) the mirror: total 1, today lit, yesterday reset', { total: mA.value.total, days: mA.value.days });
    // (b) the star is on the device first and the reset reaches it later, stamped BEFORE the star: the star stays
    const keyB = ledgerKey('ezra', Date.now() + 5), atB = Date.now() - 60000;
    await put(L, 'eli', 'family', keyB, { kind: 'reset', date: TODAY, days: [TODAY], by: 'eli', at: atB });
    await pull(k.f); await sleep(900); st = await state(k.f); await synced(k.f);
    ok(st.s.days[TODAY] === true && st.s.total === 1 && (await keysOf(L, 'ezra', 'reset:')).length === 1, '(b) a reset stamped before today\'s star arrives later: the star stays (balance 1, one marker only)', { days: st.s.days, total: st.s.total });
    // (c) one stamped AFTER the star takes it, and then "Your star for today was reset" instead of a second star
    const keyC = ledgerKey('ezra', Date.now() + 9), atC = Date.now() + 2000;
    await put(L, 'eli', 'family', keyC, { kind: 'reset', date: TODAY, days: [TODAY], by: 'eli', at: atC });
    await pull(k.f); await sleep(900); st = await state(k.f); await synced(k.f);
    ok(st.s.days[TODAY] === 'reset' && st.s.total === 0, '(c) a reset stamped after the star takes it: today reads reset, balance 0', { days: st.s.days, total: st.s.total });
    const r3 = await k.f.evaluate(() => window.kidverse.award()); const t3 = await k.f.evaluate(() => window.__w.toasts.slice(-1)[0]);
    ok(r3 === false && /star for today was reset/i.test(t3 || ''), '(c) Done again says "Your star for today was reset", never a second star', t3);
    ok((await keysOf(L, 'ezra', 'star:verse')).length === 2, '(c) no new star row was written', await keysOf(L, 'ezra', 'star:verse'));
    await k.d.close();
  }

  // ══ 4 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(4)) {
    head('4 · two devices apply the same reset: the same rows, the same mirror, no rewrite war');
    await L.reset('empty'); await clearAll(L);
    const wk = THIS_WEEK;
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    await put(L, 'ezra', 'person', 'heard:' + isoWeek(TODAY) + ':' + TODAY, true);
    await put(L, 'eli', 'family', 'prayer:a7-p2', { id: 'a7-p2', title: 'B', text: 'B', updates: [], prayedBy: { [TODAY]: ['ezra'] }, by: 'eli', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, 'prayer');
    const old = Date.now() - 4 * 3600e3;
    await batch(L, 'ezra', 'person', [['star:verse:' + addDays(TODAY, -1), { at: old }], ['star:verse:' + addDays(TODAY, -2), { at: old }]]);
    await put(L, 'eli', 'family', ledgerKey('ezra'), { kind: 'reset', date: TODAY, days: wk.filter(d => d <= TODAY).concat([addDays(TODAY, -1), addDays(TODAY, -2)]).filter((d, i, a) => a.indexOf(d) === i), by: 'eli', at: Date.now() });
    const [a, b] = await Promise.all([openKV(L, 'ezra', { device: 'iphone-pwa' }), openKV(L, 'ezra', { device: 'ipad-portrait' })]);
    await sleep(1500); await synced(a.f); await synced(b.f);
    await pull(a.f); await pull(b.f); await sleep(1200); await synced(a.f); await synced(b.f);
    const sa = await state(a.f), sb = await state(b.f);
    const rows = { reset: await keysOf(L, 'ezra', 'reset:'), applied: await keysOf(L, 'ezra', 'applied:'), star: await keysOf(L, 'ezra', 'star:') };
    ok(JSON.stringify(sa.s) === JSON.stringify(sb.s) && JSON.stringify(sa.s) === JSON.stringify(JSON.parse(JSON.stringify(sa.s))), 'both devices derive the identical stars object', { a: sa.s.total, b: sb.s.total });
    ok(rows.applied.length === 1 && rows.reset.length >= 2 && !rows.star.some(x => x.endsWith(TODAY) && /story|prayed/.test(x)), 'one applied row, the markers written once each, no story / prayed star for the spent day', rows);
    const m1 = await mirrorOf(L, 'ezra'); await pull(a.f); await pull(b.f); await sleep(1500); await synced(a.f); await synced(b.f); const m2 = await mirrorOf(L, 'ezra');
    ok(m1 && m2 && m1.updated_at === m2.updated_at && JSON.stringify(m1.value) === JSON.stringify(m2.value), 'the mirror is not rewritten by either device after settling (same updated_at)', { u1: m1 && m1.updated_at, u2: m2 && m2.updated_at });
    await a.d.close(); await b.d.close();
  }

  // ══ 5 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(5)) {
    head('5 · a year and two years of facts: the mirror is bounded and every total equals the exact derivation (P3-KIDVERSE-09)');
    const sizes = {};
    for (const years of [1, 2]) {
      await L.reset('empty'); await clearAll(L);
      await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
      const days = Array.from({ length: 365 * years }, (_, i) => addDays(TODAY, -(i + 1)));
      const rows = [], ev = []; let verse = 0, story = 0, prayed = 0;
      days.forEach((d, i) => {
        const t = nyAt(d, 18);
        if ((i * 7) % 10 < 8) { rows.push(['star:verse:' + d, { at: t }]); ev.push({ t, star: 1 }); verse++; }
        if (i % 3 !== 0) { rows.push(['star:story:' + d, { at: t + 1 }]); ev.push({ t: t + 1, star: 1 }); story++; }
        if (i % 4 === 0) { rows.push(['star:prayed:' + d, { at: t + 2 }]); ev.push({ t: t + 2, star: 1 }); prayed++; }
      });
      // a cash-in every 28 days (ledger row by the parent + the kid's applied row), amount 10; the badges too
      const cash = [];
      for (let i = 20; i < days.length; i += 28) { const d = days[i], at = nyAt(d, 20), key = ledgerKey('ezra', at); cash.push([key, { kind: 'cashin', date: d, amount: 10, by: 'eli', at }]); rows.push(['applied:' + key, { kind: 'cashin', amount: 10, date: d, by: 'eli', at }]); ev.push({ t: at, cash: 10 }); }
      for (const [k, v] of cash) await put(L, 'eli', 'family', k, v);
      rows.push(['badge:first', days[days.length - 1]], ['badge:ten', days[days.length - 1]], ['badge:story', days[days.length - 1]], ['badge:prayer', days[days.length - 1]], ['badge:fifty', days[days.length - 1]]);
      await batch(L, 'ezra', 'person', rows);
      // the independent replay (no resets in this dataset): stars add one, a cash-in takes its amount off, never below 0
      ev.sort((a, b) => a.t - b.t || (a.star ? -1 : 1)); let total = 0; for (const e of ev) total = e.star ? total + 1 : Math.max(0, total - e.cash);
      const k = await openKV(L, 'ezra'); const st = await state(k.f); await synced(k.f); await sleep(500);
      const m = await mirrorOf(L, 'ezra'); const size = JSON.stringify(m.value).length, unp = JSON.stringify(st.x).length;
      sizes[years] = size - JSON.stringify(m.value.payouts).length;   // the payouts list is capped at 50 (it grows to that, then stops); the rest must not grow at all
      ok(m.value.total === total && st.s.total === total && st.x.total === total, `${years} y: the balance ${total} equals an independent replay (folded, exact and the mirror)`, { mirror: m.value.total, folded: st.s.total, exact: st.x.total, total });
      ok(m.value.earned === verse + story + prayed && st.x.earned === verse + story + prayed, `${years} y: earned ${verse + story + prayed} = every star ever`, { mirror: m.value.earned, want: verse + story + prayed });
      const ccs = await k.f.evaluate(() => { const R = window.kidverse.rewards, a = R.deriveStars(), b = R.deriveStars(false); return { folded: { story: R.creditedCount(a, 'story'), prayed: R.creditedCount(a, 'prayed') }, exact: { story: R.creditedCount(b, 'story'), prayed: R.creditedCount(b, 'prayed') } }; });
      ok(ccs.folded.story === story && ccs.folded.prayed === prayed && ccs.exact.story === story && ccs.exact.prayed === prayed, `${years} y: the story (${story}) and prayed (${prayed}) badge counts survive the folding`, ccs);
      ok(JSON.stringify(st.s.badges) === JSON.stringify(st.x.badges) && JSON.stringify(st.s.payouts) === JSON.stringify(st.x.payouts) && st.s.count === st.x.count, `${years} y: badges, payouts (${st.s.payouts.length}) and this week's count are equal folded vs exact`, { b: st.s.badges, p: st.s.payouts.length });
      ok(size < 7000, `${years} y: the mirror is ${size} bytes (< 7000; the exact derivation is ${unp})`, { size, unp });
      const keep = k.f.evaluate(() => { const s = window.kidverse.rewards.deriveStars(); return { days: Object.keys(s.days).length, story: Object.keys(s.credited.story).length, prayed: Object.keys(s.credited.prayed).length, applied: Object.keys(s.applied).length, earnedAt: Object.keys(s.earnedAt).length, base: s.creditedBase, appliedBefore: s.appliedBefore }; });
      out['shape' + years] = await keep;
      await k.d.close();
    }
    ok(Math.abs(sizes[2] - sizes[1]) / sizes[1] < 0.05, `the size does not grow with time (payouts, capped at 50, left out): 1 y ${sizes[1]} B, 2 y ${sizes[2]} B`, sizes);
    // a year with resets: folded vs exact in the page
    await L.reset('empty'); await clearAll(L);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    const days = Array.from({ length: 365 }, (_, i) => addDays(TODAY, -(i + 1))), rows = [];
    days.forEach((d, i) => { const t = nyAt(d, 18); if (i % 5 !== 0) rows.push(['star:verse:' + d, { at: t }]); if (i % 3 === 0) rows.push(['star:story:' + d, { at: t + 1 }]); if (i % 4 === 1) rows.push(['star:prayed:' + d, { at: t + 2 }]); });
    const led = []; for (let i = 6; i < days.length; i += 56) { const d = days[i], at = nyAt(d, 20), key = ledgerKey('ezra', at); led.push([key, { kind: 'reset', date: d, days: Array.from({ length: 7 }, (_, j) => addDays(d, -j)), by: 'eli', at }]); }
    for (let i = 20; i < days.length; i += 28) { const d = days[i], at = nyAt(d, 21), key = ledgerKey('ezra', at); led.push([key, { kind: 'cashin', date: d, amount: 7, by: 'eli', at }]); }
    for (const [k, v] of led) await put(L, 'eli', 'family', k, v);
    await batch(L, 'ezra', 'person', rows);
    const k = await openKV(L, 'ezra'); await sleep(2500); await synced(k.f);
    const st = await state(k.f); const m = await mirrorOf(L, 'ezra');
    const same = ['total', 'earned', 'count'].every(f => st.s[f] === st.x[f]) && JSON.stringify(st.s.badges) === JSON.stringify(st.x.badges) && JSON.stringify(st.s.payouts) === JSON.stringify(st.x.payouts);
    ok(same && m.value.total === st.x.total && m.value.earned === st.x.earned, `a year with ${led.filter(l => l[1].kind === 'reset').length} resets and ${led.filter(l => l[1].kind === 'cashin').length} cash-ins: folded = exact (total ${st.x.total}, earned ${st.x.earned})`, { s: [st.s.total, st.s.earned, st.s.count], x: [st.x.total, st.x.earned, st.x.count], mirror: [m.value.total, m.value.earned] });
    ok(JSON.stringify(m.value).length < 7000, `…and the mirror is ${JSON.stringify(m.value).length} bytes`, JSON.stringify(m.value).length);
    // one star = one mirror write (the badge it completes rides in the same one)
    await k.d.close();
    await L.reset('empty'); await clearAll(L);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    const k2 = await openKV(L, 'ezra');
    const r = await k2.f.evaluate(() => { window.__w.sets.length = 0; const ok = window.kidverse.award(); return { ok, sets: window.__w.sets.slice() }; });
    await sleep(600); await synced(k2.f);
    ok(r.ok === true && r.sets.filter(x => x === 'stars:ezra').length === 1 && r.sets.includes('star:verse:' + TODAY) && r.sets.includes('badge:first'), 'Done ★ on a first star: the star row, the badge row and the mirror ONCE', r.sets);
    const r2 = await k2.f.evaluate(() => { window.__w.sets.length = 0; window.kidverse.rewards.reconcile(); window.kidverse.rewards.reconcile(); return window.__w.sets.slice(); });
    ok(r2.length === 0, 'reconcile again changes nothing and writes nothing', r2);
    await k2.d.close();
  }

  // ══ 6 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(6)) {
    head('6 · the week\'s day marks add up to the count (P3-KIDVERSE-04)');
    await L.reset('empty'); await clearAll(L);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    const wk = THIS_WEEK, t = Date.now() - 3600e3;
    const rows = [['star:verse:' + wk[0], { at: t }], ['star:story:' + wk[0], { at: t }], ['star:prayed:' + wk[0], { at: t }], ['star:story:' + wk[2], { at: t }], ['star:verse:' + wk[3], { at: t }], ['star:prayed:' + wk[5], { at: t }], ['star:verse:' + addDays(wk[0], -3), { at: t }]];
    await batch(L, 'ezra', 'person', rows);
    const k = await openKV(L, 'ezra'); const st = await state(k.f); await synced(k.f);
    const n = markCount(st.s);
    const dom = await k.f.evaluate(() => [...document.querySelectorAll('#mine .day[data-marks], #mine [data-marks]')].map(e => (e.dataset.marks || '').split(',').filter(Boolean).length).reduce((a, b) => a + b, 0));
    ok(st.s.count === n && st.s.count === 6, `the derived week count ${st.s.count} = the marks per day (verse + story + prayed) ${n}; last week's star is not in it`, { count: st.s.count, n });
    ok(dom === 0 || dom === n, `the dots on screen carry the same ${n} marks (data-marks)`, { dom, n });
    const adult = await openKV(L, 'mom');
    const mir = await adult.f.evaluate(() => hub.get('stars:ezra', { scope: 'family' }));
    ok(mir && markCount(mir) === 6 && mir.count === 6, 'the grown-ups\' copy (the mirror the panel and the shell read) carries the same 6 marks', mir && mir.count);
    await k.d.close(); await adult.d.close();
  }

  // ══ 7 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(7)) {
    head('7 · the Move-to-next-week offer: its window and who it is for (GAP-KIDVERSE-1)');
    await L.reset('empty'); await clearAll(L);
    // a Sunday in summer time (EDT) and one in winter (EST), the week set on the Monday before (6.4 days earlier)
    const sunEDT = '2026-10-04', monEDT = '2026-09-28', sunEST = '2026-12-06', monEST = '2026-11-30';
    const k = await openKV(L, 'eli');
    const setWeekRow = async (week, at) => { await put(L, 'eli', 'family', 'week', { week, by: 'eli', at }); await pull(k.f); await sleep(500); };
    const offer = (ms) => k.f.evaluate(ms => window.kidverse.moveOffer(ms), ms);
    for (const [label, sun, mon] of [['EDT', sunEDT, monEDT], ['EST', sunEST, monEST]]) {
      await setWeekRow(38, nyAt(mon, 9, 0));
      const o1 = await offer(nyAt(sun, 16, 59) + 59000), o2 = await offer(nyAt(sun, 17, 0)), o3 = await offer(nyAt(sun, 17, 0) - 1);
      ok(o1 === null && o3 === null, `${label}: Sunday 4:59:59 pm New York -> no offer`, { o1, o3 });
      ok(o2 && o2.from === 38 && o2.to === 39 && /\d/.test(o2.ref), `${label}: Sunday 5:00 pm -> "Move to week 39?" (${o2 && o2.ref})`, o2);
      const sat = await offer(nyAt(addDays(sun, -1), 20, 0));
      ok(sat === null, `${label}: Saturday evening -> no offer`, sat);
    }
    await setWeekRow(38, nyAt(addDays(sunEDT, -3), 9, 0));
    ok((await offer(nyAt(sunEDT, 17, 30))) === null, 'the week was set 3 days ago (Thursday) -> no offer on Sunday evening', await offer(nyAt(sunEDT, 17, 30)));
    await setWeekRow(38, nyAt(sunEDT, 18, 0));
    ok((await offer(nyAt(addDays(sunEDT, 7), 16, 59))) === null && (await offer(nyAt(addDays(sunEDT, 7), 17, 0))) !== null, 'set on Sunday 6 pm: the next offer is the NEXT Sunday 5 pm (4:59 no, 5:00 yes)', null);
    await setWeekRow(38, nyAt(monEDT, 9, 0));
    // review round 1: the offer only ever STARTS on a Sunday at 5 pm New York, whenever the week was set. Every day of four weeks (summer
    // time, winter time, the weeks the clocks change) x eight hours: moveOfferFrom(at) is a Sunday 17:00, more than 5 days after `at`,
    // and the Sunday before it is not (so it is the FIRST such Sunday).
    {
      const hours = [0, 6, 9, 12, 16, 17, 18, 23], ats = [];
      for (const mon of ['2026-09-28', '2026-10-26', '2026-11-30', '2027-03-08']) for (let i = 0; i < 7; i++) for (const h of hours) { try { ats.push(nyAt(addDays(mon, i), h, h === 17 ? 0 : 30)); } catch {} }
      const froms = await k.f.evaluate(a => a.map(t => window.kidverse.moveOfferFrom(t)), ats);
      const NYP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
      const parts = t => Object.fromEntries(NYP.formatToParts(new Date(t)).map(p => [p.type, p.value]));
      const DAY7 = 7 * 86400000, FIVE = 5 * 86400000, bad = [];
      ats.forEach((at, i) => { const p = parts(froms[i]), prev = froms[i] - DAY7; const sunday5 = p.weekday === 'Sun' && Number(p.hour) === 17 && Number(p.minute) === 0; const pp = parts(prev); if (!sunday5 || !(froms[i] > at + FIVE) || (Number(pp.hour) === 17 && prev > at + FIVE && pp.weekday === 'Sun')) bad.push({ at: new Date(at).toISOString(), from: new Date(froms[i]).toISOString(), p }); });
      ok(ats.length >= 200 && bad.length === 0, `${ats.length} week-set instants (every day x 8 hours, EDT, EST and both clock-change weeks): the offer starts only on a Sunday at 5:00 pm, more than 5 days after, and it is the first such Sunday`, bad.slice(0, 3));
      // and through the real moveOffer(): set Sunday 4 pm -> nothing Friday, nothing Saturday, nothing the Sunday after 4:59, yes 5:00
      await setWeekRow(38, nyAt('2026-10-04', 16, 0));
      const q = [await offer(nyAt('2026-10-04', 16, 30)), await offer(nyAt('2026-10-09', 16, 15)), await offer(nyAt('2026-10-10', 12, 0)), await offer(nyAt('2026-10-11', 16, 59)), await offer(nyAt('2026-10-11', 17, 0))];
      ok(q[0] === null && q[1] === null && q[2] === null && q[3] === null && q[4] && q[4].to === 39, 'week set Sunday 4 pm: not offered that afternoon, not on Friday, not on Saturday, not at 4:59 the next Sunday; offered at 5:00', q);
      await setWeekRow(38, nyAt(monEDT, 9, 0));
    }
    // Not now: remembered per adult per week (a person row), survives a reload; the other adult still sees it
    const before = await offer(nyAt(sunEDT, 17, 0));
    await k.f.evaluate(() => window.kidverse.moveOfferDismiss()); await sleep(400); await synced(k.f);
    ok(before && (await offer(nyAt(sunEDT, 17, 0))) === null && (await keysOf(L, 'eli', 'moveoffer:')).join() === 'moveoffer:38', 'Not now writes the person row moveoffer:38 and hides the offer', await keysOf(L, 'eli', 'moveoffer:'));
    await k.d.close();
    const k2 = await openKV(L, 'eli');
    ok((await k2.f.evaluate(ms => window.kidverse.moveOffer(ms), nyAt(sunEDT, 17, 0))) === null, 'after a reload (a new page) Not now is still remembered', null);
    const mom = await openKV(L, 'mom');
    ok((await mom.f.evaluate(ms => window.kidverse.moveOffer(ms), nyAt(sunEDT, 17, 0))) !== null, 'it is per adult: Mom (who has not said Not now) is still offered it', null);
    const kid = await openKV(L, 'ezra');
    ok((await kid.f.evaluate(ms => window.kidverse.moveOffer(ms), nyAt(sunEDT, 17, 0))) === null, 'a kid is never offered it', null);
    // Move: the week changes (with the house clock as `at`), the feed line posts, the offer is gone
    await mom.f.evaluate(ms => window.kidverse.moveOfferAccept(ms), nyAt(sunEDT, 17, 0)); await sleep(600); await synced(mom.f);
    const wrow = (await rowOf(L, 'eli', 'family', 'week')).value;
    ok(wrow.week === 39 && wrow.by === 'mom' && Math.abs(wrow.at - Date.now()) < 120000, 'Move writes week 39 with `at` now', wrow);
    const feed = (await L.apiAs('eli', '/api/activity?limit=10')).body.activity.map(a => a.profile_id + ': ' + a.text);
    ok(feed.some(l => /^mom: Kid Verse is now week 39: /.test(l)), 'and the feed says "Kid Verse is now week 39: <ref>"', feed);
    ok((await mom.f.evaluate(ms => window.kidverse.moveOffer(ms), nyAt(addDays(sunEDT, 1), 9, 0))) === null, 'right after, no new offer (the week was just set)', null);
    await put(L, 'eli', 'family', 'week', { week: 52, by: 'eli', at: nyAt(monEDT, 9, 0) }); await pull(mom.f); await sleep(500);
    ok((await mom.f.evaluate(ms => window.kidverse.moveOffer(ms), nyAt(sunEDT, 17, 0))) === null, 'week 52 offers nothing', null);
    for (const x of [k2, mom, kid]) await x.d.close();
  }

  // ══ 8 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(8)) {
    head('8 · a week change repaints the story card and its speaker at once (P3-KIDVERSE-05)');
    await L.reset('empty'); await clearAll(L);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 2 * 86400000 });
    const k = await openKV(L, 'eli');
    const read = () => k.f.evaluate(() => ({ week: hub.get('week', { scope: 'family' }).week, verse: document.querySelector('#ref').textContent.trim(), title: document.querySelector('#story-title').textContent.trim(), span: document.querySelector('#story-span').textContent.trim(), label: document.querySelector('#story-say').getAttribute('aria-label'), STORIES: window.kidverse.STORIES.map(s => s.t) }));
    let r = await read();
    ok(r.title === r.STORIES[37] && /Week 38/.test(r.span), 'week 38: the story card is "' + r.title + '"', r);
    await k.f.click('#week-up'); await sleep(250);          // no pull, no reload: the device's own write must repaint it
    r = await read();
    ok(r.week === 39 && r.title === r.STORIES[38] && /Week 39/.test(r.span) && r.label.includes(r.STORIES[38]) && /James 1:2-4/.test(r.verse), 'one + later: the verse (James 1:2-4) AND the story card ("' + r.title + '") and its speaker label are week 39', r);
    await k.f.click('#story-say'); await sleep(400);
    const spoken = await k.f.evaluate(() => window.__w.spoken.slice());
    ok(spoken.some(t => t.includes(r.STORIES[38])) && !spoken.some(t => t.includes(r.STORIES[37])), 'the story speaker speaks week 39\'s story', spoken.map(t => t.slice(0, 70)));
    await k.f.evaluate(() => speechSynthesis.cancel());
    await k.f.click('#week-down'); await sleep(250);
    r = await read(); ok(r.week === 38 && r.title === r.STORIES[37], 'and back down: the card follows the minus too', r);
    await synced(k.f);
    const feed = (await L.apiAs('eli', '/api/activity?limit=10')).body.activity.map(a => a.text);
    ok(feed.filter(t => /^Kid Verse is now week /.test(t)).length === 2 && feed.some(t => /^Kid Verse is now week 39: /.test(t)), 'each real change posted one feed line (2 lines for 2 steps)', feed);
    await k.d.close();
  }

  // ══ 9 ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(9)) {
    head('9 · no family week set: no verse star, no story star, no crash, an adult can pick one (UX-KIDVERSE-5)');
    await L.reset('empty'); await clearAll(L);
    // Ezra prayed on the family list today: praying does not depend on the verse week, so that star still counts
    await put(L, 'eli', 'family', 'prayer:a7-nw', { id: 'a7-nw', title: 'N', text: 'N', updates: [], prayedBy: { [TODAY]: ['ezra'] }, by: 'eli', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, 'prayer');
    const kid = await openKV(L, 'ezra');
    const r = await kid.f.evaluate(async () => ({ set: window.kidverse.weekSet(), award: window.kidverse.award(), heard: window.kidverse.heard(), toasts: window.__w.toasts.slice() }));
    await sleep(500); await synced(kid.f);
    ok(r.set === false && r.award === false && r.heard === false, 'a kid with no week: weekSet() false, award() false, heard() false', r);
    ok(r.toasts.filter(t => /grown-up needs to pick/.test(t)).length === 2, 'each refusal is the calm "A grown-up needs to pick this week\'s verse first."', r.toasts);
    const starKeys = await keysOf(L, 'ezra', 'star:');
    ok(JSON.stringify(starKeys) === JSON.stringify(['star:prayed:' + TODAY]) && (await keysOf(L, 'ezra', 'heard:')).length === 0, 'no verse star, no story star and no heard row — but the star for praying on the family list (not tied to the verse week) is still credited', starKeys);
    const m9 = await mirrorOf(L, 'ezra'); ok(m9 && m9.value.credited.prayed[TODAY] === true && m9.value.earned === 1 && m9.value.count === 1 && Object.keys(m9.value.days).length === 0 && Object.keys(m9.value.credited.story).length === 0, 'the mirror: 1 prayed star this week, no verse day, no story day', m9 && m9.value);
    ok(logsBad(kid.d).length === 0, 'Kid Verse as a kid, no week: no page error', logsBad(kid.d));
    await kid.d.close();
    const eli = await openKV(L, 'eli');
    const a = await eli.f.evaluate(() => ({ set: window.kidverse.weekSet(), offer: window.kidverse.moveOffer() }));
    ok(a.set === false && a.offer === null && logsBad(eli.d).length === 0, 'an adult with no week: weekSet() false, no Move offer, no page error', { a, logs: logsBad(eli.d) });
    await eli.f.evaluate(() => window.kidverse.setWeek(14)); await sleep(500); await synced(eli.f);
    const w = await rowOf(L, 'eli', 'family', 'week');
    ok(w && w.value.week === 14 && (await eli.f.evaluate(() => window.kidverse.weekSet())), 'setWeek(14) from "no week" writes the family week', w && w.value);
    const feed = (await L.apiAs('eli', '/api/activity?limit=5')).body.activity.map(x => x.text);
    ok(feed.some(t => /^Kid Verse is now week 14: /.test(t)), 'and posts the feed line', feed);
    await eli.d.close();
    await del(L, 'eli', 'family', 'week');
    const home = await L.device({ device: 'ipad-portrait', profile: 'tv', fixedTime: false }); await home.goto(''); await sleep(3500);
    const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false }); await mom.goto('#home'); await sleep(3500);
    const ezra = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false }); await ezra.goto('#home'); await sleep(3500);
    ok(logsBad(home).length === 0 && logsBad(mom).length === 0 && logsBad(ezra).length === 0, 'the TV board, an adult\'s Home and a kid\'s Home with no week: no page error', { tv: logsBad(home), mom: logsBad(mom), ezra: logsBad(ezra) });
    for (const d of [home, mom, ezra]) await d.close();
  }

  // ══ 11 ═════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(11)) {
    head('11 · a reset marker never takes a star another device stamped AFTER the reset (review round 1, item 4)');
    await L.reset('empty'); await clearAll(L);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 6 * 86400000 });
    const k = await openKV(L, 'ezra');
    const r = await k.f.evaluate(() => {
      const rw = window.kidverse.rewards, today = hub.today(), now = Date.now() + (hub.skew || 0), key = 'ledger:ezra:' + now.toString(36) + '-a7m';
      const before = rw.deriveStars(false);
      hub.set('applied:' + key, { kind: 'reset', date: today, by: 'eli', at: now }, { scope: 'person' });
      hub.set('star:prayed:' + today, { at: now + 60000 }, { scope: 'person' });                       // stamped a minute AFTER the reset
      hub.set('reset:prayed:' + today, { by: key, at: now }, { scope: 'person' });                      // the marker another device wrote for it, with the reset's time
      const withAt = rw.deriveStars(false);
      hub.set('reset:prayed:' + today, { by: key }, { scope: 'person' });                              // the same marker as an OLDER app wrote it: no `at`
      const noAt = rw.deriveStars(false);
      hub.set('star:story:' + today, { at: now - 60000 }, { scope: 'person' });                         // a star stamped BEFORE the reset is still taken by its marker
      hub.set('reset:story:' + today, { by: key, at: now }, { scope: 'person' });
      const earlier = rw.deriveStars(false);
      return { before: { total: before.total, earned: before.earned }, withAt: { prayed: withAt.credited.prayed[today], total: withAt.total, earned: withAt.earned, count: withAt.count }, noAt: { prayed: noAt.credited.prayed[today], total: noAt.total, earned: noAt.earned }, earlier: { story: earlier.credited.story[today], total: earlier.total } };
    });
    ok(r.withAt.prayed === true && r.withAt.total === 1 && r.withAt.earned === 1 && r.withAt.count === 1, 'a marker {by, at} on a star stamped after its `at`: the star stays (credited, balance 1)', r.withAt);
    ok(r.noAt.prayed === 'reset' && r.noAt.total === 0 && r.noAt.earned === 1, 'an older marker without `at` still takes it (balance 0, earned stays 1)', r.noAt);
    ok(r.earlier.story === 'reset' && r.earlier.total === 0, 'a star stamped before the reset is taken by its marker', r.earlier);
    await k.d.close();
  }

  // ══ 10 ═════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (want(10)) {
    head('10 · an earlier year shows its year (UX-KIDVERSE-9)');
    await L.reset('empty'); await clearAll(L);
    const yr = TODAY.slice(0, 4), last = String(+yr - 1);
    await put(L, 'eli', 'family', 'week', { week: 38, by: 'eli', at: Date.now() - 2 * 86400000 });
    const kid = await openKV(L, 'ezra');
    const f = await kid.f.evaluate(([a, b]) => ({ old: window.kidverse.fmtDay(a), cur: window.kidverse.fmtDay(b) }), [last + '-07-28', yr + '-01-05']);
    ok(f.old.includes(last) && !f.cur.includes(yr), `Kid Verse: ${last}-07-28 reads "${f.old}", ${yr}-01-05 reads "${f.cur}"`, f);
    // a payout from last year, then one from this year: the grown-ups' Me says "last cash-in 3 on <date>"
    const k1 = ledgerKey('ezra', Date.now() - 1000), at1 = nyAt(last + '-03-01', 12);
    await put(L, 'eli', 'family', k1, { kind: 'cashin', date: last + '-03-01', amount: 3, by: 'eli', at: at1 });
    await put(L, 'ezra', 'person', 'star:verse:' + TODAY, { at: Date.now() - 3600e3 });
    await kid.f.evaluate(() => hub.pull()); await sleep(1200); await synced(kid.f);
    const rw = await kid.f.evaluate(() => { const e = document.querySelector('#rw-paid'); return e ? e.textContent.trim() : null; });
    ok(rw && rw.includes(last), 'My rewards: "' + rw + '"', rw);
    const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
    await mom.goto('#home'); await mom.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(700);
    let line = await meLine(mom);
    ok(new RegExp('last cash-in 3 on [A-Z][a-z]{2} 1, ' + last).test(line), 'Me → Kids\' rewards: "' + line.slice(line.indexOf('last cash-in')) + '"', line);
    const k2 = ledgerKey('ezra', Date.now()), at2 = Date.now();
    await put(L, 'eli', 'family', k2, { kind: 'cashin', date: TODAY, amount: 1, by: 'eli', at: at2 });
    await kid.f.evaluate(() => hub.pull()); await sleep(1500); await synced(kid.f);
    await mom.page.evaluate(() => hub.pull()); await sleep(1500);
    line = await meLine(mom);
    ok(/last cash-in 1 on [A-Z][a-z]{2} \d{1,2}(?!,)/.test(line) && !new RegExp('last cash-in 1 on [^·]*' + yr).test(line), 'a payout from this year has no year: "' + line.slice(line.indexOf('last cash-in')) + '"', line);
    await mom.close(); await kid.d.close();
  }
} finally {
  await L.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
fs.writeFileSync(path.join(EV, 'stars-a-7.json'), JSON.stringify({ pass, fail, out }, null, 1));
process.exit(fail ? 1 : 0);
