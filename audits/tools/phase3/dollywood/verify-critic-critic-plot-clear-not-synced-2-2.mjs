// Skeptic #2 for "critic-critic-plot-clear-not-synced-2": does clearing the Scale tab's plot width reach other
// devices, and does a device holding the pre-hub 'dw-plot' key show that width again whenever the hub row is empty?
//   node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2.mjs"
// Code under test: apps/dollywood.html:1055 (savePlot → hub.set('plot', v||null)), :1057 (pre-fill from dw-plot),
// :1110 (adopt applies a remote plot only when v != null); apps/hub.js:393-411 (hub.migrate leaves originals).
// Legacy device path is the natural one: C holds dw-plot and NO hub.migrated mark; it opens while the server has 400.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const P = 'verify-critic-critic-plot-clear-not-synced-2-2';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const serverPlot = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'plot'); return it ? it.value : '(no row)'; };
const ready = async f => { await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent) && window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 }); await sleep(1000); };
const read = f => f.evaluate(() => ({ plotInput: document.getElementById('sc-plot').value, fac: scale.fac, facText: document.getElementById('sc-fac').textContent, hubPlot: hub.get('plot') ?? null, dwPlotLS: localStorage.getItem('dw-plot'), migrated: localStorage.getItem('hub.migrated') }));
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const A = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fa = await A.openApp('dollywood', { wait: '#b-count' }); await ready(fa);
  const B = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let fb = await B.openApp('dollywood', { wait: '#b-count' }); await ready(fb);
  // legacy device: pre-hub standalone width 1000 still in localStorage, never migrated
  const C = await L.device({ device: 'ipad-landscape', profile: 'eli', fixedTime: false, localStorage: { 'dw-plot': '1000' } });
  let fc = await C.openApp('dollywood', { wait: '#b-count' }); await ready(fc);
  log('1-before', { server: await serverPlot(), ipad: await read(fa), phone: await read(fb), legacy: await read(fc) });

  // clear the width on the iPad as a person does
  await fa.evaluate(() => { showTab('scale'); document.getElementById('sc-plot').scrollIntoView({ block: 'center' }); }); await sleep(300);
  const inp = await fa.$('#sc-plot'); await inp.click({ clickCount: 3 }); await A.page.keyboard.press('Backspace'); await A.page.keyboard.press('Tab');
  await sleep(3000);
  log('2-afterClearOnIpad', { server: await serverPlot(), ipad: await read(fa) });

  await fb.evaluate(() => hub.pull()); await sleep(2000);
  log('3-phoneAfterPull', await read(fb));
  await fb.evaluate(() => showTab('scale')); await sleep(300);
  await B.page.screenshot({ path: path.join(EV, P + '-phone-after-pull.png'), scale: 'css' });
  // does a later edit on the stale device push the old width back? (only if the person types; check that a reload clears it)
  fb = await B.openApp('dollywood', { wait: '#b-count' }); await ready(fb);
  log('4-phoneAfterReload', await read(fb));

  await fc.evaluate(() => hub.pull()); await sleep(1500);
  log('5-legacyAfterPull', await read(fc));
  fc = await C.openApp('dollywood', { wait: '#b-count' }); await ready(fc);
  const legacyReload = { ...(await read(fc)), server: await serverPlot() };
  log('6-legacyAfterReload', legacyReload);
  // a step card's in-game line: which factor does it convert with?
  const step = await fc.evaluate(() => { const g = document.querySelector('#b-now .meas.game span'); return g ? g.textContent : '(no game line on current step)'; });
  log('7-legacyStepCardScaleNote', step);
  await fc.evaluate(() => showTab('scale')); await sleep(300);
  await C.page.screenshot({ path: path.join(EV, P + '-legacy-after-reload.png'), scale: 'css' });
  log('8-serverAtEnd', await serverPlot());
} finally {
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
