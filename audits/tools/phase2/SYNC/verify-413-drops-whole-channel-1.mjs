// Skeptic #1 for SYNC finding "413-drops-whole-channel" — independent reproduction through F260's REAL journal UI.
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-1.mjs"      (~90 s, four fresh local instances)
// Unlike e2f (which hub.set()s a fake 'A'.repeat() vault), the journal here is written the way a person writes it:
// HEAR button → "Set a journal passcode" dialog → typing in the four HEAR textareas, so F260's own input/focusout handlers
// run saveJournal → persistJournal (apps/f260.html:1015-1024, 1823-1834, 1853-1868). (F260's code sits inside
// hub.ready().then(() => { … }) at apps/f260.html:780, so its functions cannot be called directly.)
// The entry is 4 × 180 KB — enough text for a > 900 KB vault. RESULT (2026-09-24): the vault never grows (persistJournal's
// b64() throws RangeError past the engine's argument limit and .catch(() => {}) swallows it — see -b64.mjs and -real.mjs),
// so no 413 happens and the tick syncs normally in every order. Scenarios, each on a fresh local instance:
//   A  offline: journal typed, then Today's "Done" tapped; reconnect.   Then the phone's next online tick.
//   B  offline: "Done" tapped, then journal typed; reconnect.            Then the phone's next online tick.
//   C  = A, then the Kitchen iPad ticks its next reading online and the phone pulls.
//   D  online: journal typed, then one more ordinary edit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, timeout = 10000) { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; }
const row = async (L, key) => { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const FIELD = 180 * 1024;

async function fillJournal(f, id) {
  await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
  await f.waitForSelector('#pass.on', { timeout: 5000 });
  await f.fill('#pass1', '24680'); await f.fill('#pass2', '24680'); await f.click('#passOk');
  await waitFor(() => f.evaluate(() => { const v = hub.get('f260.journal.vault'); return !!(v && v.ct) && !document.getElementById('pass').classList.contains('on'); }), 15000);
  const hasBoxes = await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length, id), 5000);
  await f.evaluate(({ id, n }) => {
    const words = 'the lord is my shepherd I shall not want he makes me lie down in green pastures he leads me beside still waters '.split(' ');
    let base = ''; let i = 0; while (base.length < n) base += words[(i++ * 7) % words.length] + ' ';
    for (const t of document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')) {
      t.value = base.slice(0, n);
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
  }, { id, n: FIELD });
  await sleep(4000); const size = await f.evaluate(() => JSON.stringify(hub.get('f260.journal.vault')).length);   // stays ~216 (passcode only): the save failed silently
  return { textareas: hasBoxes, charsPerField: FIELD, storedJsonChars: size };
}

async function setup(L) {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), 15000); await sleep(800);
  await f.evaluate(() => { window.__syncTrail = []; hub.onSync(s => window.__syncTrail.push(s.state + (s.lastError ? ':' + s.lastError : ''))); });
  const batches = [];
  phone.page.on('response', async res => {
    if (!/\/api\/data\/f260\/batch/.test(res.url())) return;
    let body = ''; try { body = await res.text(); } catch {}
    let keys = []; try { keys = JSON.parse(res.request().postData() || '{}').items.map(i => i.key); } catch {}
    batches.push({ status: res.status(), keys, body: body.slice(0, 90) });
  });
  return { phone, f, batches };
}
const target = f => f.evaluate(() => document.getElementById('todayDone').dataset.target);
async function tick(f) { const id = await target(f); await f.click('#todayDone'); return id; }
const shows = (f, id) => f.evaluate(id => { const e = document.querySelector('[data-day="' + id + '"]'); return !!e && e.classList.contains('done'); }, id);
const hubToast = f => f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.offsetParent !== null ? t.textContent : null; });

