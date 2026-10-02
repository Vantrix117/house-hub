// rev5-core round 6: kids practise only Kid Verse's taught verse; the kicker/line slot; the Home pager with Verses loading.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const out = {};
const kidState = p => p.evaluate(() => ({ cur: verses.current(), trained: verses.trained(), due: verses.dueIds(), summary: hub.get('summary'), para: !document.getElementById('para').hidden, done: !document.getElementById('done').hidden ? document.getElementById('done-sub').textContent : null, again: !document.getElementById('again').hidden }));
try {
  // week 4: KIDWORDS[3][0] = 1 -> 4-1; week 5: [0] = 0 -> 5-0
  await put('eli', 'kidverse', 'week', { week: 4 }, 'family');
  await put('ezra', 'f260', 'recall:2-0', { s: 'got', t: 1, box: 2, due: '2020-01-01', last: '2019-12-30', streak: 1 });   // an older kid row: kept, not shown
  const K1 = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const K2 = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  for (const K of [K1, K2]) { await K.page.goto(L.site + '/apps/verses.html'); await K.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && hub.isLoaded('kidverse', 'family') && verses.current(), null, { timeout: 20000 }); }
  out.k_week4 = await kidState(K1.page);
  await K1.page.click('#show'); await K1.page.click('#act-rate [data-rate=got]'); await sleep(800);
  out.k_afterRate = await kidState(K1.page);
  out.k_kickerDuringLine = await K1.page.evaluate(() => getComputedStyle(document.querySelector('.trainer .kick') || document.body).visibility);
  await K1.page.click('#again'); await sleep(600);
  out.k_practiseAgain = await kidState(K1.page);
  // the second device sees the rating after a pull
  await sleep(2000); await K2.page.evaluate(() => hub.pull()); await sleep(800);
  out.k_device2 = await kidState(K2.page);
  // the parent steps the week: the taught verse follows on both
  await put('eli', 'kidverse', 'week', { week: 5 }, 'family');
  for (const K of [K1, K2]) await K.page.evaluate(() => hub.pull());
  await sleep(1200);
  out.k_week5_d1 = await kidState(K1.page); out.k_week5_d2 = await kidState(K2.page);
  await K1.close(); await K2.close();

  // adult slot: kicker hidden while the line shows, visible with the current card after it fades
  for (const id of ['1-0', '1-1']) await put('eli', 'f260', 'mem:' + id, true);
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await A.page.goto(L.site + '/apps/verses.html');
  await A.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && verses.current(), null, { timeout: 20000 });
  await A.page.click('#show'); await A.page.click('#act-rate [data-rate=got]'); await sleep(700);
  const ks = () => A.page.evaluate(() => ({ kickVis: getComputedStyle(document.querySelector('.trainer .kick')).visibility, kick: document.getElementById('kick').textContent, cur: verses.current(), line: document.getElementById('rated').className, role: document.getElementById('rated').getAttribute('role') }));
  out.a_lineOn = await ks();
  await sleep(10500);
  out.a_lineFaded = await ks();
  await A.close();

  // Home pager at 390 with the Verses card loading: dots == visible pages
  await put('dad', 'verses', 'summary', { due: 2, streak: 1, boxes: [2, 0, 0, 0, 0], total: 2, reviewedToday: 0, week: null, at: '2026-10-01' });
  await put('dad', 'f260', 'mem:1-0', true); await put('dad', 'f260', 'mem:1-1', true);
  const H = await L.device({ device: 'iphone-pwa', profile: 'dad', fixedTime: false });
  // hold the API so Home paints from nothing; the summary in the cache makes the Verses card load
  await H.ctx.route(u => u.href.startsWith(L.api) && !/\/api\/(me|device|profiles)/.test(u.pathname), async r => { await sleep(6000); r.continue().catch(() => {}); });
  await H.page.goto(L.site + '/index.html');
  await sleep(1500);
  const pager = () => H.page.evaluate(() => { const g = document.querySelector('#view-home [data-part="glance"]'), d = document.querySelector('#view-home [data-part="dots"]');
    return g ? { dots: d ? d.children.length : -1, pages: [...g.children].filter(c => c.offsetParent !== null).length, versesLoading: !!g.querySelector('.verses-card.is-loading'), verses: !!g.querySelector('.verses-card'), sw: g.scrollWidth, cw: g.clientWidth } : null; });
  out.h_loading = await pager();
  await sleep(7000);
  out.h_loaded = await pager();
  // swipe to the end: the last page has a visible card
  out.h_end = await H.page.evaluate(() => { const g = document.querySelector('#view-home [data-part="glance"]'); g.scrollLeft = g.scrollWidth; const r = g.getBoundingClientRect(); const vis = [...g.children].filter(c => { const b = c.getBoundingClientRect(); return c.offsetParent !== null && b.right > r.left + 10 && b.left < r.right - 10; }).length; return { visibleAtEnd: vis, on: [...document.querySelectorAll('#view-home [data-part="dots"] i')].findIndex(i => i.classList.contains('on')) }; });
  await H.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
