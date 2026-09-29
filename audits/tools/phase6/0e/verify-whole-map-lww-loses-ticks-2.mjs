// COPY (batch 0e) of phase2/SYNC/verify-whole-map-lww-loses-ticks-2.mjs: in-page reads of the old whole-map rows replaced by the merged view; see make-merged-copies.mjs
// SYNC — skeptic #2 re-verification of finding "whole-map-lww-loses-ticks" (independent of e2a/e2b/e2e/e9).
//   node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-2.mjs"            (all parts, ~2-3 min)
//   node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-2.mjs" A C        (only parts A and C)
// Parts (each on its own fresh local instance, demo household 'typical', real clock, WebKit):
//   A  two online devices, both Eli, F260 open: phone taps a reading, the iPad taps a different reading before its next poll.
//      Real Playwright clicks. Watches every toast (MutationObserver) on the phone for the whole run, not just at the end.
//   B  both devices offline, each ticks a different reading, then both reconnect (phone first, then iPad) — does either tick survive?
//   C  Dollywood build guide: phone marks a step, the iPad marks another step before its next poll.
//   D  iPad journal unlocked (F260 defers remote merges while busy); phone ticks; iPad pulls (store has it) then ticks another day.
//   E  control: same as A but the iPad pulls (hub.pull + merge) before its tick — proves the loss needs a stale copy, not a server bug.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
async function until(fn, timeout = 10000, every = 150) { const end = Date.now() + timeout; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } return null; }
const row = async (L, app, key, profile = 'eli') => (await L.apiAs(profile, `/api/data/${app}?scope=person&key=${encodeURIComponent(key)}`)).body.item;
async function clickMark(fr, id) {
  try { await fr.click(`[data-day="${id}"] .mark`, { timeout: 3000 }); return 'playwright-click'; }
  catch { await fr.evaluate(id => document.querySelector(`[data-day="${id}"] .mark`).click(), id); return 'dom-click'; }
}
// install a toast recorder in a frame (F260's own #toasts and hub.js' #hub-toast), and in the shell page
async function recordToasts(fr) {
  await fr.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.classList.contains('toast') || n.id === 'hub-toast' || (n.querySelector && n.querySelector('.toast,#hub-toast')))) window.__toasts.push({ at: Date.now(), text: n.textContent }); if (ms.some(m => m.target && m.target.id === 'hub-toast')) window.__toasts.push({ at: Date.now(), text: document.getElementById('hub-toast').textContent }); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}
