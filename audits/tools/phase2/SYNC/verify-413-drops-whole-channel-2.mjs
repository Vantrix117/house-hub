// SYNC skeptic #2 — "413-drops-whole-channel": one oversized row (f260.journal.vault > 900 KB) makes hub.js drop the whole
// f260 person queue (apps/hub.js:266-270), so a reading tick queued alongside it never reaches the server.
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-2.mjs"      (~70 s, 6 fresh local instances)
// Independent of the investigator's e2f script. Scenarios A-D below, plus E (a consequence) and F (an aside), each on a fresh
// local() instance (real worker code, in-memory SQLite):
//   A offline-journal-then-tick   950 KB vault queued, then the Today "Done" tick, offline; reconnect.
//   B offline-tick-then-journal   same, reverse order.
//   C inflight-tick               ONLINE: a 950 KB vault save is uploading (batch request held 3 s = a slow phone uplink), the
//                                 person taps Done meanwhile. No offline period at all.
//   D control-inflight-small      same as C with a 10 KB vault (under the cap): proves the loss in C is the 413 branch, not the rig.
// For each: what the batch requests carried, the reply, server rows after, the phone's local copy, the queue, every hub.sync
// state the app frame emitted, the shell's #syncdot history, any on-screen text mentioning the failure, the iPad's view, and
// (C) whether the dropped tick comes back with the next online tick and whether a later journal save ever syncs.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, timeout = 15000) { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; }
const row = async (L, key) => { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const vaultBlob = n => ({ v: 2, pass: { salt: 'c2FsdA==', iter: 200000, iv: 'aXY=', wk: 'd2s=' }, iv: 'aXZpdml2aXZpdg==', ct: 'Q'.repeat(n) });
const onScreen = async (frame) => frame.evaluate(() => {
  const txt = document.body.innerText || '';
  const hits = txt.split('\n').filter(l => /too big|too large|could not|couldn.t|not saved|sync|error/i.test(l)).slice(0, 5);
  return hits;
}).catch(() => []);

async function scenario(name, { mode, size, order = 'journal-then-tick' }) {
  const r = { name, mode, vaultChars: size, order };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0)); await sleep(800);
    r.target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    const before = await row(L, 'f260.done');
    r.serverHadTargetBefore = !!(before && before.value && before.value[r.target]);
    r.serverHadVaultBefore = !!((await row(L, 'f260.journal.vault')) || {}).value;

    const reqs = [], resps = [];
    phone.page.on('request', q => { if (q.url().includes('/api/data/f260/batch')) { try { reqs.push(JSON.parse(q.postData()).items.map(i => i.key + (i.value && i.value.ct ? ` (${i.value.ct.length} chars)` : ''))); } catch { reqs.push('?'); } } });
    phone.page.on('response', async s => { if (s.url().includes('/api/data/f260/batch')) resps.push({ at: Date.now(), status: s.status(), body: (await s.text().catch(() => '')).slice(0, 110) }); });
    await f.evaluate(() => { window.__sl = []; hub.onSync(s => window.__sl.push([Date.now(), s.state, s.lastError, s.pending])); });
    await phone.page.evaluate(() => { const d = document.querySelector('#syncdot'); window.__dl = [[Date.now(), d && d.className]]; if (d) new MutationObserver(() => window.__dl.push([Date.now(), d.className])).observe(d, { attributes: true }); });

    const setVault = () => f.evaluate(o => hub.set('f260.journal.vault', o), vaultBlob(size));
    const tick = () => f.click('#todayDone');

    if (mode === 'offline') {
      await phone.setOffline(true);
      if (order === 'journal-then-tick') { await setVault(); await tick(); } else { await tick(); await setVault(); }
      r.queueBeforeReconnect = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
      await phone.setOffline(false);
      await waitFor(() => resps.length > 0, 15000); await sleep(1500);
    } else {
      // online; hold every f260 batch that carries the vault for 3 s (a ~1 MB body on a slow uplink) so the tick lands while it
      // is in flight. Both SDK copies (the shell, index.html:458 hub.use('f260'), and the app frame) flush the same queue, so both
      // vault uploads are held; batches without the vault pass straight through.
      const hold = u => u.href.includes('/api/data/f260/batch');
      await phone.ctx.route(hold, async route => { if ((route.request().postData() || '').includes('"f260.journal.vault"')) await sleep(3000); await route.continue(); });
      await setVault();
      await waitFor(() => reqs.length >= 2, 1500);            // the person taps Done about a second after the journal save
      r.vaultUploadsInFlightAtTap = reqs.length;
      r.tickClickedAt = Date.now(); await tick();
      r.queueWhileInFlight = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
      await waitFor(() => resps.length > 0, 15000);
      r.firstReplyAfterTickMs = resps[0] ? resps[0].at - r.tickClickedAt : null;
      await sleep(2500);
      await phone.ctx.unroute(hold);
    }
    r.requests = reqs.slice(); r.responses = resps.map(x => ({ status: x.status, body: x.body }));
    const after = await row(L, 'f260.done');
    r.serverHasTick = !!(after && after.value && after.value[r.target]);
    r.serverHasVault = !!((await row(L, 'f260.journal.vault')) || {}).value;
    r.phoneLocalTick = await f.evaluate(t => !!(hub.get('f260.done') || {})[t], r.target);
    r.phoneLocalVaultChars = await f.evaluate(() => ((hub.get('f260.journal.vault') || {}).ct || '').length);
    r.queueAfter = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
    r.syncStatesEmitted = (await f.evaluate(() => window.__sl)).map(([t, s, e, p]) => `${s}${e ? ':' + e : ''}(pending ${p})`);
    r.syncNow = await f.evaluate(() => ({ ...hub.sync }));
    r.shellDotHistory = (await phone.page.evaluate(() => window.__dl)).map(x => x[1]);
    r.onScreenFrame = await onScreen(f); r.onScreenShell = await onScreen(phone.page);
    const png = path.join(EVID, `verify-413-2-${name}-phone.png`);
    await phone.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.shot = path.relative(ROOT, png).split(path.sep).join('/');
    log(`[${name}] batches sent: ${JSON.stringify(r.requests)}`);
    log(`[${name}] replies: ${JSON.stringify(r.responses)}${r.queueWhileInFlight ? ' | vault uploads in flight at the tap: ' + r.vaultUploadsInFlightAtTap + ' | queue while in flight: ' + r.queueWhileInFlight.join(',') + ' | first reply ' + r.firstReplyAfterTickMs + ' ms after the tap' : ' | queue before reconnect: ' + r.queueBeforeReconnect.join(' → ')}`);
    log(`[${name}] target ${r.target} | server tick ${r.serverHadTargetBefore}→${r.serverHasTick} | server vault ${r.serverHasVault} | phone local tick ${r.phoneLocalTick}, local vault ${r.phoneLocalVaultChars} chars | queue after [${r.queueAfter.join(',')}]`);
    log(`[${name}] hub.sync states emitted by the app: ${r.syncStatesEmitted.join(' → ')} | now ${r.syncNow.state} | shell dot: ${r.shellDotHistory.join(' → ')} | failure text on screen: ${JSON.stringify([...r.onScreenFrame, ...r.onScreenShell])}`);

    // a later pull (the 30 s poll / visibility) — does anything keep flagging the failure?
    await f.evaluate(() => hub.pull()); await sleep(500);
    r.syncAfterNextPull = await f.evaluate(() => hub.sync.state);
    r.phoneLocalTickAfterPull = await f.evaluate(t => !!(hub.get('f260.done') || {})[t], r.target);

    // the iPad (same person, another device)
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0)); await sleep(800);
    r.ipadTick = await fi.evaluate(t => !!(hub.get('f260.done') || {})[t], r.target);
    r.ipadVault = await fi.evaluate(() => !!hub.get('f260.journal.vault'));
    log(`[${name}] after a pull: phone sync ${r.syncAfterNextPull}, phone still shows the tick locally ${r.phoneLocalTickAfterPull} | iPad sees the tick ${r.ipadTick}, iPad has the journal ${r.ipadVault}`);

    if (name === 'A-offline-journal-then-tick' || name === 'C-inflight-tick') {
      // recovery paths: the next online tick re-sends the whole f260.done map; a later journal save re-sends the vault
      const nextTarget = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
      await tick(); await sleep(2500);
      const d2 = await row(L, 'f260.done');
      r.nextTick = { nextTarget, serverHasEarlierTick: !!(d2 && d2.value && d2.value[r.target]), serverHasNextTick: !!(d2 && d2.value && d2.value[nextTarget]) };
      resps.length = 0; await setVault(); await waitFor(() => resps.length > 0, 8000); await sleep(800);
      r.laterJournalSave = { reply: resps[0] && resps[0].status, serverHasVault: !!((await row(L, 'f260.journal.vault')) || {}).value };
      log(`[${name}] next online tick (${nextTarget}): server now has the earlier tick ${r.nextTick.serverHasEarlierTick}, the new one ${r.nextTick.serverHasNextTick} | a later journal save replies ${r.laterJournalSave.reply}, server has the journal ${r.laterJournalSave.serverHasVault}`);
    }
    r.consoleErrors = phone.logs.filter(l => /error/i.test(l)).slice(0, 5);
  } finally { await L.close(); }
  return r;
}

