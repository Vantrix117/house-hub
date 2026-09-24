// Skeptic #2 for "waits-name-match-drops": does a feed ride whose posted name differs from the listing lose its wait silently?
// A: the rig's own stubbed queue-times feed (audits/tools/seed/waits.mjs, the Worker's real flatten at worker/src/index.js:63-77),
//    unmodified. B: the investigator's invented name "Lightning Rod Roller Coaster" routed in. Both on an Eli iPhone, park variant.
// Run: node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
const out = {};
const probe = () => (async () => {
  const base = (window.hub && hub.api) || '';
  const d = await (await fetch(base.replace(/\/$/, '') + '/api/dollywood/waits', { cache: 'no-store' })).json();
  const idx = {}; OFF.forEach(o => { if (o.cat === 'attraction') idx[wnorm(o.name)] = o; });
  const unmatched = d.rides.filter(r => !idx[wnorm(WALIAS[r.name] || r.name)]).map(r => r.name);
  const depot = OFF.find(o => o.name === 'Dollywood Express Train Depot');
  const txt = document.body.innerText;
  return {
    feedRideCount: d.rides.length, attachedCount: Object.keys(WAITS.by).length, unmatched,
    waliasKeys: Object.keys(WALIAS).length,
    depotHasWait: !!(depot && waitOf(depot)), depotChip: !!(depot && depot.el && depot.el.querySelector('.lv-wait')),
    srcLine: (document.getElementById('lv-src') || {}).innerText || null,
    anyUnmatchedNotice: /not matched|unmatched|could not match|missing/i.test(txt),
    waitsRows: document.querySelectorAll('#near-list .lv-item--wait').length,
    dollywoodExpressInWaitsList: [...document.querySelectorAll('#near-list .lv-item--wait')].some(b => /Dollywood Express/.test(b.innerText)),
  };
})();
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(800);
  const f = await openMap(d, { settle: 2500 });
  await f.evaluate(() => loadWaits()); await sleep(800);
  await f.click('#loc-near').catch(() => {}); await sleep(300);
  await f.evaluate(() => { const b = document.getElementById('near-mode-waits'); if (b) b.click(); }); await sleep(1000);
  out.A_rigFeed = await f.evaluate(probe);
  await shot(d, 'verify-waits-name-match-drops-2-A-rigfeed-iphone.png');

  const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  const iso = new Date().toISOString();
  await d.ctx.route('**/api/dollywood/waits*', r => r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, at: Date.now(), updated: iso, source: 'queue-times.com', rides: [
    { name: 'Thunderhead', land: 'x', open: true, wait: 40, updated: iso },
    { name: 'Lightning Rod Roller Coaster', land: 'x', open: true, wait: 25, updated: iso },
    { name: 'Lightning Rod', land: 'x', open: true, wait: 30, updated: iso } ] }) }));
  await f.evaluate(() => loadWaits()); await sleep(800);
  out.B_inventedName = await f.evaluate(probe);
  out.note = 'unmatched = feed rides with no attraction listing under wnorm (:1495) + WALIAS (:1494, empty); they are dropped at :1502 with no UI trace.';
} finally { save('verify-waits-name-match-drops-2.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
