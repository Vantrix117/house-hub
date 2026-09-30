const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = (...a) => console.log(...a);
try {
  for (const dev of ['iphone-pwa']) {
    const d = await L.device({ device: dev, mode: 'dark', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
    const st = () => f.evaluate(() => ({ kitchen: document.getElementById('kitchen').classList.contains('on'), pray: document.getElementById('pray').classList.contains('on'), top: document.getElementById('kitchen').scrollTop, viewer: parent.document.getElementById('viewer').className, hash: parent.location.hash }));
    const shellFocus = async () => { await d.page.evaluate(() => { const b = document.getElementById('pill-reload') || document.body; window.focus(); (document.getElementById('pill-name') || b).focus(); }); };
    // Kitchen: open, scroll, close, reopen -> top
    await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
    await f.evaluate(() => { document.getElementById('kitchen').scrollTop = 600; }); await sleep(200);
    await f.evaluate(() => document.getElementById('kitchenShut').click()); await sleep(300);
    await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
    log(dev, 'kitchen reopened', JSON.stringify(await st()));
    await shellFocus(); await d.page.keyboard.press('Escape'); await sleep(600);
    log(dev, 'kitchen after shell Esc', JSON.stringify(await st()), 'shellActive', await d.page.evaluate(() => document.activeElement && document.activeElement.id));
    // Pray mode from the shell's focus
    await f.click('#startPray'); await sleep(700);
    log(dev, 'pray open', JSON.stringify(await st()));
    await shellFocus(); await d.page.keyboard.press('Escape'); await sleep(600);
    log(dev, 'pray after shell Esc', JSON.stringify(await st()));
    // Pray over the Kitchen view (kitchen device style: open kitchen, then Pray now is not reachable; use startPrayMode directly)
    await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(500);
    await f.evaluate(() => startPrayMode()); await sleep(700);
    log(dev, 'pray over kitchen', JSON.stringify(await st()));
    await shellFocus(); await d.page.keyboard.press('Escape'); await sleep(600);
    log(dev, 'after one shell Esc', JSON.stringify(await st()));
    // Escape inside the app still works
    await f.click('#startPray'); await sleep(600); await f.focus('#prayShut'); await d.page.keyboard.press('Escape'); await sleep(500);
    log(dev, 'pray Esc in app', JSON.stringify(await st()));
    // feed line posted once for a run closed by the shell
    await d.close();
  }
} catch (e) { console.log('ERR', String(e).slice(0, 400)); }
await L.close();
