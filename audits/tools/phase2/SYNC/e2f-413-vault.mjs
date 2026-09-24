// SYNC e2f — one oversized row makes the server answer 413 value_too_large, and hub.js drops the WHOLE f260 queue
// (apps/hub.js:268), including a reading tick that was queued in the same batch.
//   node "audits/tools/phase2/SYNC/e2f-413-vault.mjs"
// The F260 journal is one encrypted row, f260.journal.vault: the whole journal as JSON, AES-GCM, base64 (apps/f260.html:1013-1023),
// rewritten on every journal save. The Worker refuses a value over 900 KB (worker/src/data.js:4, 43). A 950 KB vault stands in for
// a long-kept journal (about 1.3 x the journal text). Journal and tick are made offline (a flight, a basement), then the phone reconnects.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const BIG = 950 * 1024;
async function run(order) {
  const r = { order };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    const responses = [];
    phone.page.on('response', async res => { if (/\/api\/data\/f260\/batch/.test(res.url())) responses.push({ status: res.status(), body: (await res.text().catch(() => '')).slice(0, 120) }); });
    await phone.setOffline(true);
    const vault = () => f.evaluate(n => hub.set('f260.journal.vault', { v: 2, pass: { salt: 's', iter: 200000, iv: 'i', wk: 'w' }, iv: 'x', ct: 'A'.repeat(n) }), BIG);
    const tick = () => f.click('#todayDone');
    if (order === 'journal-then-tick') { await vault(); await tick(); } else { await tick(); await vault(); }
    r.queueOrder = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
    await phone.setOffline(false);
    await waitFor(() => responses.length > 0, { timeout: 10000 }); await sleep(1000);
    const h = await phone.hub(f);
    const done = (await serverRow(L, 'eli', 'f260', 'f260.done')).value;
    const vaultRow = await serverRow(L, 'eli', 'f260', 'f260.journal.vault');
    r.response = responses[0];
    r.serverHasTick = !!done['38-2'];
    r.serverHasVault = !!(vaultRow && vaultRow.value);
    r.phoneShowsTick = await f.evaluate(() => document.querySelector('[data-day="38-2"]').classList.contains('done'));
    r.queueAfter = Object.keys(h.queue['hub.queue.f260.person.eli'] || {});
    r.sync = h.sync;
    r.visibleMessage = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    r.shot = await shot(phone.page, `e2f-${order}-phone.png`);
    log(`[${order}] queue order ${r.queueOrder.join(' → ')}; server replied ${r.response.status} ${r.response.body}`);
    log(`[${order}] server has the tick: ${r.serverHasTick}; server has the journal: ${r.serverHasVault}; phone shows the tick: ${r.phoneShowsTick}; queue after: [${r.queueAfter.join(',')}]; sync ${JSON.stringify(r.sync)}; message on screen: ${r.visibleMessage}`);
    // another device
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    r.ipadShowsTick = await fi.evaluate(() => document.querySelector('[data-day="38-2"]').classList.contains('done'));
    r.ipadJournal = await fi.evaluate(() => hub.get('f260.journal.vault') ? 'has a journal' : 'no journal');
    log(`[${order}] iPad shows the tick: ${r.ipadShowsTick}; iPad journal: ${r.ipadJournal}`);
    // the next tick on the phone, online: the whole map is re-sent, so a dropped tick comes back — the journal never does
    await f.click('#todayDone'); await sleep(2500);
    const done2 = (await serverRow(L, 'eli', 'f260', 'f260.done')).value;
    r.afterNextTick = { '38-2': !!done2['38-2'], '38-3': !!done2['38-3'], journalOnServer: !!((await serverRow(L, 'eli', 'f260', 'f260.journal.vault')) || {}).value };
    log(`[${order}] after the next online tick the server has 38-2: ${r.afterNextTick['38-2']}, 38-3: ${r.afterNextTick['38-3']}, journal: ${r.afterNextTick.journalOnServer}`);
  } finally { await L.close(); }
  return r;
}
const out = { a: await run('journal-then-tick'), b: await run('tick-then-journal') };
log('evidence', writeEvidence('e2f-413-vault.json', out));
