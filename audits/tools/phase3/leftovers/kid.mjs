// Kid flow (Ezra, pre-reader, on the Kitchen iPad): how he reaches the Larder, what he can do there, and whether one tap
// of his removes a family item for everyone. apps.json:5 has no visibleTo; the app has no data-kind="kid" rules
// (only kiosk at apps/leftovers.html:18, 96) and canEdit = hub.canWrite (:180).
import { local, openLarder, cards, serverItems, save, shot, sleep } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  await d.goto('#home'); await sleep(1500);
  const taps = [];
  await d.page.click('#kid-apps'); taps.push('Home: "Let\'s play — open your apps"'); await sleep(700);
  const tile = await d.page.$('.tile[data-id="leftovers"]');
  out.tileVisible = !!tile;
  const kidApps = await d.page.$$eval('.tile[data-id]', ts => ts.map(t => t.dataset.id));
  await tile.click(); taps.push('Apps: Larder Ledger tile'); await sleep(500);
  let f; for (let i = 0; i < 50 && !(f = d.frame('leftovers')); i++) await sleep(100);
  await f.waitForFunction(() => window.__larder && tally.textContent.length > 0);
  out.path = taps; out.kidApps = kidApps;
  out.page = await f.evaluate(() => ({
    kind: document.documentElement.dataset.kind, canWrite: hub.canWrite,
    doneButtons: document.querySelectorAll('.done').length, formShown: getComputedStyle(document.getElementById('add')).display !== 'none',
    hearthShown: getComputedStyle(document.querySelector('.hearth')).display !== 'none', micShown: !document.getElementById('mic').hidden,
    fontPx: { h1: getComputedStyle(document.querySelector('h1')).fontSize, name: getComputedStyle(document.querySelector('.nm')).fontSize, meta: getComputedStyle(document.querySelector('.meta')).fontSize, chip: getComputedStyle(document.querySelector('.status')).fontSize },
    doneSize: (r => [Math.round(r.width), Math.round(r.height)])(document.querySelector('.done').getBoundingClientRect()),
    images: document.querySelectorAll('.item img, .item svg:not([aria-hidden])').length,
    kidTokenFsMd: getComputedStyle(document.documentElement).getPropertyValue('--fs-md').trim(),
  }));
  out.shotBefore = await shot(d.page, 'kid-ezra-larder-ipad.png');
  const before = (await serverItems(L)).map(i => i.name);
  await f.click('.item:has(.nm:text-is("Chicken alfredo")) .done'); taps.push('✓ on Chicken alfredo');
  await sleep(3000);
  const after = (await serverItems(L)).map(i => i.name);
  out.removedByKidOnServer = before.filter(n => !after.includes(n));
  out.shotAfter = await shot(d.page, 'kid-ezra-after-tick-ipad.png');
  const feed = (await L.apiAs('eli', '/api/activity?limit=3')).body;
  out.feedTop = (feed.activity || feed).slice(0, 2).map(a => `${a.profile_id || a.by}: ${a.text}`);
  // the kid can also log a family item from the add bar
  await f.fill('#name', 'asdfgh'); await f.click('.log'); await sleep(2500);
  out.kidLoggedOnServer = (await serverItems(L)).some(i => i.name === 'asdfgh');
  console.log(JSON.stringify(out, null, 1));
  console.log('saved', save('kid.json', out));
} finally { await L.close(); }
