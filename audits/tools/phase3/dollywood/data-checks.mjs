// Phase 3 / dollywood: data-path experiments for the build guide (person-scope 'progress' and 'plot' rows), on the local rig.
//   node "audits/tools/phase3/dollywood/data-checks.mjs" [arms...]      arms: M0 M1 M2 L1 L2 O1 S2 I1 I2 P1 (default: all)
// M0/M1/M2  legacy localStorage migration with the first pull fast / held 8 s / failing  (hub.migrate at apps/dollywood.html:1107)
// L1        what a first open on a new device shows while the first pull is held 5 s (no loading state)
// L2        a tick during that window (P2-SYNC-01 mechanism, shown in this app)
// O1        a tick offline: is anything on screen telling the person it is only queued?
// S2        a tick on the phone reaches an open iPad after its next pull (live refresh, adopt :1108-1112)
// I1        Import progress with a JSON file that is not a build-guide export (:1101)
// I2        Import progress with an older export over newer progress (:1101, no confirm)
// P1        overflow seed: the step card's in-game line right after load vs the Scale tab's plot (:1108-1110, :1049-1052)
// Writes audits/evidence/p3/dollywood/data-checks.json and the PNGs it names.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const want = process.argv.slice(2);
const on = a => !want.length || want.includes(a);
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
const PULL = /\/api\/data\/dollywood\?scope=person/;
const LEGACY = { 'entrance-01': true };   // a stale standalone copy on an old device: one tick

