// Skeptic #2 (Phase 3, F260): does journal search highlighting break HTML entities?
// hl() (apps/f260.html:1948) escapes first, then wraps regex matches of the query in <mark> inside the escaped string.
// Independent repro on a fresh local instance, WebKit iPad portrait + Chromium iPhone, several queries incl. one-letter ones.
//   node "audits/tools/phase3/f260/verify-critic-journal-search-breaks-entities-6-2.mjs"
// Throwaway passcode on the local demo database only.
import { local, sleep, save, shot, ready } from './_lib.mjs';

const PASS = '1357';
const TEXT = 'Tom & Ann said "grace" < works';
const QUERIES = ['grace', 'a', 'amp', '&', 'lt', 'quot', 'o', 't', 'tom', 'works'];  // 'amp', 'lt', 'quot' are not in the raw text: expect no card (filter excludes)
const out = { text: TEXT };
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const r = out[engine] = {};
  try {
    const dev = await L.newDevice({ name: 'Eli ' + engine, profiles: ['eli'] });
    const d = await L.device({ device: engine === 'webkit' ? 'ipad-portrait' : 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const f = await d.openApp('f260'); await ready(f);
    await f.evaluate(() => document.querySelector('[data-jr="38-1"]').scrollIntoView({ block: 'center' }));
    await f.locator('[data-jr="38-1"]').click(); await f.waitForSelector('#pass.on');
    await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
    await f.waitForSelector('#jf-38-1-a', { timeout: 10000 });
    await f.locator('#jf-38-1-a').fill(TEXT); await f.locator('#jf-38-1-h').click(); await sleep(1200);
    await f.locator('#tabJournal').click(); await sleep(500);
    for (const q of ['', ...QUERIES]) {
      await f.fill('#jSearch', q); await sleep(400);
      r[q || '(none)'] = await f.evaluate(() => { const dd = document.querySelector('[data-entry="38-1"] dd'); return dd ? { shown: dd.textContent, html: dd.innerHTML } : null; });
      if (r[q || '(none)']) r[q || '(none)'].same = r[q || '(none)'].shown === TEXT;
    }
    if (engine === 'webkit') { await f.fill('#jSearch', 'a'); await sleep(400); out.shot = await shot(d.page, 'verify-critic-journal-search-breaks-entities-6-2-ipad.png'); }
    await d.close();
  } catch (e) { r.error = String(e && e.stack || e).slice(0, 600); }
  finally { await L.close(); }
}
for (const eng of ['webkit', 'chromium']) for (const [k, v] of Object.entries(out[eng])) console.log(eng.padEnd(9), JSON.stringify(k).padEnd(9), v && v.shown !== undefined ? (v.same ? 'OK     ' : 'BROKEN ') + JSON.stringify(v.shown) : (v === null ? 'no card (filtered out)' : JSON.stringify(v)));
console.log('evidence →', save('verify-critic-journal-search-breaks-entities-6-2.json', out));
