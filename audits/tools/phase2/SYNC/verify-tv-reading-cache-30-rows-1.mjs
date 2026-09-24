// Skeptic #1 for SYNC finding "tv-reading-cache-30-rows": the TV's "Reading today" ✓ comes from "Read week…" feed lines
// (index.html:1063). refreshFeed reads 100 rows but writes only rows.slice(0, 30) to localStorage 'hub.feed' (index.html:1108),
// and a fresh page seeds `feed` from that cache (index.html:922). Independent re-run with a same-run control and the
// online-reload and reconnect cases the investigator did not measure.
//   node "audits/tools/phase2/SYNC/verify-tv-reading-cache-30-rows-1.mjs"
// Scenario (clock: real, so "today" is the real day):
//   Eli posts "Read week 38 day 3 — Acts 6", then 35 other lines (Eli's reading line ends up at feed index 35+),
//   then Mae posts "Read week 38 day 3 — Acts 6" + 3 more lines (her line stays inside the first 30 = control).
//   1. TV online: both ✓?  2. what the cache holds  3. ONLINE reload: sample ✓ every 50 ms from load
//   3b. offline without a reload (a plain Wi-Fi blip) + a failed feed refresh   4. offline reopen (API unreachable, shell still served = SW-cached shell): Eli ✓? Mae ✓?
//   5. back online: does the hub's 'online' pull bring Eli's ✓ back? 6. after the TV's 5-minute feed tick.
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
const out = {};

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const dev = await L.newDevice({ name: 'Skeptic poster', profiles: ['eli', 'christian'] });
  const post = (pid, app, text) => L.apiAs(null, '/api/activity', { method: 'POST', deviceToken: dev.device.token, profileToken: dev.sessions[pid], body: { app_id: app, text } });
  const r1 = await post('eli', 'f260', 'Read week 38 day 3 — Acts 6');
  if (r1.status !== 200) throw new Error('post failed ' + r1.status + ' ' + JSON.stringify(r1.body));
  for (let i = 1; i <= 35; i++) await post('christian', 'leftovers', 'Logged dish ' + i + ' in the fridge');
  await post('christian', 'f260', 'Read week 38 day 3 — Acts 6');
  for (let i = 1; i <= 3; i++) await post('eli', 'leftovers', 'Ate dish ' + i);
  const server = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity;
  out.serverFeed = { rows: server.length, eliReadIndex: server.findIndex(a => a.profile_id === 'eli' && /^Read week/.test(a.text)), maeReadIndex: server.findIndex(a => a.profile_id === 'christian' && /^Read week/.test(a.text)) };
  log('server feed (limit 100):', JSON.stringify(out.serverFeed));

  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const readState = () => tv.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#tv-read .tv-face')].map(e => [e.textContent.replace('✓', '').trim(), !e.classList.contains('off') && /✓/.test(e.textContent)])));
  const waitRead = async (pred, ms = 10000) => { const until = Date.now() + ms; let s = {}; while (Date.now() < until) { try { s = await readState(); if (pred(s)) return s; } catch {} await sleep(200); } return s; };

  // 1. online
  await tv.goto('#home');
  out.online = await waitRead(s => s.Eli && s.Mae);
  log('1. TV online, Reading today:', JSON.stringify(out.online));

  // 2. cache
  out.cache = await tv.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.feed') || '[]'); return { rows: c.length, hasEliRead: c.some(a => a.profile_id === 'eli' && /^Read week/.test(a.text)), hasMaeRead: c.some(a => a.profile_id === 'christian' && /^Read week/.test(a.text)) }; });
  log('2. localStorage hub.feed:', JSON.stringify(out.cache));

  // 3. ONLINE reload: sample every 50 ms from the load event
  await tv.page.reload({ waitUntil: 'load' });
  const samples = []; const rs = Date.now();
  while (Date.now() - rs < 4000) { try { const s = await readState(); if (Object.keys(s).length) samples.push({ ms: Date.now() - rs, eli: !!s.Eli }); } catch {} await sleep(50); }
  const firstTrue = samples.find(s => s.eli);
  out.onlineReload = { samples: samples.length, firstSampleEli: samples[0] && samples[0].eli, falseSamples: samples.filter(s => !s.eli).length, firstTrueMs: firstTrue ? firstTrue.ms : null, final: samples.length ? samples[samples.length - 1].eli : null };
  log('3. ONLINE reload, Eli ✓ over the first 4 s:', JSON.stringify(out.onlineReload));

  // 3b. a Wi-Fi blip WITHOUT a reload: the feed refresh fails, the in-memory 100-row feed should be kept
  await tv.setOffline(true);
  await tv.page.evaluate(() => window.__tv.refreshFeed());
  out.blipNoReload = await readState();
  log('3b. offline, no reload, after a failed feed refresh, Reading today:', JSON.stringify(out.blipNoReload));

  // 4. offline reopen (API unreachable; the shell itself is still served, as the SW would serve it)
  await tv.page.reload({ waitUntil: 'load' });
  await tv.setOffline(true);                         // re-fire 'offline' / navigator.onLine in the new document
  await sleep(3000);
  out.offlineReopen = await readState();
  out.offlineSync = await tv.page.evaluate(() => window.hub && hub.sync && hub.sync.state);
  out.offlineFeedInMemory = await tv.page.evaluate(() => [...document.querySelectorAll('#tv-feed li')].length);
  const shotFile = path.join(EVID, 'verify-tv-reading-cache-offline-reopen.png');
  await tv.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = path.relative(ROOT, shotFile).split(path.sep).join('/');
  log('4. offline reopen, Reading today:', JSON.stringify(out.offlineReopen), 'sync:', out.offlineSync, 'feed pane lines:', out.offlineFeedInMemory);

  // 5. back online: hub.js pulls on 'online' (apps/hub.js:340) → onSync repaints, but the feed itself is not re-read
  await tv.setOffline(false);
  await sleep(8000);
  out.afterOnline8s = await readState();
  out.afterOnlineSync = await tv.page.evaluate(() => window.hub && hub.sync && hub.sync.state);
  log('5. back online 8 s later, Reading today:', JSON.stringify(out.afterOnline8s), 'sync:', out.afterOnlineSync);

  // 6. the TV's own 5-minute feed refresh (tick → refreshFeed, index.html:1114) — driven through the self-check hook
  await tv.page.evaluate(() => window.__tv.tick(new Date(Date.now() + 300001)));
  out.afterFeedTick = await waitRead(s => s.Eli, 5000);
  log('6. after the 5-minute feed tick, Reading today:', JSON.stringify(out.afterFeedTick));

  out.errors = tv.logs.filter(l => /pageerror|error:/.test(l) && !/Failed to load resource|internetdisconnected|net::|TypeError: Load failed|NetworkError/.test(l)).slice(0, 5);
  const ev = path.join(EVID, 'verify-tv-reading-cache-30-rows-1.json');
  fs.writeFileSync(ev, JSON.stringify(out, null, 2));
  log('evidence', path.relative(ROOT, ev).split(path.sep).join('/'), out.shot);
} finally { await L.close(); }