async function server(L, pid = 'eli') {
  const r = await L.apiAs(pid, '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  const v = it && it.value;
  return { ticks: v ? Object.values(v).filter(x => x === true).length : 0, keys: v ? Object.keys(v).length : 0, sample: v ? Object.keys(v).slice(0, 4) : [], updated_at: it && it.updated_at };
}
async function waitCount(f) { await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); }
const ui = f => f.evaluate(() => ({ count: document.getElementById('b-count').textContent, chips: [...document.querySelectorAll('#chips .cl')].slice(1, 4).map(c => c.textContent.replace(/\s+/g, ' ')), markDone: (() => { const b = document.getElementById('b-done'); return b ? { text: b.textContent, disabled: b.disabled } : null; })(), sync: window.hub && hub.sync.state }));

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const base = await server(L);
  log('seed.eliProgress', base);

  // ---------- migration ----------
  for (const arm of ['M0', 'M1', 'M2']) {
    if (!on(arm)) continue;
    await L.reset('typical');
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dollywood-build-progress-v2': JSON.stringify(LEGACY) } });
    if (arm === 'M1') await d.ctx.route(PULL, async r => { await sleep(8000); r.continue().catch(() => {}); });
    if (arm === 'M2') await d.ctx.route(PULL, r => r.abort('failed'));
    const t0 = Date.now();
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await waitCount(f);
    await sleep(arm === 'M1' ? 11000 : 4000);
    const migrated = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.migrated') || '{}'));
    log(arm + '.migration', { pull: arm === 'M0' ? 'normal' : arm === 'M1' ? 'held 8 s' : 'fails', server: await server(L), before: base.ticks, ui: await ui(f), migratedMark: migrated, seconds: Math.round((Date.now() - t0) / 1000) });
    if (arm === 'M1') log('M1.png', await shot(d, 'migration-race-after.png'));
    await d.close();
  }

  // ---------- first open with a slow first pull ----------
  if (on('L1') || on('L2')) {
    for (const arm of ['L1', 'L2']) {
      if (!on(arm)) continue;
      await L.reset('typical');
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      await d.ctx.route(PULL, async r => { await sleep(5000); r.continue().catch(() => {}); });
      const f = await d.openApp('dollywood', { wait: '#b-count' });
      await sleep(1200);
      const during = await ui(f);
      if (arm === 'L1') { log('L1.duringLoad', during); log('L1.png', await shot(d, 'first-open-loading.png')); await sleep(6000); log('L1.afterLoad', await ui(f)); }
      if (arm === 'L2') {
        await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; document.getElementById('b-done').click(); });
        await sleep(9000);
        log('L2.tickDuringLoad', { during, after: await ui(f), server: await server(L), before: base.ticks });
      }
      await d.close();
    }
  }

  // ---------- offline tick ----------
  if (on('O1')) {
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await waitCount(f); await sleep(600);
    await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; }); await sleep(400);
    log('O1.onlinePng', await shot(d, 'offline-before-tick-online.png'));
    await d.setOffline(true); await sleep(300);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(800);
    const txt = await f.evaluate(() => document.body.innerText);
    log('O1.offlineTick', { ui: await ui(f), hubSync: await f.evaluate(() => ({ ...hub.sync })), wordsOnScreen: (txt.match(/offline|not synced|pending|queued|saved|waiting|sync/gi) || []), shellToast: await d.page.evaluate(() => (document.querySelector('.toast') || {}).textContent || null) });
    log('O1.offlinePng', await shot(d, 'offline-after-tick.png'));
    await d.setOffline(false); await sleep(2500);
    log('O1.afterReconnect', { server: await server(L), hubSync: await f.evaluate(() => hub.sync.state) });
    await d.close();
  }

  // ---------- live refresh on a second device ----------
  if (on('S2')) {
    await L.reset('typical');
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const fi = await ipad.openApp('dollywood', { wait: '#b-count' }); await waitCount(fi);
    const fp = await phone.openApp('dollywood', { wait: '#b-count' }); await waitCount(fp);
    const before = await ui(fi);
    await fp.evaluate(() => { document.getElementById('build').dataset.state = 'half'; document.getElementById('b-done').click(); }); await sleep(2500);
    await fi.evaluate(() => hub.pull()); await sleep(800);
    log('S2.liveRefresh', { ipadBefore: before, ipadAfterPull: await ui(fi), phone: await ui(fp), server: await server(L), ipadStep: await fi.evaluate(() => document.querySelector('#b-now h3').textContent) });
    await ipad.close(); await phone.close();
  }

  // ---------- import ----------
  for (const arm of ['I1', 'I2']) {
    if (!on(arm)) continue;
    await L.reset('typical');
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const dialogs = []; d.page.on('dialog', async dg => { dialogs.push(dg.type() + ': ' + dg.message()); await dg.accept(); });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await waitCount(f); await sleep(500);
    const before = { ui: await ui(f), server: await server(L) };
    const file = arm === 'I1'
      ? { name: 'prayer-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'prayer', version: 3, exported: '2026-09-01T12:00:00Z', items: [{ id: 'p1', title: 'Grandpa’s knee' }] })) }
      : { name: 'dollywood-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, exported: '2026-06-01T12:00:00Z', done: { 'entrance-01': true, 'entrance-02': true } })) };
    await f.evaluate(() => document.getElementById('b-menu').click()); await sleep(200);
    await f.setInputFiles('#b-file', file); await sleep(2500);
    log(arm + '.import', { file: file.name, before, after: { ui: await ui(f), server: await server(L) }, dialogs, progressValueSample: await f.evaluate(() => JSON.stringify(hub.get('progress')).slice(0, 160)) });
    if (arm === 'I1') log('I1.png', await shot(d, 'import-wrong-file-after.png'));
    await d.close();
  }

  // ---------- plot width on the first step card ----------
  if (on('P1')) {
    await L.reset('overflow');
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await waitCount(f); await sleep(800);
    const card = () => f.evaluate(() => { const g = document.querySelector('#b-now .meas.game'); return { step: stepsOf(curSec)[curIdx].id, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim() : null, plotInput: document.getElementById('sc-plot').value, scaleFac: scale.fac }; });
    const first = await card();
    await f.evaluate(() => { document.getElementById('b-next').click(); document.getElementById('b-prev').click(); }); await sleep(500);
    log('P1.plotOnCard', { afterLoad: first, afterNextPrev: await card() });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'data-checks' + (want.length ? '-' + want.join('-') : '') + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
