// Skeptic #2 for "A slow first open reports an empty fridge as the 'last copy saved here'".
// Claim: on a first open with no cache, once hub.ready's 6 s race gives up (apps/hub.js:336-337), the Larder renders
// "0 in the fridge" + "Nothing logged yet." under "Can't reach the house list — showing the last copy saved here."
// (apps/leftovers.html:172, 184, 204-227), although the server holds 6 items.
// Arms:
//   A  webkit,   iphone-pwa, fresh device, GET /api/data/leftovers never answered (shell + frame): sample at 7.5 s and 13.5 s.
//   A2 chromium, same, to rule out a WebKit-on-Windows artefact (sample at 7.5 s).
//   B  webkit,   the counterfactual household path: Home loads normally first (shell caches leftovers|family, index.html:458),
//                THEN the API stalls and the Larder is opened -> is the empty fridge still shown?
//   C  webkit,   GET delayed 9 s (slow, not dead): sample at 7.5 s and at 11.5 s -> does it self-heal?
// Run: node "audits/tools/phase3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const P = 'verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const rel = n => 'audits/evidence/p3/leftovers/' + n;
const shot = async (page, name) => { await page.screenshot({ path: path.join(EVID, name), scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(name); };
const isGet = u => u.pathname.startsWith('/api/data/leftovers');

async function sample(f) {
  return f.evaluate(() => {
    const m = document.getElementById('mode');
    const cacheKey = Object.keys(localStorage).find(k => k.startsWith('hub.cache.leftovers.family'));
    let cache = null; try { const c = JSON.parse(localStorage.getItem(cacheKey)); cache = { since: c.since, items: Object.keys(c.items || {}).length }; } catch {}
    return {
      tally: document.getElementById('tally').textContent,
      emptyText: document.querySelector('.empty p') ? document.querySelector('.empty p').textContent : null,
      cards: document.querySelectorAll('.item').length,
      mode: m.hidden ? null : m.textContent,
      navigatorOnLine: navigator.onLine,
      sync: window.hub ? { state: hub.sync.state, lastPull: hub.sync.lastPull, lastError: hub.sync.lastError } : null,
      cacheKey, cache,
    };
  });
}
async function server(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  return (r.body.items || []).filter(x => x.value).length;
}

const out = { script: 'audits/tools/phase3/leftovers/' + P + '.mjs' };

// ---------- A, A2, B, C on webkit; A2 on chromium ----------
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    // A / A2
    {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
      await d.ctx.route(isGet, async r => { if (r.request().method() === 'GET') return; /* never answered */ await r.continue().catch(() => {}); });
      const t0 = Date.now();
      const f = await d.openApp('leftovers');
      await sleep(7500 - (Date.now() - t0));
      const at7 = await sample(f);
      const s7 = await shot(d.page, `${P}-A-${engine}-7s-iphone.png`);
      const arm = { at7_5s: at7, serverItems: await server(L), shot: s7 };
      if (engine === 'webkit') {
        await sleep(13500 - (Date.now() - t0));
        arm.at13_5s = await sample(f);   // hub.request's 12 s abort (apps/hub.js:128-132) has now fired
      }
      out[engine === 'webkit' ? 'A' : 'A2'] = arm;
      console.log(engine === 'webkit' ? 'A ' : 'A2', engine, JSON.stringify(arm));
      await d.close();
    }
    if (engine !== 'webkit') continue;

    // B: Home first (normal network), then the stall, then open the Larder
    {
      await L.reset('typical');
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
      await d.goto('#home');
      await d.page.waitForFunction(() => window.hub && hub.sync.state === 'synced', null, { timeout: 15000 }).catch(() => {});
      const shellCache = await d.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.leftovers.family')); try { const c = JSON.parse(localStorage.getItem(k)); return { k, since: c.since, items: Object.keys(c.items).length }; } catch { return null; } });
      await d.ctx.route(isGet, async r => { if (r.request().method() === 'GET') return; await r.continue().catch(() => {}); });
      const t0 = Date.now();
      const f = await d.openApp('leftovers');
      await sleep(7500 - (Date.now() - t0));
      const at7 = await sample(f);
      const s = await shot(d.page, `${P}-B-home-first-7s-iphone.png`);
      out.B = { shellCacheBeforeOpen: shellCache, at7_5s: at7, serverItems: await server(L), shot: s };
      console.log('B ', JSON.stringify(out.B));
      await d.close();
    }

    // C: slow (9 s) not dead
    {
      await L.reset('typical');
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
      await d.ctx.route(isGet, async r => { if (r.request().method() === 'GET') await sleep(9000); await r.continue().catch(() => {}); });
      const t0 = Date.now();
      const f = await d.openApp('leftovers');
      await sleep(7500 - (Date.now() - t0));
      const at7 = await sample(f);
      await sleep(11500 - (Date.now() - t0));
      const at11 = await sample(f);
      out.C = { at7_5s: at7, at11_5s: at11, serverItems: await server(L) };
      console.log('C ', JSON.stringify(out.C));
      await d.close();
    }
  } finally { await L.close(); }
}

fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('saved', rel(P + '.json'));
