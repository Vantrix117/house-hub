import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await ipad.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(500);
  console.log(await f.evaluate(() => { D.activeList = 'personal'; save(); go('today');
    const done = D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY);
    const r = done.map(p => { setPrayed(p, false); return p.id + ':' + p.lastPrayedAt; });
    return JSON.stringify({ r, days: D.lists.personal.prayerDays.slice(-3), today: TODAY, still: D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).map(p => p.id) }); }));
  f.page().on('response', async r => { if (r.url().includes('/api/data') && r.request().method() !== 'GET') console.log('RESP', r.status(), (await r.text()).slice(0, 600)); }); f.page().on('request', r => { if (r.url().includes('/api/data') && r.method() !== 'GET') console.log('REQ', r.url(), (r.postData() || '').slice(0, 400)); });
  console.log('flush', JSON.stringify(await f.evaluate(() => hub.flush()))); await sleep(800);
  console.log(await f.evaluate(() => JSON.stringify(D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).map(p => p.id))));
  const s = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items;
  console.log(JSON.stringify(s.filter(i => /p00[125]$|prayerDays/.test(i.key)).map(i => [i.key, i.key === 'prayerDays' ? i.value.slice(-3) : i.value.lastPrayedAt])));
  console.log(await f.evaluate(() => JSON.stringify({ q: Object.keys(localStorage).filter(k => k.startsWith('hub.queue')).map(k => k + ':' + localStorage.getItem(k).slice(0, 200)), sync: hub.sync.state })));
  console.log(ipad.logs.slice(-10).join('\n'));
} finally { await L.close(); }
