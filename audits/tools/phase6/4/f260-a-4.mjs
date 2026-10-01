// Batch 4, Worker A: the F260 fixes the Phase 3 scripts do not reach, on the local rig (typical household, demo clock,
// WebKit): Reset names the Verses schedule and Undo brings every row back (UX-F260-2, P3-F260-16); the Journal action on
// the Today card (UX-F260-11); the catch-up line and Catch up (GAP-F260-1); "Read ahead" after today's tick (UX-F260-13);
// the hero that repeated Today (UX-F260-14); the header gear (UX-F260-8); reading mode's Close (UX-F260-4); the journal
// sort label (UX-F260-10); the Journal tab's locked state (UX-F260-3); the weeks column at the current week on wide
// screens (UX-F260-6); a week read ahead on the plan list reads "done in 1 day" when started later (P3-F260-18).
// The passcode is a throwaway value on the local demo database.
//   node "audits/tools/phase6/4/f260-a-4.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, rows, put, texts, ready } from '../../phase3/f260/_lib.mjs';

const ROOT = process.cwd();
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '4'); fs.mkdirSync(EV, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
// review round 2: never read the server after a fixed sleep — send everything the page holds, then read (p9: rows land late)
const flushed = async f => { const okk = await f.evaluate(async () => { for (let i = 0; i < 80; i++) { try { await hub.flush(); } catch (e) {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 250)); } return false; }); if (!okk) throw new Error('the page did not send its writes in 20 s'); };
const until = async (read, pred, label, ms = 15000) => { const t0 = Date.now(); let v; for (;;) { v = await read(); if (pred(v)) return v; if (Date.now() - t0 > ms) { console.log('  … timed out waiting for', label); return v; } await sleep(300); } };
const shot = (d, n) => d.page.screenshot({ path: path.join(EV, 'f260-a-' + n + '.png'), scale: 'css' });
try {
  // ── Reset → Undo ─────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## Reset says what it clears, and Undo brings it back (UX-F260-2, P3-F260-16)');
  await L.reset('typical');
  let d = await L.device({ device: 'iphone-pwa', profile: 'eli' }), f = await d.openApp('f260'); await ready(f);
  // each map as the app reads it: the old whole-map row as the base, one row per entry over it (false = off)
  const merged = (r, p, k) => { const m = Object.assign({}, (r[k] && typeof r[k] === 'object') ? r[k] : {}); for (const key of Object.keys(r)) if (key.startsWith(p)) { if (r[key] === false || r[key] == null) delete m[key.slice(p.length)]; else m[key.slice(p.length)] = r[key]; } return m; };
  const snap = async () => { const r = await rows(L, 'eli'); const done = merged(r, 'done:', 'f260.done'), mem = merged(r, 'mem:', 'f260.mem'), recall = merged(r, 'recall:', 'f260.recall'), log = merged(r, 'log:', 'f260.log');
    return { done: Object.keys(done).length, mem: Object.keys(mem).length, recall: Object.keys(recall).length, log: Object.keys(log).length, week: r['f260.week'], ws: Object.keys(r['f260.weekStart'] || {}).length, best: (r['f260.best'] || {}).n, miles: Object.keys(r['f260.miles'] || {}).length,
      box5: Object.values(recall).filter(v => v && v.box === 5).length, recallSig: JSON.stringify(Object.keys(recall).sort().map(k => [k, recall[k].box, recall[k].due, recall[k].last, recall[k].streak])) }; };
  const s0 = await snap();
  await f.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); });
  const dlg = await f.evaluate(() => document.getElementById('confirmText').textContent);
  ok(/Verses/.test(dlg) && /all your devices/.test(dlg) && /undo/i.test(dlg), 'the confirm names the Verses review schedule, all devices and the Undo', dlg);
  await f.evaluate(() => document.getElementById('doConfirm').click()); await flushed(f);
  const s1 = await until(snap, x => !x.done && !x.mem && !x.recall && !x.log, 'the reset on the server');
  ok(!s1.done && !s1.mem && !s1.recall && !s1.log, 'Reset cleared ticks, verses, the review schedule and the log on the server', s1);
  const toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  ok(/reset/i.test(toast || '') && /Undo/.test(toast || ''), 'a toast offers Undo', toast);
  await shot(d, 'reset-toast');
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await flushed(f);
  const s2 = await until(snap, x => x.done === s0.done && x.recallSig === s0.recallSig, 'the undo on the server');
  ok(s2.done === s0.done && s2.mem === s0.mem && s2.recall === s0.recall && s2.log === s0.log && s2.week === s0.week && s2.ws === s0.ws && s2.best === s0.best && s2.miles === s0.miles && s2.box5 === s0.box5 && s2.box5 > 0 && s2.recallSig === s0.recallSig, 'Undo puts every row back, each verse\'s Leitner box, due date, last and streak included', { s0: { ...s0, recallSig: s0.recallSig.length }, s2: { ...s2, recallSig: s2.recallSig.length } });
  ok((await texts(f, ['#doneCount']))['#doneCount'] === String(s0.done), 'the plan shows the progress again', await texts(f, ['#doneCount']));
  // review round 1: a reading another device ticked inside the 10 s window survives the Undo
  await f.evaluate(() => { document.getElementById('resetBtn').click(); }); await sleep(200);
  await f.evaluate(() => document.getElementById('doConfirm').click()); await flushed(f);
  // another device, after the reset: its tick, the week date and best it writes with it, and a milestone it re-earns today
  await put(L, 'eli', 'done:50-0', true); await put(L, 'eli', 'f260.weekStart', { 50: '2026-09-22' }); await put(L, 'eli', 'f260.miles', { 'first-reading': '2026-09-22' }); await put(L, 'eli', 'f260.best', { n: 1, at: '2026-09-22' });
  await f.evaluate(() => hub.pull()); await f.waitForFunction(() => hub.get('done:50-0') === true, null, { timeout: 20000 });   // another device ticks 50-0 inside the window
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await flushed(f);
  const s3 = await until(snap, x => x.recallSig === s0.recallSig, 'the second undo on the server'), r3 = await rows(L, 'eli');
  ok(r3['done:50-0'] === true && s3.done === s0.done + 1 && s3.mem === s0.mem && s3.recallSig === s0.recallSig, 'a reading ticked after the reset is kept by the Undo; everything else comes back', { done50: r3['done:50-0'], s0: s0.done, s3: s3.done });
  ok(s3.ws === s0.ws + 1 && r3['f260.weekStart']['50'] === '2026-09-22' && s3.best === s0.best && s3.miles === s0.miles && r3['f260.miles']['first-reading'] !== '2026-09-22', 'review round 2: week dates and milestones merge (week 50 from the other device stays, the old dates come back), the higher best wins', { ws: [s0.ws, s3.ws], best: [s0.best, s3.best], miles: [s0.miles, s3.miles], fr: r3['f260.miles']['first-reading'] });
  await d.close();

  // ── Today card: Read ahead, Journal, the hero, catch-up ──────────────────────────────────────────────────────────
  console.log('\n## the Today card (UX-F260-13, -11, -14; GAP-F260-1)');
  await L.reset('typical');
  { const r = await rows(L, 'eli'); const done = { ...r['f260.done'] }; delete done['30-2']; await put(L, 'eli', 'f260.done', done); }
  d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); f = await d.openApp('f260'); await ready(f);
  let t = await texts(f, ['#todayTitle', '#todayCatch', '#todayDone', '#todayJournal']);
  ok(/Missed: Week 30 · Day 3 — Malachi 2/.test(t['#todayCatch']) && /Catch up/.test(t['#todayCatch']), 'the catch-up line names the missed reading, with Catch up', t);
  ok(t['#todayDone'] === 'Done' && !/hidden/.test(t['#todayJournal']), 'Done, and a Journal action beside it', t);
  const hero = await f.evaluate(() => ({ dup: document.getElementById('hero').classList.contains('dup'), title: getComputedStyle(document.getElementById('heroTitle')).display, pace: getComputedStyle(document.getElementById('heroPace')).display, actions: getComputedStyle(document.querySelector('.hero-actions')).display }));
  ok(hero.dup && hero.title === 'none' && hero.pace !== 'none' && hero.actions !== 'none', 'the Next up hero no longer repeats the Today reading (pace and actions stay)', hero);
  await shot(d, 'today-catch');
  await f.locator('#todayCatch [data-catch]').tap(); await sleep(600);
  t = await texts(f, ['#todayTitle', '#todayMeta', '#todayCatch']);
  ok(t['#todayTitle'] === 'Malachi 2' && /catching up/.test(t['#todayMeta']) && /Not now/.test(t['#todayCatch']), 'Catch up offers Malachi 2 on the Today card', t);
  const heroNow = await f.evaluate(() => document.getElementById('hero').classList.contains('dup'));
  ok(!heroNow, 'the hero shows the current week again while Today offers the catch-up', heroNow);
  await f.locator('#todayDone').tap(); await flushed(f);
  let r = await until(() => rows(L, 'eli'), x => x['done:30-2'] === true, 'the catch-up tick');
  ok(r['done:30-2'] === true, 'Done ticks the missed reading', r['done:30-2']);
  t = await texts(f, ['#todayTitle', '#todayDone', '#todayKind', '#todayCatch']);
  ok(t['#todayTitle'] === 'Acts 6' && t['#todayDone'] === 'Read ahead' && t['#todayKind'] === 'Read today ✓' && /hidden/.test(t['#todayCatch']), 'then Today is back on Acts 6, and the button reads "Read ahead" (today is read)', t);
  await shot(d, 'read-ahead');
  // the Journal action: unlock (first time: set) and land in today's HEAR entry — the reading ticked today
  const t0 = Date.now();
  await f.locator('#todayJournal').tap(); await f.waitForSelector('#pass.on', { timeout: 15000 });
  const title = await f.evaluate(() => document.getElementById('passTitle').textContent);
  await f.fill('#pass1', '2468'); await f.fill('#pass2', '2468'); await f.locator('#passOk').tap();
  // the passcode is stretched (PBKDF2, 200k) and the vault written: slow on a busy machine, so wait for the outcome, not a time
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 30000 });
  await f.waitForFunction(() => document.getElementById('jr-30-2') && document.getElementById('jr-30-2').classList.contains('on'), null, { timeout: 30000 });
  await f.waitForFunction(() => { const b = document.getElementById('jr-30-2').getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; }, null, { timeout: 4000 }).catch(() => {});
  const jr = await f.evaluate(() => { const p = document.getElementById('jr-30-2'), b = p.getBoundingClientRect(); return { on: p.classList.contains('on'), inView: b.top < innerHeight && b.bottom > 0, focus: document.activeElement && document.activeElement.id }; });
  await f.locator('#jf-30-2-h').fill('Return to the Lord.'); await f.evaluate(() => document.getElementById('jf-30-2-h').blur()); await sleep(1200);   // an entry, so the journal list is not empty
  ok(title === 'Set a journal passcode' && jr.on && jr.inView, 'Journal: passcode, then the HEAR entry of the reading ticked today is open and in view (2 taps + the passcode)', { title, jr, ms: Date.now() - t0 });
  await shot(d, 'journal-action');
  // Journal tab while locked: the locked state, no dialog (UX-F260-3); the sort label (UX-F260-10)
  await f.evaluate(() => document.getElementById('lockBtn').click()); await sleep(300);
  await f.evaluate(() => window.scrollTo(0, 0)); await f.locator('#tabJournal').tap(); await sleep(500);
  const jt = await f.evaluate(() => ({ dialog: document.getElementById('pass').classList.contains('on'), btn: (document.querySelector('[data-unlock-view]') || {}).textContent, list: document.getElementById('jList').innerText.replace(/\s+/g, ' ').slice(0, 120) }));
  ok(!jt.dialog && jt.btn === 'Unlock', 'the Journal tab shows "Journal is locked" and an Unlock button, no dialog', jt);
  await f.locator('[data-unlock-view]').tap(); await f.waitForSelector('#pass.on'); await f.fill('#pass1', '2468'); await f.locator('#passOk').tap();
  await f.waitForFunction(() => !document.getElementById('jSort').disabled, null, { timeout: 30000 }); await sleep(300);
  const s1b = await f.evaluate(() => { const b = document.getElementById('jSort'); return b.textContent; });
  await f.evaluate(() => document.getElementById('jSort').click()); await sleep(200);
  const s2b = await f.evaluate(() => { const b = document.getElementById('jSort'); return [b.textContent, b.getAttribute('aria-label')]; });
  ok(s1b === 'Plan order' && s2b[0] === 'Newest first' && /Tap for plan order/.test(s2b[1]), 'the sort button names the order and changes with it', { s1b, s2b });
  await d.close();

  // ── the header gear, reading mode's Close ────────────────────────────────────────────────────────────────────
  console.log('\n## Settings from the header (UX-F260-8), reading mode says Close (UX-F260-4)');
  d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); f = await d.openApp('f260'); await ready(f);
  const g = await f.evaluate(() => { const b = document.getElementById('hdrSettings').getBoundingClientRect(); return { y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; });
  await f.locator('#hdrSettings').tap(); await sleep(900);
  const sh = await f.evaluate(() => { const s = document.getElementById('sheet'), b = s.getBoundingClientRect(); return { on: s.classList.contains('on'), top: Math.round(b.top), vh: innerHeight, exp: document.getElementById('settingsBtn').getAttribute('aria-expanded') }; });
  ok(g.y < 120 && g.w >= 44 && g.h >= 44 && sh.on && sh.top >= -2 && sh.top < sh.vh / 2 && sh.exp === 'true', 'a 44 px gear at the top opens Settings and brings it into view', { g, sh });
  await shot(d, 'header-gear');
  await f.evaluate(() => window.scrollTo(0, 0)); await f.evaluate(() => document.getElementById('readBtn').click()); await sleep(600);
  const rm = await f.evaluate(() => ({ exit: document.getElementById('readExit').textContent.trim(), done: document.getElementById('todayDone').textContent.trim(), reflect: getComputedStyle(document.getElementById('reflect')).display }));
  ok(rm.exit === 'Close' && rm.done !== 'Close' && rm.reflect !== 'none', 'reading mode: Close (not a second Done), and the reflections card stays', rm);
  await f.evaluate(() => document.getElementById('readExit').click()); await sleep(300);
  await flushed(f);   // reading mode is off on the server before the next device opens
  await d.close();

  // ── wide screens: the weeks column opens at the current week (UX-F260-6) ───────────────────────────────────────
  console.log('\n## the weeks column at the current week (UX-F260-6)');
  for (const dev of ['desktop', 'ipad-landscape', 'iphone-pwa']) {
    d = await L.device({ device: dev, profile: 'eli' }); f = await d.openApp('f260'); await ready(f); await sleep(500);
    const w = await f.evaluate(() => { const col = document.querySelector('.wkcol'), sec = document.getElementById('week-38'), t = document.getElementById('today').getBoundingClientRect(), s = sec.getBoundingClientRect(), c = col.getBoundingClientRect();
      return { scrollBox: col.scrollHeight > col.clientHeight + 1, weekTop: Math.round(s.top - c.top), inView: s.top >= 0 && s.top < innerHeight, todayTop: Math.round(t.top), doneInView: document.getElementById('todayDone').getBoundingClientRect().bottom <= innerHeight, pageY: scrollY, iw: innerWidth, ih: innerHeight, pos: getComputedStyle(col).position, oy: getComputedStyle(col).overflowY }; });
    if (dev === 'iphone-pwa') ok(!w.scrollBox && w.pageY === 0 && w.doneInView, 'phone: the page still opens on Today (no inner scroll box)', w);
    else ok(w.scrollBox && w.weekTop >= 0 && w.weekTop < 40 && w.inView && w.doneInView && w.pageY === 0, dev + ': the weeks column opens with Week 38 at its top, Today and Done still in view', w);
    await shot(d, 'weeks-' + dev);
    await d.close();
  }

  // ── a week read ahead on the plan list, started later (P3-F260-18) ───────────────────────────────────────────────
  console.log('\n## a week read ahead reads a real duration (P3-F260-18)');
  await L.reset('typical');
  d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); f = await d.openApp('f260'); await ready(f);
  await f.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('[data-day="39-' + i + '"] .mark').click(); }); await flushed(f);
  r = await until(() => rows(L, 'eli'), x => !!(x['f260.weekStart'] || {})['39'] && !!(x['f260.weekDone'] || {})['39'], 'week 39 dated');
  const ws = r['f260.weekStart'] || {}, wd = r['f260.weekDone'] || {};
  // two days later (the server's rows as another day would find them): Start week 39 keeps the start the first tick dated
  await put(L, 'eli', 'f260.weekStart', Object.assign({}, ws));
  await f.evaluate(() => { document.querySelectorAll('[data-day^="38-"]').forEach(x => { if (!x.classList.contains('done')) x.querySelector('.mark').click(); }); }); await sleep(800);
  await f.evaluate(() => document.querySelector('[data-next="39"]') && document.querySelector('[data-next="39"]').click()); await flushed(f);
  r = await until(() => rows(L, 'eli'), x => x['f260.week'] === 39, 'week 39 started');
  const sumt = await f.evaluate(() => (document.querySelector('#week-39 .sumt') || {}).textContent);
  ok(ws['39'] && ws['39'] === wd['39'] && r['f260.weekStart']['39'] === ws['39'] && /done in 1 day/.test(sumt || ''), 'the first tick dates the week; Start week keeps it; "done in 1 day"', { ws39: ws['39'], wd39: wd['39'], after: r['f260.weekStart']['39'], sumt });
  await d.close();
  // ── review round 3: after an Undo, readings written back are not today's; today's own reading still is ──────────────
  console.log('\n## after an Undo the day is still today\'s own, and every toast in the window keeps the Undo (review round 3)');
  await L.reset('typical');
  d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); f = await d.openApp('f260'); await ready(f);
  const today3 = await f.evaluate(() => hub.today());
  await f.locator('#todayDone').tap(); await flushed(f);                                   // Acts 6 (38-2), read today
  await f.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); }); await flushed(f);
  await f.evaluate(() => document.querySelector('[data-day="1-0"] .mark').click()); await sleep(400);   // a tick in the window earns "First reading"
  const tw = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return { text: t.textContent, hidden: t.hidden, undo: !!t.querySelector('.toast-act') }; });
  ok(!tw.hidden && /Milestone/.test(tw.text) && tw.undo, 'the milestone toast a tick in the window brings keeps the Undo', tw);
  await f.evaluate(() => document.querySelector('[data-day="1-0"] .mark').click()); await sleep(300);   // and taken back
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await flushed(f);
  // round 4: one row per Undo or restore, restored:<date>:<uid> = { ids, upTo }
  const backRows = x => Object.keys(x).filter(k => k.startsWith('restored:' + today3 + ':') && x[k] && Array.isArray(x[k].ids));
  let r4 = await until(() => rows(L, 'eli'), x => backRows(x).length === 1 && x[backRows(x)[0]].upTo > 0 && x['log:' + today3] === true && x['done:1-0'] === true, 'the undo on the server');
  const bk = r4[backRows(r4)[0]] || { ids: [] }, back4 = bk.ids;
  ok(back4.length > 100 && back4.includes('1-0') && !back4.includes('38-2') && bk.upTo > 0 && r4['log:' + today3] === true, 'the Undo records what it wrote back (restored:<date>:<uid> with upTo), but not Acts 6, read today; today stays read', { n: back4.length, has10: back4.includes('1-0'), has382: back4.includes('38-2'), upTo: bk.upTo, log: r4['log:' + today3] });
  await f.evaluate(() => document.querySelector('[data-day="38-2"] .mark').click()); await flushed(f);   // today's own reading taken back
  r4 = await until(() => rows(L, 'eli'), x => x['log:' + today3] === false, 'the untick on the server');
  const k4 = await texts(f, ['#todayKind']);
  ok(r4['log:' + today3] === false && k4['#todayKind'] !== 'Read today ✓', 'untick today\'s own reading after the Undo: the day comes off (the written-back readings do not keep it)', { log: r4['log:' + today3], k4 });
  await sleep(2600);   // repairLog runs 2 s after the last change: it must not put the day back
  r4 = await rows(L, 'eli');
  ok(r4['log:' + today3] === false, 'and repairLog leaves it off', r4['log:' + today3]);
  // round 4 (p14): a written-back reading ticked again for real counts; a later mis-tap cannot erase the day
  await sleep(1200);
  await f.evaluate(() => { const q = () => document.querySelector('[data-day="1-1"] .mark'); q().click(); q().click(); });   // re-found: the untick redraws the week await flushed(f);   // 1-1, written back: untick, tick again
  r4 = await until(() => rows(L, 'eli'), x => x['done:1-1'] === true && x['log:' + today3] === true, 'the real re-tick');
  ok(r4['done:1-1'] === true && r4['log:' + today3] === true, 'untick and tick again a written-back reading: a real tick, today is read', { d11: r4['done:1-1'], log: r4['log:' + today3] });
  await f.evaluate(() => { const q = () => document.querySelector('[data-day="38-2"] .mark'); q().click(); q().click(); }); await flushed(f);   // a mis-tap on Acts 6: tick, untick
  await sleep(2600); await flushed(f);   // and repairLog's turn
  r4 = await rows(L, 'eli');
  const rd4 = (await L.apiAs('eli', '/api/f260/readers')).body.readers || [];
  ok(r4['log:' + today3] === true && r4['done:1-1'] === true && rd4.includes('eli'), 'the mis-tap leaves the day read (the re-ticked reading counts): log, readers', { log: r4['log:' + today3], readers: rd4 });
  await d.close();
  // ── the house's own reading of an untick another device's tick outlived (P3-F260-02, review round 1) ──────────────
  console.log('\n## the readers route and the evening job count a tick an untick could not see');
  await L.reset('typical');
  { const g = await L.apiAs('christian', '/api/data/f260?scope=person&key=__none__'); const now = g.body.now, today = (await L.apiAs('christian', '/api/f260/readers')).body.date;
    const P = (key, value, at) => L.apiAs('christian', `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: at } });
    const state = async () => { const rd = await L.apiAs('christian', '/api/f260/readers'); const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
      return { reader: rd.body.readers.includes('christian'), evening: ((ev.body.checked || []).find(c => c.profile === 'christian') || {}).readToday }; };
    await P('done:45-0', true, now - 60000); await P('log:' + today, false, now - 1000);   // a tick at T1, then an untick elsewhere at T2
    const a = await state();
    ok(a.reader === true && a.evening === true, 'a reading ticked before the untick still counts: readers list Mae, the evening job reads her as read', a);
    await P('done:45-0', false, now);                                                       // that tick taken back too
    const b = await state();
    ok(b.reader === false && b.evening === false, 'with nothing ticked today the untick stands', b);
    await P('done:45-1', true, now + 1000);                                                 // a tick AFTER the untick: its own log row decides
    const c = await state();
    ok(c.reader === false && c.evening === false, 'a write after the untick (an Undo, a restore) never counts by itself', c); }
} catch (e) { fail++; console.log('  ✗ crashed:', e && e.stack || e); }
finally { await L.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