// E (consequence, not the headline claim): the phone's over-cap journal, never synced and no longer queued, is replaced by an
// older-but-smaller vault that another device saves later — the phone's own entries are then gone from every copy.
async function crossDevice() {
  const r = { name: 'E-cross-device-overwrite' };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    for (const fr of [f, fi]) await waitFor(() => fr.evaluate(() => hub.sync.lastPull > 0));
    const V = (ch, n) => ({ ...vaultBlob(n), ct: ch.repeat(n) });
    const desc = async fr => fr.evaluate(() => { const v = hub.get('f260.journal.vault'); return v ? v.ct[0] + ':' + v.ct.length : 'none'; });
    const srv = async () => { const x = await row(L, 'f260.journal.vault'); return x && x.value ? x.value.ct[0] + ':' + x.value.ct.length : 'none'; };
    await fi.evaluate(o => hub.set('f260.journal.vault', o), V('I', 880 * 1024)); await sleep(1500);
    await f.evaluate(() => hub.pull()); await sleep(300);
    r.step1 = { server: await srv(), phone: await desc(f), ipad: await desc(fi) };
    await f.evaluate(o => hub.set('f260.journal.vault', o), V('P', 950 * 1024)); await sleep(2000);
    r.step2 = { server: await srv(), phone: await desc(f), phoneQueue: Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {}), phoneSync: await f.evaluate(() => hub.sync.state) };
    await fi.evaluate(o => hub.set('f260.journal.vault', o), V('J', 885 * 1024)); await sleep(1500);
    await f.evaluate(() => hub.pull()); await sleep(500);
    r.step3 = { server: await srv(), phone: await desc(f), ipad: await desc(fi) };
    log(`[E] iPad saves an 880 KB vault → server ${r.step1.server}, phone ${r.step1.phone}`);
    log(`[E] phone saves 950 KB (its own entries, 'P') → server ${r.step2.server}, phone ${r.step2.phone}, phone queue [${r.step2.phoneQueue.join(',')}], phone sync ${r.step2.phoneSync}`);
    log(`[E] later the iPad saves 885 KB ('J') and the phone pulls → server ${r.step3.server}, phone ${r.step3.phone}, iPad ${r.step3.ipad}`);
  } finally { await L.close(); }
  return r;
}