async function offlineScenario(order, ipadTicksNext) {
  const r = { order, ipadTicksNext };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const { phone, f, batches } = await setup(L);
    await phone.setOffline(true);
    const id = await target(f);
    if (order === 'journal-then-tick') { r.journal = await fillJournal(f, id); r.tickId = await tick(f); }
    else { r.tickId = await tick(f); r.journal = await fillJournal(f, id); }
    await sleep(600);
    r.queueBefore = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
    log(`[${order}] vault as stored: ${r.journal.storedJsonChars} chars (Worker limit ${900 * 1024}); tick ${r.tickId}; queued: ${r.queueBefore.join(' → ')}`);
    await phone.setOffline(false);
    await waitFor(() => batches.length > 0, 10000); await sleep(3000);
    const h = await phone.hub(f);
    const done = await row(L, 'f260.done'); const vault = await row(L, 'f260.journal.vault');
    r.batches = batches.slice();
    r.serverHasTick = !!(done && done.value && done.value[r.tickId]);
    r.serverHasVault = !!(vault && vault.value);
    r.phoneShowsTick = await shows(f, r.tickId);
    r.phoneQueueAfter = Object.keys(h.queue['hub.queue.f260.person.eli'] || {});
    r.syncTrail = await f.evaluate(() => window.__syncTrail);
    r.syncNow = h.sync.state;
    r.shellDot = await phone.page.evaluate(() => { const d = document.getElementById('syncdot'); return d && d.className; });
    r.hubToast = await hubToast(f);
    log(`[${order}] batch replies: ${JSON.stringify(r.batches)}`);
    log(`[${order}] server has tick ${r.tickId}: ${r.serverHasTick}; server has journal: ${r.serverHasVault}; phone shows tick: ${r.phoneShowsTick}; phone queue after: [${r.phoneQueueAfter}]`);
    log(`[${order}] sync trail: ${r.syncTrail.join(' > ')}; now: ${r.syncNow}; shell dot: ${r.shellDot}; hub toast: ${JSON.stringify(r.hubToast)}`);
    const shotFile = path.join(EVID, `v413-1-${order}${ipadTicksNext ? '-C' : ''}-phone.png`);
    await phone.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.shot = path.relative(ROOT, shotFile).split(path.sep).join('/');

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0), 15000); await sleep(800);
    r.ipadShowsTick = await shows(fi, r.tickId);
    r.ipadHasVault = await fi.evaluate(() => !!hub.get('f260.journal.vault'));
    log(`[${order}] Kitchen iPad shows tick ${r.tickId}: ${r.ipadShowsTick}; iPad has a journal: ${r.ipadHasVault}`);

    if (ipadTicksNext) {
      r.ipadTickId = await tick(fi); await sleep(2500);
      const d2 = await row(L, 'f260.done');
      r.serverAfterIpadTick = { phoneTick: !!d2.value[r.tickId], ipadTick: !!d2.value[r.ipadTickId] };
      await f.evaluate(() => hub.pull()); await sleep(1500);
      r.phoneShowsOwnTickAfterPull = await shows(f, r.tickId);
      r.phoneShowsIpadTickAfterPull = await shows(f, r.ipadTickId);
      log(`[C] iPad ticked ${r.ipadTickId}; server f260.done now ${JSON.stringify(r.serverAfterIpadTick)}; phone after pull shows its own ${r.tickId}: ${r.phoneShowsOwnTickAfterPull}, the iPad's ${r.ipadTickId}: ${r.phoneShowsIpadTickAfterPull}`);
    } else {
      const nb = batches.length;
      r.nextTickId = await tick(f); await waitFor(() => batches.length > nb, 8000); await sleep(1000);
      const d2 = await row(L, 'f260.done'); const v2 = await row(L, 'f260.journal.vault');
      r.afterNextTick = { firstTick: !!d2.value[r.tickId], nextTick: !!d2.value[r.nextTickId], journal: !!(v2 && v2.value), batches: batches.slice(nb) };
      log(`[${order}] after the phone's next online tick ${r.nextTickId}: ${JSON.stringify(r.afterNextTick)}`);
    }
  } finally { await L.close(); }
  return r;
}

async function onlineScenario() {
  const r = { order: 'online-journal-save' };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const { phone, f, batches } = await setup(L);
    const id = await target(f);
    r.journal = await fillJournal(f, id);
    await waitFor(() => batches.length > 0, 8000); await sleep(1500);
    const nb = batches.length;
    await f.evaluate(id => { const t = document.querySelector('#jr-' + id + ' textarea[data-jf="h"]'); t.value += ' amen'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }, id);
    await waitFor(() => batches.length > nb, 8000); await sleep(1500);
    const v = await row(L, 'f260.journal.vault'); const js = await row(L, 'f260.jstats');
    r.batches = batches.slice();
    r.serverHasVault = !!(v && v.value); r.serverJstats = js && js.value;
    r.syncTrail = await f.evaluate(() => window.__syncTrail);
    r.syncNow = (await phone.hub(f)).sync.state;
    r.hubToast = await hubToast(f);
    r.savedLabel = await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id);
    log(`[online] batch replies: ${JSON.stringify(r.batches)}`);
    log(`[online] server has journal: ${r.serverHasVault}; server jstats: ${JSON.stringify(r.serverJstats)}; sync trail: ${r.syncTrail.join(' > ')}; now: ${r.syncNow}; hub toast: ${JSON.stringify(r.hubToast)}; panel label: ${JSON.stringify(r.savedLabel)}`);
    const shotFile = path.join(EVID, 'v413-1-online-journal-phone.png');
    await phone.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.shot = path.relative(ROOT, shotFile).split(path.sep).join('/');
  } finally { await L.close(); }
  return r;
}

const out = {
  A: await offlineScenario('journal-then-tick', false),
  B: await offlineScenario('tick-then-journal', false),
  C: await offlineScenario('journal-then-tick', true),
  D: await onlineScenario(),
};
const file = path.join(EVID, 'verify-413-drops-whole-channel-1.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
log('evidence', path.relative(ROOT, file).split(path.sep).join('/'));
