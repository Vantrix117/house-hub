// Skeptic #1 for finding "waits-name-match-drops": do feed rides whose posted name differs from the listing name
// silently lose their wait? Uses the rig's own seeded queue-times feed (audits/tools/seed/waits.mjs) proxied through the
// real Worker route (worker/src/index.js:63-77) - no hand-made mismatched feed - and then one route override with
// plausible real-world variants to see how tolerant wnorm (apps/dollywood-live.html:1493) is.
// Run: node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const P = 'verify-waits-name-match-drops-1';
const out = {};
const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  // 1. what the Worker serves (the seeded feed, flattened)
  const feed = await (await fetch(L.api + '/api/dollywood/waits')).json();
  out.feedRideCount = feed.rides.length;
  await d.goto('#home'); await sleep(800);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.WAITS && WAITS.at > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(800);
  const rides = feed.rides.map(r => r.name);
  out.seeded = await f.evaluate(rides => {
    const att = OFF.filter(o => o.cat === 'attraction');
    const idx = {}; att.forEach(o => { idx[wnorm(o.name)] = o.name; });
    const unmatched = rides.filter(n => !idx[wnorm(n)]).map(n => ({ feedName: n, listingsContaining: att.filter(o => wnorm(o.name).includes(wnorm(n)) || wnorm(n).includes(wnorm(o.name))).map(o => o.name) }));
    return { attractionListings: att.length, attachedCount: Object.keys(WAITS.by).length, WALIAS: JSON.stringify(WALIAS), unmatched,
      srcLine: document.getElementById('lv-src') && document.getElementById('lv-src').innerText };
  }, rides);
  // the Waits list: does the unmatched ride appear anywhere, and is there any "N rides not matched" note?
  await f.click('#loc-near').catch(() => {}); await sleep(300);
  await f.evaluate(() => document.getElementById('near-mode-waits').click()); await sleep(900);
  out.seededWaitsList = await f.evaluate(() => {
    const t = document.getElementById('lv-near').innerText;
    return { rows: document.querySelectorAll('#lv-near .lv-item--wait').length, mentionsDollywoodExpress: /Dollywood Express/i.test(t), mentionsUnmatched: /not matched|unmatched|no match/i.test(t) };
  });
  await d.page.screenshot({ path: path.join(EV, P + '-seeded-waits-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // 2. tolerance probe: plausible variants of listing names
  const variants = ['Thunderhead', 'Thunder Head', 'Lightning Rod Roller Coaster', 'Wild Eagle Coaster', 'Mystery Mine', 'Dollywood Express', 'FireChaser Express'];
  out.probe = await f.evaluate(vs => { const idx = {}; OFF.forEach(o => { if (o.cat === 'attraction') idx[wnorm(o.name)] = o.name; }); return vs.map(v => ({ feed: v, attachesTo: idx[wnorm(v)] || null })); }, variants);
  out.listingNamesSample = await f.evaluate(() => OFF.filter(o => o.cat === 'attraction').map(o => o.name));
} finally {
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
