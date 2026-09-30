const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-landscape', mode: 'light', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
  const st = () => f.evaluate(() => ({ kitchen: document.getElementById('kitchen').classList.contains('on'), viewer: parent.document.getElementById('viewer').className, hash: parent.location.hash, active: document.hasFocus() }));
  console.log('open (after real taps)', JSON.stringify(await st()));
  await d.page.keyboard.press('Escape'); await sleep(500); console.log('esc1', JSON.stringify(await st()));
  await d.page.keyboard.press('Escape'); await sleep(500); console.log('esc2', JSON.stringify(await st()));
  // focus in the shell (e.g. after tapping the bar) then Escape
  await f.click('#moreBtn').catch(()=>{}); 
} catch (e) { console.log('ERR', String(e).slice(0, 300)); }
await L.close();
