// Batch 0h check for the build guide's Import progress (template in ../dollywood-build-project, exported to apps/dollywood.html).
//   W  a file that is not a build-guide export (a prayer backup): a message, nothing changes on the house copy
//   X  a JSON file whose keys are not steps of this guide: a message, nothing changes
//   E  an export that ticks one step already ticked here, one not yet ticked, and says false for a step ticked here:
//      the confirm names the one step it adds; accepted, exactly that step is added and nothing is unticked; the toast's
//      Undo takes it back
// The house copy is read the way the app reads it since batch 0e: the old 'progress' row as a base, step:<id> rows over it.
// Run from the repo root: node audits/tools/phase6/0h/guide-import-check.mjs -> audits/evidence/p6/0h/guide-import-check.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0h';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
async function ticks() {
  const items = (await L.apiAs('eli', '/api/data/dollywood?scope=person')).body.items || [];
  const base = (items.find(i => i.key === 'progress') || {}).value || {}; const m = { ...base };
  for (const r of items) if (r.key.startsWith('step:')) m[r.key.slice(5)] = r.value === true;
  return Object.keys(m).filter(k => m[k] === true).sort();
}
const pass = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const dialogs = []; let answer = 'dismiss';
  d.page.on('dialog', async dg => { dialogs.push(dg.type() + ': ' + dg.message()); if (answer === 'accept') await dg.accept(); else await dg.dismiss(); });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); await sleep(1500);
  const importFile = async (name, obj) => {
    await f.click('#b-menu'); await sleep(300);
    const [fc] = await Promise.all([d.page.waitForEvent('filechooser', { timeout: 5000 }), f.click('#b-import')]);
    await fc.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    await sleep(2500); await f.evaluate(() => hub.flush && hub.flush()); await sleep(800);
  };
  const t0 = await ticks();
  // W
  dialogs.length = 0;
  await importFile('prayers-2026-09-01.json', { version: 3, lists: { personal: { prayers: [{ id: 'p001', title: 'x' }] } } });
  const tW = await ticks();
  log('W', { dialogs: [...dialogs], unchanged: JSON.stringify(tW) === JSON.stringify(t0), ticks: tW.length });
  pass.W = JSON.stringify(tW) === JSON.stringify(t0) && dialogs.length === 1 && /nothing was changed/i.test(dialogs[0]);
  // X
  dialogs.length = 0;
  await importFile('other.json', { done: { 'not-a-step': true, 'also-not': true } });
  const tX = await ticks();
  log('X', { dialogs: [...dialogs], unchanged: JSON.stringify(tX) === JSON.stringify(t0) });
  pass.X = JSON.stringify(tX) === JSON.stringify(t0) && /no steps from this build guide/i.test(dialogs[0] || '');
  // E
  const ids = await f.evaluate(() => [...STEPID]);
  const on = t0[0], off = t0[1], fresh = ids.find(id => !t0.includes(id));
  dialogs.length = 0; answer = 'accept';
  await importFile('dollywood-progress.json', { version: 1, exported: '2026-06-01T12:00:00.000Z', done: { [on]: true, [fresh]: true, [off]: false } });
  const tE = await ticks();
  const toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  log('E', { dialogs: [...dialogs], added: tE.filter(x => !t0.includes(x)), removed: t0.filter(x => !tE.includes(x)), toast });
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await sleep(800);
  await f.evaluate(() => hub.flush && hub.flush()); await sleep(800);
  const tU = await ticks();
  log('E.undo', { backToBefore: JSON.stringify(tU) === JSON.stringify(t0) });
  pass.E = /^confirm: Add 1 ticked step/.test(dialogs[0] || '') && JSON.stringify(tE.filter(x => !t0.includes(x))) === JSON.stringify([fresh])
    && t0.every(x => tE.includes(x)) && /Undo/.test(toast || '') && JSON.stringify(tU) === JSON.stringify(t0);
  await d.close();
} catch (e) { log('error', String(e && e.stack || e)); }
finally { await L.close(); }
res.pass = pass;
console.log('PASS', JSON.stringify(pass));
fs.writeFileSync(OUT + '/guide-import-check.json', JSON.stringify(res, null, 1));
