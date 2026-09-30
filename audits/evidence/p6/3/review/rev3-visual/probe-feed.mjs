const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const feed = async () => (await L.apiAs('eli', '/api/activity?limit=6')).body.activity.map(a => a.name + ': ' + a.text);
  console.log('before', JSON.stringify(await feed()));
  const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
  for (const list of ['personal', 'shared']) {
    await f.evaluate(l => { D.activeList = l; renderAllScreens(); }, list); await sleep(300);
    await f.click('#startPray'); await sleep(500);
    for (let i = 0; i < 3; i++) { await f.click('#prayNext'); await sleep(300); }
    await f.click('#prayShut'); await sleep(2500);
    await f.evaluate(() => hub.flush && hub.flush()); await sleep(1500);
    console.log('after', list, JSON.stringify(await feed()));
  }
} catch (e) { console.log('ERR', e); }
await L.close();