async function twoDevices(L, app, wait) {
  const ph = await L.newDevice({ name: 'Eli phone (skeptic)', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp(app, { wait });
  const fp = await phone.openApp(app, { wait });
  for (const fr of [fi, fp]) await until(() => fr.evaluate(() => window.hub && hub.sync.lastPull > 0), 20000);
  await sleep(800);
  return { ipad, phone, fi, fp };
}
async function undoneDays(fr) {
  return fr.evaluate(() => {
    const d = hub.rowMap('done:', 'f260.done');
    const open = [...document.querySelectorAll('section.open [data-day], .open [data-day]')].map(e => e.dataset.day);
    const ids = open.length ? open : [...document.querySelectorAll('[data-day]')].map(e => e.dataset.day);
    return { today: document.getElementById('todayDone').dataset.target, undone: [...new Set(ids)].filter(k => !d[k]), done: Object.keys(d).length };
  });
}
async function shot1x(page, name) { const file = path.join(EVID, name); await page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(file); }
const uiDone = (fr, id) => fr.evaluate(id => document.querySelector(`[data-day="${id}"]`).classList.contains('done'), id);

const want = process.argv.slice(2).map(s => s.toUpperCase());
const run = p => !want.length || want.includes(p);
const result = {};

// ─────────────────────────────── A ───────────────────────────────
if (run('A')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = result.A = {};
  try {
    const { ipad, phone, fi, fp } = await twoDevices(L, 'f260', '#todayDone');
    const u = await undoneDays(fp);
    const [a, b] = [u.today, u.undone.find(k => k !== u.today)];
    o.days = { phoneTicks: a, ipadTicks: b, doneBefore: u.done };
    await recordToasts(fp); await recordToasts(phone.page);
    const t = Date.now();
    o.phoneClick = await clickMark(fp, a);
    o.serverHasPhoneTickAfterMs = (await until(async () => (await row(L, 'f260', 'f260.done')).value[a], 8000, 50)) ? Date.now() - t : null;
    o.ipadHadPulledSincePhoneTick = await fi.evaluate(t => hub.sync.lastPull > t, t);
    o.ipadClick = await clickMark(fi, b);
    await until(async () => (await row(L, 'f260', 'f260.done')).value[b], 8000, 50);
    const srv = (await row(L, 'f260', 'f260.done')).value;
    o.serverAfterIpadTick = { [a + ' (phone)']: !!srv[a], [b + ' (iPad)']: !!srv[b] };
    log(`A: phone ticked ${a} (${o.phoneClick}), on server after ${o.serverHasPhoneTickAfterMs} ms; iPad pulled since: ${o.ipadHadPulledSincePhoneTick}; iPad ticked ${b} (${o.ipadClick})`);
    log('A: server f260.done now:', JSON.stringify(o.serverAfterIpadTick), '| ms since phone tick:', Date.now() - t);
    const t2 = Date.now();
    const gone = await until(async () => !(await uiDone(fp, a)), 45000, 250);
    o.phoneUiLostOwnTickAfterMs = gone ? Date.now() - t2 : null;
    o.phoneStore = await fp.evaluate(a => !!(hub.rowMap('done:', 'f260.done'))[a], a);
    o.phoneToday = await fp.textContent('#todayTitle').catch(() => null);
    o.phoneSync = await fp.evaluate(() => hub.sync.state);
    o.phoneToastsDuringRun = [...await fp.evaluate(() => window.__toasts), ...await phone.page.evaluate(() => window.__toasts)];
    o.feedReadLines = (await L.apiAs('eli', '/api/activity?limit=50')).body.activity.filter(x => /Read week/.test(x.text)).map(x => x.name + ': ' + x.text);
    o.shotPhone = await shot1x(phone.page, 'v2-A-phone-after.png');
    log(`A: phone UI un-ticked its own ${a} after ${o.phoneUiLostOwnTickAfterMs} ms; phone store has it: ${o.phoneStore}; Today card "${o.phoneToday}"; sync=${o.phoneSync}`);
    log('A: toasts seen on the phone during the run:', JSON.stringify(o.phoneToastsDuringRun.map(x => x.text)));
    log('A: "Read week" lines in the family feed:', JSON.stringify(o.feedReadLines));
  } finally { await L.close(); }
}

// ─────────────────────────────── B ───────────────────────────────
if (run('B')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = result.B = {};
  try {
    const { ipad, phone, fi, fp } = await twoDevices(L, 'f260', '#todayDone');
    const u = await undoneDays(fp);
    const [a, b] = [u.today, u.undone.find(k => k !== u.today)];
    o.days = { phoneTicks: a, ipadTicks: b };
    await phone.setOffline(true); await ipad.setOffline(true);
    await clickMark(fp, a); await sleep(400);
    await clickMark(fi, b); await sleep(400);
    o.queuedPhone = await fp.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('hub.queue.f260.person'))) || '{}')));
    await phone.setOffline(false);
    await until(async () => { const r = await row(L, 'f260', 'f260.done'); return r && r.value[a]; }, 10000);
    o.serverAfterPhoneReconnect = { [a]: !!(await row(L, 'f260', 'f260.done')).value[a] };
    await ipad.setOffline(false);
    await until(async () => { const r = await row(L, 'f260', 'f260.done'); return r && r.value[b]; }, 10000);
    await sleep(1000);
    const srv = (await row(L, 'f260', 'f260.done')).value;
    o.serverFinal = { [a + ' (phone, ticked first)']: !!srv[a], [b + ' (iPad, ticked second)']: !!srv[b] };
    o.syncStates = { phone: await fp.evaluate(() => hub.sync.state), ipad: await fi.evaluate(() => hub.sync.state) };
    log(`B: offline ticks, phone ${a} then iPad ${b}; phone queue: ${o.queuedPhone}; after phone reconnect server has ${a}: ${o.serverAfterPhoneReconnect[a]}`);
    log('B: after both reconnect the server holds:', JSON.stringify(o.serverFinal), 'sync states', JSON.stringify(o.syncStates));
  } finally { await L.close(); }
}

