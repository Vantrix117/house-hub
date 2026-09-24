// Skeptic #1 for STAB finding "poll-dies-after-profile-switch". Independent of poll.mjs/advance.mjs: REAL wall-clock time
// (no installed/fake clock), so no fake-timer artefact can explain a missing pull.
//   node "audits/tools/phase2/STAB/verify-poll-dies-after-profile-switch-1.mjs" [webkit|chromium]
//
// Three contexts run side by side on the local rig (variant typical, clock real):
//   IPAD   Kitchen iPad signed in as Eli at page load → Me → Switch → tap Ezra (in-page switch, no reload)
//   TV     Downstairs TV board at page load → Switch → tap Downstairs TV (in-page switch, no reload)
//   CTRL   control: a fresh page load signed in as Ezra (no switch)
// Each window is 65 s of real time (≥ 2 ticks of a 30 s poll). An init script wraps setInterval/clearInterval to count the
// live 30 000 ms intervals in the shell window. After the switch, Mae adds a family reminder through the raw API and we
// check which of the three pages shows it 65 s later; then a visibilitychange is fired on the switched pages.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const WIN = 65000;
const L = await local({ variant: 'typical', clock: 'real', engine });
const R = { engine };
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };

const INSTR = () => {
  if (window.top !== window) return;
  const live = new Map(); const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); live.set(id, ms); return id; };
  window.clearInterval = function (id) { live.delete(id); return ci.call(window, id); };
  window.__live30 = () => [...live.values()].filter(ms => ms === 30000).length;
};
async function dev(opts) {
  const d = await L.device({ ...opts, fixedTime: false });
  await d.ctx.addInitScript(INSTR);
  d.data = 0; d.page.on('request', r => { if (/\/api\/data\//.test(r.url())) d.data++; });
  return d;
}
const state = d => d.page.evaluate(() => ({ profile: hub.profile && hub.profile.id, live30sIntervals: window.__live30(), lastPullAgoS: hub.sync.lastPull ? Math.round((Date.now() - hub.sync.lastPull) / 1000) : null, syncState: hub.sync.state }));
async function switchTo(d, id, open) {
  await open();
  await d.page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 10000 });
  await d.page.click(`#profiles .pcard[data-id="${id}"]`);
  await d.page.waitForFunction(pid => window.hub && hub.profile && hub.profile.id === pid && document.getElementById('gate').hidden, id, { timeout: 10000 });
  await sleep(3000);   // let the sign-in pull (hub.ready → hub.pull) finish
}
const shows = (d, t) => d.page.evaluate(t => [...document.querySelectorAll('#remlist .rem-text')].some(e => e.textContent.includes(t)), t);

try {
  const ipad = await dev({ device: 'ipad-portrait', profile: 'eli' });
  const tv = await dev({ device: 'tv', profile: 'tv' });
  const ctrl = await dev({ device: 'ipad-portrait', profile: 'ezra' });
  await Promise.all([ipad.goto('#home'), tv.goto('#home'), ctrl.goto('#home')]);
  await Promise.all([ipad.page.waitForSelector('#view-home .card'), tv.page.waitForSelector('#tv #clock'), ctrl.page.waitForSelector('#view-home .hero-title')]);
  await sleep(5000);

  // window 1: before any switch
  let b = [ipad.data, tv.data, ctrl.data]; await sleep(WIN);
  log('W1 before switch: /api/data requests in 65 s real time', { ipadEli: ipad.data - b[0], tv: tv.data - b[1], ctrlEzra: ctrl.data - b[2] });
  log('W1 state', { ipad: await state(ipad), tv: await state(tv), ctrl: await state(ctrl) });

  // in-page switches
  await Promise.all([
    switchTo(ipad, 'ezra', async () => { await ipad.page.evaluate(() => { location.hash = '#me'; }); await ipad.page.waitForSelector('#switch'); await ipad.page.click('#switch'); }),
    switchTo(tv, 'tv', async () => { await tv.page.click('#kiosk-switch'); }),
  ]);
  log('after switch state', { ipad: await state(ipad), tv: await state(tv), ctrl: await state(ctrl), ipadHash: await ipad.page.evaluate(() => location.hash), navigations: 'none (same document)' });

  // window 2: after the switch
  b = [ipad.data, tv.data, ctrl.data]; await sleep(WIN);
  log('W2 after switch: /api/data requests in 65 s real time', { ipadEzraSwitched: ipad.data - b[0], tvSwitched: tv.data - b[1], ctrlEzra: ctrl.data - b[2] });
  log('W2 state', { ipad: await state(ipad), tv: await state(tv), ctrl: await state(ctrl) });

  // a reminder from Mae's phone (raw API)
  const id = 'verify-' + Date.now().toString(36), text = 'VERIFY poll: return library books';
  const put = await L.apiAs('christian', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() } });
  if (await ipad.page.evaluate(() => location.hash) !== '#home') await ipad.page.evaluate(() => { location.hash = '#home'; });
  await sleep(WIN);
  log('W3 reminder PUT then 65 s real time: shown on the page?', { put: put.status, ipadEzraSwitched: await shows(ipad, 'VERIFY poll'), tvSwitched: await tv.page.evaluate(() => ({ remCardHidden: document.getElementById('tv-rem-card').hidden, shown: [...document.querySelectorAll('#tv-rem-card .rem-text')].some(e => e.textContent.includes('VERIFY poll')) })), ctrlEzra: await shows(ctrl, 'VERIFY poll') });
  log('W3 state', { ipad: await state(ipad), tv: await state(tv), ctrl: await state(ctrl) });
  await ipad.page.screenshot({ path: path.join(OUT, `verify-poll-1-ipad-${engine}.png`), scale: 'css', animations: 'disabled' });
  await tv.page.screenshot({ path: path.join(OUT, `verify-poll-1-tv-${engine}.png`), scale: 'css', animations: 'disabled' });

  // wake: visibilitychange (what unlocking the iPad fires)
  for (const d of [ipad, tv]) await d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(4000);
  log('W4 after a visibilitychange', { ipadEzraSwitched: await shows(ipad, 'VERIFY poll'), tvShown: await tv.page.evaluate(() => [...document.querySelectorAll('#tv-rem-card .rem-text')].some(e => e.textContent.includes('VERIFY poll'))), ipad: await state(ipad), tv: await state(tv) });
  b = [ipad.data, tv.data]; await sleep(WIN);
  log('W5 65 s after the wake: /api/data requests (does the poll come back?)', { ipadEzraSwitched: ipad.data - b[0], tvSwitched: tv.data - b[1], ipad: await state(ipad), tv: await state(tv) });
  fs.writeFileSync(path.join(OUT, `verify-poll-1-${engine}.json`), JSON.stringify(R, null, 1));
} finally { await L.close(); }
