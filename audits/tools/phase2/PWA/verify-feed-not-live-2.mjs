// Phase 2 / PWA — skeptic #2 for finding "feed-not-live" (adult Home "Around the house" never refreshes on its own).
//   node "audits/tools/phase2/PWA/verify-feed-not-live-2.mjs"
// Fresh local instance, REAL clock on both server and browser (clock:'real', fixedTime:false) so nothing is frozen.
//   A  Eli's iPad Home is open. From Mom's phone (a second paired device) the raw API gets a new family reminder row AND a
//      new activity line. Wait for the iPad's own 30 s pull to land: the reminder (sync data) should appear, the feed line?
//   B  Tab away and back to Home (renderHome → loadFeed()), and fire visibilitychange (hub.pull): feed line?
//   C  Eli adds a reminder on Home: his own "Added a reminder: …" line in his feed? after the next pull?
//   D  Tap the Refresh button: both lines appear?
//   E  Mitigation check: the kiosk TV board (controllable clock) re-reads the feed after 5 min (index.html:1115), counted as
//      GET /api/activity requests.
// Evidence: audits/evidence/p2/PWA/verify-feed-not-live-2.json (+ two 1x PNGs of #feed).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const MOM_LINE = 'Skeptic2: Mom logged pea soup';
const MOM_REM = 'Skeptic2: pick up the dry cleaning';
const OWN_REM = 'Skeptic2: water the plants';
const OWN_LINE = 'Added a reminder: ' + OWN_REM;

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Mom phone (skeptic2)', profiles: ['mom'] });
  const asMom = (p, o = {}) => L.apiAs('mom', p, { ...o, deviceToken: ph.device.token, profileToken: ph.sessions.mom });
  const onServer = async t => (await asMom('/api/activity?limit=100')).body.activity.some(a => a.text === t);

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const P = ipad.page;
  const feedTexts = () => P.$$eval('#feed .ftxt', els => els.map(e => e.textContent));
  const remTexts = () => P.$$eval('#remlist .rem-text', els => els.map(e => e.textContent)).catch(() => []);
  const lastPull = async () => (await ipad.hub()).sync.lastPull;
  const waitPullAfter = async (t0, max = 45000) => { const until = Date.now() + max; while (Date.now() < until) { const lp = await lastPull(); if (lp > t0) return lp; await sleep(500); } return null; };
  const feedGets = [];
  P.on('request', r => { if (/\/api\/activity\?limit=/.test(r.url())) feedGets.push({ at: Date.now(), url: r.url().replace(/^.*\/api/, '/api') }); });

  await ipad.goto('#home');
  await P.waitForSelector('#feed .ftxt', { timeout: 20000 });
  await sleep(2000);
  const openedAt = Date.now();
  say('0 iPad Home open', { feedLines: (await feedTexts()).length, feedGETsSoFar: feedGets.length, lastPull: await lastPull() });

  // ── A: Mom posts from her phone; wait for the iPad's own 30 s pull ─────────────────────────────
  const id = 'skeptic2' + Date.now();
  const remPut = await asMom(`/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text: MOM_REM, by: 'mom', byName: 'Elizabeth', createdAt: Date.now() }, updated_at: Date.now() } });
  const actPost = await asMom('/api/activity', { method: 'POST', body: { app_id: 'leftovers', text: MOM_LINE } });
  const tPost = Date.now();
  const lp0 = await lastPull();
  const lpA = await waitPullAfter(Math.max(lp0, tPost));
  await sleep(2000);
  say('A after the iPad\'s next 30 s pull', {
    remPutStatus: remPut.status, activityPostStatus: actPost.status, momLineOnServer: await onServer(MOM_LINE),
    pullLandedAfterPost: !!lpA, secondsAfterPost: Math.round((Date.now() - tPost) / 1000),
    momReminderOnIpad: (await remTexts()).includes(MOM_REM),
    momFeedLineOnIpad: (await feedTexts()).includes(MOM_LINE),
    feedGETsSinceOpen: feedGets.filter(g => g.at > openedAt).length,
  });
  const shotA = path.join(OUT, 'verify-feed-not-live-2-after-pull-ipad-portrait-light.png');
  await P.locator('#feed').first().screenshot({ path: shotA, scale: 'css', animations: 'disabled' });

  // ── B: tab away and back; visibilitychange ─────────────────────────────────────────
  await P.click('.tab[data-tab="apps"]'); await sleep(800);
  await P.click('.tab[data-tab="home"]'); await sleep(2500);
  const afterTab = (await feedTexts()).includes(MOM_LINE);
  await P.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(2500);
  say('B tab Apps→Home, then visibilitychange', { momFeedLineAfterTabSwitch: afterTab, momFeedLineAfterVisibility: (await feedTexts()).includes(MOM_LINE), feedGETsSinceOpen: feedGets.filter(g => g.at > openedAt).length });

  // ── C: Eli's own line ────────────────────────────────────────────────────
  await P.fill('#remtext', OWN_REM); await P.press('#remtext', 'Enter');
  const tOwn = Date.now(); await sleep(2500);
  const c1 = { ownReminderShown: (await remTexts()).includes(OWN_REM), ownLineOnServer: await onServer(OWN_LINE), ownLineInFeed: (await feedTexts()).includes(OWN_LINE) };
  const lpC = await waitPullAfter(tOwn); await sleep(2000);
  say('C Eli adds a reminder on Home', { ...c1, afterNextPull: { pulled: !!lpC, ownLineInFeed: (await feedTexts()).includes(OWN_LINE) }, feedGETsSinceOpen: feedGets.filter(g => g.at > openedAt).length });

  // ── D: Refresh ─────────────────────────────────────────────────────────
  await P.click('#feed-refresh'); await sleep(2500);
  const ft = await feedTexts();
  say('D after tapping Refresh', { momFeedLineOnIpad: ft.includes(MOM_LINE), ownLineInFeed: ft.includes(OWN_LINE), feedGETsSinceOpen: feedGets.filter(g => g.at > openedAt).length, minutesOpen: +((Date.now() - openedAt) / 60000).toFixed(1) });
  const shotD = path.join(OUT, 'verify-feed-not-live-2-after-refresh-ipad-portrait-light.png');
  await P.locator('#feed').first().screenshot({ path: shotD, scale: 'css', animations: 'disabled' });
  log.shots = [rel(shotA), rel(shotD)];
  console.log('shots', log.shots);
  await ipad.close();

  // ── E: kiosk board mitigation (TV profile), controllable clock ───────────────────────────
  // Counted at the request level: on a clock:'real' rig the seed dates some lines later today, so a line posted "now"
  // sorts below the board's top 5 (probeIndexOfMomLine below) and cannot be used to judge the TV's refresh.
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  const tvGets = []; tv.page.on('request', r => { if (/\/api\/activity\?limit=/.test(r.url())) tvGets.push(r.url().replace(/^.*\/api/, '/api')); });
  await tv.goto('#home');
  await tv.page.waitForSelector('#tv-feed li', { timeout: 20000 }).catch(() => {});
  await sleep(2000);
  const g0 = tvGets.length;
  await tv.ctx.clock.runFor(120000); await sleep(2000);
  const g2 = tvGets.length;
  await tv.ctx.clock.runFor(190000); await sleep(2500);
  const g5 = tvGets.length;
  const rows = (await asMom('/api/activity?limit=100')).body.activity;
  say('E kiosk TV board (fake clock): feed GETs', { kind: await tv.page.evaluate(() => hub.profile && hub.profile.kind), atOpen: g0, after2minFake: g2, after5minFake: g5, urls: tvGets, probeIndexOfMomLine: rows.findIndex(a => a.text === MOM_LINE) });
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-feed-not-live-2.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-feed-not-live-2.json');
  await L.close();
}
