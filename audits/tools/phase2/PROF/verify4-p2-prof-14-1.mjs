// PROF skeptic #1 (round 4) for P2-PROF-14 — "future-stamped writes make other people's edits silently revert for up to 5 min".
// One chain, shipped UI only (taps and the Edit sheet in Prayer's family list; no hand-made API writes), on a fresh local
// instance (real worker/src on in-memory SQLite; nothing touches production). The API is only READ here, to see the server row.
//
//   node "audits/tools/phase2/PROF/verify4-p2-prof-14-1.mjs"
//
// Devices (each its own paired device and session):
//   A  Dad's iPad, clock +180 s (Playwright installClock, flows in real time). Opens Prayer online once (cache warm), then is
//      reopened OFFLINE (a new page session: hub.skew = 0) and taps "Mark prayed" on three family rows (P1-P3) and edits the
//      title of a fourth (P5, from the List screen) — all stamped ~180 s ahead — then reconnects.
//      All five rows are picked with server stamps in the PAST: the 'typical' seed on the real clock plants some family prayer
//      rows hours ahead (ev.rigNote), which the Worker's +5 min clamp makes impossible in production.
//   M  Mae's iPad, correct clock, same offline-reopen routine, marks one family row prayed (CONTROL writer).
//   B  Mom's phone, correct clock, online, Prayer open on the family list since before A reconnects (stale cache, inside
//      its 30 s poll). Edits the title of A's row (P1) and of Mae's row (P4). Later, after a pull, edits A's P5 and retries P1.
//   C  Eli's phone, correct clock, opened online then OFFLINE for minutes (stale cache). Edits P2 at ~T0+45 s (inside A's
//      offset) and P3 after A's stamp has passed, then reconnects.
// Writes audits/evidence/p2/PROF/verify4-p2-prof-14-1.json and 1× screenshots verify4-p2-prof-14-1-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const NAME = 'verify4-p2-prof-14-1';
const OFFSET = 180e3;
const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const ev = { at: new Date().toISOString(), offset_s: OFFSET / 1000, steps: [], batches: [] };
const log = (name, o) => { ev.steps.push({ name, t_rel_s: T0 ? +((Date.now() - T0) / 1000).toFixed(1) : null, ...o }); console.log(`\n## ${name}\n` + Object.entries(o).map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')); };
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
let T0 = 0;

const L = await local({ variant: 'typical', clock: 'real' });

// ── helpers ──
const srv = async id => {
  const r = await L.apiAs('eli', `/api/data/prayer?scope=family&key=${encodeURIComponent('prayer:' + id)}`);
  const it = r.body.item, v = it && it.value;
  return { title: v && v.title, prayedToday: v && v.prayedBy ? v.prayedBy[TODAY] || [] : [], lastPrayedAt: v && v.lastPrayedAt, updated_at: it && it.updated_at, aheadOfServerNow_s: it ? +((it.updated_at - r.body.now) / 1000).toFixed(1) : null };
};
const cached = (f, id) => f.evaluate(([id, today]) => {
  const key = 'prayer:' + id;
  const r = hub.list(key, { scope: 'family' }).find(x => x.key === key);
  const q = (JSON.parse(localStorage.getItem('hub.queue.prayer.family') || '{}'))[key];
  return { title: r && r.value.title, prayedToday: r && r.value.prayedBy ? r.value.prayedBy[today] || [] : [], t: r && r.updated_at,
    queued: q ? { title: q.value && q.value.title, updated_at: q.updated_at } : null,
    sync: hub.sync.state, lastError: hub.sync.lastError, lastPull: hub.sync.lastPull, skew: hub.skew, deviceNow: Date.now() };
}, [id, TODAY]);
const rowUI = (f, id) => f.evaluate(id => {
  const b = document.querySelector(`#todayList [data-pray="${id}"]`) || document.querySelector(`#allList [data-pray="${id}"]`); const li = b && b.closest('li');
  if (!li) return null;
  const who = li.querySelector('.who');
  const toast = document.getElementById('toast');
  return { title: li.querySelector('.title').childNodes[0].textContent, markedPrayed: b.getAttribute('aria-pressed'), whoPrayed: who ? who.getAttribute('aria-label') : null,
    toast: toast && toast.classList.contains('on') ? toast.textContent.trim() : null };
}, id);
const queueLen = f => f.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.prayer.family') || '{}')).length);
async function waitQueueEmpty(f, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (!(await queueLen(f))) return true; await sleep(150); } return false; }
function watchBatches(d, who) {
  d.page.on('response', async r => {
    if (!/\/api\/data\/prayer\/batch\?scope=family/.test(r.url())) return;
    try { const j = await r.json(); ev.batches.push({ who, t_rel_s: T0 ? +((Date.now() - T0) / 1000).toFixed(1) : null, status: r.status(), results: (j.results || []).filter(x => x.key.startsWith('prayer:')).map(x => ({ key: x.key, applied: x.applied, title: x.value && x.value.title, prayedToday: x.value && x.value.prayedBy ? x.value.prayedBy[TODAY] : null })) }); } catch {}
  });
}
async function openPrayerFamily(d) {
  const f = await d.openApp('prayer');
  await f.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && document.querySelector('#listSwitch [data-list="shared"]'), null, { timeout: 20000 });
  if ((await f.getAttribute('#listSwitch [data-list="shared"]', 'aria-pressed')) !== 'true') await f.locator('#listSwitch [data-list="shared"]').click();
  await f.waitForFunction(() => document.body.classList.contains('shared') && document.querySelector('#todayList [data-pray]'), null, { timeout: 10000 });
  await sleep(600);
  return f;
}
async function reopenOffline(d) {
  await d.setOffline(true);
  await d.page.reload({ waitUntil: 'load' });
  let f = null; const until = Date.now() + 15000;
  while (Date.now() < until && !(f = d.frame('prayer'))) await sleep(100);
  await f.waitForFunction(() => window.hub && hub.profile && document.body.classList.contains('shared') && document.querySelector('#todayList [data-pray]'), null, { timeout: 15000 });
  await d.setOffline(true);
  await sleep(500);
  return f;
}
async function markPrayed(f, id) {
  await f.locator(`#todayList [data-pray="${id}"]`).click();
  await f.waitForFunction(id => document.querySelector(`#todayList [data-pray="${id}"]`).getAttribute('aria-pressed') === 'true', id, { timeout: 5000 });
}
// The Edit sheet, as a person uses it: open the row, Edit, change the title, Save (the app re-opens the row's sheet), Done.
async function editTitle(f, id, makeTitle, { shot, list = false } = {}) {
  if (list) {
    await f.locator('nav [data-go="all"]').click();
    const cat = f.locator('#allList details.cat', { has: f.locator(`[data-open="${id}"]`) });
    if (!(await cat.evaluate(d => d.open))) await cat.locator('summary > span').first().click();
    await f.locator(`#allList [data-open="${id}"]`).click();
  } else await f.locator(`#todayList [data-open="${id}"]`).first().click();
  await f.locator(`#sheetInner [data-edit="${id}"]`).click();
  const before = await f.inputValue('#e-title');
  const title = makeTitle(before);
  await f.fill('#e-title', title);
  await f.locator(`#sheetInner [data-esave="${id}"]`).click();
  await f.waitForSelector(`#sheetInner [data-edit="${id}"]`, { timeout: 5000 });
  const sheetShows = (await f.textContent('#sheetInner h1')).trim();
  const savedAt = Date.now();
  if (shot) { await sleep(700); await shot(); }
  await f.locator('#sheetInner [data-shut]').click();
  if (list) await f.locator('nav [data-go="today"]').click();
  return { before, title, sheetShows, savedAt, closedAt: Date.now() };
}
const shot = (d, tag) => async () => { const file = path.join(OUT, `${NAME}-${tag}.png`); await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' }); ev.screens = [...(ev.screens || []), path.relative(ROOT, file).replace(/\\/g, '/')]; };

try {
  const dDad = await L.newDevice({ name: 'Dad iPad (fast clock)', profiles: ['dad'] });
  const dMae = await L.newDevice({ name: 'Mae iPad', profiles: ['christian'] });
  const dMom = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const dEli = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });

  // ── A: Dad's iPad, clock 180 s fast. Warm the cache online, then reopen offline (new page session, skew 0). ──
  const A = await L.device({ device: 'ipad-portrait', profile: 'dad', as: dDad, installClock: Date.now() + OFFSET });
  watchBatches(A, 'dad');
  let fA = await openPrayerFamily(A);
  const aOnline = await fA.evaluate(() => ({ skew_s: +(hub.skew / 1000).toFixed(1), deviceNow: Date.now() }));
  const unprayed = await fA.evaluate(() => [...document.querySelectorAll('#todayList [data-pray]')].filter(b => b.getAttribute('aria-pressed') === 'false').map(b => b.dataset.pray));
  const onToday = await fA.evaluate(() => [...document.querySelectorAll('#todayList [data-pray]')].map(b => b.dataset.pray));
  const famAll = await L.apiAs('eli', '/api/data/prayer?scope=family');
  const famNow = famAll.body.now;
  ev.rigNote = { seededFamilyPrayerRowsStampedAheadOfServer: famAll.body.items.filter(i => i.updated_at > famNow + 300e3).map(i => ({ key: i.key, ahead_s: Math.round((i.updated_at - famNow) / 1000) })) };
  const past = id => { const it = famAll.body.items.find(i => i.key === 'prayer:' + id); return it && it.updated_at < famNow; };
  const P5 = (famAll.body.items.find(i => i.value && i.value.status === 'active' && !onToday.includes(i.value.id) && i.updated_at < famNow) || {}).value?.id;
  if (unprayed.length < 4 || !P5 || !unprayed.slice(0, 4).every(past)) throw new Error('need 4 unprayed past-stamped rows on Today + 1 off Today: ' + unprayed + ' / ' + P5);
  const [P1, P2, P3, P4] = unprayed;
  ev.rows = { P1, P2, P3, P4, P5, TODAY };
  log('A0. Dad iPad (clock +180 s) opened Prayer online: hub learnt the skew from its pull', { rigNote: ev.rigNote, ...aOnline, deviceAheadOfReal_s: +((aOnline.deviceNow - Date.now()) / 1000).toFixed(1), rows: ev.rows });
  const before = {}; for (const id of [P1, P2, P3, P4, P5]) before[id] = await srv(id);
  log('Server rows before', before);

  fA = await reopenOffline(A);
  const aOff = await fA.evaluate(() => ({ skew: hub.skew, sync: hub.sync.state, onLine: navigator.onLine, deviceNow: Date.now() }));
  for (const id of [P1, P2, P3]) await markPrayed(fA, id);
  const dadEdit = await editTitle(fA, P5, t => t + ' (Dad: update from Sunday)', { list: true });
  // the page's Date.now() is the fast device clock; "real" is the node clock (= the server's)
  const realNow = Date.now();
  const aQueueReal = await fA.evaluate(() => Object.entries(JSON.parse(localStorage.getItem('hub.queue.prayer.family') || '{}')).filter(([k]) => k.startsWith('prayer:')).map(([k, q]) => [k, q.updated_at]));
  log('A1. Dad reopened Prayer OFFLINE (before any pull in this page session) and, through the UI, marked P1-P3 prayed and edited P5\'s title', {
    ...aOff, deviceAheadOfReal_s: +((aOff.deviceNow - Date.now()) / 1000).toFixed(1), dadEditTitle: dadEdit.title,
    queued: aQueueReal.map(([k, t]) => ({ key: k, stampAheadOfReal_s: +((t - realNow) / 1000).toFixed(1) })) });

  // ── M: Mae's iPad, correct clock, same routine (the control writer) ──
  const M = await L.device({ device: 'ipad-portrait', profile: 'christian', as: dMae, fixedTime: false });
  watchBatches(M, 'mae');
  let fM = await openPrayerFamily(M);
  fM = await reopenOffline(M);
  await markPrayed(fM, P4);
  log('M1. Mae (correct clock) reopened Prayer offline and marked P4 prayed', { skew: await fM.evaluate(() => hub.skew), queuedP4: (await cached(fM, P4)).queued });

  // ── C: Eli's phone, correct clock, opened online, then offline (stale cache for minutes) ──
  const C = await L.device({ device: 'iphone-pwa', profile: 'eli', as: dEli, fixedTime: false });
  watchBatches(C, 'eli');
  const fC = await openPrayerFamily(C);
  await C.setOffline(true);

  // ── B: Mom's phone, correct clock, online with Prayer open on the family list ──
  const B = await L.device({ device: 'iphone-pwa', profile: 'mom', as: dMom, fixedTime: false });
  watchBatches(B, 'mom');
  const fB = await openPrayerFamily(B);
  const bOpenedAt = Date.now();
  log('B0. Mom opened Prayer online (family list); her copy of P1 and P4 before anyone reconnects', { P1: await cached(fB, P1), P4: await cached(fB, P4), shellLastPull: await B.page.evaluate(() => hub.sync.lastPull) });

  // ── Dad and Mae reconnect: their queued rows land ──
  await A.setOffline(false); await M.setOffline(false);
  const okA = await waitQueueEmpty(fA), okM = await waitQueueEmpty(fM);
  T0 = Date.now();
  const landed = {}; for (const id of [P1, P2, P3, P4, P5]) landed[id] = await srv(id);
  log('T0. Dad and Mae back online; their queues flushed', { dadQueueEmpty: okA, maeQueueEmpty: okM, sinceMomOpened_s: +((T0 - bOpenedAt) / 1000).toFixed(1), server: landed, dadSkewNow_s: +((await fA.evaluate(() => hub.skew)) / 1000).toFixed(1) });

  // ── B edits P1 (Dad's future-stamped row) and P4 (Mae's correct-clock row) with her stale copy ──
  const bP1pre = await cached(fB, P1), bP4pre = await cached(fB, P4);
  const staleProof = { P1: { momCachedT: bP1pre.t, serverT: landed[P1].updated_at, momHasDadsWrite: (bP1pre.prayedToday || []).includes('David') }, P4: { momCachedT: bP4pre.t, serverT: landed[P4].updated_at, momHasMaesWrite: (bP4pre.prayedToday || []).includes('Mae') }, momFrameLastPullBeforeT0: bP1pre.lastPull < T0, momShellLastPull: await B.page.evaluate(() => hub.sync.lastPull) };
  const momP1 = await editTitle(fB, P1, t => t + ' (Mom: her teacher says she is settling in)', { shot: shot(B, 'mom-p1-saved') });
  const momP4 = await editTitle(fB, P4, t => t + ' (Mom: baby due in March)');
  await waitQueueEmpty(fB);
  await sleep(500);
  const afterFlush = { P1: { server: await srv(P1), momCache: await cached(fB, P1) }, P4: { server: await srv(P4), momCache: await cached(fB, P4) } };
  log('B1. Mom (stale, inside her 30 s poll) edited P1 and P4 through the Edit sheet; after her flush', { staleProof, momP1, momP4, ...afterFlush });

  // what Mom's screen does after she tapped Done: Prayer absorbs the adopted row (deferred while a sheet is open)
  const t0 = Date.now(); let revertMs = null, ui = null;
  while (Date.now() - t0 < 15000) { ui = await rowUI(fB, P1); if (ui && ui.title === landed[P1].title) { revertMs = Date.now() - momP1.closedAt; break; } await sleep(200); }
  const uiP4 = await rowUI(fB, P4);
  await fB.locator(`#todayList [data-pray="${P1}"]`).scrollIntoViewIfNeeded();
  await shot(B, 'mom-p1-reverted')();
  log('B2. Mom\'s screen after Done', { P1_row: ui, P1_revertedOnScreen_ms_after_Done: revertMs, P4_row: uiP4, momFrameSync: await fB.evaluate(() => ({ state: hub.sync.state, lastError: hub.sync.lastError, pending: hub.sync.pending })), momShellSync: await B.page.evaluate(() => ({ state: hub.sync.state, lastError: hub.sync.lastError })) });

  // ── B after her next pull: an edit on another of Dad's future-stamped rows (P5), and a retry of P1 ──
  await fB.waitForFunction(t => hub.sync.lastPull > t, T0 + 500, { timeout: 45000 });
  const bP5pre = await cached(fB, P5), s5pre = await srv(P5);
  const momP5 = await editTitle(fB, P5, t => t + ' (Mom: and from Tuesday)', { list: true });
  const momRetry = await editTitle(fB, P1, t => t + ' (Mom again: teacher says she is settling in)');
  await waitQueueEmpty(fB); await sleep(400);
  log('B3. After Mom\'s next pull (Dad\'s stamps still ahead): Mom edits P5, and retries P1', { momPulledAt_rel_s: +((bP5pre.lastPull - T0) / 1000).toFixed(1), P5_serverBefore: s5pre, momP5, P5_server: await srv(P5), momRetry, P1_server: await srv(P1) });

  // ── C: Eli, offline since before T0 ──
  const c2at = T0 + 45e3; while (Date.now() < c2at) await sleep(250);
  const eliP2 = await editTitle(fC, P2, t => t + ' (Eli: exam results come out Monday)');
  const s3 = await srv(P3);
  log('C1. Eli (offline, stale) edited P2 at ~T0+45 s', { eliP2, P2_server_now: await srv(P2), P3_server_now: s3, eliQueued: (await cached(fC, P2)).queued });
  while (Date.now() < s3.updated_at + 8000) await sleep(500);
  const eliP3 = await editTitle(fC, P3, t => t + ' (Eli: they start the new church plant soon)');
  await C.setOffline(false);
  await waitQueueEmpty(fC); await sleep(600);
  log('C2. Eli edited P3 after Dad\'s P3 stamp had passed, then reconnected', { eliP3, P2_server: await srv(P2), P3_server: await srv(P3), eliP2cache: await cached(fC, P2), eliP3cache: await cached(fC, P3), eliSync: await fC.evaluate(() => ({ state: hub.sync.state, lastError: hub.sync.lastError })) });

  // ── Final: every device pulled; is anything kept anywhere? ──
  const tEnd = Date.now();
  for (const [d, f] of [[A, fA], [M, fM], [B, fB], [C, fC]]) await f.waitForFunction(t => hub.sync.lastPull > t, tEnd, { timeout: 45000 }).catch(() => {});
  await sleep(4500);   // Prayer's deferred absorb
  const lost = ['(Mom: her teacher says she is settling in)', '(Eli: exam results come out Monday)'];
  const anywhere = async (d) => d.page.evaluate(lost => Object.fromEntries(lost.map(s => [s, Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').includes(s))])), lost);
  const fam = (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items;
  const onServer = Object.fromEntries(lost.map(s => [s, fam.filter(i => JSON.stringify(i.value || '').includes(s)).map(i => i.key)]));
  const finalRows = {}; for (const id of [P1, P2, P3, P4, P5]) finalRows[id] = await srv(id);
  const ui2 = {}; for (const [who, f] of [['dad', fA], ['mae', fM], ['mom', fB], ['eli', fC]]) ui2[who] = Object.fromEntries(await Promise.all([P1, P2, P3, P4, P5].map(async id => [id, await rowUI(f, id)])));
  await fM.locator(`#todayList [data-pray="${P4}"]`).scrollIntoViewIfNeeded();
  await shot(M, 'mae-control-after-pull')();
  log('Final (every device pulled again)', { server: finalRows, ui: ui2, lostTextOnServer: onServer,
    lostTextInLocalStorage: { dad: await anywhere(A), mae: await anywhere(M), mom: await anywhere(B), eli: await anywhere(C) },
    feedPrayerLines: ((await L.apiAs('eli', '/api/activity?limit=40')).body.activity || []).map(a => a.text).filter(t => /Prayed for|prayer/i.test(t)).slice(0, 8) });

  ev.logs = { dad: A.logs.slice(0, 20), mom: B.logs.slice(0, 20), eli: C.logs.slice(0, 20), mae: M.logs.slice(0, 20) };
  fs.writeFileSync(path.join(OUT, NAME + '.json'), JSON.stringify(ev, null, 1));
  console.log('\nwrote audits/evidence/p2/PROF/' + NAME + '.json');
} catch (e) {
  ev.error = String(e && e.stack || e);
  fs.writeFileSync(path.join(OUT, NAME + '.json'), JSON.stringify(ev, null, 1));
  console.error(e);
  process.exitCode = 1;
} finally { await L.close(); }
