// SYNC e11 — hub.sync.state starts as 'offline' (apps/hub.js:51) and stays so until the first pull ends (apps/hub.js:311), even
// when the device is online and the server is fine. Larder shows "Can't reach the house list" for exactly that state
// (apps/leftovers.html:182-186). Lead (01-leads.md, Larder): "False 'offline' line on every warm open".
//   node "audits/tools/phase2/SYNC/e11-initial-offline-state.mjs"
// The phone (online, warm cache) reopens Larder while the first pull takes 2 s (an ordinary slow moment on cellular).
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let f = await phone.openApp('leftovers');
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  await phone.page.goto('about:blank');
  await phone.ctx.route(/\/api\/data\/leftovers\?/, async route => { await sleep(2000); route.continue().catch(() => {}); });
  const t = Date.now();
  f = await phone.openApp('leftovers');
  await sleep(700);
  const read = () => f.evaluate(() => { const m = [...document.querySelectorAll('.mode')].find(e => !e.hidden); return { online: navigator.onLine, state: hub.sync.state, line: m ? m.textContent : null }; });
  out.at700ms = await read();
  out.shot = await shot(phone.page, 'e11-larder-warm-open-slow-pull.png');
  await sleep(2500);
  out.after3s = await read();
  log(`Larder 0.7 s after a warm open (online, first pull still running): ${JSON.stringify(out.at700ms)}`);
  log(`3.2 s after: ${JSON.stringify(out.after3s)}`);
  log('evidence', writeEvidence('e11-initial-offline-state.json', out));
} finally { await L.close(); }
