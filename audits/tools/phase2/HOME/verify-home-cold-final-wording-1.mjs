// Skeptic #1 for finding "home-cold-final-wording": does Home show final empty wording (not skeletons) while the first
// /api/data pull is pending on a device with no cache, and on the shared iPad after a switch to someone new?
//
//   node "audits/tools/phase2/HOME/verify-home-cold-final-wording-1.mjs" [parts]   parts = held,counter,latency,switch (default all)
//
//   held     adult (Eli), kid (Ezra) and TV on a cold device (the rig's init script clears localStorage), /api/data held:
//            what each Home says at 0.3 s and 3 s, and after the pull lands.
//   counter  same adult cold load, but hub.js is served with the initial sync state 'init' instead of 'offline' (in the test
//            only — a route rewrite, no app code changed): does Home then show skeletons? (proves the cause)
//   latency  adult cold load with a realistic 200 ms per API request (no hold): a 50 ms sampled timeline of what the cards say,
//            and how long the wrong final wording is on screen before the real data replaces it.
//   switch   Eli on Home → Me → Switch → Ezra (never used this device), Ezra's person kidverse pull held 4 s.
// Evidence: audits/evidence/p2/HOME/verify1-*.json|png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const PARTS = (process.argv[2] || 'held,counter,latency,switch,guest').split(',');
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, name), scale: 'css', animations: 'disabled', caret: 'hide' });
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1));

const readHome = page => page.evaluate(() => {
  const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const tv = document.querySelector('#tv');
  if (tv) return {
    sync: { state: hub.sync.state, lastPull: hub.sync.lastPull },
    verse: txt(document.querySelector('#tv-verse-hd')), refs: txt(document.querySelector('#tv-refs')),
    prayed: txt(document.querySelector('#tv-prayed')), stars: txt(document.querySelector('#tv-stars')),
    feed: txt(document.querySelector('#tv-feed'))?.slice(0, 60),
    readingDim: [...document.querySelectorAll('#tv-read .tv-face')].filter(f => f.classList.contains('off')).length + '/' + document.querySelectorAll('#tv-read .tv-face').length,
    skeletons: document.querySelectorAll('#tv .skeleton').length,
  };
  return {
    who: hub.profile && hub.profile.id,
    sync: { state: hub.sync.state, lastPull: hub.sync.lastPull },
    hero: txt(document.querySelector('#view-home .hero-sub')),
    cards: [...document.querySelectorAll('#view-home .gcard')].map(c => `${txt(c.querySelector('h2'))}: ${txt(c.querySelector('.gbig, .kids-line'))} / ${txt(c.querySelector('.gsub'))}`),
    reminders: txt(document.querySelector('#remlist'))?.slice(0, 60),
    cardSkeletons: document.querySelectorAll('#view-home .gcard .skeleton').length,
    remSkeletons: document.querySelectorAll('#remlist .skeleton').length,
    feedSkeletons: document.querySelectorAll('#feed .skeleton').length,
  };
});

async function coldHeld(L, label, device, profile, { rewriteInit = false } = {}) {
  const d = await L.device({ device, profile });
  const reqs = [];
  if (rewriteInit) {
    await d.ctx.route(u => u.pathname.endsWith('/apps/hub.js'), async r => {
      const res = await r.fetch(); let body = await res.text();
      const before = body.length;
      body = body.replace("sync: { state: 'offline', pending: 0, lastError: null, lastPull: 0 }", "sync: { state: 'init', pending: 0, lastError: null, lastPull: 0 }");
      if (body.length === before) console.log('!! rewrite target not found in hub.js');
      await r.fulfill({ response: res, body });
    });
  }
  let release; const gate = new Promise(r => { release = r; });
  await d.ctx.route(u => /\/api\/(data|activity)/.test(u.pathname), async r => { reqs.push(new URL(r.request().url()).pathname + new URL(r.request().url()).search.replace(/&since=\d+/, '')); await gate; await r.continue().catch(() => {}); });
  await d.goto('#home');
  await sleep(300);
  const cacheKeys = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.')).length);
  const t03 = await readHome(d.page);
  await shot(d, `verify1-${label}-held-0.3s.png`);
  await sleep(2700);
  const t3 = await readHome(d.page);
  release();
  await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const after = await readHome(d.page);
  await shot(d, `verify1-${label}-after.png`);
  await d.close();
  const r = { cacheKeysAtStart: cacheKeys, heldRequests: reqs.length, firstRequests: reqs.slice(0, 4), t03, t3, after };
  console.log(`\n[${label}] cold (hub.cache.* keys in localStorage at 0.3 s: ${cacheKeys}); /api/data+activity requests seen in total: ${reqs.length}`);
  console.log(`[${label}] 0.3 s, pull pending: ${JSON.stringify(t03)}`);
  console.log(`[${label}] 3.0 s, pull pending: ${JSON.stringify(t3)}`);
  console.log(`[${label}] after the pull lands:  ${JSON.stringify(after)}`);
  return r;
}

