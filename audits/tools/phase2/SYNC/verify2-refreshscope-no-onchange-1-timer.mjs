// Skeptic #1 (verify2) side probe: in the rig, the F260 frame's flush (setTimeout 0 from its 'online' handler) ran only after its
// pull had come back. Is a 0 ms timer in the app iframe delayed in rig WebKit (a rig artefact), and by how much, vs the shell?
//   node "audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-1-timer.mjs" [--engine chromium]
import { local, sleep } from '../../lib/local.mjs';
import { writeEvidence } from './_util.mjs';

const engine = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'webkit';
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  const phone = await L.device({ device: engine === 'webkit' ? 'iphone-pwa' : 'pc', profile: 'eli', fixedTime: false });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(4000);
  const measure = async (target, label) => {
    // install an 'online' listener that records how long a 0 ms timer takes, then dispatch 'online' the way the harness does
    await target.evaluate(() => { window.__lat = []; addEventListener('online', () => { const t = performance.now(); setTimeout(() => window.__lat.push(+(performance.now() - t).toFixed(1)), 0); }); });
    const direct = [];
    for (let i = 0; i < 10; i++) { direct.push(await target.evaluate(() => new Promise(r => { const t = performance.now(); setTimeout(() => r(+(performance.now() - t).toFixed(1)), 0); }))); await sleep(150); }
    return { label, direct };
  };
  const a = await measure(phone.page, 'shell'), b = await measure(fp, 'frame');
  for (let i = 0; i < 5; i++) { await phone.setOffline(true); await sleep(300); await phone.setOffline(false); await sleep(1500); }
  const onlineShell = await phone.page.evaluate(() => window.__lat), onlineFrame = await fp.evaluate(() => window.__lat);
  const out = { engine, shell: { ...a, inOnlineHandler: onlineShell }, frame: { ...b, inOnlineHandler: onlineFrame } };
  console.log(JSON.stringify(out, null, 1));
  console.log('evidence:', writeEvidence(`verify2-refreshscope-no-onchange-1-timer-${engine}.json`, out));
} finally { await L.close(); }
