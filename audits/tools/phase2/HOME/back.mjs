// HOME brief (3), continued: what "Hub" does when the app was opened from Home, and what an app keeps across a switch.
//   1. Eli opens F260 from its Home card, then taps "Hub" in the viewer bar: which tab does he land on?
//   2. Eli types "Chicken soup" into the Larder's add field (not saved), taps Hub, reopens the Larder from its tile:
//      is the draft still there? Is the app document reloaded (iframe src after closing)?
//   3. Eli opens Tally from the Apps grid, switches to the Larder through the Switch app sheet and back: is Tally
//      reloaded (a new document) each time?
//
//   node "audits/tools/phase2/HOME/back.mjs"      → audits/evidence/p2/HOME/back.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
const L = await local({ variant: 'typical', clock: 'demo' });
const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
await d.goto('#home');
await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home [data-open="f260"]'), null, { timeout: 15000 });
await sleep(500);
const res = {};

// 1
await d.page.click('#view-home [data-open="f260"]');
await d.page.waitForFunction(() => document.querySelector('#viewer').classList.contains('on'), null, { timeout: 5000 });
await sleep(800);
await d.page.click('#pill-home'); await sleep(500);
res.hubFromHomeCard = await d.page.evaluate(() => ({ hash: location.hash, tab: document.documentElement.dataset.tab }));
console.log(`[back] F260 opened from its Home card → "Hub" lands on ${res.hubFromHomeCard.hash} (tab ${res.hubFromHomeCard.tab}), not Home`);

// 2
await d.page.click('#grid .tile[data-id="leftovers"]');
let f = null; for (let i = 0; i < 100 && !f; i++) { f = d.frame('leftovers'); if (!f) await sleep(50); }
await f.waitForSelector('#name', { timeout: 8000 });
const docId1 = await f.evaluate(() => (window.__docId = Math.random()));
await f.fill('#name', 'Chicken soup');
await d.page.click('#pill-home'); await sleep(500);
const srcAfterClose = await d.page.evaluate(() => document.querySelector('#frame').getAttribute('src'));
await d.page.click('#grid .tile[data-id="leftovers"]');
f = null; for (let i = 0; i < 100 && !f; i++) { f = d.frame('leftovers'); if (!f) await sleep(50); }
await f.waitForSelector('#name', { timeout: 8000 }); await sleep(400);
const after = await f.evaluate(() => ({ value: document.querySelector('#name').value, sameDocument: window.__docId !== undefined }));
res.larderDraft = { typed: 'Chicken soup', srcAfterClose, afterReopen: after };
console.log(`[back] Larder draft "Chicken soup" → Hub (iframe src after close: ${srcAfterClose}) → reopen: field "${after.value}", same document: ${after.sameDocument}`);

// 3
await d.page.click('#pill-home'); await sleep(400);
await d.page.click('#grid .tile[data-id="tally"]');
f = null; for (let i = 0; i < 100 && !f; i++) { f = d.frame('tally'); if (!f) await sleep(50); }
await f.waitForSelector('#n', { timeout: 8000 }); await f.evaluate(() => { window.__mark = 1; });
await d.page.click('#pill-name'); await sleep(250); await d.page.click('.sheet [data-open="leftovers"]'); await sleep(700);
await d.page.click('#pill-name'); await sleep(250); await d.page.click('.sheet [data-open="tally"]'); await sleep(700);
f = d.frame('tally');
const kept = await f.evaluate(() => window.__mark === 1);
res.tallyAcrossSwitch = { sameDocument: kept };
console.log(`[back] Tally → Larder → Tally via the Switch sheet: Tally is the same document afterwards: ${kept} (every switch reloads the app)`);
fs.writeFileSync(path.join(OUT, 'back.json'), JSON.stringify(res, null, 1));
await L.close();
