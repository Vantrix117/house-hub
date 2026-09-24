// Skeptic #2 for finding "migrate-race-overwrites-progress" (Dollywood build guide, hub.migrate at apps/dollywood.html:1107).
//   node "audits/tools/phase3/dollywood/verify-migrate-race-overwrites-progress-2.mjs"
// Arms (each on a fresh 'typical' reset; Eli has seeded progress on the server):
//   C   control: first dollywood/person pull untouched
//   H5  first pull held 5 s (under hub.ready's 6 s race, apps/hub.js:335)
//   H7  first pull held 7 s (just over the race)
//   F   first pull aborted (network error) — hub.pull swallows it (hub.js:313-315) so ready resolves at once
// Each arm: a fresh iPad context signed in as Eli whose localStorage holds the pre-hub key
// dollywood-build-progress-v2 = {"entrance-01":true} and no hub.migrated. After the H7 arm a second, clean device
// (Eli phone, no legacy key, no route) opens the guide to show the other devices adopt the overwritten row.
// Writes audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-2.json (+ -H7-ipad.png, -H7-phone.png).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const NAME = 'verify-migrate-race-overwrites-progress-2';
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const PULL = /\/api\/data\/dollywood\?scope=person/;
const LEGACY = JSON.stringify({ 'entrance-01': true });
async function server(L) {
  const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  const v = (it && it.value) || {};
  return { ticks: Object.values(v).filter(x => x === true).length, keys: Object.keys(v), updated_at: it && it.updated_at };
}
const ui = f => f.evaluate(() => ({ count: (document.getElementById('b-count') || {}).textContent, sync: window.hub && hub.sync.state, migrated: localStorage.getItem('hub.migrated') }));
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const [arm, mode] of [['C', null], ['H5', 5000], ['H7', 7000], ['F', 'abort']]) {
    await L.reset('typical');
    const before = await server(L);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dollywood-build-progress-v2': LEGACY } });
    let pulls = 0;
    await d.ctx.route(PULL, async r => { pulls++;
      if (pulls === 1 && mode === 'abort') return r.abort('failed');
      if (pulls === 1 && typeof mode === 'number') await sleep(mode);
      r.continue().catch(() => {}); });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await sleep(typeof mode === 'number' ? mode + 5000 : 5000);
    const after = await server(L);
    log(arm, { firstPull: mode === null ? 'normal' : mode === 'abort' ? 'aborted' : 'held ' + mode + ' ms',
      serverBefore: before.ticks, serverAfter: after.ticks, serverAfterKeys: after.keys.length <= 3 ? after.keys : after.keys.length + ' keys',
      updatedChanged: before.updated_at !== after.updated_at, ipadUi: await ui(f), pulls });
    if (arm === 'H7') {
      await d.page.screenshot({ path: path.join(EV, NAME + '-H7-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
      const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
      const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
      const pf = await phone.openApp('dollywood', { wait: '#b-count' });
      await sleep(4000);
      log('H7.otherDevice', { phoneUi: await ui(pf), phoneLegacyKey: await pf.evaluate(() => localStorage.getItem('dollywood-build-progress-v2')) });
      await phone.page.screenshot({ path: path.join(EV, NAME + '-H7-phone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
      await phone.close();
    }
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 2));
  await L.close();
}
