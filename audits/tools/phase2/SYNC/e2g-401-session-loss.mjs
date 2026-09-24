// SYNC e2g — a tick is queued while the phone is offline, and meanwhile Eli's sessions are revoked (the admin's
// "Reset PIN" deletes every session of that profile: worker/src/index.js:445-451). What happens to the queued tick?
//   node "audits/tools/phase2/SYNC/e2g-401-session-loss.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Audit reader', profiles: ['mom'] });
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  await phone.setOffline(true);
  await f.click('#todayDone');
  out.queued = Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {});
  out.reset = (await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} })).status;   // as the admin, from the Kitchen iPad
  await phone.setOffline(false);
  await phone.page.waitForSelector('.pcard[data-id="eli"]', { timeout: 15000 });
  out.pickerMessage = await phone.page.textContent('#pickmsg');
  out.queueOnPicker = await phone.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')));
  out.shotPicker = await shot(phone.page, 'e2g-phone-picker-after-401.png');
  log(`queued offline: [${out.queued}]; admin reset Eli's PIN → ${out.reset}; back online the phone shows the picker: "${out.pickerMessage}"; Eli's queue still in localStorage: [${out.queueOnPicker}]`);
  // Eli signs back in (a PIN reset means he creates a new one)
  await phone.page.click('.pcard[data-id="eli"]');
  for (let round = 0; round < 2; round++) { for (const d of '2468') await phone.page.click(`#pad [data-d="${d}"]`); await phone.page.click('#pingo'); await sleep(600); }
  await waitFor(() => phone.page.evaluate(() => hub.profile && hub.profile.id === 'eli' && hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(2000);
  const eliDev = await L.newDevice({ name: 'Audit reader 2', profiles: ['eli'] });
  const done = (await L.apiAs(null, '/api/data/f260?scope=person&key=f260.done', { deviceToken: eliDev.device.token, profileToken: eliDev.sessions.eli })).body.item.value;
  out.serverHasTickAfterSignIn = !!done['38-2'];
  out.queueAfter = await phone.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')));
  log(`after Eli signs in again: server has the tick: ${out.serverHasTickAfterSignIn}; queue left [${out.queueAfter}]`);
  log('evidence', writeEvidence('e2g-401-session-loss.json', out));
} finally { await L.close(); }
