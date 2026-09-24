// Skeptic #1 for finding "import-accepts-any-json" (apps/dollywood.html:1101).
//   node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-1.mjs"
// Fresh local rig (typical seed), Eli on the iPad. Opens the build guide, taps the progress menu, taps
// "Import progress" and answers the real file chooser with (A) a file shaped like the Prayer app's own export
// (apps/prayer.html:1500-1505 writes JSON.stringify(D) as prayers-<date>.json) and (B) an older build-guide export
// (the app's own format, :1099) with 2 ticks. Records every dialog, the UI count, and the server row before/after,
// then reloads the app on a second fresh device to show the change persisted.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
async function server(L) {
  const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  const v = it && it.value;
  return { ticks: v ? Object.values(v).filter(x => x === true).length : 0, keys: v ? Object.keys(v).slice(0, 6) : [], nkeys: v ? Object.keys(v).length : 0 };
}
const count = f => f.evaluate(() => document.getElementById('b-count').textContent.trim());
const FILES = {
  A: { name: 'prayers-2026-09-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, lastExport: '2026-09-01', prayers: [{ id: 'x1', text: 'test', created: '2026-08-30' }], settings: {} }, null, 2)) },
  B: { name: 'dollywood-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, exported: '2026-06-01T12:00:00.000Z', done: { 'entrance-01': true, 'entrance-02': true } })) },
};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const arm of ['A', 'B']) {
    await L.reset('typical');
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const dialogs = []; d.page.on('dialog', async dg => { dialogs.push(dg.type() + ': ' + dg.message()); await dg.dismiss(); });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(1500);
    const before = { ui: await count(f), server: await server(L) };
    await f.click('#b-menu'); await sleep(300);
    const menuVisible = await f.evaluate(() => !document.getElementById('bmenu').hidden);
    const [fc] = await Promise.all([d.page.waitForEvent('filechooser', { timeout: 5000 }), f.click('#b-import')]);
    await fc.setFiles(FILES[arm]);
    await sleep(3000);
    const after = { ui: await count(f), server: await server(L), sync: await f.evaluate(() => hub.sync.state) };
    if (arm === 'A') await d.page.screenshot({ path: path.join(EV, 'verify-import-accepts-any-json-1-A-after.png'), scale: 'css', animations: 'disabled' });
    await d.close();
    const d2 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f2 = await d2.openApp('dollywood', { wait: '#b-count' });
    await f2.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(1500);
    const reopened = await count(f2);
    await d2.close();
    log(arm, { file: FILES[arm].name, menuVisible, before, after, dialogsDuringImport: dialogs, reopenedOnFreshDevice: reopened });
  }
} finally {
  fs.writeFileSync(path.join(EV, 'verify-import-accepts-any-json-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