// F (aside: the same drop without any big row): more than 200 queued keys in one channel → the Worker's 400 bad_batch
// (worker/src/index.js:314); hub.js sends the whole queue in one POST with no chunking (apps/hub.js:259-264) and drops it all (:268).
async function batchCap() {
  const r = { name: 'F-batch-cap-201' };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0)); await sleep(800);
    r.target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    const resps = [], reqs = [];
    phone.page.on('request', q => { if (q.url().includes('/api/data/f260/batch')) { try { reqs.push({ frame: q.frame() === phone.page.mainFrame() ? 'shell' : 'app', n: JSON.parse(q.postData()).items.length }); } catch { reqs.push('?'); } } });
    phone.page.on('response', async s => { if (s.url().includes('/api/data/f260/batch')) resps.push({ frame: s.request().frame() === phone.page.mainFrame() ? 'shell' : 'app', status: s.status(), body: (await s.text().catch(() => '')).slice(0, 110) }); });
    await phone.setOffline(true);
    await f.click('#todayDone');
    await f.evaluate(() => { for (let i = 0; i < 200; i++) hub.set('audit.k' + i, { i }); });
    r.queued = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {}).length;
    await phone.setOffline(false);
    await waitFor(() => resps.length > 0, 15000); await sleep(1500);
    const d = await row(L, 'f260.done');
    r.requests = reqs; r.replies = resps.map(x => x.frame + ' ' + x.status + ' ' + x.body.slice(0, 60)); r.reply = resps[0]; r.serverHasTick = !!(d && d.value && d.value[r.target]);
    r.serverHasK0 = !!((await row(L, 'audit.k0')) || {}).value;
    r.queueAfter = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {}).length;
    log(`[F] ${r.queued} keys queued offline (tick + 200) → batches ${JSON.stringify(r.requests)} replies ${JSON.stringify(r.replies)} | server has the tick ${r.serverHasTick}, audit.k0 ${r.serverHasK0} | queue after ${r.queueAfter}`);
  } finally { await L.close(); }
  return r;
}

const out = {};
out.A = await scenario('A-offline-journal-then-tick', { mode: 'offline', size: 950 * 1024, order: 'journal-then-tick' });
out.B = await scenario('B-offline-tick-then-journal', { mode: 'offline', size: 950 * 1024, order: 'tick-then-journal' });
out.C = await scenario('C-inflight-tick', { mode: 'inflight', size: 950 * 1024 });
out.D = await scenario('D-control-inflight-small', { mode: 'inflight', size: 10 * 1024 });
out.E = await crossDevice();
out.F = await batchCap();
const file = path.join(EVID, 'verify-413-drops-whole-channel-2.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
log('evidence', path.relative(ROOT, file).split(path.sep).join('/'));
