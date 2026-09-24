// SYNC e9 — the Dollywood build guide keeps its ticks in ONE person-scope row, progress = { stepId: true, … }, rewritten whole on
// every tick (apps/dollywood.html:1062). Lead (01-leads.md, Dollywood): "saved progress can be wiped by one tick on another device".
//   node "audits/tools/phase2/SYNC/e9-dollywood-progress.mjs"
// Eli's phone marks the current Entrance step done; before the iPad's next poll, Eli marks the next step done on the iPad.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('dollywood', { wait: '#b-done' });
  const fp = await phone.openApp('dollywood', { wait: '#b-done' });
  for (const fr of [fi, fp]) await waitFor(() => fr.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 20000 });
  await sleep(1500);
  const prog = async () => { const r = await serverRow(L, 'eli', 'dollywood', 'progress'); return r && r.value ? Object.keys(r.value).filter(k => r.value[k]) : []; };
  out.before = await prog();
  const cur = fr => fr.evaluate(() => { const t = document.querySelector('.build') || document.body; return (document.getElementById('b-done') || {}).textContent; });
  // phone: mark the current step done
  await fp.evaluate(() => document.getElementById('b-done').click());
  await waitFor(async () => (await prog()).length > out.before.length, { timeout: 8000, every: 100 });
  out.afterPhone = await prog();
  const phoneStep = out.afterPhone.find(k => !out.before.includes(k));
  // iPad (has not pulled since): Next, then mark that step done
  out.ipadPulledSince = await fi.evaluate(t => hub.sync.lastPull > t, Date.now() - 2000);
  await fi.evaluate(() => document.getElementById('b-next').click()); await sleep(300);
  await fi.evaluate(() => document.getElementById('b-done').click());
  await sleep(2000);
  out.afterIpad = await prog();
  out.phoneStep = phoneStep; out.phoneStepSurvived = out.afterIpad.includes(phoneStep);
  log(`server progress before: ${out.before.length} steps; after the phone's tick: ${out.afterPhone.length} (+${phoneStep}); after the iPad's tick of the next step: ${out.afterIpad.length} → the phone's step ${phoneStep} survived: ${out.phoneStepSurvived}`);
  log('evidence', writeEvidence('e9-dollywood-progress.json', out));
} finally { await L.close(); }
