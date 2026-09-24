// SYNC — skeptic #3 (tie-break) for finding "413-drops-whole-channel".
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-3.mjs"      (~2 min)
// Part A (WebKit): the hub.js mechanism, with an injected 950 KB f260.journal.vault (as the investigator did) queued offline
//   before a real tap on Today's Done. What does the batch get back, what does the server keep, what does the phone say?
// Part B (WebKit + Chromium): can the app itself ever produce a vault the Worker refuses?
//   1) the exact expression of apps/f260.html:993 (b64 = String.fromCharCode.apply over the bytes), binary-searched alone;
//   2) through F260's own UI: set a passcode, then put n chars in one HEAR field and fire the app's input handler (saveJournal →
//      persistJournal, apps/f260.html:1823-1829, 1015-1024). Binary search for the largest n whose save lands (a changed ct in
//      the stored vault) while offline; compare that vault's JSON length with the Worker's 921,600 cap (worker/src/data.js:4, 43);
//      then re-save the largest one, reconnect, and read the batch reply and the server's copy.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const CAP = 900 * 1024;
const out = {};

async function partA() {
  const r = {};
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    r.target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    r.serverTickBefore = !!((await serverRow(L, 'eli', 'f260', 'f260.done')) || { value: {} }).value[r.target];
    await f.evaluate(() => { window.__states = []; hub.onSync(s => window.__states.push(s.state + (s.lastError ? ':' + s.lastError : ''))); });
    const replies = [];
    phone.page.on('response', async res => { if (/\/api\/data\/f260\/batch/.test(res.url())) replies.push({ status: res.status(), body: (await res.text().catch(() => '')).slice(0, 90) }); });
    await phone.setOffline(true);
    await f.evaluate(n => hub.set('f260.journal.vault', { v: 2, pass: { salt: 's', iter: 200000, iv: 'i', wk: 'w' }, iv: 'x', ct: 'Q'.repeat(n) }), 950 * 1024);
    await f.click('#todayDone'); await sleep(400);
    r.queueBefore = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
    await phone.setOffline(false);
    await waitFor(() => replies.length > 0, { timeout: 15000 }); await sleep(2000);
    const h = await phone.hub(f);
    r.replies = replies;
    r.serverTickAfter = !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value[r.target];
    r.serverVault = !!((await serverRow(L, 'eli', 'f260', 'f260.journal.vault')) || {}).value;
    r.phoneShowsTick = await f.evaluate(id => document.querySelector(`[data-day="${id}"]`).classList.contains('done'), r.target);
    r.queueAfter = Object.keys(h.queue['hub.queue.f260.person.eli'] || {});
    r.states = await f.evaluate(() => window.__states);
    r.finalSync = h.sync.state;
    r.toast = await phone.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    r.shot = await shot(phone.page, 'v413-3-A-phone.png');
    log(`[A webkit] target ${r.target}; queued offline: ${r.queueBefore.join(' → ')}`);
    log(`[A webkit] batch replies ${JSON.stringify(r.replies)}`);
    log(`[A webkit] server tick before ${r.serverTickBefore} after ${r.serverTickAfter}; server vault ${r.serverVault}; phone shows tick ${r.phoneShowsTick}; queue after [${r.queueAfter}]; sync states ${r.states.join(' → ')}; toast ${r.toast}`);
  } finally { await L.close(); }
  return r;
}

async function partB(engine) {
  const r = { engine };
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: engine === 'webkit' ? 'iphone-pwa' : 'desktop', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    // 1) the exact expression of apps/f260.html:993, alone: the largest byte count it accepts in this engine
    r.b64MaxBytes = await f.evaluate(() => {
      const b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)));
      let lo = 1, hi = 4000000;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; try { b64(new ArrayBuffer(m)); lo = m; } catch (e) { hi = m; } }
      return lo;
    });
    r.b64MaxChars = 4 * Math.ceil(r.b64MaxBytes / 3);
    // 2) through the app's own UI
    const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    r.entry = id;
    await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
    await f.waitForSelector('#pass.on', { timeout: 5000 });
    await f.fill('#pass1', '24680'); await f.fill('#pass2', '24680'); await f.click('#passOk');
    await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4, id), { timeout: 15000 });
    await phone.setOffline(true);
    const tryN = async n => {
      await f.evaluate(() => { const v = hub.get("f260.journal.vault"); window.__beforeCt = v && v.ct; window.__beforeIv = v && v.iv; });
      await f.evaluate(({ id, n }) => {
        const ts = [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')];
        ts.forEach((t, i) => { t.value = i === 0 ? 'x'.repeat(n) : ''; });
        ts[0].dispatchEvent(new Event('input', { bubbles: true }));
      }, { id, n });
      const landed = !!(await waitFor(() => f.evaluate(() => { const v = hub.get("f260.journal.vault"); return !!(v && v.ct !== window.__beforeCt); }), { timeout: 3500, every: 150 }));
      const v = await f.evaluate(id => { const v = hub.get('f260.journal.vault'); const s = document.querySelector('#jr-' + id + ' .jsaved'); return { json: JSON.stringify(v).length, ct: v.ct.length, ivChanged: v.iv !== window.__beforeIv, label: s && s.textContent }; }, id);
      return { n, landed, ...v };
    };
    let lo = 1000, hi = 1200000, best = await tryN(lo);
    if (!best.landed) throw new Error('n=1000 did not persist');
    while (hi - lo > 256) { const mid = Math.floor((lo + hi) / 2); const t = await tryN(mid); if (t.landed) { lo = mid; best = t; } else hi = mid; }
    r.largestLanded = best;
    r.above = await tryN(hi + 2000);
    r.requeued = await tryN(best.n - 128);                           // about the largest vault this engine can make, queued for upload
    r.queue = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
    const replies = [];
    phone.page.on('response', async res => { if (/\/api\/data\/f260\/batch/.test(res.url())) replies.push({ status: res.status(), body: (await res.text().catch(() => '')).slice(0, 90) }); });
    await phone.setOffline(false);
    await waitFor(() => replies.length > 0, { timeout: 20000 }); await sleep(2500);
    r.replies = replies;
    const sv = await serverRow(L, 'eli', 'f260', 'f260.journal.vault');
    r.serverVaultJson = sv && sv.value ? JSON.stringify(sv.value).length : 0;
    r.cap = CAP;
    r.shot = await shot(phone.page, `v413-3-B-${engine}.png`);
    log(`[B ${engine}] b64() of f260.html:993 accepts at most ${r.b64MaxBytes} bytes → at most a ${r.b64MaxChars}-char ct`);
    log(`[B ${engine}] via the app's UI: largest entry that saved n=${best.n} → vault JSON ${best.json} chars; n=${r.above.n} saved: ${r.above.landed} (vault stays ${r.above.json}, its iv changed anyway: ${r.above.ivChanged}, panel says ${JSON.stringify(r.above.label)})`);
    log(`[B ${engine}] Worker cap ${CAP} → headroom ${CAP - best.json} chars; re-saved n=${r.requeued.n} (${r.requeued.json} chars, landed ${r.requeued.landed}), queue [${r.queue}]; on reconnect batch replies ${JSON.stringify(replies)}; server vault JSON ${r.serverVaultJson}`);
  } finally { await L.close(); }
  return r;
}

out.A = await partA();
out.B_webkit = await partB('webkit');
out.B_chromium = await partB('chromium');
log('evidence', writeEvidence('verify-413-drops-whole-channel-3.json', out));
