// Smoke test for the SYNC experiments: can we run two devices (Eli's phone + the Kitchen iPad) on the real clock?
//   node "audits/tools/phase2/SYNC/smoke.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow } from './_util.mjs';

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => window.hub && hub.sync.lastPull > 0), { timeout: 15000 });
  log('phone f260 hub', JSON.stringify(await phone.hub(f)).slice(0, 300));
  log('today title', await f.textContent('#todayTitle'), '| target', await f.getAttribute('#todayDone', 'data-target'));
  const done = await serverRow(L, 'eli', 'f260', 'f260.done');
  log('server f260.done keys', Object.keys(done.value).length, 'updated_at', done.updated_at, 'has 38-2?', !!done.value['38-2']);
  log('logs', phone.logs.slice(0, 5));
} finally { await L.close(); }
