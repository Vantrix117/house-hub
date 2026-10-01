// Probe 6: the shared sprite offline (Chromium, service worker on): precached, and F260/Prayer icons still draw when the
// device is truly offline and the app was never opened online.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
const out = {};
const waitFor = async (page, fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn)) return true; } catch {} await sleep(250); } return false; };
try {
  const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli', sw: true });
  await d.goto('');
  out.controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
  await sleep(3000);
  out.inCache = await d.page.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); const r = await c.match('icons/sprite.svg') || await c.match(new URL('icons/sprite.svg', location.href).href); if (r) return { cache: k, type: r.headers.get('content-type'), len: (await r.text()).length }; } return null; });
  await d.ctx.setOffline(true); await d.setOffline(true);
  await d.page.reload({ waitUntil: 'load' }).catch(e => out.reloadErr = e.message);
  await sleep(1500);
  for (const app of ['f260', 'prayer']) {
    await d.page.evaluate(a => { location.hash = '#' + a; }, app); await sleep(3500);
    const f = d.frame(app);
    if (!f) { out[app] = 'no frame'; continue; }
    out[app] = await f.evaluate(async () => {
      const uses = [...document.querySelectorAll('svg.sym use')];
      const drawn = uses.filter(u => { try { const b = u.getBBox(); return b.width > 0 && b.height > 0; } catch { return false; } }).length;
      const r = await fetch('../icons/sprite.svg').then(r => r.status, e => 'ERR ' + e.message);
      return { uses: uses.length, drawn, fetch: r, onLine: navigator.onLine };
    }).catch(e => 'eval ' + e.message);
  }
  await d.page.screenshot({ path: 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-core/probes/p6-prayer-offline.png' });
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
