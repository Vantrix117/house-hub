// Skeptic #1 for "critic-kid-check-removes-family-item-3": does one tap by a kid (Ezra) on the Larder's check remove a
// family fridge item for the whole house, with no undo? Fresh local instance, typical seed, Kitchen iPad portrait.
// Reaches the Larder the way a kid would (Home -> "Let's play" -> tile), taps the FIRST check (whatever item it is),
// then reads the raw row as Eli, pulls on a second adult device (Mom's phone), and looks for any undo affordance.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers');
const P = 'verify-critic-kid-check-removes-family-item-3-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const rows = async () => ((await L.apiAs('eli', '/api/data/leftovers?scope=family')).body);
  const live = b => (b.items || b.rows || b.data || []).filter(x => x.key.startsWith('item:') && x.value).map(x => x.value.name);
  out.serverBefore = live(await rows());

  // Mom's phone opens the Larder first, so we can see whether the kid's tap reaches another adult's screen.
  const momDev = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: momDev });
  await mom.goto('#home'); await sleep(1200);
  const mf = await mom.openApp('leftovers');
  await mf.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 15000 });
  out.momCardsBefore = await mf.$$eval('.item .nm', n => n.map(x => x.textContent));

  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  await d.goto('#home'); await sleep(1500);
  out.htmlKind = await d.page.evaluate(() => document.documentElement.dataset.kind);
  await d.page.click('#kid-apps'); await sleep(700);
  const tile = await d.page.$('.tile[data-id="leftovers"]');
  out.larderTileOnKidLauncher = !!tile;
  await tile.click(); await sleep(500);
  let f; for (let i = 0; i < 60 && !(f = d.frame('leftovers')); i++) await sleep(100);
  await f.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 15000 });
  out.kidPage = await f.evaluate(() => {
    const sz = el => el ? (r => [Math.round(r.width), Math.round(r.height)])(el.getBoundingClientRect()) : null;
    return {
      frameKind: document.documentElement.dataset.kind, profileKind: hub.profile.kind, canWrite: hub.canWrite,
      items: document.querySelectorAll('.item').length, checks: document.querySelectorAll('.item .done').length,
      checkSize: sz(document.querySelector('.item .done')), logButtonSize: sz(document.querySelector('.log')),
      addFormVisible: getComputedStyle(document.getElementById('add')).display !== 'none',
      imgsInCards: document.querySelectorAll('.item img').length,
      undoControls: [...document.querySelectorAll('button, [role=button], a')].filter(b => /undo|restore|bring back/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))).length,
    };
  });
  fs.writeFileSync(path.join(EVID, P + '-before-ipad.png'), await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  const firstName = await f.$eval('.item .nm', n => n.textContent);
  out.tappedItem = firstName;
  await f.click('.item .done');            // ONE tap on the first check
  await sleep(600);
  out.kidUndoAfterTap = await f.evaluate(() => [...document.querySelectorAll('button, [role=button], a, .toast, [role=status]')]
    .filter(b => b.offsetParent !== null && /undo|restore|bring back/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))).length);
  out.shellUndoAfterTap = await d.page.evaluate(() => [...document.querySelectorAll('button, [role=button], a, .toast, [role=status]')]
    .filter(b => b.offsetParent !== null && /undo|restore|bring back/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))).length);
  await sleep(2500);
  fs.writeFileSync(path.join(EVID, P + '-after-ipad.png'), await d.page.screenshot({ scale: 'css', animations: 'disabled' }));

  const b = await rows();
  const raw = (b.items || b.rows || b.data || []).filter(x => x.key.startsWith('item:')).find(x => x.value === null && out.serverBefore.includes(firstName));
  out.serverAfter = live(b);
  out.removedOnServer = out.serverBefore.filter(n => !out.serverAfter.includes(n));
  out.tombstones = (b.items || b.rows || b.data || []).filter(x => x.key.startsWith('item:') && x.value === null).map(x => ({ key: x.key, value: x.value }));
  const feed = (await L.apiAs('eli', '/api/activity?limit=3')).body;
  out.feedTop = (feed.activity || feed).slice(0, 1).map(a => `${a.profile_id || a.by}: ${a.text}`);

  // Mom's phone: pull and redraw.
  await mom.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await mf.evaluate(() => hub.pull && hub.pull()).catch(() => {});
  await sleep(3000);
  out.momCardsAfter = await mf.$$eval('.item .nm', n => n.map(x => x.textContent));
  out.goneOnMomsPhone = out.momCardsBefore.includes(firstName) && !out.momCardsAfter.includes(firstName);
  fs.writeFileSync(path.join(EVID, P + '-mom-after-iphone.png'), await mom.page.screenshot({ scale: 'css', animations: 'disabled' }));
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