// ─────────────────────────────── C ───────────────────────────────
if (run('C')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = result.C = {};
  try {
    const { ipad, phone, fi, fp } = await twoDevices(L, 'dollywood', '#b-done');
    const prog = async () => { const r = await row(L, 'dollywood', 'progress'); return r && r.value ? Object.keys(r.value).filter(k => r.value[k]) : []; };
    o.before = (await prog()).length;
    const t = Date.now();
    const cur = fr => fr.evaluate(() => document.querySelector('.bitem.cur') && document.querySelector('.bitem.cur').textContent.slice(0, 60));
    o.phoneStepTitle = await cur(fp);
    try { await fp.click('#b-done', { timeout: 3000 }); o.phoneClick = 'playwright-click'; } catch { await fp.evaluate(() => document.getElementById('b-done').click()); o.phoneClick = 'dom-click'; }
    await until(async () => (await prog()).length > o.before, 8000, 50);
    const afterPhone = await prog();
    o.ipadPulledSince = await fi.evaluate(t => hub.sync.lastPull > t, t);
    try { await fi.click('#b-next', { timeout: 3000 }); await sleep(200); await fi.click('#b-done', { timeout: 3000 }); o.ipadClick = 'playwright-click'; }
    catch { await fi.evaluate(() => { document.getElementById('b-next').click(); }); await sleep(200); await fi.evaluate(() => document.getElementById('b-done').click()); o.ipadClick = 'dom-click'; }
    await sleep(2000);
    const afterIpad = await prog();
    const phoneStep = afterPhone.filter(k => !afterIpad.includes(k));
    o.counts = { before: o.before, afterPhone: afterPhone.length, afterIpad: afterIpad.length };
    o.phoneStepsMissingNow = phoneStep;
    log(`C: build-guide progress on server: before ${o.before} steps, after phone tick ${afterPhone.length}, after iPad tick ${afterIpad.length}; iPad pulled since: ${o.ipadPulledSince}; steps the phone had that are now gone: ${JSON.stringify(phoneStep)}`);
  } finally { await L.close(); }
}

// ─────────────────────────────── D ───────────────────────────────
if (run('D')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = result.D = {};
  try {
    const { ipad, phone, fi, fp } = await twoDevices(L, 'f260', '#todayDone');
    o.ipadAutolockMin = await fi.evaluate(() => hub.get('f260.autolock'));
    await fi.click('#tabJournal');
    await fi.waitForSelector('#pass.on', { timeout: 5000 });
    await fi.fill('#pass1', 'skeptic-2468'); await fi.fill('#pass2', 'skeptic-2468'); await fi.click('#passOk');
    await until(() => fi.evaluate(() => !document.getElementById('pass').classList.contains('on')), 15000);
    await fi.click('#tabPlan'); await sleep(1000);
    const u = await undoneDays(fp);
    const [a, b] = [u.today, u.undone.find(k => k !== u.today)];
    o.days = { phoneTicks: a, ipadTicks: b };
    const t = Date.now();
    await clickMark(fp, a);
    await until(async () => (await row(L, 'f260', 'f260.done')).value[a], 8000, 50);
    // let the iPad pull normally (its own 30 s poll), then give F260's merge well over its 200 ms + 5 s retry
    await until(() => fi.evaluate(t => hub.sync.lastPull > t, t), 45000, 250);
    await sleep(7000);
    o.ipadStoreHasPhoneTick = await fi.evaluate(a => !!(hub.rowMap('done:', 'f260.done'))[a], a);
    o.ipadUiShowsPhoneTick = await uiDone(fi, a);
    o.shot = await shot1x(ipad.page, 'v2-D-ipad-journal-open.png');
    await clickMark(fi, b); await sleep(2500);
    const srv = (await row(L, 'f260', 'f260.done')).value;
    o.serverAfterIpadTick = { [a + ' (phone)']: !!srv[a], [b + ' (iPad)']: !!srv[b] };
    log(`D: journal unlocked on the iPad; after the iPad pulled (+7 s): store has ${a}=${o.ipadStoreHasPhoneTick}, F260 shows it=${o.ipadUiShowsPhoneTick}; after the iPad ticks ${b}: server ${JSON.stringify(o.serverAfterIpadTick)}`);
  } finally { await L.close(); }
}

// ─────────────────────────────── E (control) ───────────────────────────────
if (run('E')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = result.E = {};
  try {
    const { ipad, phone, fi, fp } = await twoDevices(L, 'f260', '#todayDone');
    const u = await undoneDays(fp);
    const [a, b] = [u.today, u.undone.find(k => k !== u.today)];
    await clickMark(fp, a);
    await until(async () => (await row(L, 'f260', 'f260.done')).value[a], 8000, 50);
    await fi.evaluate(() => hub.pull()); await sleep(800);          // the iPad has seen the phone's tick (merge runs after 200 ms)
    o.ipadUiShowsPhoneTick = await uiDone(fi, a);
    await clickMark(fi, b); await sleep(2000);
    const srv = (await row(L, 'f260', 'f260.done')).value;
    o.serverAfterIpadTick = { [a + ' (phone)']: !!srv[a], [b + ' (iPad)']: !!srv[b] };
    log(`E (control, iPad pulled first): iPad shows ${a}=${o.ipadUiShowsPhoneTick}; after the iPad ticks ${b}: server ${JSON.stringify(o.serverAfterIpadTick)}`);
  } finally { await L.close(); }
}

const f = path.join(EVID, 'v2-whole-map-lww.json');
let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
fs.writeFileSync(f, JSON.stringify({ ...prev, ...result }, null, 2));   // parts run separately merge into one file
log('evidence', rel(f));
