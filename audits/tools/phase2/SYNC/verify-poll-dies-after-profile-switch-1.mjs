// SYNC skeptic #1 — "poll-dies-after-profile-switch": does the shell's 30 s pull really stop after an in-page sign-in?
//   node "audits/tools/phase2/SYNC/verify-poll-dies-after-profile-switch-1.mjs"   (≈3 min)
// Independent of e1d: every page's setInterval/clearInterval is wrapped by an init script so we can see the 30 000 ms
// interval itself (not just the network), the new family reminder is written straight through the API as Eli (no phone),
// and a full page reload afterwards is the control that shows the pull returns only when the page restarts.
import { local, sleep } from '../../lib/local.mjs';
import { waitFor, writeEvidence, shot } from './_util.mjs';

const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });

const TRACK = () => {
  if (window.top !== window) return;               // the shell only
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  const live = new Map();                           // id -> ms
  window.__iv = { live, created30: 0, cleared30: 0 };
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); live.set(id, ms); if (ms === 30000) window.__iv.created30++; return id; };
  window.clearInterval = id => { if (live.get(id) === 30000) window.__iv.cleared30++; live.delete(id); return ci(id); };
};
const ivState = page => page.evaluate(() => ({ live30: [...window.__iv.live.values()].filter(ms => ms === 30000).length, created30: window.__iv.created30, cleared30: window.__iv.cleared30, profile: hub.profile && hub.profile.id, lastPull: hub.sync.lastPull, state: hub.sync.state }));
const netLog = page => { const rows = []; page.on('request', r => { const u = r.url(); if (r.frame() === page.mainFrame() && u.includes('/api/data/') && r.method() === 'GET') rows.push(Date.now()); }); return rows; };
const between = (rows, a, b) => rows.filter(t => t >= a && t < b).length;
const shows = (page, text) => page.evaluate(text => { const ul = document.querySelector('#remlist'); return !!ul && ul.textContent.includes(text); }, text);
let ph = null;   // Eli's own phone (a second paired device): the iPad's Switch signs Eli out of the rig device's session
async function addReminder(text) {
  const id = 'skeptic' + Date.now().toString(36);
  const r = await L.apiAs('eli', `/api/data/reminders/${encodeURIComponent('item:' + id)}?scope=family`, { method: 'PUT', deviceToken: ph.device.token, profileToken: ph.sessions.eli, body: { value: { id, text, by: 'eli', byName: 'Eli', createdAt: Date.now() }, updated_at: Date.now() } });
  const back = await L.apiAs('eli', `/api/data/reminders?scope=family`, { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  return { status: r.status, onServer: JSON.stringify(back.body).includes(text) };
}

try {
  ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await ipad.ctx.addInitScript(TRACK); await tv.ctx.addInitScript(TRACK);
  const inet = netLog(ipad.page), tnet = netLog(tv.page);
  await ipad.goto('#home'); await tv.goto('#home');
  await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await waitFor(() => tv.page.evaluate(() => hub.sync.lastPull > 0 && !!document.querySelector('#tv')), { timeout: 15000 });

  // 1. before any switch: one live 30 s interval, and it pulls
  out.before = { ipad: await ivState(ipad.page), tv: await ivState(tv.page) };
  let a = Date.now(); await sleep(35000);
  out.before.ipadGets35s = between(inet, a, Date.now()); out.before.tvGets35s = between(tnet, a, Date.now());
  log('before switch', JSON.stringify(out.before));

  // 2. iPad: Me → Switch → Ezra (kid, opens on tap).  TV: Switch → Downstairs TV (the same kiosk profile again).
  await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(600);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 });
  await ipad.page.click('.pcard[data-id="ezra"]');
  await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && hub.sync.lastPull > 0), { timeout: 15000 });
  await ipad.page.click('.tab[data-tab="home"]');
  await tv.page.click('#kiosk-switch');
  await tv.page.waitForSelector('.pcard[data-id="tv"]', { timeout: 10000 });
  await tv.page.click('.pcard[data-id="tv"]');
  await waitFor(() => tv.page.evaluate(() => hub.profile && hub.profile.id === 'tv' && hub.sync.lastPull > 0 && !!document.querySelector('#tv')), { timeout: 15000 });
  await sleep(1000);
  out.afterSwitch = { ipad: await ivState(ipad.page), tv: await ivState(tv.page) };
  log('right after switch', JSON.stringify(out.afterSwitch));

  // 3. a family reminder written on the server by Eli; wait 65 s (> two poll periods)
  out.put = await addReminder('SKEPTIC poll reminder');
  log('reminder PUT as Eli from a second device', JSON.stringify(out.put));
  a = Date.now(); await sleep(65000);
  out.after65 = {
    ipadGets: between(inet, a, Date.now()), tvGets: between(tnet, a, Date.now()),
    ipadShows: await shows(ipad.page, 'SKEPTIC poll'), tvShows: await shows(tv.page, 'SKEPTIC poll'),
    ipad: await ivState(ipad.page), tv: await ivState(tv.page),
  };
  await shot(ipad.page, 'verify1-ipad-ezra-home-65s-after-switch.png');
  await shot(tv.page, 'verify1-tv-board-65s-after-switch.png');
  log('65 s after the reminder', JSON.stringify(out.after65));

  // 4. control: reload both pages (a fresh hub.js) — the interval and the reminder should come back without any other help
  await ipad.goto('#home'); await tv.goto('#home');
  const ri = !!(await waitFor(() => shows(ipad.page, 'SKEPTIC poll'), { timeout: 10000, every: 200 }));
  const rt = !!(await waitFor(() => shows(tv.page, 'SKEPTIC poll'), { timeout: 10000, every: 200 }));
  out.afterReload = { ipad: await ivState(ipad.page), tv: await ivState(tv.page), ipadShows: ri, tvShows: rt };
  log('after a page reload', JSON.stringify(out.afterReload));
  out.logs = { ipad: ipad.logs.filter(l => /error/i.test(l)).slice(0, 10), tv: tv.logs.filter(l => /error/i.test(l)).slice(0, 10) };
  log('evidence', writeEvidence('verify1-poll-dies-after-profile-switch.json', out));
} finally { await L.close(); }
