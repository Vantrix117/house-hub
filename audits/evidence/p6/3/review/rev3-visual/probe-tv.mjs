// rev3-visual: the TV anniversary line and the Home "prayed for your request" line, on the rig (in-memory Worker)
const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = (...a) => console.log(...a);
let TS = 0, NTS = 0;
try {
  const today = '2026-09-22';
  const put = (who, items, scope = 'family') => L.apiAs(who, '/api/data/prayer/batch?scope=' + scope, { method: 'POST', body: { items } });
  // a family answered prayer one year ago today (long title), one 3 years ago, and a PRIVATE one a year ago (must never show)
  let r = await put('eli', [
    { key: 'prayer:rv-ann1', value: { id: 'rv-ann1', title: 'Grandpa came home from the hospital after the long winter', category: 'Family', status: 'answered', cadence: 'daily', answeredAt: '2025-09-22', createdAt: '2025-06-01', prayedBy: {}, by: 'eli', updates: [] }, updated_at: Date.now() },
    { key: 'prayer:rv-ann3', value: { id: 'rv-ann3', title: 'Three year old answer', category: 'Family', status: 'answered', cadence: 'daily', answeredAt: '2023-09-22', createdAt: '2023-06-01', prayedBy: {}, by: 'eli', updates: [] }, updated_at: Date.now() },
  ]);
  log('family put', r.status, JSON.stringify(r.body.results && r.body.results.map(x => x.rejected || 'ok')));
  r = await put('eli', [{ key: 'prayer:rv-priv', value: { id: 'rv-priv', title: 'SECRET private answered', category: 'Personal', status: 'answered', cadence: 'daily', answeredAt: '2025-09-22', createdAt: '2025-06-01', updates: [] }, updated_at: Date.now() }], 'person');
  log('person put', r.status);
  for (const [dev, w, h] of [['desktop', 1920, 1080], ['desktop', 1280, 720], ['ipad-landscape']]) {
    const d = await L.device({ device: dev, mode: 'dark', profile: 'tv' });
    if (w) await d.page.setViewportSize({ width: w, height: h });
    await d.goto(''); await d.page.waitForSelector('#tv', { timeout: 20000 }); await sleep(2500);
    const g = await d.page.evaluate(() => {
      const av = document.getElementById('tv-anniv'); const fl = document.querySelector('#tv-feed > li.tv-anniv');
      const vis = e => e && !e.hidden && !e.classList.contains('tv-out') && e.getClientRects().length > 0;
      const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      return { verse: vis(av) ? av.textContent : null, verseBox: vis(av) ? r(av) : null, feed: vis(fl) ? fl.textContent : null, feedBox: vis(fl) ? r(fl) : null,
        secret: document.body.innerText.includes('SECRET'), scrollH: document.documentElement.scrollHeight, innerH: innerHeight,
        feedLines: [...document.querySelectorAll('#tv-feed > li:not(.tv-anniv)')].filter(e => !e.hidden && e.getClientRects().length).length,
        anniverFont: vis(av) ? getComputedStyle(av).fontSize : vis(fl) ? getComputedStyle(fl).fontSize : null };
    });
    log('TV', dev, w || '', JSON.stringify(g));
    await d.shot(`${OUT}/tv-anniv-${dev}-${w || 'native'}.png`); await d.close();
  }
  // Home: Dad asked; Ezra and Mom ticked today (their own ticks), Dad also ticked (must not name himself), the kitchen credited Kiara
  r = await put('dad', [{ key: 'prayer:rv-pf', value: { id: 'rv-pf', title: "Grandma Jo's visit", category: 'Family', status: 'active', cadence: 'daily', createdAt: '2026-09-20', prayedBy: {}, by: 'dad', updates: [] }, updated_at: Date.now() }]);
  log('dad row', r.status, JSON.stringify(r.body.results && r.body.results.map(x => x.rejected || 'ok')));
  const tick = async who => { const cur = (await L.apiAs(who, '/api/data/prayer?scope=family')).body; const row = cur.items.find(x => x.key === 'prayer:rv-pf'); TS = Date.parse('2026-09-22T08:4'+(++NTS)+':00-04:00'); await L.clock(new Date(TS).toISOString());
    const v = row ? row.value : null; if (!v) { log('no row for', who, Object.keys(cur)); return; }
    v.prayedBy = v.prayedBy || {}; v.prayedBy[today] = [...new Set([...(v.prayedBy[today] || []), who])]; v.lastPrayedAt = today;
    const w = await put(who, [{ key: 'prayer:rv-pf', value: v, updated_at: TS }]); log('tick', who, w.status, JSON.stringify(w.body.results && w.body.results.map(x => x.rejected || x.applied))); };
  for (const who of ['ezra', 'mom', 'dad']) await tick(who);
  for (const [dev, mode] of [['iphone-pwa', 'light'], ['iphone-pwa', 'dark'], ['desktop', 'light'], ['ipad-portrait', 'dark']]) {
    const d = await L.device({ device: dev, mode, profile: 'dad' });
    await d.goto(''); await d.page.waitForSelector('#view-home .pf-line', { timeout: 20000 }).catch(() => log('no pf-line', dev));
    await sleep(1200);
    const g = await d.page.evaluate(() => [...document.querySelectorAll('#view-home .pf-line')].map(b => ({ t: b.innerText.replace(/\s+/g, ' '), h: Math.round(b.getBoundingClientRect().height), y: Math.round(b.getBoundingClientRect().top) })));
    log('HOME dad', dev, mode, JSON.stringify(g));
    await d.page.evaluate(() => { const e = document.querySelector('.prayedfor'); if (e) e.scrollIntoView({ block: 'center' }); }); await sleep(300);
    await d.shot(`${OUT}/home-pf-${dev}-${mode}.png`); await d.close();
  }
  // Ezra's (kid) Home and Eli's Home should show nothing of Dad's
  for (const who of ['ezra', 'eli']) {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: who }); await d.goto(''); await sleep(4000);
    log('HOME', who, JSON.stringify(await d.page.evaluate(() => [...document.querySelectorAll('.pf-line')].map(b => b.innerText.replace(/\s+/g, ' ')))));
    await d.close();
  }
} catch (e) { console.log('ERR', e); }
await L.close();