const out = {};
if (PARTS.includes('held')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  try {
    out.adult = await coldHeld(L, 'adult', 'ipad-portrait', 'eli');
    out.kid = await coldHeld(L, 'kid', 'ipad-portrait', 'ezra');
    out.tv = await coldHeld(L, 'tv', 'tv', 'tv');
  } finally { await L.close(); }
}
if (PARTS.includes('counter')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  try { out.counterAdult = await coldHeld(L, 'counter-adult', 'ipad-portrait', 'eli', { rewriteInit: true }); }
  finally { await L.close(); }
}
if (PARTS.includes('latency')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  try {
    for (const [label, device, profile] of [['adult', 'ipad-portrait', 'eli'], ['kid', 'ipad-portrait', 'ezra']]) {
      const d = await L.device({ device, profile });
      let n = 0;
      await d.ctx.route(u => /\/api\//.test(u.pathname), async r => { n++; await sleep(200); await r.continue().catch(() => {}); });
      const t0 = Date.now();
      await d.goto('#home');
      const timeline = []; let last = '';
      while (Date.now() - t0 < 8000) {
        const h = await readHome(d.page).catch(() => null);
        if (h) { const sig = JSON.stringify([h.hero, h.cards, h.cardSkeletons, h.sync.state]); if (sig !== last) { last = sig; timeline.push({ ms: Date.now() - t0, ...h }); } if (h.sync.lastPull && Date.now() - t0 > 500 && timeline.length && timeline[timeline.length - 1].sync.lastPull) { await sleep(300); break; } }
        await sleep(50);
      }
      out['latency_' + label] = { apiRequests: n, timeline };
      console.log(`\n[latency ${label}] 200 ms per API request, ${n} requests; distinct Home states:`);
      for (const s of timeline) console.log(`  +${s.ms} ms  state=${s.sync.state} lastPull=${s.sync.lastPull ? 'set' : 0} hero="${s.hero}" cardSkeletons=${s.cardSkeletons} | ${s.cards.join(' | ')}`);
      await d.close();
    }
  } finally { await L.close(); }
}
if (PARTS.includes('switch')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
    const eliLastPull = await d.page.evaluate(() => hub.sync.lastPull);
    const ezraCached = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /\.ezra$/.test(k)));
    let release; const gate = new Promise(r => { release = r; });
    await d.ctx.route(u => /\/api\/data\/kidverse/.test(u.pathname) && /scope=person/.test(u.search), async r => { await gate; await r.continue().catch(() => {}); });
    // Me tab → Switch
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
    await d.page.evaluate(() => history.replaceState(null, '', '#home'));   // so the shell re-enters on Home, as after a Home-tab switch
    await d.page.click('#switch');
    await d.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 8000 });
    await d.page.click('#profiles .pcard[data-id="ezra"]');
    await d.page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra' && document.querySelector('#view-home .stars-card'), null, { timeout: 8000 }).catch(() => {});
    await sleep(800);
    const during = await d.page.evaluate(() => ({ who: hub.profile.id, tab: document.documentElement.dataset.tab, lastPull: hub.sync.lastPull, state: hub.sync.state, star: (document.querySelector('.star-big b') || {}).textContent, big: (document.querySelector('.stars-card .gbig') || {}).textContent, sub: (document.querySelector('.stars-card .gsub') || {}).textContent, hero: (document.querySelector('.home-hero .hero-sub') || {}).textContent, skeletons: document.querySelectorAll('#view-home .skeleton').length }));
    await shot(d, 'verify1-switch-ezra-pending.png');
    release();
    await d.page.waitForFunction(() => document.querySelector('.star-big b') && document.querySelector('.star-big b').textContent !== '0', null, { timeout: 10000 }).catch(() => {});
    await sleep(500);
    const after = await d.page.evaluate(() => ({ star: (document.querySelector('.star-big b') || {}).textContent, big: (document.querySelector('.stars-card .gbig') || {}).textContent, hero: (document.querySelector('.home-hero .hero-sub') || {}).textContent }));
    out.switch = { eliLastPull, ezraCacheKeysBeforeSwitch: ezraCached, during, after, lastPullCarried: during.lastPull === eliLastPull };
    console.log(`\n[switch] Ezra person-scope cache keys before switch: ${JSON.stringify(ezraCached)}`);
    console.log(`[switch] Eli → Switch → Ezra, Ezra's kidverse person pull held (0.8 s): ${JSON.stringify(during)}; lastPull carried over from Eli: ${during.lastPull === eliLastPull}`);
    console.log(`[switch] after release: ${JSON.stringify(after)}`);
  } finally { await L.close(); }
}
if (PARTS.includes('guest')) {
  // The lastPull carry-over on its own: an adult-kind profile (Grandma Jo, a PIN-less guest who opens on tap) switches in
  // after Eli; she has an F260 summary on the server but none cached here. Her f260 person pull is held.
  const L = await local({ variant: 'typical', clock: 'demo' });
  try {
    const sess = Object.keys(L.S.info.sessions);
    const put = await L.apiAs('guest-grandmajo', '/api/data/f260/f260.summary?scope=person', { method: 'PUT', body: { value: { week: 38, weekDone: 2, next: { ref: 'Acts 6', day: 3 }, readToday: false, streak: 4 }, updated_at: Date.now() } });
    console.log(`\n[guest] rig sessions: ${sess.join(',')}; PUT Grandma Jo f260.summary → ${put.status}`);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
    let release; const gate = new Promise(r => { release = r; });
    await d.ctx.route(u => /\/api\/data\/f260/.test(u.pathname) && /scope=person/.test(u.search), async r => { await gate; await r.continue().catch(() => {}); });
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
    await d.page.evaluate(() => history.replaceState(null, '', '#home'));
    await d.page.click('#switch');
    await d.page.waitForSelector('#profiles .pcard[data-id="guest-grandmajo"]', { timeout: 8000 });
    await d.page.click('#profiles .pcard[data-id="guest-grandmajo"]');
    await d.page.waitForFunction(() => hub.profile && hub.profile.id === 'guest-grandmajo' && document.querySelector('#view-home .gcard'), null, { timeout: 8000 }).catch(() => {});
    await sleep(800);
    const f260Card = () => d.page.evaluate(() => { const c = [...document.querySelectorAll('#view-home .gcard')].find(c => /Today's reading/.test(c.textContent)); return { who: hub.profile.id, lastPull: hub.sync.lastPull, state: hub.sync.state, card: c ? c.querySelector('.gbig').textContent.trim() + ' / ' + c.querySelector('.gsub').textContent.trim() : null, skeletons: c ? c.querySelectorAll('.skeleton').length : null }; });
    const during = await f260Card();
    await shot(d, 'verify1-switch-guest-pending.png');
    release(); await sleep(2500);
    const after = await f260Card();
    out.guestSwitch = { put: put.status, during, after };
    console.log(`[guest] Eli → Switch → Grandma Jo, her f260 person pull held (0.8 s): ${JSON.stringify(during)}`);
    console.log(`[guest] after release: ${JSON.stringify(after)}`);
  } finally { await L.close(); }
}
let prev = {}; try { prev = JSON.parse(fs.readFileSync(path.join(OUT, 'verify1-home-cold.json'), 'utf8')); } catch {}
save('verify1-home-cold.json', { ...prev, ...out });
console.log('\nsaved audits/evidence/p2/HOME/verify1-home-cold.json');
