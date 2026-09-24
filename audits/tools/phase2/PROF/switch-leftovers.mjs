// PROF (audit Phase 2), brief item 4 (cached data): after an ONLINE Me → Switch on the shared iPad, what of the previous
// person stays on the device for the next one — their person-scope caches (private prayer list, F260 summary) and the
// Sync card's counters. Local rig only (typical seed).
//
//   node "audits/tools/phase2/PROF/switch-leftovers.mjs"
import { local, sleep } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(54), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  await d.goto('#home'); await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });
  // Eli opens Prayer once (his private list lands in this iPad's cache), then goes back to the hub
  await page.click('.tab[data-tab="apps"]'); await page.click('#grid .tile[data-id="prayer"]'); await sleep(4000); await page.click('#pill-home'); await sleep(300);
  // Me → Switch → Ezra, all online
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch');
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]');
  await page.click('#profiles .pcard[data-id="ezra"]'); await page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra'); await sleep(1500);
  const left = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => /\.person\.eli$/.test(k));
    const pr = JSON.parse(localStorage.getItem('hub.cache.prayer.person.eli') || '{"items":{}}');
    const rows = Object.values(pr.items).map(i => i.v).filter(v => v && v.title);
    return { keys, privatePrayerRows: rows.length, example: rows[0] && rows[0].title };
  });
  log('signed in as Ezra; Eli\'s person-scope keys still on the iPad', left.keys);
  log('Eli\'s private prayer rows readable from localStorage', `${left.privatePrayerRows} (e.g. "${left.example}")`);
  log('Ezra\'s Me → Sync card shows', await page.evaluate(() => [...document.querySelectorAll('#view-me .kv')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' | ')));
  log('hub.sync right after the switch', await page.evaluate(() => ({ ...hub.sync })));
  await d.close();
} finally { await L.close(); }
