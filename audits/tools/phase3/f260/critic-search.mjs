// Completeness critic (Phase 3, F260): journal search highlights inside the HTML escapes of the entry text.
// e.g. an entry "Summer camp & campfire" searched for "amp" (the filter matches "camp" in the raw text).
// hl() escapes the text first and then wraps query matches in <mark> (apps/f260.html:1948), so a query that matches
// part of "&amp;", "&lt;", "&gt;" or "&quot;" breaks the entity and the card shows raw escape text.
//   node "audits/tools/phase3/f260/critic-search.mjs"
// Throwaway passcode on the local demo database only.
import { local, sleep, save, shot, ready } from './_lib.mjs';

const PASS = '2468';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await d.openApp('f260'); await ready(f);
  await f.evaluate(() => document.querySelector('[data-jr="38-0"]').scrollIntoView({ block: 'center' }));
  await f.locator('[data-jr="38-0"]').click(); await f.waitForSelector('#pass.on');
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
  await f.waitForSelector('#jf-38-0-a', { timeout: 10000 });
  await f.locator('#jf-38-0-a').fill('Summer camp & campfire for the neighbours'); await f.locator('#jf-38-0-h').click(); await sleep(1200);
  await f.locator('#tabJournal').click(); await sleep(500);
  for (const q of ['camp', 'amp', 'lt']) {
    await f.fill('#jSearch', q); await sleep(400);
    out[q] = await f.evaluate(() => { const dd = document.querySelector('[data-entry="38-0"] dd'); return dd ? { shown: dd.textContent, html: dd.innerHTML } : null; });
  }
  await f.fill('#jSearch', 'amp'); await sleep(300);
  out.shot = await shot(d.page, 'critic-search-amp-iphone.png');
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 600); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(8), JSON.stringify(v));
console.log('evidence →', save('critic-search.json', out));
