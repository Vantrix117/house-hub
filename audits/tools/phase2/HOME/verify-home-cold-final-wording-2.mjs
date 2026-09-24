// Skeptic #2 for finding "home-cold-final-wording": does Home show final "nothing here" wording instead of skeletons
// while the first /api/data pull is still pending (no local cache), and after Me → Switch → a person new to this device?
//
//   node "audits/tools/phase2/HOME/verify-home-cold-final-wording-2.mjs" [only=cold,control,latency,kid,tv,switch]
//
//   cold     Eli, Kitchen iPad, no cache; every /api/data request held. Read Home at 1.2 s: sync state, navigator.onLine,
//            card wording, skeleton count. Then release and read again.
//   control  Same hold, but flip hub.sync.state to 'pending' in the page and re-render Home (tap the Home tab): does the
//            skeleton branch in renderHome appear? (shows that the skeletons exist and are gated only by the initial 'offline')
//   latency  No hold; every /api/data request delayed 250 ms (a slow phone link): how long does the Kids card read ★0 and the
//            reading card "Start with Genesis 1-2"? How many sequential /api/data requests make up the first pull?
//   kid      Ezra, no cache, /api/data held: kid Home wording.
//   tv       Downstairs TV, no cache, /api/data + /api/activity held: TV board wording.
//   switch   Eli on Home (pulled) → Me → Switch → Ezra with Ezra's kidverse person pull held.
// Writes audits/evidence/p2/HOME/verify2-cold-*.{json,png}.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv[2] || 'cold,control,latency,kid,tv,switch').split(',');
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, name), scale: 'css', animations: 'disabled', caret: 'hide' });
const res = {};
const read = page => page.evaluate(() => ({
  state: hub.sync.state, lastPull: hub.sync.lastPull, onLine: navigator.onLine,
  hero: (document.querySelector('#view-home .hero-sub') || {}).textContent || '',
  cards: [...document.querySelectorAll('#view-home .gcard')].map(c => c.querySelector('h2').textContent.trim() + ': ' + ((c.querySelector('.gbig, .kids-line') || {}).textContent || '').trim() + ' / ' + ((c.querySelector('.gsub') || {}).textContent || '').trim()),
  reminders: ((document.querySelector('#remlist') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  skeletonsInCards: document.querySelectorAll('#view-home .gcard .skeleton').length,
  skeletonsInReminders: document.querySelectorAll('#remlist .skeleton').length,
  skeletonsInFeed: document.querySelectorAll('#feed .skeleton').length,
}));
const hold = async (d, re) => { let release; const gate = new Promise(r => { release = r; }); await d.ctx.route(u => re.test(u.pathname + u.search), async r => { await gate; await r.continue().catch(() => {}); }); return () => release(); };

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  // server truth for comparison
  const ez = await L.apiAs('ezra', '/api/data/kidverse?scope=person&key=stars');
  const f = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.summary');
  res.truth = { ezraStars: ez.body.item && ez.body.item.value && { week: ez.body.item.value.week, count: ez.body.item.value.count, total: ez.body.item.value.total }, eliF260: f.body.item && f.body.item.value && { week: f.body.item.value.week, weekDone: f.body.item.value.weekDone, next: f.body.item.value.next } };
  console.log('[truth]', JSON.stringify(res.truth));

  if (ONLY.includes('cold')) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    const release = await hold(d, /^\/api\/data\//);
    await d.goto('#home'); await sleep(1200);
    const during = await read(d.page); await shot(d, 'verify2-cold-adult-pending.png');
    release(); await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1200);
    const after = await read(d.page);
    res.cold = { during, after };
    console.log('\n[cold adult] pending 1.2 s:', JSON.stringify(during, null, 1));
    console.log('[cold adult] after pull:', JSON.stringify(after.cards), after.hero);
    await d.close();
  }

  if (ONLY.includes('control')) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    const release = await hold(d, /^\/api\/data\//);
    await d.goto('#home'); await sleep(1200);
    const asIs = await read(d.page);
    await d.page.evaluate(() => { hub.sync.state = 'pending'; });          // what the state would be if the SDK said "pull in flight"
    await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(300);  // showTab('home') → renderHome()
    const withPending = await read(d.page); await shot(d, 'verify2-cold-control-pending-state.png');
    release(); await sleep(1500);
    res.control = { asIs: { state: asIs.state, skeletonsInCards: asIs.skeletonsInCards, skeletonsInReminders: asIs.skeletonsInReminders }, withPending };
    console.log(`\n[control] state 'offline' → card skeletons ${asIs.skeletonsInCards}, reminder skeletons ${asIs.skeletonsInReminders}; forced 'pending' + re-render → card skeletons ${withPending.skeletonsInCards}, reminder skeletons ${withPending.skeletonsInReminders}, hero "${withPending.hero}", cards ${JSON.stringify(withPending.cards)}`);
    await d.close();
  }

  if (ONLY.includes('latency')) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const reqs = [];
    await d.ctx.route(u => /^\/api\/data\//.test(u.pathname), async r => { reqs.push({ t: Date.now(), u: r.request().url().replace(/^.*\/api\/data\//, '') }); await sleep(250); await r.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.goto('#home');
    const samples = [];
    for (let i = 0; i < 60; i++) {
      const s = await d.page.evaluate(() => ({ lastPull: hub.sync.lastPull, kids: ((document.querySelector('.kids-card .kids-line') || {}).textContent || '').trim(), reading: ((document.querySelector('#view-home .gcard .gbig') || {}).textContent || '').trim(), sk: document.querySelectorAll('#view-home .gcard .skeleton').length })).catch(() => null);
      if (s) samples.push({ ms: Date.now() - t0, ...s });
      if (s && s.lastPull) break;
      await sleep(100);
    }
    const firstReal = key => { const x = samples.find(s => key(s)); return x ? x.ms : null; };
    const r = {
      firstPullRequests: reqs.length, requests: reqs.map(x => x.u.split('&since')[0]),
      msUntilPullDone: firstReal(s => s.lastPull > 0),
      msReadingStillDefault: samples.filter(s => /Genesis 1-2/.test(s.reading)).map(s => s.ms).pop() || null,
      msKidsStillZero: samples.filter(s => /Ezra ★0/.test(s.kids)).map(s => s.ms).pop() || null,
      anySkeletonInCards: samples.some(s => s.sk > 0),
      samples: samples.filter((s, i) => i % 3 === 0 || s.lastPull),
    };
    res.latency = r;
    console.log(`\n[latency 250 ms/request] first pull = ${r.firstPullRequests} sequential /api/data requests: ${r.requests.join(', ')}; lastPull set at ~${r.msUntilPullDone} ms; reading card said "Start with Genesis 1-2" until ~${r.msReadingStillDefault} ms; Kids card said "Ezra ★0" until ~${r.msKidsStillZero} ms; any card skeleton seen: ${r.anySkeletonInCards}`);
    await d.close();
  }

  if (ONLY.includes('kid')) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
    const release = await hold(d, /^\/api\/data\//);
    await d.goto('#home'); await sleep(1200);
    const during = await d.page.evaluate(() => ({ state: hub.sync.state, lastPull: hub.sync.lastPull, hero: document.querySelector('.home-hero .hero-sub').textContent, star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent, sub: document.querySelector('.stars-card .gsub').textContent, skeletons: document.querySelectorAll('#view-home .gcard .skeleton').length }));
    await shot(d, 'verify2-cold-kid-pending.png');
    release(); await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1200);
    const after = await d.page.evaluate(() => ({ hero: document.querySelector('.home-hero .hero-sub').textContent, star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent }));
    res.kid = { during, after };
    console.log(`\n[cold kid] pending: ${JSON.stringify(during)}\n[cold kid] after: ${JSON.stringify(after)}`);
    await d.close();
  }

  if (ONLY.includes('tv')) {
    const d = await L.device({ device: 'tv', profile: 'tv' });
    const release = await hold(d, /^\/api\/(data|activity)/);
    await d.goto('#home'); await sleep(1200);
    const tvRead = () => d.page.evaluate(() => ({ state: hub.sync.state, lastPull: hub.sync.lastPull, verse: document.querySelector('#tv-verse-hd').textContent, refs: document.querySelector('#tv-refs').innerText.replace(/\s+/g, ' '), prayed: document.querySelector('#tv-prayed').innerText.replace(/\s+/g, ' '), stars: document.querySelector('#tv-stars').innerText.replace(/\s+/g, ' '), feed: document.querySelector('#tv-feed').innerText.replace(/\s+/g, ' ').slice(0, 60), dimAdults: document.querySelectorAll('#tv-read .tv-face.off').length, skeletons: document.querySelectorAll('#tv .skeleton').length }));
    const during = await tvRead(); await shot(d, 'verify2-cold-tv-pending.png');
    release(); await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1500);
    const after = await tvRead();
    res.tv = { during, after };
    console.log(`\n[cold tv] pending: ${JSON.stringify(during)}\n[cold tv] after: ${JSON.stringify(after)}`);
    await d.close();
  }

  if (ONLY.includes('switch')) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
    const ezraCachedBefore = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /ezra/.test(k)));
    const release = await hold(d, /^\/api\/data\/kidverse\?scope=person/);
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(400);
    await d.page.click('#switch'); await d.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 8000 });
    await d.page.click('#profiles .pcard[data-id="ezra"]');
    await d.page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra' && !document.querySelector('#shell').hidden, null, { timeout: 8000 });
    await d.page.click('#tabbar .tab[data-tab="home"]'); await d.page.waitForSelector('#view-home .stars-card', { timeout: 8000 }); await sleep(800);
    const during = await d.page.evaluate(() => ({ who: hub.profile.id, state: hub.sync.state, lastPull: hub.sync.lastPull, star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent, sub: document.querySelector('.stars-card .gsub').textContent, hero: document.querySelector('.home-hero .hero-sub').textContent }));
    await shot(d, 'verify2-cold-switch-kid-pending.png');
    release(); await sleep(2500);
    const after = await d.page.evaluate(() => ({ star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent, hero: document.querySelector('.home-hero .hero-sub').textContent }));
    res.switch = { ezraCachedBefore, during, after };
    console.log(`\n[switch] Ezra keys cached on the iPad before: ${JSON.stringify(ezraCachedBefore)}\n[switch] Eli → Switch → Ezra, kidverse person pull held: ${JSON.stringify(during)}\n[switch] after release: ${JSON.stringify(after)}`);
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'verify2-cold.json'), JSON.stringify(res, null, 1));
  await L.close();
}
