// STAB: does the adult Home's "Around the house" feed ever refresh on a page that stays open? (index.html:923-925 loadFeed
// returns early once feedFresh is true; renderHome calls loadFeed() without force, :1216; only refreshAll / the refresh
// button / "Show more" force it.) The TV board fetches its own feed every 5 min (index.html:1115), as a control.
//   node "audits/tools/phase2/STAB/feed.mjs"
// Mae posts a feed line from "her phone" (raw API). Eli's Home (ipad-portrait) and the TV each run 15 simulated minutes
// with real pulls; then Eli taps the feed's refresh button. Output: audits/evidence/p2/STAB/feed.json + feed-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, DEMO } from '../../lib/local.mjs';
import { advance, settle, track, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });   // demo clock: the seed's feed rows sit in the past
const R = {};
try {
  const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 500 });
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: DEMO + 500 });
  for (const d of [ip, tv]) track(d);
  await ip.goto('#home'); await ip.page.waitForSelector('#feed li'); await advance(ip, 10000);
  await tv.goto('#home'); await tv.page.waitForSelector('#tv-feed li'); await advance(tv, 10000);
  const TEXT = 'STAB feed check: prayed for Grandpa';
  const post = await L.apiAs('christian', '/api/activity', { method: 'POST', body: { app_id: 'prayer', text: TEXT } });
  const has = (d, sel) => d.page.evaluate(([s, t]) => document.querySelector(s).innerText.includes(t), [sel, TEXT]);
  await advance(ip, 15 * 60000); await advance(tv, 15 * 60000);
  R.after15min = { post: post.status, ipadHomeFeed: await has(ip, '#feed'), ipadActivityFetches: ip._track.byKind.activity || 0, ipadDataRequests: ip._track.byKind.data || 0,
    tvFeed: await has(tv, '#tv-feed'), tvActivityFetches: tv._track.byKind.activity || 0 };
  await shot1x(ip, path.join(OUT, 'feed-ipad-after-15min.png'));
  await ip.page.click('#feed-refresh'); await ip.ctx.clock.runFor(500); await settle(ip, { min: 500 });
  R.afterRefreshTap = { ipadHomeFeed: await has(ip, '#feed') };
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
