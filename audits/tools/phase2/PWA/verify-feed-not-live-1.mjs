// Phase 2 / PWA — skeptic #1 for "feed-not-live": does the Home "Around the house" feed stay stale on an open iPad
// although hub.js pulls every 30 s and Home re-renders on each pull? Independent of feed.mjs.
//   node "audits/tools/phase2/PWA/verify-feed-not-live-1.mjs"
// Steps: (0) Eli's iPad (real browser clock, so the 30 s pull timer runs) opens Home; every GET /api/activity and pull
// request is counted. (1) From a separate "Mom's phone" device, Mom posts a feed line AND adds a family reminder (so we can
// see the pull land and Home re-render). (2) Poll the iPad for 70 s: when does the reminder appear, does the line ever appear,
// how many feed GETs were made? (3) Apps tab → Home tab (a re-render via tab switch). (4) Eli adds a reminder from Home;
// is his own "Added a reminder: …" line in the feed 3 s later and after the next pull? (5) Control: tap Refresh.
// Writes audits/evidence/p2/PWA/verify-feed-not-live-1.json and two 1x PNGs of #feed.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const RUN = Date.now().toString(36);
const MOM_LINE = `Verify ${RUN}: Mom logged soup`;
const MOM_REM = `Verify ${RUN}: Mom reminder`;
const OWN_REM = `Verify ${RUN}: Eli stamps`;
const OWN_LINE = 'Added a reminder: ' + OWN_REM;
const out = { run: RUN };
const say = (k, v) => { out[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const mom = await L.newDevice({ name: "Mom's phone (verify)", profiles: ['mom'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const P = ipad.page;
  const reqs = [];
  const t0 = Date.now();
  P.on('request', r => { const u = r.url(); if (u.startsWith(L.api)) { const p = new URL(u).pathname; if (/^\/api\/(activity|sync|data)/.test(p)) reqs.push({ t: Math.round((Date.now() - t0) / 1000), m: r.method(), p: p + (new URL(u).search || '') }); } });
  const feedTexts = () => P.$$eval('#feed .ftxt', els => els.map(e => e.textContent));
  const remTexts = () => P.$$eval('#remlist .rem-text', els => els.map(e => e.textContent));
  const feedGets = () => reqs.filter(r => r.m === 'GET' && r.p.startsWith('/api/activity')).length;
  const shot = async name => { const f = path.join(OUT, name); await P.locator('#feed').first().screenshot({ path: f, scale: 'css', animations: 'disabled' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

  await ipad.goto('#home');
  await P.waitForSelector('#feed .ftxt', { timeout: 20000 });
  await sleep(2000);
  say('0 Home open', { feedLines: (await feedTexts()).length, feedGETsSoFar: feedGets(), lastPull: (await ipad.hub()).sync.lastPull });
  const tMark = Date.now();

  // (1) Mom, on her own device
  const post = await L.apiAs('mom', '/api/activity', { method: 'POST', body: { app_id: 'leftovers', text: MOM_LINE }, deviceToken: mom.device.token, profileToken: mom.sessions.mom });
  const rid = 'vfy' + RUN;
  const put = await L.apiAs('mom', `/api/data/reminders/item:${rid}?scope=family`, { method: 'PUT', body: { value: { id: rid, text: MOM_REM, by: 'mom', byName: 'Elizabeth', createdAt: Date.now() }, updated_at: Date.now() }, deviceToken: mom.device.token, profileToken: mom.sessions.mom });
  const onServer = (await L.apiAs('mom', '/api/activity?limit=100', { deviceToken: mom.device.token, profileToken: mom.sessions.mom })).body.activity.some(a => a.text === MOM_LINE);
  say('1 Mom posts a line + a family reminder from her phone', { postStatus: post.status, putStatus: put.status, lineOnServer: onServer });

  // (2) poll the open iPad Home for 70 s
  const feedGetsBefore = feedGets();
  const timeline = [];
  let remAt = null;
  for (let s = 5; s <= 70; s += 5) {
    await sleep(5000);
    const h = await ipad.hub();
    const rem = (await remTexts()).includes(MOM_REM), line = (await feedTexts()).includes(MOM_LINE);
    if (rem && remAt == null) remAt = s;
    timeline.push({ s, lastPullAgoS: h.sync.lastPull ? Math.round((Date.now() - h.sync.lastPull) / 1000) : null, pulledSinceMark: h.sync.lastPull > tMark, reminderOnHome: rem, momLineInFeed: line });
  }
  say('2 iPad Home over 70 s', { timeline, reminderAppearedAfterS: remAt, feedGETsDuringWait: feedGets() - feedGetsBefore, pullRequestsDuringWait: reqs.filter(r => r.t * 1000 >= tMark - t0 && !r.p.startsWith('/api/activity')).map(r => `${r.t}s ${r.m} ${r.p}`) });
  const stale = await shot('verify-feed-not-live-1-after-70s-ipad-portrait-light.png');

  // (3) tab switch Apps → Home
  const g3 = feedGets();
  await P.click('.tab[data-tab="apps"]'); await sleep(1000);
  await P.click('.tab[data-tab="home"]'); await P.waitForSelector('#feed .ftxt'); await sleep(2000);
  say('3 after Apps → Home tab switch', { momLineInFeed: (await feedTexts()).includes(MOM_LINE), feedGETs: feedGets() - g3 });

  // (4) Eli's own line
  const g4 = feedGets();
  await P.fill('#remtext', OWN_REM); await P.press('#remtext', 'Enter');
  await sleep(3000);
  const own3 = { reminderShown: (await remTexts()).includes(OWN_REM), ownLineInFeed: (await feedTexts()).includes(OWN_LINE), ownLineOnServer: (await L.apiAs('mom', '/api/activity?limit=100', { deviceToken: mom.device.token, profileToken: mom.sessions.mom })).body.activity.some(a => a.text === OWN_LINE) };
  const lp = (await ipad.hub()).sync.lastPull;
  let waited = 0; while ((await ipad.hub()).sync.lastPull === lp && waited < 40000) { await sleep(1000); waited += 1000; }
  await sleep(1500);
  say('4 Eli adds a reminder on Home', { after3s: own3, nextPullRanAfterS: Math.round(waited / 1000), ownLineInFeedAfterNextPull: (await feedTexts()).includes(OWN_LINE), feedGETs: feedGets() - g4 });

  // (5) control: Refresh
  const g5 = feedGets();
  await P.click('#feed-refresh'); await sleep(2500);
  const ft = await feedTexts();
  const fresh = await shot('verify-feed-not-live-1-after-refresh-ipad-portrait-light.png');
  say('5 after tapping Refresh', { momLineInFeed: ft.includes(MOM_LINE), ownLineInFeed: ft.includes(OWN_LINE), feedGETs: feedGets() - g5, shots: [stale, fresh] });
  say('console errors', ipad.logs.filter(l => /^(error|pageerror)/.test(l)).slice(0, 10));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-feed-not-live-1.json'), JSON.stringify(out, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-feed-not-live-1.json');
  await L.close();
}
