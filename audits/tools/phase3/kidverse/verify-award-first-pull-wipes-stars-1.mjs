// Skeptic #1 for "award-first-pull-wipes-stars" (Kid Verse). Independent reproduction, own helpers.
//   node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-1.mjs" [slow|fail|control]   (default: all; ~2.5 min)
// A brand-new phone paired with Ezra only (empty kidverse caches) opens the shell at #kidverse.
//   slow:    every GET /api/data/* on that phone is delayed 9 s (a slow network). Tap Done ★ at ~6.8 s (hub.ready's 6 s race is over).
//   fail:    only the FIRST GET /api/data/kidverse?scope=person answers 503; everything else passes. Tap Done ★ 1.5 s after load.
//            Then wait for the SDK's own 30 s interval pull (no manual hub.pull) and read the server again.
//   outage:  every GET /api/data/* on that phone answers 503 for its first 4 s (a short outage); tap at 1.5 s; then as fail.
//   control: no interference; tap after the first pull has landed.
// Prints the server's stars rows (person + family mirror) before/after, what the phone showed at the tap, the POST bodies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EV, { recursive: true });
const P = 'verify-award-first-pull-wipes-stars-1';

const brief = v => v && { total: v.total, earned: v.earned, count: v.count, badges: Object.keys(v.badges || {}), payouts: (v.payouts || []).length,
  applied: Object.keys(v.applied || {}).length, story: Object.keys(v.credited?.story || {}).length, prayed: Object.keys(v.credited?.prayed || {}).length };
async function server(L) {
  const g = async (who, scope, key) => { const r = await L.apiAs(who, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body?.item?.value ?? null; };
  const fam = await L.apiAs('eli', '/api/data/kidverse?scope=family');
  const ledger = (fam.body?.items || []).filter(i => i.key.startsWith('ledger:ezra:') && i.value).map(i => ({ key: i.key, kind: i.value.kind, amount: i.value.amount }));
  return { person: brief(await g('ezra', 'person', 'stars')), mirror: brief(await g('eli', 'family', 'stars:ezra')), ledger };
}

async function run(mode) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const out = { mode };
  try {
    out.before = await server(L);
    const ph = await L.newDevice({ name: 'Ezra new phone (verify)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    let failedOnce = false; const t0 = Date.now();
    await phone.ctx.route(/\/api\/data\//, async route => {
      const u = route.request().url(), m = route.request().method();
      if (m === 'GET' && mode === 'slow' && Date.now() - t0 < 9000) await sleep(9000);
      if (m === 'GET' && mode === 'outage' && Date.now() - t0 < 4000) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
      if (m === 'GET' && mode === 'fail' && !failedOnce && /\/api\/data\/kidverse\?scope=person/.test(u)) { failedOnce = true; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); }
      route.continue().catch(() => {});
    });
    const posts = [];
    phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(r.url())) { try { posts.push({ ms: Date.now() - t0, url: r.url().replace(/^.*\/api/, '/api'), items: JSON.parse(r.postData()).items.map(i => ({ key: i.key, ...brief(i.value) })) }); } catch {} } });
    await phone.goto('#kidverse');
    let f; for (let i = 0; i < 200 && !(f = phone.frame('kidverse')); i++) await sleep(100);
    await f.waitForSelector('#done:not([hidden])', { timeout: 20000 });
    if (mode === 'slow') await sleep(Math.max(0, 6800 - (Date.now() - t0)));
    else if (mode === 'fail' || mode === 'outage') await sleep(1500);
    else { for (let i = 0; i < 100 && !(await f.evaluate(() => hub.sync.lastPull)); i++) await sleep(150); await sleep(1000); }
    const ui = () => f.evaluate(() => { const t = s => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
      return { ms: 0, sync: hub.sync.state, lastPull: hub.sync.lastPull || 0, who: t('#who'), ref: t('#ref'), done: t('#done'), doneDisabled: document.querySelector('#done')?.disabled, mine: t('#mine .sub'), rwTotal: t('#rw-total'),
        personCacheSince: (JSON.parse(localStorage.getItem('hub.cache.kidverse.person.ezra') || 'null') || {}).since ?? null }; });
    out.atTap = { ...(await ui()), ms: Date.now() - t0 };
    await f.evaluate(() => { window.__t = []; const o = hub.toast; hub.toast = (m, ms) => { window.__t.push(String(m)); return o.call(hub, m, ms); }; });
    await f.click('#done');
    await sleep(800);
    await phone.page.screenshot({ path: path.join(EV, `${P}-${mode}-phone-after-tap.png`), scale: 'css', animations: 'disabled' });
    out.afterTapServer = await server(L);
    // let the held pull land (slow), or wait for the SDK's own next 30 s interval pull (fail)
    const waitMs = mode === 'slow' ? 12000 : (mode === 'fail' || mode === 'outage') ? 36000 : 6000;
    await sleep(waitMs);
    out.phoneEnd = { ...(await ui()), ms: Date.now() - t0 };
    out.toasts = await f.evaluate(() => window.__t);
    out.posts = posts;
    out.after = await server(L);
    const feed = await L.apiAs('eli', '/api/data/hub?scope=family');
    out.feedEzra = JSON.stringify(feed.body).match(/Ezra (earned the [^"]*? badge|read the verse[^"]*)/g);
  } finally { await L.close(); }
  console.log(`\n[${mode}] BEFORE  person ${JSON.stringify(out.before.person)}\n[${mode}] BEFORE  mirror ${JSON.stringify(out.before.mirror)}\n[${mode}] ledger  ${JSON.stringify(out.before.ledger)}`);
  console.log(`[${mode}] AT TAP  ${JSON.stringify(out.atTap)}`);
  console.log(`[${mode}] SERVER right after tap  person ${JSON.stringify(out.afterTapServer.person)}`);
  console.log(`[${mode}] POSTS   ${JSON.stringify(out.posts)}`);
  console.log(`[${mode}] TOASTS  ${JSON.stringify(out.toasts)}   feed: ${JSON.stringify(out.feedEzra)}`);
  console.log(`[${mode}] PHONE END ${JSON.stringify(out.phoneEnd)}`);
  console.log(`[${mode}] AFTER   person ${JSON.stringify(out.after.person)}\n[${mode}] AFTER   mirror ${JSON.stringify(out.after.mirror)}`);
  return out;
}
const modes = process.argv[2] ? [process.argv[2]] : ['slow', 'fail', 'outage', 'control'];
const res = {}; for (const m of modes) res[m] = await run(m);
const file = path.join(EV, `${P}${process.argv[2] ? '-' + process.argv[2] : ''}.json`);
fs.writeFileSync(file, JSON.stringify(res, null, 1)); console.log('wrote', path.relative(ROOT, file));
