// STAB skeptic #1 — "home-feed-never-refreshes": does the adult Home's "Around the house" feed stay stale on an open page?
// Independent of feed.mjs/advance.mjs: NO fake browser clock — real time, clock:'real' (seed relative to now),
// so hub.js's real 30 s pull timer runs exactly as on a device.
//   node "audits/tools/phase2/STAB/verify-home-feed-never-refreshes-1.mjs"
// Steps: Eli's iPad opens Home. Mae (id christian) posts a feed line AND a family reminder via the raw local API.
// Wait ~75 s real time (>= 2 pulls). Check: reminder visible (pulls work), feed line visible? Then Home -> Apps -> Home
// tab switch, check again. Then tap #feed-refresh, check again. Counts /api/activity GETs and /api/data requests.
// Output: audits/evidence/p2/STAB/verify-home-feed-1.json + verify-home-feed-1-before-refresh.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = {};
try {
  const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const req = { activityGet: 0, data: 0, log: [] };
  ip.page.on('request', r => {
    const u = r.url();
    if (/\/api\/activity\?/.test(u) && r.method() === 'GET') { req.activityGet++; req.log.push(new Date().toISOString().slice(11, 19) + ' ' + u.replace(/^https?:\/\/[^/]+/, '')); }
    else if (/\/api\/data/.test(u)) req.data++;
  });
  const t0 = Date.now();
  await ip.goto('#home');
  await ip.page.waitForSelector('#feed li');
  await sleep(3000);
  R.atLoad = { activityGet: req.activityGet, data: req.data };

  const TEXT = 'SKEPTIC feed check ' + Math.random().toString(36).slice(2, 7);
  const REM = 'SKEPTIC reminder ' + Math.random().toString(36).slice(2, 7);
  const post = await L.apiAs('christian', '/api/activity', { method: 'POST', body: { app_id: 'prayer', text: TEXT } });
  const id = 'skeptic' + Date.now();
  const rem = await L.apiAs('christian', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text: REM, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() } });
  const server = await L.apiAs('eli', '/api/activity?limit=30');
  R.posted = { activity: post.status, reminder: rem.status, serverFeedHasLine: JSON.stringify(server.body).includes(TEXT) };

  const state = async () => ip.page.evaluate(([t, r]) => ({
    tab: document.documentElement.dataset.tab,
    feedHasLine: (document.querySelector('#feed') || {}).innerText?.includes(t) || false,
    remindersHasNew: (document.querySelector('#remlist') || {}).innerText?.includes(r) || false,
    lastPullAgoS: window.hub && hub.sync.lastPull ? Math.round((Date.now() - hub.sync.lastPull) / 1000) : null,
    syncState: window.hub && hub.sync.state,
  }), [TEXT, REM]);

  await sleep(75000);
  R.after75s = { ...(await state()), activityGet: req.activityGet, data: req.data, elapsedS: Math.round((Date.now() - t0) / 1000) };
  await ip.page.screenshot({ path: path.join(OUT, 'verify-home-feed-1-before-refresh.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  await ip.page.click('.tab[data-tab="apps"]'); await sleep(800);
  await ip.page.click('.tab[data-tab="home"]'); await sleep(3000);
  R.afterTabSwitch = { ...(await state()), activityGet: req.activityGet };

  await ip.page.click('#feed-refresh'); await sleep(3000);
  R.afterRefreshTap = { ...(await state()), activityGet: req.activityGet };
  R.activityGetLog = req.log;
  R.pageErrors = ip.logs.filter(l => /pageerror/.test(l));
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-home-feed-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
