// SYNC e2b — conflicts: Eli's phone and the Kitchen iPad both edit while offline, then reconnect.
//   node "audits/tools/phase2/SYNC/e2b-offline-conflict.mjs"
// Round 1: phone reconnects first. Round 2: iPad reconnects first.
// In both rounds: phone ticks Acts 6 (38-2) and marks a memory verse (f260.mem, a different row); ~1 s later the iPad
// ticks Acts 7 (38-3). Both also add a family reminder (one row per item). What survives, and is anyone told?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

async function round(order) {
  const r = { order };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    const fp = await phone.openApp('f260', { wait: '#todayDone' });
    for (const fr of [fi, fp]) await waitFor(() => fr.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    await sleep(800);
    await phone.setOffline(true); await ipad.setOffline(true);
    // phone: tick + memory verse + a reminder (the shell's reminders channel)
    await fp.click('#todayDone');
    await fp.evaluate(() => document.querySelector('[data-mem="38-0"] .mkm').click());
    await phone.page.evaluate(() => { const id = 'phone' + hub.uid(); hub.set('item:' + id, { id, text: 'Phone reminder (offline)', by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); });
    await sleep(1200);
    await fi.evaluate(() => document.querySelector('[data-day="38-3"] .mark').click());
    await ipad.page.evaluate(() => { const id = 'ipad' + hub.uid(); hub.set('item:' + id, { id, text: 'iPad reminder (offline)', by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); });
    r.queuedPhone = Object.keys((await phone.hub(fp)).queue['hub.queue.f260.person.eli'] || {});
    r.queuedIpad = Object.keys((await ipad.hub(fi)).queue['hub.queue.f260.person.eli'] || {});
    log(`[${order}] offline queues — phone f260: ${r.queuedPhone.join(',')} | iPad f260: ${r.queuedIpad.join(',')}`);
    const [first, second] = order === 'phone-first' ? [phone, ipad] : [ipad, phone];
    await first.setOffline(false); await sleep(3000);
    await second.setOffline(false); await sleep(3000);
    // let both devices converge: force a pull the way a visibility change would
    for (const d of [phone, ipad]) for (const fr of d.page.frames()) await fr.evaluate(() => window.hub && hub.pull()).catch(() => {});
    await sleep(1500);
    const done = (await serverRow(L, 'eli', 'f260', 'f260.done')).value;
    const mem = (await serverRow(L, 'eli', 'f260', 'f260.mem')).value;
    const rem = (await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items.filter(i => i.value && /offline/.test(i.value.text)).map(i => i.value.text);
    r.server = { '38-2 (phone)': !!done['38-2'], '38-3 (iPad)': !!done['38-3'], 'mem 38-0 (phone)': !!mem['38-0'], reminders: rem };
    r.phoneShows382 = await fp.evaluate(() => document.querySelector('[data-day="38-2"]').classList.contains('done'));
    r.ipadShows382 = await fi.evaluate(() => document.querySelector('[data-day="38-2"]').classList.contains('done'));
    r.toasts = [];
    for (const d of [phone, ipad]) for (const fr of d.page.frames()) { const t = await fr.evaluate(() => { const e = document.getElementById('hub-toast'); return e && !e.hidden ? e.textContent : null; }).catch(() => null); if (t) r.toasts.push(t); }
    r.syncStates = { phone: (await phone.hub(fp)).sync.state, ipad: (await ipad.hub(fi)).sync.state };
    r.shot = await shot(phone.page, `e2b-${order}-phone.png`);
    log(`[${order}] server: ${JSON.stringify(r.server)}`);
    log(`[${order}] phone shows its own 38-2 tick: ${r.phoneShows382} | iPad shows 38-2: ${r.ipadShows382} | toasts: ${JSON.stringify(r.toasts)} | sync: ${JSON.stringify(r.syncStates)}`);
  } finally { await L.close(); }
  return r;
}
const out = { round1: await round('phone-first'), round2: await round('ipad-first') };
log('evidence', writeEvidence('e2b-offline-conflict.json', out));
