// SYNC e5 — live refresh when another device changes data: Home's feed, the TV board, an open app the shell does not sync,
// and the shell ↔ app-iframe relay.
//   node "audits/tools/phase2/SYNC/e5-live-refresh.mjs"        (≈ 7 minutes: it waits out the TV's 5-minute feed refresh)
// 1. Eli's phone adds a family reminder from Home (a hub.set + a feed line). The Kitchen iPad (Eli, Home, visible):
//    when does the Reminders card show it, and when does "Around the house" show the feed line? (loadFeed only runs once:
//    index.html:925, feedFresh is never reset.)
// 2. The phone ticks F260. The TV board: when does "Reading today" mark Eli ✓? (readers come from feed lines, index.html:1063;
//    the board re-reads the feed every 5 min, index.html:1115.) Also: how many batch POSTs does one tick cost (frame + shell)?
// 3. Tally is open on the iPad (a channel the shell does not declare, index.html:458-459). The phone taps +. When does it show?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, netLog, writeEvidence } from './_util.mjs';

const out = { home: {}, tv: {}, tally: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const pnet = netLog(phone.page);
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  for (const d of [phone, ipad, tv]) { await d.goto('#home'); await waitFor(() => d.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); }
  await sleep(2000);

  // 1
  const text = 'SYNC-e5 pick up the dry cleaning';
  const t1 = Date.now();
  await phone.page.fill('#remtext', text); await phone.page.press('#remtext', 'Enter');
  const rem = await waitFor(() => ipad.page.evaluate(t => document.querySelector('#remlist').textContent.includes(t), text), { timeout: 45000, every: 200 });
  out.home.reminderCardMs = rem ? Date.now() - t1 : null;
  const feedHas = () => ipad.page.evaluate(t => document.querySelector('#feed').textContent.includes(t), text);
  const fl = await waitFor(feedHas, { timeout: 90000, every: 500 });
  out.home.feedLineMs = fl ? Date.now() - t1 : null;
  out.home.feedShot = await shot(ipad.page, 'e5-ipad-home-feed-90s.png');
  const tR = Date.now(); await ipad.page.click('#feed-refresh');
  const fr = await waitFor(feedHas, { timeout: 5000, every: 100 });
  out.home.afterRefreshMs = fr ? Date.now() - tR : null;
  log(`1: iPad Reminders card showed the phone's reminder after ${out.home.reminderCardMs} ms; "Around the house" showed its feed line after ${out.home.feedLineMs === null ? '> 90 s (never)' : out.home.feedLineMs + ' ms'}; after tapping refresh: ${out.home.afterRefreshMs} ms`);

  // 2
  const readOn = () => tv.page.evaluate(() => [...document.querySelectorAll('#tv-read .tv-face, #tv-read > *')].some(e => /Eli\b/.test(e.textContent) && /✓/.test(e.textContent)));
  out.tv.eliReadBefore = await readOn();
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
  const t2 = Date.now();
  await f.click('#todayDone');
  await sleep(3000);
  out.tv.batchPostsForOneTick = pnet.filter(r => r.t >= t2 && r.method === 'POST' && /\/api\/data\/f260\/batch/.test(r.url)).map(r => ({ dt: r.t - t2, from: r.frame }));
  const rd = await waitFor(readOn, { timeout: 330000, every: 1000 });
  out.tv.readingTodayMs = rd ? Date.now() - t2 : null;
  out.tv.shot = await shot(tv.page, 'e5-tv-after-reading-shows.png');
  log(`2: one tick cost ${out.tv.batchPostsForOneTick.length} batch POST(s) ${JSON.stringify(out.tv.batchPostsForOneTick)}; TV "Reading today" showed Eli ✓ after ${out.tv.readingTodayMs} ms (before: ${out.tv.eliReadBefore})`);

  // 3
  const ti = await ipad.openApp('tally', { wait: '#n' });
  await waitFor(() => ti.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  const tp = await phone.openApp('tally', { wait: '#plus' });
  await waitFor(() => tp.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
  const before = await ti.textContent('#n');
  const inet = netLog(ipad.page);
  const t3 = Date.now();
  await tp.click('#plus');
  const ok = await waitFor(async () => (await ti.textContent('#n')) !== before, { timeout: 45000, every: 200 });
  out.tally = { before, after: await ti.textContent('#n'), ms: ok ? Date.now() - t3 : null, tallyGets: inet.filter(r => r.method === 'GET' && r.url.startsWith('/api/data/tally')).map(r => ({ dt: r.t - t3, from: r.frame })) };
  log(`3: iPad Tally ${out.tally.before} → ${out.tally.after} after ${out.tally.ms} ms; who fetched it: ${JSON.stringify(out.tally.tallyGets)}`);
  log('evidence', writeEvidence('e5-live-refresh.json', out));
} finally { await L.close(); }
