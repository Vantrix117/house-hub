// Skeptic #1 (Phase 3, F260): does journal search highlighting break HTML entities?
// Fresh local instance, WebKit iPhone PWA, Eli, throwaway passcode on the local demo DB only.
// Writes an Apply field containing & < > " and searches for queries that are parts of entity names.
//   node "audits/tools/phase3/f260/verify-critic-journal-search-breaks-entities-6-1.mjs"
import { local, sleep, save, shot, ready } from './_lib.mjs';

const PASS = '1357';
const TEXT = 'Tom & Jerry said "hi" to Plato <3 at camp, pass the salt, quote it';
const out = { text: TEXT, q: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await d.openApp('f260'); await ready(f);
  await f.evaluate(() => document.querySelector('[data-jr="38-1"]').scrollIntoView({ block: 'center' }));
  await f.locator('[data-jr="38-1"]').click(); await f.waitForSelector('#pass.on');
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
  await f.waitForSelector('#jf-38-1-a', { timeout: 10000 });
  await f.locator('#jf-38-1-a').fill(TEXT); await f.locator('#jf-38-1-h').click(); await sleep(1200);
  await f.locator('#tabJournal').click(); await sleep(500);
  for (const q of ['', 'camp', 'amp', 'quot', 'lt', 'gt', '&', 'salt']) {
    await f.fill('#jSearch', q); await sleep(400);
    out.q[q || '(none)'] = await f.evaluate(() => {
      const card = document.querySelector('[data-entry="38-1"]');
      const dd = card && [...card.querySelectorAll('dd')].find(x => /Tom/.test(x.textContent));
      return { cardShown: !!card, stat: document.getElementById('jStat').textContent.trim(), shown: dd ? dd.textContent : null, html: dd ? dd.innerHTML : null };
    });
  }
  await f.fill('#jSearch', 'amp'); await sleep(300);
  await f.evaluate(() => document.querySelector('[data-entry="38-1"]').scrollIntoView({ block: 'center' }));
  out.shotAmp = await shot(d.page, 'verify-critic-journal-search-breaks-entities-6-1-amp-iphone.png');
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out.q)) console.log(k.padEnd(7), JSON.stringify(v));
if (out.error) console.log('ERROR', out.error);
console.log('evidence ->', save('verify-critic-journal-search-breaks-entities-6-1.json', out));
