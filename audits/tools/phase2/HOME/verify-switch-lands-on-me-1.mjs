// Skeptic #1 for HOME finding "switch-lands-on-me": after Me → Switch, where does the next person land?
//
//   node "audits/tools/phase2/HOME/verify-switch-lands-on-me-1.mjs"
//
// Fresh local instance (typical, demo clock, WebKit). On the rig's Kitchen iPad (portrait), signed in as Eli on #home:
//   1. Me → Switch → Ezra (kid, tap-in)            → hash / tab / what the view shows / is #forget there / does it confirm()
//   2. Me → Switch → Kiara (kid, tap-in)           → same
//   3. Me → Switch → Grandma Jo (PIN-less guest)   → same
//   4. Me → Switch → Mea (first tap: create a PIN) → same (the PIN path through showCreatePin → enterShell)
//   5. TV device (kiosk profile) → board's Switch → Ezra → hash / tab (the finding's "as the TV's Switch does").
//   6. Control: same as 1, but the hash is set to #home while the picker is up → proves the landing follows the hash.
// Each run starts with L.reset(): Switch calls /api/logout, which revokes the rig's Eli session for the next context.
// Evidence → audits/evidence/p2/HOME/verify-switch-lands-on-me-1.{json,png}
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const where = page => page.evaluate(() => ({
  who: window.hub && hub.profile && hub.profile.id,
  kind: document.documentElement.dataset.kind,
  hash: location.hash,
  tab: document.documentElement.dataset.tab,
  view: (document.querySelector('.view.on') || {}).id,
  heading: ((document.querySelector('.view.on h1') || {}).textContent || '').trim(),
  cards: [...document.querySelectorAll('.view.on h2')].map(h => h.textContent.trim()).slice(0, 8),
  forgetVisible: !!(document.querySelector('.view.on #forget') && document.querySelector('.view.on #forget').offsetParent),
  notifVisible: !!document.querySelector('.view.on #notif'),
  themeCards: document.querySelectorAll('.view.on #theme button').length,
  homeTab: (() => { const b = document.querySelector('#tabbar .tab[data-tab="home"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), icon: !!b.querySelector('svg'), w: Math.round(r.width), h: Math.round(r.height), visible: !!b.offsetParent }; })(),
}));

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [label, target, pinFlow] of [['ezra', 'ezra'], ['kiara', 'kiara'], ['guest', 'guest-grandmajo'], ['mea-create-pin', 'niece', true]]) {
    await L.reset();                                   // Switch → /api/logout revoked the previous run's Eli session
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.profile && !document.querySelector('#shell').hidden, null, { timeout: 15000 });
    await sleep(500);
    const before = await where(d.page);
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
    const onMe = await d.page.evaluate(() => location.hash);
    await d.page.click('#switch');
    await d.page.waitForSelector(`#profiles .pcard[data-id="${target}"]`, { timeout: 8000 });
    const atPicker = await d.page.evaluate(() => ({ hash: location.hash, gate: !document.querySelector('#gate')?.hidden, shellHidden: document.querySelector('#shell').hidden }));
    await d.page.click(`#profiles .pcard[data-id="${target}"]`);
    if (pinFlow) {
      for (let round = 0; round < 2; round++) {
        await d.page.waitForSelector('#pad', { timeout: 8000 }); await sleep(250);
        for (const n of '1357') await d.page.click(`#pad button[data-d="${n}"]`);
        await d.page.click('#pingo'); await sleep(600);
      }
    }
    await d.page.waitForFunction(t => window.hub && hub.profile && hub.profile.id === t && !document.querySelector('#shell').hidden, target, { timeout: 10000 });
    await sleep(700);
    const landed = await where(d.page);
    let forgetDialog = null;
    if (label === 'ezra') {
      await d.page.screenshot({ path: path.join(OUT, 'verify-switch-lands-on-me-1-ezra.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
      // does "Forget this device" wipe on one tap, or ask first? Dismiss the dialog and check the pairing survives.
      d.page.once('dialog', async dlg => { forgetDialog = { type: dlg.type(), message: dlg.message() }; await dlg.dismiss(); });
      if (landed.forgetVisible) { await d.page.click('#forget'); await sleep(400); }
      forgetDialog = { ...forgetDialog, pairingKept: await d.page.evaluate(() => !!localStorage.getItem('hub.device')) };
    }
    res[label] = { before: { hash: before.hash, tab: before.tab }, hashOnMe: onMe, atPicker, landed, forgetDialog };
    console.log(`[${label}] Eli on ${before.hash} → Me (${onMe}) → Switch (picker, hash ${atPicker.hash}) → ${target}: lands on ${landed.hash} tab=${landed.tab} view=${landed.view} h1="${landed.heading}" cards=[${landed.cards.join(' | ')}] forgetVisible=${landed.forgetVisible} notif=${landed.notifVisible} themeCards=${landed.themeCards} kind=${landed.kind}`);
    if (forgetDialog) console.log(`[${label}] tap "Forget this device": dialog=${JSON.stringify(forgetDialog)}`);
    if (label === 'ezra') console.log(`[${label}] Home tab in the bar: ${JSON.stringify(landed.homeTab)}`);
    await d.close();
  }

  // TV comparison: the board's own Switch (kiosk) → Ezra
  await L.reset();
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#home');
  await tv.page.waitForSelector('#kiosk-switch', { timeout: 15000 }); await sleep(400);
  const tvBefore = await tv.page.evaluate(() => location.hash);
  await tv.page.click('#kiosk-switch');
  await tv.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 8000 });
  await tv.page.click('#profiles .pcard[data-id="ezra"]');
  await tv.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra' && !document.querySelector('#shell').hidden, null, { timeout: 10000 });
  await sleep(600);
  const tvLanded = await where(tv.page);
  res.tv = { before: tvBefore, landed: tvLanded };
  console.log(`[tv] TV board (${tvBefore}) → Switch → ezra: lands on ${tvLanded.hash} tab=${tvLanded.tab} h1="${tvLanded.heading}"`);
  await tv.close();

  // Control: the landing is decided by the hash alone — Eli signs out from Me, the hash is forced to #home before the tap.
  await L.reset();
  const c = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await c.goto('#home');
  await c.page.waitForFunction(() => window.hub && hub.profile && !document.querySelector('#shell').hidden, null, { timeout: 15000 });
  await c.page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
  await c.page.click('#switch'); await c.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 8000 });
  await c.page.evaluate(() => history.replaceState(null, '', '#home'));
  await c.page.click('#profiles .pcard[data-id="ezra"]');
  await c.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra' && !document.querySelector('#shell').hidden, null, { timeout: 10000 });
  await sleep(500);
  const ctrl = await where(c.page);
  res.controlHashHome = ctrl;
  console.log(`[control] same flow but hash set to #home at the picker: lands on ${ctrl.hash} tab=${ctrl.tab} h1="${ctrl.heading}"`);
  await c.close();
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-switch-lands-on-me-1.json'), JSON.stringify(res, null, 1));
  await L.close();
}
