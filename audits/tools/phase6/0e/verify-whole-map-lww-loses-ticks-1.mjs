// COPY (batch 0e) of phase2/SYNC/verify-whole-map-lww-loses-ticks-1.mjs: in-page reads of the old whole-map rows replaced by the merged view; see make-merged-copies.mjs
// Skeptic #1 for SYNC finding "whole-map-lww-loses-ticks": independent rerun, no shared helpers, reading ids chosen at runtime.
//   node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-1.mjs"          (all scenarios, ~2.5 min)
//   node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-1.mjs" A        (one scenario: A | B1 | B2 | C)
// A  online: phone ticks its Today reading; the iPad (F260 open, has not polled since) ticks a different reading in its week list.
// B1/B2 offline: both devices tick different readings offline; phone reconnects first (B1) / iPad reconnects first (B2).
// C  iPad has the F260 journal unlocked; it PULLS the phone's tick, then ticks another reading.
// For each: does the server's f260.done still hold the phone's tick, what does the phone show, is anyone told?
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
async function until(fn, timeout = 10000, every = 150) { const end = Date.now() + timeout; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } return null; }
const doneOnServer = async L => { const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=' + encodeURIComponent('f260.done')); return (r.body && r.body.item && r.body.item.value) || {}; };
const uiDone = (fr, id) => fr.evaluate(id => { const e = document.querySelector('[data-day="' + id + '"]'); return !!(e && e.classList.contains('done')); }, id);
async function visibleToasts(d) {
  const out = [];
  for (const fr of d.page.frames()) {
    const t = await fr.evaluate(() => { const r = []; const h = document.getElementById('hub-toast'); if (h && !h.hidden && h.textContent.trim()) r.push('hub:' + h.textContent.trim()); document.querySelectorAll('#toasts .toast').forEach(e => r.push('f260:' + e.textContent.trim())); return r; }).catch(() => []);
    out.push(...t);
  }
  return out;
}

async function setup() {
  const L = await local({ variant: 'typical', clock: 'real' });
  const ph = await L.newDevice({ name: 'Eli phone (verify)', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  for (const fr of [fi, fp]) await until(() => fr.evaluate(() => window.hub && hub.sync.lastPull > 0), 15000);
  await sleep(800);
  // the phone's Today target, and another not-yet-done reading on the iPad (same week if possible)
  const idPhone = await fp.evaluate(() => document.getElementById('todayDone').dataset.target);
  const idIpad = await fi.evaluate(p => { const w = p.split('-')[0]; const all = [...document.querySelectorAll('[data-day]')].filter(e => !e.classList.contains('done') && e.dataset.day !== p).map(e => e.dataset.day); return all.find(k => k.split('-')[0] === w) || all[0]; }, idPhone);
  return { L, ipad, phone, fi, fp, idPhone, idIpad };
}

async function scenarioA() {
  const r = { scenario: 'A online, iPad not yet polled' };
  const { L, ipad, phone, fi, fp, idPhone, idIpad } = await setup();
  try {
    r.idPhone = idPhone; r.idIpad = idIpad; r.before = { phone: await doneOnServer(L).then(d => !!d[idPhone]), ipad: await doneOnServer(L).then(d => !!d[idIpad]) };
    const t = Date.now();
    await fp.click('#todayDone');
    r.serverHasPhoneTickMs = (await until(async () => (await doneOnServer(L))[idPhone], 8000, 50)) ? Date.now() - t : null;
    r.ipadPulledSincePhoneTick = await fi.evaluate(t => hub.sync.lastPull > t, t);
    r.ipadStoreHasPhoneTick = await fi.evaluate(id => !!(hub.rowMap('done:', 'f260.done'))[id], idPhone);
    await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), idIpad);
    await until(async () => (await doneOnServer(L))[idIpad], 8000, 50);
    const srv = await doneOnServer(L);
    r.serverAfterIpad = { [idPhone + ' (phone)']: !!srv[idPhone], [idIpad + ' (iPad)']: !!srv[idIpad] };
    log(`[A] phone ticked ${idPhone} (server had it after ${r.serverHasPhoneTickMs} ms); iPad pulled since: ${r.ipadPulledSincePhoneTick}, iPad store had it: ${r.ipadStoreHasPhoneTick}`);
    log(`[A] after the iPad ticked ${idIpad}, server f260.done: ${JSON.stringify(r.serverAfterIpad)}`);
    const tw = Date.now();
    r.phoneUntickedAfterMs = (await until(async () => !(await uiDone(fp, idPhone)), 40000, 200)) ? Date.now() - tw : null;
    r.phoneToday = (await fp.textContent('#todayTitle')).trim();
    r.phoneToastsAfterLoss = await visibleToasts(phone);
    r.phoneSync = await fp.evaluate(() => hub.sync.state);
    const sum = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.summary');
    r.serverSummary = sum.body && sum.body.item && sum.body.item.value;
    r.feed = (await L.apiAs('eli', '/api/activity?limit=60')).body.activity.map(a => a.name + ': ' + a.text).filter(x => /Read week/.test(x));
    await phone.page.screenshot({ path: path.join(EVID, 'verify-whole-map-lww-1-A-phone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    log(`[A] phone UI lost its own ${idPhone} tick after ${r.phoneUntickedAfterMs} ms; Today card now "${r.phoneToday}"; toasts ${JSON.stringify(r.phoneToastsAfterLoss)}; sync ${r.phoneSync}`);
    log(`[A] 'Read week' lines in the feed (last 60): ${r.feed.join(' || ')}`);
  } finally { await L.close(); }
  return r;
}

async function scenarioB(order) {
  const r = { scenario: 'B offline both, ' + order };
  const { L, ipad, phone, fi, fp, idPhone, idIpad } = await setup();
  try {
    r.idPhone = idPhone; r.idIpad = idIpad;
    await phone.setOffline(true); await ipad.setOffline(true);
    await fp.click('#todayDone'); await sleep(1100);
    await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), idIpad);
    await sleep(500);
    const [a, b] = order === 'phone-first' ? [phone, ipad] : [ipad, phone];
    await a.setOffline(false); await sleep(2500);
    await b.setOffline(false); await sleep(2500);
    for (const d of [phone, ipad]) for (const fr of d.page.frames()) await fr.evaluate(() => window.hub && hub.pull()).catch(() => {});
    await sleep(1500);
    const srv = await doneOnServer(L);
    r.server = { [idPhone + ' (phone)']: !!srv[idPhone], [idIpad + ' (iPad)']: !!srv[idIpad] };
    r.phoneShowsOwnTick = await uiDone(fp, idPhone);
    r.toasts = [...await visibleToasts(phone), ...await visibleToasts(ipad)];
    r.sync = { phone: await fp.evaluate(() => hub.sync.state), ipad: await fi.evaluate(() => hub.sync.state) };
    await sleep(order === 'ipad-first' ? 32000 : 0); r.phoneShowsOwnTickLater = await uiDone(fp, idPhone); r.phoneStoreHasOwnTickLater = await fp.evaluate(id => !!(hub.rowMap('done:', 'f260.done'))[id], idPhone);
    log(`[B ${order}] phone UI / phone store show its own tick ~32 s later: ${r.phoneShowsOwnTickLater} / ${r.phoneStoreHasOwnTickLater}`);
    log(`[B ${order}] server: ${JSON.stringify(r.server)} | phone shows its own tick: ${r.phoneShowsOwnTick} | toasts ${JSON.stringify(r.toasts)} | sync ${JSON.stringify(r.sync)}`);
  } finally { await L.close(); }
  return r;
}

async function scenarioC() {
  const r = { scenario: 'C iPad journal unlocked, iPad HAS pulled the tick' };
  const { L, ipad, phone, fi, fp, idPhone, idIpad } = await setup();
  try {
    r.idPhone = idPhone; r.idIpad = idIpad;
    await fi.click('#tabJournal');
    await fi.waitForSelector('#pass.on', { timeout: 5000 });
    await fi.fill('#pass1', 'verify-5678'); await fi.fill('#pass2', 'verify-5678'); await fi.click('#passOk');
    await until(() => fi.evaluate(() => !document.getElementById('pass').classList.contains('on')), 15000);
    await fi.click('#tabPlan'); await sleep(1000);
    const t = Date.now();
    await fp.click('#todayDone');
    await until(async () => (await doneOnServer(L))[idPhone], 8000, 50);
    r.ipadPulledAfterMs = (await until(() => fi.evaluate(t => hub.sync.lastPull > t + 300, t), 40000, 200)) ? Date.now() - t : null;
    await sleep(1000);
    r.ipadStoreHasPhoneTick = await fi.evaluate(id => !!(hub.rowMap('done:', 'f260.done'))[id], idPhone);
    r.ipadUiShowsPhoneTick = await uiDone(fi, idPhone);
    r.ipadToday = (await fi.textContent('#todayTitle')).trim();
    await ipad.page.screenshot({ path: path.join(EVID, 'verify-whole-map-lww-1-C-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), idIpad);
    await sleep(2500);
    const srv = await doneOnServer(L);
    r.server = { [idPhone + ' (phone)']: !!srv[idPhone], [idIpad + ' (iPad)']: !!srv[idIpad] };
    log(`[C] iPad pulled ${r.ipadPulledAfterMs} ms after the phone tick: hub store has ${idPhone}=${r.ipadStoreHasPhoneTick}, F260 paints it=${r.ipadUiShowsPhoneTick}, Today "${r.ipadToday}"`);
    log(`[C] after the iPad ticked ${idIpad}: server ${JSON.stringify(r.server)}`);
  } finally { await L.close(); }
  return r;
}

const only = process.argv[2];
const out = {};
if (!only || only === 'A') out.A = await scenarioA();
if (!only || only === 'B1') out.B1 = await scenarioB('phone-first');
if (!only || only === 'B2') out.B2 = await scenarioB('ipad-first');
if (!only || only === 'C') out.C = await scenarioC();
const file = path.join(EVID, 'verify-whole-map-lww-loses-ticks-1' + (only ? '-' + only : '') + '.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
log('evidence', path.relative(ROOT, file).split(path.sep).join('/'));
