// Skeptic #2 for SYNC finding "tv-reading-cache-30-rows".
// Claim: the TV board reads 100 feed lines online (index.html:1108) but caches only 30 (same line) and paints from that
// cache on a reload / offline reopen (index.html:922), so an early reader loses their ✓ on "Reading today" (index.html:1063).
// This script separates the cases the claim lumps together:
//   A  online board after a busy day            (expect ✓ for both readers)
//   B  Wi-Fi blip WITHOUT a reload              (in-memory feed keeps 100 rows: does the ✓ survive?)
//   C  online reload, /api/activity held 3 s    (flash from the 30-row cache, then recovery?)
//   D  reload while offline                     (the claimed defect) — with an in-cache control reader (Mae)
//   E  back online: does a pull restore it, or only the TV's 5-minute feed refresh (index.html:1115)?
//   node "audits/tools/phase2/SYNC/verify-tv-reading-cache-30-rows-2.mjs"     (~60 s)
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const dev = await L.newDevice({ name: 'Skeptic poster', profiles: ['eli', 'christian'] });
  const post = (pid, app_id, text) => L.apiAs(null, '/api/activity', { method: 'POST', deviceToken: dev.device.token, profileToken: dev.sessions[pid], body: { app_id, text } });

  // baseline: which "Read week" lines does the seed already hold for today? (real clock → the seed is relative to now)
  const pre = await L.apiAs('eli', '/api/activity?limit=100');
  out.seedReadLines = (pre.body.activity || []).filter(a => /^Read week/.test(a.text)).map(a => ({ who: a.profile_id, at: new Date(a.created_at).toISOString() }));

  // a busy day: Eli reads early, 35 other lines, then Mae reads (her line stays inside the 30 cached rows = control), 3 more
  await post('eli', 'f260', 'Read week 38 day 3 — Acts 6');
  for (let i = 1; i <= 35; i++) await post('christian', 'leftovers', 'Logged dish ' + i + ' in the fridge');
  await post('christian', 'f260', 'Read week 38 day 3 — Acts 6');
  for (let i = 36; i <= 38; i++) await post('christian', 'leftovers', 'Logged dish ' + i + ' in the fridge');

  // where each of today's "Read week" lines sits in the 100-row page the TV reads (0 = newest; the cache keeps rows 0-29)
  const page100 = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity || [];
  out.readLinePositions = page100.map((a, i) => ({ i, who: a.profile_id, text: a.text, at: new Date(a.created_at).toISOString() })).filter(r => /^Read week/.test(r.text));
  out.pageRows = page100.length;
  log('Read-week lines in the 100-row page (index: who @ time):', out.readLinePositions.map(r => `${r.i}:${r.who}@${r.at.slice(11, 19)}`).join('  '));
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const readers = () => tv.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#tv-read .tv-face')].map(e => [e.textContent.replace('✓', '').trim(), !e.classList.contains('off')])));
  const cache = () => tv.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.feed') || '[]'); return { rows: c.length, eliRead: c.some(a => a.profile_id === 'eli' && /^Read week/.test(a.text)), maeRead: c.some(a => a.profile_id === 'christian' && /^Read week/.test(a.text)) }; });
  const memFeed = () => tv.page.evaluate(() => (window.__tv ? 'tv-present' : 'no-tv'));

  // A — online
  await tv.goto('#home');
  await waitFor(async () => { const r = await readers(); return r.Eli && r.Mae; }, { timeout: 10000 });
  out.A_online = { readers: await readers(), cache: await cache() };
  log('A online readers', JSON.stringify(out.A_online.readers), 'cache', JSON.stringify(out.A_online.cache));

  // B — Wi-Fi blip without a reload: the TV's own 5-minute refresh fails while offline
  await tv.setOffline(true);
  await tv.page.evaluate(() => window.__tv.refreshFeed());
  out.B_blipNoReload = { readers: await readers(), tv: await memFeed() };
  await tv.setOffline(false);
  log('B offline refresh, no reload: readers', JSON.stringify(out.B_blipNoReload.readers));

  // C — online reload with the feed response held 3 s: what does the board show from the cache, and does it recover?
  await tv.ctx.route(u => /\/api\/activity\b/.test(u.pathname), async r => { await sleep(3000); await r.continue(); });
  const t0 = Date.now();
  await tv.page.reload({ waitUntil: 'load' });
  await sleep(800);
  out.C_onlineReload = { at800ms: await readers() };
  const back = await waitFor(async () => { const r = await readers(); return r.Eli ? Date.now() - t0 : null; }, { timeout: 15000, every: 100 });
  out.C_onlineReload.eliBackAfterMs = back;
  await tv.ctx.unroute(u => /\/api\/activity\b/.test(u.pathname)).catch(() => {});
  await tv.ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await tv.ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());   // restore the harness's prod block
  log('C online reload (feed held 3 s): at 0.8 s', JSON.stringify(out.C_onlineReload.at800ms), '→ Eli ✓ back after', back, 'ms');

  // D — reload while offline (the claimed defect), Mae as the in-cache control
  await tv.setOffline(true);
  await tv.page.reload({ waitUntil: 'load' }); await tv.setOffline(true); await sleep(3000);
  out.D_offlineReopen = { readers: await readers(), cache: await cache() };
  out.D_shot = await shot(tv.page, 'verify-tv-cache-2-offline-reopen.png');
  log('D offline reopen: readers', JSON.stringify(out.D_offlineReopen.readers), 'cache', JSON.stringify(out.D_offlineReopen.cache));

  // E — back online: a normal hub pull (≤30 s) repaints; does it bring the ✓ back, or only the 5-minute feed refresh?
  const pull0 = (await tv.hub()).sync.lastPull || 0;
  await tv.setOffline(false);
  await waitFor(async () => ((await tv.hub()).sync.lastPull || 0) > pull0, { timeout: 45000, every: 500 });
  await sleep(1500);
  out.E_afterPull = { pulled: ((await tv.hub()).sync.lastPull || 0) > pull0, readers: await readers() };
  log('E online again, after a hub pull: readers', JSON.stringify(out.E_afterPull.readers), 'pulled', out.E_afterPull.pulled);
  await tv.page.evaluate(() => window.__tv.tick(new Date(Date.now() + 300000)));      // the TV's 5-minute feed refresh, brought forward
  await waitFor(async () => (await readers()).Eli, { timeout: 10000 });
  out.E_after5minRefresh = { readers: await readers() };
  log('E after the 5-minute feed refresh: readers', JSON.stringify(out.E_after5minRefresh.readers));
  out.logs = tv.logs.filter(l => /error/i.test(l)).slice(0, 10);
  log('evidence', writeEvidence('verify-tv-reading-cache-30-rows-2.json', out));
} finally { await L.close(); }
