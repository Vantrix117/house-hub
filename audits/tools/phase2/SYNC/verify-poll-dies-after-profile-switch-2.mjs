// SYNC skeptic #2 — "After any in-page profile switch the shell stops polling" (finding poll-dies-after-profile-switch).
//   node "audits/tools/phase2/SYNC/verify-poll-dies-after-profile-switch-2.mjs"      (~2.5 min, local rig only)
// Independent of the investigator's e1d script. Three measurements per screen (Kitchen iPad Eli → Ezra, TV kiosk → kiosk):
//   1. an init-script counter of live 30 s setIntervals in the SHELL window (wraps setInterval/clearInterval; app code untouched)
//   2. main-frame GET /api/data requests in a 35 s window before the switch and a 65 s window after it
//   3. a family reminder written by another device (Eli's phone, via the real API) — does the screen show it without help?
// Then a synthetic visibilitychange (document stays visible, so hub.js's handler pulls) proves the data was one pull away.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function until(fn, timeout = 10000, every = 200) { const end = Date.now() + timeout; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } return null; }

const IV = () => {
  const live = new Map(); const rec = { created: 0, cleared: 0, live: () => live.size };
  window.__iv = rec;
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); if (ms === 30000) { live.set(id, Date.now()); rec.created++; } return id; };
  window.clearInterval = id => { if (live.has(id)) { live.delete(id); rec.cleared++; } return ci(id); };
};
const ivState = page => page.evaluate(() => ({ created: __iv.created, cleared: __iv.cleared, live: __iv.live() }));
function mainNet(page) {
  const rows = [];
  page.on('request', r => { if (r.frame() === page.mainFrame() && r.method() === 'GET' && /\/api\/data\//.test(r.url())) rows.push(Date.now()); });
  return (a, b) => rows.filter(t => t >= a && t < b).length;
}
const shows = (page, text) => page.evaluate(t => { const ul = document.querySelector('#remlist'); return !!ul && ul.textContent.includes(t); }, text);

const out = { ipad: {}, tv: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // the writer is a separate paired device (Eli's phone): the iPad's Switch logs out the rig iPad's own Eli session
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const addReminder = async text => {
    const id = 'v2' + Date.now().toString(36);
    const r = await L.apiAs('eli', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', deviceToken: ph.device.token, profileToken: ph.sessions.eli, body: { value: { id, text, by: 'eli', byName: 'Eli', createdAt: Date.now() }, updated_at: Date.now() } });
    return r.status;
  };
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await ipad.ctx.addInitScript(IV); await tv.ctx.addInitScript(IV);
  const iget = mainNet(ipad.page), tget = mainNet(tv.page);
  await ipad.goto('#home'); await tv.goto('#home');
  await until(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), 15000);
  await until(() => tv.page.evaluate(() => hub.sync.lastPull > 0 && !!document.querySelector('#tv')), 15000);
  out.ipad.ivAfterBoot = await ivState(ipad.page); out.tv.ivAfterBoot = await ivState(tv.page);
  log('after boot, 30 s intervals in the shell — iPad', JSON.stringify(out.ipad.ivAfterBoot), 'TV', JSON.stringify(out.tv.ivAfterBoot));

  // control: before any switch
  let t = Date.now(); log('PUT control reminder →', await addReminder('VERIFY2 control'));
  const ci = await until(() => shows(ipad.page, 'VERIFY2 control'), 40000); out.ipad.controlMs = ci ? Date.now() - t : null;
  const ct = await until(() => shows(tv.page, 'VERIFY2 control'), 40000); out.tv.controlMs = ct ? Date.now() - t : null;
  await sleep(Math.max(0, 35000 - (Date.now() - t)));
  out.ipad.getsBefore = iget(t, Date.now()); out.tv.getsBefore = tget(t, Date.now()); out.windowBeforeMs = Date.now() - t;
  log(`control: iPad shows it after ${out.ipad.controlMs} ms, TV after ${out.tv.controlMs} ms; main-frame /api/data GETs in ${out.windowBeforeMs} ms: iPad ${out.ipad.getsBefore}, TV ${out.tv.getsBefore}`);

  // the switches
  await ipad.page.evaluate(() => { location.hash = '#me'; }); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 }); await ipad.page.click('.pcard[data-id="ezra"]');
  await until(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && hub.sync.lastPull > 0), 15000);
  await ipad.page.click('.tab[data-tab="home"]');
  await tv.page.click('#kiosk-switch');
  await tv.page.waitForSelector('.pcard[data-id="tv"]', { timeout: 10000 }); await tv.page.click('.pcard[data-id="tv"]');
  await until(() => tv.page.evaluate(() => hub.profile && hub.profile.id === 'tv' && !!document.querySelector('#tv')), 15000);
  await sleep(2000);
  out.ipad.ivAfterSwitch = await ivState(ipad.page); out.tv.ivAfterSwitch = await ivState(tv.page);
  out.ipad.profileAfter = await ipad.page.evaluate(() => hub.profile.id); out.tv.profileAfter = await tv.page.evaluate(() => hub.profile.id);
  log('after switch, 30 s intervals in the shell — iPad', JSON.stringify(out.ipad.ivAfterSwitch), 'TV', JSON.stringify(out.tv.ivAfterSwitch));

  t = Date.now(); log('PUT after-switch reminder →', await addReminder('VERIFY2 after switch'));
  await sleep(65000);
  out.windowAfterMs = Date.now() - t;
  out.ipad.getsAfter = iget(t, Date.now()); out.tv.getsAfter = tget(t, Date.now());
  out.ipad.showsAfter = await shows(ipad.page, 'VERIFY2 after switch'); out.tv.showsAfter = await shows(tv.page, 'VERIFY2 after switch');
  out.ipad.lastPullAgeMs = await ipad.page.evaluate(() => Date.now() - hub.sync.lastPull); out.tv.lastPullAgeMs = await tv.page.evaluate(() => Date.now() - hub.sync.lastPull);
  out.ipad.syncState = await ipad.page.evaluate(() => hub.sync.state); out.tv.syncState = await tv.page.evaluate(() => hub.sync.state);
  await ipad.page.screenshot({ path: path.join(EVID, 'verify2-ipad-ezra-home-65s-after-switch.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await tv.page.screenshot({ path: path.join(EVID, 'verify2-tv-board-65s-after-switch.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  log(`iPad (Ezra): GETs in ${out.windowAfterMs} ms after switch ${out.ipad.getsAfter}; shows new reminder ${out.ipad.showsAfter}; last pull ${out.ipad.lastPullAgeMs} ms ago; sync.state ${out.ipad.syncState}`);
  log(`TV (kiosk):  GETs in ${out.windowAfterMs} ms after switch ${out.tv.getsAfter}; shows new reminder ${out.tv.showsAfter}; last pull ${out.tv.lastPullAgeMs} ms ago; sync.state ${out.tv.syncState}`);

  // one pull brings it in: synthetic visibilitychange while visible (hub.js:339 handler → hub.pull())
  for (const [k, d] of [['ipad', ipad], ['tv', tv]]) {
    await d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    out[k].showsAfterOnePull = !!(await until(() => shows(d.page, 'VERIFY2 after switch'), 8000, 100));
    if (k === 'tv' && !out.tv.showsAfterOnePull) { await d.page.evaluate(() => window.__tv && __tv.paint()); out.tv.showsAfterPullAndPaint = await shows(d.page, 'VERIFY2 after switch'); }
  }
  log('after one pull (visibilitychange handler): iPad shows it', out.ipad.showsAfterOnePull, '· TV shows it', out.tv.showsAfterOnePull, out.tv.showsAfterPullAndPaint !== undefined ? '(after paint: ' + out.tv.showsAfterPullAndPaint + ')' : '');
  out.ipad.ivEnd = await ivState(ipad.page); out.tv.ivEnd = await ivState(tv.page);
  log('end: 30 s intervals — iPad', JSON.stringify(out.ipad.ivEnd), 'TV', JSON.stringify(out.tv.ivEnd));
  fs.writeFileSync(path.join(EVID, 'verify-poll-dies-after-profile-switch-2.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-poll-dies-after-profile-switch-2.json');
  const logs = [...ipad.logs, ...tv.logs].filter(l => /error/i.test(l)); if (logs.length) log('page errors:', logs.slice(0, 5));
} finally { await L.close(); }
