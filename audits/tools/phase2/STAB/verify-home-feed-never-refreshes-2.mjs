// STAB skeptic #2: does the adult Home's "Around the house" feed stay stale on a page that stays open?
// Independent of feed.mjs: REAL browser clock (no fake timers, no sliced runFor), clock:'real' server, WebKit.
//   node "audits/tools/phase2/STAB/verify-home-feed-never-refreshes-2.mjs"
// Steps on Eli's Kitchen iPad Home:
//   A. Mae posts a feed line via the local API; wait ~70 s of real time (>= 2 hub.js 30 s pull cycles).
//   B. Tab away to Apps and back to Home (re-runs renderHome -> loadFeed()).
//   C. Eli adds a reminder himself on Home (hub.activity 'Added a reminder: ...').
//   D. Control: tap the feed's refresh button.
//   E. Control: a second iPad context opened fresh shows the line (server has it).
// Output: audits/evidence/p2/STAB/verify-home-feed-never-refreshes-2.json (+ .png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = {};
try {
  const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const acts = []; ip.page.on('request', r => { if (/\/api\/activity/.test(r.url()) && r.method() === 'GET') acts.push(new Date().toISOString().slice(11, 19)); });
  const pulls = []; ip.page.on('request', r => { if (/\/api\/data\//.test(r.url()) && r.method() === 'GET') pulls.push(1); });
  await ip.goto('#home'); await ip.page.waitForSelector('#feed li .fline', { timeout: 20000 }); await sleep(2500);
  const feedHas = t => ip.page.evaluate(t => { const e = document.querySelector('#feed'); return !!e && e.innerText.includes(t); }, t);
  const lastPull = () => ip.page.evaluate(() => hub.sync.lastPull);
  R.initial = { activityGets: acts.length, lastPull: await lastPull() };

  const TEXT = 'SKEPTIC2 feed probe: prayed for Grandpa';
  const post = await L.apiAs('christian', '/api/activity', { method: 'POST', body: { app_id: 'prayer', text: TEXT } });
  const lp0 = await lastPull(); const pulls0 = pulls.length;
  await sleep(70000);
  R.A_after70sReal = { post: post.status, lastPullChanged: (await lastPull()) !== lp0, dataGetsDuring: pulls.length - pulls0, activityGetsTotal: acts.length, feedShowsMae: await feedHas(TEXT) };

  await ip.page.click('.tab[data-tab="apps"]'); await sleep(800); await ip.page.click('.tab[data-tab="home"]'); await sleep(2500);
  R.B_afterTabSwitch = { activityGetsTotal: acts.length, feedShowsMae: await feedHas(TEXT) };

  const MINE = 'SKEPTIC2 bins out Thursday';
  await ip.page.fill('#remtext', MINE); await ip.page.press('#remtext', 'Enter'); await sleep(4000);
  const srv = await L.apiAs('eli', '/api/activity?limit=30');
  R.C_afterOwnReminder = { serverHasOwnLine: JSON.stringify(srv.body).includes('Added a reminder: ' + MINE), activityGetsTotal: acts.length, feedShowsOwnLine: await feedHas('Added a reminder: ' + MINE), feedShowsMae: await feedHas(TEXT) };
  await ip.page.screenshot({ path: path.join(OUT, 'verify-home-feed-never-refreshes-2-stale.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  await ip.page.click('#feed-refresh'); await sleep(3000);
  R.D_afterRefreshTap = { activityGetsTotal: acts.length, feedShowsMae: await feedHas(TEXT), feedShowsOwnLine: await feedHas('Added a reminder: ' + MINE) };

  const ip2 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await ip2.goto('#home'); await ip2.page.waitForSelector('#feed li .fline', { timeout: 20000 }); await sleep(2500);
  R.E_freshDevice = { feedShowsMae: await ip2.page.evaluate(t => document.querySelector('#feed').innerText.includes(t), TEXT) };
  R.logs = ip.logs.filter(l => /error/i.test(l)).slice(0, 5);
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-home-feed-never-refreshes-2.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
